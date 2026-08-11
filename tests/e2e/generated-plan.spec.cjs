const {test,expect}=require('@playwright/test');
const {installMonotonicClock,advanceMonotonicClock,advanceGuideToReviewedDuration,completeGuideActions}=require('./helpers/pilot-flow.cjs');

const gymEquipment=['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const safe={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment:gymEquipment,allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion','rpe','pain','sleep'],sessionPreference:'short_frequent',musicEnabled:'no'};

async function reset(page){
  await installMonotonicClock(page);
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
  await page.reload();
}
async function completeOnboarding(page,overrides={},capabilityOverrides={}){
  await page.getByRole('button',{name:/生成我的4周计划/}).click();
  await page.evaluate(data=>{for(const [key,value] of Object.entries(data))Move28.onboardingController.setField(key,value);Move28.onboardingController.goTo(9)},{...safe,...overrides});
  await page.locator('input[name="finalConfirmed"]').check();
  await page.getByRole('button',{name:/确认并保存结果/}).click();
  await page.evaluate(values=>{for(const [field,value] of Object.entries(values))Move28.capabilityController.setField(field,value);Move28.capabilityController.goTo(2)},
    {chairRise:'independent_controlled',wallHinge:'controlled',wallPushup:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable',...capabilityOverrides});
  await page.getByRole('button',{name:/确认并保存能力档案/}).click();
}

async function approvePendingPlan(page){
  await page.evaluate(()=>{
    const state=Move28.storage.loadState();
    Move28.storage.approvePlanReview({reviewerId:'pilot-reviewer',planId:state.plan.id,intakeRevision:state.intakeRevision});
  });
  await page.reload();
}

test.beforeEach(async({page})=>reset(page));

test('generated-plan 未问卷仅显示只读示例且不写用户记录',async({page})=>{
  await expect(page.locator('#todayCard')).toContainText('示例计划');
  await expect(page.getByRole('button',{name:/开始今天训练|一步一步带我练/})).toHaveCount(0);
  await expect(page.locator('#tracker')).toBeHidden();
  await expect(page.locator('.plan-explanation')).toHaveCount(0);
  await expect(page.getByRole('link',{name:/查看示例计划/})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBeNull();
  const bypass=await page.evaluate(()=>Move28.guide.openWorkout({plan:{status:'active'},intake:{},risk:{},sessionId:'evil-session',catalog:[{id:'evil',reviewStatus:'approved',gif:'javascript:alert(1)'}]}));
  expect(bypass).toBe(false);
  expect(await page.evaluate(()=>typeof Move28.guide.buildWorkoutSteps)).toBe('undefined');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
});

test('generated-plan 正常问卷生成后等待人工复核，放行后持久化并显示第1周',async({page})=>{
  await completeOnboarding(page);
  await expect(page.locator('.cap-result')).toContainText('人工一致性复核完成前不会开放训练入口');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stored.plan.status).toBe('pending_review');
  expect(stored.plan.review).toBeNull();
  expect(stored.plan.weeks).toHaveLength(4);
  expect(stored.plan.intakeRevision).toBe(stored.intakeRevision);
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await expect(page.locator('#todayCard')).toContainText('人工一致性复核完成前');
  await expect(page.locator('.today-start')).toHaveCount(0);
  await expect(page.locator('.plan-explanation')).toHaveCount(0);
  const runtimeBypass=await page.evaluate(()=>{
    Move28.domain.validatePlan=()=>({ok:true,errors:[]});
    Move28.data.exerciseCatalog=[{id:'evil',reviewStatus:'approved',gif:'javascript:alert(1)'}];
    let saved=false;try{Move28.storage.savePlan({id:'evil-plan',status:'generated',intakeRevision:1,weeks:[]});saved=true}catch(_error){}
    Move28.ui.setPlanContext({mode:'generated',plan:{id:'evil-plan',status:'active',weeks:[]},logs:{}});
    return saved;
  });
  expect(runtimeBypass).toBe(false);
  await expect(page.locator('.today-start')).toHaveCount(0);
  await approvePendingPlan(page);
  await expect(page.locator('#todayCard')).toContainText('第1周');
  await expect(page.locator('#todayCard')).toContainText('全身力量');
  await expect(page.locator('.plan-explanation')).toHaveCount(1);
  await expect(page.locator('.plan-explanation summary')).toContainText('为什么这样安排');
  await page.locator('.plan-explanation summary').click();
  await expect(page.locator('.plan-explanation')).toContainText('安全与能力规则支持标准起步');
  await expect(page.locator('.plan-explanation')).toContainText('健身房场景');
  await expect(page.locator('.plan-explanation')).toContainText('不展示原始健康问卷答案');
  await expect(page.locator('.plan-explanation')).not.toContainText('pregnancyPostpartum');
  await expect(page.locator('.plan-explanation')).not.toContainText('chestSymptoms');
  await expect(page.locator('.plan-explanation')).not.toContainText('20_40');
  await expect(page.locator('.plan-explanation')).not.toContainText('independent_controlled');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await expect(page.locator('#weekView .day-card')).toHaveCount(stored.plan.weeks[0].sessions.length);
  await expect(page.getByRole('button',{name:'开始今天训练'})).toBeVisible();
  const catalogRender=await page.evaluate(()=>{
    const before=document.querySelector('#todayCard .today-value').textContent;
    Move28.data.exerciseCatalog=[{id:'seated-leg-press',name:'EVIL_RUNTIME_CATALOG'}];
    Move28.ui.renderToday();
    return{before,after:document.querySelector('#todayCard .today-value').textContent};
  });
  expect(catalogRender.after).toBe(catalogRender.before);
  expect(catalogRender.after).not.toContain('EVIL_RUNTIME_CATALOG');
  const builderBinding=await page.evaluate(()=>{
    window.__move28ExplanationXss=false;
    const before=document.querySelector('.plan-explanation').textContent;
    Move28.domain.buildPlanExplanation=()=>({version:'plan-explanation.v1',strategy:'<img src=x onerror="window.__move28ExplanationXss=true">',setting:'gym',weeklySessionRange:{min:2,max:2},durationRange:{min:18,max:18},reasonCodes:[],reasonLabels:['</li><img src=x onerror="window.__move28ExplanationXss=true">'],validationResult:'passed'});
    Move28.ui.setPlanContext({mode:'generated'});
    return{before,after:document.querySelector('.plan-explanation').textContent,images:document.querySelectorAll('.plan-explanation img').length,executed:window.__move28ExplanationXss};
  });
  expect(builderBinding.after).toBe(builderBinding.before);
  expect(builderBinding.images).toBe(0);
  expect(builderBinding.executed).toBe(false);
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    state.plan.review.capabilityRevision+=1;
    localStorage.setItem('move28-pilot-v1',JSON.stringify(state));
    Move28.ui.setPlanContext({mode:'generated'});
  });
  await expect(page.locator('.plan-explanation')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'开始今天训练'})).toHaveCount(0);
});

