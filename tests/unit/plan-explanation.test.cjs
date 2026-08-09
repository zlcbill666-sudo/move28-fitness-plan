'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {clearMove28ModuleCache}=require('../helpers/load-script.cjs');
const {NORMAL_CAPABILITY_RESULT}=require('../helpers/capability-fixture.cjs');

const equipment=['stable_chair','exercise_mat','wall','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const intake={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment,allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no',finalConfirmed:true};
const risk={level:'normal',ruleVersion:'pilot-v2',reasons:[]};

function setup(capabilityResult=NORMAL_CAPABILITY_RESULT,capabilityRevision=3,intakeOverrides={},riskOverrides={}){
  clearMove28ModuleCache();
  const catalog=require('../../src/data/exercise-catalog.js');
  const generator=require('../../src/domain/plan-generator.js');
  const explanation=require('../../src/domain/plan-explanation.js');
  const generated=generator.generatePlan({intake:{...intake,...intakeOverrides},risk:{...risk,...riskOverrides},intakeRevision:2,catalog:catalog.exerciseCatalog,capabilityResult,capabilityRevision});
  assert.equal(generated.status,'generated');
  const plan={...structuredClone(generated),status:'active',review:{status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:generated.id,intakeRevision:2,capabilityRevision}};
  return{explanation,plan};
}

function conservativeCapability(){
  return Object.freeze({status:'conservative',difficultyCap:1,exclusions:Object.freeze([]),variants:Object.freeze({knee_dominant:'high_seat',horizontal_push:'close_wall'}),cardioStartMinutes:8,reasonCodes:Object.freeze(['CHAIR_RISE_HANDS_SUPPORTED','WALL_PUSHUP_LIMITED_RANGE','WALK_TOLERANCE_FATIGUED_BUT_STABLE'])});
}

test('可信计划解释输出有限确定schema并深冻结',()=>{
  const {explanation,plan}=setup();
  const result=explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3});
  assert.deepEqual(Object.keys(result),['version','strategy','setting','weeklySessionRange','durationRange','reasonCodes','reasonLabels','validationResult']);
  assert.equal(result.version,'plan-explanation.v1');
  assert.equal(result.strategy,'standard_start');
  assert.equal(result.setting,'gym');
  assert.deepEqual(result.weeklySessionRange,{min:plan.weeks[0].sessions.length,max:plan.weeks[0].sessions.length});
  const durations=plan.weeks.flatMap(week=>week.sessions.map(session=>session.estimatedMinutes));
  assert.deepEqual(result.durationRange,{min:Math.min(...durations),max:Math.max(...durations)});
  assert.deepEqual(result.reasonCodes,[]);
  assert.deepEqual(result.reasonLabels,[]);
  assert.equal(result.validationResult,'passed');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.durationRange));
  assert.ok(Object.isFrozen(result.reasonCodes));
  assert.ok(Object.isFrozen(result.reasonLabels));
});

test('合法周调整可用每周节数范围解释而不会隐藏面板',()=>{
  const {explanation,plan}=setup();
  const adjusted=structuredClone(plan);
  adjusted.weeks[1].sessions.pop();
  const result=explanation.buildPlanExplanation({plan:adjusted,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3});
  assert.equal(result.validationResult,'passed');
  assert.deepEqual(result.weeklySessionRange,{min:1,max:2});
});

test('居家计划使用同一有限汇总schema',()=>{
  const {explanation,plan}=setup(NORMAL_CAPABILITY_RESULT,3,{setting:'home',equipment:['stable_chair','exercise_mat','resistance_band','wall']});
  const result=explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3});
  assert.equal(result.validationResult,'passed');
  assert.equal(result.setting,'home');
  assert.deepEqual(result.weeklySessionRange,{min:2,max:2});
});

