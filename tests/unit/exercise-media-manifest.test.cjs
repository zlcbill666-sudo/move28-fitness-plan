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

test('公开产品媒体台账完整覆盖25个动作且与目录一一对应', () => {
  const manifest = loadManifest();
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.assets.length, exerciseCatalog.length);
  assert.deepEqual(manifest.assets.map(item => item.id), exerciseCatalog.map(item => item.id));
  assert.deepEqual(manifest.assets.map(item => item.name), exerciseCatalog.map(item => item.name));
  assert.deepEqual(manifest.assets.map(item => item.current.path), exerciseCatalog.map(item => item.gif));
  for (const item of manifest.assets) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(['confirmed', 'blocked'].includes(item.rights.status));
    assert.ok(['reference_only', 'replacement_required', 'approved'].includes(item.production.status));
    assert.equal(typeof item.current.sha256, 'string');
    assert.match(item.current.sha256, /^[a-f0-9]{64}$/);
  }
});

test('本地ExerciseDB Exact10已安装为正式GIF资产', () => {
  const manifest = loadManifest();
  const released = manifest.assets.filter(item => item.origin.provider === 'local ExerciseDB V1 library');
  assert.equal(released.length, 10);
  for (const item of released) {
    assert.match(item.origin.exerciseId, /^[A-Za-z0-9]{7}$/);
    assert.equal(item.origin.sourceUrl, `local://bootstrapping-lab-exercisedb-api/media/${item.origin.exerciseId}.gif`);
    assert.equal(item.rights.status, 'confirmed');
    assert.equal(item.production.status, 'approved');
    assert.equal(item.production.releaseEligible, true);
    assert.equal(item.replacement.source, `assets/exercises/${item.id}.gif`);
    assert.equal(item.replacement.gif.path, `assets/exercises/${item.id}.gif`);
    const file = path.join(projectRoot, ...item.replacement.gif.path.split('/'));
    assert.equal(fs.statSync(file).size, item.replacement.gif.bytes);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), item.replacement.gif.sha256);
  }
});

test('旧ExerciseDB远端参考只保留未批准缺口且不得作为正式资产', () => {
  const manifest = loadManifest();
  const legacy = manifest.assets.filter(item => item.origin.provider === 'AscendAPI / ExerciseDB V1');
  assert.equal(legacy.length, 7);
  for (const item of legacy) {
    assert.match(item.origin.exerciseId, /^[A-Za-z0-9]{7}$/);
    assert.equal(item.origin.sourceUrl, `https://static.exercisedb.dev/media/${item.origin.exerciseId}.gif`);
    assert.equal(item.rights.status, 'blocked');
    assert.equal(item.production.status, 'reference_only');
    assert.equal(item.production.releaseEligible, false);
    assert.match(item.rights.reason, /商业|授权/);
  }
});

test('两项历史候选的动作语义缺口在媒体台账中明确阻断', () => {
  const manifest = loadManifest();
  const byId = Object.fromEntries(manifest.assets.map(item => [item.id, item]));
  assert.match(byId['flat-walk'].production.reason, /上坡跑步机.*0坡度平地慢走/);
  assert.match(byId['calf-stretch'].production.reason, /坐姿主动踝背屈.*不借助手、毛巾或弹力带/);
  assert.equal(byId['flat-walk'].production.releaseEligible, false);
  assert.equal(byId['calf-stretch'].production.releaseEligible, false);
});

test('项目原创简易GIF权利已确认但视觉替换完成前不得发布为正式素材', () => {
  const manifest = loadManifest();
  const originals = manifest.assets.filter(item => item.origin.provider === 'MOVE 28 Pillow');
  assert.equal(originals.length, 8);
  for (const item of originals) {
    assert.equal(item.rights.status, 'confirmed');
    assert.equal(item.production.status, 'replacement_required');
    assert.equal(item.production.releaseEligible, false);
  }
});

test('不存在未经四重审核就标记可发布的媒体', () => {
  const manifest = loadManifest();
  for (const item of manifest.assets) {
    if (!item.production.releaseEligible) continue;
    assert.equal(item.production.status, 'approved');
    assert.equal(item.rights.status, 'confirmed');
    assert.equal(item.reviews.rights, 'approved');
    assert.equal(item.reviews.motion, 'approved');
    assert.equal(item.reviews.visual, 'approved');
    assert.equal(item.reviews.safety, 'approved');
    for (const key of ['gif']) {
      assert.ok(item.replacement[key] && item.replacement[key].path);
    }
  }
});

test('参与者媒体策略与正式manifest逐项一致且未知动作失败关闭', () => {
  const manifest = loadManifest();
  const eligible = manifest.assets.filter(item => item.production.releaseEligible).map(item => item.id);
  assert.deepEqual(mediaPolicy.releaseEligibleIds, eligible);
  assert.equal(mediaPolicy.mode, eligible.length ? 'media_enabled' : 'text_only');
  for (const item of manifest.assets) {
    assert.equal(mediaPolicy.isReleaseEligible(item.id), item.production.releaseEligible, item.id);
    assert.equal(mediaPolicy.presentationFor(item.id).status, item.production.releaseEligible ? 'released' : 'blocked');
  }
  assert.equal(mediaPolicy.isReleaseEligible('unknown-exercise'), false);
  assert.equal(mediaPolicy.presentationFor('unknown-exercise').status, 'blocked');
  assert.ok(Object.isFrozen(mediaPolicy));
  assert.ok(Object.isFrozen(mediaPolicy.releaseEligibleIds));
});

test('经典脚本先加载媒体策略再加载参与者渲染器且首页不引用旧GIF', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  const policyIndex = scripts.indexOf('src/data/exercise-media-policy.js');
  assert.ok(policyIndex > scripts.indexOf('src/data/exercise-catalog.js'));
  assert.ok(policyIndex < scripts.indexOf('src/ui/dashboard.js'));
  assert.ok(policyIndex < scripts.indexOf('src/ui/workout-guide.js'));
  assert.doesNotMatch(html, /<img[^>]+assets\/gifs\//i);
  assert.match(html, /首批10项Exact本地动图已开放|首批动图已开放/);
  const context = {}; vm.createContext(context);
  for (const relative of ['src/namespace.js', 'src/data/exercise-media-policy.js']) {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, ...relative.split('/')), 'utf8'), context);
  }
  assert.equal(context.Move28.data.exerciseMediaPolicy.presentationFor('unknown').status, 'blocked');
});

test('媒体校验器审计和发布模式均只允许Exact10正式动图', () => {
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
  assert.equal(releaseReport.releaseEligible, 10);
  assert.equal(releaseReport.releaseBlocked, 15);
  assert.deepEqual(releaseReport.errors, []);
});
