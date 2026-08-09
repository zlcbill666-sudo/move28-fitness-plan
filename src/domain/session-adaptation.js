(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){Move28.domain=Move28.domain||{};Move28.data=Move28.data||{};Object.assign(Move28.domain,require('./capability-engine.js'),require('./movement-matcher.js'),require('./plan-validator.js'),require('./daily-execution-validator.js'));Object.assign(Move28.data,require('../data/exercise-catalog.js'))}
const api=factory(root,Move28);Move28.domain=Move28.domain||{};Object.assign(Move28.domain,api);if(isCommonJS)module.exports=api;
})(globalThis,function(root,Move28){
'use strict';
const {isArray:safeArrayIsArray}=Array;
const {getPrototypeOf:safeGetPrototypeOf,getOwnPropertyDescriptor:safeGetOwnPropertyDescriptor,getOwnPropertyDescriptors:safeGetOwnPropertyDescriptors,keys:safeObjectKeys,freeze:safeFreeze,is:safeObjectIs}=Object;
const {ownKeys:safeOwnKeys}=Reflect;
const {isFinite:safeNumberIsFinite,isSafeInteger:safeNumberIsSafeInteger}=Number;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const safeWeakSetHas=Function.prototype.call.bind(WeakSet.prototype.has);
const safeWeakSetAdd=Function.prototype.call.bind(WeakSet.prototype.add);
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const trustedMatch=typeof Move28.domain.matchExercise==='function'?Move28.domain.matchExercise:null;
const trustedValidatePlan=typeof Move28.domain.validatePlan==='function'?Move28.domain.validatePlan:null;
const trustedValidateExecution=typeof Move28.domain.validateDailyExecution==='function'?Move28.domain.validateDailyExecution:null;
const trustedEvaluateCapability=typeof Move28.domain.evaluateCapabilityProfile==='function'?Move28.domain.evaluateCapabilityProfile:null;
const trustedCatalog=safeArrayIsArray(Move28.data.exerciseCatalog)?Move28.data.exerciseCatalog:null;
const trustedEquipmentIds=safeArrayIsArray(Move28.data.EQUIPMENT_IDS)?safeFreeze([...Move28.data.EQUIPMENT_IDS]):null;
const trustedPolicyVersion=Move28.domain.POLICY_VERSION==='daily-execution.v1'?Move28.domain.POLICY_VERSION:null;
const safeArrayIncludes=Function.prototype.call.bind(Array.prototype.includes);
const INPUT_FIELDS=safeFreeze(['plan','sessionId','intake','intakeRevision','risk','capabilityProfile','capabilityRevision','readiness','equipmentSnapshot']);
const BODYWEIGHT_EQUIPMENT=safeFreeze(['stable_chair','exercise_mat','wall','flat_walking_route']);
const DANGEROUS_KEYS=new Set(['__proto__','prototype','constructor']);
const functionToString=Function.prototype.toString,nativeObjectSource=functionToString.call(Object);
function plainRecord(value){if(!value||typeof value!=='object'||safeArrayIsArray(value))return false;const proto=safeGetPrototypeOf(value);if(proto===null)return true;if(safeGetPrototypeOf(proto)!==null)return false;const descriptor=safeGetOwnPropertyDescriptor(proto,'constructor');return Boolean(descriptor&&safeHasOwn(descriptor,'value')&&typeof descriptor.value==='function'&&functionToString.call(descriptor.value)===nativeObjectSource)}
function clonePureData(value){if(!nativeStructuredClone)return null;try{const stack=[{value,depth:0}],seen=new WeakSet();let nodes=0;while(stack.length){const {value:current,depth}=stack.pop();if(current===null||typeof current==='string'||typeof current==='boolean')continue;if(typeof current==='number'){if(!safeNumberIsFinite(current)||safeObjectIs(current,-0))return null;continue}if(!current||typeof current!=='object'||safeWeakSetHas(seen,current)||depth>40)return null;safeWeakSetAdd(seen,current);if(++nodes>20000)return null;const array=safeArrayIsArray(current);if(!array&&!plainRecord(current))return null;const descriptors=safeGetOwnPropertyDescriptors(current),keys=safeOwnKeys(descriptors);if(keys.some(key=>typeof key!=='string'||safeSetHas(DANGEROUS_KEYS,key)))return null;if(array){const length=descriptors.length;if(!length||!safeHasOwn(length,'value')||!safeNumberIsSafeInteger(length.value)||length.value<0||length.value>512||keys.length!==length.value+1)return null;for(let index=0;index<length.value;index+=1)if(!safeHasOwn(descriptors,String(index)))return null}for(const key of keys){if(array&&key==='length')continue;const descriptor=descriptors[key];if(!descriptor||!safeHasOwn(descriptor,'value'))return null;stack.push({value:descriptor.value,depth:depth+1})}}return nativeStructuredClone(value)}catch(_error){return null}}
function deepFreeze(value,seen=new WeakSet()){if(!value||typeof value!=='object'||safeWeakSetHas(seen,value))return value;safeWeakSetAdd(seen,value);for(const key of safeObjectKeys(value))deepFreeze(value[key],seen);return safeFreeze(value)}
function unavailable(code='INVALID_ADAPTATION_INPUT'){return deepFreeze({status:'unavailable',code,manifest:null})}
function exactKeys(value,fields){if(!plainRecord(value))return false;const keys=safeObjectKeys(value);return keys.length===fields.length&&keys.every(key=>fields.includes(key))}
function denseStrings(value,{max=32}={}){return safeArrayIsArray(value)&&value.length<=max&&value.every((item,index)=>safeHasOwn(value,index)&&typeof item==='string'&&item.length>0&&item.length<=100)&&safeOwnKeys(value).length===value.length+1&&new Set(value).size===value.length}
function canonicalEquipment(value){const result=[];for(const id of trustedEquipmentIds||[])if(safeArrayIncludes(value,id))result.push(id);return result}
function sameStrings(left,right){return safeArrayIsArray(left)&&safeArrayIsArray(right)&&left.length===right.length&&left.every((value,index)=>value===right[index])}
function validApproval(plan){const review=plan.review;return Boolean(review&&review.status==='approved'&&typeof review.reviewerId==='string'&&/^[a-z][a-z0-9._-]{0,63}$/.test(review.reviewerId)&&review.planId===plan.id&&review.intakeRevision===plan.intakeRevision&&review.capabilityRevision===plan.capabilityRevision&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewedAt))}
function validationPlan(plan){const candidate=clonePureData(plan);if(!candidate)return null;delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated';return candidate}
function planValid(plan,input){const candidate=validationPlan(plan);if(!candidate||!trustedValidatePlan||!trustedCatalog)return false;try{const checked=clonePureData(trustedValidatePlan({plan:candidate,intake:{sessionMinutes:String(input.intake.sessionMinutes),avoidMovements:safeArrayIsArray(input.intake.avoidMovements)?input.intake.avoidMovements:[],avoidEquipment:safeArrayIsArray(input.intake.avoidEquipment)?input.intake.avoidEquipment:[],weekdays:safeArrayIsArray(input.intake.weekdays)?input.intake.weekdays:[]},risk:{level:input.risk.level,ruleVersion:input.risk.ruleVersion},capabilityResult:input.capabilityResult,capabilityRevision:input.capabilityRevision,catalog:trustedCatalog}));return Boolean(checked&&checked.ok===true&&safeArrayIsArray(checked.errors)&&checked.errors.length===0)}catch(_error){return false}}
function findSession(plan,id){let found=null;for(const week of plan.weeks||[])for(const session of week.sessions||[])if(session&&session.id===id){if(found)return null;found=session}return found}
function variantFor(action){if(action.pattern==='knee_dominant')return action.exerciseId==='high-seat-sit-to-stand'?'high_seat':'standard';if(action.pattern==='horizontal_push')return action.exerciseId==='wall-push-up'?'close_wall':'standard';return null}
function readinessValid(value){return exactKeys(value,['version','route','reasonCodes'])&&value.version==='session-readiness.v1'&&value.route==='adapt_candidate'&&safeArrayIsArray(value.reasonCodes)&&value.reasonCodes.length===1&&value.reasonCodes[0]==='equipment_bodyweight_only'&&safeOwnKeys(value.reasonCodes).length===2}
function buildSession(source,input){
  const actions=[],diffs=[],exclusions=[...(safeArrayIsArray(input.intake.avoidMovements)?input.intake.avoidMovements:[]),...(safeArrayIsArray(source.exclusions)?source.exclusions:[]),...(safeArrayIsArray(input.capabilityResult.exclusions)?input.capabilityResult.exclusions:[])];
  for(let index=0;index<source.actions.length;index+=1){const before=source.actions[index];const match=trustedMatch({pattern:before.pattern,setting:source.setting,equipment:input.equipmentSnapshot,exclusions:[...new Set(exclusions)],difficultyCap:input.capabilityResult.difficultyCap,catalog:trustedCatalog});if(!match||match.ok!==true)return null;const after=clonePureData(before);if(!after)return null;after.exerciseId=match.exerciseId;delete after.variant;const variant=variantFor(after);if(variant!==null)after.variant=variant;actions.push(after);diffs.push({actionIndex:index,pattern:before.pattern,fromExerciseId:before.exerciseId,toExerciseId:after.exerciseId,fromVariant:safeHasOwn(before,'variant')?before.variant:null,toVariant:variant})}
  const session=clonePureData(source);if(!session)return null;session.equipmentBySetting[source.setting]=clonePureData(input.equipmentSnapshot);session.actions=actions;return{session,diffs};
}
function proposeSessionAdaptation(raw){
  const input=clonePureData(raw);if(!input||!exactKeys(input,INPUT_FIELDS)||typeof input.sessionId!=='string'||!readinessValid(input.readiness)||!denseStrings(input.equipmentSnapshot)||!trustedCatalog||!trustedEquipmentIds||!trustedPolicyVersion||input.equipmentSnapshot.some(id=>!safeArrayIncludes(trustedEquipmentIds,id)||!safeArrayIncludes(BODYWEIGHT_EQUIPMENT,id)))return unavailable();input.equipmentSnapshot=canonicalEquipment(input.equipmentSnapshot);
  const capabilityResult=trustedEvaluateCapability?clonePureData(trustedEvaluateCapability(input.capabilityProfile)):null;if(!capabilityResult||!['normal','conservative'].includes(capabilityResult.status))return unavailable('CAPABILITY_CONTEXT_INVALID');input.capabilityResult=capabilityResult;
  const plan=input.plan;if(!plainRecord(plan)||plan.status!=='active'||safeHasOwn(plan,'staleReason')||safeHasOwn(plan,'staleAt')||!validApproval(plan)||!plainRecord(input.intake)||!plainRecord(input.risk)||!plainRecord(input.capabilityResult)||!safeNumberIsSafeInteger(input.intakeRevision)||input.intakeRevision<1||input.intakeRevision!==plan.intakeRevision||input.capabilityRevision!==plan.capabilityRevision)return unavailable('PLAN_NOT_ACTIVE');
  const avoidedEquipment=input.intake.avoidEquipment;if(!denseStrings(avoidedEquipment)||avoidedEquipment.some(id=>!safeArrayIncludes(trustedEquipmentIds,id))||input.equipmentSnapshot.some(id=>safeArrayIncludes(avoidedEquipment,id)))return unavailable('EQUIPMENT_CONTEXT_INVALID');
  if(!planValid(plan,input))return unavailable('PLAN_VALIDATION_FAILED');const source=findSession(plan,input.sessionId);if(!source||!safeArrayIsArray(source.actions)||source.actions.length===0||!trustedMatch||!trustedValidateExecution)return unavailable('SOURCE_SESSION_INVALID');
  const sourceEquipment=source.equipmentBySetting&&source.equipmentBySetting[source.setting];if(denseStrings(sourceEquipment)&&sameStrings(canonicalEquipment(sourceEquipment),input.equipmentSnapshot))return unavailable('NO_ADAPTATION_CHANGE');
  const built=buildSession(source,input);if(!built)return unavailable('NO_SAFE_SESSION_ADAPTATION');if(!built.diffs.some(diff=>diff.fromExerciseId!==diff.toExerciseId||diff.fromVariant!==diff.toVariant))return unavailable('NO_ADAPTATION_CHANGE');
  const equipmentSnapshot={setting:source.setting,equipment:clonePureData(input.equipmentSnapshot)};
  const manifest={schemaVersion:1,policyVersion:trustedPolicyVersion,adaptationId:`daily.${plan.id}.${source.id}.${source.setting}.${input.equipmentSnapshot.join('.')}`,approvalStatus:'pending',changeType:'equipment',reasonCode:'equipment_bodyweight_only',sourcePlanId:plan.id,sourceSessionId:source.id,intakeRevision:plan.intakeRevision,capabilityRevision:plan.capabilityRevision,planVersion:plan.planVersion,ruleVersion:plan.ruleVersion,equipmentSnapshot,executionSession:built.session,actionDiffs:built.diffs};
  const checked=clonePureData(trustedValidateExecution({plan,intake:input.intake,intakeRevision:input.intakeRevision,risk:input.risk,capabilityProfile:input.capabilityProfile,capabilityRevision:input.capabilityRevision,manifest}));
  if(!checked||checked.ok!==true||!safeArrayIsArray(checked.errors)||checked.errors.length!==0)return unavailable('EXECUTION_VALIDATION_FAILED');
  return deepFreeze({status:'candidate',code:'ADAPTATION_CANDIDATE_READY',manifest});
}
return safeFreeze({proposeSessionAdaptation});
});