test('保守风险即使能力正常也必须解释为保守起步',()=>{
  const {explanation,plan}=setup(NORMAL_CAPABILITY_RESULT,3,{activityDays:'0'},{level:'conservative'});
  const result=explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3});
  assert.equal(result.strategy,'conservative_start');
  assert.deepEqual(result.reasonCodes,['RISK_RULE_CONSERVATIVE_START']);
  assert.deepEqual(result.reasonLabels,['安全筛查结果要求计划采用保守起步。']);
});

test('保守起步只映射审核过的能力原因中文文案',()=>{
  const capabilityResult=conservativeCapability();
  const {explanation,plan}=setup(capabilityResult,4);
  const result=explanation.buildPlanExplanation({plan,capabilityResult,capabilityRevision:4});
  assert.equal(result.strategy,'conservative_start');
  assert.deepEqual(result.reasonCodes,capabilityResult.reasonCodes);
  assert.deepEqual(result.reasonLabels,[
    '坐站需要手部辅助，计划采用更易控制的起立版本。',
    '墙壁推举活动范围有限，计划采用更靠近墙面的版本。',
    '步行后容易疲劳，当前纯力量计划因此采用更保守的训练起点。'
  ]);
  assert.equal(JSON.stringify(result).includes('high_seat'),false);
  assert.equal(JSON.stringify(result).includes('close_wall'),false);
});

test('只有实际包含有氧时才解释较短低冲击有氧',()=>{
  const capabilityResult=conservativeCapability();
  const {explanation,plan}=setup(capabilityResult,4,{daysPerWeek:'3',weekdays:['mon','wed','fri']});
  assert.ok(plan.weeks.some(week=>week.sessions.some(session=>session.intent==='low_impact_cardio')));
  const result=explanation.buildPlanExplanation({plan,capabilityResult,capabilityRevision:4});
  assert.ok(result.reasonLabels.includes('步行后容易疲劳，计划从较短的低冲击有氧开始。'));
  assert.equal(result.reasonLabels.some(label=>label.includes('当前纯力量计划')),false);
});

test('四天计划包含恢复session时仍生成可信解释',()=>{
  const {explanation,plan}=setup(NORMAL_CAPABILITY_RESULT,3,{daysPerWeek:'4',weekdays:['mon','tue','thu','sat']});
  assert.ok(plan.weeks.every(week=>week.sessions.some(session=>session.intent==='recovery')));
  const result=explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3});
  assert.equal(result.validationResult,'passed');
  assert.deepEqual(result.weeklySessionRange,{min:4,max:4});
});

test('解释拒绝错配revision、未知原因、损坏周结构且不返回部分字段',()=>{
  const capabilityResult=conservativeCapability();
  const {explanation,plan}=setup(capabilityResult,4);
  const failed={version:'plan-explanation.v1',validationResult:'failed'};
  assert.deepEqual(explanation.buildPlanExplanation({plan,capabilityResult,capabilityRevision:3}),failed);
  assert.deepEqual(explanation.buildPlanExplanation({plan,capabilityResult:{...capabilityResult,reasonCodes:['UNKNOWN_REASON']},capabilityRevision:4}),failed);
  const damaged=structuredClone(plan);damaged.weeks[1].sessions.length=0;
  assert.deepEqual(explanation.buildPlanExplanation({plan:damaged,capabilityResult,capabilityRevision:4}),failed);
  const pending={...structuredClone(plan),status:'pending_review'};
  assert.deepEqual(explanation.buildPlanExplanation({plan:pending,capabilityResult,capabilityRevision:4}),failed);
});

test('解释不导出原始健康、审核或计划自由文本',()=>{
  const {explanation,plan}=setup();
  plan.review.reviewerId='raw-health-marker';
  plan.weeks[0].focus='RAW PLAN FREE TEXT';
  plan.weeks[0].sessions[0].actions[0].variantLabel='RAW ACTION FREE TEXT';
  const result=explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3});
  const serialized=JSON.stringify(result);
  for(const forbidden of ['raw-health-marker','RAW PLAN FREE TEXT','RAW ACTION FREE TEXT','review','age','chestSymptoms','pregnancyPostpartum'])assert.equal(serialized.includes(forbidden),false,forbidden);
});

