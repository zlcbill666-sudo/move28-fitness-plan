'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

const EXPECTED_NAMES = [
  '坐姿抬腿', '脚踝绕环', '坐姿腿举', '坐姿腿弯举', '臀桥', '墙触髋铰链', '推胸机',
  '站姿弹力带推胸', '坐姿划船', '弹力带划船', '抗旋转推压', '高位坐姿起立', '坐姿腿屈伸',
  '坐姿徒手伸膝', '髋外展机', '墙壁俯卧撑', '死虫式', '椭圆机／交叉训练机', '平地慢走',
  '大腿后侧拉伸', '小腿拉伸'
];
const EXPECTED_GIFS = [
  'assets/gifs/02_坐姿抬腿.gif', 'assets/gifs/03_脚踝绕环.gif', 'assets/gifs/04_坐姿腿举.gif',
  'assets/gifs/05_坐姿腿弯举.gif', 'assets/gifs/06_臀桥.gif', 'assets/gifs/20_墙触髋铰链.gif', 'assets/gifs/07_推胸机.gif',
  'assets/gifs/21_站姿弹力带推胸.gif', 'assets/gifs/08_坐姿划船.gif', 'assets/gifs/19_弹力带划船.gif',
  'assets/gifs/09_抗旋转推压.gif', 'assets/gifs/10_高位坐姿起立.gif', 'assets/gifs/11_坐姿腿屈伸.gif',
  'assets/gifs/22_坐姿徒手伸膝.gif', 'assets/gifs/12_髋外展机.gif', 'assets/gifs/13_墙壁俯卧撑.gif',
  'assets/gifs/14_死虫式.gif', 'assets/gifs/15_椭圆机.gif', 'assets/gifs/16_平地慢走.gif',
  'assets/gifs/17_大腿后侧拉伸.gif', 'assets/gifs/18_小腿拉伸.gif'
];
const REQUIRED_FIELDS = [
  'id', 'name', 'pattern', 'settings', 'equipment', 'equipmentOptions', 'difficulty', 'dose', 'contraindications',
  'regressionIds', 'progressionIds', 'gif', 'reviewStatus', 'cues'
];
const EXPECTED_EQUIPMENT_IDS = [
  'stable_chair', 'stable_high_bench', 'exercise_mat', 'leg_press_machine', 'leg_curl_machine',
  'chest_press_machine', 'seated_row_machine', 'resistance_band', 'cable_machine',
  'leg_extension_machine', 'hip_abduction_machine', 'wall', 'elliptical_trainer', 'treadmill',
  'flat_walking_route'
];
const DOSE_KEYS = ['sets', 'reps', 'rpe', 'restSec', 'durationMin', 'holdSec'];
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

function assertOriginalGif(filename, expectedHash, label) {
  const gif = fs.readFileSync(path.join(projectRoot, 'assets', 'gifs', filename));
  assert.match(gif.subarray(0, 6).toString('ascii'), /^GIF8[79]a$/);
  assert.equal(gif.readUInt16LE(6), 180);
  assert.equal(gif.readUInt16LE(8), 180);
  let frameCount = 0;
  for (let index = 0; index <= gif.length - 3; index++) {
    if (gif[index] === 0x21 && gif[index + 1] === 0xf9 && gif[index + 2] === 0x04) frameCount += 1;
  }
  assert.equal(frameCount, 15, `${label}必须是15帧`);
  assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')), `${label}必须包含循环播放标记`);
  assert.equal(crypto.createHash('sha256').update(gif).digest('hex'), expectedHash);
}

test('动作目录保持现有顺序、名称、GIF与已审核基线', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  assert.deepEqual(exerciseCatalog.map(exercise => exercise.name), EXPECTED_NAMES);
  assert.deepEqual(exerciseCatalog.map(exercise => exercise.gif), EXPECTED_GIFS);
  assert.ok(exerciseCatalog.every(exercise => exercise.reviewStatus === 'approved'));
});

