(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
if(isCommonJS){require('../data/legacy-demo-plan.js');require('../data/tracker-fields.js')}
const validatorApi=isCommonJS?require('../domain/plan-validator.js'):Move28.domain;
const explanationApi=isCommonJS?require('../domain/plan-explanation.js'):Move28.domain;
const catalogApi=isCommonJS?require('../data/exercise-catalog.js'):Move28.data;
const mediaPolicyApi=isCommonJS?require('../data/exercise-media-policy.js'):Move28.data&&Move28.data.exerciseMediaPolicy;
const storageApi=isCommonJS?require('../storage/local-store.js'):Move28.storage;
const trustedValidatePlan=validatorApi&&typeof validatorApi.validatePlan==='function'?validatorApi.validatePlan:null;
const trustedBuildPlanExplanation=explanationApi&&typeof explanationApi.buildPlanExplanation==='function'?explanationApi.buildPlanExplanation:null;
const trustedCatalog=catalogApi&&Array.isArray(catalogApi.exerciseCatalog)?catalogApi.exerciseCatalog:null;
const trustedMediaPresentation=mediaPolicyApi&&typeof mediaPolicyApi.presentationFor==='function'?mediaPolicyApi.presentationFor:null;
const trustedLoadState=storageApi&&typeof storageApi.loadState==='function'?storageApi.loadState:null;
const trustedPreviewScheduleShift=storageApi&&typeof storageApi.previewScheduleShift==='function'?storageApi.previewScheduleShift:null;
const api=factory(root,Move28,trustedValidatePlan,trustedBuildPlanExplanation,trustedCatalog,trustedMediaPresentation,trustedLoadState,trustedPreviewScheduleShift);
if(isCommonJS)module.exports=api;
})(globalThis,function(root,Move28,trustedValidatePlan,trustedBuildPlanExplanation,trustedCatalog,trustedMediaPresentation,trustedLoadState,trustedPreviewScheduleShift){
'use strict';
const DATA=Move28.data.legacyDemoPlan;
const TRACKER_FIELDS=Move28.data.trackerFields;
const state=Move28.state;
const {$,$$,esc,localDate,storage}=Move28.utils;
const planContext={mode:'demo',workflowStage:'questionnaire',plan:null,logs:{},explanation:null,message:'',shiftPreview:null,shiftDisplay:null};
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const safeArrayIsArray=Array.isArray;
const safeObjectValues=Object.values;
const SafeSet=Set;
const safeSetAdd=Function.prototype.call.bind(Set.prototype.add);
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const safeObjectPrototype=Object.prototype;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
const safeGetPrototypeOf=Object.getPrototypeOf;
const safeOwnKeys=Reflect.ownKeys;
const WEEKDAY_LABELS={mon:'周一',tue:'周二',wed:'周三',thu:'周四',fri:'周五',sat:'周六',sun:'周日'};
const SHIFT_UNAVAILABLE_LABELS={NO_SAFE_SHIFT_DAY:'当前没有符合训练间隔与可用日规则的安全空位。',SESSION_ALREADY_COMPLETED:'这节训练已经完成，不需要顺延显示。',CYCLE_COMPLETE:'已到4周计划周期末，无法继续顺延显示。',INVALID_SHIFT_INPUT:'当前训练节无法生成安全顺延建议。'};
const WORKFLOW_STEPS=[{key:'questionnaire',label:'安全问卷'},{key:'capability',label:'能力校准'},{key:'review',label:'人工复核'},{key:'training',label:'今日训练'}];
const WORKFLOW_INFO={
  questionnaire:{title:'先完成安全问卷',detail:'约3分钟，结果只保存在当前浏览器。',index:0,tone:'current'},
  capability_required:{title:'继续完成能力校准',detail:'五项非极限检查均可跳过；完成前不会生成可训练计划。',index:1,tone:'current'},
  plan_required:{title:'计划需要人工处理',detail:'档案已保存，但当前没有通过全部安全硬门槛的完整计划。',index:2,tone:'attention'},
  human_review:{title:'等待人工一致性复核',detail:'候选4周计划已生成；复核完成前训练入口保持关闭。',index:2,tone:'current'},
  risk_blocked:{title:'安全筛查暂不开放训练',detail:'请根据页面提示修改问卷，或先咨询合适的专业人员。',index:0,tone:'attention'},
  capability_blocked:{title:'能力校准需要复核',detail:'当前结果不开放自动训练，请先重新筛查或完成人工复核。',index:1,tone:'attention'},
  plan_stale:{title:'计划需要重新确认',detail:'档案已变化，旧计划已失效；重新确认问卷与能力后再生成。',index:2,tone:'attention'},
  rescreen_required:{title:'需要重新安全筛查',detail:'旧计划已经失效；重新确认前不会恢复训练入口。',index:0,tone:'attention'},
  invalid:{title:'本机状态无法验证',detail:'当前数据不会被当作可训练计划，请重新完成相应步骤。',index:-1,tone:'attention'},
  ready:{title:'今日训练可开始',detail:'计划已通过规则校验与人工一致性复核；开始前仍会检查今天的状态。',index:3,tone:'current'},
  cycle_complete:{title:'4周训练周期已完成',detail:'本周期全部训练已经记录完成；不会自动创建第5周或重新开放已完成训练。',index:3,tone:'done'}
};
function workflowStageForMode(mode,requested){
  if(mode==='generated')return'ready';if(mode==='demo')return'questionnaire';if(mode==='stale')return requested==='plan_stale'?'plan_stale':'rescreen_required';if(mode==='invalid')return'invalid';
  if(mode==='blocked')return requested==='capability_blocked'?'capability_blocked':'risk_blocked';
  if(mode==='review')return requested==='capability_required'||requested==='plan_required'||requested==='human_review'?requested:'plan_required';
  return'invalid';
}
function workflowStepState(stage,index){
  const info=WORKFLOW_INFO[stage]||WORKFLOW_INFO.invalid;if(info.index<0)return index===0?'attention':'locked';
  if(index<info.index)return'done';if(index===info.index)return info.tone;return'locked';
}
function renderWorkflowStatus(){
  const slot=$('#workflowStatus');if(!slot)return;const stage=planContext.workflowStage,info=WORKFLOW_INFO[stage]||WORKFLOW_INFO.invalid;
  slot.dataset.stage=stage;slot.className=`workflow-status workflow-${info.tone}`;
  slot.innerHTML=`<div class="workflow-copy"><div><span class="workflow-kicker">PLAN STATUS</span><h3>${esc(info.title)}</h3></div><p>${esc(planContext.message||info.detail)}</p></div><div class="workflow-steps">${WORKFLOW_STEPS.map((step,index)=>{const status=workflowStepState(stage,index),current=status==='current'||status==='attention';return`<div class="workflow-step ${status}" data-workflow-step data-step="${step.key}"${current?' aria-current="step"':''}><span>${status==='done'?'✓':String(index+1).padStart(2,'0')}</span><b>${step.label}</b><small>${status==='done'?'已完成':current?'当前':'未开放'}</small></div>`}).join('')}</div>`;
}
function applyAppMode(){const body=root.document&&root.document.body;if(body)body.classList.toggle('app-mode-generated',planContext.mode==='generated')}
function dayClass(t){return /力量/.test(t)?'strength':/有氧/.test(t)?'cardio':'recovery'}
function generatedSessionLabel(intent){return intent==='full_body_strength'?'全身力量':intent==='low_impact_cardio'?'低冲击有氧':intent==='recovery'?'恢复训练':'计划受限'}
function generatedSessionClass(intent){return intent==='full_body_strength'?'strength':intent==='low_impact_cardio'?'cardio':'recovery'}
function legacyProgress(){const done=Object.values(state.tracker).filter(r=>['已完成','部分完成'].includes(r['完成状态'])).length;return{done,pct:Math.round(done/28*100)}}
function generatedSessions(){return planContext.plan?planContext.plan.weeks.flatMap(week=>week.sessions):[]}
function completedSessionIds(){const completed=new SafeSet(),records=safeObjectValues(planContext.logs||{});for(let index=0;index<records.length;index+=1){const record=records[index];if(record&&record.planId===planContext.plan?.id&&record.status==='completed')safeSetAdd(completed,record.sessionId)}return completed}
function allGeneratedSessionsCompleted(){const sessions=generatedSessions(),completed=completedSessionIds();if(!sessions.length)return false;for(let index=0;index<sessions.length;index+=1)if(!safeSetHas(completed,sessions[index].id))return false;return true}
function selectedGeneratedSession(){
  const sessions=generatedSessions(),completed=completedSessionIds();
  return sessions.find(session=>session.id===state.currentSessionId)||sessions.find(session=>!safeSetHas(completed,session.id))||null;
}
function displayedSchedule(session){
  const display=planContext.shiftDisplay;
  return display&&display.sessionId===session.id?{weekNumber:display.to.weekNumber,weekday:display.to.weekday,originalWeekNumber:display.from.weekNumber,originalWeekday:display.from.weekday}:null;
}
function exactRecord(value,keys){
  try{
    if(!value||typeof value!=='object'||safeArrayIsArray(value))return null;
    const prototype=safeGetPrototypeOf(value);if(prototype!==null&&prototype!==safeObjectPrototype)return null;
    const actual=safeOwnKeys(value);if(actual.length!==keys.length)return null;
    for(let index=0;index<actual.length;index+=1){
      const actualKey=actual[index];let matched=false;
      if(typeof actualKey!=='string')return null;
      for(let keyIndex=0;keyIndex<keys.length;keyIndex+=1)if(keys[keyIndex]===actualKey){matched=true;break}
      if(!matched)return null;
    }
    const output={};
    for(let index=0;index<keys.length;index+=1){const key=keys[index],descriptor=safeGetOwnPropertyDescriptor(value,key);if(!descriptor||!descriptor.enumerable||!safeHasOwn(descriptor,'value'))return null;output[key]=descriptor.value}
    return output;
  }catch(_error){return null}
}
function generatedSessionWeek(sessionId){
  const weeks=planContext.plan&&planContext.plan.weeks;if(!safeArrayIsArray(weeks))return null;
  for(let weekIndex=0;weekIndex<weeks.length;weekIndex+=1){
    const sessions=weeks[weekIndex]&&weeks[weekIndex].sessions;if(!safeArrayIsArray(sessions))return null;
    for(let sessionIndex=0;sessionIndex<sessions.length;sessionIndex+=1)if(sessions[sessionIndex]&&sessions[sessionIndex].id===sessionId)return weeks[weekIndex];
  }
  return null;
}
function safeShiftPreview(raw,session){
  const response=exactRecord(raw,['status','code','suggestion']);
  if(!response||!nativeStructuredClone)return null;
  if(response.status==='unavailable'&&response.suggestion===null&&typeof response.code==='string'&&safeHasOwn(SHIFT_UNAVAILABLE_LABELS,response.code)){try{nativeStructuredClone(raw)}catch(_error){return null}return{status:'unavailable',code:response.code,suggestion:null}}
  if(response.status!=='available'||response.code!=='SCHEDULE_SHIFT_AVAILABLE')return null;
  const suggestion=exactRecord(response.suggestion,['planId','sessionId','intent','from','to','displayOnly']);
  const from=suggestion&&exactRecord(suggestion.from,['weekNumber','weekday']),to=suggestion&&exactRecord(suggestion.to,['weekNumber','weekday']);
  const week=generatedSessionWeek(session.id);
  if(!suggestion||!from||!to||suggestion.displayOnly!==true||suggestion.planId!==planContext.plan?.id||suggestion.sessionId!==session.id||suggestion.intent!==session.intent||from.weekNumber!==week?.number||from.weekday!==session.weekday||to.weekNumber!==from.weekNumber||!Number.isSafeInteger(to.weekNumber)||to.weekNumber<1||to.weekNumber>4||!safeHasOwn(WEEKDAY_LABELS,to.weekday)||to.weekday===from.weekday)return null;
  try{nativeStructuredClone(raw)}catch(_error){return null}
  return{status:'available',code:response.code,suggestion:{planId:suggestion.planId,sessionId:suggestion.sessionId,intent:suggestion.intent,from:{weekNumber:from.weekNumber,weekday:from.weekday},to:{weekNumber:to.weekNumber,weekday:to.weekday},displayOnly:true}};
}
function shiftPanelMarkup(session){
  const preview=planContext.shiftPreview;if(!preview||preview.sessionId!==session.id)return'';
  if(preview.status==='unavailable')return`<div class="today-block schedule-shift-preview" role="status"><div class="label">无法安全顺延</div><p>${esc(SHIFT_UNAVAILABLE_LABELS[preview.code])}</p><div class="day-controls"><button class="btn shift-preview-close" type="button" onclick="closeScheduleShiftPreview()">关闭</button></div></div>`;
  const suggestion=preview.suggestion;
  return`<div class="today-block schedule-shift-preview" role="status"><div class="label">仅日历显示预览</div><div class="today-value">第${suggestion.from.weekNumber}周${esc(WEEKDAY_LABELS[suggestion.from.weekday])} → 第${suggestion.to.weekNumber}周${esc(WEEKDAY_LABELS[suggestion.to.weekday])}</div><p>只调整这节训练在日历中的显示位置；动作、剂量、完成状态和人工审核处方不会改变。</p><div class="day-controls"><button class="btn primary shift-display-apply" type="button" onclick="applyScheduleShiftDisplay()">仅更新日历显示</button><button class="btn shift-preview-close" type="button" onclick="closeScheduleShiftPreview()">关闭</button></div></div>`;
}
function explanationMarkup(explanation){
  if(!explanation||explanation.validationResult!=='passed')return'';
  const strategy=explanation.strategy==='conservative_start'?'安全与能力规则要求保守起步':'安全与能力规则支持标准起步';
  const setting=explanation.setting==='gym'?'健身房':'居家';
  const duration=explanation.durationRange.min===explanation.durationRange.max?`${explanation.durationRange.min}分钟`:`${explanation.durationRange.min}–${explanation.durationRange.max}分钟`;
  const weeklySessions=explanation.weeklySessionRange.min===explanation.weeklySessionRange.max?`每周${explanation.weeklySessionRange.min}节`:`每周${explanation.weeklySessionRange.min}–${explanation.weeklySessionRange.max}节`;
  const reasons=explanation.reasonLabels.length?`<ul>${explanation.reasonLabels.map(label=>`<li>${esc(label)}</li>`).join('')}</ul>`:'<p>五项能力检查未触发动作降级；仍以无痛、动作可控和停止信号优先。</p>';
  return `<details class="plan-explanation"><summary><span>为什么这样安排</span><small>查看依据</small></summary><div class="plan-explanation-body"><div class="plan-explanation-facts"><span>${esc(strategy)}</span><span>${esc(setting)}场景</span><span>${esc(weeklySessions)}</span><span>${esc(duration)}/节</span></div>${reasons}<p class="plan-explanation-note">这里只显示安全与能力规则形成的受控结论，不展示原始健康问卷答案。</p></div></details>`;
}
function sessionRpeLabel(actions){let minimum=null,maximum=null;for(let index=0;index<actions.length;index+=1){const value=actions[index]&&actions[index].rpe;if(typeof value!=='number'||!Number.isFinite(value))continue;minimum=minimum===null?value:Math.min(minimum,value);maximum=maximum===null?value:Math.max(maximum,value)}return minimum===null?'RPE —':minimum===maximum?`RPE ${minimum}`:`RPE ${minimum}–${maximum}`}
function renderGeneratedToday(){
  const session=selectedGeneratedSession();
  if(!session){
    if(allGeneratedSessionsCompleted()){$('#todayCard').innerHTML='<div class="today-day"><span>USER PLAN / 4周</span><strong>✓</strong></div><div class="today-content"><div class="today-top"><span class="chip">周期完成</span><span class="chip">已人工复核</span></div><h3>4周训练周期完成</h3><p>本周期全部训练已记录完成。系统不会自动创建第5周，也不会重新开放已经完成的训练。</p><div class="progress-wrap"><div class="progress-line"><i style="width:100%"></i></div><div class="progress-text">已完成全部训练 · 100%</div></div></div>';return}
    $('#todayCard').innerHTML='<div class="today-content"><span class="chip">计划受限</span><h3>暂未生成可执行计划</h3><p>请修改问卷或等待人工复核；系统不会用示例动作替代你的计划。</p></div>';return
  }
  state.currentSessionId=session.id;
  const sessions=generatedSessions(),completed=completedSessionIds(),done=sessions.filter(item=>safeSetHas(completed,item.id)).length,pct=Math.round(done/sessions.length*100);
  const week=generatedSessionWeek(session.id);
  const isCompleted=safeSetHas(completed,session.id),actionNames=session.actions.map(action=>trustedCatalog.find(item=>item.id===action.exerciseId)?.name||action.exerciseId),display=isCompleted?null:displayedSchedule(session);
  const displayedWeek=display?.weekNumber||week.number,displayedWeekday=display?.weekday||session.weekday,settingLabel=session.setting==='gym'?'健身房':'居家',rpeLabel=sessionRpeLabel(session.actions);
  const shiftBadge=display?`<span class="chip shift-display-badge">顺延显示 · 原${esc(WEEKDAY_LABELS[display.originalWeekday])}</span>`:'';
  const shiftControl=display?'<button class="btn shift-display-restore" type="button" onclick="restoreScheduleShiftDisplay()">恢复原日历</button>':(!isCompleted&&!planContext.shiftDisplay?'<button class="btn shift-preview-open" type="button" onclick="previewScheduleShift()">错过了这节？查看安全顺延</button>':'');
  const startControl=isCompleted?'<span class="chip session-complete-status">本节已完成</span>':`<button class="btn primary today-start" data-session-id="${esc(session.id)}" onclick="openSessionReadiness(this.dataset.sessionId)">▶ 开始今天训练</button>`;
  const shiftPanel=isCompleted?'':shiftPanelMarkup(session);
  $('#todayCard').innerHTML=`<div class="today-day"><span>USER PLAN / 第${displayedWeek}周</span><strong>${String(displayedWeek).padStart(2,'0')}</strong></div><div class="today-content"><div class="today-top"><span class="chip">${esc(WEEKDAY_LABELS[displayedWeekday]||displayedWeekday)}</span>${shiftBadge}<span class="chip">已人工复核</span></div><h3>${generatedSessionLabel(session.intent)}</h3><div class="today-summary-grid"><div data-today-metric="duration"><small>预计时长</small><strong>${session.estimatedMinutes}分钟</strong></div><div data-today-metric="actions"><small>本节安排</small><strong>${session.actions.length}个动作</strong></div><div data-today-metric="setting"><small>训练地点</small><strong>${settingLabel}</strong></div><div data-today-metric="rpe"><small>计划强度</small><strong>${rpeLabel}</strong></div></div><div class="day-controls">${startControl}${shiftControl}</div><div class="today-block"><div class="label">本节固定动作</div><div class="today-value">${actionNames.map(esc).join(' · ')}</div></div>${shiftPanel}${explanationMarkup(planContext.explanation)}<div class="progress-wrap"><div class="progress-line"><i style="width:${pct}%"></i></div><div class="progress-text">已完成 ${done}/${sessions.length} 节 · ${pct}%</div></div><span class="tiny-help">动作和剂量已经过校验；跟练中每屏只显示一个确定动作。</span></div>`;
}
function renderDemoToday(){const d=DATA.days[state.currentDay-1],p=legacyProgress();$('#todayCard').innerHTML=`<div class="today-day"><span>只读示例 / 第${d.week}周</span><strong>${String(d.day).padStart(2,'0')}</strong></div><div class="today-content"><div class="today-top"><span class="chip">示例计划</span><span class="chip">${esc(d.weekday)} · ${esc(d.place)}</span><span class="chip">${esc(d.duration)}</span></div><h3>${esc(d.type)}</h3><div class="today-grid"><div class="today-block"><div class="label">热身与力量</div><div class="today-value">${esc(d.strength)}</div></div><div class="today-block"><div class="label">有氧 / 步行</div><div class="today-value">${esc(d.cardio)}</div></div></div><div class="progress-text">示例只用于了解结构，不会写入训练记录。旧示例记录：${p.done}/28。</div><div class="day-controls"><button class="btn" onclick="moveDay(-1)">← 前一天</button><button class="btn" onclick="moveDay(1)">后一天 →</button></div></div>`}
function renderToday(){if(planContext.mode==='generated')renderGeneratedToday();else if(planContext.mode==='demo')renderDemoToday();else $('#todayCard').innerHTML=`<div class="today-content"><span class="chip">${planContext.mode==='stale'?'计划已失效':'需要复核'}</span><h3>暂未生成可执行计划</h3><p>${esc(planContext.message||'请修改问卷或等待人工复核；当前不会开放训练入口。')}</p></div>`}
function persistLocal(key,value){try{storage.setItem(key,value);return true}catch(_error){showToast('本机保存失败，请检查浏览器存储权限后重试');return false}}
Move28.moveDay=n=>{if(planContext.mode!=='demo')return;const next=Math.min(28,Math.max(1,state.currentDay+n));if(persistLocal('move28-current-day',next))state.currentDay=next;renderToday()};
function renderWeeks(){
  if(planContext.mode==='generated'){
    const completed=completedSessionIds();
    $('#weekTabs').innerHTML=planContext.plan.weeks.map(week=>`<button class="tab ${week.number===state.currentWeek?'active':''}" onclick="pickWeek(${week.number})">第${week.number}周</button>`).join('');
    const week=planContext.plan.weeks[state.currentWeek-1];
    $('#weekView').innerHTML=`<div class="week-focus"><span>本周重点</span>${esc(week.focus)}</div><div class="days-grid generated-days">${week.sessions.map(session=>{const isCompleted=safeSetHas(completed,session.id),display=isCompleted?null:displayedSchedule(session),weekday=display?.weekday||session.weekday;return`<article class="day-card ${generatedSessionClass(session.intent)} ${isCompleted?'completed':''}" data-session-id="${esc(session.id)}"><div class="num">${esc(WEEKDAY_LABELS[weekday]||weekday)}</div>${display?`<div class="type shift-display-badge">顺延显示 · 原${esc(WEEKDAY_LABELS[display.originalWeekday])}</div>`:''}<h3>${generatedSessionLabel(session.intent)}</h3><div class="type">${session.estimatedMinutes}分钟 · ${isCompleted?'已完成':'待完成'}</div><button class="btn" type="button" data-session-id="${esc(session.id)}" onclick="selectGeneratedSession(this.dataset.sessionId)">查看此节</button></article>`}).join('')}</div>`;
    return;
  }
  if(planContext.mode!=='demo'){$('#weekTabs').innerHTML='';$('#weekView').innerHTML=`<div class="week-focus"><span>计划受限</span>${esc(planContext.message||'没有可执行计划')}</div>`;return}
  $('#weekTabs').innerHTML=DATA.weeks.map(w=>`<button class="tab ${w.week===state.currentWeek?'active':''}" onclick="pickWeek(${w.week})">第${w.week}周</button>`).join('');const w=DATA.weeks[state.currentWeek-1];$('#weekView').innerHTML=`<div class="week-focus"><span>只读示例 · 本周重点</span>${esc(w.focus)}</div><div class="days-grid">${w.days.map(d=>`<article class="day-card ${dayClass(d.type)}"><div class="num">${d.day}</div><h3>${esc(d.weekday)}</h3><div class="type">${esc(d.type)}</div><dl><dt>热身与力量</dt><dd>${esc(d.strength)}</dd><dt>有氧／步行</dt><dd>${esc(d.cardio)}</dd><dt>地点与时长</dt><dd>${esc(d.place)} · ${esc(d.duration)}</dd></dl></article>`).join('')}</div>`
}
Move28.pickWeek=n=>{state.currentWeek=n;renderWeeks()};
Move28.selectGeneratedSession=id=>{if(planContext.mode!=='generated'||!generatedSessions().some(session=>session.id===id))return;state.currentSessionId=id;renderToday();root.location.hash='today'};
function sameShiftSuggestion(left,right){return left&&right&&left.planId===right.planId&&left.sessionId===right.sessionId&&left.intent===right.intent&&left.displayOnly===true&&right.displayOnly===true&&left.from.weekNumber===right.from.weekNumber&&left.from.weekday===right.from.weekday&&left.to.weekNumber===right.to.weekNumber&&left.to.weekday===right.to.weekday}
Move28.previewScheduleShift=()=>{
  if(planContext.mode!=='generated'||planContext.shiftDisplay)return false;
  const session=selectedGeneratedSession();if(!session||safeSetHas(completedSessionIds(),session.id)||!trustedPreviewScheduleShift)return false;
  let raw;try{raw=trustedPreviewScheduleShift({sessionId:session.id})}catch(_error){setPlanContext({mode:'generated'});return false}
  const preview=safeShiftPreview(raw,session);if(!preview){planContext.shiftPreview=null;renderToday();return false}
  planContext.shiftPreview={...preview,sessionId:session.id};renderToday();return true;
};
Move28.closeScheduleShiftPreview=()=>{planContext.shiftPreview=null;renderToday();return true};
Move28.applyScheduleShiftDisplay=()=>{
  const preview=planContext.shiftPreview,session=selectedGeneratedSession();
  if(planContext.mode!=='generated'||!session||!preview||preview.status!=='available'||preview.sessionId!==session.id||safeSetHas(completedSessionIds(),session.id)||!trustedPreviewScheduleShift)return false;
  let raw;try{raw=trustedPreviewScheduleShift({sessionId:session.id})}catch(_error){setPlanContext({mode:'generated'});return false}
  const fresh=safeShiftPreview(raw,session);
  if(!fresh||fresh.status!=='available'||!sameShiftSuggestion(preview.suggestion,fresh.suggestion)){setPlanContext({mode:'generated'});return false}
  planContext.shiftDisplay=fresh.suggestion;planContext.shiftPreview=null;renderToday();renderWeeks();return true;
};
Move28.restoreScheduleShiftDisplay=()=>{planContext.shiftPreview=null;planContext.shiftDisplay=null;renderToday();renderWeeks();return true};
function ownData(object,key){try{const descriptor=object&&safeGetOwnPropertyDescriptor(object,key);return descriptor&&safeHasOwn(descriptor,'value')?descriptor.value:undefined}catch(_error){return undefined}}
function storedGeneratedContext(){
  if(!trustedLoadState||!trustedValidatePlan||!trustedCatalog)return null;let stored;
  try{stored=trustedLoadState()}catch(_error){return null}
  const plan=stored&&stored.plan,review=plan&&plan.review;
  if(!plan||plan.status!=='active'||plan.intakeRevision!==stored.intakeRevision||!Number.isSafeInteger(stored.capabilityRevision)||stored.capabilityRevision<1||plan.capabilityRevision!==stored.capabilityRevision||review?.status!=='approved'||review?.planId!==plan.id||review?.intakeRevision!==stored.intakeRevision||review?.capabilityRevision!==stored.capabilityRevision||!/^[a-z][a-z0-9._-]{0,63}$/.test(review?.reviewerId||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review?.reviewedAt||''))return null;
  let candidate;try{if(!nativeStructuredClone)return null;candidate=nativeStructuredClone(plan);delete candidate.review;delete candidate.staleReason;delete candidate.staleAt;candidate.status='generated'}catch(_error){return null}
  let validation;try{validation=trustedValidatePlan({plan:candidate,intake:stored.intake,risk:stored.risk,capabilityResult:stored.capabilityResult,capabilityRevision:stored.capabilityRevision,catalog:trustedCatalog})}catch(_error){return null}
  if(!(validation&&validation.ok===true&&Array.isArray(validation.errors)&&validation.errors.length===0))return null;
  let explanation=null;
  try{const built=trustedBuildPlanExplanation?trustedBuildPlanExplanation({plan,capabilityResult:stored.capabilityResult,capabilityRevision:stored.capabilityRevision}):null;if(built&&built.validationResult==='passed')explanation=built}catch(_error){explanation=null}
  return{plan,logs:stored.logs||{},explanation};
}
function setPlanContext(context){
  planContext.shiftPreview=null;planContext.shiftDisplay=null;
  const requestedMode=ownData(context,'mode'),requestedStage=ownData(context,'workflowStage');
  if(requestedMode==='generated'){
    const trusted=storedGeneratedContext();planContext.mode=trusted?'generated':'invalid';planContext.workflowStage=trusted?'ready':'invalid';planContext.plan=trusted?.plan||null;planContext.logs=trusted?.logs||{};planContext.explanation=trusted?.explanation||null;planContext.message=trusted?'':'计划未通过有效状态、人工复核或安全校验。';
  }else{
    planContext.mode=requestedMode==='demo'||requestedMode==='blocked'||requestedMode==='review'||requestedMode==='stale'||requestedMode==='invalid'?requestedMode:'invalid';
    planContext.workflowStage=workflowStageForMode(planContext.mode,requestedStage);
    planContext.plan=null;planContext.logs={};planContext.explanation=null;
    const message=ownData(context,'message');planContext.message=typeof message==='string'?message:'';
  }
  state.currentWeek=1;
  if(planContext.mode==='generated'){
    if(safeSetHas(completedSessionIds(),state.currentSessionId))state.currentSessionId=null;
    state.currentSessionId=selectedGeneratedSession()?.id||null;
    planContext.workflowStage=allGeneratedSessionsCompleted()?'cycle_complete':'ready';
  }
  const tracker=$('#tracker');if(tracker)tracker.hidden=true;
  const trackerLinks=root.document&&root.document.querySelectorAll('a[href="#tracker"]');if(trackerLinks)for(let index=0;index<trackerLinks.length;index+=1)trackerLinks[index].hidden=true;
  applyAppMode();renderWorkflowStatus();renderToday();renderWeeks();
}

function exerciseMediaHtml(exercise){
  let presentation=null;try{presentation=trustedMediaPresentation?trustedMediaPresentation(exercise.id):null}catch(_error){presentation=null}
  if(presentation&&presentation.status==='released'&&typeof presentation.src==='string'&&presentation.src)return`<div class="exercise-media"><img src="${esc(presentation.src)}" alt="${esc(exercise.name)}动作示范"></div>`;
  const title=presentation&&typeof presentation.title==='string'?presentation.title:'动作媒体暂不可用',message=presentation&&typeof presentation.message==='string'?presentation.message:'请仅按文字动作说明和安全提示执行。';
  return`<div class="exercise-media media-blocked" role="note" aria-label="${esc(exercise.name)}动作媒体未开放"><span>TEXT GUIDE</span><b>${esc(title)}</b><p>${esc(message)}</p></div>`;
}
function renderExercises(){const groups=['全部','力量A','力量B','有氧C'];$('#exerciseTabs').innerHTML=groups.map(g=>`<button class="tab ${g===state.exerciseFilter?'active':''}" onclick="pickExercise('${g}')">${g}</button>`).join('');const list=DATA.exercises.filter(e=>state.exerciseFilter==='全部'||e.groups.includes(state.exerciseFilter));$('#exerciseGrid').innerHTML=list.map(e=>`<article class="exercise">${exerciseMediaHtml(e)}<div class="exercise-body"><h3>${esc(e.name)}</h3><div class="tags">${e.groups.map(g=>`<span class="tag">${g}</span>`).join('')}</div><details class="detail" open><summary>起始姿势</summary><p>${esc(e.start)}</p></details><details class="detail"><summary>动作步骤</summary><p>${esc(e.steps)}</p></details><details class="detail"><summary>呼吸与节奏</summary><p>${esc(e.breath)}</p></details><details class="detail"><summary>常见错误</summary><p>${esc(e.errors)}</p></details><details class="detail"><summary>安全保护要点</summary><p class="danger-text">${esc(e.safety)}</p></details></div></article>`).join('')}
Move28.pickExercise=g=>{state.exerciseFilter=g;renderExercises()};
const inputSkip=new Set(['天数','周次','星期','计划训练']);
function fieldType(label){if(/日期$/.test(label))return'date';if(/备注|异常症状/.test(label))return'textarea';if(/时间/.test(label))return'time';if(/完成状态/.test(label))return'status';if(/精力/.test(label))return'scale';return'number'}
function renderDayList(){$('#dayList').innerHTML=DATA.days.map(d=>`<button class="day-pick ${d.day===state.trackDay?'active':''}" onclick="selectTrackDay(${d.day})">${String(d.day).padStart(2,'0')} · ${d.weekday}</button>`).join('')}
const quickTrackLabels=new Set(['日期','完成状态','步数','有氧(分钟)','力量(分钟)','睡眠(小时)']);
function buildTrackField(h,rec){const val=rec[h.label]??(h.label==='日期'&&state.trackDay===state.currentDay?localDate():''),type=fieldType(h.label),wide=/备注|异常症状/.test(h.label)||type==='status'?' wide':'';let ctrl;if(type==='textarea')ctrl=`<textarea data-label="${esc(h.label)}" placeholder="${esc(h.help)}">${esc(val)}</textarea>`;else if(type==='status'){const states=['未填写','已完成','部分完成','休息','因不适暂停'];ctrl=`<input type="hidden" data-label="${esc(h.label)}" value="${esc(val||'未填写')}"><div class="quick-status">${states.map(x=>`<button type="button" class="status-choice ${x===(val||'未填写')?'active':''}" onclick="setStatus('${x}',this)">${x}</button>`).join('')}</div>`}else if(type==='scale')ctrl=`<select data-label="${esc(h.label)}"><option value=""></option>${[1,2,3,4,5].map(x=>`<option ${String(x)===String(val)?'selected':''}>${x}</option>`).join('')}</select>`;else ctrl=`<input data-label="${esc(h.label)}" type="${type}" value="${esc(val)}" step="any" placeholder="${esc(h.help)}">`;return`<div class="field${wide}"><label title="${esc(h.help)}">${esc(h.label)}</label>${ctrl}</div>`}
function renderForm(){const d=DATA.days[state.trackDay-1],rec=state.tracker[state.trackDay]||{},fields=TRACKER_FIELDS.filter(h=>!inputSkip.has(h.label)),quick=fields.filter(h=>quickTrackLabels.has(h.label)),advanced=fields.filter(h=>!quickTrackLabels.has(h.label)),hasAdvanced=advanced.some(h=>String(rec[h.label]??'').trim());$('#trackTitle').textContent=`第${state.trackDay}天 · ${d.weekday} · ${d.type}`;$('#trackForm').innerHTML=`<div class="form-grid quick-grid">${quick.map(h=>buildTrackField(h,rec)).join('')}</div><details class="advanced-panel" ${hasAdvanced?'open':''}><summary>高级记录 <span>体重／血压／生活习惯／疼痛（可选）</span></summary><div class="form-grid advanced-grid">${advanced.map(h=>buildTrackField(h,rec)).join('')}</div></details>`}
Move28.setStatus=(value,button)=>{const box=button.closest('.field');box.querySelector('[data-label="完成状态"]').value=value;box.querySelectorAll('.status-choice').forEach(x=>x.classList.toggle('active',x===button))};
Move28.selectTrackDay=n=>{state.trackDay=n;renderDayList();renderForm()};Move28.openTrack=n=>{state.trackDay=n;renderDayList();renderForm();root.location.hash='tracker';setTimeout(()=>$('#trackForm [data-label="完成状态"]')?.closest('.field')?.scrollIntoView({block:'center'}),350)};
function showToast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
function saveTrack(){const d={};$$('#trackForm [data-label]').forEach(el=>d[el.dataset.label]=el.value);const next={...state.tracker,[state.trackDay]:d};if(!persistLocal(state.storeKey,JSON.stringify(next)))return false;state.tracker=next;renderOverview();renderToday();$('#saveBtn').textContent='已保存 ✓';showToast(`第${state.trackDay}天已保存到当前浏览器`);setTimeout(()=>$('#saveBtn').textContent='保存今天 ✓',1400);return true}
function renderOverview(){$('#overviewBody').innerHTML=DATA.days.map(d=>{const r=state.tracker[d.day]||{};return`<tr><td>${d.day}</td><td>${esc(r['日期']||'')}</td><td>${esc(d.type)}</td><td>${esc(r['完成状态']||'未填写')}</td><td>${esc(r['晨起体重(kg)']||'')}</td><td>${esc((r['收缩压(mmHg)']||'')+(r['舒张压(mmHg)']?'/'+r['舒张压(mmHg)']:''))}</td><td>${esc(r['步数']||'')}</td><td>${esc(r['睡眠(小时)']||'')}</td><td>${esc([r['肩部痛(0-10)'],r['膝痛(0-10)'],r['腰痛(0-10)']].map(x=>x||'-').join('/'))}</td></tr>`}).join('')}
function exportCSV(){const hs=['天数','周次','星期','计划训练',...TRACKER_FIELDS.filter(h=>!inputSkip.has(h.label)).map(h=>h.label)];const rows=[hs,...DATA.days.map(d=>{const r=state.tracker[d.day]||{};return[d.day,d.week,d.weekday,d.type,...hs.slice(4).map(h=>r[h]||'')]})];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join(String.fromCharCode(13,10));const a=root.document.createElement('a');a.href=root.URL.createObjectURL(new root.Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='28天健身追踪.csv';a.click();root.URL.revokeObjectURL(a.href);showToast('CSV备份已生成')}
function clearTrack(){const b=$('#clearBtn');if(!state.clearArmed){state.clearArmed=true;b.textContent='再点一次确认';showToast(`再次点击即可清空第${state.trackDay}天`);clearTimeout(state.clearArmTimer);state.clearArmTimer=setTimeout(()=>{state.clearArmed=false;b.textContent='清空这天'},3000);return}state.clearArmed=false;clearTimeout(state.clearArmTimer);const next={...state.tracker};delete next[state.trackDay];if(!persistLocal(state.storeKey,JSON.stringify(next))){b.textContent='清空这天';return false}state.tracker=next;renderForm();renderOverview();renderToday();b.textContent='清空这天';showToast(`第${state.trackDay}天记录已清空`);return true}
function renderSafety(){$('#safetyGrid').innerHTML=DATA.safety.map(x=>`<article class="safety-card"><h3>${esc(x.title)}</h3><div>${esc(x.text)}</div></article>`).join('')}
function reveal(){const io=new root.IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.08});$$('.reveal').forEach(x=>io.observe(x))}
const ui={setPlanContext,renderToday,renderWeeks,renderExercises,exerciseMediaHtml,renderDayList,renderForm,renderOverview,renderSafety,reveal,saveTrack,exportCSV,clearTrack,showToast};
Object.assign(Move28.ui||{},ui);
const actions={moveDay:Move28.moveDay,pickWeek:Move28.pickWeek,selectGeneratedSession:Move28.selectGeneratedSession,previewScheduleShift:Move28.previewScheduleShift,closeScheduleShiftPreview:Move28.closeScheduleShiftPreview,applyScheduleShiftDisplay:Move28.applyScheduleShiftDisplay,restoreScheduleShiftDisplay:Move28.restoreScheduleShiftDisplay,pickExercise:Move28.pickExercise,setStatus:Move28.setStatus,selectTrackDay:Move28.selectTrackDay,openTrack:Move28.openTrack};
if(root.window===root)for(const name of Object.keys(actions))root[name]=actions[name];
return Object.assign({},ui,actions);
});
