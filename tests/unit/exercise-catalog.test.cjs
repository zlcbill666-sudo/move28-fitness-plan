const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

const EXPECTED_NAMES = [
  '坐姿抬腿', '脚踝绕环', '坐姿腿举', '坐姿腿弯举', '臀桥', '推胸机', '坐姿划船',
  '抗旋转推压', '高位坐姿起立', '坐姿腿屈伸', '髋外展机', '墙壁俯卧撑', '死虫式',
  '椭圆机／交叉训练机', '平地慢走', '大腿后侧拉伸', '小腿拉伸'
];
const EXPECTED_GIFS = [
  'assets/gifs/02_坐姿抬腿.gif', 'assets/gifs/03_脚踝绕环.gif', 'assets/gifs/04_坐姿腿举.gif',
  'assets/gifs/05_坐姿腿弯举.gif', 'assets/gifs/06_臀桥.gif', 'assets/gifs/07_推胸机.gif',
  'assets/gifs/08_坐姿划船.gif', 'assets/gifs/09_抗旋转推压.gif', 'assets/gifs/10_高位坐姿起立.gif',
  'assets/gifs/11_坐姿腿屈伸.gif', 'assets/gifs/12_髋外展机.gif', 'assets/gifs/13_墙壁俯卧撑.gif',
  'assets/gifs/14_死虫式.gif', 'assets/gifs/15_椭圆机.gif', 'assets/gifs/16_平地慢走.gif',
  'assets/gifs/17_大腿后侧拉伸.gif', 'assets/gifs/18_小腿拉伸.gif'
];
const REQUIRED_FIELDS = [
  'id', 'name', 'pattern', 'settings', 'equipment', 'difficulty', 'dose', 'contraindications',
  'regressionIds', 'progressionIds', 'gif', 'reviewStatus', 'cues'
];
const PATTERNS = new Set([
  'mobility', 'knee_dominant', 'knee_flexion', 'hip_extension', 'horizontal_push',
  'horizontal_pull', 'anti_rotation', 'knee_extension', 'hip_abduction', 'anti_extension',
  'cardio', 'locomotion', 'hinge'
]);
const SETTINGS = new Set(['gym', 'home', 'outdoors']);
const REVIEW_STATUSES = new Set(['draft', 'approved', 'retired']);

function loadCatalogAndPlan() {
  clearMove28ModuleCache();
  const catalogApi = loadScript('exerciseCatalog');
  const planApi = loadScript('legacyPlan');
  return { ...catalogApi, ...planApi };
}

test('17项动作目录保持现有顺序、名称、GIF与已审核基线', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  assert.equal(exerciseCatalog.length, 17);
  assert.deepEqual(exerciseCatalog.map(exercise => exercise.name), EXPECTED_NAMES);
  assert.deepEqual(exerciseCatalog.map(exercise => exercise.gif), EXPECTED_GIFS);
  assert.ok(exerciseCatalog.every(exercise => exercise.reviewStatus === 'approved'));
});