test('generated-plan 真实激活路径不执行加载后替换的Object.values',async({page})=>{
  await completeOnboarding(page);await approvePendingPlan(page);
  const calls=await page.evaluate(()=>{const original=Object.values;let count=0;Object.values=()=>{count+=1;throw new Error('TAMPERED_VALUES')};try{Move28.ui.setPlanContext({mode:'generated'})}finally{Object.values=original}return count});
  expect(calls).toBe(0);
  await expect(page.getByRole('button',{name:'▶ 开始今天训练'})).toBeVisible();
});

test('generated-plan context accessor在Object原型污染下不执行getter',async({page})=>{
  const reads=await page.evaluate(()=>{
    let count=0;
    const context={};
    Object.defineProperty(context,'mode',{enumerable:true,get(){count+=100;return'generated'}});
    const originalDescriptor=Object.getOwnPropertyDescriptor;
    Object.defineProperty(Object.prototype,'value',{configurable:true,get(){count+=1;return'demo'}});
    Object.getOwnPropertyDescriptor=(object,key)=>{
      const descriptor=originalDescriptor(object,key);
      return descriptor&&descriptor.get?{value:object[key]}:descriptor;
    };
    try{Move28.ui.setPlanContext(context)}finally{Object.getOwnPropertyDescriptor=originalDescriptor;delete Object.prototype.value}
    return count;
  });
  expect(reads).toBe(0);
  await expect(page.locator('#todayCard')).toContainText('暂未生成可执行计划');
});

