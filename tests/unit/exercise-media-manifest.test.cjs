'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const { exerciseCatalog } = require('../../src/data/exercise-catalog.js');
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

test('ExerciseDB首批17项来源精确、商业权利阻塞且不得作为正式资产', () => {
  const manifest = loadManifest();
  const legacy = manifest.assets.filter(item => item.origin.provider === 'AscendAPI / ExerciseDB V1');
  assert.equal(legacy.length, 17);
  for (const item of legacy) {
    assert.match(item.origin.exerciseId, /^[A-Za-z0-9]{7}$/);
    assert.equal(item.origin.sourceUrl, `https://static.exercisedb.dev/media/${item.origin.exerciseId}.gif`);
    assert.equal(item.rights.status, 'blocked');
    assert.equal(item.production.status, 'reference_only');
    assert.equal(item.production.releaseEligible, false);
    assert.match(item.rights.reason, /商业|授权/);
  }
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
    for (const key of ['webm', 'mp4', 'poster', 'gif']) {
      assert.ok(item.replacement[key] && item.replacement[key].path);
    }
  }
});
