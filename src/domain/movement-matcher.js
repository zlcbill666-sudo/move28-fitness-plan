(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const catalogApi=isCommonJS?require('../data/exercise-catalog.js'):(Move28.data||{});
const api=factory(catalogApi);
Move28.domain=Object.assign(Move28.domain||{},api);
if(isCommonJS)module.exports=api;
})(globalThis,function(catalogApi){
'use strict';

const MOVEMENT_INTENTS=Object.freeze(['knee_dominant','posterior_chain','horizontal_push','horizontal_pull','core_stability','low_impact_cardio']);
const SUPPORTED_SETTINGS=Object.freeze(['gym','home']);
const MATCH_PRIORITIES=Object.freeze({
  knee_dominant:Object.freeze({gym:Object.freeze(['seated-leg-press','high-seat-sit-to-stand']),home:Object.freeze(['high-seat-sit-to-stand'])}),
  posterior_chain:Object.freeze({gym:Object.freeze(['seated-leg-curl','glute-bridge','wall-hip-hinge']),home:Object.freeze(['glute-bridge','wall-hip-hinge'])}),
  horizontal_push:Object.freeze({gym:Object.freeze(['chest-press-machine','wall-push-up']),home:Object.freeze(['wall-push-up'])}),
  horizontal_pull:Object.freeze({gym:Object.freeze(['seated-row','band-row']),home:Object.freeze(['band-row'])}),
  core_stability:Object.freeze({gym:Object.freeze(['pallof-press','dead-bug']),home:Object.freeze(['dead-bug','pallof-press'])}),
  low_impact_cardio:Object.freeze({gym:Object.freeze(['elliptical-trainer','flat-walk']),home:Object.freeze(['flat-walk','supported-standing-march'])})
});
const CATALOG_PATTERN_TO_INTENT=Object.freeze({
  knee_dominant:'knee_dominant',knee_flexion:'posterior_chain',hip_extension:'posterior_chain',hinge:'posterior_chain',
  horizontal_push:'horizontal_push',horizontal_pull:'horizontal_pull',anti_rotation:'core_stability',anti_extension:'core_stability',
  cardio:'low_impact_cardio',locomotion:'low_impact_cardio'
});

const ACTION_FIELDS=Object.freeze(['pattern','exerciseId','phase','sets','reps','rpe','restSec','durationMin','holdSec','exclusions']);
const ACTION_PHASES=Object.freeze(['warmup','main','cardio','cooldown']);

function dangerousKey(key){return key==='__proto__'||key==='prototype'||key==='constructor'}
function validActionScalar(key,value){
  if(key==='pattern'||key==='exerciseId')return typeof value==='string'&&value.length>0&&value.length<=80;
  if(key==='phase')return ACTION_PHASES.includes(value);
  if(key==='sets'||key==='reps')return Number.isSafeInteger(value)&&value>0&&value<=100;
  if(key==='rpe')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=10;
  if(key==='restSec')return Number.isSafeInteger(value)&&value>=0&&value<=600;
  if(key==='durationMin')return Number.isSafeInteger(value)&&value>0&&value<=300;
  if(key==='holdSec')return Number.isSafeInteger(value)&&value>0&&value<=600;
  return false;
}
function own(object,key){try{return Object.prototype.hasOwnProperty.call(object||{},key)}catch(_error){return false}}
function ownValue(object,key){
  try{const descriptor=Object.getOwnPropertyDescriptor(object,key);return descriptor&&own(descriptor,'value')?descriptor.value:undefined}catch(_error){return undefined}
}
function arrayValues(value,{allowEmpty=true,max=64}={}){
  try{
    if(!Array.isArray(value))return null;
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const lengthDescriptor=descriptors.length;
    if(!lengthDescriptor||!own(lengthDescriptor,'value'))return null;
    const length=lengthDescriptor.value;
    if(!Number.isSafeInteger(length)||length<0||length>max||(!allowEmpty&&length===0)||Reflect.ownKeys(descriptors).length!==length+1)return null;
    const result=[];
    for(let index=0;index<length;index++){
      const descriptor=descriptors[String(index)];
      if(!descriptor||!own(descriptor,'value'))return null;
      result.push(descriptor.value);
    }
    return result;
  }catch(_error){return null}
}
function stringArray(value,options){
  const values=arrayValues(value,options);
  return values&&values.every(item=>typeof item==='string'&&item)?values:null;
}
function deepFreeze(value,seen=new WeakSet()){
  if(value===null||typeof value!=='object'||seen.has(value))return value;
  seen.add(value);
  for(const key of Reflect.ownKeys(value)){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(descriptor&&own(descriptor,'value'))deepFreeze(descriptor.value,seen);
  }
  return Object.freeze(value);
}
function failure(code,details={}){return deepFreeze({ok:false,error:{code,...details}})}
function availableOption(exercise,equipment){
  const available=new Set(equipment);
  return exercise.equipmentOptions.find(option=>option.every(id=>available.has(id)))||null;
}
function safeCatalog(catalog){
  const items=arrayValues(catalog,{max:256});
  if(!items)return null;
  const approved=[];
  for(const source of items){
    if(!source||typeof source!=='object')return null;
    const reviewStatus=ownValue(source,'reviewStatus');
    if(typeof reviewStatus!=='string')return null;
    if(reviewStatus!=='approved')continue;
    const id=ownValue(source,'id');
    const pattern=ownValue(source,'pattern');
    const settings=stringArray(ownValue(source,'settings'),{allowEmpty:false,max:8});
    const contraindications=stringArray(ownValue(source,'contraindications'),{max:32});
    const difficulty=ownValue(source,'difficulty');
    const rawOptions=arrayValues(ownValue(source,'equipmentOptions'),{allowEmpty:false,max:16});
    if(typeof id!=='string'||!id||typeof pattern!=='string'||!settings||!contraindications||!Number.isInteger(difficulty)||difficulty<1||difficulty>3||!rawOptions)return null;
    const equipmentOptions=[];
    for(const option of rawOptions){
      const canonical=stringArray(option,{allowEmpty:false,max:16});
      if(!canonical)return null;
      equipmentOptions.push(canonical);
    }
    approved.push({source,id,pattern,settings,contraindications,difficulty,equipmentOptions});
  }
  return approved;
}
function requestFrom(input){
  try{if(!input||typeof input!=='object'||Array.isArray(input))return null}catch(_error){return null}
  const pattern=ownValue(input,'pattern');
  const setting=ownValue(input,'setting');
  const equipment=stringArray(ownValue(input,'equipment'),{max:32});
  const exclusions=stringArray(ownValue(input,'exclusions'),{max:32});
  const hasDifficulty=own(input,'difficulty');
  const hasDifficultyCap=own(input,'difficultyCap');
  if(hasDifficulty===hasDifficultyCap)return null;
  const difficulty=ownValue(input,hasDifficultyCap?'difficultyCap':'difficulty');
  const catalog=own(input,'catalog')?ownValue(input,'catalog'):catalogApi.exerciseCatalog;
  if(!MOVEMENT_INTENTS.includes(pattern)||!SUPPORTED_SETTINGS.includes(setting)||!equipment||!exclusions||!Number.isInteger(difficulty)||difficulty<1||difficulty>3)return null;
  const approved=safeCatalog(catalog);
  if(!approved)return null;
  const knownExclusions=new Set([
    ...(catalogApi.EXCLUSION_TAGS||[]),...(catalogApi.PATTERNS||[]),...MOVEMENT_INTENTS,...approved.map(item=>item.id)
  ]);
  if(new Set(equipment).size!==equipment.length||new Set(exclusions).size!==exclusions.length||exclusions.some(value=>!knownExclusions.has(value)))return null;
  return {pattern,setting,equipment,exclusions,difficulty,approved};
}
function matchExercise(input){
  const request=requestFrom(input);
  if(!request)return failure('INVALID_REQUEST');
  const {pattern,setting,equipment,exclusions,difficulty,approved}=request;
  const priorities=MATCH_PRIORITIES[pattern][setting];
  const rank=new Map(priorities.map((id,index)=>[id,index]));
  const mapped=approved.filter(exercise=>rank.has(exercise.id)&&Array.isArray(exercise.settings)&&exercise.settings.includes(setting)).sort((a,b)=>rank.get(a.id)-rank.get(b.id));
  if(!mapped.length)return failure('NO_APPROVED_MATCH',{pattern,setting});
  const allowed=mapped.filter(exercise=>{
    const tags=Array.isArray(exercise.contraindications)?exercise.contraindications:[];
    return !exclusions.includes(exercise.id)&&!exclusions.includes(pattern)&&!exclusions.includes(exercise.pattern)&&!tags.some(tag=>exclusions.includes(tag));
  });
  if(!allowed.length)return failure('ALL_MATCHES_EXCLUDED',{pattern,setting});
  const difficultyMatched=allowed.filter(exercise=>Number.isInteger(exercise.difficulty)&&exercise.difficulty<=difficulty);
  if(!difficultyMatched.length)return failure('NO_DIFFICULTY_MATCH',{pattern,setting,difficultyCap:difficulty});
  for(const exercise of difficultyMatched){
    const option=availableOption(exercise,equipment);
    if(option)return Object.freeze({ok:true,pattern,setting,exerciseId:exercise.id,exercise:exercise.source,matchedEquipment:Object.freeze([...option])});
  }
  const requiredOptions=[];
  const signatures=new Set();
  for(const exercise of difficultyMatched)for(const option of exercise.equipmentOptions||[]){
    const signature=JSON.stringify(option);
    if(!signatures.has(signature)){signatures.add(signature);requiredOptions.push([...option])}
  }
  return failure('INSUFFICIENT_EQUIPMENT',{pattern,setting,requiredOptions});
}
function clonePlain(value,seen=new WeakSet(),budget={remaining:256}){
  if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return value;
  if(!value||typeof value!=='object'||seen.has(value)||--budget.remaining<0)return undefined;
  seen.add(value);
  try{
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Array.isArray(value)){
      const lengthDescriptor=descriptors.length;
      if(!lengthDescriptor||!own(lengthDescriptor,'value')||Reflect.ownKeys(descriptors).length!==lengthDescriptor.value+1)return undefined;
      const result=[];
      for(let index=0;index<lengthDescriptor.value;index++){
        const descriptor=descriptors[String(index)];
        if(!descriptor||!own(descriptor,'value'))return undefined;
        const cloned=clonePlain(descriptor.value,seen,budget);
        if(cloned===undefined)return undefined;
        result.push(cloned);
      }
      return result;
    }
    const proto=Object.getPrototypeOf(value);
    if(proto!==Object.prototype&&proto!==null)return undefined;
    const result={};
    for(const key of Reflect.ownKeys(descriptors)){
      if(typeof key!=='string'||dangerousKey(key)||!own(descriptors[key],'value'))return undefined;
      const cloned=clonePlain(descriptors[key].value,seen,budget);
      if(cloned===undefined)return undefined;
      result[key]=cloned;
    }
    return result;
  }catch(_error){return undefined}
  finally{seen.delete(value)}
}
function cloneAction(action){
  try{
    if(!action||typeof action!=='object'||Array.isArray(action))return null;
    const descriptors=Object.getOwnPropertyDescriptors(action);
    const clone={};
    for(const key of Reflect.ownKeys(descriptors)){
      if(typeof key!=='string'||dangerousKey(key)||!ACTION_FIELDS.includes(key)||!own(descriptors[key],'value'))return null;
      const value=descriptors[key].value;
      if(key==='exclusions'){
        const exclusions=stringArray(value,{max:32});
        if(!exclusions)return null;
        clone[key]=exclusions;
      }else{
        if(!validActionScalar(key,value))return null;
        clone[key]=value;
      }
    }
    return clone;
  }catch(_error){return null}
}
function swapSessionSetting(session,targetSetting,catalog=catalogApi.exerciseCatalog){
  try{if(!session||typeof session!=='object'||Array.isArray(session)||!SUPPORTED_SETTINGS.includes(targetSetting))return failure('INVALID_SESSION')}catch(_error){return failure('INVALID_SESSION')}
  const intent=ownValue(session,'intent');
  const currentSetting=ownValue(session,'setting');
  const equipmentBySetting=ownValue(session,'equipmentBySetting');
  const actions=arrayValues(ownValue(session,'actions'),{max:64});
  try{if(typeof intent!=='string'||!SUPPORTED_SETTINGS.includes(currentSetting)||!equipmentBySetting||typeof equipmentBySetting!=='object'||Array.isArray(equipmentBySetting)||!actions)return failure('INVALID_SESSION')}catch(_error){return failure('INVALID_SESSION')}
  const targetEquipment=stringArray(ownValue(equipmentBySetting,targetSetting),{max:32});
  if(!targetEquipment)return failure('INVALID_SESSION');
  const approved=safeCatalog(catalog);
  if(!approved)return failure('INVALID_SESSION');
  const approvedById=new Map(approved.map(exercise=>[exercise.id,exercise]));
  const sessionExclusions=own(session,'exclusions')?stringArray(ownValue(session,'exclusions'),{max:32}):[];
  if(!sessionExclusions)return failure('INVALID_SESSION');
  const nextActions=[];
  const replacements=[];
  for(let index=0;index<actions.length;index++){
    if(!own(actions,index))return failure('INVALID_SESSION');
    const action=cloneAction(actions[index]);
    if(!action||typeof action.exerciseId!=='string')return failure('INVALID_SESSION');
    const original=approvedById.get(action.exerciseId);
    if(!original)return failure('INVALID_SESSION');
    const derivedPattern=CATALOG_PATTERN_TO_INTENT[original.pattern];
    const pattern=typeof action.pattern==='string'?action.pattern:derivedPattern;
    if(!MOVEMENT_INTENTS.includes(pattern)||pattern!==derivedPattern)return failure('INVALID_SESSION');
    const actionExclusions=own(action,'exclusions')?stringArray(action.exclusions,{max:32}):[];
    if(!actionExclusions)return failure('INVALID_SESSION');
    delete action.exclusions;
    const result=matchExercise({pattern,setting:targetSetting,equipment:targetEquipment,exclusions:[...new Set([...sessionExclusions,...actionExclusions])],difficulty:original.difficulty,catalog});
    if(!result.ok)return failure('SESSION_SWAP_UNAVAILABLE',{actionIndex:index,exerciseId:action.exerciseId,cause:result.error});
    replacements.push({actionIndex:index,fromExerciseId:action.exerciseId,toExerciseId:result.exerciseId,pattern});
    nextActions.push({...action,pattern,exerciseId:result.exerciseId});
  }
  const nextSession={};
  try{
    const descriptors=Object.getOwnPropertyDescriptors(session);
    for(const key of Reflect.ownKeys(descriptors)){
      if(typeof key!=='string'||dangerousKey(key)||!own(descriptors[key],'value'))return failure('INVALID_SESSION');
      if(key==='actions'||key==='setting')continue;
      const cloned=clonePlain(descriptors[key].value);
      if(cloned===undefined)return failure('INVALID_SESSION');
      nextSession[key]=cloned;
    }
  }catch(_error){return failure('INVALID_SESSION')}
  nextSession.setting=targetSetting;
  nextSession.actions=nextActions;
  return deepFreeze({ok:true,session:nextSession,replacements});
}

return Object.freeze({matchExercise,swapSessionSetting,MOVEMENT_INTENTS,SUPPORTED_SETTINGS,MATCH_PRIORITIES,CATALOG_PATTERN_TO_INTENT});
});
