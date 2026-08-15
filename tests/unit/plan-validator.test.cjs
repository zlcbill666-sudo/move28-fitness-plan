'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const {projectRoot,clearMove28ModuleCache}=require('../helpers/load-script.cjs');
const {capabilityInput}=require('../helpers/capability-fixture.cjs');

const fixtures=JSON.parse(fs.readFileSync(path.join(projectRoot,'tests','fixtures','invalid-plans.json'),'utf8'));
const gymEquipment=['stable_chair','exercise_mat','smith_machine','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const baseIntake={age:30,finalConfirmed:true,daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],setting:'gym',equipment:gymEquipment,avoidMovements:[],avoidEquipment:[],cardioPreference:'none',cardioAvoid:'none',strengthExperience:'some',trainingBreak:'no'};
function risk(level='normal'){return {level,ruleVersion:'pilot-v2',reasons:[]}}
function loadApis(){
  clearMove28ModuleCache();
  for(const file of ['plan-validator.js','plan-generator.js'])delete require.cache[path.join(projectRoot,'src','domain',file)];
  return {
    validator:require(path.join(projectRoot,'src','domain','plan-validator.js')),
    generator:require(path.join(projectRoot,'src','domain','plan-generator.js')),
    catalog:require(path.join(projectRoot,'src','data','exercise-catalog.js')).exerciseCatalog
  };
}
function generated(generator,level='normal',withCardio=false){
  const intake={...baseIntake,trainingBreak:level==='conservative'?'yes':'no',...(withCardio?{daysPerWeek:'3',weekdays:['mon','wed','fri']}:{})};
  const plan=generator.generatePlan({intake,risk:risk(level),intakeRevision:1,...capabilityInput()});
  assert.equal(plan.status,'generated',JSON.stringify(plan));
  return {plan,intake,risk:risk(level),...capabilityInput()};
}
function catalogIndex(catalog,id){return catalog.findIndex(item=>item.id===id)}
function mutateCase(item,apis){
  const baseline=generated(apis.generator,item.mutation==='conservative-rpe'?'conservative':'normal',item.mutation==='capability-cardio');
  const plan=structuredClone(baseline.plan);
  const intake=structuredClone(baseline.intake);
  const riskInput=structuredClone(baseline.risk);
  const catalog=structuredClone(apis.catalog);
  const first=plan.weeks[0].sessions[0].actions[0];
  const catalogItem=catalog[catalogIndex(catalog,first.exerciseId)];
  if(item.mutation==='duration')plan.weeks[0].sessions[0].estimatedMinutes=31;
  if(item.mutation==='review-status')catalogItem.reviewStatus='draft';
  if(item.mutation==='dose')first.reps=99;
  if(item.mutation==='contraindication')intake.avoidMovements=['deep_knee_bend'];
  if(item.mutation==='recovery')plan.weeks[0].sessions[1].weekday='tue';
  if(item.mutation==='pattern')first.pattern='horizontal_push';
  if(item.mutation==='conservative-rpe')first.rpe=6;
  if(item.mutation==='multi-progression')plan.weeks[1].sessions[0].actions[0].rpe=6;
  if(item.mutation==='empty-actions')plan.weeks[0].sessions[0].actions=[];
  let capability=capabilityInput();
  if(item.mutation==='capability-revision')capability={...capability,capabilityRevision:2};
  if(item.mutation==='capability-exclusion'){
    capability={capabilityRevision:1,capabilityResult:{status:'conservative',difficultyCap:1,exclusions:['floor'],variants:{knee_dominant:'high_seat',horizontal_push:'close_wall'},cardioStartMinutes:15,reasonCodes:['FLOOR_ACCESS_AVOID_FLOOR']}};
    plan.weeks[0].sessions[0].actions.find(action=>action.pattern==='core_stability').exerciseId='dead-bug';
  }
  if(item.mutation==='capability-difficulty')capability={capabilityRevision:1,capabilityResult:{status:'conservative',difficultyCap:1,exclusions:[],variants:{knee_dominant:'high_seat',horizontal_push:'close_wall'},cardioStartMinutes:15,reasonCodes:['CHAIR_RISE_HANDS_SUPPORTED']}};
  if(item.mutation==='capability-variant')plan.weeks[0].sessions[0].actions[0].variant='high_seat';
  if(item.mutation==='capability-cardio')plan.weeks[0].sessions.find(session=>session.intent==='low_impact_cardio').actions[0].durationMin=20;
  return {plan,intake,risk:riskInput,catalog,...capability};
}

test('有效生成计划通过硬门槛且结果确定、深冻结、不修改输入',()=>{
  const apis=loadApis();
  const input={...generated(apis.generator),catalog:apis.catalog};
  const before=structuredClone(input);
  const first=apis.validator.validatePlan(input);
  const second=apis.validator.validatePlan(input);
  assert.deepEqual(first,{ok:true,errors:[]});
  assert.deepEqual(first,second);
  assert.deepEqual(input,before);
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.errors));
});

