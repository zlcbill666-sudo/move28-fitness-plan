'use strict';

const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { safeIntake, completeCapability, completeOnboarding, approvePendingPlan, resetHttp, answerSafeReadiness } = require('./helpers/pilot-flow.cjs');

const projectRoot = process.env.MOVE28_OFFLINE_ROOT
  ? path.resolve(process.env.MOVE28_OFFLINE_ROOT)
  : path.resolve(__dirname, '..', '..');
const indexUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const audioFiles = [
  'assets/audio/warmup-rising-forest.mp3',
  'assets/audio/strength-deep-urban.mp3',
  'assets/audio/cardio-techno-fest-vibes.mp3',
  'assets/audio/recovery-summer-dream.mp3'
];

async function clearFileOrigin(page) {
  await page.goto(indexUrl);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
}

test.afterEach(async ({ page }) => {
  if (page.url().startsWith('file:')) {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
  }
});

test('离线资源清单包含全部本地CSS、JS、内部审计GIF和四段音乐', async () => {
  for (const relative of audioFiles) expect(fs.existsSync(path.join(projectRoot, relative)), relative).toBe(true);
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const srcPath = value => value.split(/[?#]/, 1)[0];
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => srcPath(match[1]));
  const styles = [...html.matchAll(/<link[^>]+href="([^"]+)"[^>]+stylesheet|<link[^>]+stylesheet[^>]+href="([^"]+)"/g)].map(match => srcPath(match[1] || match[2]));
  expect(scripts.length).toBeGreaterThan(0);
  expect(styles.length).toBeGreaterThan(0);
  expect(new Set(scripts).size).toBe(scripts.length);
  expect(new Set(styles).size).toBe(styles.length);
  for (const relative of [...scripts, ...styles]) expect(fs.existsSync(path.join(projectRoot, relative)), relative).toBe(true);
  const catalogPath = path.join(projectRoot, 'src', 'data', 'exercise-catalog.js');
  delete require.cache[require.resolve(catalogPath)];
  const catalog = require(catalogPath).exerciseCatalog;
  const referencedGifs = catalog.map(item => path.basename(decodeURIComponent(item.gif))).sort();
  const packagedGifs = fs.readdirSync(path.join(projectRoot, 'assets', 'gifs')).filter(name => name.endsWith('.gif')).sort();
  expect(packagedGifs).toEqual(referencedGifs);
});

test('file://完成问卷、生成、刷新、审核和25项动图跟练音乐加载', async ({ page }) => {
  const issues = [];
  const legacyGifRequests=[];page.on('request',request=>{if(request.url().includes('/assets/gifs/'))legacyGifRequests.push(request.url())});
  page.on('pageerror', error => issues.push(`pageerror:${error.message}`));
  page.on('console', message => { if (message.type() === 'error') issues.push(`console:${message.text()}`); });
  await clearFileOrigin(page);
  await completeOnboarding(page);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.plan.status).toBe('pending_review');
  const participantId = state.participantId;
  await page.reload();
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.participantId).toBe(participantId);
  expect(state.plan.status).toBe('pending_review');
  await approvePendingPlan(page);
  await page.getByRole('button', { name: '开始今天训练' }).click();
  await answerSafeReadiness(page);
  await page.getByRole('button', { name: '检查今天状态' }).click();
  await page.getByRole('button', { name: '按原计划继续' }).click();
  await page.getByRole('button', { name: '开始本节', exact: true }).click();
  await expect(page.locator('#guideBody img')).toHaveCount(1);
  await expect(page.locator('#guideBody .guide-media-blocked')).toHaveCount(0);
  const audio = page.locator('#workoutAudio');
  await expect(audio).toHaveAttribute('src', /assets\/audio\/strength-deep-urban\.mp3$/);
  await expect.poll(() => audio.evaluate(node => node.readyState)).toBeGreaterThanOrEqual(1);
  expect(await audio.evaluate(node => node.currentSrc.startsWith('file:'))).toBe(true);
  await expect(page.getByRole('button', { name: /播放音乐|暂停音乐/ })).toBeVisible();
  expect(legacyGifRequests).toEqual([]);
  expect(issues).toEqual([]);
});

test('HTTP加载完成后断网仍可本地生成；未缓存音乐失败只降级不破坏训练', async ({ page, context }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await resetHttp(page);
  await page.getByRole('button', { name: /生成我的4周计划/ }).click();
  await page.evaluate(data => {
    for (const [key, value] of Object.entries(data)) window.Move28.onboardingController.setField(key, value);
    window.Move28.onboardingController.goTo(9);
  }, safeIntake);
  await page.locator('input[name="finalConfirmed"]').check();
  await context.setOffline(true);
  await page.getByRole('button', { name: /确认并保存结果/ }).click();
  await expect(page.locator('.ob-saved')).toContainText('请完成能力校准');
  await completeCapability(page);
  await expect(page.locator('.cap-result')).toContainText('待人工复核（pending_review）');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('move28-pilot-v1')));
  expect(state.capabilityRevision).toBe(1);
  expect(state.plan.status).toBe('pending_review');

  await page.evaluate(() => {
    const saved = window.Move28.storage.loadState();
    window.Move28.storage.approvePlanReview({ reviewerId: 'pilot-reviewer', planId: saved.plan.id, intakeRevision: saved.intakeRevision });
  });
  await page.getByRole('button', { name: '完成，返回首页' }).click();
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('move28-pilot-v1'));
    window.Move28.ui.setPlanContext({ mode: 'generated', plan: saved.plan, logs: saved.logs || {} });
  });
  await page.getByRole('button', { name: '开始今天训练' }).click();
  await answerSafeReadiness(page);
  await page.getByRole('button', { name: '检查今天状态' }).click();
  await page.getByRole('button', { name: '按原计划继续' }).click();
  await page.getByRole('button', { name: '开始本节', exact: true }).click();
  await expect(page.locator('#guideBody .guide-action')).toBeVisible();
  await expect(page.locator('.guide-stop')).toBeVisible();
  await page.locator('.guide-stop').click();
  await expect(page.getByText('选择最符合当前情况的一项')).toBeVisible();
  expect(pageErrors).toEqual([]);
  await context.setOffline(false);
});
