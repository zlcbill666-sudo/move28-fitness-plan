(function(root,factory){
'use strict';
const isCommonJS=typeof module==='object'&&module.exports;
const matcherApi=isCommonJS?require('./movement-matcher.js'):root.Move28&&root.Move28.domain;
const catalogApi=isCommonJS?require('../data/exercise-catalog.js'):root.Move28&&root.Move28.data;
const validatorApi=isCommonJS?require('./plan-validator.js'):root.Move28&&root.Move28.domain;
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const api=factory(matcherApi||{},catalogApi||{},validatorApi||{},nativeStructuredClone);
if(isCommonJS)module.exports=api;
else{
  root.Move28=root.Move28||{};
  root.Move28.domain=Object.assign(root.Move28.domain||{},api);
}
})(globalThis,function(matcherApi,catalogApi,validatorApi,nativeStructuredClone){
'use strict';

const RULE_VERSION='pilot-v2';
const SCHEMA_VERSION=1;
const WEEKDAYS=Object.freeze(['mon','tue','wed','thu','fri','sat','sun']);
const SESSION_MINUTES=Object.freeze([20,30,45,60,75]);
const DAY_COUNTS=Object.freeze({1:1,2:2,3:3,4:4,'5plus':5});
const STRENGTH_PATTERNS=Object.freeze(['knee_dominant','posterior_chain','horizontal_push','horizontal_pull','core_stability']);
const FOCUSES=Object.freeze(['适应','重复并小幅增加','条件渐进','巩固']);
const SETTINGS=Object.freeze(['gym','home']);
const CARDIO_PREFERENCES=Object.freeze(['flat_walk','elliptical','mixed','none']);
const CARDIO_AVOIDS=Object.freeze(['none','flat_walk','elliptical']);
const TRAINING_BREAKS=Object.freeze(['yes','no','unsure']);
const STRENGTH_EXPERIENCES=Object.freeze(['none','some','regular_under_6m','experienced']);
const CAPABILITY_FIELDS=Object.freeze(['status','difficultyCap','exclusions','variants','cardioStartMinutes','reasonCodes']);
const CAPABILITY_STATUSES=Object.freeze(['normal','conservative','manual_review','stop']);

function ownValue(object,key){
  try{
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    return descriptor&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined;
  }catch(_error){return undefined}
}
function dataProperty(object,key){
  try{
    const descriptor=Object.getOwnPropertyDescriptor(object,key);
    if(descriptor===undefined)return {valid:true,present:false,value:undefined};
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))return {valid:false,present:true,value:undefined};
    return {valid:true,present:true,value:descriptor.value};
  }catch(_error){return {valid:false,present:false,value:undefined}}
}
function plainRecord(value){
  try{
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const prototype=Object.getPrototypeOf(value);
    if(prototype===null)return true;
    if(Object.getPrototypeOf(prototype)!==null)return false;
    const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor');
    return Boolean(constructor&&Object.prototype.hasOwnProperty.call(constructor,'value')&&typeof constructor.value==='function');
  }catch(_error){return false}
}
function arrayValues(value,{max=64,allowEmpty=true}={}){
  try{
    if(!Array.isArray(value))return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const length=descriptors.length;
    if(!length||!Object.prototype.hasOwnProperty.call(length,'value')||!Number.isSafeInteger(length.value)||length.value<0||length.value>max||(!allowEmpty&&length.value===0))return null;
    const keys=Reflect.ownKeys(descriptors);
    if(keys.some(key=>key!=='length'&&!/^(0|[1-9]\d*)$/.test(String(key))))return null;
    const result=[];
    for(let index=0;index<length.value;index+=1){
      const descriptor=descriptors[String(index)];
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return null;
      result.push(descriptor.value);
    }
    return result;
  }catch(_error){return null}
}
function stringArray(value,options){
  const values=arrayValues(value,options);
  if(!values||values.some(item=>typeof item!=='string'||item.length===0||item.length>80)||new Set(values).size!==values.length)return null;
  return values;
}
function deepFreeze(value,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return value;
  seen.add(value);
  for(const child of Object.values(value))deepFreeze(child,seen);
  return Object.freeze(value);
}
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
        if(typeof value==='function'||typeof value==='symbol'||typeof value==='bigint'||typeof value==='undefined')return false;
        if(typeof value==='number'&&!Number.isFinite(value))return false;
        if(typeof value==='string'&&value.length>10000)return false;
        continue;
      }
      if(frame.exit){active.delete(value);complete.add(value);continue}
      if(active.has(value))return false;
      if(complete.has(value))continue;
      nodes+=1;
      if(nodes>4096||frame.depth>32)return false;
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
        if(!length||!Object.prototype.hasOwnProperty.call(length,'value')||!Number.isSafeInteger(length.value)||length.value<0||length.value>512)return false;
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
function safeValidationResult(value){
  if(!nativeStructuredClone||!isCanonicalCloneGraph(value))return null;
  let cloned;
  try{cloned=nativeStructuredClone(value)}catch(_error){return null}
  if(!plainRecord(cloned))return null;
  const ok=ownValue(cloned,'ok'),errors=arrayValues(ownValue(cloned,'errors'),{max:256});
  if(typeof ok!=='boolean'||!errors||Object.keys(cloned).some(key=>!['ok','errors'].includes(key))||(ok&&errors.length)||(!ok&&!errors.length))return null;
  const clean=[];
  for(const error of errors){
    if(!plainRecord(error)||Object.keys(error).some(key=>!['code','path','message'].includes(key)))return null;
    const code=ownValue(error,'code'),path=ownValue(error,'path'),message=ownValue(error,'message');
    if(typeof code!=='string'||!code||code.length>80||typeof path!=='string'||!path||path.length>300||typeof message!=='string'||!message||message.length>500)return null;
    clean.push({code,path,message});
  }
  return {ok,errors:clean};
}
function canonicalCapability(input){
  const capabilityRevision=ownValue(input,'capabilityRevision');
  const source=ownValue(input,'capabilityResult');
  if(!Number.isSafeInteger(capabilityRevision)||capabilityRevision<1||!plainRecord(source))return null;
  const keys=Object.keys(source);
  if(keys.length!==CAPABILITY_FIELDS.length||keys.some(key=>!CAPABILITY_FIELDS.includes(key)))return null;
  const status=ownValue(source,'status');
  const difficultyCap=ownValue(source,'difficultyCap');
  const exclusions=stringArray(ownValue(source,'exclusions'),{max:2});
  const variants=ownValue(source,'variants');
  const cardioStartMinutes=ownValue(source,'cardioStartMinutes');
  const reasonCodes=stringArray(ownValue(source,'reasonCodes'),{max:16});
  if(!CAPABILITY_STATUSES.includes(status)||!Number.isSafeInteger(difficultyCap)||!exclusions||exclusions.some(value=>!['floor','hinge'].includes(value))||!plainRecord(variants)||!Number.isSafeInteger(cardioStartMinutes)||!reasonCodes||reasonCodes.some(code=>!/^[A-Z][A-Z0-9_]{0,79}$/.test(code)))return null;
  const variantKeys=Object.keys(variants);
  if(variantKeys.length!==2||variantKeys.some(key=>!['knee_dominant','horizontal_push'].includes(key)))return null;
  const kneeDominant=ownValue(variants,'knee_dominant'),horizontalPush=ownValue(variants,'horizontal_push');
  if(!['standard','high_seat'].includes(kneeDominant)||!['standard','close_wall'].includes(horizontalPush))return null;
  if(difficultyCap!==(status==='normal'?2:1)||![0,8,15].includes(cardioStartMinutes))return null;
  if(status==='normal'&&(exclusions.length||kneeDominant!=='standard'||horizontalPush!=='standard'||cardioStartMinutes!==15||reasonCodes.length))return null;
  if(status==='stop'&&cardioStartMinutes!==0)return null;
  if((status==='conservative'||status==='manual_review')&&cardioStartMinutes===0)return null;
  if(status!=='normal'&&reasonCodes.length===0)return null;
  return {capabilityRevision,status,difficultyCap,exclusions:[...exclusions],variants:{knee_dominant:kneeDominant,horizontal_push:horizontalPush},cardioStartMinutes,reasonCodes:[...reasonCodes]};
}
function failure(code,details={}){
  return deepFreeze({status:'manual_review',plan:null,errors:[{code,...details}]});
}
function canonicalInput(input){
  if(!plainRecord(input))return null;
  const intake=ownValue(input,'intake');
  const risk=ownValue(input,'risk');
  const intakeRevision=ownValue(input,'intakeRevision');
  const capability=canonicalCapability(input);
  if(!plainRecord(intake)||!plainRecord(risk)||!Number.isSafeInteger(intakeRevision)||intakeRevision<1||!capability)return null;
  const finalConfirmed=ownValue(intake,'finalConfirmed');
  const age=ownValue(intake,'age');
  const daysPerWeek=ownValue(intake,'daysPerWeek');
  const sessionMinutes=ownValue(intake,'sessionMinutes');
  const weekdays=stringArray(ownValue(intake,'weekdays'),{max:7,allowEmpty:false});
  const setting=ownValue(intake,'setting');
  const equipment=stringArray(ownValue(intake,'equipment'),{max:64,allowEmpty:false});
  const avoidMovements=stringArray(ownValue(intake,'avoidMovements'),{max:32});
  const avoidEquipment=stringArray(ownValue(intake,'avoidEquipment'),{max:64});
  const cardioPreference=ownValue(intake,'cardioPreference');
  const cardioAvoid=ownValue(intake,'cardioAvoid');
  const trainingBreak=ownValue(intake,'trainingBreak');
  const strengthExperience=ownValue(intake,'strengthExperience');
  const riskLevel=ownValue(risk,'level');
  const ruleVersion=ownValue(risk,'ruleVersion');
  const dayCount=typeof daysPerWeek==='string'&&Object.prototype.hasOwnProperty.call(DAY_COUNTS,daysPerWeek)?DAY_COUNTS[daysPerWeek]:null;
  if(finalConfirmed!==true||!Number.isSafeInteger(age)||age<16||age>120||!dayCount||typeof sessionMinutes!=='string'||!SESSION_MINUTES.includes(Number(sessionMinutes))||!weekdays||weekdays.length<dayCount||weekdays.some(day=>!WEEKDAYS.includes(day))||!SETTINGS.includes(setting)||!equipment||!avoidMovements||!avoidEquipment||!CARDIO_PREFERENCES.includes(cardioPreference)||!CARDIO_AVOIDS.includes(cardioAvoid)||!TRAINING_BREAKS.includes(trainingBreak)||!STRENGTH_EXPERIENCES.includes(strengthExperience))return null;
  if(!['normal','conservative','manual_review','stop'].includes(riskLevel)||ruleVersion!==RULE_VERSION)return null;
  if((trainingBreak==='yes'||trainingBreak==='unsure')&&riskLevel==='normal')return null;
  if(Array.isArray(catalogApi.EQUIPMENT_IDS)&&equipment.some(item=>!catalogApi.EQUIPMENT_IDS.includes(item)))return null;
  if(Array.isArray(catalogApi.EXCLUSION_TAGS)&&avoidMovements.some(item=>!catalogApi.EXCLUSION_TAGS.includes(item)))return null;
  if(avoidEquipment.some(item=>!equipment.includes(item)))return null;
  if(cardioAvoid!=='none'&&(cardioPreference===cardioAvoid||cardioPreference==='mixed'))return null;
  const catalogProperty=dataProperty(input,'catalog');
  if(!catalogProperty.valid)return null;
  const catalog=catalogProperty.present?catalogProperty.value:catalogApi.exerciseCatalog;
  if(!catalog)return null;
  const sortedWeekdays=[...weekdays].sort((a,b)=>WEEKDAYS.indexOf(a)-WEEKDAYS.indexOf(b));
  const availableEquipment=equipment.filter(item=>!avoidEquipment.includes(item));
  const mergedExclusions=[...new Set([...avoidMovements,...capability.exclusions])];
  return {intakeRevision,...capability,daysPerWeek,dayCount,sessionMinutes:Number(sessionMinutes),weekdays:sortedWeekdays,setting,equipment:availableEquipment,avoidMovements:mergedExclusions,cardioPreference,cardioAvoid,trainingBreak,strengthExperience,riskLevel,catalog};
}
function circularGap(first,second){
  const gap=Math.abs(WEEKDAYS.indexOf(first)-WEEKDAYS.indexOf(second));
  return Math.min(gap,7-gap);
}
function strengthDays(weekdays,count){
  if(count===1)return [weekdays[0]];
  if(count===2){
    for(let left=0;left<weekdays.length;left+=1)for(let right=left+1;right<weekdays.length;right+=1){
      if(circularGap(weekdays[left],weekdays[right])>=2)return [weekdays[left],weekdays[right]];
    }
    return null;
  }
  if(weekdays.length>=3&&circularGap(weekdays[0],weekdays[2])>=2)return [weekdays[0],weekdays[2]];
  for(let left=0;left<weekdays.length;left+=1)for(let right=left+1;right<weekdays.length;right+=1){
    if(circularGap(weekdays[left],weekdays[right])>=2)return [weekdays[left],weekdays[right]];
  }
  return null;
}
function sessionSchedule(input){
  if(input.dayCount===1)return [{weekday:input.weekdays[0],intent:'full_body_strength'}];
  const strength=strengthDays(input.weekdays,input.dayCount===2?2:3);
  if(!strength)return null;
  const schedule=strength.map(weekday=>({weekday,intent:'full_body_strength'}));
  if(input.dayCount>=3){
    const remaining=input.weekdays.filter(day=>!strength.includes(day));
    if(!remaining.length)return null;
    schedule.push({weekday:remaining[0],intent:'low_impact_cardio'});
    if(input.dayCount>=4){
      if(remaining.length<2)return null;
      schedule.push({weekday:remaining[1],intent:'recovery'});
    }
  }
  return schedule.sort((a,b)=>WEEKDAYS.indexOf(a.weekday)-WEEKDAYS.indexOf(b.weekday));
}
function cardioExclusions(input){
  const exclusions=[...input.avoidMovements];
  if(input.cardioPreference==='flat_walk'||input.cardioAvoid==='elliptical')exclusions.push('elliptical-trainer');
  if(input.cardioPreference==='elliptical'||input.cardioAvoid==='flat_walk')exclusions.push('flat-walk');
  return [...new Set(exclusions)];
}
function capabilityMatchingExclusions(input,pattern){
  const exclusions=pattern==='low_impact_cardio'?cardioExclusions(input):[...input.avoidMovements];
  if(pattern==='knee_dominant'&&input.variants.knee_dominant==='high_seat')exclusions.push('seated-leg-press');
  if(pattern==='horizontal_push'&&input.variants.horizontal_push==='close_wall')exclusions.push('chest-press-machine','standing-band-chest-press');
  return [...new Set(exclusions)];
}
function matchedAction(input,pattern,weekNumber){
  const exclusions=capabilityMatchingExclusions(input,pattern);
  const result=matcherApi.matchExercise({pattern,setting:input.setting,equipment:input.equipment,exclusions,difficultyCap:input.difficultyCap,catalog:input.catalog});
  if(!result||result.ok!==true)return {error:result&&result.error?result.error:{code:'MATCHER_UNAVAILABLE'}};
  if(pattern==='low_impact_cardio'){
    const dose=result.exercise&&result.exercise.dose&&result.exercise.dose.durationMin;
    const minimum=Array.isArray(dose)?dose[0]:1,maximum=Array.isArray(dose)?dose[1]:input.cardioStartMinutes;
    const durationMin=Math.min(Math.max(10,Math.min(20,input.sessionMinutes-5)),input.cardioStartMinutes,maximum);
    if(!Number.isSafeInteger(durationMin)||durationMin<minimum)return {error:{code:'CAPABILITY_CARDIO_UNAVAILABLE'}};
    return {action:{pattern,exerciseId:result.exerciseId,phase:'cardio',durationMin,rpe:4,restSec:0}};
  }
  const conservative=input.riskLevel==='conservative'||input.status==='conservative';
  const reps=!conservative&&weekNumber>=2?9:8;
  const restSec=conservative?90:(input.strengthExperience==='none'?75:60);
  const action={pattern,exerciseId:result.exerciseId,phase:'main',sets:2,reps,rpe:5,restSec};
  if(pattern==='knee_dominant')action.variant=result.exerciseId==='high-seat-sit-to-stand'?'high_seat':'standard';
  if(pattern==='horizontal_push')action.variant=result.exerciseId==='wall-push-up'?'close_wall':'standard';
  return {action};
}
function buildSession(input,item,weekNumber,index){
  const patterns=item.intent==='full_body_strength'?STRENGTH_PATTERNS:['low_impact_cardio'];
  const actions=[];
  for(const pattern of patterns){
    const matched=matchedAction(input,pattern,weekNumber);
    if(matched.error)return {error:{code:'REQUIRED_MOVEMENT_UNAVAILABLE',path:`weeks[${weekNumber-1}].sessions[${index}].actions`,pattern,setting:input.setting,cause:matched.error}};
    actions.push(matched.action);
  }
  const estimatedMinutes=item.intent==='full_body_strength'?((input.riskLevel==='conservative'||input.status==='conservative')?20:18):(item.intent==='recovery'?actions[0].durationMin:actions[0].durationMin+5);
  return {session:{id:`w${weekNumber}-s${index+1}`,weekday:item.weekday,intent:item.intent,setting:input.setting,estimatedMinutes,equipmentBySetting:{[input.setting]:[...input.equipment]},exclusions:[...input.avoidMovements],actions}};
}
function assumptionsFor(input){
  const assumptions=[{code:'conditional_progression_held',message:'第3至4周保持第2周剂量，等待每周复盘确认后再调整。'}];
  if(input.dayCount===1)assumptions.push({code:'one_day_limited',message:'每周仅安排一次全身训练，步行作为非处方建议。'});
  if(input.dayCount>=5)assumptions.push({code:'first_cycle_capped_at_four',message:'首周期最多安排三次结构化训练和一次恢复。'});
  if(input.riskLevel==='conservative')assumptions.push({code:'catalog_floor_for_conservative',message:'采用动作目录允许的最低组数与RPE，并延长休息。'});
  if(input.status==='conservative')assumptions.push({code:'capability_conservative_start',message:'能力校准要求使用受控变式、难度上限和降低后的起始剂量。'});
  if(input.trainingBreak==='yes'||input.trainingBreak==='unsure')assumptions.push({code:'returning_to_training',message:'按恢复训练路线保守起步。'});
  if(input.strengthExperience==='none')assumptions.push({code:'beginner_rest_extended',message:'无力量训练经验，延长组间休息并保持基础动作。'});
  return assumptions;
}
function generatePlan(rawInput){
  if(nativeStructuredClone===null||!isCanonicalCloneGraph(rawInput))return failure('INVALID_GENERATOR_INPUT');
  try{nativeStructuredClone(rawInput)}catch(_error){return failure('INVALID_GENERATOR_INPUT')}
  const input=canonicalInput(rawInput);
  if(!input)return failure('INVALID_GENERATOR_INPUT');
  if(typeof matcherApi.matchExercise!=='function')return failure('MATCHER_UNAVAILABLE');
  if(input.riskLevel==='stop'||input.riskLevel==='manual_review')return failure('RISK_BLOCKED',{riskLevel:input.riskLevel});
  if(input.status==='stop'||input.status==='manual_review')return failure('CAPABILITY_BLOCKED',{capabilityStatus:input.status});

  const schedule=sessionSchedule(input);
  if(!schedule)return failure('RECOVERY_SCHEDULE_UNAVAILABLE');
  const weeks=[];
  for(let weekNumber=1;weekNumber<=4;weekNumber+=1){
    const sessions=[];
    for(let index=0;index<schedule.length;index+=1){
      const built=buildSession(input,schedule[index],weekNumber,index);
      if(built.error)return failure(built.error.code,built.error);
      if(built.session.estimatedMinutes>input.sessionMinutes)return failure('SESSION_DURATION_EXCEEDED',{path:`weeks[${weekNumber-1}].sessions[${index}]`});
      sessions.push(built.session);
    }
    weeks.push({number:weekNumber,focus:FOCUSES[weekNumber-1],sessions});
  }
  const candidate={
    id:`plan-${RULE_VERSION}-r${input.intakeRevision}-c${input.capabilityRevision}-${input.setting}-${input.daysPerWeek}`,
    schemaVersion:SCHEMA_VERSION,
    ruleVersion:RULE_VERSION,
    planVersion:RULE_VERSION,
    intakeRevision:input.intakeRevision,
    capabilityRevision:input.capabilityRevision,
    riskLevel:input.riskLevel,
    status:'generated',
    assumptions:assumptionsFor(input),
    weeks
  };
  if(typeof validatorApi.validatePlan!=='function')return failure('VALIDATOR_UNAVAILABLE');
  let validation;
  try{
    validation=safeValidationResult(validatorApi.validatePlan({
      plan:candidate,
      intake:{sessionMinutes:String(input.sessionMinutes),avoidMovements:[...input.avoidMovements],weekdays:[...input.weekdays]},
      risk:{level:input.riskLevel,ruleVersion:RULE_VERSION},
      capabilityResult:{status:input.status,difficultyCap:input.difficultyCap,exclusions:[...input.exclusions],variants:{...input.variants},cardioStartMinutes:input.cardioStartMinutes,reasonCodes:[...input.reasonCodes]},
      capabilityRevision:input.capabilityRevision,
      catalog:input.catalog
    }));
  }catch(_error){return failure('VALIDATOR_UNAVAILABLE')}
  if(!validation)return failure('VALIDATOR_UNAVAILABLE');
  if(!validation.ok)return deepFreeze({status:'manual_review',plan:null,errors:validation.errors});
  return deepFreeze(candidate);
}

return Object.freeze({RULE_VERSION,SCHEMA_VERSION,STRENGTH_PATTERNS,generatePlan});
});
