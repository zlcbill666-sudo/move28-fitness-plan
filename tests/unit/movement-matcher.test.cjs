'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

function loadMatcher() {
  clearMove28ModuleCache();
  const matcherPath = path.join(projectRoot, 'src', 'domain', 'movement-matcher.js');
  delete require.cache[matcherPath];
  return { ...require(matcherPath), ...loadScript('exerciseCatalog') };
}

const equipment = Object.freeze({
  gym: ['stable_chair','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','cable_machine','elliptical_trainer','treadmill'],
  home: ['stable_chair','exercise_mat','resistance_band','wall','flat_walking_route']
});

function match(api, pattern, setting, available = equipment[setting], extra = {}) {
  return api.matchExercise({ pattern, setting, equipment:available, exclusions:[], difficulty:3, ...extra });
}

test('六类动作意图按场景和器械确定性匹配审核动作', () => {
  const api = loadMatcher();
  const cases = [
    ['knee_dominant','gym',equipment.gym,'seated-leg-press'],
    ['knee_dominant','home',equipment.home,'high-seat-sit-to-stand'],
    ['posterior_chain','gym',equipment.gym,'seated-leg-curl'],
    ['posterior_chain','home',equipment.home,'glute-bridge'],
    ['horizontal_push','gym',equipment.gym,'chest-press-machine'],
    ['horizontal_push','home',equipment.home,'wall-push-up'],
    ['horizontal_pull','gym',equipment.gym,'seated-row'],
    ['horizontal_pull','home',equipment.home,'band-row'],
    ['core_stability','gym',equipment.gym,'pallof-press'],
    ['core_stability','home',equipment.home,'dead-bug'],
    ['low_impact_cardio','gym',equipment.gym,'elliptical-trainer'],
    ['low_impact_cardio','home',equipment.home,'flat-walk']
  ];
  for (const [pattern,setting,available,id] of cases) {
    const result = match(api, pattern, setting, available);
    assert.equal(result.ok, true, `${pattern}/${setting}: ${JSON.stringify(result)}`);
    assert.equal(result.exercise.id, id);
    assert.equal(result.pattern, pattern);
    assert.equal(result.setting, setting);
    assert.equal(result.exercise.reviewStatus, 'approved');
    assert.ok(result.matchedEquipment.every(item => available.includes(item)));
  }
});

test('难度上限只允许同级或更简单动作，并兼容旧difficulty请求', () => {
  const api = loadMatcher();
  const request={pattern:'knee_dominant',setting:'gym',equipment:['stable_chair','leg_press_machine'],exclusions:[]};
  const result = api.matchExercise({...request,difficultyCap:1});
  assert.equal(result.ok, true);
  assert.equal(result.exercise.id, 'high-seat-sit-to-stand');
  assert.equal(result.exercise.difficulty, 1);
  assert.equal(api.matchExercise({...request,difficulty:1}).exercise.id,'high-seat-sit-to-stand');
  assert.equal(api.matchExercise({...request,difficulty:1,difficultyCap:1}).error.code,'INVALID_REQUEST');
});

test('能力排除可在臀桥与墙触髋铰链之间安全回退', () => {
  const api = loadMatcher();
  const noFloor = match(api, 'posterior_chain', 'home', ['exercise_mat','wall'], { exclusions:['floor'] });
  assert.equal(noFloor.ok, true);
  assert.equal(noFloor.exerciseId, 'wall-hip-hinge');
  const noHinge = match(api, 'posterior_chain', 'home', ['exercise_mat','wall'], { exclusions:['hinge'] });
  assert.equal(noHinge.ok, true);
  assert.equal(noHinge.exerciseId, 'glute-bridge');
  const neither = match(api, 'posterior_chain', 'home', ['stable_chair'], { exclusions:[] });
  assert.equal(neither.ok, false);
  assert.equal(neither.error.code, 'INSUFFICIENT_EQUIPMENT');
  assert.deepEqual(neither.error.requiredOptions, [['exercise_mat'],['wall']]);
});

test('禁忌标签、动作ID和动作模式均能排除候选', () => {
  const api = loadMatcher();
  const floor = match(api, 'posterior_chain', 'home', ['exercise_mat','wall'], { exclusions:['floor','hinge'] });
  assert.equal(floor.ok, false);
  assert.equal(floor.error.code, 'ALL_MATCHES_EXCLUDED');
  const byId = match(api, 'horizontal_push', 'home', ['wall'], { exclusions:['wall-push-up'] });
  assert.equal(byId.ok, false);
  assert.equal(byId.error.code, 'ALL_MATCHES_EXCLUDED');
  const byPattern = match(api, 'horizontal_push', 'home', ['wall'], { exclusions:['horizontal_push'] });
  assert.equal(byPattern.ok, false);
  assert.equal(byPattern.error.code, 'ALL_MATCHES_EXCLUDED');
});

