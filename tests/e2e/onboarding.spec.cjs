const { test, expect } = require('@playwright/test');

const runtime = new WeakMap();
const safe = {
  boundaryAccepted:true, age:30, pregnancyPostpartum:'no', goal:'habit', activityDays:'3', walkCapacity:'20_40', strengthExperience:'some', trainingBreak:'no',
  daysPerWeek:'3', sessionMinutes:'30', weekdays:['mon','wed','fri'], gymOftenUnavailable:'no', setting:'home', equipment:['stable_chair','resistance_band'], allowSettingSwap:'yes',
  painAreas:['none'], painTrend:'none', acuteInjury:'no', unableToBearWeight:'no', visibleSwelling:'no', dailyActivityLimited:'no', chairStand:'yes', walkTenMinutes:'yes', chestSymptoms:'no', exertionalDizziness:'no', unexplainedFainting:'no', restingShortnessOfBreath:'no', unresolvedConcussion:'no', doctorRestriction:'none', recentSurgery:'no', complexCondition:'no', uncontrolledBloodPressure:'no',
  cardioPreference:'flat_walk', cardioAvoid:'none', avoidMovements:[], avoidEquipment:[], trackingItems:['completion','rpe','pain','sleep'], sessionPreference:'short_frequent', musicEnabled:'no'
};

test.beforeEach(async ({ page }) => {
  const issues=[];
  const handlers={
    console:m=>{ if(m.type()==='error') issues.push(`console: ${m.text()}`); },
    pageerror:e=>issues.push(`pageerror: ${e.message}`),
    requestfailed:r=>{ const text=r.failure()?.errorText||'failed'; if(!(/ERR_ABORTED/.test(text)&&r.resourceType()==='media')) issues.push(`${text}: ${r.url()}`); },
    response:r=>{ if(r.url().startsWith('http://127.0.0.1:8765')&&r.status()>=400) issues.push(`${r.status()}: ${r.url()}`); }
  };
  Object.entries(handlers).forEach(([event,handler])=>page.on(event,handler)); runtime.set(page,{issues,handlers});
  await page.goto('/index.html');
  await page.evaluate(()=>{ localStorage.removeItem('move28-pilot-v1'); sessionStorage.removeItem('move28-onboarding-draft-v1'); sessionStorage.removeItem('move28-capability-draft-v1'); });
  await page.reload();
});

test.afterEach(async ({ page }) => {
  const guard=runtime.get(page); if(!guard)return;
  Object.entries(guard.handlers).forEach(([event,handler])=>page.off(event,handler));
  expect(guard.issues).toEqual([]);
});

