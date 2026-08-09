(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS)require('./dashboard.js');
const trustedCatalog=isCommonJS?require('../data/exercise-catalog.js').exerciseCatalog:Move28.data&&Move28.data.exerciseCatalog;
const validatorApi=isCommonJS?require('../domain/plan-validator.js'):Move28.domain;
const storageApi=isCommonJS?require('../storage/local-store.js'):Move28.storage;
const readinessApi=isCommonJS?require('./session-readiness.js'):Move28.sessionReadiness;
const trustedValidatePlan=validatorApi&&typeof validatorApi.validatePlan==='function'?validatorApi.validatePlan:null;
const trustedLoadState=storageApi&&typeof storageApi.loadState==='function'?storageApi.loadState:null;
const trustedRecordWorkoutCompletion=storageApi&&typeof storageApi.recordWorkoutCompletion==='function'?storageApi.recordWorkoutCompletion:null;
const trustedRecordWorkoutFeedback=storageApi&&typeof storageApi.recordWorkoutFeedback==='function'?storageApi.recordWorkoutFeedback:null;
const trustedRecordWorkoutStop=storageApi&&typeof storageApi.recordWorkoutStop==='function'?storageApi.recordWorkoutStop:null;
const trustedLoadConfirmedAdaptation=readinessApi&&typeof readinessApi.loadConfirmedAdaptation==='function'?readinessApi.loadConfirmedAdaptation:null;
const trustedRevokeConfirmedAdaptation=readinessApi&&typeof readinessApi.revokeConfirmedAdaptation==='function'?readinessApi.revokeConfirmedAdaptation:null;
const api=factory(root,Move28,trustedCatalog,trustedValidatePlan,trustedLoadState,trustedRecordWorkoutCompletion,trustedRecordWorkoutFeedback,trustedRecordWorkoutStop,trustedLoadConfirmedAdaptation,trustedRevokeConfirmedAdaptation);
if(isCommonJS)module.exports=api;
})(globalThis,function(root,Move28,trustedCatalog,trustedValidatePlan,trustedLoadState,trustedRecordWorkoutCompletion,trustedRecordWorkoutFeedback,trustedRecordWorkoutStop,trustedLoadConfirmedAdaptation,trustedRevokeConfirmedAdaptation){
'use strict';
const state=Move28.state;
const {$,esc,storage}=Move28.utils;
const MUSIC={warmup:{src:'assets/audio/warmup-rising-forest.mp3',title:'Rising Forest',author:'Diego Nava · 热身'},strength:{src:'assets/audio/strength-deep-urban.mp3',title:'Deep Urban',author:'Eugenio Mininni · 力量'},cardio:{src:'assets/audio/cardio-techno-fest-vibes.mp3',title:'Techno Fest Vibes',author:'Alejandro Magaña (A. M.) · 有氧'},recovery:{src:'assets/audio/recovery-summer-dream.mp3',title:'Summer Dream',author:'Eugenio Mininni · 放松'}};
let activeAdaptation=null;
const WEEKDAY_LABELS={mon:'周一',tue:'周二',wed:'周三',thu:'周四',fri:'周五',sat:'周六',sun:'周日'};
function sessionIntentLabel(intent){return intent==='full_body_strength'?'全身力量':intent==='low_impact_cardio'?'低冲击有氧':intent==='recovery'?'恢复训练':'计划受限'}
const STOP_REASONS=Object.freeze([['chest_pain_or_pressure','胸部不适或压迫感'],['near_faint_or_faint','明显晕厥感或已经晕厥'],['abnormal_shortness_of_breath','异常气短'],['sudden_severe_pain','突发剧痛'],['unable_to_bear_weight','无法承重'],['neurologic_or_consciousness_change','意识或神经异常']].map(Object.freeze));
const FEEDBACK_OPTIONS=Object.freeze([['too_easy','轻松偏简单'],['appropriate','刚刚好'],['too_hard','太难了'],['pain','出现疼痛']].map(Object.freeze));
const SAFETY_RULE='胸部不适、晕厥感、异常气短、突发剧痛、无法承重、意识或神经异常时应立即停止，并按情况联系急救或合适的专业人员。';
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const safeArrayIsArray=Array.isArray,safeGetPrototypeOf=Object.getPrototypeOf,safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor,safeObjectKeys=Object.keys,safeOwnKeys=Reflect.ownKeys;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),safeArraySome=Function.prototype.call.bind(Array.prototype.some),safeArrayEvery=Function.prototype.call.bind(Array.prototype.every),safeArrayIncludes=Function.prototype.call.bind(Array.prototype.includes),safeArrayMap=Function.prototype.call.bind(Array.prototype.map),safeArrayJoin=Function.prototype.call.bind(Array.prototype.join),safeArrayFind=Function.prototype.call.bind(Array.prototype.find),safeArrayPush=Function.prototype.call.bind(Array.prototype.push),safeArrayPop=Function.prototype.call.bind(Array.prototype.pop),safeSetHas=Function.prototype.call.bind(Set.prototype.has),safeMapGet=Function.prototype.call.bind(Map.prototype.get),safeMapSet=Function.prototype.call.bind(Map.prototype.set),safeWeakSetHas=Function.prototype.call.bind(WeakSet.prototype.has),safeWeakSetAdd=Function.prototype.call.bind(WeakSet.prototype.add),safeRegexTest=Function.prototype.call.bind(RegExp.prototype.test),safeDateToISOString=Function.prototype.call.bind(Date.prototype.toISOString);
const safeNumberIsFinite=Number.isFinite,safeNumberIsSafeInteger=Number.isSafeInteger,safeObjectIs=Object.is,SafeSet=Set,SafeWeakSet=WeakSet,SafeMap=Map,SafeDate=Date,SafeString=String,nativeObjectPrototype=Object.prototype;
const DANGEROUS_KEYS=new SafeSet(['__proto__','prototype','constructor']),UTC_ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function plainRecord(value){
  if(!value||typeof value!=='object'||safeArrayIsArray(value))return false;
  const proto=safeGetPrototypeOf(value);return proto===nativeObjectPrototype||proto===null;
}
function clonePureData(value){
  if(!nativeStructuredClone)return null;
  try{
    const stack=[{value,depth:0}],seen=new SafeWeakSet();let nodes=0;
    while(stack.length){
      const current=safeArrayPop(stack),item=current.value;nodes+=1;
      if(nodes>4096||current.depth>32)return null;
      if(item===null||typeof item==='string'||typeof item==='boolean')continue;
      if(typeof item==='number'){if(!safeNumberIsFinite(item)||safeObjectIs(item,-0))return null;continue}
      if(typeof item!=='object'||safeWeakSetHas(seen,item))return null;
      safeWeakSetAdd(seen,item);
      const isArray=safeArrayIsArray(item);if(!isArray&&!plainRecord(item))return null;
      const keys=safeOwnKeys(item);if(safeArraySome(keys,key=>typeof key!=='string'||safeSetHas(DANGEROUS_KEYS,key)))return null;
      if(isArray){
        const lengthDescriptor=safeGetOwnPropertyDescriptor(item,'length');
        if(!lengthDescriptor||!safeHasOwn(lengthDescriptor,'value')||!safeNumberIsSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0||lengthDescriptor.value>256)return null;
        if(keys.length!==lengthDescriptor.value+1)return null;
        for(let index=0;index<lengthDescriptor.value;index+=1)if(keys[index]!==SafeString(index))return null;
      }
      for(let index=0;index<keys.length;index+=1){
        const key=keys[index];if(key==='length'&&isArray)continue;
        const descriptor=safeGetOwnPropertyDescriptor(item,key);
        if(!descriptor||!safeHasOwn(descriptor,'value'))return null;
        safeArrayPush(stack,{value:descriptor.value,depth:current.depth+1});
      }
    }
    return nativeStructuredClone(value);
  }catch(_error){return null}
}
function ownData(object,key){
  try{const descriptor=safeGetOwnPropertyDescriptor(object,key);return descriptor&&safeHasOwn(descriptor,'value')?descriptor.value:undefined}catch(_error){return undefined}
}
function doseText(action){
  return action.phase==='main'
    ?`${action.sets}组 × ${action.reps}次 · RPE ${action.rpe} · 组间休息${action.restSec}秒`
    :`${action.durationMin}分钟 · RPE ${action.rpe}${action.restSec?` · 休息${action.restSec}秒`:''}`;
}
function trustedVariantGuidance(action,exercise){
  const controlled=action.pattern==='knee_dominant'||action.pattern==='horizontal_push';
  if(!controlled)return safeHasOwn(action,'variant')?undefined:null;
  if(exercise.pattern!==action.pattern||typeof action.variant!=='string')return undefined;
  if(action.variant==='standard')return safeHasOwn(exercise,'variantGuidance')?undefined:null;
  const guidance=exercise.variantGuidance;
  if(!guidance||typeof guidance!=='object'||safeArrayIsArray(guidance)||!safeHasOwn(guidance,action.variant))return undefined;
  const entry=guidance[action.variant],required=['label','setup','range'];
  if(!entry||typeof entry!=='object'||safeArrayIsArray(entry)||safeObjectKeys(entry).length!==required.length||!safeArrayEvery(required,key=>typeof entry[key]==='string'&&entry[key]))return undefined;
  return entry;
}
function buildWorkoutSteps(session,catalog){
  if(catalog!==trustedCatalog)return null;
  const safeSession=clonePureData(session),safeCatalog=clonePureData(trustedCatalog);
  if(!safeSession||!safeArrayIsArray(safeSession.actions)||safeSession.actions.length===0||!safeArrayIsArray(safeCatalog))return null;
  const exercises=new SafeMap();
  for(let index=0;index<safeCatalog.length;index+=1){const item=safeCatalog[index];if(item&&item.reviewStatus==='approved')safeMapSet(exercises,item.id,item)}
  const steps=[];
  for(let index=0;index<safeSession.actions.length;index+=1){
    const action=safeSession.actions[index],exercise=action&&safeMapGet(exercises,action.exerciseId);
    if(!exercise||!exercise.cues||typeof exercise.gif!=='string')return null;
    const variantGuidance=trustedVariantGuidance(action,exercise);if(variantGuidance===undefined)return null;
    const strength=action.phase==='main';
    if(strength&&!safeArrayEvery([action.sets,action.reps,action.rpe,action.restSec],safeNumberIsFinite))return null;
    if(!strength&&!safeArrayEvery([action.durationMin,action.rpe,action.restSec],safeNumberIsFinite))return null;
    safeArrayPush(steps,{action,exercise,variantGuidance,music:strength?'strength':'cardio',sessionId:safeSession.id,weekday:safeSession.weekday,intent:safeSession.intent});
  }
  return steps;
}
const getWorkoutAudio=()=>$('#workoutAudio');
function persistMusicPreference(key,value){try{storage.setItem(key,value);return true}catch(_error){Move28.ui.showToast?.('音乐偏好未能保存；训练和安全停止仍可继续');return false}}
function updateMusicUI(){
  const workoutAudio=getWorkoutAudio(),m=MUSIC[state.musicKey],playing=!workoutAudio.paused;
  $('#musicDock').classList.toggle('paused',!playing);
  $('#musicToggle').textContent=playing?'Ⅱ':'▶';
  $('#musicToggle').setAttribute('aria-label',playing?'暂停音乐':'播放音乐');
  $('#musicTitle').textContent=m?m.title:'准备播放';
  $('#musicCredit').textContent=m?`${m.author} · Mixkit`:'按训练环节自动切换';
}
function syncGuideMusic(key,allowPlay=true){
  const workoutAudio=getWorkoutAudio(),m=MUSIC[key];if(!m)return;
  if(state.musicKey!==key){state.musicKey=key;workoutAudio.pause();workoutAudio.src=m.src}
  workoutAudio.volume=state.musicVolume;$('#musicVolume').value=Math.round(state.musicVolume*100);
  if(state.musicEnabled&&allowPlay)workoutAudio.play().catch(error=>{if(error.name!=='AbortError'){state.musicEnabled=false;persistMusicPreference('move28-music-enabled','0');updateMusicUI()}});
  updateMusicUI();
}
Move28.toggleWorkoutMusic=()=>{
  const workoutAudio=getWorkoutAudio();
  if(workoutAudio.paused){state.musicEnabled=true;persistMusicPreference('move28-music-enabled','1');workoutAudio.play().catch(()=>Move28.ui.showToast('请再点一次播放音乐'))}
  else{state.musicEnabled=false;persistMusicPreference('move28-music-enabled','0');workoutAudio.pause()}
  updateMusicUI();
};
Move28.setWorkoutVolume=value=>{const workoutAudio=getWorkoutAudio(),numeric=Number(value);state.musicVolume=Number.isFinite(numeric)?Math.max(0,Math.min(1,numeric/100)):0.32;workoutAudio.volume=state.musicVolume;persistMusicPreference('move28-music-volume',String(Math.round(state.musicVolume*100)))};
function setGuideFoot(back,next){
  const backButton=$('#guideBack'),nextButton=$('#guideNext');
  backButton.textContent=back.label;backButton.style.visibility=back.hidden?'hidden':'visible';backButton.disabled=Boolean(back.disabled);
  nextButton.textContent=next.label;nextButton.disabled=Boolean(next.disabled);nextButton.style.visibility=next.hidden?'hidden':'visible';
}
function renderReady(){
  getWorkoutAudio().pause();updateMusicUI();
  $('#guideEyebrow').textContent='BEFORE YOU START';$('#guideTitle').textContent='开始前安全确认';$('#guideBar').style.width='0%';
  $('#guideBody').innerHTML=`<section class="guide-state guide-ready"><span class="guide-state-mark">!</span><h3>先确认身体状态，再开始本节</h3><p>${esc(SAFETY_RULE)}</p><div class="guide-safe-note">如果已经出现上述任一信号，请不要开始训练，直接使用下方停止入口。</div><button class="btn danger-outline guide-stop" type="button" onclick="requestSafetyStop()">暂停 / 停止训练</button></section>`;
  setGuideFoot({label:'退出',hidden:false},{label:'开始本节',hidden:false});
}
function renderAction(){
  const step=state.guideSteps[state.guideStep],total=state.guideSteps.length,exercise=step.exercise,action=step.action,variantGuidance=step.variantGuidance;
  syncGuideMusic(step.music,true);
  $('#guideEyebrow').textContent=`ACTION ${state.guideStep+1} / ${total}`;
  $('#guideTitle').textContent=`${WEEKDAY_LABELS[state.guideSession.weekday]||state.guideSession.weekday} · ${sessionIntentLabel(state.guideSession.intent)}`;
  $('#guideBar').style.width=`${(state.guideStep+1)/total*100}%`;
  const variantHtml=variantGuidance?`<section class="guide-variant"><b>受控变式 · ${esc(variantGuidance.label)}</b><p><strong>设置指导</strong>${esc(variantGuidance.setup)}</p><p><strong>幅度指导</strong>${esc(variantGuidance.range)}</p></section>`:'';
  $('#guideBody').innerHTML=`<div class="guide-action" data-exercise-id="${esc(action.exerciseId)}"><figure class="guide-demo"><img src="${esc(exercise.gif)}" alt="${esc(exercise.name)}动作示范GIF"></figure><div class="guide-instruction"><span class="guide-phase">${state.guideSession.intent==='recovery'?'恢复训练':action.phase==='main'?'力量训练':'低冲击有氧'}</span><h3>${esc(exercise.name)}</h3><div class="guide-dose">${esc(doseText(action))}</div>${variantHtml}<div class="guide-cues"><div class="guide-cue"><b>准备姿势</b>${esc(exercise.cues.setup)}</div><div class="guide-cue"><b>动作要领</b>${esc(exercise.cues.movement)}</div><div class="guide-cue"><b>呼吸节奏</b>${esc(exercise.cues.breathing)}</div><div class="guide-cue"><b>疼痛边界</b>${esc(exercise.cues.pain)}</div></div><div class="guide-runtime-safety"><p>${esc(SAFETY_RULE)}</p><button class="btn danger-outline guide-stop" type="button" onclick="requestSafetyStop()">暂停 / 停止训练</button></div></div></div>`;
  setGuideFoot({label:'← 上一步',hidden:state.guideStep===0},{label:state.guideStep===total-1?'完成本节并记录 ✓':'完成此项，下一项 →'});
}
function renderExitConfirm(){
  getWorkoutAudio().pause();updateMusicUI();$('#guideEyebrow').textContent='ORDINARY EXIT';$('#guideTitle').textContent='普通退出';
  $('#guideBody').innerHTML='<section class="guide-state"><h3>普通退出训练？</h3><p>普通退出不会记录安全事件，也不会使计划失效。你之后仍可重新开始本节。</p></section>';
  setGuideFoot({label:'继续训练'},{label:'确认普通退出'});
}
function renderSafetySelect(){
  getWorkoutAudio().pause();updateMusicUI();$('#guideEyebrow').textContent='SAFETY FIRST';$('#guideTitle').textContent='因不适暂停';
  $('#guideBody').innerHTML=`<section class="guide-state"><h3>选择最符合当前情况的一项</h3><p>不记录自由文本。严重信号会终止当前训练并使旧计划失效。</p><div class="guide-reasons">${safeArrayJoin(safeArrayMap(STOP_REASONS,entry=>`<button type="button" onclick="selectSafetyReason('${entry[0]}')">${esc(entry[1])}</button>`),'')}<button type="button" onclick="selectSafetyReason('joint_pain')">新发关节不适</button></div></section>`;
  setGuideFoot({label:'返回训练'},{label:'',hidden:true});
}
function renderPainPause(){
  $('#guideEyebrow').textContent='PAIN PAUSE';$('#guideTitle').textContent='关节不适处理';
  $('#guideBody').innerHTML='<section class="guide-state"><h3>先暂停并降低幅度或阻力</h3><p>停止当前动作，降低动作幅度或阻力。只有明确缓解后才可以返回；持续或加重必须停止训练。</p><div class="guide-state-actions"><button class="btn" type="button" onclick="resolveGuidePain(true)">调整后已缓解</button><button class="btn danger" type="button" onclick="resolveGuidePain(false)">仍持续或加重</button></div></section>';
  setGuideFoot({label:'',hidden:true},{label:'',hidden:true});
}
function renderSafetyConfirm(){
  $('#guideEyebrow').textContent='STOP CONFIRMATION';$('#guideTitle').textContent='安全停止';
  $('#guideBody').innerHTML=`<section class="guide-state guide-danger"><h3>确认因不适停止</h3><p>确认后会保存固定理由码、当前动作进度和时间，并立即使旧计划失效。不会保存自由文本症状描述。</p><b>${esc(safeArrayFind(STOP_REASONS,entry=>entry[0]===state.guideStopReason)?.[1]||'关节不适仍持续或加重')}</b></section>`;
  setGuideFoot({label:'',hidden:true},{label:'确认停止并保存'});
}
function renderSafetyResult(){
  const failed=state.guideMode==='safety_save_failed';
  $('#guideEyebrow').textContent=failed?'SAVE FAILED':'SAFETY STOPPED';$('#guideTitle').textContent='训练已停止';
  $('#guideBody').innerHTML=`<section class="guide-state ${failed?'guide-warning':'guide-danger'}"><h3>${failed?'停止记录尚未保存':'训练已安全停止'}</h3><p>${failed?'训练保持停止。请检查浏览器存储权限后重试；当前不会恢复训练。':'旧计划已失效，当前训练不会记为整节完成。请重新完成安全筛查后再决定下一步。'}</p>${failed?'':'<div class="guide-state-actions"><button class="btn primary" type="button" onclick="guideRescreen()">重新完成安全筛查</button><button class="btn" type="button" onclick="guideReturnHome()">返回首页</button></div>'}</section>`;
  setGuideFoot({label:'',hidden:true},{label:failed?'重试保存':'',hidden:!failed});
}
function renderFeedback(){
  const saving=state.guideMode==='feedback_saving',failed=state.guideMode==='feedback_failed';
  getWorkoutAudio().pause();updateMusicUI();
  $('#guideEyebrow').textContent='WORKOUT FEEDBACK';$('#guideTitle').textContent='这节训练感觉如何？';$('#guideBar').style.width='100%';
  const buttons=safeArrayJoin(safeArrayMap(FEEDBACK_OPTIONS,entry=>`<button class="btn${entry[0]==='pain'?' danger-outline':''}" type="button" onclick="submitWorkoutFeedback('${entry[0]}')"${saving?' disabled':''}>${esc(entry[1])}</button>`),'');
  $('#guideBody').innerHTML=`<section class="guide-state guide-feedback"><h3>这节训练感觉如何？</h3><p>选择一个固定选项，帮助调整后续训练。</p>${failed?'<p class="guide-feedback-error" role="alert">反馈尚未保存，请检查本机存储后重试。</p>':''}<div class="guide-state-actions guide-feedback-options">${buttons}</div></section>`;
  setGuideFoot({label:'稍后反馈',hidden:false,disabled:saving},{label:'',hidden:true});
}
function renderGuide(){
  if(state.guideMode==='ready')renderReady();else if(state.guideMode==='action')renderAction();else if(state.guideMode==='exit_confirm')renderExitConfirm();else if(state.guideMode==='safety_select')renderSafetySelect();else if(state.guideMode==='pain_pause')renderPainPause();else if(state.guideMode==='safety_confirm')renderSafetyConfirm();else if(safeArrayIncludes(['feedback','feedback_saving','feedback_failed'],state.guideMode))renderFeedback();else renderSafetyResult();
  root.requestAnimationFrame(()=>$('.guide-shell').scrollTo({top:0,behavior:'smooth'}));
}
function sameData(left,right){
  const stack=[[left,right]];
  while(stack.length){const pair=safeArrayPop(stack),a=pair[0],b=pair[1];if(safeObjectIs(a,b))continue;if(!a||!b||typeof a!=='object'||typeof b!=='object'||safeArrayIsArray(a)!==safeArrayIsArray(b))return false;const aKeys=safeObjectKeys(a),bKeys=safeObjectKeys(b);if(aKeys.length!==bKeys.length||safeArraySome(aKeys,(key,index)=>key!==bKeys[index]))return false;for(let index=0;index<aKeys.length;index+=1)safeArrayPush(stack,[a[aKeys[index]],b[bKeys[index]]])}
  return true;
}
function prepareReviewedSession(requestedSession,catalog){
  if(catalog!==trustedCatalog||!trustedLoadState||!trustedValidatePlan)return null;
  const safeRequested=clonePureData(requestedSession);let safeState;
  try{safeState=clonePureData(trustedLoadState())}catch(_error){return null}
  if(!safeRequested||!safeState?.intake||!safeState?.risk||!safeState?.plan)return null;
  const safePlan=safeState.plan,review=safePlan.review;
  if(safePlan.status!=='active'||safePlan.intakeRevision!==safeState.intakeRevision||safePlan.intakeRevision!==review?.intakeRevision||safePlan.capabilityRevision!==safeState.capabilityRevision||safePlan.capabilityRevision!==review?.capabilityRevision||review?.status!=='approved'||review?.planId!==safePlan.id||!safeRegexTest(/^[a-z][a-z0-9._-]{0,63}$/,review?.reviewerId||'')||!safeRegexTest(UTC_ISO,review?.reviewedAt||''))return null;
  const candidate=clonePureData(safePlan);if(!candidate)return null;delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated';
  let validation;try{validation=clonePureData(trustedValidatePlan({plan:candidate,intake:safeState.intake,risk:safeState.risk,capabilityResult:safeState.capabilityResult,capabilityRevision:safeState.capabilityRevision,catalog:trustedCatalog}))}catch(_error){return null}
  if(!validation||validation.ok!==true||!safeArrayIsArray(validation.errors)||validation.errors.length!==0)return null;
  let stored=null;if(!safeArrayIsArray(safePlan.weeks))return null;
  for(let weekIndex=0;weekIndex<safePlan.weeks.length;weekIndex+=1){const sessions=safePlan.weeks[weekIndex]&&safePlan.weeks[weekIndex].sessions;if(!safeArrayIsArray(sessions))return null;for(let sessionIndex=0;sessionIndex<sessions.length;sessionIndex+=1)if(sessions[sessionIndex]&&sessions[sessionIndex].id===safeRequested.id){if(stored)return null;stored=sessions[sessionIndex]}}
  return stored&&sameData(stored,safeRequested)?stored:null;
}
function openWorkout(options){
  if(state.guideMode&&state.guideMode!=='closed')return false;
  const settings=options&&typeof options==='object'?options:{};
  const requestedSession=ownData(settings,'session'),adaptationId=ownData(settings,'adaptationId'),catalog=ownData(settings,'catalog');
  let session=null,guideAdaptation=null;
  if(typeof adaptationId==='string'&&requestedSession===undefined&&catalog===trustedCatalog&&trustedLoadConfirmedAdaptation){
    let loaded=null;try{loaded=trustedLoadConfirmedAdaptation(adaptationId)}catch(_error){loaded=null}
    const safeLoaded=clonePureData(loaded);
    if(safeLoaded&&safeLoaded.adaptationId===adaptationId&&safeLoaded.sourceSessionId===safeLoaded.session?.id){session=safeLoaded.session;guideAdaptation=safeLoaded}
  }else if(adaptationId===undefined&&requestedSession!==undefined){
    session=prepareReviewedSession(requestedSession,catalog);
  }
  const steps=session&&buildWorkoutSteps(session,trustedCatalog);
  if(!steps){Move28.ui.showToast('该训练节无法安全打开，请重新生成计划');return false}
  activeAdaptation=guideAdaptation;
  state.guideSession={id:steps[0].sessionId,weekday:steps[0].weekday,intent:steps[0].intent,adaptationId:guideAdaptation&&guideAdaptation.adaptationId};state.guideStep=0;state.guideSteps=steps;
  const onComplete=ownData(settings,'onComplete'),onFeedback=ownData(settings,'onFeedback'),onStop=ownData(settings,'onStop');
  state.guideOnComplete=typeof onComplete==='function'?onComplete:()=>{};
  state.guideOnFeedback=typeof onFeedback==='function'?onFeedback:()=>{};
  state.guideOnStop=typeof onStop==='function'?onStop:()=>{};
  state.guideFinishing=false;state.guideMode='ready';state.guideResumeMode='ready';state.guideStopReason='';
  $('#guideModal').classList.add('open');$('#guideModal').setAttribute('aria-hidden','false');root.document.body.classList.add('body-guide-open');
  renderGuide();setTimeout(()=>$('.guide-close').focus(),0);return true;
}
function hardCloseGuide(){
  $('#guideModal').classList.remove('open');$('#guideModal').setAttribute('aria-hidden','true');root.document.body.classList.remove('body-guide-open');
  getWorkoutAudio().pause();updateMusicUI();state.guideFinishing=false;state.guideMode='closed';activeAdaptation=null;
}
function exactKeys(value,expected){const keys=plainRecord(value)&&safeObjectKeys(value);return !!(keys&&keys.length===expected.length&&safeArrayEvery(expected,key=>safeHasOwn(value,key)))}
function validatedCompletionState(value,adaptation){
  const safe=clonePureData(value),key=`${adaptation.planId}.${adaptation.sourceSessionId}`,record=safe&&plainRecord(safe.logs)&&safe.logs[key];
  if(!safe||!plainRecord(safe.plan)||safe.plan.id!==adaptation.planId||safe.plan.status!=='active'||!exactKeys(record,['planId','sessionId','adaptationId','status','completedAt'])||record.planId!==adaptation.planId||record.sessionId!==adaptation.sourceSessionId||record.adaptationId!==adaptation.adaptationId||record.status!=='completed'||typeof record.completedAt!=='string'||!safeRegexTest(UTC_ISO,record.completedAt))return null;
  return safe;
}
function validatedStopState(value,adaptation,event){
  const safe=clonePureData(value),key=`safety.${adaptation.planId}.${event.sessionId}`,record=safe&&plainRecord(safe.logs)&&safe.logs[key];
  if(!safe||!plainRecord(safe.plan)||safe.plan.id!==adaptation.planId||safe.plan.status!=='stale'||safe.plan.staleReason!=='runtime-safety-event'||!exactKeys(record,['planId','sessionId','status','reasonCode','actionIndex','occurredAt'])||record.planId!==adaptation.planId||record.sessionId!==event.sessionId||record.status!=='safety_stopped'||record.reasonCode!==event.reasonCode||record.actionIndex!==event.actionIndex||record.occurredAt!==event.occurredAt)return null;
  return safe;
}
function validatedFeedbackState(value,sessionId,feedbackCode){
  const safe=clonePureData(value),plan=safe&&safe.plan,key=plan&&`${plan.id}.${sessionId}`,record=key&&safe.logs&&safe.logs[key];
  if(!safe||!plainRecord(plan)||typeof plan.id!=='string'||plan.capabilityRevision!==safe.capabilityRevision
    ||!plainRecord(record)||record.planId!==plan.id||record.sessionId!==sessionId||record.status!=='completed'
    ||record.capabilityRevision!==safe.capabilityRevision||record.feedbackCode!==feedbackCode
    ||typeof record.feedbackAt!=='string'||!safeRegexTest(UTC_ISO,record.feedbackAt))return null;
  if(feedbackCode==='pain'){
    if(plan.status!=='stale'||plan.staleReason!=='workout_feedback_pain'||plan.staleAt!==record.feedbackAt)return null;
  }else if(plan.status!=='active')return null;
  return safe;
}
function revokeActiveAdaptation(){
  const adaptationId=activeAdaptation&&activeAdaptation.adaptationId;
  if(typeof adaptationId!=='string'||!trustedRevokeConfirmedAdaptation)return false;
  try{return trustedRevokeConfirmedAdaptation(adaptationId)}catch(_error){return false}
}
function persistAdaptedCompletion(){
  if(!activeAdaptation||!trustedLoadConfirmedAdaptation||!trustedRecordWorkoutCompletion)throw new Error('Adapted completion unavailable');
  const adaptationId=activeAdaptation.adaptationId;let current=null;
  try{current=clonePureData(trustedLoadConfirmedAdaptation(adaptationId))}catch(_error){current=null}
  if(!current||current.adaptationId!==adaptationId||current.planId!==activeAdaptation.planId||current.sourceSessionId!==activeAdaptation.sourceSessionId||!sameData(current.manifest,activeAdaptation.manifest))throw new Error('Adapted completion invalid');
  const updated=validatedCompletionState(trustedRecordWorkoutCompletion({planId:current.planId,sessionId:current.sourceSessionId,adaptationId:current.adaptationId,manifest:current.manifest}),current);
  if(!updated)throw new Error('Adapted completion invalid');
  revokeActiveAdaptation();return updated;
}
function persistAdaptedStop(event){
  if(!activeAdaptation||!trustedRecordWorkoutStop)throw new Error('Adapted stop unavailable');
  try{const updated=validatedStopState(trustedRecordWorkoutStop({sessionId:event.sessionId,reasonCode:event.reasonCode,actionIndex:event.actionIndex,occurredAt:event.occurredAt}),activeAdaptation,event);if(!updated)throw new Error('Adapted stop invalid');return updated}
  finally{revokeActiveAdaptation()}
}
Move28.requestGuideExit=()=>{
  if(safeArrayIncludes(['feedback','feedback_failed'],state.guideMode)){hardCloseGuide();return true}
  if(safeArrayIncludes(['pain_pause','safety_confirm','safety_persisting','safety_stopped','safety_save_failed','closed'],state.guideMode))return false;
  if(state.guideMode!=='exit_confirm')state.guideResumeMode=state.guideMode;
  state.guideMode='exit_confirm';renderGuide();return true;
};
Move28.closeGuide=Move28.requestGuideExit;
Move28.requestSafetyStop=()=>{
  if(!safeArrayIncludes(['ready','action'],state.guideMode))return false;
  state.guideResumeMode=state.guideMode;state.guideMode='safety_select';renderGuide();return true;
};
Move28.selectSafetyReason=reason=>{
  if(state.guideMode!=='safety_select')return false;
  if(reason==='joint_pain'){state.guideMode='pain_pause';renderGuide();return true}
  if(!safeArraySome(STOP_REASONS,entry=>entry[0]===reason))return false;
  state.guideStopReason=reason;state.guideMode='safety_confirm';renderGuide();return true;
};
Move28.resolveGuidePain=relieved=>{
  if(state.guideMode!=='pain_pause')return false;
  if(relieved===true){state.guideMode=state.guideResumeMode;renderGuide();return true}
  state.guideStopReason='joint_pain_persisted_or_worsened';state.guideMode='safety_confirm';renderGuide();return true;
};
function persistGuideStop(){
  if(!safeArrayIncludes(['safety_confirm','safety_save_failed'],state.guideMode))return false;
  state.guideMode='safety_persisting';getWorkoutAudio().pause();updateMusicUI();$('#guideNext').disabled=true;
  try{
    const event={type:'safety_stop',sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId,reasonCode:state.guideStopReason,actionIndex:state.guideStep,occurredAt:safeDateToISOString(new SafeDate())};
    if(activeAdaptation){const persistedState=persistAdaptedStop(event);try{state.guideOnStop({...event,type:'safety_persisted',persistedState})}catch(_error){}}
    else state.guideOnStop(event);
    state.guideMode='safety_stopped';renderGuide();return true;
  }catch(_error){state.guideMode='safety_save_failed';renderGuide();return false}
}
Move28.guideRescreen=()=>{
  if(state.guideMode!=='safety_stopped')return false;const reasonCode=state.guideStopReason,callback=state.guideOnStop;hardCloseGuide();callback({type:'rescreen',reasonCode});return true;
};
Move28.guideReturnHome=()=>{if(state.guideMode!=='safety_stopped')return false;hardCloseGuide();return true};
Move28.guideBack=()=>{
  if(safeArrayIncludes(['feedback','feedback_failed'],state.guideMode)){hardCloseGuide();return}
  if(state.guideMode==='exit_confirm'){state.guideMode=state.guideResumeMode;renderGuide();return}
  if(state.guideMode==='safety_select'){state.guideMode=state.guideResumeMode;renderGuide();return}
  if(state.guideMode==='safety_confirm'||state.guideMode==='pain_pause')return;
  if(state.guideMode==='ready'){Move28.requestGuideExit();return}
  if(state.guideMode==='action'&&state.guideStep>0&&!state.guideFinishing){state.guideStep--;renderGuide()}
};
Move28.guideNext=()=>{
  if(state.guideMode==='ready'){state.guideMode='action';renderGuide();return}
  if(state.guideMode==='exit_confirm'){if(activeAdaptation)revokeActiveAdaptation();try{state.guideOnStop({type:'ordinary_exit',sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId,actionIndex:state.guideStep})}catch(_error){}hardCloseGuide();return}
  if(safeArrayIncludes(['safety_confirm','safety_save_failed'],state.guideMode)){persistGuideStop();return}
  if(state.guideMode!=='action'||state.guideFinishing)return;
  if(state.guideStep<state.guideSteps.length-1){state.guideStep++;renderGuide();return}
  state.guideFinishing=true;$('#guideNext').disabled=true;
  try{
    if(activeAdaptation){const persistedState=persistAdaptedCompletion();try{state.guideOnComplete({type:'adapted_completed',sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId,persistedState})}catch(_error){}}
    else state.guideOnComplete({sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId});
    state.guideFinishing=false;state.guideMode='feedback';renderGuide();
  }catch(_error){state.guideFinishing=false;$('#guideNext').disabled=false;Move28.ui.showToast('完成记录保存失败，请检查本机存储后重试')}
};
Move28.submitWorkoutFeedback=feedbackCode=>{
  if(!safeArrayIncludes(['feedback','feedback_failed'],state.guideMode)||!safeArraySome(FEEDBACK_OPTIONS,entry=>entry[0]===feedbackCode)||!trustedRecordWorkoutFeedback)return false;
  state.guideMode='feedback_saving';renderGuide();
  try{
    const persistedState=validatedFeedbackState(trustedRecordWorkoutFeedback({sessionId:state.guideSession.id,feedbackCode}),state.guideSession.id,feedbackCode);
    if(!persistedState)throw new Error('Invalid feedback result');
    const record=persistedState.logs[`${persistedState.plan.id}.${state.guideSession.id}`];
    const callback=state.guideOnFeedback,event={type:'workout_feedback',sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId,feedbackCode,feedbackAt:record.feedbackAt,persistedState};
    hardCloseGuide();
    try{callback(event)}catch(_error){}
    Move28.ui.showToast(feedbackCode==='pain'?'疼痛反馈已保存，请重新完成安全筛查':'训练反馈已保存到本机');
    return true;
  }catch(_error){state.guideMode='feedback_failed';renderGuide();return false}
};
const guide={openWorkout,doseText,renderGuide,updateMusicUI,syncGuideMusic,getWorkoutAudio,MUSIC,SAFETY_RULE,STOP_REASONS};
Object.assign(Move28.guide||{},guide);
Object.defineProperty(Move28.guide,'workoutAudio',{configurable:true,get:getWorkoutAudio});
const actions={closeGuide:Move28.closeGuide,requestGuideExit:Move28.requestGuideExit,requestSafetyStop:Move28.requestSafetyStop,selectSafetyReason:Move28.selectSafetyReason,resolveGuidePain:Move28.resolveGuidePain,guideRescreen:Move28.guideRescreen,guideReturnHome:Move28.guideReturnHome,guideBack:Move28.guideBack,guideNext:Move28.guideNext,submitWorkoutFeedback:Move28.submitWorkoutFeedback,toggleWorkoutMusic:Move28.toggleWorkoutMusic,setWorkoutVolume:Move28.setWorkoutVolume};
if(root.window===root)for(const name of Object.keys(actions))root[name]=actions[name];
return Object.assign({buildWorkoutSteps},guide,actions);
});