test('getter、Proxy、稀疏数组、危险键与内建篡改均零getter执行并fail closed',()=>{
  const {explanation,plan}=setup();
  const failed={version:'plan-explanation.v1',validationResult:'failed'};
  let reads=0;
  const hostile={plan,capabilityResult:NORMAL_CAPABILITY_RESULT};
  Object.defineProperty(hostile,'capabilityRevision',{enumerable:true,get(){reads+=1;throw new Error('SECRET')}});
  assert.deepEqual(explanation.buildPlanExplanation(hostile),failed);
  const nested=structuredClone(plan);
  Object.defineProperty(nested.weeks[0].sessions[0],'estimatedMinutes',{enumerable:true,get(){reads+=1;return 30}});
  assert.deepEqual(explanation.buildPlanExplanation({plan:nested,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3}),failed);
  assert.deepEqual(explanation.buildPlanExplanation(new Proxy({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3},{ownKeys(){throw new Error('SECRET_PROXY')}})),failed);
  const sparse=structuredClone(plan);sparse.weeks.length+=1;
  assert.deepEqual(explanation.buildPlanExplanation({plan:sparse,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3}),failed);
  const dangerous=structuredClone(plan);Object.defineProperty(dangerous.weeks[0],'__proto__',{value:{polluted:true},enumerable:true});
  assert.deepEqual(explanation.buildPlanExplanation({plan:dangerous,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3}),failed);
  const transparent=new Proxy({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3},{});
  assert.deepEqual(explanation.buildPlanExplanation(transparent),failed);
  const target={plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3},revocable=Proxy.revocable(target,{});revocable.revoke();
  assert.doesNotThrow(()=>assert.deepEqual(explanation.buildPlanExplanation(revocable.proxy),failed));
  const nestedProxy={plan:new Proxy(plan,{}),capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3};
  assert.deepEqual(explanation.buildPlanExplanation(nestedProxy),failed);
  const descriptorProxy=new Proxy({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3},{getOwnPropertyDescriptor(){throw new Error('SECRET_DESCRIPTOR')}});
  assert.deepEqual(explanation.buildPlanExplanation(descriptorProxy),failed);
  const forgedRoot=Object.create(null);Object.defineProperty(forgedRoot,'constructor',{value:Object});
  const forgedPlan=Object.assign(Object.create(forgedRoot),structuredClone(plan));
  assert.deepEqual(explanation.buildPlanExplanation({plan:forgedPlan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3}),failed);
  const proxiedPrototypePlan=Object.assign(Object.create(new Proxy(Object.prototype,{})),structuredClone(plan));
  assert.deepEqual(explanation.buildPlanExplanation({plan:proxiedPrototypePlan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3}),failed);
  const cyclic={plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3};cyclic.self=cyclic;
  assert.deepEqual(explanation.buildPlanExplanation(cyclic),failed);
  const deep={plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3,extra:{}};let cursor=deep.extra;
  for(let index=0;index<20000;index+=1){cursor.next={};cursor=cursor.next}
  assert.doesNotThrow(()=>assert.deepEqual(explanation.buildPlanExplanation(deep),failed));
  const wide={plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3};
  for(let index=0;index<1025;index+=1)wide[`extra${index}`]=index;
  assert.deepEqual(explanation.buildPlanExplanation(wide),failed);
  assert.deepEqual(explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3,extra:'x'.repeat(4097)}),failed);
  assert.deepEqual(explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3,['k'.repeat(129)]:1}),failed);
  assert.deepEqual(explanation.buildPlanExplanation({plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3,extra:Array.from({length:30},()=> 'x'.repeat(4000))}),failed);
  assert.equal(reads,0);

  const original=Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor=function(value,key){const descriptor=original(value,key);if(descriptor&&typeof descriptor.get==='function')return{value:value[key],enumerable:true};return descriptor};
  try{assert.deepEqual(explanation.buildPlanExplanation(hostile),failed);assert.equal(reads,0)}finally{Object.getOwnPropertyDescriptor=original}
});