test('动作目录ID和名称唯一，且每项结构、枚举和范围有效', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  assert.equal(new Set(exerciseCatalog.map(exercise => exercise.id)).size, exerciseCatalog.length);
  assert.equal(new Set(exerciseCatalog.map(exercise => exercise.name)).size, exerciseCatalog.length);

  for (const exercise of exerciseCatalog) {
    for (const field of REQUIRED_FIELDS) assert.ok(Object.hasOwn(exercise, field), `${exercise.name} 缺少 ${field}`);
    assert.match(exercise.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(PATTERNS.has(exercise.pattern), `${exercise.name} pattern非法`);
    assert.ok(Array.isArray(exercise.settings) && exercise.settings.length > 0);
    assert.ok(exercise.settings.every(setting => SETTINGS.has(setting)));
    assert.ok(Array.isArray(exercise.equipment) && exercise.equipment.length > 0);
    assert.ok(Number.isInteger(exercise.difficulty) && exercise.difficulty >= 1 && exercise.difficulty <= 3);
    assert.ok(Array.isArray(exercise.contraindications));
    assert.ok(Array.isArray(exercise.regressionIds));
    assert.ok(Array.isArray(exercise.progressionIds));
    assert.ok(REVIEW_STATUSES.has(exercise.reviewStatus));
    assert.deepEqual(Object.keys(exercise.cues), ['setup', 'movement', 'breathing', 'pain']);
    for (const key of ['sets', 'reps', 'rpe', 'restSec']) {
      const range = exercise.dose[key];
      assert.ok(Array.isArray(range) && range.length === 2, `${exercise.name}.${key} 必须是[min,max]`);
      assert.ok(range.every(Number.isFinite), `${exercise.name}.${key} 必须是有限数`);
      assert.ok(range[0] <= range[1], `${exercise.name}.${key} min不能大于max`);
    }
    for (const [key, range] of Object.entries(exercise.dose)) {
      assert.ok(Array.isArray(range) && range.length === 2, `${exercise.name}.${key} 必须是[min,max]`);
      assert.ok(range.every(Number.isFinite) && range[0] <= range[1]);
    }
  }
  assert.deepEqual(validateExerciseCatalog(exerciseCatalog), []);
});

test('GIF均为assets/gifs下真实文件，关系引用存在且不自引用', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  const ids = new Set(exerciseCatalog.map(exercise => exercise.id));
  for (const exercise of exerciseCatalog) {
    assert.match(exercise.gif, /^assets\/gifs\/[^/]+\.gif$/);
    assert.ok(fs.existsSync(path.join(projectRoot, ...exercise.gif.split('/'))), `${exercise.gif} 不存在`);
    for (const relatedId of [...exercise.regressionIds, ...exercise.progressionIds]) {
      assert.ok(ids.has(relatedId), `${exercise.id} 引用了不存在的 ${relatedId}`);
      assert.notEqual(relatedId, exercise.id, `${exercise.id} 不能自引用`);
    }
  }
});

test('审核过滤器只返回approved动作且不改变默认目录', () => {
  const { exerciseCatalog, getApprovedExercises } = loadCatalogAndPlan();
  const sample = [
    { ...exerciseCatalog[0], reviewStatus: 'draft' },
    exerciseCatalog[1],
    { ...exerciseCatalog[2], reviewStatus: 'retired' }
  ];
  assert.deepEqual(getApprovedExercises(sample), [exerciseCatalog[1]]);
  assert.deepEqual(getApprovedExercises(), exerciseCatalog);
});

test('legacyDemoPlan.exercises直接引用目录对象，不复制动作内容', () => {
  const { exerciseCatalog, legacyDemoPlan } = loadCatalogAndPlan();
  assert.strictEqual(legacyDemoPlan.exercises, exerciseCatalog);
  exerciseCatalog.forEach((exercise, index) => assert.strictEqual(legacyDemoPlan.exercises[index], exercise));
});

test('当前MVP明确保留home horizontal_pull与hinge缺口', () => {
  const { getApprovedExercises } = loadCatalogAndPlan();
  const homePatterns = new Set(getApprovedExercises()
    .filter(exercise => exercise.settings.includes('home'))
    .map(exercise => exercise.pattern));
  assert.equal(homePatterns.has('horizontal_pull'), false);
  assert.equal(homePatterns.has('hinge'), false);
});

test('验证器为损坏目录返回可定位的结构化错误', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  const invalid = exerciseCatalog.map(exercise => ({ ...exercise }));
  invalid[0] = { ...invalid[0], id: invalid[1].id, difficulty: 4, dose: { ...invalid[0].dose, reps: [12, 8] } };
  const errors = validateExerciseCatalog(invalid);
  assert.ok(errors.length >= 3);
  assert.ok(errors.every(error => typeof error.path === 'string' && typeof error.message === 'string'));
  assert.ok(errors.some(error => error.path.endsWith('.id')));
  assert.ok(errors.some(error => error.path.endsWith('.difficulty')));
  assert.ok(errors.some(error => error.path.endsWith('.dose.reps')));
});