test('generated-plan 四天与5+计划把recovery明确显示为恢复训练',async({page})=>{
  const cases=[
    {daysPerWeek:'4',weekdays:['mon','tue','thu','sat']},
    {daysPerWeek:'5plus',weekdays:['mon','tue','wed','fri','sat']}
  ];
  for(const item of cases){
    await reset(page);
    await completeOnboarding(page,item);
    await page.getByRole('button',{name:'完成，返回首页'}).click();
    await approvePendingPlan(page);
    const recoveryCard=page.locator('#weekView .day-card.recovery').first();
    await expect(recoveryCard).toHaveCount(1);
    await expect(recoveryCard.getByRole('heading')).toHaveText('恢复训练');
    await expect(recoveryCard).not.toContainText('低冲击有氧');
    await recoveryCard.getByRole('button',{name:'查看此节'}).click();
    await expect(page.locator('#todayCard h3')).toHaveText('恢复训练');
    await expect(page.locator('#todayCard h3')).not.toHaveText('低冲击有氧');
    await page.getByRole('button',{name:'开始今天训练'}).click();
    await page.getByRole('button',{name:'检查今天状态'}).click();
    await page.getByRole('button',{name:'按原计划继续'}).click();
    await page.getByRole('button',{name:'开始本节',exact:true}).click();
    await expect(page.locator('#guideTitle')).toContainText('恢复训练');
    await expect(page.locator('#guideBody .guide-phase')).toHaveText('恢复训练');
    await expect(page.locator('#guideTitle')).not.toContainText('低冲击有氧');
  }
});

test('generated-plan 跟练严格消费session.actions，每屏一个动作并完成记录',async({page})=>{
  const gifRequests=[];page.on('request',request=>{if(request.url().includes('/assets/gifs/'))gifRequests.push(request.url())});
  await completeOnboarding(page);
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
  const expected=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1')),session=state.plan.weeks[0].sessions[0];
    const index=Object.fromEntries(Move28.data.exerciseCatalog.map(item=>[item.id,item])),sessions=state.plan.weeks.flatMap(week=>week.sessions),next=sessions[1];
    return{planId:state.plan.id,sessionId:session.id,actions:session.actions.map(action=>({action,exercise:index[action.exerciseId]})),next:`第1周 · ${Move28.data.weekdayLabels?.[next.weekday]||({mon:'周一',tue:'周二',wed:'周三',thu:'周四',fri:'周五',sat:'周六',sun:'周日'})[next.weekday]}`};
  });
  await page.getByRole('button',{name:'开始今天训练'}).click();
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await page.getByRole('button',{name:'按原计划继续'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  for(let index=0;index<expected.actions.length;index+=1){
    const item=expected.actions[index];
    await expect(page.locator('#guideBody .guide-action')).toHaveCount(1);
    await expect(page.locator('#guideBody h3')).toHaveText(item.exercise.name);
    await expect(page.locator('#guideBody img,#guideBody picture,#guideBody video,#guideBody source')).toHaveCount(0);
    await expect(page.locator('#guideBody .guide-media-blocked')).toContainText('动作媒体审核中');
    const dose=item.action.phase==='main'?`${item.action.sets}组 × ${item.action.reps}次`: `${item.action.durationMin}分钟`;
    await expect(page.locator('.guide-dose')).toContainText(dose);
    await expect(page.locator('#guideBody input,#guideBody select,#guideBody textarea')).toHaveCount(0);
    await expect(page.locator('#guideBody')).not.toContainText('任选');
    for(const cue of Object.values(item.exercise.cues))await expect(page.locator('#guideBody')).toContainText(cue);
    if(index===expected.actions.length-1)await advanceGuideToReviewedDuration(page);
    await page.locator('#guideNext').click();
  }
  await expect(page.getByRole('heading',{name:'这节训练感觉如何？'})).toBeVisible();
  const summary=page.locator('.guide-completion');
  await expect(summary).toBeVisible();await expect(summary.getByText('本节已完成')).toBeVisible();
  await expect(summary.locator('.guide-completion-actions li')).toHaveCount(expected.actions.length);
  for(const item of expected.actions)await expect(summary).toContainText(item.exercise.name);
  await expect(summary.locator('.guide-completion-metrics')).toContainText(/实际时长\s*\d+(?:秒|分钟|分\d+秒)/);
  await expect(summary.locator('.guide-completion-next')).toContainText(expected.next);
  await expect(summary).not.toContainText(/kcal|千卡|消耗热量/i);
  await page.getByRole('button',{name:'刚刚好'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const record=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    return Object.values(state.logs)[0];
  });
  expect(record.planId).toBe(expected.planId);
  expect(record.sessionId).toBe(expected.sessionId);
  expect(record.status).toBe('completed');
  expect(gifRequests).toEqual([]);
  await page.reload();
  await expect(page.locator('#todayCard')).toContainText('已完成 1/');
});

