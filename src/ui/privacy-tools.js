(function(root,factory){
  const isCommonJS=typeof module==='object'&&module.exports;
  const storageApi=isCommonJS?require('../storage/local-store.js'):root.Move28&&root.Move28.storage;
  const api=factory(root,storageApi||{});
  if(isCommonJS)module.exports=api;else{const Move28=root.Move28=root.Move28||{};Move28.privacy=api}
})(globalThis,function(root,storageApi){
'use strict';
const trustedExport=typeof storageApi.exportReviewSummary==='function'?storageApi.exportReviewSummary:null;
const trustedClear=typeof storageApi.clearAllDetailed==='function'?storageApi.clearAllDetailed:null;
const LOCAL_FAILURE_SCOPES=Object.freeze(['local.pilot','local.tracker','local.currentDay','local.musicEnabled','local.musicVolume']);
const LOCAL_FAILURE_SCOPE_SET=new Set(LOCAL_FAILURE_SCOPES);
const SESSION_STORAGE_ENTRIES=Object.freeze([
  Object.freeze({key:'move28-onboarding-draft-v1',scope:'session.onboardingDraft'}),
  Object.freeze({key:'move28-capability-draft-v1',scope:'session.capabilityDraft'})
]);
let trustedSession=null;
try{const candidate=root.sessionStorage;if(candidate&&typeof candidate.getItem==='function'&&typeof candidate.removeItem==='function')trustedSession=candidate}catch(_error){trustedSession=null}
function fixedFailure(status='failed'){return Object.freeze({ok:false,status})}
function summaryFilename(summary){const id=summary&&typeof summary.participantId==='string'&&/^pilot-[a-z0-9]{1,12}$/.test(summary.participantId)?summary.participantId:'pilot-local';return`move28-review-summary-${id}.json`}
function downloadReviewSummary(summary,environment=root){
  let url=null;
  const revoke=()=>{if(url===null)return;try{environment.URL.revokeObjectURL(url)}catch(_error){}url=null};
  try{
    if(!summary||typeof summary!=='object'||!environment.Blob||!environment.URL||typeof environment.URL.createObjectURL!=='function'||typeof environment.URL.revokeObjectURL!=='function'||!environment.document)return fixedFailure('download_unavailable');
    const blob=new environment.Blob([JSON.stringify(summary,null,2)],{type:'application/json;charset=utf-8'}),anchor=environment.document.createElement('a');
    url=environment.URL.createObjectURL(blob);anchor.href=url;anchor.download=summaryFilename(summary);anchor.hidden=true;environment.document.body.appendChild(anchor);anchor.click();anchor.remove();
    if(typeof environment.setTimeout==='function')environment.setTimeout(revoke,1000);else revoke();
    return Object.freeze({ok:true,status:'download_started',filename:anchor.download});
  }catch(_error){revoke();return fixedFailure('download_failed')}
}
function clearAllLocalData(){
  const failed=new Set();let localResult=null;
  try{localResult=trustedClear&&trustedClear()}catch(_error){localResult=null}
  if(!localResult||localResult.ok!==true){
    const reported=localResult&&Array.isArray(localResult.failedScopes)?localResult.failedScopes:[];
    for(const scope of LOCAL_FAILURE_SCOPES)if(reported.includes(scope))failed.add(scope);
    if(!reported.some(scope=>LOCAL_FAILURE_SCOPE_SET.has(scope)))for(const scope of LOCAL_FAILURE_SCOPES)failed.add(scope);
  }
  if(!trustedSession){
    for(const entry of SESSION_STORAGE_ENTRIES)failed.add(entry.scope);
  }else{
    for(const entry of SESSION_STORAGE_ENTRIES){try{trustedSession.removeItem(entry.key)}catch(_error){failed.add(entry.scope)}}
    for(const entry of SESSION_STORAGE_ENTRIES){try{if(trustedSession.getItem(entry.key)!==null)failed.add(entry.scope)}catch(_error){failed.add(entry.scope)}}
  }
  const failedScopes=Object.freeze([...failed]);
  return Object.freeze({ok:failedScopes.length===0,status:failedScopes.length===0?'deleted':'partial_failure',failedScopes});
}
function createPrivacyTools(options={}){
  const element=options.rootElement,onCleared=typeof options.onCleared==='function'?options.onCleared:()=>{try{root.location.reload()}catch(_error){}};
  if(!element||typeof element.querySelector!=='function')throw new TypeError('Privacy root required');
  let mode='idle';
  function render(message=''){
    element.innerHTML=`<div class="privacy-card"><div><span class="privacy-kicker">只存本机</span><h3>本机数据与隐私</h3><p>问卷、计划和记录默认只保存在当前浏览器。给确认人看的摘要不含原始健康答案。</p></div><div class="privacy-actions"><button type="button" data-action="view">查看本机保存摘要</button><button type="button" data-action="download">下载给确认人的摘要</button><button type="button" class="privacy-danger" data-action="delete">删除本机全部数据</button></div><div class="privacy-output" aria-live="polite"></div><small>删除会清除问卷、计划、训练记录、周复盘、旧追踪、偏好及当前标签页草稿。已下载的CSV/JSON文件需自行删除。</small></div>`;
    const output=element.querySelector('.privacy-output');if(message){output.textContent=message;output.classList.add('open')}
  }
  function summary(){if(!trustedExport)throw new Error('unavailable');return trustedExport()}
  function view(){try{const output=element.querySelector('.privacy-output');output.textContent=JSON.stringify(summary(),null,2);output.classList.add('open');mode='ready';return true}catch(_error){render('本机数据暂时无法安全读取，请稍后重试。');mode='error';return false}}
  function download(){try{const result=downloadReviewSummary(summary());render(result.ok?'确认摘要下载已开始。':'当前浏览器无法下载摘要，数据没有上传。');mode=result.ok?'downloaded':'error';return result}catch(_error){render('当前浏览器无法下载摘要，数据没有上传。');mode='error';return fixedFailure('download_failed')}}
  function requestDelete(){const output=element.querySelector('.privacy-output');output.innerHTML='<div class="privacy-confirm"><strong>确认删除当前浏览器中的全部 Move28 数据？</strong><p>此操作无法撤销，但不会删除你此前下载到设备的CSV或JSON文件。</p><button type="button" data-action="confirm-delete">确认永久删除</button><button type="button" data-action="cancel-delete">取消</button></div>';output.classList.add('open');mode='confirm_delete'}
  function confirmDelete(){mode='deleting';const result=clearAllLocalData();if(result.ok){mode='deleted';onCleared();return result}render('部分本机数据未能删除，请关闭其他页面后重试。未显示删除成功。');mode='error';return result}
  function handle(event){const button=event.target&&event.target.closest&&event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='view')view();else if(action==='download')download();else if(action==='delete')requestDelete();else if(action==='confirm-delete')confirmDelete();else if(action==='cancel-delete'){mode='idle';render()}}
  element.addEventListener('click',handle);render();
  return Object.freeze({view,download,requestDelete,confirmDelete,getMode:()=>mode,destroy(){element.removeEventListener('click',handle)}});
}
return Object.freeze({createPrivacyTools,downloadReviewSummary,clearAllLocalData,summaryFilename});
});
