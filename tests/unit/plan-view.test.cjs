'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {clearMove28ModuleCache}=require('../helpers/load-script.cjs');
const gymEquipment=['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const intake={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment:gymEquipment,allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no',finalConfirmed:true};
const risk={level:'normal',ruleVersion:'pilot-v2',reasons:[]};
const capabilityProfile={version:1,completed:true,chairRise:'independent_controlled',wallPushup:'controlled',wallHinge:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable'};
function setup(){
  clearMove28ModuleCache();
  const catalog=require('../../src/data/exercise-catalog.js');
  const generator=require('../../src/domain/plan-generator.js');
  const guide=require('../../src/ui/workout-guide.js');
  const app=require('../../src/app.js');
  const capabilityResult=require('../../src/domain/capability-engine.js').evaluateCapabilityProfile(capabilityProfile);
  const plan=generator.generatePlan({intake,risk,intakeRevision:1,catalog:catalog.exerciseCatalog,capabilityResult,capabilityRevision:1});
  assert.equal(plan.status,'generated');
  return{catalog,generator,guide,app,plan,capabilityResult};
}
test('plan-view active计划必须与当前intake revision一致并再次通过硬门',()=>{
  const {app,plan,capabilityResult}=setup();
  const capability={capabilityProfile,capabilityResult,capabilityRevision:1};
  const active={...structuredClone(plan),status:'active',review:{status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:plan.id,intakeRevision:1,capabilityRevision:1}};
  let context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:{...structuredClone(plan),status:'pending_review',review:null},logs:{}});
  assert.equal(context.mode,'review');
  context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:active,logs:{}});
  assert.equal(context.mode,'generated');
  assert.deepEqual(context.plan,active);
  context=app.contextFromState({intake,intakeRevision:2,risk,...capability,plan:active,logs:{}});
  assert.equal(context.mode,'stale');
  const damaged=structuredClone(active);damaged.weeks[0].sessions[0].actions[0].reps=99;
  context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:damaged,logs:{}});
  assert.equal(context.mode,'invalid');
  context=app.contextFromState({intake:null,intakeRevision:0,risk:null,plan:null,logs:{}});
  assert.equal(context.mode,'demo');
  let reads=0;const hostilePlan={};Object.defineProperty(hostilePlan,'status',{enumerable:true,get(){reads+=1;throw new Error('SECRET')}});
  assert.doesNotThrow(()=>{context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:hostilePlan,logs:{}})});
  assert.equal(context.mode,'invalid');assert.equal(reads,0);
  let tagReads=0;const tagged={};Object.defineProperty(tagged,Symbol.toStringTag,{get(){tagReads+=1;return'Object'}});
  assert.equal(app.contextFromState(tagged).mode,'invalid');assert.equal(tagReads,0);
  assert.equal(app.contextFromState(new Proxy({},{ownKeys(){throw new Error('SECRET')}})).mode,'invalid');
  const forgedRiskContext=app.contextFromState({intake:{...intake,chestSymptoms:'yes'},intakeRevision:1,risk,...capability,plan:active,logs:{}});
  assert.equal(forgedRiskContext.mode,'blocked');
  let validationReads=0;const hostileValidation={errors:[]};Object.defineProperty(hostileValidation,'ok',{enumerable:true,get(){validationReads+=1;throw new Error('VALIDATOR_RESULT_GETTER')}});
  assert.doesNotThrow(()=>assert.equal(app.validationPassed(hostileValidation),false));assert.equal(validationReads,0);
  const validationProxy=new Proxy({ok:true,errors:[]},{ownKeys(){throw new Error('SECRET')}});assert.equal(app.validationPassed(validationProxy),false);
});

test('plan-view加载后篡改遍历intrinsic仍保持零getter执行',()=>{
  const {app}=setup();
  let getterCalls=0;
  const hostile={intake:null};
  Object.defineProperty(hostile,'secret',{enumerable:true,get(){getterCalls+=1;return'secret'}});
  const originalDescriptor=Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor=function(value,key){
    const descriptor=originalDescriptor(value,key);
    if(descriptor&&typeof descriptor.get==='function')return{value:value[key],enumerable:true,configurable:true,writable:true};
    return descriptor;
  };
  try{
    assert.equal(app.contextFromState(hostile).mode,'invalid');
    assert.equal(getterCalls,0);
  }finally{Object.getOwnPropertyDescriptor=originalDescriptor;}
});

test('plan-view 跟练队列逐项忠实映射session.actions且不自行匹配或提供任选项',()=>{
  const {catalog,guide,plan}=setup();
  const session=plan.weeks[0].sessions[0];
  const steps=guide.buildWorkoutSteps(session,catalog.exerciseCatalog);
  assert.equal(steps.length,session.actions.length);
  assert.deepEqual(steps.map(step=>step.exercise.id),session.actions.map(action=>action.exerciseId));
  assert.deepEqual(steps.map(step=>step.action),session.actions);
  assert.ok(steps.every(step=>typeof guide.doseText(step.action)==='string'&&!guide.doseText(step.action).includes('任选')));
  const forged=structuredClone(session);forged.actions[0].exerciseId='unreviewed-action';
  assert.equal(guide.buildWorkoutSteps(forged,catalog.exerciseCatalog),null);
  assert.equal(guide.buildWorkoutSteps(session,structuredClone(catalog.exerciseCatalog)),null);
  assert.equal(guide.buildWorkoutSteps({...session,actions:[]},catalog.exerciseCatalog),null);
});
test('plan-view 跟练入口对accessor、稀疏数组和Proxy稳定fail closed',()=>{
  const {catalog,guide,plan}=setup();let reads=0;
  const hostile=structuredClone(plan.weeks[0].sessions[0]);
  Object.defineProperty(hostile,'actions',{enumerable:true,get(){reads+=1;return[]}});
  assert.equal(guide.buildWorkoutSteps(hostile,catalog.exerciseCatalog),null);
  assert.equal(reads,0);
  const sparse=structuredClone(plan.weeks[0].sessions[0]);sparse.actions.length+=1;
  assert.equal(guide.buildWorkoutSteps(sparse,catalog.exerciseCatalog),null);
  const proxy=new Proxy(plan.weeks[0].sessions[0],{getOwnPropertyDescriptor(){throw new Error('secret')}});
  assert.doesNotThrow(()=>assert.equal(guide.buildWorkoutSteps(proxy,catalog.exerciseCatalog),null));
  let tagReads=0;const tagged=structuredClone(plan.weeks[0].sessions[0]);Object.defineProperty(tagged,Symbol.toStringTag,{get(){tagReads+=1;return'Object'}});
  assert.equal(guide.buildWorkoutSteps(tagged,catalog.exerciseCatalog),null);assert.equal(tagReads,0);
});
