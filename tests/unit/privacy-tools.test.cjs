'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const{clearMove28ModuleCache,loadScript}=require('../helpers/load-script.cjs');
function api(){clearMove28ModuleCache();return loadScript('privacyTools')}
function memoryStorage(initial={}){
  const values=new Map(Object.entries(initial)),removed=[];
  return{removed,getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>{removed.push(key);values.delete(key)},raw:key=>values.has(key)?values.get(key):null};
}
function withBrowserStorage(localStorage,sessionStorage,run){
  const localDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),sessionDescriptor=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  try{
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:localStorage});
    Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:sessionStorage});
    return run();
  }finally{
    if(localDescriptor)Object.defineProperty(globalThis,'localStorage',localDescriptor);else delete globalThis.localStorage;
    if(sessionDescriptor)Object.defineProperty(globalThis,'sessionStorage',sessionDescriptor);else delete globalThis.sessionStorage;
    clearMove28ModuleCache();
  }
}
test('摘要文件名只使用受控participantId',()=>{const p=api();assert.equal(p.summaryFilename({participantId:'pilot-a1b2'}),'move28-review-summary-pilot-a1b2.json');assert.equal(p.summaryFilename({participantId:'../../secret'}),'move28-review-summary-pilot-local.json')});
test('JSON下载仅使用Blob/object URL并延迟回收',()=>{const calls=[],timers=[];let blobParts=null;const anchor={hidden:false,click(){calls.push('click')},remove(){calls.push('remove')}};const env={Blob:class{constructor(parts,options){blobParts=parts;this.type=options.type}},URL:{createObjectURL(blob){calls.push(['url',blob.type]);return'blob:local'},revokeObjectURL(url){calls.push(['revoke',url])}},document:{createElement(tag){assert.equal(tag,'a');return anchor},body:{appendChild(value){assert.equal(value,anchor);calls.push('append')}}},setTimeout(fn,delay){timers.push([fn,delay])}};const summary={participantId:'pilot-a',riskCodes:[]},result=api().downloadReviewSummary(summary,env);assert.deepEqual(result,{ok:true,status:'download_started',filename:'move28-review-summary-pilot-a.json'});assert.equal(anchor.href,'blob:local');assert.equal(anchor.download,result.filename);assert.equal(JSON.parse(blobParts[0]).participantId,'pilot-a');assert.deepEqual(calls,[['url','application/json;charset=utf-8'],'append','click','remove']);assert.equal(timers[0][1],1000);timers[0][0]();assert.deepEqual(calls.at(-1),['revoke','blob:local'])});
test('Blob URL创建后下载失败会立即回收且不伪称成功',()=>{const revoked=[];const env={Blob:class{},URL:{createObjectURL(){return'blob:failed'},revokeObjectURL(url){revoked.push(url)}},document:{createElement(){return{}},body:{appendChild(){throw new Error('SECRET')}}}};assert.deepEqual(api().downloadReviewSummary({participantId:'pilot-a'},env),{ok:false,status:'download_failed'});assert.deepEqual(revoked,['blob:failed'])});
test('下载能力缺失时固定失败且不尝试网络回退',()=>{let network=0;const result=api().downloadReviewSummary({participantId:'pilot-a'},{fetch(){network++}});assert.deepEqual(result,{ok:false,status:'download_unavailable'});assert.equal(network,0)});
test('CommonJS无浏览器存储时删除返回全部固定partial failure scopes且不泄漏异常',()=>{const result=api().clearAllLocalData();assert.deepEqual(result,{ok:false,status:'partial_failure',failedScopes:['local.pilot','local.tracker','local.currentDay','local.musicEnabled','local.musicVolume','session.onboardingDraft','session.capabilityDraft']});assert.equal(JSON.stringify(result).includes('Error'),false)});
test('删除盘点、尝试并验证全部localStorage和sessionStorage自有key且保留无关key',()=>{
  const localKeys=['move28-pilot-v1','move28-tracker-v1','move28-current-day','move28-music-enabled','move28-music-volume'];
  const sessionKeys=['move28-onboarding-draft-v1','move28-capability-draft-v1'];
  const local=memoryStorage(Object.fromEntries([...localKeys.map(key=>[key,'private']),['unrelated-local','keep']]));
  const session=memoryStorage(Object.fromEntries([...sessionKeys.map(key=>[key,'private']),['unrelated-session','keep']]));
  const result=withBrowserStorage(local,session,()=>api().clearAllLocalData());
  assert.deepEqual(result,{ok:true,status:'deleted',failedScopes:[]});
  assert.deepEqual(local.removed,localKeys);
  assert.deepEqual(session.removed,sessionKeys);
  for(const key of localKeys)assert.equal(local.raw(key),null,key);
  for(const key of sessionKeys)assert.equal(session.raw(key),null,key);
  assert.equal(local.raw('unrelated-local'),'keep');
  assert.equal(session.raw('unrelated-session'),'keep');
});
test('单个remove异常不阻止其他key且残留或异常只返回固定partial_failure scopes',()=>{
  const localKeys=['move28-pilot-v1','move28-tracker-v1','move28-current-day','move28-music-enabled','move28-music-volume'];
  const sessionKeys=['move28-onboarding-draft-v1','move28-capability-draft-v1'];
  const local=memoryStorage(Object.fromEntries(localKeys.map(key=>[key,'private']))),localRemove=local.removeItem;
  local.removeItem=key=>{if(key==='move28-pilot-v1'){local.removed.push(key);throw new Error('SECRET_LOCAL_ERROR')}if(key==='move28-tracker-v1'){local.removed.push(key);return}localRemove(key)};
  const session=memoryStorage(Object.fromEntries(sessionKeys.map(key=>[key,'private']))),sessionRemove=session.removeItem;
  session.removeItem=key=>{if(key==='move28-onboarding-draft-v1'){session.removed.push(key);throw new Error('SECRET_SESSION_ERROR')}if(key==='move28-capability-draft-v1'){session.removed.push(key);return}sessionRemove(key)};
  const result=withBrowserStorage(local,session,()=>api().clearAllLocalData());
  assert.deepEqual(local.removed,localKeys);
  assert.deepEqual(session.removed,sessionKeys);
  assert.deepEqual(result,{ok:false,status:'partial_failure',failedScopes:['local.pilot','local.tracker','session.onboardingDraft','session.capabilityDraft']});
  assert.equal(JSON.stringify(result).includes('SECRET_'),false);
});
