'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'media-src/scripts/build_local_exercisedb_candidate_package.py');
const mapping = path.join(root, 'docs/research/data/move28-local-exercisedb-mapping.json');
const library = 'E:\\个人用\\健身\\健身动作动画\\bootstrapping-lab-exercisedb-api';
const defaultPackage = path.join(root, 'media-build/internal-candidates/local-exercisedb-exact10');
const formalManifest = path.join(root, 'assets/exercises/manifest.json');
const python = process.env.PYTHON || 'python';

function run(args) {
  return spawnSync(python, ['-B', script, ...args], { cwd: root, encoding: 'utf8' });
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function temporary() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'move28-exact10-'));
}

test('默认内部候选包严格包含十项Exact且不授予发布资格', { skip: !fs.existsSync(defaultPackage) }, () => {
  const result = run(['--verify']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report, { ok: true, candidateCount: 10, releaseEligible: false, package: defaultPackage });
  const manifest = JSON.parse(fs.readFileSync(path.join(defaultPackage, 'candidate-manifest.json'), 'utf8'));
  assert.equal(manifest.releaseEligible, false);
  assert.equal(manifest.formalManifestModified, false);
  assert.equal(manifest.assets.length, 10);
  assert.ok(manifest.assets.every(item => item.releaseEligible === false));
  assert.ok(manifest.assets.every(item => /^[a-z0-9]+(?:-[a-z0-9]+)*\.gif$/.test(item.filename)));
});

