(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS)require('./dashboard.js');
const trustedCatalog=isCommonJS?require('../data/exercise-catalog.js').exerciseCatalog:Move28.data&&Move28.data.exerciseCatalog;
const validatorApi=isCommonJS?require('../domain/plan-validator.js'):Move28.domain;
const storageApi=isCommonJS?require('../storage/local-store.js'):Move28.storage;
const trustedValidatePlan=validatorApi&&typeof validatorApi.validatePlan==='function'?validatorApi.validatePlan:null;
const trustedLoadState=storageApi&&typeof storageApi.loadState==='function'?storageApi.loadState:null;
const api=factory(root,Move28,trustedCatalog,trustedValidatePlan,trustedLoadState);
if(isCommonJS)module.exports=api;
})(globalThis,function(root,Move28,trustedCatalog,trustedValidatePlan,trustedLoadState){
'use strict';
const state=Move28.state;
const {$,esc,storage}=Move28.utils;
const MUSIC={warmup:{src:'assets/audio/warmup-rising-forest.mp3',title:'Rising Forest',author:'Diego Nava · 热身'},strength:{src:'assets/audio/strength-deep-urban.mp3',title:'Deep Urban',author:'Eugenio Mininni · 力量'},cardio:{src:'assets/audio/cardio-techno-fest-vibes.mp3',title:'Techno Fest Vibes',author:'Alejandro Magaña (A. M.) · 有氧'},recovery:{src:'assets/audio/recovery-summer-dream.mp3',title:'Summer Dream',author:'Eugenio Mininni · 放松'}};
const WEEKDAY_LABELS={mon:'周一',tue:'周二',wed:'周三',thu:'周四',fri:'周五',sat:'周六',sun:'周日'};
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const DANGEROUS_KEYS=new Set(['__proto__','prototype','constructor']);
const functionToString=Function.prototype.toString,nativeObjectSource=functionToString.call(Object);
function plainRecord(value){
  if(!value||typeof value!=='object')return false;
  const proto=Object.getPrototypeOf(value);if(proto===null)return true;if(Object.getPrototypeOf(proto)!==null)return false;
  const descriptor=Object.getOwnPropertyDescriptor(proto,'constructor');
  return Boolean(descriptor&&'value'in descriptor&&typeof descriptor.value==='function'&&functionToString.call(descriptor.value)===nativeObjectSource);
}
function clonePureData(value){
  if(!nativeStructuredClone)return null;
  try{
    const stack=[{value,depth:0}],seen=new WeakSet();let nodes=0;
    while(stack.length){
      const current=stack.pop(),item=current.value;nodes+=1;
      if(nodes>4096||current.depth>32)return null;
      if(item===null||['string','boolean'].includes(typeof item))continue;
      if(typeof item==='number'){if(!Number.isFinite(item))return null;continue}
      if(typeof item!=='object'||seen.has(item))return null;
      seen.add(item);
      const isArray=Array.isArray(item);if(!isArray&&!plainRecord(item))return null;
      const keys=Reflect.ownKeys(item);if(keys.some(key=>typeof key!=='string'||DANGEROUS_KEYS.has(key)))return null;
      if(isArray){
        const lengthDescriptor=Object.getOwnPropertyDescriptor(item,'length');
        if(!lengthDescriptor||lengthDescriptor.get||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value>256)return null;
        const dataKeys=keys.filter(key=>key!=='length');
        if(dataKeys.length!==lengthDescriptor.value||dataKeys.some((key,index)=>key!==String(index)))return null;
      }
      for(const key of keys){
        if(key==='length'&&isArray)continue;
        const descriptor=Object.getOwnPropertyDescriptor(item,key);
        if(!descriptor||descriptor.get||descriptor.set||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return null;
        stack.push({value:descriptor.value,depth:current.depth+1});
      }
    }
    return nativeStructuredClone(value);
  }catch(_error){return null}
}
function ownData(object,key){
  try{const descriptor=Object.getOwnPropertyDescriptor(object,key);return descriptor&&!descriptor.get&&!descriptor.set&&Object.prototype.hasOwnProperty.call(descriptor,'value')?descriptor.value:undefined}catch(_error){return undefined}
}
function doseText(action){
  return action.phase==='main'
    ?`${action.sets}组 × ${action.reps}次 · RPE ${action.rpe} · 组间休息${action.restSec}秒`
    :`${action.durationMin}分钟 · RPE ${action.rpe}${action.restSec?` · 休息${action.restSec}秒`:''}`;
}
function buildWorkoutSteps(session,catalog){
  if(catalog!==trustedCatalog)return null;
  const safeSession=clonePureData(session),safeCatalog=clonePureData(trustedCatalog);
  if(!safeSession||!Array.isArray(safeSession.actions)||safeSession.actions.length===0||!Array.isArray(safeCatalog))return null;
  const exercises=new Map(safeCatalog.filter(item=>item&&item.reviewStatus==='approved').map(item=>[item.id,item]));
  const steps=[];
  for(const action of safeSession.actions){
    const exercise=action&&exercises.get(action.exerciseId);
    if(!exercise||!exercise.cues||typeof exercise.gif!=='string')return null;
    const strength=action.phase==='main';
    if(strength&&![action.sets,action.reps,action.rpe,action.restSec].every(Number.isFinite))return null;
    if(!strength&&![action.durationMin,action.rpe,action.restSec].every(Number.isFinite))return null;
    steps.push({action,exercise,music:strength?'strength':'cardio',sessionId:safeSession.id,weekday:safeSession.weekday,intent:safeSession.intent});
  }
  return steps;
}
const getWorkoutAudio=()=>$('#workoutAudio');
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
  if(state.musicEnabled&&allowPlay)workoutAudio.play().catch(error=>{if(error.name!=='AbortError'){state.musicEnabled=false;storage.setItem('move28-music-enabled','0');updateMusicUI()}});
  updateMusicUI();
}
Move28.toggleWorkoutMusic=()=>{
  const workoutAudio=getWorkoutAudio();
  if(workoutAudio.paused){state.musicEnabled=true;storage.setItem('move28-music-enabled','1');workoutAudio.play().catch(()=>Move28.ui.showToast('请再点一次播放音乐'))}
  else{state.musicEnabled=false;storage.setItem('move28-music-enabled','0');workoutAudio.pause()}
  updateMusicUI();
};
Move28.setWorkoutVolume=value=>{const workoutAudio=getWorkoutAudio();state.musicVolume=Math.max(0,Math.min(1,Number(value)/100));workoutAudio.volume=state.musicVolume;storage.setItem('move28-music-volume',String(Math.round(state.musicVolume*100)))};
function renderGuide(){
  const step=state.guideSteps[state.guideStep],total=state.guideSteps.length,exercise=step.exercise,action=step.action;
  syncGuideMusic(step.music,true);
  $('#guideEyebrow').textContent=`ACTION ${state.guideStep+1} / ${total}`;
  $('#guideTitle').textContent=`${WEEKDAY_LABELS[state.guideSession.weekday]||state.guideSession.weekday} · ${state.guideSession.intent==='full_body_strength'?'全身力量':'低冲击有氧'}`;
  $('#guideBar').style.width=`${(state.guideStep+1)/total*100}%`;
  $('#guideBody').innerHTML=`<div class="guide-action" data-exercise-id="${esc(action.exerciseId)}"><figure class="guide-demo"><img src="${esc(exercise.gif)}" alt="${esc(exercise.name)}动作示范GIF"></figure><div class="guide-instruction"><span class="guide-phase">${action.phase==='main'?'力量训练':'低冲击有氧'}</span><h3>${esc(exercise.name)}</h3><div class="guide-dose">${esc(doseText(action))}</div><div class="guide-cues"><div class="guide-cue"><b>准备姿势</b>${esc(exercise.cues.setup)}</div><div class="guide-cue"><b>动作要领</b>${esc(exercise.cues.movement)}</div><div class="guide-cue"><b>呼吸节奏</b>${esc(exercise.cues.breathing)}</div><div class="guide-cue"><b>疼痛边界</b>${esc(exercise.cues.pain)}</div></div><div class="guide-one-note">完成当前动作后，点击下方按钮直接进入下一项。</div></div></div>`;
  $('#guideBack').disabled=state.guideStep===0;
  $('#guideBack').style.visibility=state.guideStep===0?'hidden':'visible';
  $('#guideNext').disabled=false;
  $('#guideNext').textContent=state.guideStep===total-1?'完成本节并记录 ✓':'完成此项，下一项 →';
  root.requestAnimationFrame(()=>$('.guide-shell').scrollTo({top:0,behavior:'smooth'}));
}
function sameData(left,right){
  const stack=[[left,right]];
  while(stack.length){const [a,b]=stack.pop();if(Object.is(a,b))continue;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;if(Array.isArray(a)){if(a.length!==b.length)return false;for(let index=0;index<a.length;index+=1)stack.push([a[index],b[index]]);continue}const aKeys=Object.keys(a).sort(),bKeys=Object.keys(b).sort();if(aKeys.length!==bKeys.length||aKeys.some((key,index)=>key!==bKeys[index]))return false;for(const key of aKeys)stack.push([a[key],b[key]])}
  return true;
}
function prepareReviewedSession(requestedSession,catalog){
  if(catalog!==trustedCatalog||!trustedLoadState||!trustedValidatePlan)return null;
  const safeRequested=clonePureData(requestedSession);let safeState;
  try{safeState=clonePureData(trustedLoadState())}catch(_error){return null}
  if(!safeRequested||!safeState?.intake||!safeState?.risk||!safeState?.plan)return null;
  const safePlan=safeState.plan,review=safePlan.review;
  if(safePlan.status!=='active'||safePlan.intakeRevision!==safeState.intakeRevision||safePlan.intakeRevision!==review?.intakeRevision||review?.status!=='approved'||review?.planId!==safePlan.id||!/^[a-z][a-z0-9._-]{0,63}$/.test(review?.reviewerId||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review?.reviewedAt||''))return null;
  const candidate=clonePureData(safePlan);if(!candidate)return null;delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated';
  let validation;try{validation=trustedValidatePlan({plan:candidate,intake:safeState.intake,risk:safeState.risk,catalog:trustedCatalog})}catch(_error){return null}
  if(!validation||validation.ok!==true||!Array.isArray(validation.errors)||validation.errors.length!==0)return null;
  const stored=safePlan.weeks.flatMap(week=>week.sessions).find(item=>item.id===safeRequested.id);
  return stored&&sameData(stored,safeRequested)?stored:null;
}
function openWorkout(options){
  const settings=options&&typeof options==='object'?options:null;
  const requestedSession=settings&&ownData(settings,'session'),catalog=settings&&ownData(settings,'catalog');
  const session=prepareReviewedSession(requestedSession,catalog);
  const steps=session&&buildWorkoutSteps(session,trustedCatalog);
  if(!steps){Move28.ui.showToast('该训练节无法安全打开，请重新生成计划');return false}
  state.guideSession={id:steps[0].sessionId,weekday:steps[0].weekday,intent:steps[0].intent};state.guideStep=0;state.guideSteps=steps;
  const onComplete=ownData(settings,'onComplete'),onStop=ownData(settings,'onStop');
  state.guideOnComplete=typeof onComplete==='function'?onComplete:()=>{};
  state.guideOnStop=typeof onStop==='function'?onStop:()=>{};
  state.guideFinishing=false;
  $('#guideModal').classList.add('open');$('#guideModal').setAttribute('aria-hidden','false');root.document.body.classList.add('body-guide-open');
  renderGuide();setTimeout(()=>$('.guide-close').focus(),0);return true;
}
Move28.closeGuide=()=>{
  $('#guideModal').classList.remove('open');$('#guideModal').setAttribute('aria-hidden','true');root.document.body.classList.remove('body-guide-open');
  getWorkoutAudio().pause();updateMusicUI();state.guideFinishing=false;
};
Move28.guideBack=()=>{if(state.guideStep>0&&!state.guideFinishing){state.guideStep--;renderGuide()}};
Move28.guideNext=()=>{
  if(state.guideFinishing)return;
  if(state.guideStep<state.guideSteps.length-1){state.guideStep++;renderGuide();return}
  state.guideFinishing=true;$('#guideNext').disabled=true;
  try{
    state.guideOnComplete({sessionId:state.guideSession.id});
    Move28.closeGuide();
    Move28.ui.showToast('本节训练已完成并保存到本机');
  }catch(_error){state.guideFinishing=false;$('#guideNext').disabled=false;Move28.ui.showToast('完成记录保存失败，请检查本机存储后重试')}
};
const guide={openWorkout,doseText,renderGuide,updateMusicUI,syncGuideMusic,getWorkoutAudio,MUSIC};
Object.assign(Move28.guide||{},guide);
Object.defineProperty(Move28.guide,'workoutAudio',{configurable:true,get:getWorkoutAudio});
const actions={closeGuide:Move28.closeGuide,guideBack:Move28.guideBack,guideNext:Move28.guideNext,toggleWorkoutMusic:Move28.toggleWorkoutMusic,setWorkoutVolume:Move28.setWorkoutVolume};
if(root.window===root)for(const name of Object.keys(actions))root[name]=actions[name];
return Object.assign({buildWorkoutSteps},guide,actions);
});