test('动作目录ID和名称唯一，且每项结构、枚举和范围有效', () => {
  const { exerciseCatalog, validateExerciseCatalog, EQUIPMENT_IDS, DOSE_KEYS: exportedDoseKeys } = loadCatalogAndPlan();
  assert.deepEqual(EQUIPMENT_IDS, EXPECTED_EQUIPMENT_IDS);
  assert.equal(new Set(EQUIPMENT_IDS).size, EQUIPMENT_IDS.length);
  assert.ok(EQUIPMENT_IDS.every(id => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(id)));
  assert.deepEqual(exportedDoseKeys, DOSE_KEYS);
  assert.equal(new Set(exerciseCatalog.map(exercise => exercise.id)).size, exerciseCatalog.length);
  assert.equal(new Set(exerciseCatalog.map(exercise => exercise.name)).size, exerciseCatalog.length);

  for (const exercise of exerciseCatalog) {
    for (const field of REQUIRED_FIELDS) assert.ok(Object.hasOwn(exercise, field), `${exercise.name} 缺少 ${field}`);
    assert.match(exercise.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(PATTERNS.has(exercise.pattern), `${exercise.name} pattern非法`);
    assert.ok(Array.isArray(exercise.settings) && exercise.settings.length > 0);
    assert.ok(exercise.settings.every(setting => SETTINGS.has(setting)));
    assert.ok(Array.isArray(exercise.equipment) && exercise.equipment.length > 0);
    assert.equal(new Set(exercise.equipment).size, exercise.equipment.length, `${exercise.name} equipment不得重复`);
    assert.ok(exercise.equipment.every(id => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(id) && EQUIPMENT_IDS.includes(id)));
    assert.ok(Array.isArray(exercise.equipmentOptions) && exercise.equipmentOptions.length > 0);
    assert.ok(exercise.equipmentOptions.every(option => Array.isArray(option) && option.length > 0));
    assert.ok(exercise.equipmentOptions.every(option => new Set(option).size === option.length));
    assert.deepEqual(new Set(exercise.equipment), new Set(exercise.equipmentOptions.flat()));
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

test('替代器械使用any-of方案表达，索引equipment是所有方案的精确并集', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  const byId = Object.fromEntries(exerciseCatalog.map(exercise => [exercise.id, exercise]));
  assert.deepEqual(byId['pallof-press'].equipmentOptions, [['resistance_band'], ['cable_machine']]);
  assert.deepEqual(byId['flat-walk'].equipmentOptions, [['treadmill'], ['flat_walking_route']]);
  assert.deepEqual(byId['hamstring-stretch'].equipmentOptions, [['stable_chair'], ['exercise_mat']]);
  assert.deepEqual(byId['high-seat-sit-to-stand'].equipmentOptions, [['stable_high_bench'], ['stable_chair']]);
  for (const exercise of exerciseCatalog) {
    assert.deepEqual(exercise.equipment, [...new Set(exercise.equipmentOptions.flat())]);
  }
});

test('关系图精确锁定，不允许目录隐式新增关系', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  assert.deepEqual(exerciseCatalog.map(({ id, regressionIds, progressionIds }) => ({ id, regressionIds, progressionIds })), [
    { id: 'seated-leg-raise', regressionIds: [], progressionIds: [] },
    { id: 'ankle-circle', regressionIds: [], progressionIds: [] },
    { id: 'seated-leg-press', regressionIds: ['high-seat-sit-to-stand'], progressionIds: [] },
    { id: 'seated-leg-curl', regressionIds: [], progressionIds: [] },
    { id: 'glute-bridge', regressionIds: ['wall-hip-hinge'], progressionIds: [] },
    { id: 'wall-hip-hinge', regressionIds: [], progressionIds: ['glute-bridge'] },
    { id: 'chest-press-machine', regressionIds: ['wall-push-up', 'standing-band-chest-press'], progressionIds: [] },
    { id: 'standing-band-chest-press', regressionIds: [], progressionIds: ['chest-press-machine'] },
    { id: 'seated-row', regressionIds: ['band-row'], progressionIds: [] },
    { id: 'band-row', regressionIds: [], progressionIds: ['seated-row'] },
    { id: 'pallof-press', regressionIds: [], progressionIds: [] },
    { id: 'high-seat-sit-to-stand', regressionIds: [], progressionIds: ['seated-leg-press'] },
    { id: 'seated-leg-extension', regressionIds: ['seated-knee-extension-unloaded'], progressionIds: [] },
    { id: 'seated-knee-extension-unloaded', regressionIds: [], progressionIds: ['seated-leg-extension'] },
    { id: 'hip-abduction-machine', regressionIds: [], progressionIds: [] },
    { id: 'wall-push-up', regressionIds: [], progressionIds: ['chest-press-machine'] },
    { id: 'dead-bug', regressionIds: [], progressionIds: [] },
    { id: 'elliptical-trainer', regressionIds: ['flat-walk'], progressionIds: [] },
    { id: 'flat-walk', regressionIds: [], progressionIds: [] },
    { id: 'hamstring-stretch', regressionIds: [], progressionIds: [] },
    { id: 'calf-stretch', regressionIds: [], progressionIds: [] }
  ]);
});

test('排除标签来自固定审核枚举并精确标注当前动作', () => {
  const { exerciseCatalog, EXCLUSION_TAGS, validateExerciseCatalog } = loadCatalogAndPlan();
  assert.deepEqual(EXCLUSION_TAGS, ['deep_knee_bend','overhead','floor','single_leg','hinge']);
  const tagged = Object.fromEntries(exerciseCatalog.filter(item => item.contraindications.length).map(item => [item.id,item.contraindications]));
  assert.deepEqual(tagged, {
    'seated-leg-press':['deep_knee_bend'],
    'glute-bridge':['floor'],
    'wall-hip-hinge':['hinge'],
    'dead-bug':['floor']
  });
  for (const contraindications of [['unknown'],['floor','floor']]) {
    const invalid = exerciseCatalog.map(item => ({...item,contraindications:[...item.contraindications]}));
    invalid[0].contraindications = contraindications;
    assert.ok(validateExerciseCatalog(invalid).some(item => item.path.endsWith('.contraindications')));
  }
});

test('cues逐项严格映射legacy原文', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  for (const exercise of exerciseCatalog) {
    assert.equal(exercise.cues.setup, exercise.start, `${exercise.id}.setup原文漂移`);
    assert.equal(exercise.cues.movement, exercise.steps, `${exercise.id}.movement原文漂移`);
    assert.equal(exercise.cues.breathing, exercise.breath, `${exercise.id}.breathing原文漂移`);
    assert.equal(exercise.cues.pain, exercise.safety, `${exercise.id}.pain原文漂移`);
  }
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
  const approved = getApprovedExercises();
  assert.deepEqual(approved, exerciseCatalog);
  assert.notStrictEqual(approved, exerciseCatalog);
  assert.strictEqual(approved[0], exerciseCatalog[0]);
});

test('legacyDemoPlan.exercises直接引用目录对象，不复制动作内容', () => {
  const { exerciseCatalog, legacyDemoPlan } = loadCatalogAndPlan();
  assert.strictEqual(legacyDemoPlan.exercises, exerciseCatalog);
  exerciseCatalog.forEach((exercise, index) => assert.strictEqual(legacyDemoPlan.exercises[index], exercise));
});

test('band-row和wall-hip-hinge关闭居家必需动作缺口', () => {
  const { getApprovedExercises } = loadCatalogAndPlan();
  const homePatterns = new Set(getApprovedExercises()
    .filter(exercise => exercise.settings.includes('home'))
    .map(exercise => exercise.pattern));
  assert.equal(homePatterns.has('horizontal_pull'), true);
  assert.equal(homePatterns.has('hinge'), true);
});

test('band-row元数据、四类提示、legacy字段与原创动画契约精确锁定', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  const bandRow = exerciseCatalog.find(exercise => exercise.id === 'band-row');
  assert.ok(bandRow);
  assert.equal(bandRow.name, '弹力带划船');
  assert.equal(bandRow.pattern, 'horizontal_pull');
  assert.deepEqual(bandRow.settings, ['home', 'gym']);
  assert.deepEqual(bandRow.equipment, ['resistance_band']);
  assert.deepEqual(bandRow.equipmentOptions, [['resistance_band']]);
  assert.equal(bandRow.difficulty, 1);
  assert.deepEqual(bandRow.dose, { sets:[2,3], reps:[8,12], rpe:[5,6], restSec:[60,90] });
  assert.deepEqual(bandRow.contraindications, []);
  assert.deepEqual(bandRow.regressionIds, []);
  assert.deepEqual(bandRow.progressionIds, ['seated-row']);
  assert.equal(bandRow.reviewStatus, 'approved');
  assert.deepEqual(bandRow.cues, {
    setup:'将弹力带牢固固定在胸口高度，面对固定点稳定站立，双脚与髋同宽，躯干中立，双手握住弹力带并伸臂。',
    movement:'肩膀保持远离耳朵，肘沿身体两侧向后拉至手靠近肋骨；短暂停顿，再受控伸臂回到起点，全程不后仰借力。',
    breathing:'后拉时呼气，受控回位时吸气。',
    pain:'先确认固定点牢固并使用轻阻力；肩、肘或腰出现锐痛时立即停止。'
  });
  assert.equal(bandRow.cues.setup, bandRow.start);
  assert.equal(bandRow.cues.movement, bandRow.steps);
  assert.equal(bandRow.cues.breathing, bandRow.breath);
  assert.equal(bandRow.cues.pain, bandRow.safety);
  assert.equal(typeof bandRow.errors, 'string');
  assert.ok(bandRow.errors.includes('后仰借力'));
  assert.deepEqual(bandRow.groups, ['力量A', '力量B']);

  assertOriginalGif('19_弹力带划船.gif', '29cb4c95531f1c003159e3b3f69bef8c9999ea0c47a8e8b764cab1345e35dc4c', '弹力带划船GIF');
});