test('器械不足返回结构化错误和可满足的器械方案', () => {
  const api = loadMatcher();
  const result = match(api, 'horizontal_push', 'gym', ['stable_chair']);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INSUFFICIENT_EQUIPMENT');
  assert.equal(result.error.pattern, 'horizontal_push');
  assert.equal(result.error.setting, 'gym');
  assert.deepEqual(result.error.requiredOptions, [['chest_press_machine'], ['wall']]);
});

test('有弹力带的居家水平拉匹配approved band-row，无弹力带返回器械不足', () => {
  const api = loadMatcher();
  const bandRow = api.exerciseCatalog.find(item => item.id === 'band-row');
  assert.ok(bandRow);
  assert.equal(bandRow.reviewStatus, 'approved');
  const defaultResult = match(api, 'horizontal_pull', 'home');
  assert.equal(defaultResult.ok, true);
  assert.equal(defaultResult.exerciseId, 'band-row');
  assert.deepEqual(defaultResult.matchedEquipment, ['resistance_band']);

  const noBand = match(api, 'horizontal_pull', 'home', ['stable_chair','wall']);
  assert.equal(noBand.ok, false);
  assert.equal(noBand.error.code, 'INSUFFICIENT_EQUIPMENT');
  assert.equal(noBand.error.pattern, 'horizontal_pull');
  assert.equal(noBand.error.setting, 'home');
  assert.deepEqual(noBand.error.requiredOptions, [['resistance_band']]);
  const gymLowDifficulty=api.matchExercise({pattern:'horizontal_pull',setting:'gym',equipment:['seated_row_machine','resistance_band'],exclusions:[],difficultyCap:1});
  assert.equal(gymLowDifficulty.ok,true);
  assert.equal(gymLowDifficulty.exerciseId,'band-row');
});

test('居家低冲击有氧优先平地慢走，缺少路线时回退扶椅原地踏步', () => {
  const api = loadMatcher();
  const route = match(api, 'low_impact_cardio', 'home', ['stable_chair','flat_walking_route']);
  assert.equal(route.ok, true);
  assert.equal(route.exerciseId, 'flat-walk');
  const supported = match(api, 'low_impact_cardio', 'home', ['stable_chair']);
  assert.equal(supported.ok, true);
  assert.equal(supported.exerciseId, 'supported-standing-march');
  assert.deepEqual(supported.matchedEquipment, ['stable_chair']);
  const unavailable = match(api, 'low_impact_cardio', 'home', []);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.error.code, 'INSUFFICIENT_EQUIPMENT');
  assert.deepEqual(unavailable.error.requiredOptions, [['treadmill'],['flat_walking_route'],['stable_chair']]);
});

test('匹配结果不会冻结或改写调用方提供的自定义目录', () => {
  const api = loadMatcher();
  const customExercise = {...api.exerciseCatalog.find(item => item.id === 'wall-push-up')};
  const catalog = api.exerciseCatalog.map(item => item.id === customExercise.id ? customExercise : item);
  const result = api.matchExercise({pattern:'horizontal_push',setting:'home',equipment:['wall'],exclusions:[],difficulty:1,catalog});
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(customExercise), false);
  assert.strictEqual(result.exercise, customExercise);
});

test('数组元素accessor不会被执行，输入会fail closed', () => {
  const api = loadMatcher();
  let reads = 0;
  const equipment = [];
  Object.defineProperty(equipment, 0, {enumerable:true, configurable:true, get(){reads += 1; return 'wall'}});
  equipment.length = 1;
  const result = api.matchExercise({pattern:'horizontal_push',setting:'home',equipment,exclusions:[],difficulty:1});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_REQUEST');
  assert.equal(reads, 0);
});

test('actions索引accessor零执行且session切换fail closed', () => {
  const api = loadMatcher();
  let reads = 0;
  const actions = [];
  Object.defineProperty(actions, 0, {enumerable:true, configurable:true,get(){reads += 1; return {pattern:'horizontal_push',exerciseId:'wall-push-up'}}});
  actions.length = 1;
  const result = api.swapSessionSetting({intent:'strength',setting:'gym',equipmentBySetting:{home:['wall']},actions}, 'home', api.exerciseCatalog);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_SESSION');
  assert.equal(reads, 0);
});

