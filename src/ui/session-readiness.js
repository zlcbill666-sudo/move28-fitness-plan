(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){
  Move28.domain=Move28.domain||{};Move28.data=Move28.data||{};Move28.storage=Move28.storage||{};
  Object.assign(Move28.domain,require('../domain/session-readiness.js'),require('../domain/daily-execution-validator.js'),require('../domain/session-adaptation.js'));
  Object.assign(Move28.data,require('../data/exercise-catalog.js'));
  Object.assign(Move28.storage,require('../storage/local-store.js'));
}
const api=factory(root,Move28);Move28.sessionReadiness=api;if(isCommonJS)module.exports=api;
})(globalThis,function(root,Move28){
'use strict';
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const safeArrayIsArray=Array.isArray,safeGetPrototypeOf=Object.getPrototypeOf,safeGetOwnPropertyDescriptors=Object.getOwnPropertyDescriptors,safeObjectKeys=Object.keys,safeOwnKeys=Reflect.ownKeys;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),safeArrayEvery=Function.prototype.call.bind(Array.prototype.every),safeArraySome=Function.prototype.call.bind(Array.prototype.some),safeArrayPush=Function.prototype.call.bind(Array.prototype.push),safeArrayPop=Function.prototype.call.bind(Array.prototype.pop),safeArrayIncludes=Function.prototype.call.bind(Array.prototype.includes),safeArrayJoin=Function.prototype.call.bind(Array.prototype.join),safeSetHas=Function.prototype.call.bind(Set.prototype.has),safeWeakSetHas=Function.prototype.call.bind(WeakSet.prototype.has),safeWeakSetAdd=Function.prototype.call.bind(WeakSet.prototype.add),safeMapGet=Function.prototype.call.bind(Map.prototype.get),safeMapSet=Function.prototype.call.bind(Map.prototype.set),safeMapDelete=Function.prototype.call.bind(Map.prototype.delete),safeMapClear=Function.prototype.call.bind(Map.prototype.clear);
const SafeSet=Set,SafeWeakSet=WeakSet,SafeMap=Map,nativeObjectPrototype=Object.prototype;
const DANGEROUS_KEYS=new SafeSet(['__proto__','prototype','constructor']),MACHINE_ID=/^[a-z][a-z0-9._-]{0,63}$/,ADAPTATION_ID=/^daily\.[a-z0-9._-]{1,494}$/;
const BODYWEIGHT_SUPPORT=Object.freeze([Object.freeze({id:'stable_chair',label:'稳固椅子'}),Object.freeze({id:'exercise_mat',label:'运动垫'}),Object.freeze({id:'wall',label:'墙面'}),Object.freeze({id:'flat_walking_route',label:'平地步行路线'})]);
const READINESS_FIELDS=Object.freeze(['time','equipment','space','noise','energy','symptom']);
const READINESS_VALUES=Object.freeze({time:Object.freeze(['full','20_min','15_min']),equipment:Object.freeze(['unchanged','bodyweight_only']),space:Object.freeze(['normal','limited']),noise:Object.freeze(['normal','quiet_only']),energy:Object.freeze(['normal','low']),symptom:Object.freeze(['none','pain','warning'])});
const trustedRoute=Move28.domain&&typeof Move28.domain.routeSessionReadiness==='function'?Move28.domain.routeSessionReadiness:null;
const trustedPropose=Move28.domain&&typeof Move28.domain.proposeSessionAdaptation==='function'?Move28.domain.proposeSessionAdaptation:null;
const trustedValidateExecution=Move28.domain&&typeof Move28.domain.validateDailyExecution==='function'?Move28.domain.validateDailyExecution:null;
const trustedLoadState=Move28.storage&&typeof Move28.storage.loadState==='function'?Move28.storage.loadState:null;
const capturedCatalog=Move28.data&&safeArrayIsArray(Move28.data.exerciseCatalog)?Move28.data.exerciseCatalog:null;
const confirmedById=new SafeMap();
function plainRecord(value){if(!value||typeof value!=='object'||safeArrayIsArray(value))return false;const prototype=safeGetPrototypeOf(value);return prototype===nativeObjectPrototype||prototype===null}
function clonePureData(value){
  if(!nativeStructuredClone)return null;
  try{
    const pending=[{value,depth:0}],seen=new SafeWeakSet();let nodes=0;
    while(pending.length){
      const item=safeArrayPop(pending),current=item.value;
      if(current===null||typeof current==='string'||typeof current==='boolean')continue;
      if(typeof current==='number'){if(!Number.isFinite(current)||Object.is(current,-0))return null;continue}
      if(!current||typeof current!=='object'||safeWeakSetHas(seen,current)||item.depth>40)return null;
      safeWeakSetAdd(seen,current);if(++nodes>20000)return null;
      const array=safeArrayIsArray(current);if(!array&&!plainRecord(current))return null;
      const descriptors=safeGetOwnPropertyDescriptors(current),keys=safeOwnKeys(descriptors);if(safeArraySome(keys,key=>typeof key!=='string'||safeSetHas(DANGEROUS_KEYS,key)))return null;
      if(array){const length=descriptors.length;if(!length||!safeHasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<0||length.value>512||keys.length!==length.value+1)return null;for(let index=0;index<length.value;index+=1)if(!safeHasOwn(descriptors,String(index)))return null}
      for(let index=0;index<keys.length;index+=1){const key=keys[index];if(array&&key==='length')continue;const descriptor=descriptors[key];if(!descriptor||!safeHasOwn(descriptor,'value'))return null;safeArrayPush(pending,{value:descriptor.value,depth:item.depth+1})}
    }
    return nativeStructuredClone(value);
  }catch(_error){return null}
}
function deepFreeze(value,seen=new SafeWeakSet()){if(!value||typeof value!=='object'||safeWeakSetHas(seen,value))return value;safeWeakSetAdd(seen,value);const keys=safeObjectKeys(value);for(let index=0;index<keys.length;index+=1)deepFreeze(value[keys[index]],seen);return Object.freeze(value)}
function sameData(left,right){const pending=[[left,right]];while(pending.length){const pair=safeArrayPop(pending),a=pair[0],b=pair[1];if(Object.is(a,b))continue;if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||safeArrayIsArray(a)!==safeArrayIsArray(b))return false;const aKeys=safeObjectKeys(a),bKeys=safeObjectKeys(b);if(aKeys.length!==bKeys.length||safeArraySome(aKeys,(key,index)=>key!==bKeys[index]))return false;for(let index=0;index<aKeys.length;index+=1)safeArrayPush(pending,[a[aKeys[index]],b[bKeys[index]]])}return true}
function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))}
function exactRoute(value,route){const safe=clonePureData(value);return safe&&safe.version==='session-readiness.v1'&&safe.route===route&&safeArrayIsArray(safe.reasonCodes)?safe:null}
function validExecution(value){const safe=clonePureData(value);return Boolean(safe&&safe.ok===true&&safeArrayIsArray(safe.errors)&&safe.errors.length===0)}
function currentState(){if(!trustedLoadState)return null;try{return clonePureData(trustedLoadState())}catch(_error){return null}}
function findSession(plan,sessionId){if(!plan||!safeArrayIsArray(plan.weeks))return null;let found=null;for(let weekIndex=0;weekIndex<plan.weeks.length;weekIndex+=1){const sessions=plan.weeks[weekIndex]&&plan.weeks[weekIndex].sessions;if(!safeArrayIsArray(sessions))return null;for(let sessionIndex=0;sessionIndex<sessions.length;sessionIndex+=1){const session=sessions[sessionIndex];if(session&&session.id===sessionId){if(found)return null;found=session}}}return found}
function contextFor(state,sessionId,readiness,equipmentSnapshot){if(!state||!MACHINE_ID.test(sessionId)||!state.plan||!findSession(state.plan,sessionId))return null;return{plan:state.plan,sessionId,intake:state.intake,intakeRevision:state.intakeRevision,risk:state.risk,capabilityProfile:state.capabilityProfile,capabilityRevision:state.capabilityRevision,readiness,equipmentSnapshot}}
function validateManifest(state,manifest){if(!trustedValidateExecution)return false;try{return validExecution(trustedValidateExecution({plan:state.plan,intake:state.intake,intakeRevision:state.intakeRevision,risk:state.risk,capabilityProfile:state.capabilityProfile,capabilityRevision:state.capabilityRevision,manifest}))}catch(_error){return false}}
function rerunCandidate(record){
  if(!record||!trustedRoute||!trustedPropose)return null;const state=currentState();if(!state)return null;
  let route;try{route=exactRoute(trustedRoute(record.readinessInput),'adapt_candidate')}catch(_error){route=null}if(!route)return null;
  const input=contextFor(state,record.sessionId,route,record.equipmentSnapshot);if(!input)return null;let proposal;
  try{proposal=clonePureData(trustedPropose(input))}catch(_error){proposal=null}
  if(!proposal||proposal.status!=='candidate'||proposal.code!=='ADAPTATION_CANDIDATE_READY'||!plainRecord(proposal.manifest)||!validateManifest(state,proposal.manifest))return null;
  return{state,proposal};
}
function loadConfirmedAdaptation(adaptationId){
  if(typeof adaptationId!=='string'||!ADAPTATION_ID.test(adaptationId))return null;
  const stored=safeMapGet(confirmedById,adaptationId);if(!stored||stored.manifest.adaptationId!==adaptationId)return null;
  const rerun=rerunCandidate(stored);if(!rerun||!sameData(rerun.proposal.manifest,stored.manifest))return null;
  const source=findSession(rerun.state.plan,stored.sessionId),execution=rerun.proposal.manifest.executionSession;if(!source||!execution||execution.id!==source.id)return null;
  const safeSession=clonePureData(execution),safeManifest=clonePureData(rerun.proposal.manifest);if(!safeSession||!safeManifest)return null;
  const output={adaptationId,planId:rerun.state.plan.id,sourceSessionId:source.id,session:safeSession,manifest:safeManifest};return deepFreeze(output);
}
function revokeConfirmedAdaptation(adaptationId){return typeof adaptationId==='string'&&ADAPTATION_ID.test(adaptationId)?safeMapDelete(confirmedById,adaptationId):false}
const catalogSnapshot=clonePureData(capturedCatalog)||[],catalogNames=new SafeMap();
for(let index=0;index<catalogSnapshot.length;index+=1){const exercise=catalogSnapshot[index];if(exercise&&typeof exercise.id==='string'&&typeof exercise.name==='string')safeMapSet(catalogNames,exercise.id,exercise.name)}
function sessionIntentLabel(intent){return intent==='full_body_strength'?'全身力量':intent==='low_impact_cardio'?'低冲击有氧':intent==='recovery'?'恢复训练':'受限训练'}
function actionDose(action){return action.phase==='main'?`${action.sets}组×${action.reps}次 · RPE ${action.rpe} · 休息${action.restSec}秒`:`${action.durationMin}分钟 · RPE ${action.rpe}${action.restSec?` · 休息${action.restSec}秒`:''}`}
function variantLabel(variant){return variant==='standard'?'标准版本':variant==='reduced_range'?'缩小幅度':variant==='wall_incline'?'墙面斜板版本':variant==='supported'?'支撑版本':variant?'受控版本':''}
function sessionSummary(session){
  if(!session||!safeArrayIsArray(session.actions))return'';const rows=[];
  for(let index=0;index<session.actions.length;index+=1){const action=session.actions[index],name=action&&safeMapGet(catalogNames,action.exerciseId);if(typeof name!=='string')return'';const variant=variantLabel(action.variant);safeArrayPush(rows,`<li><strong>${escapeHtml(name)}</strong>${variant?`<em>${escapeHtml(variant)}</em>`:''}<small>${escapeHtml(actionDose(action))}</small></li>`)}
  return `<h4>${escapeHtml(sessionIntentLabel(session.intent))}</h4><ul>${safeArrayJoin(rows,'')}</ul><small>${Number.isSafeInteger(session.estimatedMinutes)?session.estimatedMinutes:'—'}分钟</small>`;
}
const FIELD_CONFIG=Object.freeze([
  ['time','可用时间',[['','请选择'],['full','按原计划时长'],['20_min','只有20分钟'],['15_min','只有15分钟']]],
  ['equipment','器械条件',[['','请选择'],['unchanged','与计划一致'],['bodyweight_only','仅徒手与支持条件']]],
  ['space','空间条件',[['','请选择'],['normal','空间正常'],['limited','空间有限']]],
  ['noise','噪声条件',[['','请选择'],['normal','噪声不受限'],['quiet_only','只能安静训练']]],
  ['energy','今日精力',[['','请选择'],['normal','正常'],['low','偏低']]],
  ['symptom','身体信号',[['','请选择'],['none','没有新发不适'],['pain','出现疼痛'],['warning','出现警示信号']]]
]);
function readinessFormMarkup(){
  const fields=FIELD_CONFIG.map(field=>`<label>${escapeHtml(field[1])}<select name="${field[0]}">${field[2].map(option=>`<option value="${option[0]}">${escapeHtml(option[1])}</option>`).join('')}</select></label>`).join('');
  const support=BODYWEIGHT_SUPPORT.map(item=>`<label><input type="checkbox" name="support" value="${item.id}" checked> <span>${escapeHtml(item.label)}</span></label>`).join('');
  return `<div class="readiness-shell" role="document"><header class="readiness-head"><div><span class="readiness-eyebrow">PRE-WORKOUT CHECK</span><h2 id="sessionReadinessTitle">开始前确认今天的条件</h2><p>只选择有限选项；不会改写你的4周计划或长期偏好。</p></div><button class="readiness-close" type="button" aria-label="关闭今天状态确认">×</button></header><div class="readiness-scroll"><div class="readiness-source" aria-label="当前训练节"></div><form class="readiness-form"><div class="readiness-fields">${fields}</div><fieldset class="readiness-support" hidden><legend>今天可用的已审核支持条件</legend><p>只会把勾选项交给受控适配器；不保存为长期偏好。</p><div>${support}</div></fieldset><div class="readiness-actions"><button class="btn primary readiness-check" type="submit">检查今天状态</button></div></form><div class="readiness-result" aria-live="polite"></div></div></div>`;
}
function readForm(form){
  const input={};
  for(let index=0;index<READINESS_FIELDS.length;index+=1){const field=READINESS_FIELDS[index],control=form.elements.namedItem(field),value=control&&control.value;if(typeof value!=='string'||!safeArrayIncludes(READINESS_VALUES[field],value))return null;input[field]=value}
  return input;
}
function showIncomplete(form,resultSlot){
  resultSlot.innerHTML=`<section class='readiness-status warning readiness-incomplete'><b>信息未完成</b><h3>请先完成全部 6 项选择</h3><p>每一项都需要由你主动选择后才能检查今天状态。</p></section>`;
  for(let index=0;index<READINESS_FIELDS.length;index+=1){const field=READINESS_FIELDS[index],control=form.elements.namedItem(field),value=control&&control.value;if(typeof value!=='string'||!safeArrayIncludes(READINESS_VALUES[field],value)){try{if(control&&typeof control.focus==='function')control.focus()}catch(_error){}break}}
  return false;
}
function selectedSupport(form){const result=[];for(let index=0;index<BODYWEIGHT_SUPPORT.length;index+=1){const item=BODYWEIGHT_SUPPORT[index],control=form.querySelector(`input[name="support"][value="${item.id}"]`);if(control&&control.checked)safeArrayPush(result,item.id)}return result}
function blockedMarkup(route){
  if(route==='stop')return '<section class="readiness-status danger"><b>停止优先</b><h3>出现警示信号，请停止训练</h3><p>今天不会开放继续训练入口。请根据情况联系急救或合适的专业人员。</p></section>';
  if(route==='manual_review')return '<section class="readiness-status warning"><b>需要复核</b><h3>今天需要人工复核</h3><p>疼痛变化不能由当日适配自动处理；当前不会开放继续训练入口。</p></section>';
  return '<section class="readiness-status warning"><b>当前不可适配</b><h3>当前条件暂不支持安全适配</h3><p>时间、空间、噪声或精力变化尚无经过审核的减量模型，请不要自行删动作或改剂量。</p></section>';
}
function createSessionReadiness(options){
  const settings=options&&typeof options==='object'?options:{},rootElement=settings.rootElement,onKeep=typeof settings.onKeep==='function'?settings.onKeep:()=>false,onAdapted=typeof settings.onAdapted==='function'?settings.onAdapted:()=>false;
  if(!rootElement||typeof rootElement.innerHTML!=='string')return null;
  rootElement.innerHTML=readinessFormMarkup();
  const form=rootElement.querySelector('.readiness-form'),sourceSlot=rootElement.querySelector('.readiness-source'),resultSlot=rootElement.querySelector('.readiness-result'),supportSlot=rootElement.querySelector('.readiness-support'),closeButton=rootElement.querySelector('.readiness-close');
  let sessionId=null,pendingRecord=null,lastFocus=null,confirming=false;
  function close(){pendingRecord=null;sessionId=null;rootElement.setAttribute('aria-hidden','true');rootElement.classList.remove('open');if(root.document&&root.document.body)root.document.body.classList.remove('body-readiness-open');if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();return true}
  function showSource(){const state=currentState(),source=state&&findSession(state.plan,sessionId);sourceSlot.innerHTML=source?`<span>原计划训练节</span>${sessionSummary(source)}`:'';return source}
  function rerunKeep(readinessInput){
    const state=currentState(),source=state&&findSession(state.plan,sessionId);if(!state||!source||!trustedRoute)return false;
    let route;try{route=exactRoute(trustedRoute(readinessInput),'keep_session')}catch(_error){route=null}if(!route)return false;
    close();return onKeep({sessionId:source.id})===true;
  }
  function renderKeep(readinessInput){resultSlot.innerHTML='<section class="readiness-status ready"><b>条件一致</b><h3>今天可以按原计划进行</h3><p>动作和剂量保持不变。点击后仍会从当前本机状态重新加载并校验原训练节。</p><button class="btn primary readiness-keep" type="button">按原计划继续</button></section>';resultSlot.querySelector('.readiness-keep').onclick=()=>{if(!rerunKeep(readinessInput)){resultSlot.innerHTML='<section class="readiness-status warning"><h3>当前计划或能力档案已经变化</h3><p>请关闭后重新选择训练节。</p></section>'}}}
  function renderCandidate(readinessInput,equipmentSnapshot,proposal,state){
    confirming=false;const source=findSession(state.plan,sessionId),manifest=proposal.manifest;pendingRecord=clonePureData({sessionId,readinessInput,equipmentSnapshot,manifest});
    if(!pendingRecord||!source){resultSlot.innerHTML=blockedMarkup('unavailable');return}
    resultSlot.innerHTML=`<section class="readiness-status candidate"><b>待你确认 · 仅本次</b><h3>已生成受控当日候选</h3><p>原因：器械改为已审核的徒手支持条件。四周原计划不会改变。</p><div class="readiness-comparison" data-adaptation-id="${escapeHtml(manifest.adaptationId)}"><p class="readiness-reason">器械改为已审核的徒手支持条件</p><article><span>原计划</span>${sessionSummary(source)}</article><i aria-hidden="true">→</i><article><span>本次候选</span>${sessionSummary(manifest.executionSession)}</article></div><button class="btn primary readiness-confirm" type="button">确认本次适配</button></section>`;
    resultSlot.querySelector('.readiness-confirm').onclick=()=>{
      if(confirming)return;confirming=true;
      const record=clonePureData(pendingRecord),rerun=rerunCandidate(record);
      if(!record||!rerun||!sameData(rerun.proposal.manifest,record.manifest)){pendingRecord=null;resultSlot.innerHTML='<section class="readiness-status warning"><h3>当前计划或能力档案已经变化</h3><p>候选已作废，请关闭后重新检查今天状态。</p></section>';return}
      const adaptationId=rerun.proposal.manifest.adaptationId,confirmed=clonePureData({...record,manifest:rerun.proposal.manifest});if(!ADAPTATION_ID.test(adaptationId)||!confirmed){resultSlot.innerHTML=blockedMarkup('unavailable');return}
      safeMapSet(confirmedById,adaptationId,deepFreeze(confirmed));const loaded=loadConfirmedAdaptation(adaptationId);if(!loaded){safeMapDelete(confirmedById,adaptationId);resultSlot.innerHTML=blockedMarkup('unavailable');return}
      close();let opened=false;try{opened=onAdapted({adaptationId})===true}catch(_error){opened=false}if(!opened)safeMapDelete(confirmedById,adaptationId);
    };
  }
  function check(){
    pendingRecord=null;resultSlot.innerHTML='';const readinessInput=readForm(form);if(!readinessInput)return showIncomplete(form,resultSlot);if(!trustedRoute){resultSlot.innerHTML=blockedMarkup('unavailable');return false}
    let route;try{route=clonePureData(trustedRoute(readinessInput))}catch(_error){route=null}if(!route||route.version!=='session-readiness.v1'){resultSlot.innerHTML=blockedMarkup('unavailable');return false}
    if(route.route==='keep_session'){renderKeep(readinessInput);return true}
    if(route.route!=='adapt_candidate'){resultSlot.innerHTML=blockedMarkup(route.route);return false}
    const state=currentState(),equipmentSnapshot=selectedSupport(form),input=contextFor(state,sessionId,route,equipmentSnapshot);let proposal;
    try{proposal=input&&trustedPropose?clonePureData(trustedPropose(input)):null}catch(_error){proposal=null}
    if(!state||!proposal||proposal.status!=='candidate'||proposal.code!=='ADAPTATION_CANDIDATE_READY'||!validateManifest(state,proposal.manifest)){resultSlot.innerHTML=blockedMarkup('unavailable');return false}
    renderCandidate(readinessInput,equipmentSnapshot,proposal,state);return true;
  }
  function open(requestedSessionId){
    if(typeof requestedSessionId!=='string'||!MACHINE_ID.test(requestedSessionId))return false;safeMapClear(confirmedById);sessionId=requestedSessionId;pendingRecord=null;confirming=false;const source=showSource();if(!source){sessionId=null;return false}
    form.reset();supportSlot.hidden=true;resultSlot.innerHTML='';lastFocus=root.document&&root.document.activeElement;rootElement.classList.add('open');rootElement.setAttribute('aria-hidden','false');if(root.document&&root.document.body)root.document.body.classList.add('body-readiness-open');const first=form.querySelector('select');if(first&&typeof first.focus==='function')first.focus();return true;
  }
  form.addEventListener('submit',event=>{event.preventDefault();check()});
  for(let index=0;index<READINESS_FIELDS.length;index+=1){const field=READINESS_FIELDS[index],control=form.elements.namedItem(field);control.addEventListener('change',event=>{if(field==='equipment')supportSlot.hidden=event.target.value!=='bodyweight_only';pendingRecord=null;resultSlot.innerHTML=''})}
  closeButton.addEventListener('click',close);
  rootElement.addEventListener('click',event=>{if(event.target===rootElement)close()});
  rootElement.addEventListener('keydown',event=>{if(event.key==='Escape'){close();return}if(event.key!=='Tab')return;const focusable=[...rootElement.querySelectorAll('button:not([hidden]),select:not([hidden]),input:not([hidden])')].filter(item=>!item.disabled);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&root.document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&root.document.activeElement===last){event.preventDefault();first.focus()}});
  return Object.freeze({open,close,check});
}
return Object.freeze({createSessionReadiness,loadConfirmedAdaptation,revokeConfirmedAdaptation});
});
