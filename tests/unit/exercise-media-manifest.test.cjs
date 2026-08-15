'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const projectRoot = path.resolve(__dirname, '..', '..');
const { exerciseCatalog } = require('../../src/data/exercise-catalog.js');
const mediaPolicy = require('../../src/data/exercise-media-policy.js');
const manifestPath = path.join(projectRoot, 'assets', 'exercises', 'manifest.json');

function loadManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('公开产品媒体台账完整覆盖25个动作且与目录一一对应', () => {
  const manifest = loadManifest();
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.policy.releaseRequiresReplacementFormats, ['gif']);
  assert.equal(manifest.assets.length, exerciseCatalog.length);
  assert.deepEqual(manifest.assets.map(item => item.id), exerciseCatalog.map(item => item.id));
  assert.deepEqual(manifest.assets.map(item => item.name), exerciseCatalog.map(item => item.name));
  assert.deepEqual(manifest.assets.map(item => item.current.path), exerciseCatalog.map(item => item.gif));
  for (const item of manifest.assets) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(item.rights.status, 'confirmed');
    assert.equal(item.production.status, 'approved');
    assert.equal(item.production.releaseEligible, true);
    assert.equal(item.reviews.rights, 'approved');
    assert.equal(item.reviews.motion, 'approved');
    assert.equal(item.reviews.visual, 'approved');
    assert.equal(item.reviews.safety, 'approved');
    assert.equal(typeof item.current.sha256, 'string');
    assert.match(item.current.sha256, /^[a-f0-9]{64}$/);
  }
});

test('25项本地动图库GIF全部进入前台发布清单', () => {
  const manifest = loadManifest();
  const candidates = manifest.assets;
  assert.equal(candidates.filter(item => item.production.releaseEligible).length, 25);
  const providers = new Set(candidates.map(item => item.origin.provider));
  assert.deepEqual([...providers].sort(), ['MOVE 28 Pillow', 'local ExerciseDB V1 library']);
  for (const item of candidates) {
    assert.equal(item.replacement.source, `assets/exercises/${item.id}.gif`);
    assert.equal(item.replacement.gif.path, `assets/exercises/${item.id}.gif`);
    const file = path.join(projectRoot, ...item.replacement.gif.path.split('/'));
    assert.equal(fs.statSync(file).size, item.replacement.gif.bytes);
    assert.equal(sha256(file), item.replacement.gif.sha256);
  }
});

test('旧assets/gifs仅作为本地来源库，参与者引用统一走assets/exercises', () => {
  const manifest = loadManifest();
  for (const item of manifest.assets) {
    assert.match(item.current.path, /^assets\/gifs\/.+\.gif$/);
    assert.match(item.replacement.gif.path, /^assets\/exercises\/.+\.gif$/);
    assert.notEqual(item.current.path, item.replacement.gif.path);
  }
});

test('参与者媒体策略按动作图对齐后展示全部25项动图', () => {
  const manifest = loadManifest();
  assert.equal(manifest.assets.filter(item => item.production.releaseEligible).length, 25);
  assert.deepEqual(mediaPolicy.releaseEligibleIds, manifest.assets.map(item => item.id));
  assert.equal(mediaPolicy.mode, 'media_enabled');
  for (const item of manifest.assets) {
    assert.equal(mediaPolicy.isReleaseEligible(item.id), true, item.id);
    const presentation = mediaPolicy.presentationFor(item.id);
    assert.equal(presentation.status, 'released');
    assert.equal(presentation.src, item.replacement.gif.path);
  }
  assert.equal(mediaPolicy.isReleaseEligible('unknown-exercise'), false);
  assert.equal(mediaPolicy.presentationFor('unknown-exercise').status, 'blocked');
  assert.ok(Object.isFrozen(mediaPolicy));
  assert.ok(Object.isFrozen(mediaPolicy.releaseEligibleIds));
});

test('经典脚本先加载媒体策略再加载参与者渲染器且首页不引用旧GIF或旧阻止文案', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const srcPath = value => value.split(/[?#]/, 1)[0];
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => srcPath(match[1]));
  const policyIndex = scripts.indexOf('src/data/exercise-media-policy.js');
  assert.ok(policyIndex > scripts.indexOf('src/data/exercise-catalog.js'));
  assert.ok(policyIndex < scripts.indexOf('src/ui/dashboard.js'));
  assert.ok(policyIndex < scripts.indexOf('src/ui/workout-guide.js'));
  assert.doesNotMatch(html, /<img[^>]+assets\/gifs\//i);
  assert.match(html, /25项动作图已上架/);
  assert.match(html, /动作内容按图对齐/);
  assert.doesNotMatch(html, /动图暂停展示|低质动图已从前台撤回|低质或语义不符动图不进入前台|仅保留文字指导|14项动作图已上架|11项继续文字指导|25项动图已开放|25项本地动图库GIF已开放|剩余15项已完成本地上架|0项继续阻止|10项Exact|15项未匹配|未匹配动作继续文字模式|Exact10已完成本阶段复核|ALL25 READY/);
  const context = {}; vm.createContext(context);
  for (const relative of ['src/namespace.js', 'src/data/exercise-media-policy.js']) {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, ...relative.split('/')), 'utf8'), context);
  }
  assert.equal(context.Move28.data.exerciseMediaPolicy.presentationFor('unknown').status, 'blocked');
});

test('媒体校验器审计和发布模式允许25项动作图上架', () => {
  const script = path.join(projectRoot, 'scripts', 'validate_exercise_media.py');
  const audit = spawnSync('python', [script], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(audit.status, 0, audit.stderr || audit.stdout);
  const auditReport = JSON.parse(audit.stdout);
  assert.equal(auditReport.ok, true);
  assert.equal(auditReport.assets, 25);

  const release = spawnSync('python', [script, '--release'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(release.status, 0, release.stderr || release.stdout);
  const releaseReport = JSON.parse(release.stdout);
  assert.equal(releaseReport.ok, true);
  assert.equal(releaseReport.releaseEligible, 25);
  assert.equal(releaseReport.releaseBlocked, 0);
  assert.deepEqual(releaseReport.errors, []);
});