test('generated-plan 亚秒内点完18分钟5动作不写完成记录且保留固定恢复选择',async({page})=>{
  await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
  const session=await page.evaluate(()=>Move28.storage.loadState().plan.weeks[0].sessions[0]);
  expect(session.estimatedMinutes).toBe(18);expect(session.actions).toHaveLength(5);
  await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
  for(let index=0;index<session.actions.length-1;index+=1)await page.locator('#guideNext').click();
  await page.evaluate(()=>{window.__rapidCompletionCalls=0;const original=Move28.state.guideOnComplete;Move28.state.guideOnComplete=event=>{window.__rapidCompletionCalls+=1;return original(event)}});
  await advanceMonotonicClock(page,999);await page.locator('#guideNext').click();
  const result=await page.evaluate(()=>{const stored=JSON.parse(localStorage.getItem('move28-pilot-v1'));return{completed:Object.values(stored.logs).filter(item=>item.status==='completed'),mode:Move28.state.guideMode,completionCalls:window.__rapidCompletionCalls}});
  expect(result).toEqual({completed:[],mode:'duration_blocked',completionCalls:0});
  await expect(page.getByRole('heading',{name:'本节还不能记为完成'})).toBeVisible();
  await expect(page.getByRole('button',{name:'继续本节训练'})).toBeVisible();
  await expect(page.getByRole('button',{name:'普通退出（本节未完成）'})).toBeVisible();
  await expect(page.locator('.guide-completion')).toHaveCount(0);
  await page.getByRole('button',{name:'继续本节训练'}).click();await expect(page.locator('.guide-action')).toBeVisible();
  await page.locator('#guideNext').click();await expect(page.getByRole('heading',{name:'本节还不能记为完成'})).toBeVisible();
  await page.getByRole('button',{name:'普通退出（本节未完成）'}).click();await expect(page.getByRole('heading',{name:'普通退出训练？'})).toBeVisible();
  await page.getByRole('button',{name:'确认普通退出'}).click();await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('move28-pilot-v1')).logs).filter(item=>item.status==='completed'))).toEqual([]);
});

test('generated-plan 预加载受控单调时钟走满审核时长后生成canonical完成记录与18分钟回执',async({page})=>{
  await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
  await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const total=await page.evaluate(()=>Move28.state.guideSteps.length);for(let index=0;index<total-1;index+=1)await page.locator('#guideNext').click();
  await advanceGuideToReviewedDuration(page);await page.locator('#guideNext').click();
  await expect(page.locator('.guide-completion')).toContainText('18分钟');
  const result=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('move28-pilot-v1')),records=Object.values(state.logs).filter(item=>item.status==='completed');return{records,planId:state.plan.id}});
  expect(result.records).toHaveLength(1);expect(result.records[0]).toEqual({planId:result.planId,sessionId:'w1-s1',status:'completed',completedAt:result.records[0].completedAt});expect(result.records[0].completedAt).toMatch(/Z$/);
});

