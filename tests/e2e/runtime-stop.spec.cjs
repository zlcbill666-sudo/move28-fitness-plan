const {test,expect}=require('@playwright/test');
const gymEquipment=['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const safe={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment:gymEquipment,allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no'};
async function setup(page){await page.goto('/index.html');await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload();await page.getByRole('button',{name:/生成我的4周计划/}).click();await page.evaluate(data=>{for(const [key,value]of Object.entries(data))Move28.onboardingController.setField(key,value);Move28.onboardingController.goTo(9)},safe);await page.locator('input[name="finalConfirmed"]').check();await page.getByRole('button',{name:/确认并保存结果/}).click();await page.getByRole('button',{name:'完成，返回首页'}).click();await page.evaluate(()=>{const state=Move28.storage.loadState();Move28.storage.approvePlanReview({reviewerId:'pilot-reviewer',planId:state.plan.id,intakeRevision:state.intakeRevision})});await page.reload();await page.getByRole('button',{name:'开始本节训练'}).click()}

test.beforeEach(async({page})=>setup(page));

test('runtime 普通退出必须确认且不写安全事件或使计划失效',async({page})=>{
  await expect(page.getByRole('button',{name:'开始本节',exact:true})).toBeVisible();
  await expect(page.getByText(/胸部不适.*晕厥感.*异常气短/)).toBeVisible();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await expect(page.getByRole('button',{name:'暂停 / 停止训练'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'普通退出训练？'})).toBeVisible();
  await page.getByRole('button',{name:'继续训练'}).click();
  await expect(page.locator('.guide-action')).toBeVisible();
  await page.locator('.guide-close').click();
  await page.getByRole('button',{name:'确认普通退出'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stored.plan.status).toBe('active');
  expect(Object.values(stored.logs).some(record=>record.status==='safety_stopped')).toBe(false);
});

test('runtime 严重症状停止后原子失效、刷新后无训练入口',async({page})=>{
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/胸部不适或压迫感/}).click();
  await expect(page.getByRole('heading',{name:'确认因不适停止'})).toBeVisible();
  await expect(page.getByRole('button',{name:/忽略|继续训练|返回选择|返回训练/})).toHaveCount(0);
  await page.locator('.guide-close').click();
  await page.keyboard.press('Escape');
  await page.evaluate(()=>Move28.guideBack());
  const reopened=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));return Move28.openGeneratedWorkout(state.plan.weeks[0].sessions[0].id)});
  expect(reopened).toBe(false);
  await expect(page.getByRole('heading',{name:'确认因不适停止'})).toBeVisible();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'训练已安全停止'})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stored.plan.status).toBe('stale');
  expect(stored.plan.staleReason).toBe('runtime-safety-event');
  expect(Object.values(stored.logs).filter(record=>record.status==='safety_stopped')).toHaveLength(1);
  expect(Object.values(stored.logs).some(record=>record.status==='completed')).toBe(false);
  await page.getByRole('button',{name:'返回首页'}).click();
  await expect(page.getByRole('button',{name:'开始本节训练'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button',{name:'开始本节训练'})).toHaveCount(0);
});

test('runtime 新发关节不适仅在调整后缓解时恢复',async({page})=>{
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:'新发关节不适'}).click();
  await expect(page.getByRole('heading',{name:'先暂停并降低幅度或阻力'})).toBeVisible();
  await page.getByRole('button',{name:'调整后已缓解'}).click();
  await expect(page.locator('.guide-action')).toBeVisible();
  let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stored.plan.status).toBe('active');
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:'新发关节不适'}).click();
  await page.getByRole('button',{name:'仍持续或加重'}).click();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(stored.plan.status).toBe('stale');
  expect(Object.values(stored.logs).find(record=>record.status==='safety_stopped').reasonCode).toBe('joint_pain_persisted_or_worsened');
});

test('runtime 安全停止保存失败时保持停止页并允许重试',async({page})=>{
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/晕厥感/}).click();
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('secret')}});
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'停止记录尚未保存'})).toBeVisible();
  await expect(page.getByRole('button',{name:'重试保存'})).toBeVisible();
  await expect(page.getByRole('button',{name:/继续训练/})).toHaveCount(0);
});

test('runtime 安全停止后可返回对应重新筛查步骤且清除最终确认',async({page})=>{
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/异常气短/}).click();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await page.getByRole('button',{name:'重新完成安全筛查'}).click();
  await expect(page.locator('#onboardingView')).toHaveClass(/open/);
  expect(await page.evaluate(()=>Move28.onboardingController.getState().step)).toBe(7);
  expect(await page.evaluate(()=>Move28.onboardingController.getState().intake.finalConfirmed)).not.toBe(true);
});
