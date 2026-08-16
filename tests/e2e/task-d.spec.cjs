const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { resetHttp, completeOnboarding, approvePendingPlan, answerSafeReadiness } = require('./helpers/pilot-flow.cjs');
const fileUrl = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;

async function expectInsideViewport(locator, viewport) {
  const box = await locator.boundingBox();
  expect(box, 'control must have runtime geometry').not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  const hitTarget = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || element.contains(hit);
  });
  expect(hitTarget, 'control must not be covered by another surface').toBe(true);
  return box;
}

async function setupAction(page, viewport) {
  await page.setViewportSize(viewport);
  await resetHttp(page);
  await completeOnboarding(page);
  await page.getByRole('button', { name: '完成，返回首页' }).click();
  await approvePendingPlan(page);
  await page.getByRole('button', { name: '开始今天训练' }).click();
  await answerSafeReadiness(page);
  await page.getByRole('button', { name: '检查今天状态' }).click();
  await page.getByRole('button', { name: '按原计划继续' }).click();
  await page.getByRole('button', { name: '开始本节', exact: true }).click();
}

test('pending_review 完成后手机首屏显示唯一等待状态、锁定原因和真实下一步', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await resetHttp(page);
  await completeOnboarding(page);
  const completionStatus = page.locator('#capabilityAssessmentView .cap-result');
  const completionCta = page.getByRole('button', { name: '完成，返回首页' });
  await expect(completionStatus).toContainText('等待计划确认（pending_review）');
  await expect(completionStatus).toContainText('训练入口会保持关闭');
  await expect(completionStatus).toContainText('指定确认人或备用联系人');
  await expect(completionStatus).toContainText('同一台设备和同一个浏览器');
  await expectInsideViewport(completionStatus, viewport);
  await expectInsideViewport(completionCta, viewport);
  await completionCta.click();

  expect(await page.evaluate(() => Move28.storage.loadState().plan.status)).toBe('pending_review');
  const pendingHero = page.locator('.pending-review-hero');
  const pendingTitle = pendingHero.getByRole('heading', { name: /等待确认/ });
  const pendingCopy = pendingHero.locator('.hero-copy');
  const nextStep = pendingHero.locator('.hero-next-step');
  await expect(pendingHero).toHaveAttribute('data-workflow-stage', 'human_review');
  await expect(pendingTitle).toBeVisible();
  await expect(pendingCopy).toContainText('训练入口会保持关闭');
  await expect(nextStep).toContainText('指定确认人或备用联系人');
  await expect(nextStep).toContainText('同一台设备和同一个浏览器');
  const cta = page.getByRole('button', { name: '确认后刷新状态' });
  await expect(cta).toBeVisible();
  await expectInsideViewport(pendingTitle, viewport);
  await expectInsideViewport(pendingCopy, viewport);
  await expectInsideViewport(nextStep, viewport);
  await expectInsideViewport(cta, viewport);
  await expect(page.getByRole('button', { name: /生成我的4周计划/ })).toHaveCount(0);
  await expect(page.getByText('暂未生成可执行计划', { exact: true })).toHaveCount(0);
  await expect(page.getByText('当前需要确认，未生成训练计划', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
  await cta.click();
  await expect(pendingHero).toBeVisible();
  expect(await page.evaluate(() => Move28.storage.loadState().plan.status)).toBe('pending_review');
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
});

test('file:// pending_review 刷新 CTA 只重读同一浏览器本机状态', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fileUrl);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await completeOnboarding(page);
  await page.getByRole('button', { name: '完成，返回首页' }).click();
  await page.getByRole('button', { name: '确认后刷新状态' }).click();
  await page.waitForFunction(() => window.Move28?.storage?.loadState);

  expect(new URL(page.url()).protocol).toBe('file:');
  expect(await page.evaluate(() => Move28.storage.loadState().plan.status)).toBe('pending_review');
  await expect(page.locator('#pendingReviewHero')).toBeVisible();
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 }
]) {
  test(`训练动作页 ${viewport.width}x${viewport.height} 首屏同时露出主动作与安全停止`, async ({ page }) => {
    await setupAction(page, viewport);

    const stop = page.getByRole('button', { name: '暂停 / 停止训练' });
    const next = page.getByRole('button', { name: /完成此项，下一项|完成本节并记录/ });
    const close = page.locator('.guide-close');
    await expect(stop).toBeVisible();
    await expect(next).toBeVisible();
    await expect(close).toBeVisible();
    const stopBox = await expectInsideViewport(stop, viewport);
    const nextBox = await expectInsideViewport(next, viewport);
    await expectInsideViewport(close, viewport);
    expect(stopBox.y + stopBox.height <= nextBox.y || nextBox.y + nextBox.height <= stopBox.y
      || stopBox.x + stopBox.width <= nextBox.x || nextBox.x + nextBox.width <= stopBox.x).toBe(true);
    await expect(stop).toHaveAttribute('data-safety-action', 'stop');
    await expect(close).not.toHaveAttribute('data-safety-action', 'stop');

    await stop.click();
    await expect(page.getByRole('heading', { name: '选择最符合当前情况的一项' })).toBeVisible();
    expect(await page.evaluate(() => Move28.state.guideMode)).toBe('safety_select');
  });
}
