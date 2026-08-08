(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('./namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){
  Move28.data=Move28.data||{};Move28.domain=Move28.domain||{};Move28.storage=Move28.storage||{};
  Move28.ui=Move28.ui||{};Move28.guide=Move28.guide||{};Move28.onboarding=Move28.onboarding||{};Move28.capabilityAssessment=Move28.capabilityAssessment||{};Move28.privacy=Move28.privacy||{};
  Object.assign(Move28.data,require('./data/exercise-catalog.js'),require('./data/legacy-demo-plan.js'),require('./data/tracker-fields.js'));
  Object.assign(Move28.domain,require('./domain/risk-engine.js'),require('./domain/capability-engine.js'),require('./domain/movement-matcher.js'),require('./domain/plan-validator.js'),require('./domain/plan-generator.js'),require('./domain/weekly-adaptation.js'));
  Object.assign(Move28.storage,require('./storage/local-store.js'));
  Object.assign(Move28.ui,require('./ui/dashboard.js'));
  Object.assign(Move28.guide,require('./ui/workout-guide.js'));
  Object.assign(Move28.onboarding,require('./ui/onboarding.js'));
  Move28.capabilityAssessment=require('./ui/capability-assessment.js');
  Move28.weeklyReview=require('./ui/weekly-review.js');
  Move28.privacy=require('./ui/privacy-tools.js');
}
const api=factory(root,Move28);Move28.init=api.init;if(isCommonJS)module.exports=api;else api.init();
})(globalThis,function(root,Move28){
'use strict';
let initialized=false;
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const DANGEROUS_KEYS=new Set(['__proto__','prototype','constructor']);
const safeArrayIsArray=Array.isArray;
const safeGetPrototypeOf=Object.getPrototypeOf;
const safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
const safeOwnKeys=Reflect.ownKeys;
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const safeFunctionToString=Function.prototype.call.bind(Function.prototype.toString);
const safeArrayPush=Function.prototype.call.bind(Array.prototype.push);
const safeArrayPop=Function.prototype.call.bind(Array.prototype.pop);
const SafeWeakSet=WeakSet;
const safeWeakSetAdd=Function.prototype.call.bind(WeakSet.prototype.add);
const safeWeakSetHas=Function.prototype.call.bind(WeakSet.prototype.has);
const nativeObjectSource=safeFunctionToString(Object);
const trustedValidatePlan=typeof Move28.domain.validatePlan==='function'?Move28.domain.validatePlan:null;
const trustedDeriveRiskIntake=typeof Move28.domain.deriveRiskIntake==='function'?Move28.domain.deriveRiskIntake:null;
const trustedEvaluateRisk=typeof Move28.domain.evaluateRisk==='function'?Move28.domain.evaluateRisk:null;
const trustedEvaluateCapabilityProfile=typeof Move28.domain.evaluateCapabilityProfile==='function'?Move28.domain.evaluateCapabilityProfile:null;
const trustedCatalog=Array.isArray(Move28.data.exerciseCatalog)?Move28.data.exerciseCatalog:null;
const trustedRecordWorkoutStop=typeof Move28.storage.recordWorkoutStop==='function'?Move28.storage.recordWorkoutStop:null;
const trustedRecordWeeklyReview=typeof Move28.storage.recordWeeklyReview==='function'?Move28.storage.recordWeeklyReview:null;
const trustedSaveCapabilityProfile=typeof Move28.storage.saveCapabilityProfile==='function'?Move28.storage.saveCapabilityProfile:null;
const trustedSaveCapabilityProfileWithPlan=typeof Move28.storage.saveCapabilityProfileWithPlan==='function'?Move28.storage.saveCapabilityProfileWithPlan:null;
const trustedResolveWeeklyReview=typeof Move28.storage.resolveWeeklyReview==='function'?Move28.storage.resolveWeeklyReview:null;
const trustedCreatePrivacyTools=Move28.privacy&&typeof Move28.privacy.createPrivacyTools==='function'?Move28.privacy.createPrivacyTools:null;
const RESCREEN_STEP_BY_REASON=Object.freeze({sudden_severe_pain:6,unable_to_bear_weight:6,joint_pain_persisted_or_worsened:6,chest_pain_or_pressure:7,near_faint_or_faint:7,abnormal_shortness_of_breath:7,neurologic_or_consciousness_change:7});
function rescreenStepForReason(reasonCode){return RESCREEN_STEP_BY_REASON[reasonCode]??7}
function plainRecord(value){
  if(!value||typeof value!=='object')return false;
  const proto=safeGetPrototypeOf(value);if(proto===null)return true;if(safeGetPrototypeOf(proto)!==null)return false;
  const descriptor=safeGetOwnPropertyDescriptor(proto,'constructor');
  return Boolean(descriptor&&'value'in descriptor&&typeof descriptor.value==='function'&&safeFunctionToString(descriptor.value)===nativeObjectSource);
}
function clonePureData(value){
  if(!nativeStructuredClone)return null;
  try{
    const stack=[{value,depth:0}],seen=new SafeWeakSet();let nodes=0;
    while(stack.length){const item=safeArrayPop(stack),current=item.value;if(current===null||typeof current==='string'||typeof current==='boolean')continue;if(typeof current==='number'){if(!Number.isFinite(current))return null;continue}if(typeof current!=='object'||safeWeakSetHas(seen,current)||item.depth>32)return null;safeWeakSetAdd(seen,current);if(++nodes>10000)return null;const array=safeArrayIsArray(current);if(!array&&!plainRecord(current))return null;const keys=safeOwnKeys(current);for(let keyIndex=0;keyIndex<keys.length;keyIndex+=1){const key=keys[keyIndex];if(typeof key!=='string'||safeSetHas(DANGEROUS_KEYS,key))return null}if(array){const lengthDescriptor=safeGetOwnPropertyDescriptor(current,'length');if(!lengthDescriptor||!('value'in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value>256)return null;let dataIndex=0;for(let keyIndex=0;keyIndex<keys.length;keyIndex+=1){const key=keys[keyIndex];if(key==='length')continue;if(key!==String(dataIndex))return null;dataIndex+=1}if(dataIndex!==lengthDescriptor.value)return null}for(let keyIndex=0;keyIndex<keys.length;keyIndex+=1){const key=keys[keyIndex];if(key==='length'&&array)continue;const descriptor=safeGetOwnPropertyDescriptor(current,key);if(!descriptor||!('value'in descriptor))return null;safeArrayPush(stack,{value:descriptor.value,depth:item.depth+1})}}
    return nativeStructuredClone(value);
  }catch(_error){return null}
}
function trustedRiskForIntake(intake){try{if(!trustedDeriveRiskIntake||!trustedEvaluateRisk)return null;const derived=clonePureData(trustedDeriveRiskIntake(intake));if(!derived)return null;return clonePureData(trustedEvaluateRisk(derived))}catch(_error){return null}}
function risksMatch(left,right){return Boolean(left&&right&&left.level===right.level&&left.ruleVersion===right.ruleVersion&&Array.isArray(left.reasons)&&Array.isArray(right.reasons)&&left.reasons.length===right.reasons.length&&left.reasons.every((reason,index)=>{const other=right.reasons[index];return reason&&other&&reason.code===other.code&&reason.field===other.field&&reason.message===other.message}))}
function trustedCapabilityForProfile(profile){try{return trustedEvaluateCapabilityProfile?clonePureData(trustedEvaluateCapabilityProfile(profile)):null}catch(_error){return null}}
function capabilityResultsMatch(left,right){return Boolean(left&&right&&left.status===right.status&&left.difficultyCap===right.difficultyCap&&left.cardioStartMinutes===right.cardioStartMinutes&&Array.isArray(left.exclusions)&&Array.isArray(right.exclusions)&&left.exclusions.length===right.exclusions.length&&left.exclusions.every((value,index)=>value===right.exclusions[index])&&left.variants&&right.variants&&left.variants.knee_dominant===right.variants.knee_dominant&&left.variants.horizontal_push===right.variants.horizontal_push&&Array.isArray(left.reasonCodes)&&Array.isArray(right.reasonCodes)&&left.reasonCodes.length===right.reasonCodes.length&&left.reasonCodes.every((value,index)=>value===right.reasonCodes[index]))}
function validationPassed(value){const validation=clonePureData(value);return Boolean(validation&&validation.ok===true&&Array.isArray(validation.errors)&&validation.errors.length===0)}
function validationCandidate(plan){
  const candidate=clonePureData(plan);if(!candidate)return null;
  delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;delete candidate.capabilityRevision;candidate.status='generated';return candidate;
}
function validReview(plan,state){const review=plan&&plan.review;return Boolean(review&&review.status==='approved'&&typeof review.reviewerId==='string'&&/^[a-z][a-z0-9._-]{0,63}$/.test(review.reviewerId)&&review.planId===plan.id&&review.intakeRevision===state.intakeRevision&&plan.capabilityRevision===state.capabilityRevision&&review.capabilityRevision===state.capabilityRevision&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewedAt))}
function contextFromState(inputState){
  if(inputState===null||inputState===undefined)return{mode:'demo',plan:null,logs:{},message:'尚未完成问卷，当前为只读示例。'};
  const state=clonePureData(inputState);
  if(!state)return{mode:'invalid',plan:null,logs:{},message:'本机计划无法安全读取，请重新生成。'};
  if(!state.intake)return{mode:'demo',plan:null,logs:{},message:'尚未完成问卷，当前为只读示例。'};
  const recomputedRisk=trustedRiskForIntake(state.intake);
  if(!recomputedRisk)return{mode:'invalid',plan:null,logs:state.logs||{},message:'本机风险结果无法安全复核，请重新完成问卷。'};
  if(!risksMatch(state.risk,recomputedRisk))return{mode:['stop','manual_review'].includes(recomputedRisk.level)?'blocked':'invalid',plan:null,logs:state.logs||{},message:'本机风险结果与当前问卷不一致，请重新完成筛查。'};
  if(['stop','manual_review'].includes(recomputedRisk.level))return{mode:'blocked',plan:null,logs:state.logs||{},message:'当前筛查结果不开放自动训练，请修改问卷或先完成人工复核。'};
  if(!state.capabilityProfile||!state.capabilityResult||!Number.isSafeInteger(state.capabilityRevision)||state.capabilityRevision<1)return{mode:'review',plan:null,logs:state.logs||{},message:'请完成能力校准，再生成与你当前起点匹配的计划。'};
  const recomputedCapability=trustedCapabilityForProfile(state.capabilityProfile);
  if(!recomputedCapability||!capabilityResultsMatch(state.capabilityResult,recomputedCapability))return{mode:'invalid',plan:null,logs:state.logs||{},message:'本机能力档案无法安全复核，请重新完成能力校准。'};
  if(['stop','manual_review'].includes(recomputedCapability.status))return{mode:'blocked',plan:null,logs:state.logs||{},message:'当前能力校准结果不开放自动训练，请先重新安全筛查或完成人工复核。'};
  if(!state.plan)return{mode:'review',plan:null,logs:state.logs||{},message:'档案已保存，但没有通过安全硬门槛的完整计划。'};
  const hasCurrentSafetyEvent=state.logs&&Object.values(state.logs).some(record=>record&&record.status==='safety_stopped'&&record.planId===state.plan.id);
  if(hasCurrentSafetyEvent)return{mode:'stale',plan:null,logs:state.logs||{},message:'训练中已记录安全停止事件，旧计划已失效，请重新完成安全筛查。'};
  const hasWeeklyPainRescreen=Array.isArray(state.weeklyReviews)&&state.weeklyReviews.some(record=>record&&record.planId===state.plan.id&&record.decision==='rescreen');
  if(hasWeeklyPainRescreen)return{mode:'stale',plan:null,logs:state.logs||{},message:'每周复盘发现需要重新筛查的疼痛变化，旧计划已失效。'};
  if(state.plan.status==='stale'||state.plan.intakeRevision!==state.intakeRevision||state.plan.capabilityRevision!==state.capabilityRevision)return{mode:'stale',plan:null,logs:state.logs||{},message:'档案已经变化，旧计划已失效，请重新确认问卷与能力校准后生成。'};
  if(state.plan.status==='pending_review')return{mode:'review',plan:null,logs:state.logs||{},message:'4周计划已生成，人工一致性复核完成前不会开放训练入口。'};
  if(state.plan.status!=='active'||!validReview(state.plan,state))return{mode:'invalid',plan:null,logs:state.logs||{},message:'本机计划状态或人工复核凭据无效，请等待重新复核。'};
  const candidate=validationCandidate(state.plan);
  if(!candidate)return{mode:'invalid',plan:null,logs:state.logs||{},message:'本机计划无法安全读取，请重新生成。'};
  let validation;try{validation=trustedValidatePlan&&trustedValidatePlan({plan:candidate,intake:state.intake,risk:recomputedRisk,catalog:trustedCatalog})}catch(_error){validation=null}
  return validationPassed(validation)?{mode:'generated',plan:state.plan,logs:state.logs||{},message:''}:{mode:'invalid',plan:null,logs:state.logs||{},message:'本机计划未通过安全复核，请重新生成。'};
}
function weeklyPlanLineage(reviews,currentPlanId){const lineage=new Set([currentPlanId]);let changed=true;while(changed&&lineage.size<=17){changed=false;for(const item of reviews)if(item&&item.decision==='accepted'&&lineage.has(item.resultPlanId)&&!lineage.has(item.planId)){lineage.add(item.planId);changed=true}}return lineage}
function weeklyReviewTarget(state,context){
  if(!state||context.mode!=='generated'||!Array.isArray(state.weeklyReviews))return null;
  const lineage=weeklyPlanLineage(state.weeklyReviews,context.plan.id);
  const pending=state.weeklyReviews.find(item=>item&&lineage.has(item.planId)&&item.decision==='pending');
  if(pending)return{weekNumber:pending.weekNumber,scheduledSessions:pending.answers.scheduledSessions,reviewId:pending.id,proposal:pending.proposal};
  const reviewed=new Set(state.weeklyReviews.filter(item=>item&&lineage.has(item.planId)).map(item=>item.weekNumber));
  const week=context.plan.weeks.find(item=>!reviewed.has(item.number));
  return week?{weekNumber:week.number,scheduledSessions:week.sessions.length}:null;
}
function renderWeeklyEntry(state,context){
  if(!root.document)return;const slot=root.document.querySelector('#weeklyReviewSlot');if(!slot)return;
  const target=weeklyReviewTarget(state,context);slot.innerHTML=target?`<button class="cta weekly-review-open" type="button">${target.reviewId?'继续决定':'第'+target.weekNumber+'周复盘'}</button><small>调整需由你确认，并重新经过人工一致性复核。</small>`:'';
  const button=slot.querySelector('button');if(button)button.onclick=()=>Move28.weeklyReviewController&&Move28.weeklyReviewController.open(target);
}
function activatePlanView(state){const context=contextFromState(state);Move28.ui.setPlanContext(context);renderWeeklyEntry(state,context);return context}
function handoffToCapability(){
  if(!Move28.capabilityController)return;
  const launch=()=>{
    try{if(root.history&&root.location)root.history.replaceState(null,'',`${root.location.pathname||''}${root.location.search||''}`)}catch(_error){}
    if(Move28.onboardingController)Move28.onboardingController.close(true);
    Move28.capabilityController.open();
  };
  if(typeof root.setTimeout==='function')root.setTimeout(launch,0);else launch();
}
function handleOnboardingComplete({intake,risk,canGenerate}){
  const saved=Move28.storage.saveIntake(intake,risk);
  if(!canGenerate){activatePlanView(saved);return{message:'筛查结果已保存到本机；当前需要人工复核或不在试用范围，未生成训练计划。'}}
  activatePlanView(saved);
  handoffToCapability();
  return{message:'问卷已保存，请完成能力校准。'};
}
function handleCapabilityComplete(profile){
  if(!trustedSaveCapabilityProfile||!trustedEvaluateCapabilityProfile)throw new Error('Capability persistence unavailable');
  const result=trustedEvaluateCapabilityProfile(profile);
  if(!result||!['normal','conservative'].includes(result.status)){
    const saved=trustedSaveCapabilityProfile(profile);
    activatePlanView(saved);
    return{message:result&&result.status==='stop'?'能力档案已保存；出现停止信号，请先重新安全筛查或咨询合适的专业人员。':'能力档案已保存；当前需要人工复核，未生成训练计划。'};
  }
  if(!trustedSaveCapabilityProfileWithPlan)throw new Error('Atomic capability persistence unavailable');
  const current=Move28.storage.loadState();
  if(!current||!Number.isSafeInteger(current.capabilityRevision)||current.capabilityRevision>=Number.MAX_SAFE_INTEGER)throw new Error('Capability revision unavailable');
  const generated=Move28.domain.generatePlan({intake:current.intake,risk:current.risk,intakeRevision:current.intakeRevision,catalog:trustedCatalog});
  if(!generated||generated.status!=='generated'){
    const saved=trustedSaveCapabilityProfile(profile);
    Move28.ui.setPlanContext({mode:'review',plan:null,logs:saved.logs||{},message:'动作、器械或安全硬门槛未满足，需要人工复核。'});
    return{message:'能力档案已保存到本机，但计划未通过完整校验，需要人工复核。'};
  }
  const capabilityBoundPlan=Object.assign({},generated,{capabilityRevision:current.capabilityRevision+1});
  const persisted=trustedSaveCapabilityProfileWithPlan(profile,capabilityBoundPlan);
  activatePlanView(persisted);
  return{message:'能力档案与4周计划已保存到本机；人工一致性复核完成前不会开放训练入口。'};
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
function handleWeeklySubmit(review){
  if(!trustedRecordWeeklyReview)throw new Error('Weekly review unavailable');
  const state=trustedRecordWeeklyReview(review),record=state.weeklyReviews[state.weeklyReviews.length-1];
  activatePlanView(state);
  return{decision:record.decision,reviewId:record.id,weekNumber:record.weekNumber,proposal:record.proposal};
}
function handleWeeklyResolve(decision){
  if(!trustedResolveWeeklyReview)throw new Error('Weekly review unavailable');
  const state=trustedResolveWeeklyReview(decision);activatePlanView(state);return state;
}
function openWeeklyRescreen(){
  const controller=Move28.onboardingController;if(!controller)return false;
  controller.setField('finalConfirmed',false);controller.open();controller.goTo(6);return true;
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
  }
  const capabilityRoot=$('#capabilityAssessmentView');
  if(capabilityRoot&&Move28.capabilityAssessment&&trustedSaveCapabilityProfile){
    const initialState=Move28.storage.loadState();
    Move28.capabilityController=Move28.capabilityAssessment.createCapabilityAssessment({rootElement:capabilityRoot,initialProfile:initialState&&initialState.capabilityProfile,onComplete:handleCapabilityComplete});
  }
  if($('#onboardingStart'))$('#onboardingStart').addEventListener('click',()=>{
    const state=Move28.storage.loadState();
    const risk=state&&state.intake?trustedRiskForIntake(state.intake):null;
    if(Move28.capabilityController&&risk&&['normal','conservative'].includes(risk.level)&&!state.capabilityProfile)Move28.capabilityController.open();
    else if(Move28.onboardingController)Move28.onboardingController.open();
  });
  const weeklyRoot=$('#weeklyReviewView');
  if(weeklyRoot&&Move28.weeklyReview&&trustedRecordWeeklyReview&&trustedResolveWeeklyReview){
    Move28.weeklyReviewController=Move28.weeklyReview.createWeeklyReview({rootElement:weeklyRoot,onSubmit:handleWeeklySubmit,onResolve:handleWeeklyResolve,onRescreen:openWeeklyRescreen});
    root.document.addEventListener('keydown',event=>{if(event.key==='Escape')Move28.weeklyReviewController.close()});
  }
  const privacyRoot=$('#privacyTools');
  if(privacyRoot&&trustedCreatePrivacyTools)Move28.privacyController=trustedCreatePrivacyTools({rootElement:privacyRoot});
  activatePlanView(Move28.storage.loadState());
  ui.renderExercises();ui.renderDayList();ui.renderForm();ui.renderOverview();ui.renderSafety();ui.reveal();
  return Move28;
}
return{init,contextFromState,handleOnboardingComplete,handleCapabilityComplete,openGeneratedWorkout,rescreenStepForReason,validationPassed};
});
