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
  assert.equal(context.workflowStage,'human_review');
  context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:active,logs:{}});
  assert.equal(context.mode,'generated');
  assert.equal(context.workflowStage,'ready');
  assert.deepEqual(context.plan,active);
  context=app.contextFromState({intake,intakeRevision:2,risk,...capability,plan:active,logs:{}});
  assert.equal(context.mode,'stale');
  assert.equal(context.workflowStage,'plan_stale');
  const damaged=structuredClone(active);damaged.weeks[0].sessions[0].actions[0].reps=99;
  context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:damaged,logs:{}});
  assert.equal(context.mode,'invalid');
  assert.equal(context.workflowStage,'invalid');
  context=app.contextFromState({intake:null,intakeRevision:0,risk:null,plan:null,logs:{}});
  assert.equal(context.mode,'demo');
  assert.equal(context.workflowStage,'questionnaire');
  let reads=0;const hostilePlan={};Object.defineProperty(hostilePlan,'status',{enumerable:true,get(){reads+=1;throw new Error('SECRET')}});
  assert.doesNotThrow(()=>{context=app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:hostilePlan,logs:{}})});
  assert.equal(context.mode,'invalid');assert.equal(reads,0);
  let tagReads=0;const tagged={};Object.defineProperty(tagged,Symbol.toStringTag,{get(){tagReads+=1;return'Object'}});
  assert.equal(app.contextFromState(tagged).mode,'invalid');assert.equal(tagReads,0);
  assert.equal(app.contextFromState(new Proxy({},{ownKeys(){throw new Error('SECRET')}})).mode,'invalid');
  const forgedRiskContext=app.contextFromState({intake:{...intake,chestSymptoms:'yes'},intakeRevision:1,risk,...capability,plan:active,logs:{}});
  assert.equal(forgedRiskContext.mode,'blocked');
  assert.equal(forgedRiskContext.workflowStage,'risk_blocked');
  let validationReads=0;const hostileValidation={errors:[]};Object.defineProperty(hostileValidation,'ok',{enumerable:true,get(){validationReads+=1;throw new Error('VALIDATOR_RESULT_GETTER')}});
  assert.doesNotThrow(()=>assert.equal(app.validationPassed(hostileValidation),false));assert.equal(validationReads,0);
  const validationProxy=new Proxy({ok:true,errors:[]},{ownKeys(){throw new Error('SECRET')}});assert.equal(app.validationPassed(validationProxy),false);
});

test('plan-view workflowStage只表达可信流程阶段且不能授予训练权限',()=>{
  const {app,plan,capabilityResult}=setup();
  const capability={capabilityProfile,capabilityResult,capabilityRevision:1};
  const pending={...structuredClone(plan),status:'pending_review',review:null};
  const active={...structuredClone(plan),status:'active',review:{status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:plan.id,intakeRevision:1,capabilityRevision:1}};
  const painPlan={...structuredClone(active),status:'stale',staleReason:'workout_feedback_pain',staleAt:'2030-01-02T03:04:05.000Z'},painSession=painPlan.weeks[0].sessions[0];
  const painRecord={planId:painPlan.id,sessionId:painSession.id,status:'completed',completedAt:'2030-01-02T03:04:05.000Z',capabilityRevision:1,feedbackCode:'pain',feedbackAt:'2030-01-02T03:04:05.000Z'};
  const cases=[
    {state:null,mode:'demo',stage:'questionnaire'},
    {state:{intake,intakeRevision:1,risk,logs:{}},mode:'review',stage:'capability_required'},
    {state:{intake,intakeRevision:1,risk,...capability,plan:null,logs:{}},mode:'review',stage:'plan_required'},
    {state:{intake,intakeRevision:1,risk,...capability,plan:pending,logs:{}},mode:'review',stage:'human_review'},
    {state:{intake,intakeRevision:1,risk,...capability,plan:active,logs:{}},mode:'generated',stage:'ready'},
    {state:{intake,intakeRevision:1,risk,...capability,plan:active,logs:{stop:{status:'safety_stopped',planId:active.id}}},mode:'stale',stage:'rescreen_required'},
    {state:{intake,intakeRevision:1,risk,...capability,plan:painPlan,logs:{pain:painRecord}},mode:'stale',stage:'rescreen_required'},
    {state:{intake,intakeRevision:1,risk,...capability,plan:painPlan,logs:{pain:{...painRecord,capabilityRevision:2}}},mode:'stale',stage:'plan_stale'},
    {state:{intake,intakeRevision:2,risk,...capability,plan:active,logs:{}},mode:'stale',stage:'plan_stale'}
  ];
  for(const item of cases){const context=app.contextFromState(item.state);assert.equal(context.mode,item.mode);assert.equal(context.workflowStage,item.stage);assert.equal(context.workflowStage==='ready',context.mode==='generated')}
  const hostile={intake};let reads=0;Object.defineProperty(hostile,'workflowStage',{enumerable:true,get(){reads+=1;throw new Error('SECRET_STAGE')}});
  const context=app.contextFromState(hostile);assert.equal(context.mode,'invalid');assert.equal(context.workflowStage,'invalid');assert.equal(reads,0);
  assert.equal(app.contextFromState(new Proxy({},{ownKeys(){throw new Error('SECRET_STAGE_PROXY')}})).workflowStage,'invalid');
});