test('generated-plan 完成摘要使用私有步骤快照、捕获单调时钟且伪造完成状态只降级下一节提示',async({page})=>{
  await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
  const expected=await page.evaluate(()=>{const state=Move28.storage.loadState(),session=state.plan.weeks[0].sessions[0],index=Object.fromEntries(Move28.data.exerciseCatalog.map(item=>[item.id,item]));return session.actions.map(action=>index[action.exerciseId].name)});
  await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const total=await page.evaluate(()=>Move28.state.guideSteps.length);
  await page.evaluate(()=>{
    window.__task7GetterCalls=0;window.__task7ClockCalls=0;
    Object.defineProperty(performance,'now',{configurable:true,value:()=>{window.__task7ClockCalls+=1;throw new Error('MUTATED_CLOCK')}});
    const original=Move28.state.guideOnComplete;
    Move28.state.guideOnComplete=event=>{const persisted=original(event);Object.defineProperty(Move28.state,'guideSteps',{configurable:true,get(){window.__task7GetterCalls+=1;throw new Error('UNTRUSTED_STEPS')}});const other=persisted.plan.weeks[0].sessions.find(session=>session.id!==event.sessionId),current=persisted.logs[`${persisted.plan.id}.${event.sessionId}`];persisted.logs[`${persisted.plan.id}.${other.id}`]={planId:persisted.plan.id,sessionId:other.id,status:'completed',completedAt:current.completedAt};return persisted};
  });
  await advanceGuideToReviewedDuration(page);for(let index=0;index<total;index+=1)await page.locator('#guideNext').click();
  const summary=page.locator('.guide-completion');await expect(summary).toBeVisible();
  for(const name of expected)await expect(summary.getByText(name,{exact:true})).toBeVisible();
  await expect(summary).toContainText('下一次训练将在计划页继续显示');await expect(summary).toContainText(/实际时长\d+(?:秒|分钟|分\d+秒)/);
  expect(await page.evaluate(()=>window.__task7GetterCalls)).toBe(0);
});

test('generated-plan 完成摘要对缺失、非法或额外字段的完成记录统一降级下一节提示',async({page})=>{
  for(const mutation of ['missing_completed_at','invalid_completed_at','extra_field']){
    await reset(page);await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
    await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
    const total=await page.evaluate(()=>Move28.state.guideSteps.length);
    await page.evaluate(kind=>{const original=Move28.state.guideOnComplete;Move28.state.guideOnComplete=event=>{const persisted=original(event),record=persisted.logs[`${persisted.plan.id}.${event.sessionId}`];if(kind==='missing_completed_at')delete record.completedAt;else if(kind==='invalid_completed_at')record.completedAt='not-utc';else record.extra='forged';return persisted}},mutation);
    await completeGuideActions(page);
    const summary=page.locator('.guide-completion');await expect(summary).toBeVisible();await expect(summary).toContainText('下一次训练将在计划页继续显示');
  }
});

test('generated-plan 完成摘要对原始持久化state的顶层、日志或审核额外字段统一降级',async({page})=>{
  for(const mutation of ['top_level','completion_log','plan_review']){
    await reset(page);await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
    await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
    const total=await page.evaluate(()=>Move28.state.guideSteps.length);
    await page.evaluate(kind=>{const original=Move28.state.guideOnComplete;Move28.state.guideOnComplete=event=>{const persisted=original(event),raw=JSON.parse(localStorage.getItem('move28-pilot-v1'));if(kind==='top_level')raw.extra='forged';else if(kind==='completion_log')raw.logs[`${raw.plan.id}.${event.sessionId}`].extra='forged';else raw.plan.review.extra='forged';localStorage.setItem('move28-pilot-v1',JSON.stringify(raw));return persisted}},mutation);
    await completeGuideActions(page);
    await expect(page.locator('.guide-completion')).toContainText('下一次训练将在计划页继续显示');
  }
});

test('generated-plan 完成写入前intrinsic身份预检阻止后加载Array.some替换且零执行',async({page})=>{
  await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
  await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const total=await page.evaluate(()=>Move28.state.guideSteps.length);for(let index=1;index<total;index+=1)await page.locator('#guideNext').click();
  await advanceGuideToReviewedDuration(page);
  await page.evaluate(()=>{window.__task7OriginalSome=Array.prototype.some;window.__task7SomeCalls=0;Array.prototype.some=function(...args){window.__task7SomeCalls+=1;return window.__task7OriginalSome.apply(this,args)}});
  await page.locator('#guideNext').click();
  const result=await page.evaluate(()=>{const calls=window.__task7SomeCalls;Array.prototype.some=window.__task7OriginalSome;const state=JSON.parse(localStorage.getItem('move28-pilot-v1')),completed=Object.values(state.logs).some(item=>item.status==='completed');return{calls,completed,mode:Move28.state.guideMode}});
  expect(result).toEqual({calls:0,completed:false,mode:'action'});await expect(page.getByText('运行环境已变化，完成记录未保存，请刷新后重试')).toBeVisible();
});

