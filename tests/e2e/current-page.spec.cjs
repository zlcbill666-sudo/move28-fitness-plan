const { test, expect } = require('@playwright/test');

const APP_ORIGIN = 'http://127.0.0.1:8765';
const TRACKER_KEY = 'move28-tracker-v1';
const runtimeGuards = new WeakMap();

const DAY_ONE_TITLES = [
  '先确认今天适合训练',
  '坐姿抬腿',
  '脚踝绕环',
  '椭圆机／交叉训练机',
  '坐姿腿举',
  '坐姿腿弯举',
  '臀桥',
  '推胸机',
  '坐姿划船',
  '抗旋转推压',
  '椭圆机／交叉训练机',
  '平地慢走',
  '大腿后侧拉伸',
  '小腿拉伸',
  '完成今天'
];

function isExplainableClientMediaAbort(request, errorText) {
  const pathname = new URL(request.url()).pathname;
  const isMedia = request.resourceType() === 'media' || /\.(?:mp3|m4a|ogg|wav|mp4|webm)$/i.test(pathname);
  return isMedia && /net::ERR_ABORTED/i.test(errorText);
}

async function openCurrentPage(page) {
  await page.goto('/index.html');
  await expect(page.locator('#todayCard')).toContainText('力量A');
}

test.beforeEach(async ({ page }) => {
  const issues = [];
  const handlers = {
    console: message => {
      if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    },
    pageerror: error => issues.push(`pageerror: ${error.message}`),
    response: response => {
      const url = new URL(response.url());
      if (url.origin === APP_ORIGIN && response.status() >= 400) {
        issues.push(`http ${response.status()}: ${response.url()}`);
      }
    },
    requestfailed: request => {
      const errorText = request.failure()?.errorText || 'unknown failure';
      if (!isExplainableClientMediaAbort(request, errorText)) {
        issues.push(`requestfailed ${errorText}: ${request.url()}`);
      }
    }
  };

  for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
  runtimeGuards.set(page, { issues, handlers });
  await page.addInitScript(() => localStorage.clear());
});

test.afterEach(async ({ page }) => {
  const guard = runtimeGuards.get(page);
  if (!guard) return;

  await page.waitForTimeout(50).catch(() => {});
  for (const [event, handler] of Object.entries(guard.handlers)) page.off(event, handler);
  runtimeGuards.delete(page);

  expect(guard.issues, '页面全流程不应出现运行时、同源HTTP或非预期资源错误').toEqual([]);
});

test('当前页面加载完整且关键样式生效', async ({ page }) => {
  await openCurrentPage(page);
  await page.waitForLoadState('networkidle');

  const styles = await page.evaluate(() => ({
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    safetyDisplay: getComputedStyle(document.querySelector('.safety-grid')).display,
    safetyCardRadius: getComputedStyle(document.querySelector('.safety-card')).borderRadius,
    guidePosition: getComputedStyle(document.querySelector('.guide-modal')).position,
    guideDisplay: getComputedStyle(document.querySelector('.guide-modal')).display
  }));
  expect(styles).toEqual({
    bodyBackground: 'rgb(9, 12, 18)',
    safetyDisplay: 'grid',
    safetyCardRadius: '17px',
    guidePosition: 'fixed',
    guideDisplay: 'none'
  });
});

test('四周计划和安全区保持完整行为基线', async ({ page }) => {
  await openCurrentPage(page);

  const weekTabs = page.locator('#weekTabs .tab');
  await expect(weekTabs).toHaveCount(4);
  await expect(weekTabs).toHaveText(['第1周', '第2周', '第3周', '第4周']);

  const dayCards = page.locator('#weekView .day-card');
  const dayNumbers = page.locator('#weekView .day-card .num');
  await expect(dayCards).toHaveCount(7);
  for (const card of await dayCards.all()) await expect(card).toBeVisible();
  await expect(dayNumbers).toHaveText(['1', '2', '3', '4', '5', '6', '7']);
  await expect(dayCards.first()).toHaveCSS('border-radius', '18px');

  await page.getByRole('button', { name: '第2周', exact: true }).click();
  await expect(dayCards).toHaveCount(7);
  await expect(dayNumbers).toHaveText(['8', '9', '10', '11', '12', '13', '14']);

  const safetyCards = page.locator('#safetyGrid .safety-card');
  await expect(safetyCards).toHaveCount(8);
  await expect(safetyCards.locator('h3')).toHaveText([
    '训练前',
    '强度',
    '呼吸',
    '肩部',
    '重量选择',
    '增加重量',
    '停止信号',
    '训练时间'
  ]);
});

