const { test, expect } = require('@playwright/test');

const TRACKER_KEY = 'move28-tracker-v1';

async function openCurrentPage(page) {
  await page.goto('/index.html');
  await expect(page.locator('#todayCard')).toContainText('力量A');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('当前页面加载时无控制台错误或未捕获异常', async ({ page }) => {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

  await openCurrentPage(page);
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});

test('动作库中的17个GIF资料均存在并成功加载', async ({ page }) => {
  const failedGifRequests = [];
  page.on('response', response => {
    if (/\/assets\/gifs\/.*\.gif(?:$|\?)/i.test(response.url()) && !response.ok()) {
      failedGifRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await openCurrentPage(page);
  const gifs = page.locator('#exerciseGrid img');
  await expect(gifs).toHaveCount(17);
  await expect.poll(async () => gifs.evaluateAll(images =>
    images.filter(image => image.complete && image.naturalWidth > 0).length
  )).toBe(17);
  expect(failedGifRequests).toEqual([]);
});

test('第1天跟练每屏至多显示一个动作，主按钮能够推进', async ({ page }) => {
  await openCurrentPage(page);
  await page.getByRole('button', { name: '一步一步带我练' }).click();

  const modal = page.locator('#guideModal');
  await expect(modal).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#guideEyebrow')).toContainText('STEP 1 /');
  await expect(page.locator('#guideBody .guide-action')).toHaveCount(0);

  await page.locator('#guideNext').click();
  await expect(page.locator('#guideEyebrow')).toContainText('STEP 2 /');
  await expect(page.locator('#guideBody .guide-action')).toHaveCount(1);
  await expect(page.locator('#guideBody .guide-demo img')).toHaveCount(1);

  for (let step = 3; step <= 6; step += 1) {
    await page.locator('#guideNext').click();
    await expect(page.locator('#guideEyebrow')).toContainText(`STEP ${step} /`);
    await expect(page.locator('#guideBody .guide-action')).toHaveCount(1);
    await expect(page.locator('#guideBody .guide-demo img')).toHaveCount(1);
  }
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
