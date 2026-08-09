'use strict';

const {test,expect}=require('@playwright/test');
const {resetHttp,completeOnboarding,approvePendingPlan}=require('./helpers/pilot-flow.cjs');

async function setup(page){
  await resetHttp(page);
  await completeOnboarding(page,{daysPerWeek:'3',weekdays:['mon','wed','fri']});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
}

async function openReadiness(page){
  await page.getByRole('button',{name:'开始本节训练'}).click();
  await expect(page.locator('#sessionReadinessView')).toHaveAttribute('aria-hidden','false');
  await expect(page.getByRole('heading',{name:'开始前确认今天的条件'})).toBeVisible();
}

async function selectCardio(page){
  await page.locator('#weekView .day-card.cardio').getByRole('button',{name:'查看此节'}).click();
  await expect(page.locator('#todayCard h3')).toHaveText('低冲击有氧');
}

async function previewBodyweight(page){
  await selectCardio(page);
  await openReadiness(page);
  await page.getByLabel('器械条件').selectOption('bodyweight_only');
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await expect(page.locator('.readiness-comparison')).toBeVisible();
}

test.beforeEach(async({page})=>setup(page));

test('默认保持原计划，只有显式检查后才开放原session跟练',async({page})=>{
  await openReadiness(page);
  await expect(page.getByLabel('可用时间')).toHaveValue('full');
  await expect(page.getByLabel('器械条件')).toHaveValue('unchanged');
  await expect(page.getByLabel('空间条件')).toHaveValue('normal');
  await expect(page.getByLabel('噪声条件')).toHaveValue('normal');
  await expect(page.getByLabel('今日精力')).toHaveValue('normal');
  await expect(page.getByLabel('身体信号')).toHaveValue('none');
  await expect(page.getByRole('button',{name:'按原计划继续'})).toHaveCount(0);
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await expect(page.locator('.readiness-result')).toContainText('今天可以按原计划进行');
  await page.getByRole('button',{name:'按原计划继续'}).click();
  await expect(page.locator('#sessionReadinessView')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
});

test('警示、疼痛和不可用路由都不显示任何继续训练入口',async({page})=>{
  const cases=[
    ['身体信号','warning','出现警示信号，请停止训练'],
    ['身体信号','pain','今天需要人工复核'],
    ['可用时间','20_min','当前条件暂不支持安全适配']
  ];
  for(const [label,value,message] of cases){
    await openReadiness(page);
    await page.getByLabel(label).selectOption(value);
    await page.getByRole('button',{name:'检查今天状态'}).click();
    await expect(page.locator('.readiness-result')).toContainText(message);
    await expect(page.getByRole('button',{name:/按原计划继续|确认本次适配|开始适配训练/})).toHaveCount(0);
    await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
    await page.getByRole('button',{name:'关闭今天状态确认'}).click();
  }
});

test('候选先预览原session与候选及有限理由，确认前不进入跟练',async({page})=>{
  await previewBodyweight(page);
  await expect(page.locator('.readiness-comparison')).toContainText('原计划');
  await expect(page.locator('.readiness-comparison')).toContainText('本次候选');
  await expect(page.locator('.readiness-comparison')).toContainText('器械改为已审核的徒手支持条件');
  await expect(page.locator('.readiness-support')).toContainText('稳固椅子');
  await expect(page.locator('.readiness-support')).toContainText('运动垫');
  await expect(page.locator('.readiness-support')).toContainText('墙面');
  await expect(page.locator('.readiness-support')).toContainText('平地步行路线');
  await expect(page.locator('#sessionReadinessView textarea')).toHaveCount(0);
  await expect(page.locator('#sessionReadinessView')).not.toContainText('chestSymptoms');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:'确认本次适配'})).toBeVisible();
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('确认会重载当前存储并在revision变化时重新路由、提案和独立校验后阻断',async({page})=>{
  await previewBodyweight(page);
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    state.capabilityRevision+=1;
    localStorage.setItem('move28-pilot-v1',JSON.stringify(state));
  });
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await expect(page.locator('.readiness-result')).toContainText('当前计划或能力档案已经变化');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:/按原计划继续|开始适配训练/})).toHaveCount(0);
});

test('刷新丢弃未确认候选，不能把预览当成正式适配',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  expect(adaptationId).toMatch(/^daily\./);
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  await page.reload();
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#sessionReadinessView')).toHaveAttribute('aria-hidden','true');
});

test('已确认适配只能经adaptationId可信加载，完成绑定且不持久化manifest或健康数据',async({page})=>{
  const before=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));return{plan:JSON.stringify(state.plan),intake:JSON.stringify(state.intake)}});
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  const loaded=await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId);
  expect(loaded.adaptationId).toBe(adaptationId);
  expect(loaded.sourceSessionId).toBe(loaded.session.id);
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  for(let index=0;index<actionCount;index+=1)await page.locator('#guideNext').click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  const record=Object.values(stored.logs).find(item=>item.adaptationId===adaptationId);
  expect(Object.keys(record)).toEqual(['planId','sessionId','adaptationId','status','completedAt']);
  expect(record.planId).toBe(loaded.planId);
  expect(record.sessionId).toBe(loaded.sourceSessionId);
  expect(record.status).toBe('completed');
  expect(record).not.toHaveProperty('manifest');
  expect(JSON.stringify(record)).not.toContain('equipmentSnapshot');
  expect(JSON.stringify(stored.plan)).toBe(before.plan);
  expect(JSON.stringify(stored.intake)).toBe(before.intake);
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('适配授权在普通退出后立即撤销且不能复用',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.locator('.guide-close').click();
  await page.getByRole('button',{name:'确认普通退出'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  expect(await page.evaluate(id=>Move28.guide.openWorkout({adaptationId:id,catalog:Move28.data.exerciseCatalog}),adaptationId)).toBe(false);
});

test('适配授权在安全停止成功保存后撤销',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/胸部不适或压迫感/}).click();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'训练已安全停止'})).toBeVisible();
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});
