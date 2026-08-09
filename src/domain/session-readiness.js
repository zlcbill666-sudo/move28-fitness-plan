(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory(root);
Move28.domain=Move28.domain||{};
Object.assign(Move28.domain,api);
if(isCommonJS)module.exports=api;
})(globalThis,function(root){
'use strict';

const VERSION='session-readiness.v1';
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const safeArrayIsArray=Array.isArray;
const safeGetPrototypeOf=Object.getPrototypeOf;
const safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
const safeCreate=Object.create;
const safeDefineProperty=Object.defineProperty;
const safeSetPrototypeOf=Object.setPrototypeOf;
const safeOwnKeys=Reflect.ownKeys;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const safeMapHas=Function.prototype.call.bind(Map.prototype.has);
const safeFreeze=Object.freeze;
const nativeObjectPrototype=Object.prototype;
const FIELDS=safeFreeze(['time','equipment','space','noise','energy','symptom']);
const FIELD_SET=new Set(FIELDS);
const VALUES=safeFreeze({
  time:new Set(['full','20_min','15_min']),
  equipment:new Set(['unchanged','bodyweight_only']),
  space:new Set(['normal','limited']),
  noise:new Set(['normal','quiet_only']),
  energy:new Set(['normal','low']),
  symptom:new Set(['none','pain','warning'])
});

const COLLECTION_SENTINEL=safeFreeze(safeCreate(null));
function codeList(){const codes=[];safeSetPrototypeOf(codes,null);return codes}
function addCode(codes,code){safeDefineProperty(codes,codes.length,{value:code,writable:true,enumerable:true,configurable:true})}
function result(route,reasonCodes){
  const output=safeCreate(null);
  safeDefineProperty(output,'version',{value:VERSION,enumerable:true});
  safeDefineProperty(output,'route',{value:route,enumerable:true});
  safeDefineProperty(output,'reasonCodes',{value:safeFreeze(reasonCodes),enumerable:true});
  return safeFreeze(output);
}
function failed(){const codes=codeList();addCode(codes,'input_invalid');return result('stop',codes)}

function isHiddenCollection(value){
  try{safeMapHas(value,COLLECTION_SENTINEL);return true}catch(_error){}
  try{safeSetHas(value,COLLECTION_SENTINEL);return true}catch(_error){}
  return false;
}

function canonicalInput(raw){
  if(!nativeStructuredClone||raw===null||typeof raw!=='object')return null;
  try{
    if(safeArrayIsArray(raw))return null;
    const prototype=safeGetPrototypeOf(raw);
    if(prototype!==nativeObjectPrototype&&prototype!==null)return null;
    if(isHiddenCollection(raw))return null;
    const keys=safeOwnKeys(raw);
    if(keys.length!==FIELDS.length)return null;
    const source=safeCreate(null);
    for(let index=0;index<keys.length;index+=1){
      const key=keys[index];
      if(typeof key!=='string'||!safeSetHas(FIELD_SET,key))return null;
      const descriptor=safeGetOwnPropertyDescriptor(raw,key);
      if(!descriptor||!safeHasOwn(descriptor,'value')||typeof descriptor.value!=='string')return null;
      source[key]=descriptor.value;
    }
    for(let index=0;index<FIELDS.length;index+=1){
      const field=FIELDS[index];
      if(!safeHasOwn(source,field)||!safeSetHas(VALUES[field],source[field]))return null;
    }
    const cloned=nativeStructuredClone(raw);
    if(!cloned||typeof cloned!=='object'||safeArrayIsArray(cloned))return null;
    const clonedPrototype=safeGetPrototypeOf(cloned);
    if(clonedPrototype!==nativeObjectPrototype&&clonedPrototype!==null)return null;
    const clonedKeys=safeOwnKeys(cloned);
    if(clonedKeys.length!==FIELDS.length)return null;
    for(let index=0;index<FIELDS.length;index+=1){
      const field=FIELDS[index],descriptor=safeGetOwnPropertyDescriptor(cloned,field);
      if(!descriptor||!safeHasOwn(descriptor,'value')||descriptor.value!==source[field])return null;
    }
    return source;
  }catch(_error){return null}
}

function routeSessionReadiness(raw){
  const input=canonicalInput(raw);
  if(!input)return failed();
  const reasons=codeList();
  if(input.time==='20_min')addCode(reasons,'time_20_min_unavailable');
  if(input.time==='15_min')addCode(reasons,'time_15_min_unavailable');
  if(input.equipment==='bodyweight_only')addCode(reasons,'equipment_bodyweight_only');
  if(input.space==='limited')addCode(reasons,'space_limited_unavailable');
  if(input.noise==='quiet_only')addCode(reasons,'noise_quiet_only_unavailable');
  if(input.energy==='low')addCode(reasons,'energy_low_unavailable');
  if(input.symptom==='pain')addCode(reasons,'pain_requires_review');
  if(input.symptom==='warning')addCode(reasons,'warning_requires_stop');
  if(input.symptom==='warning')return result('stop',reasons);
  if(input.symptom==='pain')return result('manual_review',reasons);
  if(input.time!=='full'||input.space==='limited'||input.noise==='quiet_only'||input.energy==='low')return result('unavailable',reasons);
  if(input.equipment==='bodyweight_only')return result('adapt_candidate',reasons);
  return result('keep_session',reasons);
}

return safeFreeze({routeSessionReadiness});
});