test('Object.prototype污染不能执行getter或从继承字段伪造解释',()=>{
  const {explanation,plan}=setup();
  const failed={version:'plan-explanation.v1',validationResult:'failed'};
  let reads=0;
  const accessorPlan=structuredClone(plan);
  Object.defineProperty(accessorPlan.weeks[0].sessions[0],'estimatedMinutes',{enumerable:true,get(){reads+=1;return 30}});
  Object.defineProperties(Object.prototype,{
    value:{configurable:true,get(){reads+=1;return 30}},
    plan:{configurable:true,value:plan},
    capabilityResult:{configurable:true,value:NORMAL_CAPABILITY_RESULT},
    capabilityRevision:{configurable:true,value:3}
  });
  try{
    assert.deepEqual(explanation.buildPlanExplanation({plan:accessorPlan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3}),failed);
    assert.deepEqual(explanation.buildPlanExplanation({}),failed);
    assert.equal(reads,0);
  }finally{
    delete Object.prototype.value;delete Object.prototype.plan;delete Object.prototype.capabilityResult;delete Object.prototype.capabilityRevision;
  }
});

test('模块加载后篡改集合、数组、数值和Math内建仍生成相同可信解释',()=>{
  const {explanation,plan}=setup();
  const input={plan,capabilityResult:NORMAL_CAPABILITY_RESULT,capabilityRevision:3};
  const before=explanation.buildPlanExplanation(input);
  const originals={setAdd:Set.prototype.add,arrayIncludes:Array.prototype.includes,arrayPush:Array.prototype.push,arrayPop:Array.prototype.pop,arrayIsArray:Array.isArray,weakAdd:WeakSet.prototype.add,weakHas:WeakSet.prototype.has,getPrototypeOf:Object.getPrototypeOf,ownKeys:Reflect.ownKeys,isSafeInteger:Number.isSafeInteger,min:Math.min,max:Math.max};
  Set.prototype.add=()=>{throw new Error('TAMPERED_SET_ADD')};
  Array.prototype.includes=()=>{throw new Error('TAMPERED_ARRAY_INCLUDES')};
  Array.prototype.push=()=>{throw new Error('TAMPERED_ARRAY_PUSH')};
  Array.prototype.pop=()=>{throw new Error('TAMPERED_ARRAY_POP')};
  Array.isArray=()=>{throw new Error('TAMPERED_ARRAY_IS_ARRAY')};
  WeakSet.prototype.add=()=>{throw new Error('TAMPERED_WEAK_ADD')};
  WeakSet.prototype.has=()=>{throw new Error('TAMPERED_WEAK_HAS')};
  Object.getPrototypeOf=()=>{throw new Error('TAMPERED_GET_PROTOTYPE')};
  Reflect.ownKeys=()=>{throw new Error('TAMPERED_OWN_KEYS')};
  Number.isSafeInteger=()=>{throw new Error('TAMPERED_SAFE_INTEGER')};
  Math.min=()=>{throw new Error('TAMPERED_MATH_MIN')};
  Math.max=()=>{throw new Error('TAMPERED_MATH_MAX')};
  let after;
  try{after=explanation.buildPlanExplanation(input)}finally{
    Set.prototype.add=originals.setAdd;Array.prototype.includes=originals.arrayIncludes;Array.prototype.push=originals.arrayPush;Array.prototype.pop=originals.arrayPop;Array.isArray=originals.arrayIsArray;WeakSet.prototype.add=originals.weakAdd;WeakSet.prototype.has=originals.weakHas;Object.getPrototypeOf=originals.getPrototypeOf;Reflect.ownKeys=originals.ownKeys;Number.isSafeInteger=originals.isSafeInteger;Math.min=originals.min;Math.max=originals.max;
  }
  assert.deepEqual(after,before);
});