test('revoked Proxy输入和actions不抛异常并fail closed', () => {
  const api = loadMatcher();
  const revokedInput = Proxy.revocable({}, {}); revokedInput.revoke();
  assert.doesNotThrow(() => api.matchExercise(revokedInput.proxy));
  assert.equal(api.matchExercise(revokedInput.proxy).error.code, 'INVALID_REQUEST');
  const revokedActions = Proxy.revocable([], {}); revokedActions.revoke();
  const session = {intent:'strength',setting:'gym',equipmentBySetting:{home:['wall']},actions:revokedActions.proxy};
  assert.doesNotThrow(() => api.swapSessionSetting(session,'home',api.exerciseCatalog));
  assert.equal(api.swapSessionSetting(session,'home',api.exerciseCatalog).error.code, 'INVALID_SESSION');
});

test('自定义catalog字段accessor零执行且异常不外泄', () => {
  const api = loadMatcher();
  let reads = 0;
  const hostile = {...api.exerciseCatalog.find(item => item.id === 'wall-push-up')};
  Object.defineProperty(hostile,'settings',{enumerable:true,configurable:true,get(){reads += 1; throw new Error('settings getter ran')}});
  const catalog = [hostile];
  assert.doesNotThrow(() => api.matchExercise({pattern:'horizontal_push',setting:'home',equipment:['wall'],exclusions:[],difficulty:1,catalog}));
  const result = api.matchExercise({pattern:'horizontal_push',setting:'home',equipment:['wall'],exclusions:[],difficulty:1,catalog});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_REQUEST');
  assert.equal(reads, 0);
});

test('session与action危险键不能改变返回对象原型', () => {
  const api = loadMatcher();
  const base = {
    intent:'strength', setting:'gym', equipmentBySetting:{home:['wall']},
    actions:[{pattern:'horizontal_push',exerciseId:'chest-press-machine',sets:2,reps:8}]
  };
  for (const target of [base, base.actions[0]]) {
    const session = {...base,actions:base.actions.map(action=>({...action}))};
    const actualTarget = target === base ? session : session.actions[0];
    Object.defineProperty(actualTarget,'__proto__',{enumerable:true,configurable:true,value:{injected:'yes'}});
    const result = api.swapSessionSetting(session,'home',api.exerciseCatalog);
    assert.equal(result.ok,false);
    assert.equal(result.error.code,'INVALID_SESSION');
    assert.equal({}.injected,undefined);
  }
});

test('action仅接受有限纯数据标量，函数与异常数值全部fail closed', () => {
  const api = loadMatcher();
  const invalidValues = [()=>{},Symbol('x'),1n,undefined,Number.NaN,Infinity,-Infinity,1];
  for (const value of invalidValues) {
    const session = {
      intent:'strength',setting:'gym',equipmentBySetting:{home:['wall']},
      actions:[{pattern:'horizontal_push',exerciseId:'chest-press-machine',sets:2,reps:8,hostile:value}]
    };
    assert.doesNotThrow(()=>api.swapSessionSetting(session,'home',api.exerciseCatalog));
    const result=api.swapSessionSetting(session,'home',api.exerciseCatalog);
    assert.equal(result.ok,false,`未拒绝 ${String(value)}`);
    assert.equal(result.error.code,'INVALID_SESSION');
  }
});