async function open(page){
  await page.getByRole('button',{name:/生成我的4周计划/}).click();
  await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','false');
}
async function inject(page, overrides={}){
  await page.evaluate(data=>{ for(const [key,value] of Object.entries(data)) window.Move28.onboardingController.setField(key,value); window.Move28.onboardingController.goTo(9); },{...safe,...overrides});
}
async function confirm(page){
  await page.locator('input[name="finalConfirmed"]').check();
  await page.getByRole('button',{name:/确认并保存结果/}).click();
}
async function answerCapability(page, overrides={}){
  const answers={chairRise:'independent_controlled',wallHinge:'controlled',wallPushup:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable',...overrides};
  await page.evaluate(values=>{ for(const [field,value] of Object.entries(values)) Move28.capabilityController.setField(field,value); Move28.capabilityController.goTo(2); },answers);
  await page.getByRole('button',{name:/确认并保存能力档案/}).click();
}
async function chooseCapability(page, field, value){
  await page.locator(`label:has(input[name="${field}"][value="${value}"])`).click();
}

test('入口打开单屏问卷，边界未确认不能前进，且没有身份字段', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading',{name:'先确认这项服务适合你'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'先确认这项服务适合你'})).toBeFocused();
  await page.getByRole('button',{name:'继续 →'}).click();
  await expect(page.locator('.ob-errors')).toContainText('我理解');
  await page.locator('input[name="boundaryAccepted"]').check();
  await page.getByRole('button',{name:'继续 →'}).click();
  await expect(page.getByRole('heading',{name:'告诉我们训练起点'})).toBeVisible();
  await expect(page.locator('input[name="name"],input[name="phone"],input[name="idcard"],input[name="birthday"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:/生成我的4周计划/})).toBeFocused();
});

test('安全筛查逐项缺失时不能继续', async ({ page }) => {
  await open(page); await page.evaluate(()=>Move28.onboardingController.goTo(7));
  await page.getByRole('button',{name:'继续 →'}).click();
  await expect(page.locator('.ob-errors p')).toHaveCount(9);
});

test('完整成年安全答案确认后只保存intake并打开能力校准，不提前生成计划', async ({ page }) => {
  await open(page); await inject(page);
  expect(await page.evaluate(()=>Move28.onboardingController.setField('name','secret'))).toBe(false);
  await expect(page.locator('[data-risk-level="normal"]')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBeNull();
  await confirm(page);
  await expect(page.locator('#capabilityAssessmentView')).toHaveAttribute('aria-hidden','false');
  await expect(page.getByRole('heading',{name:'下肢起身与髋部控制'})).toBeVisible();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.intakeRevision).toBe(1); expect(state.risk.level).toBe('normal'); expect(state.risk.ruleVersion).toBe('pilot-v2');
  expect(state.capabilityProfile).toBeNull(); expect(state.capabilityRevision).toBe(0); expect(state.plan).toBeNull();
  expect(state.intake.name).toBeUndefined(); expect(state.intake.phone).toBeUndefined();
  expect(await page.evaluate(()=>sessionStorage.getItem('move28-onboarding-draft-v1'))).toBeNull();
});

test('能力校准严格三屏验证，允许逐项跳过，完整答案保存revision但Task5前居家计划进入人工复核', async ({ page }) => {
  await open(page); await inject(page); await confirm(page);
  await page.getByRole('button',{name:'继续 →'}).click();
  await expect(page.locator('.cap-errors')).toContainText('未尝试');
  await chooseCapability(page,'chairRise','not_attempted');
  await chooseCapability(page,'wallHinge','not_attempted');
  await page.getByRole('button',{name:'继续 →'}).click();
  await expect(page.getByRole('heading',{name:'上肢推力与地面可达性'})).toBeVisible();
  await chooseCapability(page,'wallPushup','not_attempted');
  await chooseCapability(page,'floorAccess','not_attempted');
  await page.getByRole('button',{name:'继续 →'}).click();
  await chooseCapability(page,'walkTolerance','not_attempted');
  await page.getByRole('button',{name:/确认并保存能力档案/}).click();
  await expect(page.locator('.cap-result')).toContainText('人工复核');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.capabilityRevision).toBe(1); expect(state.capabilityProfile.completed).toBe(true); expect(state.plan).toBeNull();
  expect(await page.evaluate(()=>sessionStorage.getItem('move28-capability-draft-v1'))).toBeNull();
});

test('能力警示症状仍保存有效profile，但停止自动生成', async ({ page }) => {
  await open(page); await inject(page); await confirm(page);
  await answerCapability(page,{walkTolerance:'warning_symptom'});
  await expect(page.locator('.cap-result')).toContainText('停止信号');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.capabilityProfile.walkTolerance).toBe('warning_symptom'); expect(state.capabilityResult.status).toBe('stop'); expect(state.plan).toBeNull();
});

test('能力草稿刷新恢复当前屏，Escape关闭且仍可从首页优先恢复', async ({ page }) => {
  await open(page); await inject(page); await confirm(page);
  await chooseCapability(page,'chairRise','hands_supported');
  await chooseCapability(page,'wallHinge','controlled');
  await page.getByRole('button',{name:'继续 →'}).click();
  await page.reload();
  await expect(page.locator('#capabilityAssessmentView')).toHaveAttribute('aria-hidden','false');
  await expect(page.getByRole('heading',{name:'上肢推力与地面可达性'})).toBeVisible();
  expect((await page.evaluate(()=>Move28.capabilityController.getState().answers)).chairRise).toBe('hands_supported');
  await page.keyboard.press('Escape');
  await expect(page.locator('#capabilityAssessmentView')).toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:/生成我的4周计划/}).click();
  await expect(page.locator('#capabilityAssessmentView')).toHaveAttribute('aria-hidden','false');
});