test('generated-plan 跟练在390竖屏、844横屏与1280桌面无横向溢出且横屏关键操作可见',async({page})=>{
  await page.setViewportSize({width:844,height:390});
  await completeOnboarding(page);await page.getByRole('button',{name:'完成，返回首页'}).click();await approvePendingPlan(page);
  await page.getByRole('button',{name:'开始今天训练'}).click();await page.getByRole('button',{name:'检查今天状态'}).click();await page.getByRole('button',{name:'按原计划继续'}).click();await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const assertNoOverflow=async()=>expect(await page.evaluate(()=>({doc:document.documentElement.scrollWidth<=innerWidth,body:document.body.scrollWidth<=innerWidth}))).toEqual({doc:true,body:true});
  await assertNoOverflow();
  for(const selector of ['.guide-instruction h3','.guide-dose','#guideNext']){const locator=page.locator(selector);await expect(locator).toBeVisible();const box=await locator.boundingBox();expect(box).not.toBeNull();expect(box.x,selector).toBeGreaterThanOrEqual(0);expect(box.x+box.width,selector).toBeLessThanOrEqual(844);expect(box.y,selector).toBeGreaterThanOrEqual(0);expect(box.y+box.height,selector).toBeLessThanOrEqual(390)}
  const cues=page.locator('.guide-cue');await expect(cues).toHaveCount(4);
  for(let index=0;index<4;index+=1){const cue=cues.nth(index);await cue.scrollIntoViewIfNeeded();await expect(cue).toBeVisible();const box=await cue.boundingBox();expect(box).not.toBeNull();expect(box.y,`guide cue ${index}`).toBeGreaterThanOrEqual(0);expect(box.y+box.height,`guide cue ${index}`).toBeLessThanOrEqual(390)}
  const safety=page.locator('.guide-runtime-safety');await safety.scrollIntoViewIfNeeded();await expect(safety).toBeVisible();await expect(page.locator('#guideNext')).toBeVisible();
  for(const viewport of [{width:390,height:844},{width:1280,height:800}]){await page.setViewportSize(viewport);await assertNoOverflow()}
});

test('generated-plan 受控能力档案在跟练页显示可信中文变式指导且不回显枚举',async({page})=>{
  await completeOnboarding(page,{setting:'home',equipment:['stable_chair','exercise_mat','resistance_band','wall'],allowSettingSwap:'no'}, {chairRise:'hands_supported',wallPushup:'limited_range'});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
  await page.locator('.plan-explanation summary').click();
  await expect(page.locator('.plan-explanation')).toContainText('安全与能力规则要求保守起步');
  await expect(page.locator('.plan-explanation')).toContainText('坐站需要手部辅助');
  await expect(page.locator('.plan-explanation')).toContainText('墙壁推举活动范围有限');
  await expect(page.locator('.plan-explanation')).not.toContainText('high_seat');
  await expect(page.locator('.plan-explanation')).not.toContainText('close_wall');
  await expect(page.locator('.plan-explanation')).not.toContainText('hands_supported');
  await expect(page.locator('.plan-explanation')).not.toContainText('limited_range');
  await page.getByRole('button',{name:'开始今天训练'}).click();
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await page.getByRole('button',{name:'按原计划继续'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();

  await expect(page.locator('.guide-variant')).toContainText('受控变式 · 高位座椅变式');
  await expect(page.locator('.guide-variant')).toContainText('使用稳固、不会滑动的较高座椅');
  await expect(page.locator('.guide-variant')).toContainText('只在可控、无痛范围内起立和坐回');
  await expect(page.locator('#guideModal')).not.toContainText('high_seat');
  await page.locator('#guideNext').click();
  await page.locator('#guideNext').click();

  await expect(page.locator('.guide-variant')).toContainText('受控变式 · 近墙小幅变式');
  await expect(page.locator('.guide-variant')).toContainText('双脚站得更靠近墙面');
  await expect(page.locator('.guide-variant')).toContainText('胸部只靠近墙到肩部无痛');
  await expect(page.locator('#guideModal')).not.toContainText('close_wall');
});

test('generated-plan 缺少审核动作时原子阻断且不回退成用户训练计划',async({page})=>{
  await completeOnboarding(page,{setting:'home',equipment:['stable_chair','exercise_mat','wall'],allowSettingSwap:'no'});
  await expect(page.locator('.cap-result')).toContainText('需要人工复核');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.plan).toBeNull();
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await expect(page.locator('#todayCard')).toContainText('暂未生成可执行计划');
  await expect(page.locator('.plan-explanation')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'开始今天训练'})).toHaveCount(0);
});