test('Task6第一组动作元数据、关系与原创媒体契约精确锁定', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  const byId = Object.fromEntries(exerciseCatalog.map(item => [item.id, item]));
  const expected = {
    'wall-hip-hinge': { name:'墙触髋铰链', pattern:'hinge', equipment:'wall', contraindications:['hinge'], progressionIds:['glute-bridge'], gif:'20_墙触髋铰链.gif', hash:'0295ad78498e4d3ce7a1a5363230c2c661539fdaeab1418d7ba0a879dff6e23a' },
    'standing-band-chest-press': { name:'站姿弹力带推胸', pattern:'horizontal_push', equipment:'resistance_band', contraindications:[], progressionIds:['chest-press-machine'], gif:'21_站姿弹力带推胸.gif', hash:'34397eb48b7654597f7ab89d5ff4426ae6a853483f1c9cb4217830ef2687de16' },
    'seated-knee-extension-unloaded': { name:'坐姿徒手伸膝', pattern:'knee_extension', equipment:'stable_chair', contraindications:[], progressionIds:['seated-leg-extension'], gif:'22_坐姿徒手伸膝.gif', hash:'3a87632b92ad6b25d49046b58feb2ba2930e775922775bc49c63614e8318c5c8' }
  };
  for (const [id, contract] of Object.entries(expected)) {
    const item = byId[id];
    assert.ok(item, `${id}不存在`);
    assert.equal(item.name, contract.name);
    assert.equal(item.pattern, contract.pattern);
    assert.deepEqual(item.settings, ['home','gym']);
    assert.deepEqual(item.equipmentOptions, [[contract.equipment]]);
    assert.equal(item.difficulty, 1);
    assert.deepEqual(item.dose, { sets:[2,3], reps:[8,12], rpe:[5,6], restSec:[60,90] });
    assert.deepEqual(item.contraindications, contract.contraindications);
    assert.deepEqual(item.progressionIds, contract.progressionIds);
    assert.equal(item.reviewStatus, 'approved');
    assert.deepEqual(Object.keys(item.cues), ['setup','movement','breathing','pain']);
    assert.ok(Object.values(item.cues).every(value => typeof value === 'string' && value.length > 0));
    assertOriginalGif(contract.gif, contract.hash, `${contract.name}GIF`);
  }
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

test('验证器拒绝非法器械方案和非精确equipment并集', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  const cases = [
    { mutate: item => { item.equipment = ['稳固座椅']; }, path: '.equipment' },
    { mutate: item => { item.equipment = ['stable_chair', 'stable_chair']; }, path: '.equipment' },
    { mutate: item => { item.equipmentOptions = [[]]; }, path: '.equipmentOptions[0]' },
    { mutate: item => { item.equipmentOptions = [['unknown_machine']]; }, path: '.equipmentOptions[0]' },
    { mutate: item => { item.equipmentOptions = [['stable_chair', 'stable_chair']]; }, path: '.equipmentOptions[0]' },
    { mutate: item => { item.equipmentOptions = [['stable_chair'], ['stable_chair']]; }, path: '.equipmentOptions[1]' },
    { mutate: item => { item.equipmentOptions = [['stable_chair'], ['exercise_mat']]; }, path: '.equipment' }
  ];
  for (const { mutate, path } of cases) {
    const invalid = exerciseCatalog.map(exercise => ({
      ...exercise,
      equipment: [...exercise.equipment],
      equipmentOptions: exercise.equipmentOptions.map(option => [...option])
    }));
    mutate(invalid[0]);
    const errors = validateExerciseCatalog(invalid);
    assert.ok(errors.some(error => error.path.endsWith(path)), `未定位${path}: ${JSON.stringify(errors)}`);
  }
});

