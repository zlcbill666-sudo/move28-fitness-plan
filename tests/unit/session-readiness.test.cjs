'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const {projectRoot,clearMove28ModuleCache,loadScript}=require('../helpers/load-script.cjs');

const BASE=Object.freeze({time:'full',equipment:'unchanged',space:'normal',noise:'normal',energy:'normal',symptom:'none'});
const VERSION='session-readiness.v1';
function expected(route,reasonCodes){
  const codes=[...reasonCodes],output=Object.create(null);Object.setPrototypeOf(codes,null);
  Object.assign(output,{version:VERSION,route,reasonCodes:codes});return output;
}
function route(overrides={}){clearMove28ModuleCache();return loadScript('sessionReadiness').routeSessionReadiness({...BASE,...overrides})}

test('完整正常条件只返回keep_session有限结果',()=>{
  assert.deepEqual(route(),expected('keep_session',[]));
});

test('仅器械变化进入adapt_candidate且不生成动作或剂量',()=>{
  const result=route({equipment:'bodyweight_only'});
  assert.deepEqual(result,expected('adapt_candidate',['equipment_bodyweight_only']));
  assert.deepEqual(Object.keys(result),['version','route','reasonCodes']);
  assert.equal(JSON.stringify(result).includes('action'),false);
  assert.equal(JSON.stringify(result).includes('dose'),false);
});

test('缺少审核模型的时间、空间、噪声和精力变化固定unavailable',()=>{
  const cases=[
    [{time:'20_min'},'time_20_min_unavailable'],
    [{time:'15_min'},'time_15_min_unavailable'],
    [{space:'limited'},'space_limited_unavailable'],
    [{noise:'quiet_only'},'noise_quiet_only_unavailable'],
    [{energy:'low'},'energy_low_unavailable']
  ];
  for(const [input,code] of cases)assert.deepEqual(route(input),expected('unavailable',[code]));
  assert.deepEqual(route({time:'20_min',equipment:'bodyweight_only',space:'limited'}),expected('unavailable',['time_20_min_unavailable','equipment_bodyweight_only','space_limited_unavailable']));
});

test('疼痛至少人工复核且警示症状始终最高优先停止',()=>{
  assert.deepEqual(route({equipment:'bodyweight_only',energy:'low',symptom:'pain'}),expected('manual_review',['equipment_bodyweight_only','energy_low_unavailable','pain_requires_review']));
  assert.deepEqual(route({time:'15_min',symptom:'warning'}),expected('stop',['time_15_min_unavailable','warning_requires_stop']));
});

test('缺失、未知字段、错误类型和非法枚举统一固定fail closed',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness');
  const failed=expected('stop',['input_invalid']);
  const invalid=[null,[],42,'x',{}, {...BASE,extra:'x'}, {...BASE,time:'30_min'}, {...BASE,energy:null}, {...BASE,symptom:true}];
  for(const value of invalid)assert.deepEqual(api.routeSessionReadiness(value),failed);
  assert.deepEqual(api.routeSessionReadiness({...BASE,symptom:'warning',extra:'x'}),failed);
  const missingPain={...BASE,symptom:'pain'};delete missingPain.time;
  assert.deepEqual(api.routeSessionReadiness(missingPain),failed);
});

test('六个安全敏感字段的空值或原始非法值统一固定fail closed且不回显',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness'),failed=expected('stop',['input_invalid']);
  for(const field of Object.keys(BASE)){
    const unanswered={...BASE,[field]:''},raw={...BASE,[field]:'RAW_SECRET_EXCEPTION'};
    assert.deepEqual(api.routeSessionReadiness(unanswered),failed);
    const result=api.routeSessionReadiness(raw);
    assert.deepEqual(result,failed);
    assert.equal(JSON.stringify(result).includes(raw[field]),false);
  }
});

test('继承字段和Object.prototype污染不能补齐输入',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness');const failed=expected('stop',['input_invalid']);
  const inherited=Object.assign(Object.create({symptom:'none'}),{time:'full',equipment:'unchanged',space:'normal',noise:'normal',energy:'normal'});
  assert.deepEqual(api.routeSessionReadiness(inherited),failed);
  Object.prototype.symptom='none';
  try{assert.deepEqual(api.routeSessionReadiness({time:'full',equipment:'unchanged',space:'normal',noise:'normal',energy:'normal'}),failed)}finally{delete Object.prototype.symptom}
});

test('accessor、Proxy、隐藏集合与危险键零getter执行并固定fail closed',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness');const failed=expected('stop',['input_invalid']);let reads=0;
  const accessor={...BASE};Object.defineProperty(accessor,'energy',{enumerable:true,get(){reads+=1;throw new Error('SECRET')}});
  const unknownAccessor={...BASE};Object.defineProperty(unknownAccessor,'extra',{enumerable:true,get(){reads+=1;throw new Error('SECRET')}});
  const transparent=new Proxy({...BASE},{});
  const throwing=new Proxy({...BASE},{ownKeys(){throw new Error('SECRET_PROXY')}});
  const revocable=Proxy.revocable({...BASE},{});revocable.revoke();
  for(const value of [accessor,unknownAccessor,transparent,throwing,revocable.proxy])assert.doesNotThrow(()=>assert.deepEqual(api.routeSessionReadiness(value),failed));
  const dangerous={...BASE};Object.defineProperty(dangerous,'__proto__',{value:{polluted:true},enumerable:true});
  assert.deepEqual(api.routeSessionReadiness(dangerous),failed);
  const hidden={};Object.defineProperty(hidden,'secret',{enumerable:true,get(){reads+=1;throw new Error('SECRET_MAP')}});
  const exotic=new Map([['hidden',hidden]]);Object.setPrototypeOf(exotic,Object.prototype);Object.assign(exotic,BASE);
  assert.deepEqual(api.routeSessionReadiness(exotic),failed);
  const disguised=[new Date(),new ArrayBuffer(0),new Uint8Array(0),new DataView(new ArrayBuffer(0)),new Number(1),new Boolean(true),Object(1n)];
  for(const value of disguised){Object.setPrototypeOf(value,Object.prototype);Object.assign(value,BASE);assert.deepEqual(api.routeSessionReadiness(value),failed)}
  assert.equal(reads,0);
});