test('generated-plan 安全顺延只改变本次日历显示并继续使用原sessionId',async({page})=>{
  await completeOnboarding(page,{daysPerWeek:'2',weekdays:['mon','wed','fri']});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);

  const baseline=await page.evaluate(()=>{
    const bytes=localStorage.getItem('move28-pilot-v1'),state=JSON.parse(bytes),session=state.plan.weeks[0].sessions[0];
    return{bytes,plan:state.plan,logs:state.logs,sessionId:session.id,weekday:session.weekday,actions:session.actions,minutes:session.estimatedMinutes};
  });
  expect(baseline.weekday).toBe('mon');
  await expect(page.getByRole('button',{name:'错过了这节？查看安全顺延'})).toBeVisible();

  const rejected=await page.evaluate(sessionId=>{
    const before=localStorage.getItem('move28-pilot-v1');let name='';
    try{Move28.storage.previewScheduleShift({sessionId,weekday:'fri'})}catch(error){name=error&&error.name}
    return{name,before,after:localStorage.getItem('move28-pilot-v1')};
  },baseline.sessionId);
  expect(rejected.name).toBeTruthy();
  expect(rejected.after).toBe(rejected.before);

  await page.getByRole('button',{name:'错过了这节？查看安全顺延'}).click();
  const preview=page.locator('.schedule-shift-preview');
  await expect(preview).toContainText('第1周周一 → 第1周周五');
  await expect(preview).toContainText('动作、剂量、完成状态和人工审核处方不会改变');
  await expect(preview.locator('input,select,textarea')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'仅更新日历显示'})).toBeVisible();
  await expect(page.getByRole('button',{name:'关闭',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect(preview).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBe(baseline.bytes);

  await page.getByRole('button',{name:'错过了这节？查看安全顺延'}).click();
  await page.getByRole('button',{name:'仅更新日历显示'}).click();
  await expect(page.locator('#todayCard .today-top')).toContainText('周五');
  await expect(page.locator('#todayCard .shift-display-badge')).toHaveText('顺延显示 · 原周一');
  const shiftedCard=page.locator(`#weekView .day-card[data-session-id="${baseline.sessionId}"]`);
  await expect(shiftedCard.locator('.num')).toHaveText('周五');
  await expect(shiftedCard.locator('.shift-display-badge')).toHaveText('顺延显示 · 原周一');
  await expect(page.getByRole('button',{name:'恢复原日历'})).toBeVisible();
  const afterApply=await page.evaluate(()=>({bytes:localStorage.getItem('move28-pilot-v1'),state:Move28.storage.loadState(),actions:document.querySelector('#todayCard .today-value').textContent,minutes:document.querySelector('#todayCard [data-today-metric="duration"]').textContent}));
  expect(afterApply.bytes).toBe(baseline.bytes);
  expect(afterApply.state.plan).toEqual(baseline.plan);
  expect(afterApply.state.logs).toEqual(baseline.logs);
  expect(afterApply.state.plan.weeks[0].sessions[0].actions).toEqual(baseline.actions);
  expect(afterApply.state.plan.weeks[0].sessions[0].estimatedMinutes).toBe(baseline.minutes);
  expect(afterApply.minutes).toContain(`${baseline.minutes}分钟`);

  await page.evaluate(()=>{
    window.__openedShiftSessionId=null;
    window.openSessionReadiness=id=>{window.__openedShiftSessionId=id;return true};
  });
  await page.getByRole('button',{name:'开始今天训练'}).click();
  expect(await page.evaluate(()=>window.__openedShiftSessionId)).toBe(baseline.sessionId);

  await page.reload();
  await expect(page.locator('#todayCard .today-top')).toContainText('周一');
  await expect(page.locator('.shift-display-badge')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'恢复原日历'})).toHaveCount(0);
});

