'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

const EXPECTED_NAMES = [
  '坐姿抬腿', '站姿脚踝绕环', '坐姿腿举', '坐姿腿弯举', '臀桥', '墙触髋铰链', '推胸机',
  '站姿弹力带推胸', '坐姿划船', '弹力带划船', '抗旋转推压', '史密斯椅子深蹲', '坐姿腿屈伸',
  '坐姿徒手伸膝', '扶椅提踵', '髋外展机', '墙壁俯卧撑', '死虫式', '仰卧脚跟滑动',
  '四点支撑单肢滑动', '椭圆机／交叉训练机', '坡度跑台慢走', '扶椅原地踏步', '大腿后侧拉伸', '小腿拉伸'
];
const EXPECTED_GIFS = [
  'assets/gifs/02_坐姿抬腿.gif', 'assets/gifs/03_脚踝绕环.gif', 'assets/gifs/04_坐姿腿举.gif',
  'assets/gifs/05_坐姿腿弯举.gif', 'assets/gifs/06_臀桥.gif', 'assets/gifs/20_墙触髋铰链.gif', 'assets/gifs/07_推胸机.gif',
  'assets/gifs/21_站姿弹力带推胸.gif', 'assets/gifs/08_坐姿划船.gif', 'assets/gifs/19_弹力带划船.gif',
  'assets/gifs/09_抗旋转推压.gif', 'assets/gifs/10_高位坐姿起立.gif', 'assets/gifs/11_坐姿腿屈伸.gif',
  'assets/gifs/22_坐姿徒手伸膝.gif', 'assets/gifs/23_扶椅提踵.gif', 'assets/gifs/12_髋外展机.gif', 'assets/gifs/13_墙壁俯卧撑.gif',
  'assets/gifs/14_死虫式.gif', 'assets/gifs/25_仰卧脚跟滑动.gif', 'assets/gifs/26_四点支撑单肢滑动.gif',
  'assets/gifs/15_椭圆机.gif', 'assets/gifs/16_平地慢走.gif', 'assets/gifs/24_扶椅原地踏步.gif',
  'assets/gifs/17_大腿后侧拉伸.gif', 'assets/gifs/18_小腿拉伸.gif'
];
const REQUIRED_FIELDS = [
  'id', 'name', 'pattern', 'settings', 'equipment', 'equipmentOptions', 'difficulty', 'dose', 'contraindications',
  'regressionIds', 'progressionIds', 'gif', 'reviewStatus', 'cues'
];
const EXPECTED_EQUIPMENT_IDS = [
  'stable_chair', 'stable_high_bench', 'smith_machine', 'exercise_mat', 'leg_press_machine', 'leg_curl_machine',
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
  assert.deepEqual(byId['high-seat-sit-to-stand'].equipmentOptions, [['smith_machine','stable_high_bench'], ['smith_machine','stable_chair']]);
  assert.deepEqual(byId['high-seat-sit-to-stand'].settings, ['gym']);
  for (const exercise of exerciseCatalog) {
    assert.deepEqual(exercise.equipment, [...new Set(exercise.equipmentOptions.flat())]);
  }
});

