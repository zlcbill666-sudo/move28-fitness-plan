'use strict';
const {test,expect}=require('@playwright/test');
const {resetHttp,completeOnboarding,approvePendingPlan}=require('./helpers/pilot-flow.cjs');

async function finishSavedScreen(page){
  const button=page.getByRole('button',{name:'完成，返回首页'});
  if(await button.count())await button.click();
}

async function approveParticipant(page){
  await completeOnboarding(page);
  await finishSavedScreen(page);
  await approvePendingPlan(page);
}

test.beforeEach(async({page})=>resetHttp(page));

test('today-workspace 从首次问卷到人工复核再到今日训练只开放可信主操作',async({page})=>{
  const workflow=page.locator('#workflowStatus');
  await expect(page.locator('.hero')).toBeVisible();
  await expect(workflow).toHaveAttribute('data-stage','questionnaire');
  await expect(workflow.locator('[data-workflow-step]')).toHaveCount(4);
  await expect(workflow.locator('[aria-current="step"]')).toContainText('安全问卷');
  await expect(page.getByRole('button',{name:'开始今天训练'})).toHaveCount(0);
  await expect(page.locator('a[href="#tracker"]:visible')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('move28-pilot-v1'))).toBeNull();

  await completeOnboarding(page);
  await finishSavedScreen(page);
  await expect(workflow).toHaveAttribute('data-stage','human_review');
  await expect(workflow.locator('[data-step="questionnaire"]')).toHaveClass(/done/);
  await expect(workflow.locator('[data-step="capability"]')).toHaveClass(/done/);
  await expect(workflow.locator('[data-step="review"]')).toHaveAttribute('aria-current','step');
  await expect(workflow).toContainText('人工一致性复核');
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.locator('.today-start')).toHaveCount(0);
  await expect(page.locator('.plan-explanation')).toHaveCount(0);

  await approvePendingPlan(page);
  await expect(page.locator('body')).toHaveClass(/app-mode-generated/);
  await expect(page.locator('.hero')).toBeHidden();
  await expect(page.locator('.metric-rail')).toBeHidden();
  await expect(page.locator('.beginner-strip')).toBeHidden();
  await expect(workflow).toHaveAttribute('data-stage','ready');
  await expect(workflow.locator('[data-step="training"]')).toHaveAttribute('aria-current','step');
  await expect(workflow).toContainText('今日训练可开始');
  await expect(page.locator('#todayCard')).toContainText('全身力量');
  await expect(page.locator('#todayCard [data-today-metric="duration"]')).toContainText('分钟');
  await expect(page.locator('#todayCard [data-today-metric="actions"]')).toContainText('个动作');
  await expect(page.locator('#todayCard [data-today-metric="setting"]')).toContainText('健身房');
  await expect(page.locator('#todayCard [data-today-metric="rpe"]')).toContainText('RPE');
  await expect(page.locator('.plan-explanation')).toHaveCount(1);
  const startButton=page.getByRole('button',{name:'开始今天训练'});
  await expect(startButton).toHaveCount(1);
  await expect(startButton).toHaveAttribute('data-session-id',/^[a-z][a-z0-9._-]{0,63}$/);
  await expect(startButton).toHaveAttribute('onclick','openSessionReadiness(this.dataset.sessionId)');
  await startButton.click();
  await expect(page.getByRole('button',{name:'检查今天状态'})).toBeVisible();
});

test('today-workspace 计划失效立即恢复fail-closed外壳且不泄漏健康答案',async({page})=>{
  await approveParticipant(page);
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    state.plan.status='stale';state.plan.staleReason='intake_changed';state.plan.staleAt='2030-01-02T03:04:05.000Z';
    localStorage.setItem('move28-pilot-v1',JSON.stringify(state));location.reload();
  });
  await page.waitForLoadState('load');
  await expect(page.locator('body')).not.toHaveClass(/app-mode-generated/);
  await expect(page.locator('.hero')).toBeVisible();
  await expect(page.locator('#workflowStatus')).toHaveAttribute('data-stage','plan_stale');
  await expect(page.locator('#workflowStatus')).toContainText('重新确认');
  await expect(page.locator('.today-start')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('chestSymptoms');
  await expect(page.locator('body')).not.toContainText('pregnancyPostpartum');
  await expect(page.locator('body')).not.toContainText('independent_controlled');
});

test('today-workspace 安全停止只进入rescreen而不会伪装普通计划失效',async({page})=>{
  await approveParticipant(page);
  await page.evaluate(()=>{
    const state=Move28.storage.loadState(),session=state.plan.weeks[0].sessions[0];
    Move28.storage.recordWorkoutStop({sessionId:session.id,reasonCode:'sudden_severe_pain',actionIndex:0,occurredAt:'2030-01-02T03:04:05.000Z'});
    location.reload();
  });
  await page.waitForLoadState('load');
  await expect(page.locator('#workflowStatus')).toHaveAttribute('data-stage','rescreen_required');
  await expect(page.locator('#workflowStatus')).toContainText('重新安全筛查');
  await expect(page.locator('.today-start')).toHaveCount(0);
});

