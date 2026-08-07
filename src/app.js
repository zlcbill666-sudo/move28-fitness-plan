(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('./namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){
  Move28.data=Move28.data||{};Move28.domain=Move28.domain||{};Move28.storage=Move28.storage||{};
  Move28.ui=Move28.ui||{};Move28.guide=Move28.guide||{};Move28.onboarding=Move28.onboarding||{};
  Object.assign(Move28.data,require('./data/exercise-catalog.js'),require('./data/legacy-demo-plan.js'),require('./data/tracker-fields.js'));
  Object.assign(Move28.domain,require('./domain/risk-engine.js'),require('./domain/movement-matcher.js'),require('./domain/plan-validator.js'),require('./domain/plan-generator.js'));
  Object.assign(Move28.storage,require('./storage/local-store.js'));
  Object.assign(Move28.ui,require('./ui/dashboard.js'));
  Object.assign(Move28.guide,require('./ui/workout-guide.js'));
  Object.assign(Move28.onboarding,require('./ui/onboarding.js'));
}
const api=factory(root,Move28);Move28.init=api.init;if(isCommonJS)module.exports=api;else api.init();
})(globalThis,function(root,Move28){
'use strict';
let initialized=false;
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const DANGEROUS_KEYS=new Set(['__proto__','prototype','constructor']);
const functionToString=Function.prototype.toString,nativeObjectSource=functionToString.call(Object);
const trustedValidatePlan=typeof Move28.domain.validatePlan==='function'?Move28.domain.validatePlan:null;
const trustedCatalog=Array.isArray(Move28.data.exerciseCatalog)?Move28.data.exerciseCatalog:null;
const trustedRecordWorkoutStop=typeof Move28.storage.recordWorkoutStop==='function'?Move28.storage.recordWorkoutStop:null;
const RESCREEN_STEP_BY_REASON=Object.freeze({sudden_severe_pain:6,unable_to_bear_weight:6,joint_pain_persisted_or_worsened:6,chest_pain_or_pressure:7,near_faint_or_faint:7,abnormal_shortness_of_breath:7,neurologic_or_consciousness_change:7});
function rescreenStepForReason(reasonCode){return RESCREEN_STEP_BY_REASON[reasonCode]??7}
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
    while(stack.length){const item=stack.pop(),current=item.value;if(current===null||['string','boolean'].includes(typeof current))continue;if(typeof current==='number'){if(!Number.isFinite(current))return null;continue}if(typeof current!=='object'||seen.has(current)||item.depth>32)return null;seen.add(current);if(++nodes>10000)return null;const array=Array.isArray(current);if(!array&&!plainRecord(current))return null;const keys=Reflect.ownKeys(current);if(keys.some(key=>typeof key!=='string'||DANGEROUS_KEYS.has(key)))return null;if(array){const lengthDescriptor=Object.getOwnPropertyDescriptor(current,'length');if(!lengthDescriptor||!('value'in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value>256)return null;const dataKeys=keys.filter(key=>key!=='length');if(dataKeys.length!==lengthDescriptor.value)return null;for(let index=0;index<lengthDescriptor.value;index+=1)if(dataKeys[index]!==String(index))return null}for(const key of keys){if(key==='length'&&array)continue;const descriptor=Object.getOwnPropertyDescriptor(current,key);if(!descriptor||!('value'in descriptor))return null;stack.push({value:descriptor.value,depth:item.depth+1})}}
    return nativeStructuredClone(value);
  }catch(_error){return null}
}
function validationCandidate(plan){
  const candidate=clonePureData(plan);if(!candidate)return null;
  delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated';return candidate;
}
function validReview(plan,state){const review=plan&&plan.review;return Boolean(review&&review.status==='approved'&&typeof review.reviewerId==='string'&&/^[a-z][a-z0-9._-]{0,63}$/.test(review.reviewerId)&&review.planId===plan.id&&review.intakeRevision===state.intakeRevision&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewedAt))}
function contextFromState(inputState){
  if(inputState===null||inputState===undefined)return{mode:'demo',plan:null,logs:{},message:'尚未完成问卷，当前为只读示例。'};
  const state=clonePureData(inputState);
  if(!state)return{mode:'invalid',plan:null,logs:{},message:'本机计划无法安全读取，请重新生成。'};
  if(!state.intake)return{mode:'demo',plan:null,logs:{},message:'尚未完成问卷，当前为只读示例。'};
  if(!state.risk||['stop','manual_review'].includes(state.risk.level))return{mode:'blocked',plan:null,logs:state.logs||{},message:'当前筛查结果不开放自动训练，请修改问卷或先完成人工复核。'};
  if(!state.plan)return{mode:'review',plan:null,logs:state.logs||{},message:'档案已保存，但没有通过安全硬门槛的完整计划。'};
  const hasCurrentSafetyEvent=state.logs&&Object.values(state.logs).some(record=>record&&record.status==='safety_stopped'&&record.planId===state.plan.id);
  if(hasCurrentSafetyEvent)return{mode:'stale',plan:null,logs:state.logs||{},message:'训练中已记录安全停止事件，旧计划已失效，请重新完成安全筛查。'};
  if(state.plan.status==='stale'||state.plan.intakeRevision!==state.intakeRevision)return{mode:'stale',plan:null,logs:state.logs||{},message:'档案已经变化，旧计划已失效，请重新确认问卷并生成。'};
  if(state.plan.status==='pending_review')return{mode:'review',plan:null,logs:state.logs||{},message:'4周计划已生成，人工一致性复核完成前不会开放训练入口。'};
  if(state.plan.status!=='active'||!validReview(state.plan,state))return{mode:'invalid',plan:null,logs:state.logs||{},message:'本机计划状态或人工复核凭据无效，请等待重新复核。'};
  const candidate=validationCandidate(state.plan);
  if(!candidate)return{mode:'invalid',plan:null,logs:state.logs||{},message:'本机计划无法安全读取，请重新生成。'};
  let validation;try{validation=trustedValidatePlan&&trustedValidatePlan({plan:candidate,intake:state.intake,risk:state.risk,catalog:trustedCatalog})}catch(_error){validation=null}
  return validation&&validation.ok===true&&Array.isArray(validation.errors)&&validation.errors.length===0?{mode:'generated',plan:state.plan,logs:state.logs||{},message:''}:{mode:'invalid',plan:null,logs:state.logs||{},message:'本机计划未通过安全复核，请重新生成。'};
}
function activatePlanView(state){const context=contextFromState(state);Move28.ui.setPlanContext(context);return context}
function handleOnboardingComplete({intake,risk,canGenerate}){
  const saved=Move28.storage.saveIntake(intake,risk);
  if(!canGenerate){activatePlanView(saved);return{message:'筛查结果已保存到本机；当前需要人工复核或不在试用范围，未生成训练计划。'}}
  const generated=Move28.domain.generatePlan({intake:saved.intake,risk:saved.risk,intakeRevision:saved.intakeRevision,catalog:trustedCatalog});
  if(!generated||generated.status!=='generated'){
    Move28.ui.setPlanContext({mode:'review',plan:null,logs:saved.logs||{},message:'动作、器械或安全硬门槛未满足，需要人工复核。'});
    return{message:'问卷已保存到本机，但计划未通过完整校验，需要人工复核。'};
  }
  const persisted=Move28.storage.savePlan(generated);
  activatePlanView(persisted);
  return{message:'问卷与4周计划已保存到本机；人工一致性复核完成前不会开放训练入口。'};
}
function handleGuideStop(event){
  if(!event||typeof event!=='object')return false;
  if(event.type==='ordinary_exit')return true;
  if(event.type==='rescreen'){
    const controller=Move28.onboardingController;if(!controller)return false;
    controller.setField('finalConfirmed',false);controller.open();controller.goTo(rescreenStepForReason(event.reasonCode));return true;
  }
  if(event.type!=='safety_stop'||!trustedRecordWorkoutStop)throw new Error('Safety stop unavailable');
  const updated=trustedRecordWorkoutStop({sessionId:event.sessionId,reasonCode:event.reasonCode,actionIndex:event.actionIndex,occurredAt:event.occurredAt});
  activatePlanView(updated);return true;
}
function openGeneratedWorkout(sessionId){
  const state=Move28.storage.loadState(),context=contextFromState(state);
  if(context.mode!=='generated'){activatePlanView(state);Move28.ui.showToast('当前没有可执行的有效计划');return false}
  const session=context.plan.weeks.flatMap(week=>week.sessions).find(item=>item.id===sessionId);
  if(!session){Move28.ui.showToast('未找到已校验的训练节');return false}
  return Move28.guide.openWorkout({
    session,catalog:trustedCatalog,
    onComplete:()=>{const updated=Move28.storage.recordWorkoutCompletion({planId:context.plan.id,sessionId:session.id});activatePlanView(updated)},
    onStop:handleGuideStop
  });
}
function init(){
  if(initialized)return Move28;
  const {$}=Move28.utils,ui=Move28.ui,guide=Move28.guide;
  if(!root.document)return false;
  initialized=true;
  $('#saveBtn').onclick=ui.saveTrack;$('#exportBtn').onclick=ui.exportCSV;$('#clearBtn').onclick=ui.clearTrack;
  const workoutAudio=guide.getWorkoutAudio();
  workoutAudio.addEventListener('play',guide.updateMusicUI);workoutAudio.addEventListener('pause',guide.updateMusicUI);
  workoutAudio.addEventListener('error',()=>{guide.updateMusicUI();ui.showToast('音乐加载失败，请检查网络或离线资源')});
  $('#guideModal').addEventListener('click',event=>{if(event.target===$('#guideModal'))Move28.closeGuide()});
  root.document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#guideModal').classList.contains('open'))Move28.closeGuide()});
  Move28.openGeneratedWorkout=openGeneratedWorkout;if(root.window===root)root.openGeneratedWorkout=openGeneratedWorkout;
  const onboardingRoot=$('#onboardingView');
  if(onboardingRoot&&Move28.onboarding&&Move28.storage){
    Move28.onboardingController=Move28.onboarding.createOnboarding({rootElement:onboardingRoot,onComplete:handleOnboardingComplete});
    $('#onboardingStart').addEventListener('click',()=>Move28.onboardingController.open());
  }
  activatePlanView(Move28.storage.loadState());
  ui.renderExercises();ui.renderDayList();ui.renderForm();ui.renderOverview();ui.renderSafety();ui.reveal();
  return Move28;
}
return{init,contextFromState,handleOnboardingComplete,openGeneratedWorkout,rescreenStepForReason};
});
