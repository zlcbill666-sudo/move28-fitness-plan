(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('./namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){
  Move28.data=Move28.data||{};Move28.domain=Move28.domain||{};Move28.storage=Move28.storage||{};
  Move28.ui=Move28.ui||{};Move28.guide=Move28.guide||{};Move28.onboarding=Move28.onboarding||{};Move28.capabilityAssessment=Move28.capabilityAssessment||{};Move28.privacy=Move28.privacy||{};Move28.reviewHandoff=Move28.reviewHandoff||{};Move28.sessionReadiness=Move28.sessionReadiness||{};
  Object.assign(Move28.data,require('./data/exercise-catalog.js'),require('./data/legacy-demo-plan.js'),require('./data/tracker-fields.js'));
  Object.assign(Move28.domain,require('./domain/risk-engine.js'),require('./domain/capability-engine.js'),require('./domain/movement-matcher.js'),require('./domain/plan-validator.js'),require('./domain/plan-generator.js'),require('./domain/plan-explanation.js'),require('./domain/weekly-adaptation.js'),require('./domain/schedule-shift.js'),require('./domain/session-readiness.js'),require('./domain/daily-execution-validator.js'),require('./domain/session-adaptation.js'));
  Object.assign(Move28.storage,require('./storage/local-store.js'));
  Object.assign(Move28.ui,require('./ui/dashboard.js'));
  Move28.sessionReadiness=require('./ui/session-readiness.js');
  Object.assign(Move28.guide,require('./ui/workout-guide.js'));
  Object.assign(Move28.onboarding,require('./ui/onboarding.js'));
  Move28.capabilityAssessment=require('./ui/capability-assessment.js');
  Move28.weeklyReview=require('./ui/weekly-review.js');
  Move28.privacy=require('./ui/privacy-tools.js');
  Move28.reviewHandoff=require('./ui/review-handoff.js');
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
const safeObjectValues=Object.values;
const safeRegExpTest=Function.prototype.call.bind(RegExp.prototype.test);
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const safeSetAdd=Function.prototype.call.bind(Set.prototype.add);
const SafeSet=Set,SafeMap=Map;
const safeMapHas=Function.prototype.call.bind(Map.prototype.has);
const safeMapGet=Function.prototype.call.bind(Map.prototype.get);
const safeMapSet=Function.prototype.call.bind(Map.prototype.set);
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
const trustedCreateReviewHandoff=Move28.reviewHandoff&&typeof Move28.reviewHandoff.createReviewHandoff==='function'?Move28.reviewHandoff.createReviewHandoff:null;
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
  delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated';return candidate;
}
function validReview(plan,state){const review=plan&&plan.review;return Boolean(review&&review.status==='approved'&&typeof review.reviewerId==='string'&&/^[a-z][a-z0-9._-]{0,63}$/.test(review.reviewerId)&&review.planId===plan.id&&review.intakeRevision===state.intakeRevision&&plan.capabilityRevision===state.capabilityRevision&&review.capabilityRevision===state.capabilityRevision&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewedAt))}
function hasCurrentPainFeedback(state){
  const plan=state.plan,weeks=plan&&plan.weeks;if(!plan||plan.staleReason!=='workout_feedback_pain'||!safeArrayIsArray(weeks))return false;
  const sessionIds=new SafeSet();for(let weekIndex=0;weekIndex<weeks.length;weekIndex+=1){const sessions=weeks[weekIndex]&&weeks[weekIndex].sessions;if(!safeArrayIsArray(sessions))return false;for(let sessionIndex=0;sessionIndex<sessions.length;sessionIndex+=1){const session=sessions[sessionIndex];if(session&&typeof session.id==='string')safeSetAdd(sessionIds,session.id)}}
  const logs=state.logs&&plainRecord(state.logs)?safeObjectValues(state.logs):[];for(let index=0;index<logs.length;index+=1){const record=logs[index];if(record&&record.status==='completed'&&record.planId===plan.id&&record.capabilityRevision===state.capabilityRevision&&record.feedbackCode==='pain'&&safeSetHas(sessionIds,record.sessionId))return true}return false;
}
function contextFromState(inputState){
  if(inputState===null||inputState===undefined)return{mode:'demo',workflowStage:'questionnaire',plan:null,logs:{},message:'尚未完成问卷，当前为只读示例。'};
  const state=clonePureData(inputState);
  if(!state)return{mode:'invalid',workflowStage:'invalid',plan:null,logs:{},message:'本机计划无法安全读取，请重新生成。'};
  if(!state.intake)return{mode:'demo',workflowStage:'questionnaire',plan:null,logs:{},message:'尚未完成问卷，当前为只读示例。'};
  const recomputedRisk=trustedRiskForIntake(state.intake);
  if(!recomputedRisk)return{mode:'invalid',workflowStage:'invalid',plan:null,logs:state.logs||{},message:'本机风险结果无法安全复核，请重新完成问卷。'};
  if(!risksMatch(state.risk,recomputedRisk))return{mode:recomputedRisk.level==='stop'||recomputedRisk.level==='manual_review'?'blocked':'invalid',workflowStage:recomputedRisk.level==='stop'||recomputedRisk.level==='manual_review'?'risk_blocked':'invalid',plan:null,logs:state.logs||{},message:'本机风险结果与当前问卷不一致，请重新完成筛查。'};
  if(recomputedRisk.level==='stop'||recomputedRisk.level==='manual_review')return{mode:'blocked',workflowStage:'risk_blocked',plan:null,logs:state.logs||{},message:'当前筛查结果不开放自动训练，请修改问卷或先完成人工复核。'};
  if(!state.capabilityProfile||!state.capabilityResult||!Number.isSafeInteger(state.capabilityRevision)||state.capabilityRevision<1)return{mode:'review',workflowStage:'capability_required',plan:null,logs:state.logs||{},message:'请完成能力校准，再生成与你当前起点匹配的计划。'};
  const recomputedCapability=trustedCapabilityForProfile(state.capabilityProfile);
  if(!recomputedCapability||!capabilityResultsMatch(state.capabilityResult,recomputedCapability))return{mode:'invalid',workflowStage:'invalid',plan:null,logs:state.logs||{},message:'本机能力档案无法安全复核，请重新完成能力校准。'};
  if(recomputedCapability.status==='stop'||recomputedCapability.status==='manual_review')return{mode:'blocked',workflowStage:'capability_blocked',plan:null,logs:state.logs||{},message:'当前能力校准结果不开放自动训练，请先重新安全筛查或完成人工复核。'};
  if(!state.plan)return{mode:'review',workflowStage:'plan_required',plan:null,logs:state.logs||{},message:'档案已保存，但没有通过安全硬门槛的完整计划。'};
  const logs=state.logs&&plainRecord(state.logs)?safeObjectValues(state.logs):[];let hasCurrentSafetyEvent=false;
  for(let index=0;index<logs.length;index+=1){const record=logs[index];if(record&&record.status==='safety_stopped'&&record.planId===state.plan.id){hasCurrentSafetyEvent=true;break}}
  if(hasCurrentSafetyEvent)return{mode:'stale',workflowStage:'rescreen_required',plan:null,logs:state.logs||{},message:'训练中已记录安全停止事件，旧计划已失效，请重新完成安全筛查。'};
  let hasWeeklyPainRescreen=false;
  if(safeArrayIsArray(state.weeklyReviews))for(let index=0;index<state.weeklyReviews.length;index+=1){const record=state.weeklyReviews[index];if(record&&record.planId===state.plan.id&&record.decision==='rescreen'){hasWeeklyPainRescreen=true;break}}
  if(hasWeeklyPainRescreen)return{mode:'stale',workflowStage:'rescreen_required',plan:null,logs:state.logs||{},message:'每周复盘发现需要重新筛查的疼痛变化，旧计划已失效。'};
  if(hasCurrentPainFeedback(state))return{mode:'stale',workflowStage:'rescreen_required',plan:null,logs:state.logs||{},message:'训练反馈记录了疼痛，旧计划已失效，请重新完成安全筛查。'};
  if(state.plan.status==='stale'||state.plan.intakeRevision!==state.intakeRevision||state.plan.capabilityRevision!==state.capabilityRevision)return{mode:'stale',workflowStage:'plan_stale',plan:null,logs:state.logs||{},message:'档案已经变化，旧计划已失效，请重新确认问卷与能力校准后生成。'};
  if(state.plan.status==='pending_review')return{mode:'review',workflowStage:'human_review',plan:null,logs:state.logs||{},message:'4周计划已生成，人工一致性复核完成前不会开放训练入口。'};
  if(state.plan.status!=='active'||!validReview(state.plan,state))return{mode:'invalid',workflowStage:'invalid',plan:null,logs:state.logs||{},message:'本机计划状态或人工复核凭据无效，请等待重新复核。'};
  const candidate=validationCandidate(state.plan);
  if(!candidate)return{mode:'invalid',workflowStage:'invalid',plan:null,logs:state.logs||{},message:'本机计划无法安全读取，请重新生成。'};
  let validation;try{validation=trustedValidatePlan&&trustedValidatePlan({plan:candidate,intake:state.intake,risk:recomputedRisk,capabilityResult:state.capabilityResult,capabilityRevision:state.capabilityRevision,catalog:trustedCatalog})}catch(_error){validation=null}
  return validationPassed(validation)?{mode:'generated',workflowStage:'ready',plan:state.plan,logs:state.logs||{},message:''}:{mode:'invalid',workflowStage:'invalid',plan:null,logs:state.logs||{},message:'本机计划未通过安全复核，请重新生成。'};
}
const MACHINE_ID_PATTERN=/^[a-z][a-z0-9._-]{0,63}$/;
function inspectWeeklyPlanLineage(reviews,currentPlanId,capabilityRevision){
  const lineage=new SafeSet(),accepted=[];
  const invalid=()=>({valid:false,lineage});
  if(typeof currentPlanId!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,currentPlanId))return invalid();
  safeSetAdd(lineage,currentPlanId);
  for(let index=0;index<reviews.length;index+=1){const item=reviews[index];if(item&&item.decision==='accepted'&&item.capabilityRevision===capabilityRevision)safeArrayPush(accepted,item)}
  const incoming=new SafeMap(),outgoing=new SafeMap();
  for(let index=0;index<accepted.length;index+=1){
    const item=accepted[index];
    if(typeof item.planId!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,item.planId)||typeof item.resultPlanId!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,item.resultPlanId)||item.planId===item.resultPlanId||safeMapHas(incoming,item.resultPlanId)||safeMapHas(outgoing,item.planId))return invalid();
    safeMapSet(incoming,item.resultPlanId,item.planId);safeMapSet(outgoing,item.planId,item.resultPlanId);
  }
  const globallyVisited=new SafeSet();
  for(let index=0;index<accepted.length;index+=1){
    let cursor=accepted[index].planId;if(safeSetHas(globallyVisited,cursor))continue;const path=new SafeSet();
    while(safeMapHas(outgoing,cursor)){
      if(safeSetHas(path,cursor))return invalid();
      safeSetAdd(path,cursor);safeSetAdd(globallyVisited,cursor);cursor=safeMapGet(outgoing,cursor);
    }
  }
  let cursor=currentPlanId;
  while(safeMapHas(incoming,cursor)){
    const parent=safeMapGet(incoming,cursor);if(safeSetHas(lineage,parent))return invalid();safeSetAdd(lineage,parent);cursor=parent;
  }
  for(let index=0;index<accepted.length;index+=1){const item=accepted[index];if(!safeSetHas(lineage,item.planId)||!safeSetHas(lineage,item.resultPlanId))return invalid()}
  return{valid:true,lineage};
}
const UTC_ISO_PATTERN=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function feedbackSummaryForWeek(state,plan,week){
  const counts={too_easy:0,appropriate:0,too_hard:0,pain:0},sessionIds=new SafeSet(),recordedSessions=new SafeSet();
  for(let index=0;index<week.sessions.length;index+=1)safeSetAdd(sessionIds,week.sessions[index].id);
  const logs=state.logs&&plainRecord(state.logs)?safeObjectValues(state.logs):[];
  for(let index=0;index<logs.length;index+=1){const record=logs[index];
    if(!record||record.status!=='completed'||record.planId!==plan.id||record.capabilityRevision!==state.capabilityRevision
      ||!safeSetHas(sessionIds,record.sessionId)||(record.feedbackCode!=='too_easy'&&record.feedbackCode!=='appropriate'&&record.feedbackCode!=='too_hard'&&record.feedbackCode!=='pain')||safeSetHas(recordedSessions,record.sessionId)
      ||typeof record.completedAt!=='string'||!safeRegExpTest(UTC_ISO_PATTERN,record.completedAt)
      ||typeof record.feedbackAt!=='string'||!safeRegExpTest(UTC_ISO_PATTERN,record.feedbackAt))continue;
    safeSetAdd(recordedSessions,record.sessionId);counts[record.feedbackCode]+=1;
  }
  return{recorded:recordedSessions.size,total:week.sessions.length,counts};
}
function weeklyReviewTarget(state,context){
  const trustedInput=clonePureData({state,context});
  if(!trustedInput)return null;
  state=trustedInput.state;context=trustedInput.context;
  if(!state||!context||context.mode!=='generated'||!context.plan||!safeArrayIsArray(state.weeklyReviews)||!Number.isSafeInteger(state.capabilityRevision)||state.capabilityRevision<1||context.plan.capabilityRevision!==state.capabilityRevision||typeof context.plan.id!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,context.plan.id)||!safeArrayIsArray(context.plan.weeks))return null;
  const weekNumbers=new SafeSet();
  for(let weekIndex=0;weekIndex<context.plan.weeks.length;weekIndex+=1){const week=context.plan.weeks[weekIndex];
    if(!plainRecord(week)||!Number.isSafeInteger(week.number)||week.number<1||week.number>4||safeSetHas(weekNumbers,week.number)||!safeArrayIsArray(week.sessions))return null;
    safeSetAdd(weekNumbers,week.number);
    for(let sessionIndex=0;sessionIndex<week.sessions.length;sessionIndex+=1){const session=week.sessions[sessionIndex];if(!plainRecord(session)||typeof session.id!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,session.id))return null}
  }
  const currentReviews=[];for(let index=0;index<state.weeklyReviews.length;index+=1){const item=state.weeklyReviews[index];if(item&&item.capabilityRevision===state.capabilityRevision){
    const decision=item.decision;
    if(!plainRecord(item)||typeof item.id!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,item.id)||typeof item.planId!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,item.planId)||!Number.isSafeInteger(item.weekNumber)||item.weekNumber<1||item.weekNumber>4||(decision!=='pending'&&decision!=='accepted'&&decision!=='rejected'&&decision!=='rescreen')||(decision==='accepted'?(typeof item.resultPlanId!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,item.resultPlanId)):item.resultPlanId!==null))return null;
    const proposal=item.proposal;if(!plainRecord(proposal)||typeof proposal.reasonCode!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,proposal.reasonCode)||!(proposal.variable===null||(typeof proposal.variable==='string'&&safeRegExpTest(MACHINE_ID_PATTERN,proposal.variable))))return null;
    safeArrayPush(currentReviews,item);
  }}
  const inspection=inspectWeeklyPlanLineage(currentReviews,context.plan.id,state.capabilityRevision);if(!inspection.valid)return null;const lineage=inspection.lineage;
  let pending=null;for(let index=0;index<currentReviews.length;index+=1){const item=currentReviews[index];if(safeSetHas(lineage,item.planId)&&item.decision==='pending'){pending=item;break}}
  if(pending){
    if(typeof pending.id!=='string'||!safeRegExpTest(MACHINE_ID_PATTERN,pending.id)||!Number.isSafeInteger(pending.weekNumber)||!plainRecord(pending.answers)||!Number.isSafeInteger(pending.answers.scheduledSessions)||pending.answers.scheduledSessions<0)return null;
    let week=null;for(let index=0;index<context.plan.weeks.length;index+=1)if(context.plan.weeks[index].number===pending.weekNumber){week=context.plan.weeks[index];break}
    return week&&pending.answers.scheduledSessions===week.sessions.length?{weekNumber:pending.weekNumber,scheduledSessions:pending.answers.scheduledSessions,reviewId:pending.id,proposal:pending.proposal,feedbackSummary:feedbackSummaryForWeek(state,context.plan,week)}:null;
  }
  const reviewed=new SafeSet();for(let index=0;index<currentReviews.length;index+=1){const item=currentReviews[index];if(safeSetHas(lineage,item.planId))safeSetAdd(reviewed,item.weekNumber)}
  let week=null;for(let index=0;index<context.plan.weeks.length;index+=1)if(!safeSetHas(reviewed,context.plan.weeks[index].number)){week=context.plan.weeks[index];break}
  return week?{weekNumber:week.number,scheduledSessions:week.sessions.length,feedbackSummary:feedbackSummaryForWeek(state,context.plan,week)}:null;
}
function renderWeeklyEntry(state,context){
  if(!root.document)return;const slot=root.document.querySelector('#weeklyReviewSlot');if(!slot)return;
  const target=weeklyReviewTarget(state,context);slot.innerHTML=target?`<button class="cta weekly-review-open" type="button">${target.reviewId?'继续决定':'第'+target.weekNumber+'周复盘'}</button><small>调整需由你确认，并重新经过人工一致性复核。</small>`:'';
  const button=slot.querySelector('button');if(button)button.onclick=()=>Move28.weeklyReviewController&&Move28.weeklyReviewController.open(target);
}
function activatePlanView(state){const context=contextFromState(state);Move28.ui.setPlanContext(context);renderWeeklyEntry(state,context);if(Move28.reviewHandoffController)Move28.reviewHandoffController.render(state);return context}
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
  const nextCapabilityRevision=current.capabilityRevision+1;
  const generated=Move28.domain.generatePlan({intake:current.intake,risk:current.risk,intakeRevision:current.intakeRevision,capabilityResult:result,capabilityRevision:nextCapabilityRevision,catalog:trustedCatalog,mediaRequirement:'public_release'});
  if(!generated||generated.status!=='generated'){
    const saved=trustedSaveCapabilityProfile(profile);
    Move28.ui.setPlanContext({mode:'review',plan:null,logs:saved.logs||{},message:'动作、器械或安全硬门槛未满足，需要人工复核。'});
    return{message:'能力档案已保存到本机，但公开发布媒体硬门未通过，需要人工复核或继续补齐正式媒体。'};
  }
  const capabilityBoundPlan=Object.assign({},generated,{capabilityRevision:current.capabilityRevision+1});
  const persisted=trustedSaveCapabilityProfileWithPlan(profile,capabilityBoundPlan);
  activatePlanView(persisted);
  return{message:'待人工复核（pending_review）：候选4周计划已保存到当前浏览器。为避免未经复核的动作、器械或剂量直接进入训练，人工一致性复核完成前不会开放训练入口，训练入口保持锁定。下一步请联系指定复核人或备用联系人；复核后回到同一台设备和同一个浏览器，刷新状态。'};
}
function revokeAdaptation(adaptationId){
  const revoke=Move28.sessionReadiness&&Move28.sessionReadiness.revokeConfirmedAdaptation;
  return typeof revoke==='function'&&typeof adaptationId==='string'?revoke(adaptationId):false;
}
function handleGuideStop(event){
  if(!event||typeof event!=='object')return false;
  if(event.type==='ordinary_exit')return true;
  if(event.type==='safety_persisted'){activatePlanView(event.persistedState);return true}
  if(event.type==='rescreen'){
    const controller=Move28.onboardingController;if(!controller)return false;
    controller.setField('finalConfirmed',false);controller.open();controller.goTo(rescreenStepForReason(event.reasonCode));return true;
  }
  if(event.type!=='safety_stop'||!trustedRecordWorkoutStop)throw new Error('Safety stop unavailable');
  const updated=trustedRecordWorkoutStop({sessionId:event.sessionId,reasonCode:event.reasonCode,actionIndex:event.actionIndex,occurredAt:event.occurredAt});
  revokeAdaptation(event.adaptationId);activatePlanView(updated);return true;
}
function handleWorkoutFeedback(event){
  if(!event||event.type!=='workout_feedback'||!event.persistedState)return false;
  activatePlanView(event.persistedState);
  if(event.feedbackCode==='pain'){
    const controller=Move28.onboardingController;if(!controller)return false;
    controller.setField('finalConfirmed',false);controller.open();controller.goTo(6);
  }
  return true;
}
function openGeneratedWorkout(sessionId){
  const state=Move28.storage.loadState(),context=contextFromState(state);
  if(context.mode!=='generated'){activatePlanView(state);Move28.ui.showToast('当前没有可执行的有效计划');return false}
  const session=context.plan.weeks.flatMap(week=>week.sessions).find(item=>item.id===sessionId);
  if(!session){Move28.ui.showToast('未找到已校验的训练节');return false}
  return Move28.guide.openWorkout({
    session,catalog:trustedCatalog,
    onComplete:()=>{const updated=Move28.storage.recordWorkoutCompletion({planId:context.plan.id,sessionId:session.id});activatePlanView(updated);return updated},
    onFeedback:handleWorkoutFeedback,
    onStop:handleGuideStop
  });
}
function openAdaptedWorkout(adaptationId){
  const loader=Move28.sessionReadiness&&Move28.sessionReadiness.loadConfirmedAdaptation;
  const loaded=typeof loader==='function'?loader(adaptationId):null;
  if(!loaded){Move28.ui.showToast('当日适配已失效，请重新确认');return false}
  let opened=false;
  try{
    opened=Move28.guide.openWorkout({
      adaptationId,catalog:trustedCatalog,
      onComplete:event=>{if(event&&event.type==='adapted_completed')activatePlanView(event.persistedState)},
      onFeedback:handleWorkoutFeedback,
      onStop:handleGuideStop
    });
  }catch(_error){opened=false}
  if(opened!==true)revokeAdaptation(adaptationId);return opened;
}
function openSessionReadiness(sessionId){
  if(Move28.state&&Move28.state.guideMode&&Move28.state.guideMode!=='closed')return false;
  return Boolean(Move28.sessionReadinessController&&Move28.sessionReadinessController.open(sessionId));
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
  Move28.openSessionReadiness=openSessionReadiness;
  if(root.window===root)root.openSessionReadiness=openSessionReadiness;
  const readinessRoot=$('#sessionReadinessView');
  if(readinessRoot&&Move28.sessionReadiness&&typeof Move28.sessionReadiness.createSessionReadiness==='function'){
    Move28.sessionReadinessController=Move28.sessionReadiness.createSessionReadiness({
      rootElement:readinessRoot,
      onKeep:({sessionId})=>openGeneratedWorkout(sessionId),
      onAdapted:({adaptationId})=>openAdaptedWorkout(adaptationId)
    });
  }
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
  const reviewRoot=$('#reviewHandoff');
  if(reviewRoot&&trustedCreateReviewHandoff)Move28.reviewHandoffController=trustedCreateReviewHandoff({rootElement:reviewRoot,onDecision:activatePlanView,state:Move28.storage.loadState()});
  activatePlanView(Move28.storage.loadState());
  ui.renderExercises();ui.renderDayList();ui.renderForm();ui.renderOverview();ui.renderSafety();ui.reveal();
  return Move28;
}
return{init,contextFromState,weeklyReviewTarget,handleOnboardingComplete,handleCapabilityComplete,openGeneratedWorkout,rescreenStepForReason,validationPassed};
});