test('验证器覆盖全部dose键、范围与业务边界', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  const cases = [
    { mutate: dose => { dose.durationMin = [10, 5]; }, path: '.dose.durationMin' },
    { mutate: dose => { dose.holdSec = [Number.NaN, 20]; }, path: '.dose.holdSec' },
    { mutate: dose => { dose.unknownDose = [1, 2]; }, path: '.dose.unknownDose' },
    { mutate: dose => { dose.sets = [-1, 2]; }, path: '.dose.sets' },
    { mutate: dose => { dose.reps = [0, 2]; }, path: '.dose.reps' },
    { mutate: dose => { dose.restSec = [-1, 0]; }, path: '.dose.restSec' },
    { mutate: dose => { dose.durationMin = [0, 5]; }, path: '.dose.durationMin' },
    { mutate: dose => { dose.holdSec = [-1, 5]; }, path: '.dose.holdSec' },
    { mutate: dose => { dose.rpe = [5, 11]; }, path: '.dose.rpe' }
  ];
  for (const { mutate, path } of cases) {
    const invalid = exerciseCatalog.map(exercise => ({ ...exercise, dose: { ...exercise.dose } }));
    mutate(invalid[0].dose);
    const errors = validateExerciseCatalog(invalid);
    assert.ok(errors.some(error => error.path.endsWith(path)), `未定位${path}: ${JSON.stringify(errors)}`);
  }
});