test('媒体路径不再是文字训练计划有效性的硬门',()=>{
  const apis=loadApis(),baseline=generated(apis.generator),catalog=structuredClone(apis.catalog);
  for(const exercise of catalog)exercise.gif='assets/gifs/release-blocked.gif';
  assert.deepEqual(apis.validator.validatePlan({...baseline,catalog}),{ok:true,errors:[]});
});

test('训练日必须属于用户明确选择的可用星期',()=>{
  const apis=loadApis(),baseline=generated(apis.generator),plan=structuredClone(baseline.plan);
  plan.weeks[0].sessions[0].weekday='tue';
  const result=apis.validator.validatePlan({...baseline,plan,catalog:apis.catalog});
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='SESSION_WEEKDAY_UNAVAILABLE'&&error.path==='weeks[0].sessions[0].weekday'));
});

test('invalid-plans fixtures逐类返回稳定错误码和路径',()=>{
  const apis=loadApis();
  for(const item of fixtures){
    const result=apis.validator.validatePlan(mutateCase(item,apis));
    assert.equal(result.ok,false,item.name);
    const error=result.errors.find(entry=>entry.code===item.expectedCode);
    assert.ok(error,`${item.name}: ${JSON.stringify(result.errors)}`);
    assert.equal(typeof error.path,'string');
    assert.ok(error.path.length>0);
    assert.equal(typeof error.message,'string');
    assert.ok(error.message.length>0);
    if(item.expectedPath)assert.equal(error.path,item.expectedPath,item.name);
    if(item.expectedMessage)assert.equal(error.message,item.expectedMessage,item.name);
  }
});

test('能力上下文与计划能力revision缺失或为0时统一fail closed',()=>{
  const apis=loadApis(),baseline={...generated(apis.generator),catalog:apis.catalog};
  for(const mutate of [
    input=>{delete input.capabilityResult},input=>{delete input.capabilityRevision},input=>{input.capabilityRevision=0},
    input=>{delete input.plan.capabilityRevision},input=>{input.plan.capabilityRevision=0}
  ]){
    const input=structuredClone(baseline);mutate(input);
    const result=apis.validator.validatePlan(input);
    assert.equal(result.ok,false);assert.ok(result.errors.some(error=>error.code==='INVALID_PLAN_SCHEMA'));
  }
});

test('动作身份与受控variant双向一致，不能把高位或近墙动作伪装为standard',()=>{
  const apis=loadApis();
  const intake={...baseIntake,trainingBreak:'yes',equipment:[...gymEquipment,'wall']};
  const capability={capabilityRevision:1,capabilityResult:{status:'conservative',difficultyCap:1,exclusions:[],variants:{knee_dominant:'high_seat',horizontal_push:'close_wall'},cardioStartMinutes:15,reasonCodes:['CHAIR_RISE_HANDS_SUPPORTED','WALL_PUSHUP_LIMITED_RANGE']}};
  const plan=apis.generator.generatePlan({intake,risk:risk('conservative'),intakeRevision:1,...capability});
  assert.equal(plan.status,'generated',JSON.stringify(plan));
  for(const [pattern,expectedVariant] of [['knee_dominant','high_seat'],['horizontal_push','close_wall']]){
    const action=plan.weeks[0].sessions[0].actions.find(item=>item.pattern===pattern);
    assert.equal(action.variant,expectedVariant);
    const changed=structuredClone(plan),changedAction=changed.weeks[0].sessions[0].actions.find(item=>item.pattern===pattern);
    changedAction.variant='standard';
    const result=apis.validator.validatePlan({plan:changed,intake,risk:risk('conservative'),catalog:apis.catalog,...capability});
    assert.ok(result.errors.some(error=>error.code==='CAPABILITY_VARIANT_MISMATCH'&&error.path.endsWith('.variant')));
  }
});