test('停止条件阻断；返回修改胸部答案会实时重算为stop', async ({ page }) => {
  await open(page); await inject(page,{chestSymptoms:'yes'});
  await expect(page.locator('[data-risk-level="stop"]')).toContainText('暂不进入自动计划');
  await confirm(page);
  const stopState=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stopState.risk.level).toBe('stop');
  await page.evaluate(()=>{ localStorage.removeItem('move28-pilot-v1'); Move28.onboardingController.setField('chestSymptoms','no'); Move28.onboardingController.goTo(9); });
  await expect(page.locator('[data-risk-level="normal"]')).toBeVisible();
  await page.getByRole('button',{name:'修改安全筛查'}).click();
  await page.locator('input[name="chestSymptoms"][value="yes"]').check();
  await page.evaluate(()=>Move28.onboardingController.goTo(9));
  await expect(page.locator('[data-risk-level="stop"]')).toBeVisible();
});

test('非安全问题选择不确定仍可完成问卷并按保守路线处理', async ({ page }) => {
  await open(page);
  await inject(page,{trainingBreak:'unsure',gymOftenUnavailable:'unsure',allowSettingSwap:'unsure',musicEnabled:'unsure'});
  await expect(page.locator('[data-risk-level="conservative"]')).toBeVisible();
  expect(await page.evaluate(()=>Move28.onboardingController.getState().evaluation.canGenerate)).toBe(true);
});

test('17岁保留normal风险并进入常规生成流程', async ({ page }) => {
  await open(page); await inject(page,{age:17});
  await expect(page.locator('[data-risk-level="normal"]')).toContainText('可以进入常规生成流程');
  const evaluation=await page.evaluate(()=>Move28.onboardingController.getState().evaluation);
  expect(evaluation.risk.level).toBe('normal'); expect(evaluation.canGenerate).toBe(true);
});

test('明显肿胀与基础活动受限写入正式人工审核理由', async ({ page }) => {
  await open(page); await inject(page,{dailyActivityLimited:'yes'});
  await expect(page.locator('[data-risk-level="manual_review"]')).toContainText('需要人工审核');
  const evaluation=await page.evaluate(()=>Move28.onboardingController.getState().evaluation);
  expect(evaluation.risk.level).toBe('manual_review');
  expect(evaluation.risk.reasons.some(reason=>reason.code==='dailyActivityLimited_reported')).toBe(true);
  expect(evaluation.canGenerate).toBe(false);
  await page.evaluate(()=>{ Move28.onboardingController.setField('dailyActivityLimited','no'); Move28.onboardingController.setField('visibleSwelling','yes'); Move28.onboardingController.goTo(9); });
  const swelling=await page.evaluate(()=>Move28.onboardingController.getState().evaluation);
  expect(swelling.risk.level).toBe('manual_review');
  expect(swelling.risk.reasons.some(reason=>reason.code==='visibleSwelling_reported')).toBe(true);
});

test('同标签页刷新恢复已确认步骤与答案', async ({ page }) => {
  await open(page);
  await page.locator('input[name="boundaryAccepted"]').check();
  await page.getByRole('button',{name:'继续 →'}).click();
  await page.locator('input[name="age"]').fill('36');
  await page.locator('input[name="pregnancyPostpartum"][value="no"]').check();
  await page.getByRole('button',{name:'继续 →'}).click();
  await page.reload();
  await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','false');
  await expect(page.getByRole('heading',{name:'这4周，你最想建立什么？'})).toBeVisible();
  expect(await page.evaluate(()=>Move28.onboardingController.getState().intake.age)).toBe(36);
});

test('浏览器Back在问卷内回上一步并从第0步关闭', async ({ page }) => {
  await open(page);
  await page.locator('input[name="boundaryAccepted"]').check(); await page.getByRole('button',{name:'继续 →'}).click();
  await page.goBack(); await expect(page.getByRole('heading',{name:'先确认这项服务适合你'})).toBeVisible();
  await page.goBack(); await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','true');
});

test('确认页重新校验全部步骤，跳步草稿不能保存或生成', async ({ page }) => {
  await open(page);
  await page.evaluate(()=>Move28.onboardingController.goTo(9));
  await page.locator('input[name="finalConfirmed"]').check();
  await page.getByRole('button',{name:/确认并保存结果/}).click();
  await expect(page.getByRole('heading',{name:'先确认这项服务适合你'})).toBeVisible();
  await expect(page.locator('input[name="boundaryAccepted"]')).toHaveAttribute('aria-invalid','true');
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBeNull();
  expect((await page.evaluate(()=>Move28.onboardingController.getState().evaluation)).canGenerate).toBe(false);
});

