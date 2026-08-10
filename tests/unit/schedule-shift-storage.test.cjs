'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const {capabilityInput}=require('../helpers/capability-fixture.cjs');

const root=path.resolve(__dirname,'../..');
const storePath=path.join(root,'src/storage/local-store.js');
const shiftPath=path.join(root,'src/domain/schedule-shift.js');
const generatorPath=path.join(root,'src/domain/plan-generator.js');
const catalogPath=path.join(root,'src/data/exercise-catalog.js');
const dependencyPaths=[storePath,shiftPath,generatorPath,catalogPath,path.join(root,'src/domain/plan-validator.js'),path.join(root,'src/domain/risk-engine.js'),path.join(root,'src/domain/capability-engine.js'),path.join(root,'src/domain/weekly-adaptation.js'),path.join(root,'src/domain/daily-execution-validator.js')];

const INTAKE={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','wed','fri'],gymOftenUnavailable:'no',setting:'gym',equipment:['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'],allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no',finalConfirmed:true};
const RISK={level:'normal',ruleVersion:'pilot-v2',reasons:[]};
const CAPABILITY={version:1,completed:true,chairRise:'independent_controlled',wallPushup:'controlled',wallHinge:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable'};

function clear(){for(const file of dependencyPaths){try{delete require.cache[require.resolve(file)]}catch{}}}
function memoryStorage(){const data=new Map(),calls=[];return{calls,getItem(key){calls.push(['getItem',key]);return data.has(key)?data.get(key):null},setItem(key,value){calls.push(['setItem',key]);data.set(key,String(value))},removeItem(key){calls.push(['removeItem',key]);data.delete(key)},raw(key){return data.get(key)}}}
function fixture(){
  clear();
  const moduleApi=require(storePath),storage=memoryStorage(),store=moduleApi.createLocalStore({storage,now:()=> '2030-01-02T03:04:05.000Z'});
  store.saveIntake(structuredClone(INTAKE),structuredClone(RISK));
  store.saveCapabilityProfile(structuredClone(CAPABILITY));
  const generator=require(generatorPath),catalog=require(catalogPath);
  const plan=generator.generatePlan({intake:structuredClone(INTAKE),risk:structuredClone(RISK),intakeRevision:1,catalog:catalog.exerciseCatalog,...capabilityInput(1)});
  store.savePlan(plan);
  store.approvePlanReview({reviewerId:'pilot-reviewer',planId:plan.id,intakeRevision:1});
  const source=plan.weeks[0].sessions.find(session=>session.intent==='low_impact_cardio')||plan.weeks[0].sessions[0];
  return{moduleApi,storage,store,plan,source};
}
function storageError(invoke){assert.throws(invoke,error=>error&&error.name==='StorageError')}
function mutateStored(f,mutate){const raw=JSON.parse(f.storage.raw(f.moduleApi.STORAGE_KEY));mutate(raw);f.storage.setItem(f.moduleApi.STORAGE_KEY,JSON.stringify(raw))}
function weeklyReview(overrides={}){return{reviewVersion:1,weekNumber:1,completedSessions:0,completionReason:'time',difficulty:'suitable',movementQuality:'stable',painStatus:'none',painAreas:[],painAffectsDailyActivity:false,recovery:'good',nextWeekTime:'same',...overrides}}

 test('可信预览只接受sessionId，从存储派生同周窗口且完全只读',()=>{
  const f=fixture(),before=f.storage.raw(f.moduleApi.STORAGE_KEY),writes=f.storage.calls.filter(call=>call[0]==='setItem').length;
  const result=f.store.previewScheduleShift({sessionId:f.source.id});
  assert.equal(result.status,'available',JSON.stringify(result));
  assert.equal(result.suggestion.planId,f.plan.id);assert.equal(result.suggestion.sessionId,f.source.id);
  assert.equal(result.suggestion.from.weekNumber,1);assert.equal(result.suggestion.to.weekNumber,1);assert.equal(result.suggestion.displayOnly,true);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.suggestion)&&Object.isFrozen(result.suggestion.to));
  assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before);
  assert.equal(f.storage.calls.filter(call=>call[0]==='setItem').length,writes);
  assert.equal(typeof f.moduleApi.previewScheduleShift,'function');
});

test('请求是纯own-data exact {sessionId}，多字段、getter和Proxy均fail closed且不执行值读取',()=>{
  const f=fixture(),before=f.storage.raw(f.moduleApi.STORAGE_KEY);let reads=0,gets=0;
  const accessor={};Object.defineProperty(accessor,'sessionId',{enumerable:true,get(){reads+=1;return f.source.id}});
  const proxy=new Proxy({sessionId:f.source.id},{get(target,key,receiver){gets+=1;return Reflect.get(target,key,receiver)}});
  for(const request of [{sessionId:f.source.id,planId:f.plan.id},{sessionId:f.source.id,revision:1},{sessionId:f.source.id,window:2},accessor,proxy]){
    assert.throws(()=>f.store.previewScheduleShift(request),TypeError);
    assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before);
  }
  assert.equal(reads,0);assert.equal(gets,0);
});