test('恢复校验跨周生效，conservative拒绝任何自动增加',()=>{
  const apis=loadApis();
  const normal=generated(apis.generator);
  const plan=structuredClone(normal.plan);
  plan.weeks[0].sessions[1].weekday='sun';
  plan.weeks[1].sessions[0].weekday='mon';
  let result=apis.validator.validatePlan({...normal,plan,catalog:apis.catalog});
  assert.ok(result.errors.some(error=>error.code==='STRENGTH_RECOVERY_CONFLICT'));
  const conservative=generated(apis.generator,'conservative');
  const changed=structuredClone(conservative.plan);
  changed.weeks[1].sessions[0].actions[0].reps+=1;
  result=apis.validator.validatePlan({...conservative,plan:changed,catalog:apis.catalog});
  assert.ok(result.errors.some(error=>error.code==='CONSERVATIVE_INTENSITY_EXCEEDED'));
});

test('approved动作必须满足场景、完整器械方案、剂量和提示媒体',()=>{
  const apis=loadApis();
  const baseline=generated(apis.generator);
  const plan=structuredClone(baseline.plan);
  plan.weeks[0].sessions[0].equipmentBySetting.gym=['stable_chair'];
  const result=apis.validator.validatePlan({...baseline,plan,catalog:apis.catalog});
  assert.ok(result.errors.some(error=>error.code==='EQUIPMENT_UNAVAILABLE'));
});

test('动作队列拒绝运行时选择清单，纯数据结构损坏也只返回错误',()=>{
  const apis=loadApis();
  const baseline=generated(apis.generator);
  const choices=structuredClone(baseline.plan);
  choices.weeks[0].sessions[0].actions[0].choices=[];
  let result=apis.validator.validatePlan({...baseline,plan:choices,catalog:apis.catalog});
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='INVALID_PLAN_SCHEMA'));
  const malformed=structuredClone(baseline.plan);
  malformed.weeks[2].sessions[0]=null;
  assert.doesNotThrow(()=>apis.validator.validatePlan({...baseline,plan:malformed,catalog:apis.catalog}));
  result=apis.validator.validatePlan({...baseline,plan:malformed,catalog:apis.catalog});
  assert.equal(result.ok,false);
});

test('调用方目录不能自证approved、错配媒体或扩大剂量边界',()=>{
  const apis=loadApis();
  const baseline=generated(apis.generator);
  const forgedPlan=structuredClone(baseline.plan);
  const forgedCatalog=structuredClone(apis.catalog);
  const source=forgedCatalog.find(item=>item.id==='seated-row');
  const forged={...source,id:'unreviewed-row',name:'未审核划船',regressionIds:[],progressionIds:[],reviewStatus:'approved',gif:'assets/gifs/07_推胸机.gif'};
  forgedCatalog.push(forged);
  for(const week of forgedPlan.weeks)for(const session of week.sessions)for(const action of session.actions)if(action.exerciseId==='seated-row')action.exerciseId=forged.id;
  let result=apis.validator.validatePlan({...baseline,plan:forgedPlan,catalog:forgedCatalog});
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='EXERCISE_NOT_APPROVED'));
  const dosePlan=structuredClone(baseline.plan),doseCatalog=structuredClone(apis.catalog);
  const first=dosePlan.weeks[0].sessions[0].actions[0];
  doseCatalog[catalogIndex(doseCatalog,first.exerciseId)].dose.reps=[1,100];
  first.reps=99;
  result=apis.validator.validatePlan({...baseline,plan:dosePlan,catalog:doseCatalog});
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='DOSE_OUT_OF_RANGE'));
  const reordered=structuredClone(apis.catalog),row=reordered.find(item=>item.id==='seated-row');
  row.dose={restSec:row.dose.restSec,rpe:row.dose.rpe,reps:row.dose.reps,sets:row.dose.sets};
  row.cues={pain:row.cues.pain,breathing:row.cues.breathing,movement:row.cues.movement,setup:row.cues.setup};
  result=apis.validator.validatePlan({...baseline,catalog:reordered});
  assert.deepEqual(result,{ok:true,errors:[]});
  const regenerated=apis.generator.generatePlan({intake:baseline.intake,risk:baseline.risk,intakeRevision:1,catalog:reordered,...capabilityInput()});
  assert.equal(regenerated.status,'generated');
});

test('conservative将休息时间缩短同样属于禁止的自动进阶',()=>{
  const apis=loadApis(),baseline=generated(apis.generator,'conservative');
  const plan=structuredClone(baseline.plan);
  for(let weekIndex=1;weekIndex<plan.weeks.length;weekIndex+=1)for(const session of plan.weeks[weekIndex].sessions)for(const action of session.actions)if(action.phase==='main')action.restSec=60;
  const result=apis.validator.validatePlan({...baseline,plan,catalog:apis.catalog});
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>error.code==='CONSERVATIVE_INTENSITY_EXCEEDED'&&error.path.endsWith('.restSec')));
});

