'use strict';

const { test, expect } = require('@playwright/test');
const {
  resetHttp,
  completeOnboarding,
  approvePendingPlan,
  answerSafeReadiness,
  completeGuideActions
} = require('./helpers/pilot-flow.cjs');

async function finishSavedScreen(page) {
  const button = page.getByRole('button', { name: '完成，返回首页' });
  if (await button.count()) await button.click();
}

async function openAndFill(page, overrides = {}) {
  await page.evaluate(() => window.Move28.onboardingController.open());
  const { safeIntake } = require('./helpers/pilot-flow.cjs');
  await page.evaluate(data => {
    for (const [key, value] of Object.entries(data)) window.Move28.onboardingController.setField(key, value);
    window.Move28.onboardingController.goTo(9);
  }, { ...safeIntake, ...overrides });
  await page.locator('input[name="finalConfirmed"]').check();
}

test.beforeEach(async ({ page }) => resetHttp(page));

test('完整试用链：问卷、生成、审核、跟练、记录和刷新恢复', async ({ page }) => {
  const legacyGifRequests=[];page.on('request',request=>{if(request.url().includes('/assets/gifs/'))legacyGifRequests.push(request.url())});
  await completeOnboarding(page);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.plan.status).toBe('pending_review');
  expect(state.plan.weeks).toHaveLength(4);
  const dossier = await page.evaluate(() => window.Move28.storage.buildDetailedReviewDossier());
  expect(dossier.selectedSetting).toBe('gym');
  expect(dossier.availableEquipment).toContain('resistance_band');
  expect(dossier.validationResult).toBe('passed');
  expect(dossier.lineage).toEqual({ validationResult: 'passed', currentPlanId: dossier.planId, acceptedEdges: [] });
  expect(dossier.weeks.flatMap(week => week.sessions).flatMap(session => session.actions)
    .every(action => action.reviewStatus === 'approved')).toBe(true);
  await finishSavedScreen(page);
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);

  await approvePendingPlan(page);
  await page.getByRole('button', { name: '开始今天训练' }).click();
  await answerSafeReadiness(page);
  await page.getByRole('button', { name: '检查今天状态' }).click();
  await page.getByRole('button', { name: '按原计划继续' }).click();
  await page.getByRole('button', { name: '开始本节', exact: true }).click();
  await expect(page.locator('#guideBody .guide-action')).toHaveCount(1);
  await expect(page.locator('#guideBody img,#guideBody picture,#guideBody video,#guideBody source')).toHaveCount(1);
  await expect(page.locator('#guideBody .guide-media-blocked')).toHaveCount(0);
  await expect(page.locator('#guideBody img').first()).toHaveAttribute('src', /assets\/exercises\/.+\.gif$/);

  await completeGuideActions(page);
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(Object.values(state.logs)).toHaveLength(1);
  expect(Object.values(state.logs)[0].status).toBe('completed');
  expect(legacyGifRequests).toEqual([]);

  await page.reload();
  await expect(page.locator('#todayCard')).toContainText('已完成 1/');
  await expect(page.getByRole('button', { name: '开始今天训练' })).toBeVisible();
});

test('居家缺少弹力带时原子受限，不生成或开放训练计划', async ({ page }) => {
  await completeOnboarding(page, {
    setting: 'home',
    equipment: ['stable_chair', 'exercise_mat', 'wall'],
    allowSettingSwap: 'no'
  });
  await expect(page.locator('.cap-result')).toContainText('需要人工复核');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.plan).toBeNull();
  await finishSavedScreen(page);
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
});

test('stop用户计划数严格为0，刷新后仍阻断', async ({ page }) => {
  await completeOnboarding(page, { chestSymptoms: 'yes' });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(before.risk.level).toBe('stop');
  expect(before.plan).toBeNull();
  await finishSavedScreen(page);
  await page.reload();
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
  await expect(page.locator('#todayCard')).toContainText(/不开放自动训练|重新完成筛查/);
  await expect(page.locator('.plan-explanation')).toHaveCount(0);
});

test('年龄边界：15岁人工审核，17岁按规则生成且无激进减重话术', async ({ page }) => {
  await completeOnboarding(page, { age: 15 });
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.risk.level).toBe('manual_review');
  expect(state.plan).toBeNull();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); location.reload(); });
  await page.waitForLoadState('load');

  await completeOnboarding(page, { age: 17 });
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.risk.level).toBe('normal');
  expect(state.plan?.status).toBe('pending_review');
  expect(state.plan?.weeks).toHaveLength(4);
  await expect(page.locator('body')).not.toContainText(/极速减脂|激进减重|快速瘦身/);
});

test('修改健康答案立即使旧计划失效且刷新后训练入口不恢复', async ({ page }) => {
  await completeOnboarding(page);
  await finishSavedScreen(page);
  await approvePendingPlan(page);
  await expect(page.getByRole('button', { name: '开始今天训练' })).toBeVisible();

  await openAndFill(page, { chestSymptoms: 'yes' });
  await page.getByRole('button', { name: /确认并保存结果/ }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.intakeRevision).toBe(2);
  expect(state.risk.level).toBe('stop');
  expect(state.plan?.status).toBe('stale');
  expect(state.plan?.staleReason).toBe('intake_changed');
  await finishSavedScreen(page);
  await page.reload();
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
});

test('重复确认不会重复增加intake revision或绕过能力校准提前生成计划', async ({ page }) => {
  await openAndFill(page);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => /确认并保存结果/.test(node.textContent));
    button.click();
    button.click();
  });
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.intakeRevision).toBe(1);
  expect(state.capabilityRevision).toBe(0);
  expect(state.plan).toBeNull();
});

test('390×844 Exact10训练、音乐区、停止按钮和固定操作区不重叠', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await completeOnboarding(page);
  await finishSavedScreen(page);
  await approvePendingPlan(page);
  await page.getByRole('button', { name: '开始今天训练' }).click();
  await answerSafeReadiness(page);
  await page.getByRole('button', { name: '检查今天状态' }).click();
  await page.getByRole('button', { name: '按原计划继续' }).click();
  await page.getByRole('button', { name: '开始本节', exact: true }).click();
  const layout = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const music = box('#musicDock');
    const footer = box('.guide-foot');
    const stop = box('.guide-stop');
    const next = box('#guideNext');
    const media = box('#guideBody .guide-demo');
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      musicFooterOverlap: overlaps(music, footer),
      stopNextOverlap: overlaps(stop, next),
      stopInsideFooter: stop.left >= footer.left && stop.right <= footer.right
        && stop.top >= footer.top && stop.bottom <= footer.bottom,
      mediaWidth: media.width,
      mediaInside: media.left >= 0 && media.right <= innerWidth
    };
  });
  expect(layout).toEqual({
    noHorizontalOverflow: true,
    musicFooterOverlap: false,
    stopNextOverlap: false,
    stopInsideFooter: true,
    mediaWidth: expect.any(Number),
    mediaInside: true
  });
  expect(layout.mediaWidth).toBeGreaterThan(0);
  await page.locator('.guide-stop').click();
  await expect(page.getByRole('heading', { name: '选择最符合当前情况的一项' })).toBeVisible();
});