test('完成日志只从当前计划canonical completed记录派生，完成session返回固定unavailable且不落盘',()=>{
  const f=fixture();
  mutateStored(f,raw=>{raw.logs['old-plan.old-session']={planId:'old-plan',sessionId:'old-session',status:'completed',completedAt:'2030-01-01T00:00:00.000Z'};raw.logs[`safety.other.${f.source.id}`]={planId:'other',sessionId:f.source.id,status:'safety_stopped',reasonCode:'sudden_severe_pain',actionIndex:0,occurredAt:'2030-01-01T00:00:00.000Z'}});
  const beforeOld=f.storage.raw(f.moduleApi.STORAGE_KEY),available=f.store.previewScheduleShift({sessionId:f.source.id});
  assert.equal(available.status,'available');assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),beforeOld);
  f.store.recordWorkoutCompletion({planId:f.plan.id,sessionId:f.source.id});
  const before=f.storage.raw(f.moduleApi.STORAGE_KEY),result=f.store.previewScheduleShift({sessionId:f.source.id});
  assert.deepEqual(result,{status:'unavailable',code:'SESSION_ALREADY_COMPLETED',suggestion:null});
  assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before);
});

test('stale、pain、safety、pending与任一revision/review绑定错误固定StorageError',()=>{
  const mutations=[
    raw=>{raw.plan.status='stale';raw.plan.staleReason='intake_changed';raw.plan.staleAt='2030-01-02T03:05:00.000Z'},
    raw=>{raw.plan.status='pending_review';raw.plan.review=null},
    raw=>{raw.plan.intakeRevision=2},
    raw=>{raw.plan.capabilityRevision=2},
    raw=>{raw.plan.review.intakeRevision=2},
    raw=>{raw.plan.review.capabilityRevision=2}
  ];
  for(const mutate of mutations){const f=fixture();mutateStored(f,mutate);const before=f.storage.raw(f.moduleApi.STORAGE_KEY);storageError(()=>f.store.previewScheduleShift({sessionId:f.source.id}));assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before)}
  const pain=fixture();pain.store.recordWorkoutCompletion({planId:pain.plan.id,sessionId:pain.source.id});pain.store.recordWorkoutFeedback({sessionId:pain.source.id,feedbackCode:'pain'});const painBefore=pain.storage.raw(pain.moduleApi.STORAGE_KEY);storageError(()=>pain.store.previewScheduleShift({sessionId:pain.source.id}));assert.equal(pain.storage.raw(pain.moduleApi.STORAGE_KEY),painBefore);
  const safety=fixture(),safetyBeforeSession=safety.plan.weeks[0].sessions[0];safety.store.recordWorkoutStop({sessionId:safetyBeforeSession.id,reasonCode:'sudden_severe_pain',actionIndex:0,occurredAt:'2030-01-02T03:05:00.000Z'});const safetyBefore=safety.storage.raw(safety.moduleApi.STORAGE_KEY);storageError(()=>safety.store.previewScheduleShift({sessionId:safetyBeforeSession.id}));assert.equal(safety.storage.raw(safety.moduleApi.STORAGE_KEY),safetyBefore);
  const pending=fixture();pending.store.recordWeeklyReview(weeklyReview());const pendingBefore=pending.storage.raw(pending.moduleApi.STORAGE_KEY);storageError(()=>pending.store.previewScheduleShift({sessionId:pending.source.id}));assert.equal(pending.storage.raw(pending.moduleApi.STORAGE_KEY),pendingBefore);
});

test('损坏accepted lineage不能隐藏真实祖先计划的pending review',()=>{
  const f=fixture(),ancestorPlanId=f.plan.id;
  const proposed=f.store.recordWeeklyReview(weeklyReview({difficulty:'too_hard',completionReason:'difficulty'}));
  const accepted=f.store.resolveWeeklyReview({reviewId:proposed.weeklyReviews[0].id,decision:'accepted'});
  const approved=f.store.approvePlanReview({reviewerId:'pilot-reviewer',planId:accepted.plan.id,intakeRevision:1});
  const source=approved.plan.weeks[0].sessions.find(session=>session.intent==='low_impact_cardio')||approved.plan.weeks[0].sessions[0];
  mutateStored(f,raw=>{
    const edge=raw.weeklyReviews.find(record=>record.decision==='accepted'&&record.planId===ancestorPlanId);
    raw.weeklyReviews.push({...structuredClone(edge),id:'weekly.disconnected',planId:'detached',resultPlanId:'detached-w1-a'});
    raw.weeklyReviews.push({...structuredClone(edge),id:'weekly.ancestor-pending',resultPlanId:null,decision:'pending',decidedAt:null});
  });
  const before=f.storage.raw(f.moduleApi.STORAGE_KEY),writes=f.storage.calls.filter(call=>call[0]==='setItem').length;
  storageError(()=>f.store.previewScheduleShift({sessionId:source.id}));
  storageError(()=>f.store.recordWeeklyReview(weeklyReview({weekNumber:1})));
  assert.equal(f.storage.calls.filter(call=>call[0]==='setItem').length,writes);
  assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before);
});