test('plan-view active上下文逐项拒绝能力revision缺失、0与错配',()=>{
  const {app,plan,capabilityResult}=setup();
  const capability={capabilityProfile,capabilityResult,capabilityRevision:1};
  const makeActive=()=>({...structuredClone(plan),status:'active',review:{status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:plan.id,intakeRevision:1,capabilityRevision:1}});
  for(const mutate of [state=>{delete state.capabilityRevision},state=>{state.capabilityRevision=0}]){
    const state={intake,intakeRevision:1,risk,...capability,plan:makeActive(),logs:{}};mutate(state);
    assert.equal(app.contextFromState(state).mode,'review');
  }
  {const state={intake,intakeRevision:1,risk,...capability,capabilityRevision:2,plan:makeActive(),logs:{}};assert.equal(app.contextFromState(state).mode,'stale')}
  for(const mutate of [active=>{delete active.capabilityRevision},active=>{active.capabilityRevision=0},active=>{active.capabilityRevision=2}]){
    const active=makeActive();mutate(active);
    assert.equal(app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:active,logs:{}}).mode,'stale');
  }
  for(const mutate of [active=>{delete active.review.capabilityRevision},active=>{active.review.capabilityRevision=0},active=>{active.review.capabilityRevision=2}]){
    const active=makeActive();mutate(active);
    assert.equal(app.contextFromState({intake,intakeRevision:1,risk,...capability,plan:active,logs:{}}).mode,'invalid');
  }
});

test('应用层周复盘目标仅沿当前能力revision的完整多跳lineage并在刷新后保持连续',()=>{
  const {app,plan}=setup();
  const currentPlan={...structuredClone(plan),id:'plan-current',capabilityRevision:2};
  const context={mode:'generated',plan:currentPlan};
  const accepted=(id,planId,resultPlanId,weekNumber,capabilityRevision=2)=>({id,planId,resultPlanId,weekNumber,capabilityRevision,decision:'accepted',proposal:{type:'keep',targetWeekNumber:null,variable:null,reasonCode:'appropriate'}});
  const state={capabilityRevision:2,weeklyReviews:[accepted('r1','plan-origin','plan-middle',1),accepted('r2','plan-middle','plan-current',2)]};
  const refreshed=JSON.parse(JSON.stringify(state));
  const target=weekNumber=>({weekNumber,scheduledSessions:currentPlan.weeks[weekNumber-1].sessions.length,feedbackSummary:{recorded:0,total:currentPlan.weeks[weekNumber-1].sessions.length,counts:{too_easy:0,appropriate:0,too_hard:0,pain:0}}});
  assert.deepEqual(app.weeklyReviewTarget(refreshed,context),target(3));
  const oldCapability=JSON.parse(JSON.stringify(state));oldCapability.weeklyReviews.forEach(item=>{item.capabilityRevision=1});assert.deepEqual(app.weeklyReviewTarget(oldCapability,context),target(1));
  const invalidCases=[
    raw=>{raw.weeklyReviews.push({...raw.weeklyReviews[0],id:'duplicate'})},
    raw=>{raw.weeklyReviews=[accepted('cycle-a','plan-origin','plan-middle',1),accepted('cycle-b','plan-middle','plan-origin',2)]},
    raw=>{raw.weeklyReviews.push(accepted('detached','detached-parent','detached-parent-w1-a',1))},
    raw=>{raw.weeklyReviews[1].resultPlanId='broken-child'},
    raw=>{raw.weeklyReviews[0].planId=''},
    raw=>{raw.weeklyReviews[0].proposal.reasonCode='INVALID MACHINE ID'},
    raw=>{raw.weeklyReviews[0].proposal.variable='INVALID MACHINE ID'}
  ];
  for(const mutate of invalidCases){const raw=JSON.parse(JSON.stringify(state));mutate(raw);assert.equal(app.weeklyReviewTarget(raw,context),null)}
  const oldPending={id:'old-pending',planId:'plan-current',resultPlanId:null,weekNumber:4,capabilityRevision:1,decision:'pending',answers:{scheduledSessions:99},proposal:{type:'keep'}};
  assert.deepEqual(app.weeklyReviewTarget({...state,weeklyReviews:[...state.weeklyReviews,oldPending]},context),target(3));
  assert.equal(app.weeklyReviewTarget({...state,capabilityRevision:1},context),null);
});