test('纯函数不修改输入、结果确定且深冻结',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness');const input={...BASE,equipment:'bodyweight_only'};const before=structuredClone(input);
  const first=api.routeSessionReadiness(input),second=api.routeSessionReadiness(input);
  assert.deepEqual(input,before);assert.deepEqual(first,second);assert.notStrictEqual(first,second);
  assert.ok(Object.isFrozen(first));assert.ok(Object.isFrozen(first.reasonCodes));
  assert.throws(()=>{first.route='keep_session'},TypeError);assert.throws(()=>first.reasonCodes.push('x'),TypeError);
});

test('模块加载后篡改关键内建不能执行外部代码或改变正常结果',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness');const before=api.routeSessionReadiness({...BASE});let calls=0;
  const originals={isArray:Array.isArray,getPrototypeOf:Object.getPrototypeOf,getDescriptor:Object.getOwnPropertyDescriptor,create:Object.create,defineProperty:Object.defineProperty,setPrototypeOf:Object.setPrototypeOf,ownKeys:Reflect.ownKeys,hasOwn:Object.prototype.hasOwnProperty,setHas:Set.prototype.has,mapHas:Map.prototype.has,freeze:Object.freeze};
  Array.isArray=()=>{calls+=1;throw new Error('TAMPER')};Object.getPrototypeOf=()=>{calls+=1;throw new Error('TAMPER')};Object.getOwnPropertyDescriptor=()=>{calls+=1;throw new Error('TAMPER')};Object.create=()=>{calls+=1;throw new Error('TAMPER')};Object.defineProperty=()=>{calls+=1;throw new Error('TAMPER')};Object.setPrototypeOf=()=>{calls+=1;throw new Error('TAMPER')};Reflect.ownKeys=()=>{calls+=1;throw new Error('TAMPER')};Object.prototype.hasOwnProperty=()=>{calls+=1;throw new Error('TAMPER')};Set.prototype.has=()=>{calls+=1;throw new Error('TAMPER')};Map.prototype.has=()=>{calls+=1;throw new Error('TAMPER')};Object.freeze=()=>{calls+=1;throw new Error('TAMPER')};
  let after;try{after=api.routeSessionReadiness({...BASE})}finally{Array.isArray=originals.isArray;Object.getPrototypeOf=originals.getPrototypeOf;Object.getOwnPropertyDescriptor=originals.getDescriptor;Object.create=originals.create;Object.defineProperty=originals.defineProperty;Object.setPrototypeOf=originals.setPrototypeOf;Reflect.ownKeys=originals.ownKeys;Object.prototype.hasOwnProperty=originals.hasOwn;Set.prototype.has=originals.setHas;Map.prototype.has=originals.mapHas;Object.freeze=originals.freeze}
  assert.deepEqual(after,before);assert.equal(calls,0);
});

test('返回对象和原因数组隔离原型污染且不执行索引setter',()=>{
  clearMove28ModuleCache();const api=loadScript('sessionReadiness');let calls=0,output,action,error;
  Object.defineProperty(Array.prototype,'0',{configurable:true,set(){calls+=1;throw new Error('ARRAY_SETTER')}});
  Object.defineProperty(Object.prototype,'action',{configurable:true,get(){calls+=1;throw new Error('OBJECT_GETTER')}});
  try{output=api.routeSessionReadiness({...BASE,equipment:'bodyweight_only'});action=output.action}catch(caught){error=caught}finally{delete Array.prototype[0];delete Object.prototype.action}
  assert.equal(error,undefined);assert.equal(action,undefined);assert.equal(calls,0);
  assert.equal(Object.getPrototypeOf(output),null);assert.equal(Object.getPrototypeOf(output.reasonCodes),null);
  assert.deepEqual(output,expected('adapt_candidate',['equipment_bodyweight_only']));
});

test('classic script挂载同一纯API且缺少structuredClone时fail closed',()=>{
  const source=fs.readFileSync(path.join(projectRoot,'src','domain','session-readiness.js'),'utf8');
  const context={Move28:{}};vm.createContext(context);vm.runInContext("globalThis.structuredClone=value=>JSON.parse(JSON.stringify(value))",context);vm.runInContext(source,context);
  assert.equal(typeof context.Move28.domain.routeSessionReadiness,'function');
  const valid=vm.runInContext("JSON.stringify(Move28.domain.routeSessionReadiness({time:'full',equipment:'unchanged',space:'normal',noise:'normal',energy:'normal',symptom:'none'}))",context);
  assert.equal(valid,JSON.stringify(expected('keep_session',[])));
  const noClone={Move28:{}};vm.createContext(noClone);vm.runInContext(source,noClone);
  const unavailable=vm.runInContext("JSON.stringify(Move28.domain.routeSessionReadiness({time:'full',equipment:'unchanged',space:'normal',noise:'normal',energy:'normal',symptom:'none'}))",noClone);
  assert.equal(unavailable,JSON.stringify(expected('stop',['input_invalid'])));
});