test('损坏accepted lineage阻止当前pending resolve且保持零写入',()=>{
  const f=fixture(),pending=f.store.recordWeeklyReview(weeklyReview()),record=pending.weeklyReviews[0];
  mutateStored(f,raw=>raw.weeklyReviews.push({...structuredClone(record),id:'weekly.disconnected-resolve',planId:'detached',resultPlanId:'detached-w1-a',decision:'accepted',decidedAt:'2030-01-02T03:04:05.000Z'}));
  const before=f.storage.raw(f.moduleApi.STORAGE_KEY),writes=f.storage.calls.filter(call=>call[0]==='setItem').length;
  storageError(()=>f.store.resolveWeeklyReview({reviewId:record.id,decision:'rejected'}));
  assert.equal(f.storage.calls.filter(call=>call[0]==='setItem').length,writes);
  assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before);
});

test('声称绑定当前session的畸形或非canonical完成记录固定fail closed',()=>{
  for(const mutate of [
    (raw,f)=>{raw.logs[`${f.plan.id}.${f.source.id}`]={planId:f.plan.id,sessionId:f.source.id,completedAt:'2030-01-01T00:00:00.000Z'}},
    (raw,f)=>{raw.logs[`${f.plan.id}.${f.source.id}`]={planId:f.plan.id,sessionId:f.source.id,status:'started',completedAt:'2030-01-01T00:00:00.000Z'}},
    (raw,f)=>{raw.logs[`${f.plan.id}.${f.source.id}`]={planId:'wrong-plan',sessionId:f.source.id,status:'completed',completedAt:'2030-01-01T00:00:00.000Z'}},
    (raw,f)=>{raw.logs[`${f.plan.id}.${f.source.id}`]={planId:f.plan.id,sessionId:'wrong-session',status:'completed',completedAt:'2030-01-01T00:00:00.000Z'}},
    (raw,f)=>{raw.logs[`${f.plan.id}.${f.source.id}`]='corrupt'},
    (raw,f)=>{raw.logs[`${f.plan.id}.${f.source.id}`]={planId:f.plan.id,sessionId:f.source.id,status:'completed',completedAt:'not-iso'}},
    (raw,f)=>{raw.logs.forged={planId:f.plan.id,sessionId:f.source.id,status:'completed',completedAt:'2030-01-01T00:00:00.000Z'}},
    (raw,f)=>{raw.logs=[{planId:f.plan.id,sessionId:f.source.id,status:'completed',completedAt:'2030-01-01T00:00:00.000Z'}]}
  ]){
    const f=fixture();mutateStored(f,raw=>mutate(raw,f));const before=f.storage.raw(f.moduleApi.STORAGE_KEY);
    storageError(()=>f.store.previewScheduleShift({sessionId:f.source.id}));
    assert.equal(f.storage.raw(f.moduleApi.STORAGE_KEY),before);
  }
});

test('第4周只在同周预览，绝不返回第5周',()=>{
  const f=fixture(),source=f.plan.weeks[3].sessions.at(-1),result=f.store.previewScheduleShift({sessionId:source.id});
  assert.equal(JSON.stringify(result).includes('"weekNumber":5'),false);
  if(result.status==='available')assert.equal(result.suggestion.to.weekNumber,4);
  else assert.ok(['NO_SAFE_SHIFT_DAY','CYCLE_COMPLETE'].includes(result.code));
});

test('local-store加载后篡改domain/public API不能绕过捕获的可信函数',()=>{
  const f=fixture(),domain=require(shiftPath),original=require.cache[require.resolve(shiftPath)].exports;
  require.cache[require.resolve(shiftPath)].exports={suggestScheduleShift(){return{status:'available',code:'FORGED',suggestion:{planId:'forged'}}}};
  try{
    const result=f.store.previewScheduleShift({sessionId:f.source.id});
    assert.equal(result.code,'SCHEDULE_SHIFT_AVAILABLE');assert.equal(result.suggestion.planId,f.plan.id);
    assert.notStrictEqual(require(shiftPath),domain);
  }finally{require.cache[require.resolve(shiftPath)].exports=original}
});