test('today-workspace 疼痛反馈进入rescreen而不是普通计划失效',async({page})=>{
  await approveParticipant(page);
  await page.evaluate(()=>{
    const state=Move28.storage.loadState(),session=state.plan.weeks[0].sessions[0];
    Move28.storage.recordWorkoutCompletion({planId:state.plan.id,sessionId:session.id});
    Move28.storage.recordWorkoutFeedback({sessionId:session.id,feedbackCode:'pain'});
  });
  await page.reload();
  await expect(page.locator('#workflowStatus')).toHaveAttribute('data-stage','rescreen_required');
  await expect(page.locator('#workflowStatus')).toContainText('重新安全筛查');
  await expect(page.locator('.today-start')).toHaveCount(0);
});

test('today-workspace 全部训练完成后结束4周周期且不重新开放第一节',async({page})=>{
  await approveParticipant(page);
  const total=await page.evaluate(()=>{
    const state=Move28.storage.loadState(),sessions=state.plan.weeks.flatMap(week=>week.sessions);
    for(const session of sessions)Move28.storage.recordWorkoutCompletion({planId:state.plan.id,sessionId:session.id});
    return sessions.length;
  });
  expect(total).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#workflowStatus')).toHaveAttribute('data-stage','cycle_complete');
  await expect(page.locator('#workflowStatus')).toContainText('4周训练周期已完成');
  await expect(page.locator('#todayCard')).toContainText('已完成全部训练 · 100%');
  await expect(page.locator('.today-start')).toHaveCount(0);
  await expect(page.locator('.shift-preview-open')).toHaveCount(0);
  await page.locator('#weekView .day-card.completed').first().getByRole('button',{name:'查看此节'}).click();
  await expect(page.locator('#todayCard')).toContainText('本节已完成');
  await expect(page.locator('.today-start')).toHaveCount(0);
  await expect(page.locator('.shift-preview-open')).toHaveCount(0);
  await expect(page.locator('.shift-display-restore')).toHaveCount(0);
  await expect(page.locator('.schedule-shift-preview')).toHaveCount(0);
  await expect(page.locator('.shift-display-badge')).toHaveCount(0);
  const weekCount=await page.evaluate(()=>Move28.storage.loadState().plan.weeks.length);
  expect(weekCount).toBe(4);
});

test('today-workspace 外部展示阶段不能伪造ready且accessor零执行',async({page})=>{
  const result=await page.evaluate(()=>{
    let reads=0;const context={mode:'review',message:'等待可信状态'};
    Object.defineProperty(context,'workflowStage',{enumerable:true,get(){reads+=1;return'ready'}});
    Move28.ui.setPlanContext(context);
    return{reads,stage:document.querySelector('#workflowStatus').dataset.stage,body:document.body.className};
  });
  expect(result.reads).toBe(0);
  expect(result.stage).toBe('plan_required');
  expect(result.body).not.toContain('app-mode-generated');
  await expect(page.locator('#workflowStatus')).not.toContainText('今日训练可开始');
  await expect(page.locator('.today-start')).toHaveCount(0);
  await page.evaluate(()=>Move28.ui.setPlanContext({mode:'generated',workflowStage:'ready'}));
  await expect(page.locator('#workflowStatus')).toHaveAttribute('data-stage','invalid');
  await expect(page.locator('.today-start')).toHaveCount(0);
});

test('today-workspace 已批准首屏在390竖屏、844横屏和1280桌面无横向溢出',async({page})=>{
  await approveParticipant(page);
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1280,height:800}]){
    await page.setViewportSize(viewport);
    const layout=await page.evaluate(()=>{
      const today=document.querySelector('#today'),workflow=document.querySelector('#workflowStatus'),cta=document.querySelector('.today-start'),mobileNav=document.querySelector('.mobile-nav');
      const box=node=>{const rect=node.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height}};
      const navigationCutoff=getComputedStyle(mobileNav).display==='none'?window.innerHeight:mobileNav.getBoundingClientRect().top;
      return{overflow:document.documentElement.scrollWidth>window.innerWidth+1,today:box(today),workflow:box(workflow),cta:box(cta),navigationCutoff,heroDisplay:getComputedStyle(document.querySelector('.hero')).display};
    });
    expect(layout.overflow).toBe(false);
    expect(layout.heroDisplay).toBe('none');
    expect(layout.workflow.width).toBeGreaterThan(0);
    expect(layout.cta.left).toBeGreaterThanOrEqual(0);
    expect(layout.cta.right).toBeLessThanOrEqual(viewport.width+1);
    expect(layout.cta.top).toBeGreaterThanOrEqual(0);
    expect(layout.cta.bottom).toBeLessThanOrEqual(layout.navigationCutoff+1);
  }
});
