'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { pipeline } = require('stream');

const root = process.cwd();
const port = Number.parseInt(process.argv[2] || '8765', 10);
const host = process.argv[3] || '127.0.0.1';

if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid port');
  process.exit(2);
}

const TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon'
});

function safePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch (_error) {
    return null;
  }
  const normalized = path.normalize(decoded === '/' ? '/index.html' : decoded);
  const relative = normalized.replace(/^[/\\]+/, '');
  const absolute = path.resolve(root, relative);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) return null;
  return absolute;
}

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  const file = safePath(req.url || '/');
  if (!file) {
    send(res, 403, 'Forbidden');
    return;
  }
  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }
    const headers = {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-store'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file);
    const benignStreamErrors = new Set([
      'ERR_STREAM_PREMATURE_CLOSE',
      'ERR_STREAM_UNABLE_TO_PIPE',
      'ECONNRESET',
      'EPIPE'
    ]);
    try {
      pipeline(stream, res, error => {
        if (!error || benignStreamErrors.has(error.code)) return;
        console.error(`static-server stream error: ${error.code || error.message}`);
      });
    } catch (error) {
      stream.destroy();
      if (!benignStreamErrors.has(error.code)) {
        console.error(`static-server stream error: ${error.code || error.message}`);
      }
    }
  });
});

server.on('clientError', (error, socket) => {
  if (socket.destroyed) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen({ host, port, backlog: 512 }, () => {
  console.log(`Serving ${root} on http://${host}:${port}/`);
});
