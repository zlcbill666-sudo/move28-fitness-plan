const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const INDEX_FILE_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;
const runtimeGuards = new WeakMap();

function isExplainableClientMediaAbort(request, errorText) {
  const pathname = new URL(request.url()).pathname;
  const isMedia = request.resourceType() === 'media' || /\.(?:mp3|m4a|ogg|wav|mp4|webm)$/i.test(pathname);
  return isMedia && /net::ERR_ABORTED/i.test(errorText);
}

test.beforeEach(async ({ page }) => {
  const issues = [];
  const handlers = {
    console: message => {
      if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    },
    pageerror: error => issues.push(`pageerror: ${error.message}`),
    requestfailed: request => {
      const errorText = request.failure()?.errorText || 'unknown failure';
      if (!isExplainableClientMediaAbort(request, errorText)) {
        issues.push(`requestfailed ${errorText}: ${request.url()}`);
      }
    }
  };

  for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
  runtimeGuards.set(page, { issues, handlers });
});

test.afterEach(async ({ page }) => {
  const guard = runtimeGuards.get(page);
  if (!guard) return;

  await page.waitForTimeout(50).catch(() => {});
  for (const [event, handler] of Object.entries(guard.handlers)) page.off(event, handler);
  runtimeGuards.delete(page);

  expect(guard.issues, 'file:// 页面不应出现脚本、控制台或资源加载错误').toEqual([]);
});

test('双击打开时首屏、GIF和跟练入口均可离线使用', async ({ page }) => {
  await page.goto(INDEX_FILE_URL);
  await expect(page.locator('#todayCard')).toContainText('力量A');

  expect(await page.locator('script[src]').evaluateAll(scripts =>
    scripts.map(script => script.getAttribute('src'))
  )).toEqual([
    'src/namespace.js',
    'src/data/exercise-catalog.js',
    'src/data/legacy-demo-plan.js',
    'src/data/tracker-fields.js',
    'src/ui/dashboard.js',
    'src/ui/workout-guide.js',
    'src/app.js'
  ]);

  const gifs = page.locator('#exerciseGrid img');
  await expect(gifs).toHaveCount(17);
  await expect.poll(async () => gifs.evaluateAll(images =>
    images.filter(image => image.complete && image.naturalWidth > 0).length
  )).toBe(17);

  expect(await page.evaluate(() => ({
    namespace: typeof window.Move28,
    sharedState: typeof window.Move28?.state,
    openGuide: typeof window.openGuide,
    uiRenderToday: typeof window.Move28?.ui?.renderToday,
    renderToday: typeof window.renderToday,
    dashboardProxies: ['moveDay', 'pickWeek', 'pickExercise', 'setStatus', 'selectTrackDay', 'openTrack']
      .map(name => typeof window[name]),
    exerciseCatalogCount: window.Move28?.data?.exerciseCatalog?.length,
    validateExerciseCatalog: typeof window.Move28?.data?.validateExerciseCatalog,
    approvedExerciseCount: window.Move28?.data?.getApprovedExercises?.().length,
    legacyTrackerHeaders: typeof window.Move28?.data?.legacyDemoPlan?.trackerHeaders,
    trackerFieldCount: window.Move28?.data?.trackerFields?.length
  }))).toEqual({
    namespace: 'object',
    sharedState: 'object',
    openGuide: 'function',
    uiRenderToday: 'function',
    renderToday: 'undefined',
    dashboardProxies: Array(6).fill('function'),
    exerciseCatalogCount: 17,
    validateExerciseCatalog: 'function',
    approvedExerciseCount: 17,
    legacyTrackerHeaders: 'undefined',
    trackerFieldCount: 25
  });

  await page.getByRole('button', { name: '一步一步带我练' }).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#guideEyebrow')).toHaveText('STEP 1 / 15');
  await expect(page.locator('#guideBody h3')).toHaveText('先确认今天适合训练');
});