test('动作目录、动作记录、嵌套数据和导出枚举均深度不可变', () => {
  const api = loadCatalogAndPlan();
  const { exerciseCatalog, getApprovedExercises } = api;
  const first = exerciseCatalog[0];
  for (const value of [exerciseCatalog, first, first.settings, first.equipment, first.equipmentOptions,
    first.equipmentOptions[0], first.dose, first.dose.sets, first.contraindications,
    first.regressionIds, first.progressionIds, first.cues, first.groups,
    api.EQUIPMENT_IDS, api.DOSE_KEYS, api.PATTERNS, api.SETTINGS, api.REVIEW_STATUSES]) {
    assert.equal(Object.isFrozen(value), true);
  }
  for (const mutate of [
    () => { first.reviewStatus = 'draft'; },
    () => { first.start = '被改写'; },
    () => { first.cues.setup = '被改写'; },
    () => { first.dose.sets[0] = 99; },
    () => { first.equipmentOptions.push(['wall']); },
    () => { exerciseCatalog.push(first); }
  ]) assert.throws(mutate, TypeError);
  assert.equal(first.reviewStatus, 'approved');
  assert.equal(first.cues.setup, first.start);
  assert.equal(first.dose.sets[0], 1);
  const approved = getApprovedExercises();
  assert.equal(Object.isFrozen(approved[0]), true);
  assert.strictEqual(approved[0], first);
});

test('验证器拒绝稀疏目录、重复场景和损坏的关系ID且不会抛异常', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  const sparseErrors = validateExerciseCatalog(new Array(1));
  assert.ok(sparseErrors.some(error => error.path === 'catalog[0]'));
  const cases = [
    { mutate: item => { item.settings = ['gym', 'gym']; }, path: '.settings' },
    { mutate: item => { item.regressionIds = ['ankle-circle', 'ankle-circle']; }, path: '.regressionIds' },
    { mutate: item => { item.progressionIds = [null]; }, path: '.progressionIds[0]' },
    { mutate: item => { item.regressionIds = [42]; }, path: '.regressionIds[0]' },
    { mutate: item => { item.progressionIds = new Array(1); }, path: '.progressionIds[0]' }
  ];
  for (const { mutate, path } of cases) {
    const invalid = exerciseCatalog.map(exercise => ({ ...exercise }));
    mutate(invalid[0]);
    let errors;
    assert.doesNotThrow(() => { errors = validateExerciseCatalog(invalid); });
    assert.ok(errors.some(error => error.path.endsWith(path)), `未定位${path}: ${JSON.stringify(errors)}`);
  }
});

test('验证器面对不可序列化的非法器械ID也只返回结构化错误', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  for (const invalidId of [1n, Symbol('bad')]) {
    const invalid = exerciseCatalog.map(exercise => ({ ...exercise }));
    invalid[0].equipment = [invalidId];
    invalid[0].equipmentOptions = [[invalidId]];
    let errors;
    assert.doesNotThrow(() => { errors = validateExerciseCatalog(invalid); });
    assert.ok(errors.some(error => error.path.endsWith('.equipmentOptions[0]')));
  }
});
