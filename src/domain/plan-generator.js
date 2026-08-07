(function(root,factory){
'use strict';
const isCommonJS=typeof module==='object'&&module.exports;
const matcherApi=isCommonJS?require('./movement-matcher.js'):root.Move28&&root.Move28.domain;
const catalogApi=isCommonJS?require('../data/exercise-catalog.js'):root.Move28&&root.Move28.data;
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const api=factory(matcherApi||{},catalogApi||{},nativeStructuredClone);
if(isCommonJS)module.exports=api;
else{
  root.Move28=root.Move28||{};
  root.Move28.domain=Object.assign(root.Move28.domain||{},api);
}
})(globalThis,function(matcherApi,catalogApi,nativeStructuredClone){
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
function failure(code,details={}){
  return deepFreeze({status:'manual_review',plan:null,errors:[{code,...details}]});
}
function canonicalInput(input){
  if(!plainRecord(input))return null;
  const intake=ownValue(input,'intake');
  const risk=ownValue(input,'risk');
  const intakeRevision=ownValue(input,'intakeRevision');
  if(!plainRecord(intake)||!plainRecord(risk)||!Number.isSafeInteger(intakeRevision)||intakeRevision<1)return null;
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
  if(finalConfirmed!==true||!Number.isSafeInteger(age)||age<18||age>120||!dayCount||typeof sessionMinutes!=='string'||!SESSION_MINUTES.includes(Number(sessionMinutes))||!weekdays||weekdays.length<dayCount||weekdays.some(day=>!WEEKDAYS.includes(day))||!SETTINGS.includes(setting)||!equipment||!avoidMovements||!avoidEquipment||!CARDIO_PREFERENCES.includes(cardioPreference)||!CARDIO_AVOIDS.includes(cardioAvoid)||!TRAINING_BREAKS.includes(trainingBreak)||!STRENGTH_EXPERIENCES.includes(strengthExperience))return null;
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
  return {intakeRevision,daysPerWeek,dayCount,sessionMinutes:Number(sessionMinutes),weekdays:sortedWeekdays,setting,equipment:availableEquipment,avoidMovements,cardioPreference,cardioAvoid,trainingBreak,strengthExperience,riskLevel,catalog};
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
function matchedAction(input,pattern,weekNumber){
  const exclusions=pattern==='low_impact_cardio'?cardioExclusions(input):input.avoidMovements;
  const result=matcherApi.matchExercise({pattern,setting:input.setting,equipment:input.equipment,exclusions,difficulty:2,catalog:input.catalog});
  if(!result||result.ok!==true)return {error:result&&result.error?result.error:{code:'MATCHER_UNAVAILABLE'}};
  if(pattern==='low_impact_cardio'){
    const durationMin=Math.max(10,Math.min(20,input.sessionMinutes-5));
    return {action:{pattern,exerciseId:result.exerciseId,phase:'cardio',durationMin,rpe:4,restSec:0}};
  }
  const reps=input.riskLevel==='normal'&&weekNumber>=2?9:8;
  const restSec=input.riskLevel==='conservative'?90:(input.strengthExperience==='none'?75:60);
  return {action:{pattern,exerciseId:result.exerciseId,phase:'main',sets:2,reps,rpe:5,restSec}};
}
function buildSession(input,item,weekNumber,index){
  const patterns=item.intent==='full_body_strength'?STRENGTH_PATTERNS:['low_impact_cardio'];
  const actions=[];
  for(const pattern of patterns){
    const matched=matchedAction(input,pattern,weekNumber);
    if(matched.error)return {error:{code:'REQUIRED_MOVEMENT_UNAVAILABLE',path:`weeks[${weekNumber-1}].sessions[${index}].actions`,pattern,setting:input.setting,cause:matched.error}};
    actions.push(matched.action);
  }
  const estimatedMinutes=item.intent==='full_body_strength'?(input.riskLevel==='conservative'?20:18):(item.intent==='recovery'?actions[0].durationMin:actions[0].durationMin+5);
  return {session:{id:`w${weekNumber}-s${index+1}`,weekday:item.weekday,intent:item.intent,setting:input.setting,estimatedMinutes,equipmentBySetting:{[input.setting]:[...input.equipment]},exclusions:[...input.avoidMovements],actions}};
}
function assumptionsFor(input){
  const assumptions=[{code:'conditional_progression_held',message:'第3至4周保持第2周剂量，等待每周复盘确认后再调整。'}];
  if(input.dayCount===1)assumptions.push({code:'one_day_limited',message:'每周仅安排一次全身训练，步行作为非处方建议。'});
  if(input.dayCount>=5)assumptions.push({code:'first_cycle_capped_at_four',message:'首周期最多安排三次结构化训练和一次恢复。'});
  if(input.riskLevel==='conservative')assumptions.push({code:'catalog_floor_for_conservative',message:'采用动作目录允许的最低组数与RPE，并延长休息。'});
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
  return deepFreeze({
    id:`plan-${RULE_VERSION}-r${input.intakeRevision}-${input.setting}-${input.daysPerWeek}`,
    schemaVersion:SCHEMA_VERSION,
    ruleVersion:RULE_VERSION,
    planVersion:RULE_VERSION,
    intakeRevision:input.intakeRevision,
    riskLevel:input.riskLevel,
    status:'generated',
    assumptions:assumptionsFor(input),
    weeks
  });
}

return Object.freeze({RULE_VERSION,SCHEMA_VERSION,STRENGTH_PATTERNS,generatePlan});
});