test('候选包可从冻结本地库确定性重建', { skip: !fs.existsSync(library) }, () => {
  const temp = temporary();
  const output = path.join(temp, 'package');
  const result = run(['--library', library, '--output', output]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const expected = JSON.parse(fs.readFileSync(path.join(defaultPackage, 'candidate-manifest.json'), 'utf8'));
  const actual = JSON.parse(fs.readFileSync(path.join(output, 'candidate-manifest.json'), 'utf8'));
  assert.deepEqual(actual, expected);
  assert.deepEqual(fs.readFileSync(path.join(output, 'preview.html')), fs.readFileSync(path.join(defaultPackage, 'preview.html')));
  for (const item of actual.assets) assert.deepEqual(fs.readFileSync(path.join(output, 'gifs', item.filename)), fs.readFileSync(path.join(defaultPackage, 'gifs', item.filename)));
  fs.rmSync(temp, { recursive: true, force: true });
});

test('任一GIF篡改、额外文件或发布门漂移均失败关闭', { skip: !fs.existsSync(defaultPackage) }, () => {
  for (const mutate of [
    output => fs.appendFileSync(path.join(output, 'gifs', 'glute-bridge.gif'), 'x'),
    output => fs.writeFileSync(path.join(output, 'unexpected.txt'), 'x'),
    output => {
      const file = path.join(output, 'candidate-manifest.json');
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      data.releaseEligible = true;
      fs.writeFileSync(file, JSON.stringify(data));
    },
  ]) {
    const temp = temporary();
    const output = path.join(temp, 'package');
    fs.cpSync(defaultPackage, output, { recursive: true });
    mutate(output);
    const result = run(['--output', output, '--verify']);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "candidate_package_failed"/);
    assert.doesNotMatch(result.stderr, /Traceback|glute-bridge/);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('同步替换GIF与manifest自洽证据仍因冻结映射失败关闭', { skip: !fs.existsSync(defaultPackage) }, () => {
  const temp = temporary();
  const output = path.join(temp, 'package');
  fs.cpSync(defaultPackage, output, { recursive: true });
  const manifestFile = path.join(output, 'candidate-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const source = path.join(output, 'gifs', 'seated-leg-curl.gif');
  const target = path.join(output, 'gifs', 'seated-leg-press.gif');
  fs.copyFileSync(source, target);
  const item = manifest.assets.find(asset => asset.exerciseId === 'seated-leg-press');
  const sourceItem = manifest.assets.find(asset => asset.exerciseId === 'seated-leg-curl');
  Object.assign(item, {
    sha256: hash(target),
    bytes: fs.statSync(target).size,
    width: sourceItem.width,
    height: sourceItem.height,
    frameCount: sourceItem.frameCount,
    durationMs: sourceItem.durationMs,
  });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = run(['--output', output, '--verify']);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"error": "candidate_package_failed"/);
  assert.doesNotMatch(result.stderr, /Traceback/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('错误源构建失败时保留已有候选包且不泄漏内部异常', () => {
  const temp = temporary();
  const output = path.join(temp, 'package');
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, 'sentinel'), 'old');
  const badLibrary = path.join(temp, 'bad-library');
  fs.mkdirSync(badLibrary);
  const result = run(['--library', badLibrary, '--output', output]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"error": "candidate_package_failed"/);
  assert.doesNotMatch(result.stderr, /Traceback|bad-library/);
  assert.equal(fs.readFileSync(path.join(output, 'sentinel'), 'utf8'), 'old');
  assert.deepEqual(fs.readdirSync(output), ['sentinel']);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('输出不得覆盖冻结映射、正式manifest、构建脚本或本地源媒体', { skip: !fs.existsSync(library) }, () => {
  const protectedOutputs = [mapping, formalManifest, script, path.join(library, 'media')];
  const snapshot = target => fs.statSync(target).isFile() ? hash(target) : fs.readdirSync(target).length;
  const before = protectedOutputs.map(snapshot);
  for (const output of protectedOutputs) {
    const result = run(['--library', library, '--output', output]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "candidate_package_failed"/);
    assert.doesNotMatch(result.stderr, /Traceback/);
  }
  assert.deepEqual(protectedOutputs.map(snapshot), before);
});

test('安装新包失败时恢复旧候选包且清理临时目录', { skip: !fs.existsSync(library) }, () => {
  const temp = temporary();
  const output = path.join(temp, 'package');
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, 'sentinel'), 'old');
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p,library,out=map(pathlib.Path,sys.argv[1:]); spec=importlib.util.spec_from_file_location('pkg',p); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
original=pathlib.Path.replace
def fail_install(self,target):
    if self.name.startswith('.package.') and self.name.endswith('.tmp'): raise OSError('injected')
    return original(self,target)
pathlib.Path.replace=fail_install
try: m.install_package(library,out); ok=True
except Exception: ok=False
print(json.dumps({'ok':ok,'entries':sorted(x.name for x in out.iterdir()),'siblings':sorted(x.name for x in out.parent.iterdir())}))
`;
  const result = spawnSync(python, ['-B', '-c', probe, script, library, output], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, entries: ['sentinel'], siblings: ['package'] });
  assert.equal(fs.readFileSync(path.join(output, 'sentinel'), 'utf8'), 'old');
  fs.rmSync(temp, { recursive: true, force: true });
});

test('验证拒绝指向候选包的目录链接或Windows junction', { skip: !fs.existsSync(defaultPackage) }, t => {
  const temp = temporary();
  const linked = path.join(temp, 'linked-package');
  try {
    fs.symlinkSync(defaultPackage, linked, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    t.skip(`link creation unavailable: ${error.code || 'unknown'}`);
    return;
  }
  const result = run(['--output', linked, '--verify']);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"error": "candidate_package_failed"/);
  assert.doesNotMatch(result.stderr, /Traceback/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('源media目录junction与单个候选GIF链接均在复制前拒绝', { skip: !fs.existsSync(library) }, t => {
  const temp = temporary();
  const linkedLibrary = path.join(temp, 'linked-library');
  const fileLibrary = path.join(temp, 'file-library');
  fs.mkdirSync(linkedLibrary);
  fs.mkdirSync(path.join(fileLibrary, 'media'), { recursive: true });
  try {
    fs.symlinkSync(path.join(library, 'media'), path.join(linkedLibrary, 'media'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.symlinkSync(path.join(library, 'media', '10Z2DXU.gif'), path.join(fileLibrary, 'media', '10Z2DXU.gif'), 'file');
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    t.skip(`link creation unavailable: ${error.code || 'unknown'}`);
    return;
  }
  for (const [index, sourceLibrary] of [linkedLibrary, fileLibrary].entries()) {
    const output = path.join(temp, `package-${index}`);
    const result = run(['--library', sourceLibrary, '--output', output]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "candidate_package_failed"/);
    assert.doesNotMatch(result.stderr, /Traceback/);
    assert.equal(fs.existsSync(output), false);
  }
  fs.rmSync(temp, { recursive: true, force: true });
});

test('CLI在解析前拒绝本地素材库根目录链接或Windows junction', { skip: !fs.existsSync(library) }, t => {
  const temp = temporary();
  const linkedLibrary = path.join(temp, 'linked-root');
  try {
    fs.symlinkSync(library, linkedLibrary, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    t.skip(`link creation unavailable: ${error.code || 'unknown'}`);
    return;
  }
  const output = path.join(temp, 'package');
  const result = run(['--library', linkedLibrary, '--output', output]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"error": "candidate_package_failed"/);
  assert.doesNotMatch(result.stderr, /Traceback/);
  assert.equal(fs.existsSync(output), false);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('正式manifest在候选包构建前后保持字节不变且当前前台质量门阻止本地图库开放', { skip: !fs.existsSync(library) }, () => {
  const before = hash(formalManifest);
  const temp = temporary();
  const result = run(['--library', library, '--output', path.join(temp, 'package')]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(hash(formalManifest), before);
  const manifest = JSON.parse(fs.readFileSync(formalManifest, 'utf8'));
  assert.equal(manifest.assets.length, 25);
  assert.deepEqual(manifest.assets.filter(item => item.production.releaseEligible).map(item => item.id), []);
  assert.equal(manifest.policy.frontendMediaMode, 'text_only_quality_review');
  fs.rmSync(temp, { recursive: true, force: true });
});

test('冻结映射漂移会在复制前失败', () => {
  const temp = temporary();
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); fake=pathlib.Path(sys.argv[2]); out=pathlib.Path(sys.argv[3]); spec=importlib.util.spec_from_file_location('pkg',p); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.MAPPING=fake
try: m.install_package(pathlib.Path(sys.argv[4]),out); ok=True
except Exception: ok=False
print(json.dumps({'ok':ok,'exists':out.exists()}))
`;
  const fake = path.join(temp, 'mapping.json');
  fs.copyFileSync(mapping, fake);
  fs.appendFileSync(fake, '\n');
  const result = spawnSync(python, ['-B', '-c', probe, script, fake, path.join(temp, 'package'), library], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { ok: false, exists: false });
  fs.rmSync(temp, { recursive: true, force: true });
});