test('generated-plan 第4周顺延预览不产生第5周显示',async({page})=>{
  await completeOnboarding(page,{daysPerWeek:'2',weekdays:['mon','wed','fri']});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
  await page.getByRole('button',{name:'第4周'}).click();
  const lastCard=page.locator('#weekView .day-card').last();
  await lastCard.getByRole('button',{name:'查看此节'}).click();
  await page.getByRole('button',{name:'错过了这节？查看安全顺延'}).click();
  await expect(page.locator('.schedule-shift-preview')).toBeVisible();
  await expect(page.locator('.schedule-shift-preview')).not.toContainText('第5周');
  const result=await page.evaluate(()=>{const state=Move28.storage.loadState(),session=state.plan.weeks[3].sessions.at(-1);return Move28.storage.previewScheduleShift({sessionId:session.id})});
  expect(JSON.stringify(result)).not.toContain('"weekNumber":5');
});

test('generated-plan 顺延确认前重新校验安全状态，失效计划不能套用旧预览',async({page})=>{
  await completeOnboarding(page,{daysPerWeek:'2',weekdays:['mon','wed','fri']});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
  await page.getByRole('button',{name:'错过了这节？查看安全顺延'}).click();
  await expect(page.getByRole('button',{name:'仅更新日历显示'})).toBeVisible();
  await page.evaluate(()=>{
    const state=Move28.storage.loadState(),session=state.plan.weeks[0].sessions[0];
    Move28.storage.recordWorkoutStop({sessionId:session.id,reasonCode:'sudden_severe_pain',actionIndex:0,occurredAt:'2030-01-02T03:05:00.000Z'});
  });
  await page.getByRole('button',{name:'仅更新日历显示'}).click();
  await expect(page.locator('#todayCard')).toContainText('计划未通过有效状态、人工复核或安全校验');
  await expect(page.locator('.shift-display-badge')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'开始今天训练'})).toHaveCount(0);
});

test('generated-plan 完成、疼痛失效与显式stale上下文都不显示顺延入口',async({page})=>{
  await completeOnboarding(page,{daysPerWeek:'2',weekdays:['mon','wed','fri']});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
  const ids=await page.evaluate(()=>{const state=Move28.storage.loadState(),session=state.plan.weeks[0].sessions[0];Move28.storage.recordWorkoutCompletion({planId:state.plan.id,sessionId:session.id});return{planId:state.plan.id,sessionId:session.id}});
  await page.reload();
  await page.locator(`#weekView .day-card[data-session-id="${ids.sessionId}"]`).getByRole('button',{name:'查看此节'}).click();
  await expect(page.locator('#todayCard')).toContainText('已完成');
  await expect(page.getByRole('button',{name:'错过了这节？查看安全顺延'})).toHaveCount(0);

  await page.evaluate(sessionId=>Move28.storage.recordWorkoutFeedback({sessionId,feedbackCode:'pain'}),ids.sessionId);
  await page.reload();
  await expect(page.locator('#todayCard')).toContainText('计划已失效');
  await expect(page.getByRole('button',{name:'错过了这节？查看安全顺延'})).toHaveCount(0);
  await page.evaluate(()=>Move28.ui.setPlanContext({mode:'stale',message:'受控失效测试'}));
  await expect(page.locator('#todayCard')).toContainText('受控失效测试');
  await expect(page.getByRole('button',{name:'错过了这节？查看安全顺延'})).toHaveCount(0);
  await page.evaluate(()=>Move28.ui.setPlanContext({mode:'review',message:'受控复核测试'}));
  await expect(page.locator('#todayCard')).toContainText('受控复核测试');
  await expect(page.getByRole('button',{name:'错过了这节？查看安全顺延'})).toHaveCount(0);
});
