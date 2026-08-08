const {test,expect}=require('@playwright/test');

const gymEquipment=['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const safe={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment:gymEquipment,allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion','rpe','pain','sleep'],sessionPreference:'short_frequent',musicEnabled:'no'};

async function reset(page){
  await page.goto('/index.html');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
  await page.reload();
}
async function completeOnboarding(page,overrides={}){
  await page.getByRole('button',{name:/生成我的4周计划/}).click();
  await page.evaluate(data=>{for(const [key,value] of Object.entries(data))Move28.onboardingController.setField(key,value);Move28.onboardingController.goTo(9)},{...safe,...overrides});
  await page.locator('input[name="finalConfirmed"]').check();
  await page.getByRole('button',{name:/确认并保存结果/}).click();
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
  await expect(page.getByRole('button',{name:/开始本节训练|一步一步带我练/})).toHaveCount(0);
  await expect(page.locator('#tracker')).toBeHidden();
  await expect(page.getByRole('link',{name:/查看示例计划/})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBeNull();
  const bypass=await page.evaluate(()=>Move28.guide.openWorkout({plan:{status:'active'},intake:{},risk:{},sessionId:'evil-session',catalog:[{id:'evil',reviewStatus:'approved',gif:'javascript:alert(1)'}]}));
  expect(bypass).toBe(false);
  expect(await page.evaluate(()=>typeof Move28.guide.buildWorkoutSteps)).toBe('undefined');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
});

test('generated-plan 正常问卷生成后等待人工复核，放行后持久化并显示第1周',async({page})=>{
  await completeOnboarding(page);
  await expect(page.locator('.ob-saved')).toContainText('人工一致性复核完成前不会开放训练入口');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stored.plan.status).toBe('pending_review');
  expect(stored.plan.review).toBeNull();
  expect(stored.plan.weeks).toHaveLength(4);
  expect(stored.plan.intakeRevision).toBe(stored.intakeRevision);
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await expect(page.locator('#todayCard')).toContainText('人工一致性复核完成前');
  await expect(page.locator('.today-start')).toHaveCount(0);
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
  await expect(page.locator('#weekView .day-card')).toHaveCount(stored.plan.weeks[0].sessions.length);
  await expect(page.getByRole('button',{name:'开始本节训练'})).toBeVisible();
  const catalogRender=await page.evaluate(()=>{
    const before=document.querySelector('#todayCard .today-value').textContent;
    Move28.data.exerciseCatalog=[{id:'seated-leg-press',name:'EVIL_RUNTIME_CATALOG'}];
    Move28.ui.renderToday();
    return{before,after:document.querySelector('#todayCard .today-value').textContent};
  });
  expect(catalogRender.after).toBe(catalogRender.before);
  expect(catalogRender.after).not.toContain('EVIL_RUNTIME_CATALOG');
});

test('generated-plan 跟练严格消费session.actions，每屏一个动作并完成记录',async({page})=>{
  await completeOnboarding(page);
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
  const expected=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1')),session=state.plan.weeks[0].sessions[0];
    const index=Object.fromEntries(Move28.data.exerciseCatalog.map(item=>[item.id,item]));
    return{planId:state.plan.id,sessionId:session.id,actions:session.actions.map(action=>({action,exercise:index[action.exerciseId]}))};
  });
  await page.getByRole('button',{name:'开始本节训练'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  for(let index=0;index<expected.actions.length;index+=1){
    const item=expected.actions[index];
    await expect(page.locator('#guideBody .guide-action')).toHaveCount(1);
    await expect(page.locator('#guideBody h3')).toHaveText(item.exercise.name);
    await expect(page.locator('#guideBody img')).toHaveAttribute('src',item.exercise.gif);
    const dose=item.action.phase==='main'?`${item.action.sets}组 × ${item.action.reps}次`: `${item.action.durationMin}分钟`;
    await expect(page.locator('.guide-dose')).toContainText(dose);
    await expect(page.locator('#guideBody input,#guideBody select,#guideBody textarea')).toHaveCount(0);
    await expect(page.locator('#guideBody')).not.toContainText('任选');
    await page.locator('#guideNext').click();
  }
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const record=await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    return Object.values(state.logs)[0];
  });
  expect(record.planId).toBe(expected.planId);
  expect(record.sessionId).toBe(expected.sessionId);
  expect(record.status).toBe('completed');
  await page.reload();
  await expect(page.locator('#todayCard')).toContainText('已完成 1/');
});

test('generated-plan 缺少审核动作时原子阻断且不回退成用户训练计划',async({page})=>{
  await completeOnboarding(page,{setting:'home',equipment:['stable_chair','exercise_mat','resistance_band','wall'],allowSettingSwap:'no'});
  await expect(page.locator('.ob-saved')).toContainText('需要人工复核');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.plan).toBeNull();
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await expect(page.locator('#todayCard')).toContainText('暂未生成可执行计划');
  await expect(page.getByRole('button',{name:'开始本节训练'})).toHaveCount(0);
});