test('动作库中的17个GIF资料均存在并成功加载', async ({ page }) => {
  await openCurrentPage(page);
  const gifs = page.locator('#exerciseGrid img');
  await expect(gifs).toHaveCount(17);
  await expect.poll(async () => gifs.evaluateAll(images =>
    images.filter(image => image.complete && image.naturalWidth > 0).length
  )).toBe(17);
});

test('第1天跟练固定为15步13个动作并在结束后自动记录', async ({ page }) => {
  await openCurrentPage(page);
  await page.getByRole('button', { name: '一步一步带我练' }).click();

  const modal = page.locator('#guideModal');
  const eyebrow = page.locator('#guideEyebrow');
  const body = page.locator('#guideBody');
  const actions = body.locator('.guide-action');
  const demoGifs = body.locator('.guide-demo img');
  const nextButton = page.locator('#guideNext');
  await expect(modal).toHaveAttribute('aria-hidden', 'false');
  await expect(modal).toHaveCSS('display', 'flex');
  await expect(eyebrow).toHaveText('STEP 1 / 15');

  const titles = [];
  let actionSteps = 0;
  for (let step = 1; step <= 15; step += 1) {
    await expect(eyebrow).toHaveText(`STEP ${step} / 15`);
    titles.push((await body.locator('h3').textContent()).trim());

    const expectedActionCount = step > 1 && step < 15 ? 1 : 0;
    await expect(actions).toHaveCount(expectedActionCount);
    await expect(demoGifs).toHaveCount(expectedActionCount);
    actionSteps += expectedActionCount;

    if (step < 15) await nextButton.click();
  }

  expect(titles).toEqual(DAY_ONE_TITLES);
  expect(actionSteps).toBe(13);
  await expect(nextButton).toHaveText('完成训练并自动记录 ✓');
  await nextButton.click();

  await expect(modal).toHaveAttribute('aria-hidden', 'true');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), TRACKER_KEY);
  expect(saved['1']['完成状态']).toBe('已完成');
  await expect(page.getByRole('button', { name: '已完成', exact: true })).toHaveClass(/active/);
});

test('关闭跟练弹窗后音频停止', async ({ page }) => {
  await openCurrentPage(page);
  await page.getByRole('button', { name: '一步一步带我练' }).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden', 'false');

  const audio = page.locator('#workoutAudio');
  if (await audio.evaluate(element => element.paused)) {
    await page.locator('#musicToggle').click();
  }
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(false);

  await page.getByRole('button', { name: '退出跟练' }).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => audio.evaluate(element => element.paused)).toBe(true);
});

test('390×844视口没有横向溢出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '仅在390×844移动端项目验证');
  await openCurrentPage(page);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }));

  expect(dimensions.viewportWidth).toBe(390);
  expect(dimensions.viewportHeight).toBe(844);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test('本地记录能够保存并通过二次确认清除', async ({ page }) => {
  await openCurrentPage(page);
  await page.getByRole('button', { name: '已完成', exact: true }).click();
  await page.locator('[data-label="有氧(分钟)"]').fill('20');
  await page.locator('#saveBtn').click();

  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), TRACKER_KEY))
    .not.toBeNull();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), TRACKER_KEY);
  expect(saved['1']['完成状态']).toBe('已完成');
  expect(saved['1']['有氧(分钟)']).toBe('20');

  await page.locator('#clearBtn').click();
  await expect(page.locator('#clearBtn')).toHaveText('再点一次确认');
  await page.locator('#clearBtn').click();

  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), TRACKER_KEY))
    .toEqual({});
  await expect(page.getByRole('button', { name: '未填写', exact: true })).toHaveClass(/active/);
});
