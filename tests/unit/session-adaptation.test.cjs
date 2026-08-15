'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const {projectRoot,clearMove28ModuleCache,loadScript}=require('../helpers/load-script.cjs');
const {capabilityInput}=require('../helpers/capability-fixture.cjs');

const intake={age:30,finalConfirmed:true,daysPerWeek:'3',sessionMinutes:'30',weekdays:['mon','wed','fri'],setting:'gym',equipment:['stable_chair','exercise_mat','smith_machine','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','wall','elliptical_trainer','treadmill'],avoidMovements:[],avoidEquipment:[],cardioPreference:'none',cardioAvoid:'none',strengthExperience:'some',trainingBreak:'no'};
const risk={level:'normal',ruleVersion:'pilot-v2',reasons:[]};
const readiness=Object.freeze({version:'session-readiness.v1',route:'adapt_candidate',reasonCodes:Object.freeze(['equipment_bodyweight_only'])});
const capabilityProfile=Object.freeze({version:1,completed:true,chairRise:'independent_controlled',wallPushup:'controlled',wallHinge:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable'});
const bodyweightEquipment=['stable_chair','exercise_mat','wall','flat_walking_route'];

function apis(){
  clearMove28ModuleCache();
  for(const file of ['daily-execution-validator.js','session-adaptation.js','plan-generator.js'])delete require.cache[path.join(projectRoot,'src','domain',file)];
  return{
    generator:require('../../src/domain/plan-generator.js'),
    adaptation:require('../../src/domain/session-adaptation.js'),
    validator:require('../../src/domain/daily-execution-validator.js'),
    capability:require('../../src/domain/capability-engine.js')
  };
}
function activePlan(generator,planIntake=intake,capability=capabilityInput(3)){
  const generated=generator.generatePlan({intake:planIntake,risk,intakeRevision:2,...capability});
  assert.equal(generated.status,'generated',JSON.stringify(generated));
  const plan=structuredClone(generated);plan.status='active';plan.review={status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:plan.id,intakeRevision:2,capabilityRevision:3};return plan;
}
function inputFor(api,overrides={}){
  const plan=overrides.plan||activePlan(api.generator);
  const session=plan.weeks[0].sessions.find(item=>item.intent==='low_impact_cardio');
  return{plan,sessionId:session.id,intake,intakeRevision:2,risk,capabilityProfile,capabilityRevision:3,readiness,equipmentSnapshot:bodyweightEquipment,...overrides};
}
function propose(api,input){return api.adaptation.proposeSessionAdaptation(input)}

 test('器械变化生成可审计DailyExecutionManifest且源四周计划字节不变',()=>{
  const api=apis(),input=inputFor(api),before=JSON.stringify(input.plan),source=input.plan.weeks[0].sessions.find(item=>item.id===input.sessionId);
  const result=propose(api,input);
  assert.equal(result.status,'candidate',JSON.stringify(result));assert.equal(result.code,'ADAPTATION_CANDIDATE_READY');assert.ok(result.manifest);
  const manifest=result.manifest;
  assert.deepEqual(Object.keys(manifest),['schemaVersion','policyVersion','adaptationId','approvalStatus','changeType','reasonCode','sourcePlanId','sourceSessionId','intakeRevision','capabilityRevision','planVersion','ruleVersion','equipmentSnapshot','executionSession','actionDiffs']);
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.policyVersion,'daily-execution.v1');assert.equal(manifest.approvalStatus,'pending');assert.equal(manifest.changeType,'equipment');
  assert.equal(manifest.reasonCode,'equipment_bodyweight_only');assert.equal(manifest.sourcePlanId,input.plan.id);assert.equal(manifest.sourceSessionId,input.sessionId);assert.equal(manifest.intakeRevision,2);assert.equal(manifest.capabilityRevision,3);
  assert.deepEqual(manifest.equipmentSnapshot,{setting:'gym',equipment:bodyweightEquipment});
  assert.equal(manifest.executionSession.setting,source.setting);
  assert.equal(manifest.executionSession.intent,source.intent);assert.equal(manifest.executionSession.actions.length,source.actions.length);assert.equal(manifest.actionDiffs.length,source.actions.length);
  for(let index=0;index<source.actions.length;index+=1){const beforeAction=source.actions[index],after=manifest.executionSession.actions[index],diff=manifest.actionDiffs[index];assert.equal(after.pattern,beforeAction.pattern);assert.equal(after.phase,beforeAction.phase);for(const field of ['sets','reps','rpe','restSec','durationMin'])if(Object.hasOwn(beforeAction,field))assert.equal(after[field],beforeAction[field]);assert.equal(diff.actionIndex,index);assert.equal(diff.pattern,beforeAction.pattern);assert.equal(diff.fromExerciseId,beforeAction.exerciseId);assert.equal(diff.toExerciseId,after.exerciseId)}
  assert.equal(source.actions[0].exerciseId,'elliptical-trainer');assert.equal(manifest.executionSession.actions[0].exerciseId,'flat-walk');assert.ok(manifest.actionDiffs.some(diff=>diff.fromExerciseId!==diff.toExerciseId||diff.fromVariant!==diff.toVariant));
  assert.equal(JSON.stringify(input.plan),before);assert.equal(Object.hasOwn(input.plan,'dailyAdaptations'),false);assert.ok(Object.isFrozen(result)&&Object.isFrozen(manifest)&&Object.isFrozen(manifest.executionSession));
});

test('独立执行校验器接受原子候选并拒绝任意篡改',()=>{
  const api=apis(),input=inputFor(api),result=propose(api,input),context={plan:input.plan,intake,intakeRevision:2,risk,capabilityProfile,capabilityRevision:3,manifest:result.manifest};
  assert.deepEqual(api.validator.validateDailyExecution(context),{ok:true,errors:[]});
  for(const mutate of [
    value=>{value.manifest.sourcePlanId='other'},value=>{value.manifest.approvalStatus='approved'},value=>{value.manifest.changeType='dose'},
    value=>{value.manifest.executionSession.actions.pop()},value=>{value.manifest.executionSession.actions[0].reps+=1},value=>{value.manifest.executionSession.actions[0].exerciseId='unreviewed-action'},
    value=>{value.manifest.actionDiffs[0].toExerciseId='forged'},value=>{value.manifest.equipmentSnapshot.equipment=['stable_chair']},value=>{value.intakeRevision=3},value=>{value.capabilityRevision=4}
  ]){const changed=structuredClone(context);mutate(changed);const checked=api.validator.validateDailyExecution(changed);assert.equal(checked.ok,false);assert.ok(checked.errors.length>0)}
  const noChange=structuredClone(context),source=input.plan.weeks[0].sessions.find(item=>item.id===input.sessionId);noChange.manifest.executionSession.actions=structuredClone(source.actions);noChange.manifest.actionDiffs=[{actionIndex:0,pattern:source.actions[0].pattern,fromExerciseId:source.actions[0].exerciseId,toExerciseId:source.actions[0].exerciseId,fromVariant:null,toVariant:null}];
  assert.deepEqual(api.validator.validateDailyExecution(noChange),{ok:false,errors:[{code:'NO_ADAPTATION_CHANGE',path:'manifest.actionDiffs'}]});
});

test('只有active且批准并通过完整计划硬门的精确session可进入适配',()=>{
  const api=apis(),base=inputFor(api);
  for(const mutate of [
    value=>{value.plan.status='pending_review'},value=>{value.plan.status='stale';value.plan.staleReason='x'},value=>{value.plan.review.status='pending'},
    value=>{value.plan.review.planId='other'},value=>{value.plan.review.capabilityRevision=2},value=>{value.plan.weeks[0].sessions[0].actions[0].reps=999},
    value=>{value.sessionId='missing'},value=>{value.intakeRevision=3},value=>{value.capabilityRevision=2}
  ]){const changed=structuredClone(base);mutate(changed);const result=propose(api,changed);assert.equal(result.status,'unavailable');assert.equal(result.manifest,null)}
});

test('器械不足时全节原子失败，不返回部分动作候选',()=>{
  const api=apis(),base=inputFor(api),strength=base.plan.weeks[0].sessions.find(item=>item.intent==='full_body_strength'),result=propose(api,{...base,sessionId:strength.id});
  assert.equal(result.status,'unavailable');assert.equal(result.code,'NO_SAFE_SESSION_ADAPTATION');assert.equal(result.manifest,null);
});

test('bodyweight-only语义与当前能力档案都由可信边界约束',()=>{
  const api=apis(),base=inputFor(api);
  assert.equal(propose(api,{...base,equipmentSnapshot:['resistance_band','wall']}).status,'unavailable');
  assert.equal(propose(api,{...base,capabilityResult:capabilityInput(3).capabilityResult}).status,'unavailable');
  const warning={...capabilityProfile,walkTolerance:'warning_symptom'};
  assert.deepEqual(propose(api,{...base,capabilityProfile:warning}),{status:'unavailable',code:'CAPABILITY_CONTEXT_INVALID',manifest:null});
});

test('保守能力档案不能被bodyweight适配升级，完整力量课无水平拉替代时原子失败',()=>{
  const api=apis(),profile={...capabilityProfile,chairRise:'hands_supported',wallPushup:'limited_range'},capabilityResult=api.capability.evaluateCapabilityProfile(profile),generated=api.generator.generatePlan({intake,risk,intakeRevision:2,capabilityResult,capabilityRevision:3}),plan=structuredClone(generated);
  assert.equal(generated.status,'generated',JSON.stringify(generated));plan.status='active';plan.review={status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:plan.id,intakeRevision:2,capabilityRevision:3};const session=plan.weeks[0].sessions.find(item=>item.intent==='full_body_strength');
  assert.deepEqual(propose(api,inputFor(api,{plan,sessionId:session.id,capabilityProfile:profile})),{status:'unavailable',code:'NO_SAFE_SESSION_ADAPTATION',manifest:null});
});

test('当前intake回避器械优先，生成器与独立校验器都不得重新引入',()=>{
  const api=apis(),avoiding={...intake,avoidEquipment:['wall']},plan=activePlan(api.generator,avoiding),base=inputFor(api,{plan,intake:avoiding});
  assert.deepEqual(propose(api,base),{status:'unavailable',code:'EQUIPMENT_CONTEXT_INVALID',manifest:null});
  const normal=inputFor(api),candidate=propose(api,normal),checked=api.validator.validateDailyExecution({plan:normal.plan,intake:avoiding,intakeRevision:2,risk,capabilityProfile,capabilityRevision:3,manifest:candidate.manifest});
  assert.deepEqual(checked,{ok:false,errors:[{code:'EQUIPMENT_SNAPSHOT_INVALID',path:'manifest.equipmentSnapshot'}]});
});

test('仅接受Task2固定适配路由、有限器械快照和唯一equipment变量',()=>{
  const api=apis(),base=inputFor(api);
  for(const mutate of [
    value=>{value.readiness.route='keep_session'},value=>{value.readiness.reasonCodes=[]},value=>{value.readiness.reasonCodes.push('free_text')},value=>{value.readiness.extra='x'},
    value=>{value.targetSetting='outdoors'},value=>{value.equipmentSnapshot=['unknown']},value=>{value.equipmentSnapshot=['wall','wall']},value=>{value.equipmentSnapshot=['resistance_band','wall']},value=>{value.time='15_min'}
  ]){const changed=structuredClone(base);mutate(changed);const result=propose(api,changed);assert.equal(result.status,'unavailable');assert.equal(result.code,'INVALID_ADAPTATION_INPUT');assert.equal(result.manifest,null)}
});

test('相同输入确定、源输入不冻结且manifest绑定稳定adaptationId',()=>{
  const api=apis(),input=inputFor(api),first=propose(api,input),second=propose(api,input);
  assert.deepEqual(first,second);assert.match(first.manifest.adaptationId,/^daily\.[a-z0-9._-]+$/);assert.equal(Object.isFrozen(input),false);assert.equal(Object.isFrozen(input.plan),false);
});

test('getter、accessor、稀疏数组、Proxy与危险键统一fail closed且不读取getter',()=>{
  const api=apis(),base=inputFor(api);let reads=0;
  const getter=structuredClone(base);Object.defineProperty(getter,'sessionId',{enumerable:true,get(){reads+=1;return base.sessionId}});
  assert.equal(propose(api,getter).status,'unavailable');assert.equal(reads,0);
  const nested=structuredClone(base);Object.defineProperty(nested.plan.weeks[0],'sessions',{enumerable:true,get(){reads+=1;return[]}});assert.equal(propose(api,nested).status,'unavailable');assert.equal(reads,0);
  const sparse=structuredClone(base);sparse.equipmentSnapshot=new Array(2);assert.equal(propose(api,sparse).status,'unavailable');
  const revoked=Proxy.revocable(base,{});revoked.revoke();assert.doesNotThrow(()=>propose(api,revoked.proxy));assert.equal(propose(api,revoked.proxy).status,'unavailable');
  const dangerous=structuredClone(base);Object.defineProperty(dangerous,'__proto__',{value:{polluted:true},enumerable:true});assert.equal(propose(api,dangerous).status,'unavailable');
});

test('伪造null-root与透明Proxy原型不能冒充纯数据边界',()=>{
  const api=apis(),base=inputFor(api);let traps=0;
  const forgedRoot=Object.create(null);Object.defineProperty(forgedRoot,'constructor',{value:Object});const forged=Object.assign(Object.create(forgedRoot),base);
  const proxyPrototype=new Proxy(Object.prototype,{getPrototypeOf(){traps+=1;return null},get(){traps+=1;return Object}}),proxied=Object.assign(Object.create(proxyPrototype),base);
  assert.deepEqual(propose(api,forged),{status:'unavailable',code:'INVALID_ADAPTATION_INPUT',manifest:null});assert.deepEqual(propose(api,proxied),{status:'unavailable',code:'INVALID_ADAPTATION_INPUT',manifest:null});
  const valid=propose(api,base),context=Object.assign(Object.create(forgedRoot),{plan:base.plan,intake,intakeRevision:2,risk,capabilityProfile,capabilityRevision:3,manifest:valid.manifest});assert.equal(api.validator.validateDailyExecution(context).ok,false);assert.equal(traps,0);
});

test('模块加载后替换依赖、器械枚举和structuredClone不改变可信结果',()=>{
  const api=apis(),input=inputFor(api),before=propose(api,input),namespace=require('../../src/namespace.js');
  const original={match:namespace.domain.matchExercise,plan:namespace.domain.validatePlan,execution:namespace.domain.validateDailyExecution,evaluate:namespace.domain.evaluateCapabilityProfile,policy:namespace.domain.POLICY_VERSION,equipment:namespace.data.EQUIPMENT_IDS,clone:globalThis.structuredClone};let calls=0;
  try{namespace.domain.matchExercise=()=>{calls+=1;throw new Error('SECRET')};namespace.domain.validatePlan=namespace.domain.matchExercise;namespace.domain.validateDailyExecution=namespace.domain.matchExercise;namespace.domain.evaluateCapabilityProfile=namespace.domain.matchExercise;namespace.domain.POLICY_VERSION='evil';namespace.data.EQUIPMENT_IDS=[];globalThis.structuredClone=namespace.domain.matchExercise;assert.deepEqual(propose(api,input),before);assert.equal(calls,0)}finally{namespace.domain.matchExercise=original.match;namespace.domain.validatePlan=original.plan;namespace.domain.validateDailyExecution=original.execution;namespace.domain.evaluateCapabilityProfile=original.evaluate;namespace.domain.POLICY_VERSION=original.policy;namespace.data.EQUIPMENT_IDS=original.equipment;globalThis.structuredClone=original.clone}
});

test('模块加载后篡改输入边界内建不能执行外部代码',()=>{
  const api=apis(),base=inputFor(api);let getterReads=0,trapCalls=0;const hostile=structuredClone(base);Object.defineProperty(hostile,'sessionId',{enumerable:true,get(){getterReads+=1;return base.sessionId}});const trap=()=>{trapCalls+=1;throw new Error('SECRET')};
  const original={arrayIsArray:Array.isArray,getPrototypeOf:Object.getPrototypeOf,getOwnPropertyDescriptor:Object.getOwnPropertyDescriptor,getOwnPropertyDescriptors:Object.getOwnPropertyDescriptors,keys:Object.keys,freeze:Object.freeze,ownKeys:Reflect.ownKeys,isFinite:Number.isFinite,isSafeInteger:Number.isSafeInteger,setHas:Set.prototype.has,weakHas:WeakSet.prototype.has,weakAdd:WeakSet.prototype.add};let adaptationResult,validatorResult;
  try{Array.isArray=trap;Object.getPrototypeOf=trap;Object.getOwnPropertyDescriptor=trap;Object.getOwnPropertyDescriptors=trap;Object.keys=trap;Object.freeze=trap;Reflect.ownKeys=trap;Number.isFinite=trap;Number.isSafeInteger=trap;Set.prototype.has=trap;WeakSet.prototype.has=trap;WeakSet.prototype.add=trap;adaptationResult=propose(api,hostile);validatorResult=api.validator.validateDailyExecution(hostile)}finally{Array.isArray=original.arrayIsArray;Object.getPrototypeOf=original.getPrototypeOf;Object.getOwnPropertyDescriptor=original.getOwnPropertyDescriptor;Object.getOwnPropertyDescriptors=original.getOwnPropertyDescriptors;Object.keys=original.keys;Object.freeze=original.freeze;Reflect.ownKeys=original.ownKeys;Number.isFinite=original.isFinite;Number.isSafeInteger=original.isSafeInteger;Set.prototype.has=original.setHas;WeakSet.prototype.has=original.weakHas;WeakSet.prototype.add=original.weakAdd}
  assert.equal(adaptationResult.status,'unavailable');assert.equal(validatorResult.ok,false);assert.equal(getterReads,0);assert.equal(trapCalls,0);
});

test('模块加载后篡改剩余数组内建与构造器时固定fail closed且不执行外部代码',()=>{
  const api=apis(),input=inputFor(api),candidate=propose(api,input),context={plan:input.plan,intake,intakeRevision:2,risk,capabilityProfile,capabilityRevision:3,manifest:candidate.manifest};
  const cases=[...['some','every','map','flat','forEach','includes','filter','find','sort','push','pop','join','indexOf'].map(key=>({get:()=>Array.prototype[key],set:value=>{Array.prototype[key]=value}})),{get:()=>Array.prototype[Symbol.iterator],set:value=>{Array.prototype[Symbol.iterator]=value}},{get:()=>String.prototype.trim,set:value=>{String.prototype.trim=value}},{get:()=>Set.prototype[Symbol.iterator],set:value=>{Set.prototype[Symbol.iterator]=value}},{get:()=>Set.prototype.has,set:value=>{Set.prototype.has=value}},{get:()=>Set.prototype.add,set:value=>{Set.prototype.add=value}},{get:()=>Set.prototype.delete,set:value=>{Set.prototype.delete=value}},{get:()=>WeakSet.prototype.has,set:value=>{WeakSet.prototype.has=value}},{get:()=>WeakSet.prototype.add,set:value=>{WeakSet.prototype.add=value}},{get:()=>WeakSet.prototype.delete,set:value=>{WeakSet.prototype.delete=value}},{get:()=>Map.prototype.has,set:value=>{Map.prototype.has=value}},{get:()=>Map.prototype.get,set:value=>{Map.prototype.get=value}},{get:()=>Map.prototype.set,set:value=>{Map.prototype.set=value}},{get:()=>Map.prototype.values,set:value=>{Map.prototype.values=value}},{get:()=>Object.getOwnPropertyDescriptor(Set.prototype,'size'),set:value=>{Object.defineProperty(Set.prototype,'size',value)},accessor:true},{get:()=>global.String,set:value=>{global.String=value}},{get:()=>global.Set,set:value=>{global.Set=value}},{get:()=>global.WeakSet,set:value=>{global.WeakSet=value}},{get:()=>global.Map,set:value=>{global.Map=value}}];
  for(const entry of cases){const original=entry.get();let calls=0,adapted,validated;const trap=function(){calls+=1;throw new Error('SECRET')};try{entry.set(entry.accessor?{...original,get:trap}:trap);adapted=propose(api,input);validated=api.validator.validateDailyExecution(context)}finally{entry.set(original)}assert.equal(adapted.status,'unavailable');assert.equal(validated.ok,false);assert.equal(calls,0)}
});

test('模块加载后篡改Set.has不能绕过有效manifest的剂量与来源保持门',()=>{
  const api=apis(),input=inputFor(api),candidate=propose(api,input),context={plan:input.plan,intake,intakeRevision:2,risk,capabilityProfile,capabilityRevision:3,manifest:structuredClone(candidate.manifest)},original=Set.prototype.has;context.manifest.executionSession.actions[0].rpe+=1;let checked;
  try{Set.prototype.has=()=>true;checked=api.validator.validateDailyExecution(context)}finally{Set.prototype.has=original}
  assert.equal(checked.ok,false);assert.ok(checked.errors.length>0);
});

test('classic script与CommonJS暴露候选和独立校验API，缺依赖时固定fail closed',()=>{
  clearMove28ModuleCache();const adaptation=loadScript('sessionAdaptation'),validator=loadScript('dailyExecutionValidator');assert.equal(typeof adaptation.proposeSessionAdaptation,'function');assert.equal(typeof validator.validateDailyExecution,'function');
  const validatorSource=fs.readFileSync(path.join(projectRoot,'src/domain/daily-execution-validator.js'),'utf8'),adaptationSource=fs.readFileSync(path.join(projectRoot,'src/domain/session-adaptation.js'),'utf8');
  const context=vm.createContext({Move28:{domain:{},data:{}},structuredClone});vm.runInContext(validatorSource,context);vm.runInContext(adaptationSource,context);
  assert.equal(context.Move28.domain.validateDailyExecution({}).ok,false);assert.equal(context.Move28.domain.proposeSessionAdaptation({}).status,'unavailable');
  const api=apis(),catalog=require('../../src/data/exercise-catalog.js'),matcher=require('../../src/domain/movement-matcher.js'),planValidator=require('../../src/domain/plan-validator.js'),bridgeEvaluate=value=>api.capability.evaluateCapabilityProfile(structuredClone(value)),bridgeMatch=value=>matcher.matchExercise(structuredClone(value)),bridgeValidate=value=>planValidator.validatePlan(structuredClone(value)),rich=vm.createContext({Move28:{domain:{},data:{exerciseCatalog:catalog.exerciseCatalog,EQUIPMENT_IDS:catalog.EQUIPMENT_IDS}},bridgeEvaluate,bridgeMatch,bridgeValidate,input:JSON.stringify(inputFor(api))});vm.runInContext("structuredClone=value=>JSON.parse(JSON.stringify(value));Move28.domain.evaluateCapabilityProfile=value=>structuredClone(bridgeEvaluate(value));Move28.domain.matchExercise=value=>structuredClone(bridgeMatch(value));Move28.domain.validatePlan=value=>structuredClone(bridgeValidate(value))",rich);vm.runInContext(validatorSource,rich);vm.runInContext(adaptationSource,rich);vm.runInContext('result=Move28.domain.proposeSessionAdaptation(JSON.parse(input))',rich);
  assert.equal(rich.result.status,'candidate');
});