test('应用层反馈摘要只统计语义完整且绑定当前session的完成记录',()=>{
  const {app,plan}=setup(),session=plan.weeks[0].sessions[0],at='2030-01-02T03:04:05.000Z';
  const context={mode:'generated',plan},base={capabilityRevision:1,weeklyReviews:[],logs:{}},record={planId:plan.id,sessionId:session.id,status:'completed',completedAt:at,capabilityRevision:1,feedbackCode:'appropriate',feedbackAt:at};
  const target=app.weeklyReviewTarget({...base,logs:{valid:record}},context);
  assert.deepEqual(target.feedbackSummary,{recorded:1,total:plan.weeks[0].sessions.length,counts:{too_easy:0,appropriate:1,too_hard:0,pain:0}});
  const mutations=[item=>{item.status='safety_stopped'},item=>{delete item.completedAt},item=>{item.completedAt='invalid'},item=>{delete item.feedbackAt},item=>{item.feedbackAt='invalid'},item=>{item.sessionId='forged'},item=>{item.planId='forged'},item=>{item.capabilityRevision=2}];
  for(const mutate of mutations){const item=structuredClone(record);mutate(item);assert.equal(app.weeklyReviewTarget({...base,logs:{invalid:item}},context).feedbackSummary.recorded,0)}
});

test('应用层反馈摘要不执行加载后替换的Set与Object.values',()=>{
  const {app,plan}=setup(),session=plan.weeks[0].sessions[0],at='2030-01-02T03:04:05.000Z',context={mode:'generated',plan};
  const state={capabilityRevision:1,weeklyReviews:[],logs:{valid:{planId:plan.id,sessionId:session.id,status:'completed',completedAt:at,capabilityRevision:1,feedbackCode:'appropriate',feedbackAt:at}}};
  const before=app.weeklyReviewTarget(state,context),OriginalSet=global.Set,originalHas=OriginalSet.prototype.has,originalAdd=OriginalSet.prototype.add,originalValues=Object.values;
  let calls=0;const poisoned=()=>{calls+=1;throw new Error('TAMPERED_INTRINSIC')};let after;
  global.Set=poisoned;OriginalSet.prototype.has=poisoned;OriginalSet.prototype.add=poisoned;Object.values=poisoned;
  try{after=app.weeklyReviewTarget(state,context)}finally{global.Set=OriginalSet;OriginalSet.prototype.has=originalHas;OriginalSet.prototype.add=originalAdd;Object.values=originalValues}
  assert.deepEqual(after,before);assert.equal(calls,0);
});

test('实际plan context不执行加载后替换的Object.values',()=>{
  const {app,plan,capabilityResult}=setup(),active={...structuredClone(plan),status:'active',review:{status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:plan.id,intakeRevision:1,capabilityRevision:1}};
  const state={intake,intakeRevision:1,risk,capabilityProfile,capabilityResult,capabilityRevision:1,plan:active,logs:{}};
  const before=app.contextFromState(state),originalValues=Object.values;let calls=0,after;Object.values=()=>{calls+=1;throw new Error('TAMPERED_VALUES')};
  try{after=app.contextFromState(state)}finally{Object.values=originalValues}
  assert.deepEqual(after,before);assert.equal(after.mode,'generated');assert.equal(calls,0);
});

