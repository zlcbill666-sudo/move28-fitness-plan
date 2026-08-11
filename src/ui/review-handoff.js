(function(root,factory){
  const isCommonJS=typeof module==='object'&&module.exports;
  const storageApi=isCommonJS?require('../storage/local-store.js'):root.Move28&&root.Move28.storage;
  const api=factory(root,storageApi||{});
  if(isCommonJS)module.exports=api;
  else{const Move28=root.Move28=root.Move28||{};Move28.reviewHandoff=api}
})(globalThis,function(root,storageApi){
'use strict';
const MACHINE_ID=/^[a-z][a-z0-9._-]{0,63}$/;
const PARTICIPANT_ID=/^pilot-[a-z0-9]{1,12}$/;
const MAX_DOSSIER_BYTES=1024*1024;
function fixedFailure(status='failed'){return Object.freeze({ok:false,status})}
function dossierFilename(dossier){
  const participant=dossier&&typeof dossier.participantId==='string'&&PARTICIPANT_ID.test(dossier.participantId)?dossier.participantId:'pilot-local';
  const plan=dossier&&typeof dossier.planId==='string'&&MACHINE_ID.test(dossier.planId)?dossier.planId:'plan-pending';
  return 'move28-review-dossier-'+participant+'-'+plan+'.json';
}
function downloadReviewDossier(dossier,environment=root){
  let url=null;
  const revoke=()=>{if(url===null)return;try{environment.URL.revokeObjectURL(url)}catch(_error){}url=null};
  try{
    if(!dossier||typeof dossier!=='object'||Array.isArray(dossier)||!environment.Blob||!environment.URL
      ||typeof environment.URL.createObjectURL!=='function'||typeof environment.URL.revokeObjectURL!=='function'||!environment.document)return fixedFailure('download_unavailable');
    const blob=new environment.Blob([JSON.stringify(dossier,null,2)],{type:'application/json;charset=utf-8'});
    const anchor=environment.document.createElement('a');
    url=environment.URL.createObjectURL(blob);anchor.href=url;anchor.download=dossierFilename(dossier);anchor.hidden=true;
    environment.document.body.appendChild(anchor);anchor.click();anchor.remove();
    if(typeof environment.setTimeout==='function')environment.setTimeout(revoke,1000);else revoke();
    return Object.freeze({ok:true,status:'download_started',filename:anchor.download});
  }catch(_error){revoke();return fixedFailure('download_failed')}
}
function parseReviewDossierText(text){
  if(typeof text!=='string'||text.length===0||text.length>MAX_DOSSIER_BYTES)return null;
  try{const parsed=JSON.parse(text);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null}catch(_error){return null}
}
const trustedLoad=typeof storageApi.loadState==='function'?storageApi.loadState:null;
const trustedBuild=typeof storageApi.buildDetailedReviewDossier==='function'?storageApi.buildDetailedReviewDossier:null;
const trustedValidate=typeof storageApi.validateReviewDossier==='function'?storageApi.validateReviewDossier:null;
const trustedApprove=typeof storageApi.approveReviewedPlan==='function'?storageApi.approveReviewedPlan:null;
const trustedDeny=typeof storageApi.denyReviewedPlan==='function'?storageApi.denyReviewedPlan:null;
function esc(value){return String(value).replace(/[&<>]/g,char=>char==='&'?'&amp;':char==='<'?'&lt;':'&gt;')}
function createReviewHandoff(options={}){
  const element=options.rootElement,onDecision=typeof options.onDecision==='function'?options.onDecision:()=>{};
  if(!element||typeof element.querySelector!=='function')throw new TypeError('Review handoff root required');
  let imported=null,reviewerId='pilot-reviewer',message='',tone='',mode='idle';
  function currentState(){try{return trustedLoad&&trustedLoad()}catch(_error){return null}}
  function summary(){
    if(!imported)return'';
    return '<dl class=review-dossier-summary><div><dt>Participant</dt><dd>'+esc(imported.participantId)+'</dd></div><div><dt>Plan</dt><dd>'+esc(imported.planId)+'</dd></div><div><dt>Revisions</dt><dd>intake '+esc(imported.intakeRevision)+' · capability '+esc(imported.capabilityRevision)+'</dd></div><div><dt>Safety route</dt><dd>'+esc(imported.riskLevel)+' · '+esc(imported.capabilityStatus)+'</dd></div><div><dt>Validation</dt><dd>'+esc(imported.validationResult)+' · '+esc(imported.lineage&&imported.lineage.validationResult)+'</dd></div><div><dt>Plan scope</dt><dd>'+esc(Array.isArray(imported.weeks)?imported.weeks.length:0)+' weeks · text guidance</dd></div></dl>';
  }
  function pendingMarkup(){
    const safeReviewer=MACHINE_ID.test(reviewerId)?reviewerId:'';
    return '<div class=review-handoff-card><div class=review-handoff-copy><span class=review-handoff-kicker>LOCAL REVIEW HANDOFF</span><h3>计划等待人工复核</h3><p>候选计划仍锁定。先下载固定字段 dossier，再由指定复核人在当前浏览器导入同一文件完成批准或返工。</p><ul><li>文件不含原始健康答案、异常详情或网址健康数据</li><li>不上传服务器；决定仅对当前浏览器中的同一 plan/revision 有效</li><li>动作媒体保持文字替代，blocked GIF 不作为计划批准条件</li></ul></div><div class=review-handoff-actions><button type=button class=btn data-review-action=download>下载复核 dossier</button><span>最终决定必须回到此浏览器完成。</span></div><details class=reviewer-panel '+(imported?'open':'')+'><summary>指定复核人入口</summary><div class=reviewer-panel-body><label class=review-file>导入刚才下载的 dossier<input type=file accept=.json data-review-file></label><div class='+(imported?'review-import-valid':'review-import-status')+'>'+(imported?'已匹配当前本机候选计划。':'尚未导入。任何字段不一致都会拒绝。')+'</div>'+summary()+'<label class=reviewer-id>复核人编号<input type=text value='+safeReviewer+' maxlength=64 data-reviewer-id></label><fieldset class=review-confirmations><legend>批准前逐项确认</legend><label><input type=checkbox data-review-confirm> plan、intake 与 capability revision 与本次会话一致</label><label><input type=checkbox data-review-confirm> 风险、能力、validator 与 lineage 均通过清单核对</label><label><input type=checkbox data-review-confirm> 接受文字指导；blocked 媒体未被当作正常或已批准</label></fieldset><div class=review-decision-actions><button type=button class=btn data-review-action=approve disabled>批准并开放当前计划</button><button type=button class=btn data-review-action=deny disabled>拒绝并要求返工</button></div></div></details><div class=review-handoff-message aria-live=polite>'+esc(message)+'</div></div>';
  }
  function render(state=currentState()){
    if(state&&state.plan&&state.plan.status==='pending_review'){element.hidden=false;element.innerHTML=pendingMarkup();bind();updateControls();return}
    imported=null;
    if(state&&state.plan&&state.plan.status==='stale'&&state.plan.staleReason==='review_denied'){element.hidden=false;element.innerHTML='<div class=review-handoff-card><span class=review-handoff-kicker>REWORK REQUIRED</span><h3>复核未通过，训练继续锁定</h3><p>请修复或重新生成候选计划；旧 dossier 不能再次批准。</p></div>';return}
    element.hidden=true;element.innerHTML='';
  }
  function say(text,kind=''){message=text;tone=kind;const slot=element.querySelector('.review-handoff-message');if(slot){slot.textContent=text;slot.dataset.tone=kind}}
  function updateControls(){
    const id=element.querySelector('[data-reviewer-id]');if(id)reviewerId=id.value.trim();
    const checks=[...element.querySelectorAll('[data-review-confirm]')],validId=MACHINE_ID.test(reviewerId);
    const approve=element.querySelector('[data-review-action=approve]'),deny=element.querySelector('[data-review-action=deny]');
    if(approve)approve.disabled=!(imported&&validId&&checks.length===3&&checks.every(item=>item.checked));
    if(deny)deny.disabled=!(imported&&validId);
  }
  function importDossierText(text){
    const parsed=parseReviewDossierText(text);let valid=false;
    try{valid=Boolean(parsed&&trustedValidate&&trustedValidate(parsed))}catch(_error){}
    imported=valid?parsed:null;mode=valid?'validated':'invalid';message=valid?'dossier 已与当前本机会话匹配；请完成清单后决定。':'dossier 无效、已过期或不属于当前浏览器会话；计划仍保持锁定。';tone=valid?'success':'error';render(currentState());return valid;
  }
  async function importFile(file){
    if(!file||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX_DOSSIER_BYTES||typeof file.text!=='function')return importDossierText('');
    try{return importDossierText(await file.text())}catch(_error){return importDossierText('')}
  }
  function download(){
    try{const dossier=trustedBuild&&trustedBuild();if(!dossier||!trustedValidate||trustedValidate(dossier)!==true)throw new Error('invalid');const result=downloadReviewDossier(dossier);say(result.ok?'复核 dossier 下载已开始；没有数据上传。':'当前浏览器无法下载 dossier；没有数据上传。',result.ok?'success':'error');mode=result.ok?'downloaded':'error';return result}
    catch(_error){say('当前本机会话无法安全导出 dossier；计划仍保持锁定。','error');return fixedFailure('download_failed')}
  }
  function decide(decision){
    updateControls();const button=element.querySelector('[data-review-action='+decision+']');
    if(!imported||!MACHINE_ID.test(reviewerId)||!trustedValidate||trustedValidate(imported)!==true||!button||button.disabled)return false;
    try{const next=decision==='approve'?trustedApprove({reviewerId,dossier:imported}):trustedDeny({reviewerId,dossier:imported});imported=null;mode=decision==='approve'?'approved':'denied';onDecision(next);render(next);return next}
    catch(_error){imported=null;message='决定未保存：dossier 或本机会话已经变化，计划仍保持锁定。';tone='error';render(currentState());return false}
  }
  function bind(){
    const file=element.querySelector('[data-review-file]');if(file)file.addEventListener('change',event=>void importFile(event.target.files&&event.target.files[0]));
    const id=element.querySelector('[data-reviewer-id]');if(id)id.addEventListener('input',updateControls);
    for(const item of element.querySelectorAll('[data-review-confirm]'))item.addEventListener('change',updateControls);
    for(const action of ['download','approve','deny']){const button=element.querySelector('[data-review-action='+action+']');if(button)button.addEventListener('click',()=>action==='download'?download():decide(action))}
  }
  render(options.state||currentState());
  return Object.freeze({render,download,importDossierText,importFile,approve:()=>decide('approve'),deny:()=>decide('deny'),getMode:()=>mode});
}
return Object.freeze({createReviewHandoff,dossierFilename,downloadReviewDossier,parseReviewDossierText,MAX_DOSSIER_BYTES});
});