test('篡改草稿和公开setField均不能把PII带入最终档案', async ({ page }) => {
  await page.evaluate(data=>{ sessionStorage.setItem('move28-onboarding-draft-v1',JSON.stringify({version:1,step:9,confirmedStep:8,intake:{...data,name:'secret',phone:'secret'}})); location.hash='onboarding'; },safe);
  await page.reload();
  const restored=await page.evaluate(()=>Move28.onboardingController.getState().intake);
  expect(restored.name).toBeUndefined(); expect(restored.phone).toBeUndefined();
  expect(await page.evaluate(()=>Move28.onboardingController.setField('phone','secret'))).toBe(false);
  await confirm(page);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.intake.name).toBeUndefined(); expect(state.intake.phone).toBeUndefined();
});

test('本机保存失败后保留当前答案并可原地重试', async ({ page }) => {
  await open(page); await inject(page);
  await page.evaluate(()=>{
    window.__move28SetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){ if(key==='move28-pilot-v1') throw new Error('blocked'); return window.__move28SetItem.call(this,key,value); };
  });
  await confirm(page);
  await expect(page.locator('.ob-saved')).toContainText('本机保存失败');
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBeNull();
  await page.evaluate(()=>{ Storage.prototype.setItem=window.__move28SetItem; delete window.__move28SetItem; });
  await page.getByRole('button',{name:/确认并保存结果/}).click();
  await expect(page.locator('#capabilityAssessmentView')).toHaveAttribute('aria-hidden','false');
});

test('完成与destroy都会释放路由且不会被Back重新打开', async ({ page }) => {
  await open(page); await inject(page); await confirm(page);
  await expect(page).not.toHaveURL(/#onboarding$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','true');
  await page.goBack();
  await expect(page).not.toHaveURL(/#onboarding$/);
  await page.goForward();
  await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','true');
  await page.evaluate(()=>localStorage.removeItem('move28-pilot-v1'));
  await page.evaluate(()=>{ Move28.onboardingController.open(); Move28.onboardingController.destroy(); });
  await expect(page).not.toHaveURL(/#onboarding$/);
  await expect(page.locator('#onboardingView')).toHaveAttribute('aria-hidden','true');
});

test('390×844单列无横滚且长偏好屏可滚动、底部按钮固定可见', async ({ page }) => {
  await page.setViewportSize({width:390,height:844}); await open(page);
  let dimensions=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,bottom:document.querySelector('.ob-next').getBoundingClientRect().bottom,height:innerHeight}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width); expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.height);
  await expect(page.locator('.ob-rail')).toBeHidden(); await expect(page.locator('.ob-next')).toBeVisible();
  await page.evaluate(()=>{ Move28.onboardingController.setField('setting','home'); Move28.onboardingController.goTo(8); });
  dimensions=await page.evaluate(()=>{ const content=document.querySelector('.ob-content'),panel=document.querySelector('.ob-panel'),footer=document.querySelector('.ob-foot'); return {panelHeight:panel.clientHeight,height:innerHeight,contentHeight:content.clientHeight,contentScrollHeight:content.scrollHeight,footerBottom:footer.getBoundingClientRect().bottom}; });
  expect(dimensions.panelHeight).toBe(dimensions.height);
  expect(dimensions.contentScrollHeight).toBeGreaterThan(dimensions.contentHeight);
  expect(dimensions.footerBottom).toBeLessThanOrEqual(dimensions.height);
  await page.locator('.ob-content').evaluate(element=>{ element.scrollTop=element.scrollHeight; });
  await expect(page.locator('input[name="musicEnabled"][value="no"]')).toBeInViewport();
});

test('390×844能力校准保持单列、底部操作可见且无横向溢出', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await open(page); await inject(page); await confirm(page);
  const dimensions=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    width:document.documentElement.clientWidth,
    columns:getComputedStyle(document.querySelector('.cap-options')).gridTemplateColumns.split(' ').length,
    footerBottom:document.querySelector('.cap-foot').getBoundingClientRect().bottom,
    viewport:innerHeight
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  expect(dimensions.columns).toBe(1);
  expect(dimensions.footerBottom).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator('.cap-next')).toBeVisible();
});
