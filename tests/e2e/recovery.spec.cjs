'use strict';

const { test, expect } = require('@playwright/test');
const { resetHttp, safeIntake, completeCapability, completeOnboarding, approvePendingPlan } = require('./helpers/pilot-flow.cjs');

async function openFilledConfirmation(page) {
  await page.getByRole('button', { name: /生成我的4周计划/ }).click();
  await page.evaluate(data => {
    for (const [key, value] of Object.entries(data)) window.Move28.onboardingController.setField(key, value);
    window.Move28.onboardingController.goTo(9);
  }, safeIntake);
  await page.locator('input[name="finalConfirmed"]').check();
}

async function confirm(page) {
  await page.getByRole('button', { name: /确认并保存结果/ }).click();
}

for (const corruption of [
  { name: '非法JSON', value: '{broken-json' },
  { name: '缺少schema', value: JSON.stringify({ intake: { age: 30 } }) },
  { name: '未来schema', value: JSON.stringify({ schemaVersion: 999, intake: { age: 30 } }) }
]) {
  test(`损坏主状态${corruption.name}时不覆盖原字节且明确保存失败`, async ({ page }) => {
    await resetHttp(page);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: 'move28-pilot-v1', value: corruption.value });
    await page.reload();
    await expect(page.locator('#todayCard')).toContainText('示例计划');
    await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
    await openFilledConfirmation(page);
    await confirm(page);
    await expect(page.locator('.ob-saved')).toContainText('本机保存失败');
    expect(await page.evaluate(() => localStorage.getItem('move28-pilot-v1'))).toBe(corruption.value);
  });
}

test('localStorage读写删除均抛错时只读示例可用，最终保存固定失败', async ({ page }) => {
  const issues = [];
  page.on('pageerror', error => issues.push(error.message));
  await page.addInitScript(() => {
    const original = {
      getItem: Storage.prototype.getItem,
      setItem: Storage.prototype.setItem,
      removeItem: Storage.prototype.removeItem
    };
    window.__move28StorageOriginal = original;
    for (const method of Object.keys(original)) {
      Storage.prototype[method] = function (...args) {
        if (this === localStorage) throw new Error(`BLOCKED_${method}`);
        return original[method].apply(this, args);
      };
    }
  });
  await page.goto('/index.html');
  await expect(page.locator('#todayCard')).toContainText('示例计划');
  await expect(page.getByRole('button', { name: '开始今天训练' })).toHaveCount(0);
  await openFilledConfirmation(page);
  await confirm(page);
  await expect(page.locator('.ob-saved')).toContainText('本机保存失败');
  expect(issues).toEqual([]);
});

test('sessionStorage不可用不改变安全结论，最终档案仍可持久保存', async ({ page }) => {
  const issues = [];
  page.on('pageerror', error => issues.push(error.message));
  await page.addInitScript(() => {
    const original = {
      getItem: Storage.prototype.getItem,
      setItem: Storage.prototype.setItem,
      removeItem: Storage.prototype.removeItem
    };
    for (const method of Object.keys(original)) {
      Storage.prototype[method] = function (...args) {
        if (this === sessionStorage) throw new Error(`BLOCKED_SESSION_${method}`);
        return original[method].apply(this, args);
      };
    }
  });
  await page.goto('/index.html');
  await openFilledConfirmation(page);
  await confirm(page);
  await expect(page.locator('.ob-saved')).toContainText('请完成能力校准');
  await completeCapability(page);
  await expect(page.locator('.cap-result')).toContainText('已保存到本机');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.risk.level).toBe('normal');
  expect(state.capabilityRevision).toBe(1);
  expect(state.plan.status).toBe('pending_review');
  expect(issues).toEqual([]);
});

test('损坏旧偏好键会归一化，不产生NaN、非法音量或非对象tracker', async ({ page }) => {
  await resetHttp(page);
  await page.evaluate(() => {
    localStorage.setItem('move28-current-day', 'not-a-day');
    localStorage.setItem('move28-music-volume', '999');
    localStorage.setItem('move28-music-enabled', 'unknown');
    localStorage.setItem('move28-tracker-v1', '[]');
  });
  await page.reload();
  expect(await page.evaluate(() => ({
    currentDay: Move28.state.currentDay,
    musicVolume: Move28.state.musicVolume,
    musicEnabled: Move28.state.musicEnabled,
    trackerIsRecord: Move28.state.tracker && typeof Move28.state.tracker === 'object' && !Array.isArray(Move28.state.tracker)
  }))).toEqual({ currentDay: 1, musicVolume: 0.32, musicEnabled: true, trackerIsRecord: true });
  await expect(page.locator('#todayCard')).toContainText('第1周');
});

test('tracker与音乐偏好写入失败只显示固定降级提示，不破坏训练安全入口', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await resetHttp(page);
  await completeOnboarding(page);
  await page.getByRole('button', { name: '完成，返回首页' }).click();
  await approvePendingPlan(page);
  await page.evaluate(() => {
    window.__move28OriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (['move28-tracker-v1', 'move28-music-enabled', 'move28-music-volume'].includes(key)) throw new Error('BLOCKED_PREFERENCE_WRITE');
      return window.__move28OriginalSetItem.call(this, key, value);
    };
  });

  expect(await page.evaluate(() => window.Move28.ui.saveTrack())).toBe(false);
  await expect(page.locator('#toast')).toContainText('本机保存失败');
  await expect(page.locator('#saveBtn')).toHaveText('保存今天 ✓');
  expect(await page.evaluate(() => localStorage.getItem('move28-tracker-v1'))).toBeNull();

  await page.getByRole('button', { name: '开始今天训练' }).click();
  await page.getByRole('button', { name: '检查今天状态' }).click();
  await page.getByRole('button', { name: '按原计划继续' }).click();
  await page.getByRole('button', { name: '开始本节', exact: true }).click();
  await page.locator('#musicToggle').click();
  await expect(page.locator('#toast')).toContainText('音乐偏好未能保存');
  await page.locator('#musicVolume').evaluate(input => {
    input.value = '70';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.guide-stop').click();
  await expect(page.getByText('选择最符合当前情况的一项')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('损坏草稿和伪造step 9均被丢弃，不能跳过第0步', async ({ page }) => {
  await resetHttp(page);
  await page.evaluate(() => {
    sessionStorage.setItem('move28-onboarding-draft-v1', JSON.stringify({
      schemaVersion: 1,
      step: 9,
      intake: { finalConfirmed: true, chestSymptoms: 'no' }
    }));
  });
  await page.reload();
  await page.getByRole('button', { name: /生成我的4周计划/ }).click();
  await expect(page.getByRole('heading', { name: '先确认这项服务适合你' })).toBeVisible();
  expect(await page.evaluate(() => window.Move28.onboardingController.getState().step)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('move28-pilot-v1'))).toBeNull();
});