test('坡度跑台慢走与坐姿小腿拉伸锁定精确动作语义', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  const byId = Object.fromEntries(exerciseCatalog.map(exercise => [exercise.id, exercise]));
  const walk = byId['flat-walk'];
  const calf = byId['calf-stretch'];

  assert.deepEqual(walk.equipmentOptions, [['treadmill'], ['flat_walking_route']]);
  assert.equal(walk.cues.setup, '按动图使用跑步机低速慢走，坡度保持在能稳定说短句的轻度范围；没有跑步机时选择平整路线慢走。先站稳、系好鞋带，再逐步启动。');
  assert.equal(walk.cues.movement, '力量日前慢走8～10分钟热身；有氧阶段保持自然小步幅和低速，结束前逐步降速3～5分钟。全程只走路，不跑步。');
  assert.equal(walk.errors, '扶住扶手悬挂身体；跨大步；速度或坡度过高；突然下机；为了跟动图而超出自身稳定范围。');
  assert.match(walk.cues.pain, /坡度和速度都以稳定、无痛、能说短句为上限/);

  assert.deepEqual(calf.equipmentOptions, [['stable_chair']]);
  assert.equal(calf.cues.setup, '坐在稳固椅子前半部，躯干直立，一腿向前伸，脚跟着地，膝盖保持微屈或自然伸直；双手放在大腿或椅面，不拿毛巾、弹力带等拉力工具。');
  assert.equal(calf.cues.movement, '只靠踝关节主动发力，将脚尖缓慢向身体方向勾，至小腿后侧轻微牵拉；保持20秒后放松并换侧。不要用手或任何器械拉脚尖。');
  assert.equal(calf.errors, '用手、毛巾或弹力带拉脚尖；猛勾或弹震；膝盖锁死；身体后仰代偿；出现疼痛仍继续。');
  assert.match(calf.cues.pain, /不使用外力辅助/);
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
    { id: 'supported-calf-raise', regressionIds: [], progressionIds: [] },
    { id: 'hip-abduction-machine', regressionIds: [], progressionIds: [] },
    { id: 'wall-push-up', regressionIds: [], progressionIds: ['chest-press-machine'] },
    { id: 'dead-bug', regressionIds: ['heel-slide', 'bird-dog-regression'], progressionIds: [] },
    { id: 'heel-slide', regressionIds: [], progressionIds: ['dead-bug'] },
    { id: 'bird-dog-regression', regressionIds: [], progressionIds: ['dead-bug'] },
    { id: 'elliptical-trainer', regressionIds: ['flat-walk'], progressionIds: [] },
    { id: 'flat-walk', regressionIds: ['supported-standing-march'], progressionIds: [] },
    { id: 'supported-standing-march', regressionIds: [], progressionIds: ['flat-walk'] },
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
    'dead-bug':['floor'],
    'heel-slide':['floor'],
    'bird-dog-regression':['floor']
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

test('受控变式指导仅存在于匹配动作，结构和值均为审核后的有限中文文案', () => {
  const { exerciseCatalog, validateExerciseCatalog } = loadCatalogAndPlan();
  const byId = Object.fromEntries(exerciseCatalog.map(item => [item.id, item]));
  assert.deepEqual(byId['high-seat-sit-to-stand'].variantGuidance, {
    high_seat:{
      label:'史密斯椅子深蹲变式',
      setup:'仅在健身房同时具备史密斯机和稳定座椅/高凳时使用；只用空杆或极轻负重。',
      range:'臀部轻触座椅后站起，膝部无痛且动作可控；不能稳定触椅、无史密斯机或站起失稳时停止。'
    }
  });
  assert.deepEqual(byId['wall-push-up'].variantGuidance, {
    close_wall:{
      label:'近墙小幅变式',
      setup:'双脚站得更靠近墙面，让身体倾斜角度更小；双手置于胸口至肩下高度。',
      range:'胸部只靠近墙到肩部无痛且身体仍成一直线的范围，再平稳推回。'
    }
  });
  assert.deepEqual(exerciseCatalog.filter(item=>Object.hasOwn(item,'variantGuidance')).map(item=>item.id),['high-seat-sit-to-stand','wall-push-up']);
  for(const id of ['high-seat-sit-to-stand','wall-push-up']){
    const guidance=byId[id].variantGuidance;
    assert.equal(Object.isFrozen(guidance),true);
    for(const entry of Object.values(guidance)){
      assert.equal(Object.isFrozen(entry),true);
      assert.deepEqual(Object.keys(entry),['label','setup','range']);
      assert.ok(Object.values(entry).every(value=>typeof value==='string'&&value.length>0));
    }
  }
  const invalidCases=[
    {targetId:'high-seat-sit-to-stand',mutate:item=>{item.variantGuidance={unknown_variant:{label:'未知',setup:'设置',range:'幅度'}}}},
    {targetId:'high-seat-sit-to-stand',mutate:item=>{item.variantGuidance={high_seat:{label:'',setup:'设置',range:'幅度'}}}},
    {targetId:'high-seat-sit-to-stand',mutate:item=>{item.variantGuidance={high_seat:{label:'标签',setup:'设置',range:'幅度',raw:'high_seat'}}}},
    {targetId:'high-seat-sit-to-stand',mutate:item=>{item.variantGuidance={high_seat:{label:'标签',setup:'设置'}}}},
    {targetId:'seated-leg-raise',mutate:item=>{item.variantGuidance={high_seat:{label:'标签',setup:'设置',range:'幅度'}}}}
  ];
  for(const [index,{targetId,mutate}] of invalidCases.entries()){
    const invalid=exerciseCatalog.map(item=>({...item}));
    const target=invalid.find(item=>item.id===targetId);assert.ok(target,`找不到测试动作 ${targetId}`);
    mutate(target);
    assert.ok(validateExerciseCatalog(invalid).some(error=>error.path.includes('variantGuidance')),`case ${index} 未拒绝`);
  }
});

test('受控变式指导校验对accessor、Proxy与危险键零getter执行并结构化失败',()=>{
  const {exerciseCatalog,validateExerciseCatalog}=loadCatalogAndPlan();
  const cases=[];let reads=0;
  cases.push(item=>Object.defineProperty(item,'variantGuidance',{enumerable:true,get(){reads+=1;throw new Error('SECRET_VARIANT_GETTER')}}));
  cases.push(item=>{const guidance={};Object.defineProperty(guidance,'high_seat',{enumerable:true,get(){reads+=1;throw new Error('SECRET_ENTRY_GETTER')}});item.variantGuidance=guidance});
  cases.push(item=>{const entry={setup:'设置',range:'幅度'};Object.defineProperty(entry,'label',{enumerable:true,get(){reads+=1;throw new Error('SECRET_LABEL_GETTER')}});item.variantGuidance={high_seat:entry}});
  cases.push(item=>{item.variantGuidance=new Proxy({high_seat:{label:'标签',setup:'设置',range:'幅度'}},{ownKeys(){throw new Error('SECRET_PROXY')}})});
  cases.push(item=>{item.variantGuidance={high_seat:new Proxy({label:'标签',setup:'设置',range:'幅度'},{getOwnPropertyDescriptor(){throw new Error('SECRET_PROXY')}})}});
  cases.push(item=>{const guidance={high_seat:{label:'标签',setup:'设置',range:'幅度'}};Object.defineProperty(guidance,'__proto__',{value:'pollution',enumerable:true});item.variantGuidance=guidance});
  for(const [index,mutate]of cases.entries()){
    const invalid=exerciseCatalog.map(item=>({...item})),target=invalid.find(item=>item.id==='high-seat-sit-to-stand');assert.ok(target);
    mutate(target);let errors;
    assert.doesNotThrow(()=>{errors=validateExerciseCatalog(invalid)},`case ${index} 异常逃逸`);
    assert.ok(errors.some(error=>error.path.includes('variantGuidance')),`case ${index} 未结构化拒绝`);
  }
  assert.equal(reads,0);
  const inherited=exerciseCatalog.map(item=>({...item}));inherited[0].id='constructor';
  assert.equal(validateExerciseCatalog(inherited).some(error=>error.path==='catalog[0].variantGuidance'&&error.message.includes('缺少')),false);
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

test('Task6第二组动作元数据、关系与原创媒体契约精确锁定', () => {
  const { exerciseCatalog } = loadCatalogAndPlan();
  const byId = Object.fromEntries(exerciseCatalog.map(item => [item.id, item]));
  const strengthDose = { sets:[2,3], reps:[8,12], rpe:[5,6], restSec:[60,90] };
  const expected = {
    'supported-calf-raise': { name:'扶椅提踵', pattern:'mobility', equipment:'stable_chair', dose:strengthDose, contraindications:[], progressionIds:[], gif:'23_扶椅提踵.gif', hash:'c37dc201599f59f37f47fd09100e562251500aed349ca08df7489e0e7d449872' },
    'supported-standing-march': { name:'扶椅原地踏步', pattern:'locomotion', equipment:'stable_chair', dose:{sets:[1,1],reps:[1,1],rpe:[2,4],restSec:[0,60],durationMin:[2,10]}, contraindications:[], progressionIds:['flat-walk'], gif:'24_扶椅原地踏步.gif', hash:'4a3af28d4fbf1af4ea09ffb6115e072603417e5ccb84f3b7da799b5cddfff1ed' },
    'heel-slide': { name:'仰卧脚跟滑动', pattern:'anti_extension', equipment:'exercise_mat', dose:strengthDose, contraindications:['floor'], progressionIds:['dead-bug'], gif:'25_仰卧脚跟滑动.gif', hash:'91ce2e1c8574a80deae6f62dcff7562a8bc1940e2846e2047f3533f57544ef93' },
    'bird-dog-regression': { name:'四点支撑单肢滑动', pattern:'anti_extension', equipment:'exercise_mat', dose:strengthDose, contraindications:['floor'], progressionIds:['dead-bug'], gif:'26_四点支撑单肢滑动.gif', hash:'496256aeafebeb85251491078dc21db17fe3a1b9c79e5573693a309fca9fec49' }
  };
  for (const [id, contract] of Object.entries(expected)) {
    const item = byId[id];
    assert.ok(item, `${id}不存在`);
    assert.equal(item.name, contract.name);
    assert.equal(item.pattern, contract.pattern);
    assert.deepEqual(item.settings, ['home','gym']);
    assert.deepEqual(item.equipmentOptions, [[contract.equipment]]);
    assert.equal(item.difficulty, 1);
    assert.deepEqual(item.dose, contract.dose);
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

test('媒体可选性合同覆盖25项本地动图库上架边界', () => {
  const api = loadCatalogAndPlan();
  const { exerciseCatalog, validateExerciseCatalog, mediaEligibilityForExercise, isMediaSelectable } = api;
  assert.deepEqual(validateExerciseCatalog(exerciseCatalog), []);
  const counts = exerciseCatalog.reduce((acc, item) => {
    acc[item.mediaMatchVerdict] = (acc[item.mediaMatchVerdict] || 0) + 1;
    return acc;
  }, {});
  assert.equal(counts.exact + counts.approved_near, 25);
  assert.equal(counts.gap || 0, 0);
  assert.equal(counts.near || 0, 0);
  const byId = Object.fromEntries(exerciseCatalog.map(item => [item.id, item]));
  for (const item of exerciseCatalog) {
    assert.equal(isMediaSelectable(item, { allowReferenceMediaForLocalPrototype: false }), true, item.id);
    assert.deepEqual(mediaEligibilityForExercise(item, { allowReferenceMediaForLocalPrototype: false }), {
      selectable: true,
      mode: 'public_release'
    });
  }
  assert.equal(byId['seated-leg-press'].mediaMatchVerdict, 'exact');
  assert.equal(byId['seated-leg-raise'].mediaMatchVerdict, 'approved_near');
  assert.equal(byId['wall-hip-hinge'].mediaMatchVerdict, 'exact');
  assert.ok(Object.isFrozen(api.MEDIA_LAUNCH_STATUSES));
  assert.ok(Object.isFrozen(api.MEDIA_MATCH_VERDICTS));
  assert.ok(Object.isFrozen(api.MEDIA_RIGHTS_STATUSES));
});