test('lineage安全门不执行模块加载后替换的iterator、Set或Map intrinsic',()=>{
  const targets=[
    [Array.prototype,Symbol.iterator],
    [globalThis,'Set'],[globalThis,'Map'],
    [Set.prototype,'has'],[Set.prototype,'add'],
    [Map.prototype,'has'],[Map.prototype,'get'],[Map.prototype,'set']
  ];
  for(let index=0;index<targets.length;index+=1){
    const f=fixture(),raw=f.storage.raw(f.moduleApi.STORAGE_KEY),target=targets[index][0],key=targets[index][1];
    const store=f.moduleApi.createLocalStore({storage:{getItem(){return raw},setItem(){throw new Error('WRITE')},removeItem(){}}});
    const descriptor=Object.getOwnPropertyDescriptor(target,key);let calls=0,result,error;
    Object.defineProperty(target,key,{...descriptor,value:function(){calls+=1;throw new Error('INTRINSIC_EXECUTED')}});
    try{result=store.previewScheduleShift({sessionId:f.source.id})}catch(caught){error=caught}finally{Object.defineProperty(target,key,descriptor)}
    assert.equal(calls,0,String(key));
    if(error)assert.equal(error.name,'StorageError',String(key));
    else assert.equal(result.status,'available',String(key));
  }
});

test('迁移读取不执行模块加载后替换的Array.find',()=>{
  const f=fixture(),raw=f.storage.raw(f.moduleApi.STORAGE_KEY),store=f.moduleApi.createLocalStore({storage:{getItem(){return raw},setItem(){throw new Error('WRITE')},removeItem(){}}});
  const descriptor=Object.getOwnPropertyDescriptor(Array.prototype,'find');let calls=0,state;
  Object.defineProperty(Array.prototype,'find',{...descriptor,value:function(){calls+=1;throw new Error('POISON_FIND')}});
  try{state=store.loadState()}finally{Object.defineProperty(Array.prototype,'find',descriptor)}
  assert.equal(calls,0);assert.equal(state.plan.id,f.plan.id);
});

test('strict load损坏或非字符串状态固定StorageError、零写入',()=>{
  clear();const moduleApi=require(storePath);
  for(const storage of [
    {calls:[],getItem(){return '{bad'},setItem(){this.calls.push('setItem')},removeItem(){}},
    {calls:[],getItem(){return {schemaVersion:1}},setItem(){this.calls.push('setItem')},removeItem(){}},
    {calls:[],getItem(){throw new Error('blocked')},setItem(){this.calls.push('setItem')},removeItem(){}}
  ]){
    const store=moduleApi.createLocalStore({storage});
    storageError(()=>store.previewScheduleShift({sessionId:'w1-s1'}));
    assert.deepEqual(storage.calls,[]);
  }
});

test('Classic script与CommonJS都接线previewScheduleShift并在加载时捕获domain函数',()=>{
  const f=fixture(),state=f.store.loadState();
  const shiftSource=fs.readFileSync(shiftPath,'utf8'),storeSource=fs.readFileSync(storePath,'utf8');
  const context=vm.createContext({raw:f.storage.raw(f.moduleApi.STORAGE_KEY)});
  vm.runInContext('structuredClone=value=>JSON.parse(JSON.stringify(value))',context);
  vm.runInContext(shiftSource,context);
  context.Move28.data={exerciseCatalog:[]};
  context.Move28.domain.validatePlan=()=>({ok:true,errors:[]});
  context.Move28.domain.deriveRiskIntake=()=>({});
  context.Move28.domain.evaluateRisk=()=>structuredClone(state.risk);
  context.Move28.domain.evaluateCapabilityProfile=()=>structuredClone(state.capabilityResult);
  vm.runInContext(storeSource,context);
  assert.equal(typeof context.Move28.storage.previewScheduleShift,'function');
  assert.equal(typeof context.Move28.storage.createLocalStore({storage:{getItem:()=>null,setItem(){},removeItem(){}}}).previewScheduleShift,'function');
  vm.runInContext('Move28.domain.suggestScheduleShift=()=>({status:"available",code:"FORGED",suggestion:{planId:"forged"}})',context);
  const result=vm.runInContext(`(()=>{const storage={getItem:()=>raw,setItem(){throw new Error('WRITE')},removeItem(){}};return Move28.storage.createLocalStore({storage}).previewScheduleShift({sessionId:${JSON.stringify(f.source.id)}})})()`,context);
  assert.equal(result.code,'SCHEDULE_SHIFT_AVAILABLE');assert.equal(result.suggestion.planId,f.plan.id);
});
