const fs=require('node:fs');
const{test,expect}=require('@playwright/test');
const {waitForAppReady}=require('./helpers/pilot-flow.cjs');

const equipment=['stable_chair','exercise_mat','smith_machine','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const intake={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment,allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no'};
const capability={chairRise:'independent_controlled',wallHinge:'controlled',wallPushup:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable'};

async function reset(page){await page.goto('/index.html');await waitForAppReady(page);await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await page.reload();await waitForAppReady(page)}
async function submit(page){
  await waitForAppReady(page);
  await page.getByRole('button',{name:/生成我的4周计划/}).click();
  await page.evaluate(value=>{for(const[key,item]of Object.entries(value))Move28.onboardingController.setField(key,item);Move28.onboardingController.goTo(9)},intake);
  await page.locator('input[name=finalConfirmed]').check();
  await page.getByRole('button',{name:/确认并保存结果/}).click();
  await page.locator('#capabilityAssessmentView[aria-hidden="false"]').waitFor();
  await page.evaluate(value=>{for(const[key,item]of Object.entries(value))Move28.capabilityController.setField(key,item);Move28.capabilityController.goTo(2)},capability);
  await page.getByRole('button',{name:/确认并保存能力档案/}).click();
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await expect(page.locator('#reviewHandoff')).toBeVisible();
  await expect(page.getByRole('heading',{name:'计划等待确认'})).toBeVisible();
  expect((await page.evaluate(()=>Move28.storage.loadState())).plan.status).toBe('pending_review');
}
async function exportAndImport(page){
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载给确认人的文件'}).click();
  const download=await downloadPromise,path=await download.path(),parsed=JSON.parse(fs.readFileSync(path,'utf8'));
  expect(parsed.dossierVersion).toBe('move28.review-dossier.v1');
  expect(parsed.planStatus).toBe('pending_review');
  const serialized=JSON.stringify(parsed);
  for(const forbidden of ['chestSymptoms','locationHref','healthUrl','exception','stack'])expect(serialized).not.toContain(forbidden);
  await page.locator('[data-review-file]').setInputFiles(path);
  await expect(page.locator('.review-import-valid')).toContainText('已匹配');
  return parsed;
}

test.beforeEach(async({page})=>reset(page));

test('submit pending export import approve opens only the canonical reviewed plan',async({page})=>{
  await submit(page);await exportAndImport(page);
  const approve=page.getByRole('button',{name:'确认通过并开放当前计划'});
  await expect(approve).toBeDisabled();
  const confirmations=page.locator('[data-review-confirm]');
  for(let index=0;index<await confirmations.count();index++)await confirmations.nth(index).check();
  await expect(approve).toBeEnabled();await approve.click();
  const state=await page.evaluate(()=>Move28.storage.loadState());
  expect(state.plan.status).toBe('active');expect(state.plan.review.status).toBe('approved');
  await expect(page.locator('#reviewHandoff')).toBeHidden();
  await expect(page.getByRole('button',{name:'开始今天训练'})).toBeVisible();
});

test('submit pending export import deny persists rework and keeps training locked',async({page})=>{
  await submit(page);await exportAndImport(page);
  await page.getByRole('button',{name:'不通过，需要调整'}).click();
  const state=await page.evaluate(()=>Move28.storage.loadState());
  expect(state.plan.status).toBe('stale');expect(state.plan.staleReason).toBe('review_denied');expect(state.plan.review.status).toBe('denied');
  await expect(page.getByRole('heading',{name:'确认未通过，训练继续锁定'})).toBeVisible();
  await expect(page.getByRole('button',{name:'开始今天训练'})).toHaveCount(0);
});

test('invalid or foreign dossier fails closed without changing pending bytes',async({page})=>{
  await submit(page);
  const before=await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'));
  const foreign=await page.evaluate(()=>{const value=structuredClone(Move28.storage.buildDetailedReviewDossier());value.planId='foreign-plan';return value});
  await page.locator('[data-review-file]').setInputFiles({name:'foreign.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(foreign))});
  await expect(page.locator('.review-import-status')).toContainText('尚未导入');
  await expect(page.locator('.review-handoff-message')).toContainText('无效');
  await expect(page.locator('[data-review-action=approve]')).toBeDisabled();
  await expect(page.locator('[data-review-action=deny]')).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBe(before);
  expect((await page.evaluate(()=>Move28.storage.loadState())).plan.status).toBe('pending_review');
});
