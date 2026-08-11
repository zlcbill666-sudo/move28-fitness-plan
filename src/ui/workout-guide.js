(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS)require('./dashboard.js');
const trustedCatalog=isCommonJS?require('../data/exercise-catalog.js').exerciseCatalog:Move28.data&&Move28.data.exerciseCatalog;
const validatorApi=isCommonJS?require('../domain/plan-validator.js'):Move28.domain;
const storageApi=isCommonJS?require('../storage/local-store.js'):Move28.storage;
const mediaPolicyApi=isCommonJS?require('../data/exercise-media-policy.js'):Move28.data&&Move28.data.exerciseMediaPolicy;
const readinessApi=isCommonJS?require('./session-readiness.js'):Move28.sessionReadiness;
const trustedValidatePlan=validatorApi&&typeof validatorApi.validatePlan==='function'?validatorApi.validatePlan:null;
const trustedLoadState=storageApi&&typeof storageApi.loadState==='function'?storageApi.loadState:null;
const trustedRecordWorkoutCompletion=storageApi&&typeof storageApi.recordWorkoutCompletion==='function'?storageApi.recordWorkoutCompletion:null;
const trustedRecordWorkoutFeedback=storageApi&&typeof storageApi.recordWorkoutFeedback==='function'?storageApi.recordWorkoutFeedback:null;
const trustedRecordWorkoutStop=storageApi&&typeof storageApi.recordWorkoutStop==='function'?storageApi.recordWorkoutStop:null;
const trustedMediaPresentation=mediaPolicyApi&&typeof mediaPolicyApi.presentationFor==='function'?mediaPolicyApi.presentationFor:null;
const trustedLoadConfirmedAdaptation=readinessApi&&typeof readinessApi.loadConfirmedAdaptation==='function'?readinessApi.loadConfirmedAdaptation:null;
const trustedRevokeConfirmedAdaptation=readinessApi&&typeof readinessApi.revokeConfirmedAdaptation==='function'?readinessApi.revokeConfirmedAdaptation:null;
const nativeJSONParse=JSON.parse.bind(JSON);
let trustedReadRawState=null;
try{
  const storageKey=storageApi&&storageApi.STORAGE_KEY,adapter=root.localStorage,prototype=root.Storage&&root.Storage.prototype,getItem=prototype&&prototype.getItem;
  if(typeof storageKey==='string'&&adapter&&typeof getItem==='function'){const safeGetItem=Function.prototype.call.bind(getItem);trustedReadRawState=()=>{const serialized=safeGetItem(adapter,storageKey);return typeof serialized==='string'?nativeJSONParse(serialized):null}}
}catch(_error){trustedReadRawState=null}
const api=factory(root,Move28,trustedCatalog,trustedValidatePlan,trustedLoadState,trustedRecordWorkoutCompletion,trustedRecordWorkoutFeedback,trustedRecordWorkoutStop,trustedMediaPresentation,trustedLoadConfirmedAdaptation,trustedRevokeConfirmedAdaptation,trustedReadRawState);
if(isCommonJS)module.exports=api;
})(globalThis,function(root,Move28,trustedCatalog,trustedValidatePlan,trustedLoadState,trustedRecordWorkoutCompletion,trustedRecordWorkoutFeedback,trustedRecordWorkoutStop,trustedMediaPresentation,trustedLoadConfirmedAdaptation,trustedRevokeConfirmedAdaptation,trustedReadRawState){
'use strict';
const state=Move28.state;
const {$,esc,storage}=Move28.utils;
const MUSIC={warmup:{src:'assets/audio/warmup-rising-forest.mp3',title:'Rising Forest',author:'Diego Nava · 热身'},strength:{src:'assets/audio/strength-deep-urban.mp3',title:'Deep Urban',author:'Eugenio Mininni · 力量'},cardio:{src:'assets/audio/cardio-techno-fest-vibes.mp3',title:'Techno Fest Vibes',author:'Alejandro Magaña (A. M.) · 有氧'},recovery:{src:'assets/audio/recovery-summer-dream.mp3',title:'Summer Dream',author:'Eugenio Mininni · 放松'}};
let activeAdaptation=null,activeGuideSnapshot=null,guideStartedAtMs=null,guideCompletionSummary=null;
const WEEKDAY_LABELS={mon:'周一',tue:'周二',wed:'周三',thu:'周四',fri:'周五',sat:'周六',sun:'周日'};
function sessionIntentLabel(intent){return intent==='full_body_strength'?'全身力量':intent==='low_impact_cardio'?'低冲击有氧':intent==='recovery'?'恢复训练':'计划受限'}
const STOP_REASONS=Object.freeze([['chest_pain_or_pressure','胸部不适或压迫感'],['near_faint_or_faint','明显晕厥感或已经晕厥'],['abnormal_shortness_of_breath','异常气短'],['sudden_severe_pain','突发剧痛'],['unable_to_bear_weight','无法承重'],['neurologic_or_consciousness_change','意识或神经异常']].map(Object.freeze));
const FEEDBACK_OPTIONS=Object.freeze([['too_easy','轻松偏简单'],['appropriate','刚刚好'],['too_hard','太难了'],['pain','出现疼痛']].map(Object.freeze));
const SAFETY_RULE='胸部不适、晕厥感、异常气短、突发剧痛、无法承重、意识或神经异常时应立即停止，并按情况联系急救或合适的专业人员。';
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const safeArrayIsArray=Array.isArray,safeGetPrototypeOf=Object.getPrototypeOf,safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor,safeObjectKeys=Object.keys,safeOwnKeys=Reflect.ownKeys;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty),safeArraySome=Function.prototype.call.bind(Array.prototype.some),safeArrayEvery=Function.prototype.call.bind(Array.prototype.every),safeArrayIncludes=Function.prototype.call.bind(Array.prototype.includes),safeArrayMap=Function.prototype.call.bind(Array.prototype.map),safeArrayJoin=Function.prototype.call.bind(Array.prototype.join),safeArrayFind=Function.prototype.call.bind(Array.prototype.find),safeArrayPush=Function.prototype.call.bind(Array.prototype.push),safeArrayPop=Function.prototype.call.bind(Array.prototype.pop),safeSetHas=Function.prototype.call.bind(Set.prototype.has),safeMapGet=Function.prototype.call.bind(Map.prototype.get),safeMapSet=Function.prototype.call.bind(Map.prototype.set),safeWeakSetHas=Function.prototype.call.bind(WeakSet.prototype.has),safeWeakSetAdd=Function.prototype.call.bind(WeakSet.prototype.add),safeRegexTest=Function.prototype.call.bind(RegExp.prototype.test),safeDateToISOString=Function.prototype.call.bind(Date.prototype.toISOString);
const safeNumberIsFinite=Number.isFinite,safeNumberIsSafeInteger=Number.isSafeInteger,safeObjectIs=Object.is,safeObjectFreeze=Object.freeze,safeMathFloor=Math.floor,SafeArray=Array,SafeObject=Object,SafeSet=Set,SafeWeakSet=WeakSet,SafeMap=Map,SafeWeakMap=WeakMap,SafeDate=Date,SafeString=String,SafeNumber=Number,SafeRegExp=RegExp,SafeFunction=Function,SafeSymbol=Symbol,SafeBoolean=Boolean,SafeError=Error,SafeTypeError=TypeError,SafeUint8Array=Uint8Array,SafeJSON=JSON,SafeReflect=Reflect,SafeMath=Math,nativeObjectPrototype=Object.prototype;
const safePerformanceNow=root.performance&&typeof root.performance.now==='function'?root.performance.now.bind(root.performance):null;
const COMPLETION_INTRINSICS=[
  [root,'Array',SafeArray],[root,'Object',SafeObject],[root,'Set',SafeSet],[root,'Map',SafeMap],[root,'WeakSet',SafeWeakSet],[root,'WeakMap',SafeWeakMap],[root,'Date',SafeDate],[root,'String',SafeString],[root,'Number',SafeNumber],[root,'RegExp',SafeRegExp],[root,'Function',SafeFunction],[root,'Symbol',SafeSymbol],[root,'Boolean',SafeBoolean],[root,'Error',SafeError],[root,'TypeError',SafeTypeError],[root,'Uint8Array',SafeUint8Array],[root,'JSON',SafeJSON],[root,'Reflect',SafeReflect],[root,'Math',SafeMath],
  [SafeArray,'isArray',safeArrayIsArray],[SafeArray.prototype,'push',SafeArray.prototype.push],[SafeArray.prototype,'pop',SafeArray.prototype.pop],[SafeArray.prototype,'sort',SafeArray.prototype.sort],[SafeArray.prototype,'reverse',SafeArray.prototype.reverse],[SafeArray.prototype,'some',SafeArray.prototype.some],[SafeArray.prototype,'every',SafeArray.prototype.every],[SafeArray.prototype,'map',SafeArray.prototype.map],[SafeArray.prototype,'filter',SafeArray.prototype.filter],[SafeArray.prototype,'find',SafeArray.prototype.find],[SafeArray.prototype,'flat',SafeArray.prototype.flat],[SafeArray.prototype,'flatMap',SafeArray.prototype.flatMap],[SafeArray.prototype,'forEach',SafeArray.prototype.forEach],[SafeArray.prototype,'includes',SafeArray.prototype.includes],[SafeArray.prototype,'indexOf',SafeArray.prototype.indexOf],[SafeArray.prototype,'join',SafeArray.prototype.join],[SafeArray.prototype,'slice',SafeArray.prototype.slice],[SafeArray.prototype,'reduce',SafeArray.prototype.reduce],[SafeArray.prototype,Symbol.iterator,SafeArray.prototype[Symbol.iterator]],
  [SafeObject,'getPrototypeOf',safeGetPrototypeOf],[SafeObject,'getOwnPropertyDescriptor',safeGetOwnPropertyDescriptor],[SafeObject,'getOwnPropertyDescriptors',SafeObject.getOwnPropertyDescriptors],[SafeObject,'keys',safeObjectKeys],[SafeObject,'values',SafeObject.values],[SafeObject,'entries',SafeObject.entries],[SafeObject,'fromEntries',SafeObject.fromEntries],[SafeObject,'assign',SafeObject.assign],[SafeObject,'create',SafeObject.create],[SafeObject,'isFrozen',SafeObject.isFrozen],[SafeObject,'freeze',SafeObject.freeze],[SafeObject,'defineProperty',SafeObject.defineProperty],[SafeObject,'is',safeObjectIs],[SafeObject.prototype,'hasOwnProperty',SafeObject.prototype.hasOwnProperty],
  [SafeReflect,'ownKeys',safeOwnKeys],[SafeNumber,'isFinite',safeNumberIsFinite],[SafeNumber,'isSafeInteger',safeNumberIsSafeInteger],[SafeNumber,'isInteger',SafeNumber.isInteger],[SafeNumber,'isNaN',SafeNumber.isNaN],[SafeNumber,'MAX_SAFE_INTEGER',SafeNumber.MAX_SAFE_INTEGER],[SafeJSON,'parse',SafeJSON.parse],[SafeJSON,'stringify',SafeJSON.stringify],[SafeMath,'floor',safeMathFloor],[SafeMath,'abs',SafeMath.abs],[SafeMath,'min',SafeMath.min],
  [SafeSet.prototype,'add',SafeSet.prototype.add],[SafeSet.prototype,'has',SafeSet.prototype.has],[SafeMap.prototype,'set',SafeMap.prototype.set],[SafeMap.prototype,'get',SafeMap.prototype.get],[SafeMap.prototype,'has',SafeMap.prototype.has],[SafeWeakSet.prototype,'add',SafeWeakSet.prototype.add],[SafeWeakSet.prototype,'delete',SafeWeakSet.prototype.delete],[SafeWeakSet.prototype,'has',SafeWeakSet.prototype.has],[SafeWeakMap.prototype,'set',SafeWeakMap.prototype.set],[SafeWeakMap.prototype,'get',SafeWeakMap.prototype.get],
  [SafeString.prototype,'trim',SafeString.prototype.trim],[SafeString.prototype,'includes',SafeString.prototype.includes],[SafeString.prototype,'padStart',SafeString.prototype.padStart],[SafeString.prototype,'toLowerCase',SafeString.prototype.toLowerCase],[SafeRegExp.prototype,'test',SafeRegExp.prototype.test],[SafeDate.prototype,'toISOString',SafeDate.prototype.toISOString],[Function.prototype,'call',Function.prototype.call],[Function.prototype,'bind',Function.prototype.bind],[Function.prototype,'toString',Function.prototype.toString]
];
if(root.Storage&&root.Storage.prototype&&typeof root.Storage.prototype.getItem==='function')safeArrayPush(COMPLETION_INTRINSICS,[root.Storage.prototype,'getItem',root.Storage.prototype.getItem]);
function completionIntrinsicsIntact(){
  try{for(let index=0;index<COMPLETION_INTRINSICS.length;index+=1){const item=COMPLETION_INTRINSICS[index],descriptor=safeGetOwnPropertyDescriptor(item[0],item[1]);if(!descriptor||!safeHasOwn(descriptor,'value')||descriptor.value!==item[2])return false}return true}catch(_error){return false}
}
const DANGEROUS_KEYS=new SafeSet(['__proto__','prototype','constructor']),UTC_ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,ADAPTATION_ID=/^daily\.[a-z0-9._-]{1,494}$/;
const FEEDBACK_CODES=new SafeSet(['too_easy','appropriate','too_hard','pain']);
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
    if(!exercise||!exercise.cues)return null;
    const variantGuidance=trustedVariantGuidance(action,exercise);if(variantGuidance===undefined)return null;
    const strength=action.phase==='main';
    if(strength&&!safeArrayEvery([action.sets,action.reps,action.rpe,action.restSec],safeNumberIsFinite))return null;
    if(!strength&&!safeArrayEvery([action.durationMin,action.rpe,action.restSec],safeNumberIsFinite))return null;
    safeArrayPush(steps,{action,exercise,variantGuidance,music:strength?'strength':'cardio',sessionId:safeSession.id,weekday:safeSession.weekday,intent:safeSession.intent});
  }
  return steps;
}
function deriveCompletionTiming(session){
  const safeSession=clonePureData(session),maximumElapsedMs=86400000;
  if(!safeSession||!plainRecord(safeSession)||!safeNumberIsSafeInteger(safeSession.estimatedMinutes)||safeSession.estimatedMinutes<=0||!safeArrayIsArray(safeSession.actions)||safeSession.actions.length===0)return null;
  const estimateFloorMs=safeSession.estimatedMinutes*15000;let doseFloorMs=0;
  if(!safeNumberIsFinite(estimateFloorMs)||estimateFloorMs<=0||estimateFloorMs>maximumElapsedMs)return null;
  for(let index=0;index<safeSession.actions.length;index+=1){
    const action=safeSession.actions[index];let actionFloorMs=0;
    if(!plainRecord(action)||typeof action.phase!=='string')return null;
    if(action.phase==='main'){
      if(!safeNumberIsSafeInteger(action.sets)||action.sets<=0||!safeNumberIsSafeInteger(action.reps)||action.reps<=0||!safeNumberIsSafeInteger(action.restSec)||action.restSec<0)return null;
      actionFloorMs=(action.sets*action.reps+(action.sets-1)*action.restSec)*1000;
    }else{
      if(!safeNumberIsSafeInteger(action.durationMin)||action.durationMin<=0||!safeNumberIsSafeInteger(action.restSec)||action.restSec<0)return null;
      actionFloorMs=action.durationMin*60000;
    }
    doseFloorMs+=actionFloorMs;
    if(!safeNumberIsFinite(actionFloorMs)||actionFloorMs<=0||!safeNumberIsFinite(doseFloorMs)||doseFloorMs>maximumElapsedMs)return null;
  }
  const minimumElapsedMs=doseFloorMs>estimateFloorMs?doseFloorMs:estimateFloorMs;
  if(!safeNumberIsFinite(minimumElapsedMs)||minimumElapsedMs<=0||minimumElapsedMs>maximumElapsedMs)return null;
  return safeObjectFreeze({minimumElapsedMs,maximumElapsedMs});
}
function isPlausibleCompletionElapsed(timing,startedAtMs,endedAtMs){
  const safeTiming=clonePureData(timing);
  if(!safeTiming||!plainRecord(safeTiming)||!safeNumberIsFinite(safeTiming.minimumElapsedMs)||safeTiming.minimumElapsedMs<=0||!safeNumberIsFinite(safeTiming.maximumElapsedMs)||safeTiming.maximumElapsedMs<safeTiming.minimumElapsedMs||!safeNumberIsFinite(startedAtMs)||!safeNumberIsFinite(endedAtMs)||endedAtMs<startedAtMs)return false;
  const elapsedMs=endedAtMs-startedAtMs;
  return elapsedMs>=safeTiming.minimumElapsedMs&&elapsedMs<=safeTiming.maximumElapsedMs;
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
function ensureGuideStopButton(){
  let button=$('#guideStop');if(button)return button;
  const foot=root.document&&root.document.querySelector('.guide-foot'),next=$('#guideNext');
  if(!foot||!next)return null;
  button=root.document.createElement('button');button.id='guideStop';button.type='button';
  button.className='btn danger-outline guide-stop guide-stop-fixed';button.dataset.safetyAction='stop';
  button.textContent='暂停 / 停止训练';button.hidden=true;
  button.onclick=()=>Move28.requestSafetyStop();foot.insertBefore(button,next);return button;
}
function setGuideFoot(back,next){
  const backButton=$('#guideBack'),nextButton=$('#guideNext'),stopButton=ensureGuideStopButton();
  backButton.textContent=back.label;backButton.hidden=Boolean(back.hidden);backButton.disabled=Boolean(back.disabled);
  nextButton.textContent=next.label;nextButton.disabled=Boolean(next.disabled);nextButton.hidden=Boolean(next.hidden);
  if(stopButton)stopButton.hidden=!safeArrayIncludes(['ready','action'],state.guideMode);
}
function renderReady(){
  getWorkoutAudio().pause();updateMusicUI();
  $('#guideEyebrow').textContent='BEFORE YOU START';$('#guideTitle').textContent='开始前安全确认';$('#guideBar').style.width='0%';
  $('#guideBody').innerHTML=`<section class="guide-state guide-ready"><span class="guide-state-mark">!</span><h3>先确认身体状态，再开始本节</h3><p>${esc(SAFETY_RULE)}</p><div class="guide-safe-note">如果已经出现上述任一信号，请不要开始训练，直接使用底部常驻的“暂停 / 停止训练”。</div></section>`;
  setGuideFoot({label:'退出',hidden:false},{label:'开始本节',hidden:false});
}
function guideMediaHtml(exercise){
  let presentation=null;try{presentation=trustedMediaPresentation?trustedMediaPresentation(exercise.id):null}catch(_error){presentation=null}
  if(presentation&&presentation.status==='released'&&typeof presentation.src==='string'&&presentation.src)return`<figure class="guide-demo"><img src="${esc(presentation.src)}" alt="${esc(exercise.name)}动作示范"></figure>`;
  const title=presentation&&typeof presentation.title==='string'?presentation.title:'动作媒体暂不可用',message=presentation&&typeof presentation.message==='string'?presentation.message:'请仅按文字动作说明和安全提示执行。';
  return`<aside class="guide-demo guide-media-blocked" role="note" aria-label="${esc(exercise.name)}动作媒体未开放"><span>TEXT-ONLY MODE</span><b>${esc(title)}</b><p>${esc(message)}</p></aside>`;
}
function renderAction(){
  const step=state.guideSteps[state.guideStep],total=state.guideSteps.length,exercise=step.exercise,action=step.action,variantGuidance=step.variantGuidance;
  syncGuideMusic(step.music,true);
  $('#guideEyebrow').textContent=`ACTION ${state.guideStep+1} / ${total}`;
  $('#guideTitle').textContent=`${WEEKDAY_LABELS[state.guideSession.weekday]||state.guideSession.weekday} · ${sessionIntentLabel(state.guideSession.intent)}`;
  $('#guideBar').style.width=`${(state.guideStep+1)/total*100}%`;
  const variantHtml=variantGuidance?`<section class="guide-variant"><b>受控变式 · ${esc(variantGuidance.label)}</b><p><strong>设置指导</strong>${esc(variantGuidance.setup)}</p><p><strong>幅度指导</strong>${esc(variantGuidance.range)}</p></section>`:'';
  $('#guideBody').innerHTML=`<div class="guide-action" data-exercise-id="${esc(action.exerciseId)}">${guideMediaHtml(exercise)}<div class="guide-instruction"><span class="guide-phase">${state.guideSession.intent==='recovery'?'恢复训练':action.phase==='main'?'力量训练':'低冲击有氧'}</span><h3>${esc(exercise.name)}</h3><div class="guide-dose">${esc(doseText(action))}</div>${variantHtml}<div class="guide-cues"><div class="guide-cue"><b>准备姿势</b>${esc(exercise.cues.setup)}</div><div class="guide-cue"><b>动作要领</b>${esc(exercise.cues.movement)}</div><div class="guide-cue"><b>呼吸节奏</b>${esc(exercise.cues.breathing)}</div><div class="guide-cue"><b>疼痛边界</b>${esc(exercise.cues.pain)}</div></div><div class="guide-runtime-safety"><p>${esc(SAFETY_RULE)} 安全停止入口固定在底部，与下一步同时可见。</p></div></div></div>`;
  setGuideFoot({label:'← 上一步',hidden:state.guideStep===0},{label:state.guideStep===total-1?'完成本节并记录 ✓':'完成此项，下一项 →'});
}
function renderExitConfirm(){
  getWorkoutAudio().pause();updateMusicUI();$('#guideEyebrow').textContent='ORDINARY EXIT';$('#guideTitle').textContent='普通退出';
  $('#guideBody').innerHTML='<section class="guide-state"><h3>普通退出训练？</h3><p>普通退出不会记录安全事件，也不会使计划失效。你之后仍可重新开始本节。</p></section>';
  setGuideFoot({label:'继续训练'},{label:'确认普通退出'});
}
function renderDurationBlocked(){
  getWorkoutAudio().pause();updateMusicUI();$('#guideEyebrow').textContent='NOT COMPLETED';$('#guideTitle').textContent='完成记录保护';
  $('#guideBody').innerHTML=`<section class="guide-state guide-warning"><h3>本节还不能记为完成</h3><p>本次跟练时间短于已审核的预计时长和动作剂量，或计时不可用。为避免生成不真实的完成记录，本节尚未保存为完成。</p><p>你可以继续本节训练，或普通退出并保留为未完成；如有不适，请优先使用安全停止。</p><button class="btn danger-outline guide-stop" type="button" onclick="requestSafetyStop()">暂停 / 停止训练</button></section>`;
  setGuideFoot({label:'继续本节训练'},{label:'普通退出（本节未完成）'});
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
function completedRecordStatus(logs,planId,sessionId,capabilityRevision){
  if(!plainRecord(logs))return null;
  const record=logs[`${planId}.${sessionId}`];
  if(record===undefined)return false;
  if(!plainRecord(record)||record.planId!==planId||record.sessionId!==sessionId||record.status!=='completed'||typeof record.completedAt!=='string'||!safeRegexTest(UTC_ISO,record.completedAt))return null;
  const adapted=safeHasOwn(record,'adaptationId'),hasFeedback=safeHasOwn(record,'capabilityRevision')||safeHasOwn(record,'feedbackCode')||safeHasOwn(record,'feedbackAt');
  const expected=adapted
    ?hasFeedback?['planId','sessionId','adaptationId','status','completedAt','capabilityRevision','feedbackCode','feedbackAt']:['planId','sessionId','adaptationId','status','completedAt']
    :hasFeedback?['planId','sessionId','status','completedAt','capabilityRevision','feedbackCode','feedbackAt']:['planId','sessionId','status','completedAt'];
  if(!exactKeys(record,expected)||(adapted&&(typeof record.adaptationId!=='string'||!safeRegexTest(ADAPTATION_ID,record.adaptationId))))return null;
  if(hasFeedback&&(record.capabilityRevision!==capabilityRevision||!safeSetHas(FEEDBACK_CODES,record.feedbackCode)||typeof record.feedbackAt!=='string'||!safeRegexTest(UTC_ISO,record.feedbackAt)))return null;
  return true;
}
function validatedCompletionPlanState(value,completedSessionId){
  if(!trustedValidatePlan)return null;const current=clonePureData(value),plan=current&&current.plan,review=plan&&plan.review;
  if(!current||!plainRecord(current.intake)||!plainRecord(current.risk)||!plainRecord(current.capabilityResult)||!plainRecord(plan)||!plainRecord(current.logs)
    ||plan.status!=='active'||plan.intakeRevision!==current.intakeRevision||plan.capabilityRevision!==current.capabilityRevision
    ||!plainRecord(review)||review.status!=='approved'||review.planId!==plan.id||review.intakeRevision!==current.intakeRevision||review.capabilityRevision!==current.capabilityRevision
    ||!safeRegexTest(/^[a-z][a-z0-9._-]{0,63}$/,review.reviewerId||'')||!safeRegexTest(UTC_ISO,review.reviewedAt||'')||!safeArrayIsArray(plan.weeks))return null;
  const candidate=clonePureData(plan);if(!candidate)return null;delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated';
  let validation;try{validation=clonePureData(trustedValidatePlan({plan:candidate,intake:current.intake,risk:current.risk,capabilityResult:current.capabilityResult,capabilityRevision:current.capabilityRevision,catalog:trustedCatalog}))}catch(_error){return null}
  if(!validation||validation.ok!==true||!safeArrayIsArray(validation.errors)||validation.errors.length!==0||completedRecordStatus(current.logs,plan.id,completedSessionId,current.capabilityRevision)!==true)return null;
  return current;
}
function deriveNextTraining(value,completedSessionId){
  const current=validatedCompletionPlanState(value,completedSessionId);if(!current)return null;
  const plan=current.plan,sessions=[];let currentIndex=-1;
  for(let weekIndex=0;weekIndex<plan.weeks.length;weekIndex+=1){
    const week=plan.weeks[weekIndex];if(!plainRecord(week)||!safeNumberIsSafeInteger(week.number)||!safeArrayIsArray(week.sessions))return null;
    for(let sessionIndex=0;sessionIndex<week.sessions.length;sessionIndex+=1){
      const session=week.sessions[sessionIndex];if(!plainRecord(session)||typeof session.id!=='string'||typeof session.weekday!=='string'||typeof session.intent!=='string')return null;
      if(session.id===completedSessionId){if(currentIndex!==-1)return null;currentIndex=sessions.length}
      safeArrayPush(sessions,{weekNumber:week.number,session});
    }
  }
  if(currentIndex<0)return null;
  for(let offset=1;offset<sessions.length;offset+=1){
    const candidate=sessions[(currentIndex+offset)%sessions.length],status=completedRecordStatus(current.logs,plan.id,candidate.session.id,current.capabilityRevision);
    if(status===null)return null;
    if(status===false)return {complete:false,weekNumber:candidate.weekNumber,weekday:candidate.session.weekday,intent:candidate.session.intent};
  }
  return {complete:true};
}
function formatElapsedDuration(elapsedMs){
  if(!safeNumberIsFinite(elapsedMs)||elapsedMs<0||elapsedMs>86400000)return '计时不可用';
  const seconds=safeMathFloor(elapsedMs/1000);
  if(seconds<60)return `${seconds}秒`;
  const minutes=safeMathFloor(seconds/60),remainder=seconds%60;
  return remainder?`${minutes}分${remainder}秒`:`${minutes}分钟`;
}
function createCompletionSnapshot(session,steps){
  const timing=deriveCompletionTiming(session);
  if(!timing||!safeArrayIsArray(steps)||steps.length===0)return null;const actions=[];
  for(let index=0;index<steps.length;index+=1){const step=steps[index];if(!plainRecord(step)||!plainRecord(step.action)||!plainRecord(step.exercise)||typeof step.sessionId!=='string'||typeof step.exercise.name!=='string'||(index>0&&step.sessionId!==steps[0].sessionId))return null;safeArrayPush(actions,{name:step.exercise.name,dose:doseText(step.action)})}
  return clonePureData({sessionId:steps[0].sessionId,estimatedMinutes:session.estimatedMinutes,timing,actions});
}

function completionElapsedMs(){
  const snapshot=clonePureData(activeGuideSnapshot),timing=snapshot&&snapshot.timing;let endedAt=null;
  if(!snapshot)return null;
  try{endedAt=safePerformanceNow?safePerformanceNow():null}catch(_error){endedAt=null}
  return isPlausibleCompletionElapsed(timing,guideStartedAtMs,endedAt)?endedAt-guideStartedAtMs:null;
}
function buildCompletionSummary(persistedState,elapsedMs,allowTrustedNext=true){
  const snapshot=clonePureData(activeGuideSnapshot),actions=snapshot&&snapshot.actions;if(!snapshot||typeof snapshot.sessionId!=='string'||!safeArrayIsArray(actions)||actions.length===0)return null;
  for(let index=0;index<actions.length;index+=1){const item=actions[index];if(!plainRecord(item)||typeof item.name!=='string'||typeof item.dose!=='string')return null}
  let rawState=null;
  if(allowTrustedNext&&trustedReadRawState)try{rawState=trustedReadRawState()}catch(_error){rawState=null}
  const next=allowTrustedNext&&rawState&&sameData(persistedState,rawState)?deriveNextTraining(rawState,snapshot.sessionId):null;
  return {actions,duration:formatElapsedDuration(elapsedMs),next};
}
function completionSummaryHtml(){
  const summary=clonePureData(guideCompletionSummary);if(!summary||!safeArrayIsArray(summary.actions)||typeof summary.duration!=='string')return '';
  const actions=[];for(let index=0;index<summary.actions.length;index+=1){const item=summary.actions[index];if(!plainRecord(item)||typeof item.name!=='string'||typeof item.dose!=='string')return '';safeArrayPush(actions,`<li><span>${index+1}</span><div><b>${esc(item.name)}</b><small>${esc(item.dose)}</small></div></li>`)}
  let nextText='下一次训练将在计划页继续显示';
  if(summary.next&&summary.next.complete===true)nextText='本周期训练已全部完成';
  else if(summary.next&&summary.next.complete===false)nextText=`第${summary.next.weekNumber}周 · ${WEEKDAY_LABELS[summary.next.weekday]||summary.next.weekday} · ${sessionIntentLabel(summary.next.intent)}`;
  return `<section class="guide-completion" aria-label="本节训练完成摘要"><div class="guide-completion-mark">✓</div><div class="guide-completion-title"><span>SESSION COMPLETE</span><h3>本节已完成</h3><p>动作与时长来自本次实际跟练。</p></div><div class="guide-completion-metrics"><article><small>实际时长</small><strong>${esc(summary.duration)}</strong></article><article><small>完成动作</small><strong>${summary.actions.length} 项</strong></article></div><ol class="guide-completion-actions">${safeArrayJoin(actions,'')}</ol><div class="guide-completion-next"><small>下一次训练</small><b>${esc(nextText)}</b></div></section>`;
}
function renderFeedback(){
  const saving=state.guideMode==='feedback_saving',failed=state.guideMode==='feedback_failed';
  getWorkoutAudio().pause();updateMusicUI();
  $('#guideEyebrow').textContent='WORKOUT FEEDBACK';$('#guideTitle').textContent='这节训练感觉如何？';$('#guideBar').style.width='100%';
  const buttons=safeArrayJoin(safeArrayMap(FEEDBACK_OPTIONS,entry=>`<button class="btn${entry[0]==='pain'?' danger-outline':''}" type="button" onclick="submitWorkoutFeedback('${entry[0]}')"${saving?' disabled':''}>${esc(entry[1])}</button>`),'');
  $('#guideBody').innerHTML=`${completionSummaryHtml()}<section class="guide-state guide-feedback"><h3>这节训练感觉如何？</h3><p>选择一个固定选项，帮助调整后续训练。</p>${failed?'<p class="guide-feedback-error" role="alert">反馈尚未保存，请检查本机存储后重试。</p>':''}<div class="guide-state-actions guide-feedback-options">${buttons}</div></section>`;
  setGuideFoot({label:'稍后反馈',hidden:false,disabled:saving},{label:'',hidden:true});
}
function renderGuide(){
  if(state.guideMode==='ready')renderReady();else if(state.guideMode==='action')renderAction();else if(state.guideMode==='duration_blocked')renderDurationBlocked();else if(state.guideMode==='exit_confirm')renderExitConfirm();else if(state.guideMode==='safety_select')renderSafetySelect();else if(state.guideMode==='pain_pause')renderPainPause();else if(state.guideMode==='safety_confirm')renderSafetyConfirm();else if(safeArrayIncludes(['feedback','feedback_saving','feedback_failed'],state.guideMode))renderFeedback();else renderSafetyResult();
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
  const steps=session&&buildWorkoutSteps(session,trustedCatalog),completionSnapshot=steps&&createCompletionSnapshot(session,steps);
  if(!steps||!completionSnapshot){Move28.ui.showToast('该训练节无法安全打开，请重新生成计划');return false}
  activeGuideSnapshot=completionSnapshot;
  activeAdaptation=guideAdaptation;
  state.guideSession={id:steps[0].sessionId,weekday:steps[0].weekday,intent:steps[0].intent,adaptationId:guideAdaptation&&guideAdaptation.adaptationId};state.guideStep=0;state.guideSteps=steps;
  const onComplete=ownData(settings,'onComplete'),onFeedback=ownData(settings,'onFeedback'),onStop=ownData(settings,'onStop');
  state.guideOnComplete=typeof onComplete==='function'?onComplete:()=>{};
  state.guideOnFeedback=typeof onFeedback==='function'?onFeedback:()=>{};
  state.guideOnStop=typeof onStop==='function'?onStop:()=>{};
  state.guideFinishing=false;state.guideMode='ready';state.guideResumeMode='ready';state.guideStopReason='';guideStartedAtMs=null;guideCompletionSummary=null;
  $('#guideModal').classList.add('open');$('#guideModal').setAttribute('aria-hidden','false');root.document.body.classList.add('body-guide-open');
  const close=$('.guide-close');if(close)close.setAttribute('aria-label','普通退出训练');
  renderGuide();setTimeout(()=>$('.guide-close').focus(),0);return true;
}
function hardCloseGuide(){
  $('#guideModal').classList.remove('open');$('#guideModal').setAttribute('aria-hidden','true');root.document.body.classList.remove('body-guide-open');
  getWorkoutAudio().pause();updateMusicUI();state.guideFinishing=false;state.guideMode='closed';activeAdaptation=null;activeGuideSnapshot=null;guideStartedAtMs=null;guideCompletionSummary=null;
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
  if(!safeArrayIncludes(['ready','action','duration_blocked'],state.guideMode))return false;
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
  if(state.guideMode==='exit_confirm'){state.guideMode=state.guideResumeMode==='duration_blocked'?'action':state.guideResumeMode;renderGuide();return}
  if(state.guideMode==='safety_select'){state.guideMode=state.guideResumeMode;renderGuide();return}
  if(state.guideMode==='safety_confirm'||state.guideMode==='pain_pause')return;
  if(state.guideMode==='ready'){Move28.requestGuideExit();return}
  if(state.guideMode==='duration_blocked'){state.guideMode='action';renderGuide();return}
  if(state.guideMode==='action'&&state.guideStep>0&&!state.guideFinishing){state.guideStep--;renderGuide()}
};
Move28.guideNext=()=>{
  if(state.guideMode==='ready'){let startedAt=null;try{startedAt=safePerformanceNow?safePerformanceNow():null}catch(_error){startedAt=null}guideStartedAtMs=safeNumberIsFinite(startedAt)?startedAt:null;state.guideMode='action';renderGuide();return}
  if(state.guideMode==='exit_confirm'){if(activeAdaptation)revokeActiveAdaptation();try{state.guideOnStop({type:'ordinary_exit',sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId,actionIndex:state.guideStep})}catch(_error){}hardCloseGuide();return}
  if(state.guideMode==='duration_blocked'){state.guideResumeMode='duration_blocked';state.guideMode='exit_confirm';renderGuide();return}
  if(safeArrayIncludes(['safety_confirm','safety_save_failed'],state.guideMode)){persistGuideStop();return}
  if(state.guideMode!=='action'||state.guideFinishing)return;
  if(state.guideStep<state.guideSteps.length-1){state.guideStep++;renderGuide();return}
  if(!completionIntrinsicsIntact()){Move28.ui.showToast('运行环境已变化，完成记录未保存，请刷新后重试');return}
  const elapsedMs=completionElapsedMs();
  if(elapsedMs===null){state.guideMode='duration_blocked';renderGuide();return}
  state.guideFinishing=true;$('#guideNext').disabled=true;
  try{
    let persistedState=null;
    if(activeAdaptation){persistedState=persistAdaptedCompletion();try{state.guideOnComplete({type:'adapted_completed',sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId,persistedState})}catch(_error){}}
    else persistedState=state.guideOnComplete({sessionId:state.guideSession.id,adaptationId:state.guideSession.adaptationId});
    const allowTrustedNext=completionIntrinsicsIntact();guideCompletionSummary=buildCompletionSummary(persistedState,elapsedMs,allowTrustedNext);state.guideFinishing=false;state.guideMode='feedback';renderGuide();
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
const guide={openWorkout,doseText,guideMediaHtml,renderGuide,updateMusicUI,syncGuideMusic,getWorkoutAudio,MUSIC,SAFETY_RULE,STOP_REASONS};
Object.assign(Move28.guide||{},guide);
Object.defineProperty(Move28.guide,'workoutAudio',{configurable:true,get:getWorkoutAudio});
const actions={closeGuide:Move28.closeGuide,requestGuideExit:Move28.requestGuideExit,requestSafetyStop:Move28.requestSafetyStop,selectSafetyReason:Move28.selectSafetyReason,resolveGuidePain:Move28.resolveGuidePain,guideRescreen:Move28.guideRescreen,guideReturnHome:Move28.guideReturnHome,guideBack:Move28.guideBack,guideNext:Move28.guideNext,submitWorkoutFeedback:Move28.submitWorkoutFeedback,toggleWorkoutMusic:Move28.toggleWorkoutMusic,setWorkoutVolume:Move28.setWorkoutVolume};
if(root.window===root)for(const name of Object.keys(actions))root[name]=actions[name];
return Object.assign({buildWorkoutSteps,deriveCompletionTiming,isPlausibleCompletionElapsed},guide,actions);
});