test('周复盘目标对普通畸形pending和plan固定返回null',()=>{
  const {app,plan}=setup(),context={mode:'generated',plan},pending={id:'weekly-pending',planId:plan.id,weekNumber:1,capabilityRevision:1,decision:'pending'};
  assert.doesNotThrow(()=>assert.equal(app.weeklyReviewTarget({capabilityRevision:1,weeklyReviews:[pending]},context),null));
  const noWeeks=structuredClone(plan);delete noWeeks.weeks;
  const noSessions=structuredClone(plan);delete noSessions.weeks[0].sessions;
  assert.doesNotThrow(()=>assert.equal(app.weeklyReviewTarget({capabilityRevision:1,weeklyReviews:[]},{mode:'generated',plan:noWeeks}),null));
  assert.doesNotThrow(()=>assert.equal(app.weeklyReviewTarget({capabilityRevision:1,weeklyReviews:[]},{mode:'generated',plan:noSessions}),null));
  const malformedRejected={id:'weekly-rejected',planId:'',resultPlanId:null,weekNumber:1,capabilityRevision:1,decision:'rejected',proposal:{type:'keep',targetWeekNumber:null,variable:null,reasonCode:'appropriate'}};
  assert.equal(app.weeklyReviewTarget({capabilityRevision:1,weeklyReviews:[malformedRejected]},context),null);
});