test('生成器隔离validator异常且不泄漏异常文本',()=>{
  const context={structuredClone};vm.createContext(context);
  for(const relative of ['src/data/exercise-catalog.js','src/domain/movement-matcher.js','src/domain/plan-validator.js'])vm.runInContext(fs.readFileSync(path.join(projectRoot,...relative.split('/')),'utf8'),context);
  context.Move28.domain.validatePlan=()=>{throw new Error('SECRET_VALIDATOR_TEXT')};
  vm.runInContext(fs.readFileSync(path.join(projectRoot,'src','domain','plan-generator.js'),'utf8'),context);
  let result;
  assert.doesNotThrow(()=>{result=context.Move28.domain.generatePlan({intake:baseIntake,risk:risk(),intakeRevision:1,...capabilityInput()})});
  assert.equal(result.status,'manual_review');
  assert.equal(result.plan,null);
  assert.equal(result.errors[0].code,'VALIDATOR_UNAVAILABLE');
  assert.equal(JSON.stringify(result).includes('SECRET_VALIDATOR_TEXT'),false);
});

test('生成器强制调用validator，校验失败只返回manual_review且无部分计划',()=>{
  const apis=loadApis();
  const catalog=structuredClone(apis.catalog);
  for(const exercise of catalog)exercise.cues.setup='FORGED_UNTRUSTED_CUE';
  const result=apis.generator.generatePlan({intake:baseIntake,risk:risk(),intakeRevision:1,catalog,...capabilityInput()});
  assert.equal(result.status,'manual_review');
  assert.equal(result.plan,null);
  assert.ok(result.errors.some(error=>error.code==='INVALID_PLAN_SCHEMA'));
});

test('accessor、Proxy、稀疏数组、循环和危险值统一fail closed且不执行getter',()=>{
  const apis=loadApis();
  const baseline=generated(apis.generator);
  let reads=0;
  const hostilePlan={};
  Object.defineProperty(hostilePlan,'weeks',{enumerable:true,get(){reads+=1;return baseline.plan.weeks}});
  const cases=[
    {...baseline,plan:hostilePlan,catalog:apis.catalog},
    new Proxy({...baseline,catalog:apis.catalog},{}),
    {...baseline,plan:{...baseline.plan,weeks:new Array(4)},catalog:apis.catalog}
  ];
  const cyclic={...baseline,catalog:apis.catalog}; cyclic.self=cyclic; cases.push(cyclic);
  cases.push({...baseline,catalog:apis.catalog,extra:NaN});
  for(const input of cases){
    assert.doesNotThrow(()=>apis.validator.validatePlan(input));
    const result=apis.validator.validatePlan(input);
    assert.equal(result.ok,false);
    assert.equal(result.errors[0].code,'INVALID_VALIDATOR_INPUT');
  }
  assert.equal(reads,0);
});

test('跨realm纯数据可校验；classic script无structuredClone时fail closed',()=>{
  const apis=loadApis();
  const baseline=generated(apis.generator);
  const cross=vm.runInNewContext(`(${JSON.stringify({...baseline,catalog:apis.catalog})})`);
  assert.equal(apis.validator.validatePlan(cross).ok,true);
  const context={}; vm.createContext(context);
  for(const relative of ['src/data/exercise-catalog.js','src/domain/movement-matcher.js','src/domain/plan-validator.js']){
    vm.runInContext(fs.readFileSync(path.join(projectRoot,...relative.split('/')),'utf8'),context);
  }
  const result=context.Move28.domain.validatePlan(cross);
  assert.equal(result.ok,false);
  assert.equal(result.errors[0].code,'INVALID_VALIDATOR_INPUT');
});

test('公开发布媒体硬门接受25项本地图库计划并拒绝未知媒体模式', () => {
  const apis = loadApis();
  const baseline = generated(apis.generator);
  const ok = apis.validator.validatePlan({ ...baseline, catalog: apis.catalog, mediaRequirement: 'public_release' });
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));

  const invalidRequirement = apis.validator.validatePlan({ ...baseline, catalog: apis.catalog, mediaRequirement: 'external_release' });
  assert.equal(invalidRequirement.ok, false);
  assert.deepEqual(invalidRequirement.errors[0], {
    code: 'INVALID_PLAN_SCHEMA',
    path: 'input.mediaRequirement',
    message: '计划结构或必需字段无效。'
  });
});
