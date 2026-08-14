(function(root,factory){
'use strict';
const isCommonJS=typeof module==='object'&&module.exports;
const catalogApi=isCommonJS?require('../data/exercise-catalog.js'):root.Move28&&root.Move28.data;
const matcherApi=isCommonJS?require('./movement-matcher.js'):root.Move28&&root.Move28.domain;
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const api=factory(catalogApi||{},matcherApi||{},nativeStructuredClone);
if(isCommonJS)module.exports=api;
else{
  root.Move28=root.Move28||{};
  root.Move28.domain=Object.assign(root.Move28.domain||{},api);
}
})(globalThis,function(catalogApi,matcherApi,nativeStructuredClone){
'use strict';

const safeObjectValues=Object.values;
const safeObjectFreeze=Object.freeze;
const RULE_VERSION='pilot-v2';
const WEEKDAYS=Object.freeze(['mon','tue','wed','thu','fri','sat','sun']);
const STRENGTH_PATTERNS=Object.freeze(['knee_dominant','posterior_chain','horizontal_push','horizontal_pull','core_stability']);
const DOSE_FIELDS=Object.freeze(['sets','reps','rpe','restSec','durationMin']);
const PROGRESSION_LIMITS=Object.freeze({sets:1,reps:1,rpe:1,restSec:30,durationMin:5});
const TRUSTED_EXERCISES=new Map(Array.isArray(catalogApi.exerciseCatalog)?catalogApi.exerciseCatalog.filter(item=>item&&item.reviewStatus==='approved').map(item=>[item.id,item]):[]);
const MESSAGES=Object.freeze({
  INVALID_VALIDATOR_INPUT:'校验输入不是可安全读取的纯数据。',
  INVALID_PLAN_SCHEMA:'计划结构或必需字段无效。',
  SESSION_DURATION_EXCEEDED:'训练预计时长超过用户上限。',
  EXERCISE_NOT_APPROVED:'计划引用了未审核动作。',

  CUES_UNAVAILABLE:'动作缺少完整教学或疼痛提示。',
  DOSE_OUT_OF_RANGE:'动作剂量超出审核范围。',
  CONTRAINDICATED_EXERCISE:'计划包含已排除或禁忌动作。',
  STRENGTH_RECOVERY_CONFLICT:'相邻力量训练日缺少恢复空间。',
  MOVEMENT_PATTERN_MISMATCH:'动作实现与计划动作模式不一致。',
  CONSERVATIVE_INTENSITY_EXCEEDED:'保守路线出现过高强度或自动进阶。',
  MULTIPLE_PROGRESSIONS:'同一周同时增加了多个主要变量。',
  PROGRESSION_JUMP:'周进阶幅度超过首周期允许范围。',
  EMPTY_ACTION_QUEUE:'训练没有确定的动作队列。',
  EQUIPMENT_UNAVAILABLE:'当前场景器械不能满足动作要求。',
  SESSION_WEEKDAY_UNAVAILABLE:'训练日不在用户可用星期内。',
  CAPABILITY_REVISION_MISMATCH:'计划与当前能力版本不一致。',
  CAPABILITY_EXCLUSION_CONFLICT:'计划动作违反当前能力排除项。',
  CAPABILITY_DIFFICULTY_EXCEEDED:'计划动作超过当前能力难度上限。',
  CAPABILITY_VARIANT_MISMATCH:'计划动作变式与当前能力约束不一致。',
  CARDIO_START_EXCEEDED:'首周有氧剂量超过当前能力起始上限。',
  MEDIA_RIGHTS_BLOCKED:'动作媒体尚未获得公开发布授权。',
  MEDIA_MATCH_NOT_APPROVED:'计划包含未通过媒体语义审批的动作。',
  MEDIA_PROVENANCE_MISSING:'动作缺少可审计的媒体来源。',
  INVALID_MEDIA_SCHEMA:'动作媒体状态结构无效。'
});

function deepFreeze(value,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return value;
  seen.add(value);
  const children=safeObjectValues(value);for(let index=0;index<children.length;index+=1)deepFreeze(children[index],seen);
  return safeObjectFreeze(value);
}
function result(errors){return deepFreeze({ok:errors.length===0,errors})}
function invalid(){return result([{code:'INVALID_VALIDATOR_INPUT',path:'$',message:MESSAGES.INVALID_VALIDATOR_INPUT}])}
function plainRecord(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  if(prototype===null)return true;
  if(Object.getPrototypeOf(prototype)!==null)return false;
  const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor');
  return Boolean(constructor&&Object.prototype.hasOwnProperty.call(constructor,'value')&&typeof constructor.value==='function');
}
function safeInteger(value,{min=0,max=Number.MAX_SAFE_INTEGER}={}){return Number.isSafeInteger(value)&&value>=min&&value<=max}
function denseArray(value,{min=0,max=512}={}){
  if(!Array.isArray(value)||value.length<min||value.length>max)return false;
  for(let index=0;index<value.length;index+=1)if(!Object.prototype.hasOwnProperty.call(value,index))return false;
  return Reflect.ownKeys(value).every(key=>key==='length'||(typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)));
}
function stringArray(value,{max=64}={}){return denseArray(value,{max})&&value.every(item=>typeof item==='string'&&item.length>0&&item.length<=100)&&new Set(value).size===value.length}
function isCanonicalCloneGraph(rootValue){
  try{
    const pending=[{value:rootValue,depth:0,exit:false}];
    const active=new WeakSet();
    const complete=new WeakSet();
    let nodes=0;
    while(pending.length){
      const frame=pending.pop();
      const value=frame.value;
      if(value===null||typeof value!=='object'){
        if(typeof value==='undefined'||typeof value==='function'||typeof value==='symbol'||typeof value==='bigint')return false;
        if(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0)))return false;
        if(typeof value==='string'&&value.length>10000)return false;
        continue;
      }
      if(frame.exit){active.delete(value);complete.add(value);continue}
      if(active.has(value))return false;
      if(complete.has(value))continue;
      nodes+=1;
      if(nodes>8192||frame.depth>40)return false;
      const isArray=Array.isArray(value);
      const prototype=Object.getPrototypeOf(value);
      if(!isArray&&prototype!==null){
        if(Object.getPrototypeOf(prototype)!==null)return false;
        const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor');
        if(!constructor||!Object.prototype.hasOwnProperty.call(constructor,'value')||typeof constructor.value!=='function')return false;
      }
      const descriptors=Object.getOwnPropertyDescriptors(value);
      const keys=Reflect.ownKeys(descriptors);
      if(isArray){
        const length=descriptors.length;
        if(!length||!Object.prototype.hasOwnProperty.call(length,'value')||!safeInteger(length.value,{max:512}))return false;
        if(keys.some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key))))return false;
        for(let index=0;index<length.value;index+=1)if(!Object.prototype.hasOwnProperty.call(descriptors,String(index)))return false;
      }
      active.add(value);
      pending.push({value,depth:frame.depth,exit:true});
      for(const key of keys){
        if(isArray&&key==='length')continue;
        if(typeof key!=='string'||key==='__proto__'||key==='prototype'||key==='constructor')return false;
        const descriptor=descriptors[key];
        if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return false;
        pending.push({value:descriptor.value,depth:frame.depth+1,exit:false});
      }
    }
    return true;
  }catch(_error){return false}
}
function add(errors,code,path){errors.push({code,path,message:MESSAGES[code]||MESSAGES.INVALID_PLAN_SCHEMA})}
function inRange(value,range,{integer=false}={}){
  return denseArray(range,{min:2,max:2})&&typeof value==='number'&&Number.isFinite(value)&&(!integer||Number.isSafeInteger(value))&&value>=range[0]&&value<=range[1];
}
function completeCues(exercise){
  return plainRecord(exercise.cues)&&['setup','movement','breathing','pain'].every(key=>typeof exercise.cues[key]==='string'&&exercise.cues[key].trim().length>0);
}
function sameData(left,right){
  const pending=[[left,right]];
  while(pending.length){
    const [a,b]=pending.pop();
    if(Object.is(a,b))continue;
    if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const aKeys=Object.keys(a).sort(),bKeys=Object.keys(b).sort();
    if(aKeys.length!==bKeys.length||aKeys.some((key,index)=>key!==bKeys[index]))return false;
    for(const key of aKeys)pending.push([a[key],b[key]]);
  }
  return true;
}
function matchesTrustedExercise(exercise,trusted){
  const fields=['pattern','difficulty','reviewStatus','settings','equipment','equipmentOptions','contraindications','regressionIds','progressionIds','dose','cues','mediaLaunchStatus','mediaMatchVerdict','mediaRightsStatus','approvedDisplayName','sourceExerciseDbId','sourceExerciseDbName','mediaFailureReason'];
  return fields.every(field=>sameData(exercise[field],trusted[field]));
}
function buildCatalogIndex(catalog,errors){
  if(!denseArray(catalog,{min:1,max:256})){add(errors,'INVALID_PLAN_SCHEMA','catalog');return null}
  if(typeof catalogApi.validateExerciseCatalog==='function'){
    const catalogErrors=catalogApi.validateExerciseCatalog(catalog);
    if(!Array.isArray(catalogErrors)||catalogErrors.length>0)add(errors,'INVALID_PLAN_SCHEMA','catalog');
  }
  const index=new Map();
  for(let itemIndex=0;itemIndex<catalog.length;itemIndex+=1){
    const exercise=catalog[itemIndex];
    if(!plainRecord(exercise)||typeof exercise.id!=='string'||!exercise.id||index.has(exercise.id)||!stringArray(exercise.settings,{max:8})||!denseArray(exercise.equipmentOptions,{min:1,max:16})||!exercise.equipmentOptions.every(option=>stringArray(option,{max:16}))||!stringArray(exercise.contraindications,{max:32})||!plainRecord(exercise.dose)){
      add(errors,'INVALID_PLAN_SCHEMA',`catalog[${itemIndex}]`);
      continue;
    }
    index.set(exercise.id,exercise);
  }
  return index;
}
function validateDose(action,exercise,path,errors){
  const strength=action.phase==='main';
  const required=strength?['sets','reps','rpe','restSec']:['durationMin','rpe','restSec'];
  const forbidden=strength?['durationMin']:['sets','reps'];
  if(required.some(key=>!Object.prototype.hasOwnProperty.call(action,key))||forbidden.some(key=>Object.prototype.hasOwnProperty.call(action,key))){add(errors,'INVALID_PLAN_SCHEMA',path);return}
  for(const key of required){
    const integer=key!=='rpe';
    if(!Object.prototype.hasOwnProperty.call(exercise.dose,key)||!inRange(action[key],exercise.dose[key],{integer}))add(errors,'DOSE_OUT_OF_RANGE',`${path}.${key}`);
  }
}
function canonicalCapability(input){
  const capability=input.capabilityResult,revision=input.capabilityRevision;
  if(!safeInteger(revision,{min:1})||!plainRecord(capability))return null;
  const fields=['status','difficultyCap','exclusions','variants','cardioStartMinutes','reasonCodes'];
  const keys=Object.keys(capability);
  if(keys.length!==fields.length||keys.some(key=>!fields.includes(key)))return null;
  if(!['normal','conservative'].includes(capability.status)||capability.difficultyCap!==(capability.status==='normal'?2:1)||!stringArray(capability.exclusions,{max:2})||capability.exclusions.some(value=>!['floor','hinge'].includes(value))||!plainRecord(capability.variants)||!safeInteger(capability.cardioStartMinutes,{min:8,max:15})||![8,15].includes(capability.cardioStartMinutes)||!stringArray(capability.reasonCodes,{max:16}))return null;
  const variantKeys=Object.keys(capability.variants);
  if(variantKeys.length!==2||variantKeys.some(key=>!['knee_dominant','horizontal_push'].includes(key))||!['standard','high_seat'].includes(capability.variants.knee_dominant)||!['standard','close_wall'].includes(capability.variants.horizontal_push))return null;
  if(capability.status==='normal'&&(capability.exclusions.length||capability.variants.knee_dominant!=='standard'||capability.variants.horizontal_push!=='standard'||capability.cardioStartMinutes!==15||capability.reasonCodes.length))return null;
  if(capability.status==='conservative'&&capability.reasonCodes.length===0)return null;
  return {revision,status:capability.status,difficultyCap:capability.difficultyCap,exclusions:new Set(capability.exclusions),variants:capability.variants,cardioStartMinutes:capability.cardioStartMinutes};
}
function validatePlan(rawInput){
  if(nativeStructuredClone===null||!isCanonicalCloneGraph(rawInput))return invalid();
  let input;
  try{input=nativeStructuredClone(rawInput)}catch(_error){return invalid()}
  if(!plainRecord(input)||!plainRecord(input.plan)||!plainRecord(input.intake)||!plainRecord(input.risk))return invalid();
  const plan=input.plan,intake=input.intake,risk=input.risk;
  const catalog=Object.prototype.hasOwnProperty.call(input,'catalog')?input.catalog:catalogApi.exerciseCatalog;
  const errors=[];
  const capability=canonicalCapability(input);
  if(!capability){add(errors,'INVALID_PLAN_SCHEMA','input.capabilityResult');return result(errors)}
  const mediaRequirement=Object.prototype.hasOwnProperty.call(input,'mediaRequirement')?input.mediaRequirement:'local_reference';
  if(!['local_reference','public_release'].includes(mediaRequirement)){add(errors,'INVALID_PLAN_SCHEMA','input.mediaRequirement');return result(errors)}
  const sessionMinutesValid=typeof intake.sessionMinutes==='string'&&['20','30','45','60','75'].includes(intake.sessionMinutes);
  const intakeExclusionsValid=stringArray(intake.avoidMovements,{max:32});
  const intakeWeekdaysValid=stringArray(intake.weekdays,{max:7})&&intake.weekdays.length>0&&intake.weekdays.every(day=>WEEKDAYS.includes(day));
  const riskValid=['normal','conservative'].includes(risk.level)&&risk.ruleVersion===RULE_VERSION;
  if(!sessionMinutesValid||!intakeExclusionsValid||!intakeWeekdaysValid||!riskValid){add(errors,'INVALID_PLAN_SCHEMA','input');return result(errors)}
  const catalogById=buildCatalogIndex(catalog,errors);
  if(plan.status!=='generated'||plan.schemaVersion!==1||plan.ruleVersion!==RULE_VERSION||plan.planVersion!==RULE_VERSION||plan.ruleVersion!==risk.ruleVersion||plan.riskLevel!==risk.level||!safeInteger(plan.intakeRevision,{min:1})||!safeInteger(plan.capabilityRevision,{min:1})||!denseArray(plan.weeks,{min:4,max:4})){
    add(errors,'INVALID_PLAN_SCHEMA','plan');
    return result(errors);
  }
  if(plan.capabilityRevision!==capability.revision)add(errors,'CAPABILITY_REVISION_MISMATCH','plan.capabilityRevision');
  const sessionLimit=Number(intake.sessionMinutes);
  const intakeExclusions=stringArray(intake.avoidMovements,{max:32})?intake.avoidMovements:[];
  const availableWeekdays=new Set(intakeWeekdaysValid?intake.weekdays:[]);
  const strengthDays=[];
  const seenSessionIds=new Set();
  for(let weekIndex=0;weekIndex<plan.weeks.length;weekIndex+=1){
    const week=plan.weeks[weekIndex],weekPath=`weeks[${weekIndex}]`;
    if(!plainRecord(week)||week.number!==weekIndex+1||!denseArray(week.sessions,{min:1,max:4})){add(errors,'INVALID_PLAN_SCHEMA',weekPath);continue}
    const weekdays=new Set();
    for(let sessionIndex=0;sessionIndex<week.sessions.length;sessionIndex+=1){
      const session=week.sessions[sessionIndex],sessionPath=`${weekPath}.sessions[${sessionIndex}]`;
      if(!plainRecord(session)||typeof session.id!=='string'||!session.id||seenSessionIds.has(session.id)||!WEEKDAYS.includes(session.weekday)||weekdays.has(session.weekday)||!['full_body_strength','low_impact_cardio','recovery'].includes(session.intent)||!['gym','home'].includes(session.setting)||!safeInteger(session.estimatedMinutes,{min:1,max:75})||!plainRecord(session.equipmentBySetting)||!stringArray(session.equipmentBySetting[session.setting],{max:64})||!stringArray(session.exclusions,{max:32})||!Array.isArray(session.actions)){
        add(errors,'INVALID_PLAN_SCHEMA',sessionPath);continue;
      }
      seenSessionIds.add(session.id);weekdays.add(session.weekday);
      if(!availableWeekdays.has(session.weekday))add(errors,'SESSION_WEEKDAY_UNAVAILABLE',`${sessionPath}.weekday`);
      if(!Number.isFinite(sessionLimit)||session.estimatedMinutes>sessionLimit)add(errors,'SESSION_DURATION_EXCEEDED',`${sessionPath}.estimatedMinutes`);
      if(session.actions.length===0){add(errors,'EMPTY_ACTION_QUEUE',`${sessionPath}.actions`);continue}
      if(!denseArray(session.actions,{min:1,max:16})){add(errors,'INVALID_PLAN_SCHEMA',`${sessionPath}.actions`);continue}
      if(session.intent==='full_body_strength')strengthDays.push({absolute:weekIndex*7+WEEKDAYS.indexOf(session.weekday),path:`${sessionPath}.weekday`});
      const expected=session.intent==='full_body_strength'?STRENGTH_PATTERNS:['low_impact_cardio'];
      if(session.actions.length!==expected.length)add(errors,'INVALID_PLAN_SCHEMA',`${sessionPath}.actions`);
      const exclusions=new Set([...intakeExclusions,...session.exclusions]);
      for(let actionIndex=0;actionIndex<session.actions.length;actionIndex+=1){
        const action=session.actions[actionIndex],actionPath=`${sessionPath}.actions[${actionIndex}]`;
        if(!plainRecord(action)||typeof action.exerciseId!=='string'||typeof action.pattern!=='string'||!['main','cardio'].includes(action.phase)){add(errors,'INVALID_PLAN_SCHEMA',actionPath);continue}
        const expectedPhase=session.intent==='full_body_strength'?'main':'cardio';
        const allowedFields=expectedPhase==='main'?['pattern','exerciseId','phase','sets','reps','rpe','restSec','variant']:['pattern','exerciseId','phase','durationMin','rpe','restSec'];
        if(action.phase!==expectedPhase||Object.keys(action).some(key=>!allowedFields.includes(key)))add(errors,'INVALID_PLAN_SCHEMA',actionPath);
        if(action.pattern!==expected[actionIndex])add(errors,'MOVEMENT_PATTERN_MISMATCH',`${actionPath}.pattern`);
        const exercise=catalogById&&catalogById.get(action.exerciseId);
        const trusted=TRUSTED_EXERCISES.get(action.exerciseId);
        if(!exercise||!trusted||exercise.reviewStatus!=='approved'){add(errors,'EXERCISE_NOT_APPROVED',`${actionPath}.exerciseId`);continue}
        if(!matchesTrustedExercise(exercise,trusted))add(errors,'INVALID_PLAN_SCHEMA',`${actionPath}.exerciseId`);
        const mediaEligibility=typeof catalogApi.mediaEligibilityForExercise==='function'?catalogApi.mediaEligibilityForExercise(trusted,{allowReferenceMediaForLocalPrototype:mediaRequirement==='local_reference'}):{selectable:true};
        if(!mediaEligibility||mediaEligibility.selectable!==true)add(errors,mediaEligibility&&mediaEligibility.code||'INVALID_MEDIA_SCHEMA',`${actionPath}.exerciseId`);
        if(!completeCues(trusted))add(errors,'CUES_UNAVAILABLE',`${actionPath}.exerciseId`);
        const mapped=matcherApi.CATALOG_PATTERN_TO_INTENT&&matcherApi.CATALOG_PATTERN_TO_INTENT[trusted.pattern];
        if(mapped!==action.pattern)add(errors,'MOVEMENT_PATTERN_MISMATCH',`${actionPath}.pattern`);
        if(!trusted.settings.includes(session.setting))add(errors,'EQUIPMENT_UNAVAILABLE',`${sessionPath}.setting`);
        const available=new Set(session.equipmentBySetting[session.setting]);
        if(!trusted.equipmentOptions.some(option=>option.every(id=>available.has(id))))add(errors,'EQUIPMENT_UNAVAILABLE',`${sessionPath}.equipmentBySetting.${session.setting}`);
        const contraindications=trusted.contraindications;
        if(exclusions.has(action.exerciseId)||exclusions.has(action.pattern)||exclusions.has(trusted.pattern)||contraindications.some(tag=>exclusions.has(tag)))add(errors,'CONTRAINDICATED_EXERCISE',`${actionPath}.exerciseId`);
        if(capability.exclusions.has(action.exerciseId)||capability.exclusions.has(action.pattern)||capability.exclusions.has(trusted.pattern)||contraindications.some(tag=>capability.exclusions.has(tag)))add(errors,'CAPABILITY_EXCLUSION_CONFLICT',`${actionPath}.exerciseId`);
        if(trusted.difficulty>capability.difficultyCap)add(errors,'CAPABILITY_DIFFICULTY_EXCEEDED',`${actionPath}.exerciseId`);
        if(action.pattern==='knee_dominant'){
          const actualVariant=action.exerciseId==='high-seat-sit-to-stand'?'high_seat':'standard';
          if(action.variant!==actualVariant||(capability.variants.knee_dominant!=='standard'&&action.variant!==capability.variants.knee_dominant))add(errors,'CAPABILITY_VARIANT_MISMATCH',`${actionPath}.variant`);
        }else if(action.pattern==='horizontal_push'){
          const actualVariant=action.exerciseId==='wall-push-up'?'close_wall':'standard';
          if(action.variant!==actualVariant||(capability.variants.horizontal_push!=='standard'&&action.variant!==capability.variants.horizontal_push))add(errors,'CAPABILITY_VARIANT_MISMATCH',`${actionPath}.variant`);
        }else if(Object.prototype.hasOwnProperty.call(action,'variant'))add(errors,'INVALID_PLAN_SCHEMA',`${actionPath}.variant`);
        if(weekIndex===0&&action.pattern==='low_impact_cardio'&&action.durationMin>capability.cardioStartMinutes)add(errors,'CARDIO_START_EXCEEDED',`${actionPath}.durationMin`);
        validateDose(action,trusted,actionPath,errors);
        if(Object.prototype.hasOwnProperty.call(action,'durationMin')&&action.durationMin>session.estimatedMinutes)add(errors,'SESSION_DURATION_EXCEEDED',`${actionPath}.durationMin`);
        if((risk.level==='conservative'||capability.status==='conservative')&&action.rpe>5)add(errors,'CONSERVATIVE_INTENSITY_EXCEEDED',`${actionPath}.rpe`);
      }
    }
  }
  strengthDays.sort((a,b)=>a.absolute-b.absolute);
  for(let index=1;index<strengthDays.length;index+=1)if(strengthDays[index].absolute-strengthDays[index-1].absolute<2)add(errors,'STRENGTH_RECOVERY_CONFLICT',strengthDays[index].path);
  if(denseArray(plan.weeks,{min:4,max:4})){
    for(let weekIndex=1;weekIndex<plan.weeks.length;weekIndex+=1){
      const previous=plan.weeks[weekIndex-1],current=plan.weeks[weekIndex];
      if(!plainRecord(previous)||!plainRecord(current)||!denseArray(previous.sessions,{min:1,max:4})||!denseArray(current.sessions,{min:1,max:4})||previous.sessions.length!==current.sessions.length||![...previous.sessions,...current.sessions].every(session=>plainRecord(session)&&denseArray(session.actions,{min:1,max:16})&&session.actions.every(plainRecord)))continue;
      const increased=new Set();
      const previousSessions=new Map(previous.sessions.map(session=>[`${session.weekday}|${session.intent}`,session]));
      for(let sessionIndex=0;sessionIndex<current.sessions.length;sessionIndex+=1){
        const afterSession=current.sessions[sessionIndex];
        const beforeSession=afterSession&&previousSessions.get(`${afterSession.weekday}|${afterSession.intent}`);
        if(!beforeSession||!Array.isArray(beforeSession.actions)||!Array.isArray(afterSession.actions)||beforeSession.actions.length!==afterSession.actions.length){
          add(errors,'INVALID_PLAN_SCHEMA',`weeks[${weekIndex}].sessions[${sessionIndex}]`);continue;
        }
        const previousActions=new Map(beforeSession.actions.map(action=>[action.pattern,action]));
        for(let actionIndex=0;actionIndex<afterSession.actions.length;actionIndex+=1){
          const after=afterSession.actions[actionIndex],before=after&&previousActions.get(after.pattern);
          if(!before){add(errors,'INVALID_PLAN_SCHEMA',`weeks[${weekIndex}].sessions[${sessionIndex}].actions[${actionIndex}]`);continue}
          for(const field of DOSE_FIELDS){
            if(typeof before[field]!=='number'||typeof after[field]!=='number')continue;
            const progressed=field==='restSec'?after[field]<before[field]:after[field]>before[field];
            if(!progressed)continue;
            increased.add(field);
            if(risk.level==='conservative'||capability.status==='conservative')add(errors,'CONSERVATIVE_INTENSITY_EXCEEDED',`weeks[${weekIndex}].sessions[${sessionIndex}].actions[${actionIndex}].${field}`);
            const limit=PROGRESSION_LIMITS[field],delta=Math.abs(after[field]-before[field]);
            if(limit!==undefined&&delta>limit)add(errors,'PROGRESSION_JUMP',`weeks[${weekIndex}].sessions[${sessionIndex}].actions[${actionIndex}].${field}`);
          }
        }
      }
      if(increased.size>1)add(errors,'MULTIPLE_PROGRESSIONS',`weeks[${weekIndex}]`);
    }
  }
  return result(errors);
}

return Object.freeze({RULE_VERSION,validatePlan});
});