test('非法输入和未知排除项fail closed且不抛异常', () => {
  const api = loadMatcher();
  for (const input of [null, {}, {pattern:'anything',setting:'gym',equipment:[],exclusions:[],difficulty:1}, {pattern:'knee_dominant',setting:'gym',equipment:'machine',exclusions:[],difficulty:1}, {pattern:'knee_dominant',setting:'gym',equipment:[],exclusions:['unknown-secret'],difficulty:1}]) {
    assert.doesNotThrow(() => api.matchExercise(input));
    const result = api.matchExercise(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_REQUEST');
  }
});

test('场景切换保持session intent、动作意图和剂量，只替换动作实现', () => {
  const api = loadMatcher();
  const session = {
    id:'session-a', intent:'full_body_strength', setting:'gym',
    equipmentBySetting:{ gym:equipment.gym, home:equipment.home },
    actions:[
      {pattern:'knee_dominant',exerciseId:'seated-leg-press',sets:2,reps:10,rpe:5,restSec:60},
      {pattern:'posterior_chain',exerciseId:'seated-leg-curl',sets:2,reps:10,rpe:5,restSec:60},
      {pattern:'horizontal_push',exerciseId:'chest-press-machine',sets:2,reps:10,rpe:5,restSec:60},
      {pattern:'core_stability',exerciseId:'pallof-press',sets:2,reps:10,rpe:5,restSec:60},
      {pattern:'low_impact_cardio',exerciseId:'elliptical-trainer',durationMin:10,rpe:4}
    ]
  };
  const before = JSON.parse(JSON.stringify(session));
  const result = api.swapSessionSetting(session, 'home', api.exerciseCatalog);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.session.intent, session.intent);
  assert.equal(result.session.setting, 'home');
  assert.deepEqual(result.session.actions.map(action => action.pattern), session.actions.map(action => action.pattern));
  assert.deepEqual(result.session.actions.map(action => action.exerciseId), ['high-seat-sit-to-stand','glute-bridge','wall-push-up','dead-bug','flat-walk']);
  result.session.actions.forEach((action,index) => {
    const { exerciseId:_old, ...oldDose } = session.actions[index];
    const { exerciseId:_new, ...newDose } = action;
    assert.deepEqual(newDose, oldDose);
  });
  assert.deepEqual(session, before);
  assert.equal(Object.isFrozen(session), false);
  assert.equal(Object.isFrozen(session.equipmentBySetting), false);
  assert.equal(Object.isFrozen(session.actions), false);
  assert.equal(result.replacements.length, session.actions.length);
});

test('有弹力带时包含水平拉的session可完整切换到home', () => {
  const api = loadMatcher();
  const session = {
    intent:'full_body_strength', setting:'gym', equipmentBySetting:{home:equipment.home},
    actions:[
      {pattern:'horizontal_push',exerciseId:'chest-press-machine',sets:2,reps:10},
      {pattern:'horizontal_pull',exerciseId:'seated-row',sets:2,reps:10}
    ]
  };
  const result = api.swapSessionSetting(session, 'home', api.exerciseCatalog);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.session.setting, 'home');
  assert.deepEqual(result.session.actions.map(action => action.exerciseId), ['wall-push-up','band-row']);
  assert.deepEqual(result.session.actions.map(action => action.pattern), ['horizontal_push','horizontal_pull']);
});

test('经典浏览器脚本按目录后匹配器顺序加载且不依赖DOM或storage', () => {
  const context = {};
  vm.createContext(context);
  for (const relativePath of ['src/data/exercise-catalog.js','src/domain/movement-matcher.js']) {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, ...relativePath.split('/')), 'utf8'), context);
  }
  assert.equal(typeof context.Move28.domain.matchExercise, 'function');
  const result = vm.runInContext("Move28.domain.matchExercise({pattern:'horizontal_push',setting:'home',equipment:['wall'],exclusions:[],difficulty:1})", context);
  assert.equal(result.ok, true);
  assert.equal(result.exercise.id, 'wall-push-up');
});

test('媒体硬门在公开发布模式允许Exact10并阻断NEAR/GAP候选', () => {
  const api = loadMatcher();
  const publicPush = api.matchExercise({
    pattern: 'horizontal_push', setting: 'home', equipment: ['wall'], exclusions: [], difficulty: 1, mediaRequirement: 'public_release'
  });
  assert.equal(publicPush.ok, true);
  assert.equal(publicPush.exercise.id, 'wall-push-up');

  const standingMarch = api.exerciseCatalog.find(item => item.id === 'supported-standing-march');
  const nearOnly = api.matchExercise({
    pattern: 'low_impact_cardio', setting: 'home', equipment: ['stable_chair'], exclusions: [], difficulty: 1,
    catalog: [standingMarch], mediaRequirement: 'public_release'
  });
  assert.equal(nearOnly.ok, false);
  assert.equal(nearOnly.error.code, 'MEDIA_MATCH_NOT_APPROVED');
  assert.deepEqual(nearOnly.error.blockedActionIds, ['supported-standing-march']);

  const wallHinge = api.exerciseCatalog.find(item => item.id === 'wall-hip-hinge');
  const gapOnly = api.matchExercise({
    pattern: 'posterior_chain', setting: 'home', equipment: ['wall'], exclusions: [], difficulty: 1,
    catalog: [wallHinge], mediaRequirement: 'public_release'
  });
  assert.equal(gapOnly.ok, false);
  assert.equal(gapOnly.error.code, 'MEDIA_MATCH_NOT_APPROVED');
  assert.deepEqual(gapOnly.error.blockedActionIds, ['wall-hip-hinge']);
});
