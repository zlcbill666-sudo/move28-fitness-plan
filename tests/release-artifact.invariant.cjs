const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release','runtime-manifest.json'),'utf8'));
const toPosix=value=>value.split(path.sep).join('/');

function artifactEntries(directory,base=directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const absolute=path.join(directory,entry.name);
    const relative=toPosix(path.relative(base,absolute));
    assert.equal(entry.isSymbolicLink(),false,`artifact symlink: ${relative}`);
    if(entry.isDirectory())return artifactEntries(absolute,base);
    assert.equal(entry.isFile(),true,`artifact non-file: ${relative}`);
    return relative;
  });
}

test('generated participant artifact is exactly the runtime allowlist',()=>{
  assert.equal(fs.statSync(dist).isDirectory(),true);
  const actual=artifactEntries(dist).sort();
  assert.deepEqual(actual,[...manifest.files].sort());
  for(const required of [
    '.nojekyll',
    'index.html',
    'assets/css/app.css',
    'src/app.js',
    'docs/pilot/participant-guide.md'
  ])assert.equal(actual.includes(required),true,`missing required runtime file: ${required}`);
});

test('generated participant artifact excludes every forbidden repository area',()=>{
  const actual=artifactEntries(dist);
  const forbidden=[
    '.git',
    'assets/gifs',
    'assets/exercises',
    'media-build',
    'media-src',
    'docs/research',
    'tests',
    'scripts'
  ];
  for(const blocked of forbidden){
    assert.equal(
      actual.some(file=>file===blocked||file.startsWith(`${blocked}/`)),
      false,
      `forbidden artifact entry: ${blocked}`
    );
    assert.equal(fs.existsSync(path.join(dist,...blocked.split('/'))),false,blocked);
  }
  assert.equal(actual.some(file=>file.toLowerCase().endsWith('.gif')),false,'GIF assets are forbidden');
});