test('应用层周复盘目标对accessor与Proxy稳定fail closed且零getter执行',()=>{
  const {app,plan}=setup();let reads=0;
  const state={capabilityRevision:1,weeklyReviews:[]},context={mode:'generated',plan};
  const hostileState={capabilityRevision:1};Object.defineProperty(hostileState,'weeklyReviews',{enumerable:true,get(){reads+=1;throw new Error('SECRET_WEEKLY_GETTER')}});
  const hostileContext={mode:'generated'};Object.defineProperty(hostileContext,'plan',{enumerable:true,get(){reads+=1;throw new Error('SECRET_PLAN_GETTER')}});
  assert.doesNotThrow(()=>assert.equal(app.weeklyReviewTarget(hostileState,context),null));
  assert.doesNotThrow(()=>assert.equal(app.weeklyReviewTarget(state,hostileContext),null));
  assert.doesNotThrow(()=>assert.equal(app.weeklyReviewTarget(new Proxy(state,{ownKeys(){throw new Error('SECRET_PROXY')}}),context),null));
  assert.equal(reads,0);
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

test('workout-guide加载后篡改安全边界intrinsic不会执行外部代码或改变步骤',()=>{
  const {catalog,guide,plan}=setup();
  const session=plan.weeks[0].sessions[0];
  const before=guide.buildWorkoutSteps(session,catalog.exerciseCatalog);
  assert.ok(before);
  const originals={isArray:Array.isArray,iterator:Array.prototype[Symbol.iterator],getPrototypeOf:Object.getPrototypeOf,getDescriptor:Object.getOwnPropertyDescriptor,keys:Object.keys,ownKeys:Reflect.ownKeys,hasOwn:Object.prototype.hasOwnProperty,mapGet:Map.prototype.get,mapSet:Map.prototype.set,weakHas:WeakSet.prototype.has,weakAdd:WeakSet.prototype.add};
  let calls=0;const poisoned=()=>{calls+=1;throw new Error('TAMPERED_INTRINSIC')};
  Array.isArray=poisoned;Array.prototype[Symbol.iterator]=poisoned;Object.getPrototypeOf=poisoned;Object.getOwnPropertyDescriptor=poisoned;Object.keys=poisoned;Reflect.ownKeys=poisoned;Object.prototype.hasOwnProperty=poisoned;Map.prototype.get=poisoned;Map.prototype.set=poisoned;WeakSet.prototype.has=poisoned;WeakSet.prototype.add=poisoned;
  let after;
  try{after=guide.buildWorkoutSteps(session,catalog.exerciseCatalog)}
  finally{Array.isArray=originals.isArray;Array.prototype[Symbol.iterator]=originals.iterator;Object.getPrototypeOf=originals.getPrototypeOf;Object.getOwnPropertyDescriptor=originals.getDescriptor;Object.keys=originals.keys;Reflect.ownKeys=originals.ownKeys;Object.prototype.hasOwnProperty=originals.hasOwn;Map.prototype.get=originals.mapGet;Map.prototype.set=originals.mapSet;WeakSet.prototype.has=originals.weakHas;WeakSet.prototype.add=originals.weakAdd}
  assert.deepEqual(after,before);assert.equal(calls,0);
});

test('媒体发布受阻时动作库与跟练仅输出文字占位且不泄漏GIF路径',()=>{
  const {catalog,guide}=setup();
  const dashboard=require('../../src/ui/dashboard.js'),exercise=catalog.exerciseCatalog[0];
  const libraryHtml=dashboard.exerciseMediaHtml(exercise),guideHtml=guide.guideMediaHtml(exercise);
  for(const html of [libraryHtml,guideHtml]){
    assert.match(html,/动作媒体审核中/);
    assert.doesNotMatch(html,/<img|<picture|<video|<source/i);
    assert.doesNotMatch(html,/assets\/gifs\//);
  }
  assert.match(libraryHtml,/TEXT GUIDE/);
  assert.match(guideHtml,/TEXT-ONLY MODE/);
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
test('plan-view 只把动作目录审核过的受控变式指导带入跟练步骤',()=>{
  const {catalog,guide,plan}=setup();
  const base=structuredClone(plan.weeks[0].sessions[0]);
  const action=base.actions.find(item=>item.pattern==='knee_dominant');
  action.exerciseId='high-seat-sit-to-stand';action.variant='high_seat';action.variantLabel='PLAN_FORGED_LABEL';action.variantInstruction='PLAN_FORGED_INSTRUCTION';
  let steps=guide.buildWorkoutSteps(base,catalog.exerciseCatalog);
  let step=steps.find(item=>item.action.pattern==='knee_dominant');
  assert.deepEqual(step.variantGuidance,{
    label:'高位座椅变式',
    setup:'使用稳固、不会滑动的较高座椅；座面高度以起立时膝部无明显疼痛为准。',
    range:'只在可控、无痛范围内起立和坐回；若仍需猛冲或膝痛，继续提高座面或停止。'
  });
  assert.equal(JSON.stringify(step.variantGuidance).includes('high_seat'),false);
  assert.equal(JSON.stringify(step.variantGuidance).includes('PLAN_FORGED'),false);

  const push=base.actions.find(item=>item.pattern==='horizontal_push');
  push.exerciseId='wall-push-up';push.variant='close_wall';
  steps=guide.buildWorkoutSteps(base,catalog.exerciseCatalog);
  step=steps.find(item=>item.action.pattern==='horizontal_push');
  assert.deepEqual(step.variantGuidance,{
    label:'近墙小幅变式',
    setup:'双脚站得更靠近墙面，让身体倾斜角度更小；双手置于胸口至肩下高度。',
    range:'胸部只靠近墙到肩部无痛且身体仍成一直线的范围，再平稳推回。'
  });
  assert.equal(JSON.stringify(step.variantGuidance).includes('close_wall'),false);

  const standard=structuredClone(plan.weeks[0].sessions[0]);
  const standardSteps=guide.buildWorkoutSteps(standard,catalog.exerciseCatalog);
  assert.ok(standardSteps);
  assert.ok(standardSteps.filter(item=>['knee_dominant','horizontal_push'].includes(item.action.pattern)).every(item=>item.variantGuidance===null));
});
test('plan-view 对未知或动作不匹配的variant拒绝且不读取计划自由文本',()=>{
  const {catalog,guide,plan}=setup();
  for(const mutation of [
    action=>{action.variant='unknown_variant'},
    action=>{action.exerciseId='high-seat-sit-to-stand';action.variant='standard'},
    action=>{action.exerciseId='seated-leg-press';action.variant='high_seat'}
  ]){
    const session=structuredClone(plan.weeks[0].sessions[0]),action=session.actions.find(item=>item.pattern==='knee_dominant');
    mutation(action);action.variantLabel='PLAN_FORGED_LABEL';action.variantInstruction='PLAN_FORGED_INSTRUCTION';
    assert.equal(guide.buildWorkoutSteps(session,catalog.exerciseCatalog),null);
  }
  const session=structuredClone(plan.weeks[0].sessions[0]),action=session.actions.find(item=>item.pattern==='horizontal_push');
  action.exerciseId='wall-push-up';action.variant='standard';
  assert.equal(guide.buildWorkoutSteps(session,catalog.exerciseCatalog),null);
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
