'use strict';

const gymEquipment = [
  'stable_chair', 'exercise_mat', 'smith_machine', 'leg_press_machine', 'leg_curl_machine',
  'chest_press_machine', 'seated_row_machine', 'resistance_band',
  'cable_machine', 'elliptical_trainer', 'treadmill'
];

const safeIntake = Object.freeze({
  boundaryAccepted: true,
  age: 30,
  pregnancyPostpartum: 'no',
  goal: 'habit',
  activityDays: '3',
  walkCapacity: '20_40',
  strengthExperience: 'some',
  trainingBreak: 'no',
  daysPerWeek: '2',
  sessionMinutes: '30',
  weekdays: ['mon', 'thu'],
  gymOftenUnavailable: 'no',
  setting: 'gym',
  equipment: gymEquipment,
  allowSettingSwap: 'no',
  painAreas: ['none'],
  painTrend: 'none',
  acuteInjury: 'no',
  unableToBearWeight: 'no',
  visibleSwelling: 'no',
  dailyActivityLimited: 'no',
  chairStand: 'yes',
  walkTenMinutes: 'yes',
  chestSymptoms: 'no',
  exertionalDizziness: 'no',
  unexplainedFainting: 'no',
  restingShortnessOfBreath: 'no',
  unresolvedConcussion: 'no',
  doctorRestriction: 'none',
  recentSurgery: 'no',
  complexCondition: 'no',
  uncontrolledBloodPressure: 'no',
  cardioPreference: 'none',
  cardioAvoid: 'none',
  avoidMovements: [],
  avoidEquipment: [],
  trackingItems: ['completion', 'rpe', 'pain', 'sleep'],
  sessionPreference: 'short_frequent',
  musicEnabled: 'no'
});

const safeCapability = Object.freeze({
  chairRise: 'independent_controlled',
  wallHinge: 'controlled',
  wallPushup: 'controlled',
  floorAccess: 'comfortable',
  walkTolerance: 'comfortable'
});

const safeReadiness = Object.freeze({
  time: 'full',
  equipment: 'unchanged',
  space: 'normal',
  noise: 'normal',
  energy: 'normal',
  symptom: 'none'
});

async function answerSafeReadiness(page, overrides = {}) {
  const answers = { ...safeReadiness, ...overrides };
  const form = page.locator('#sessionReadinessView[aria-hidden="false"] .readiness-form');
  await form.waitFor({ state: 'visible' });
  for (const [field, value] of Object.entries(answers)) {
    await form.locator(`select[name="${field}"]`).selectOption(value);
  }
}

async function installMonotonicClock(page, initialMs = 1000) {
  if (page.__move28MonotonicClockInstalled) return;
  page.__move28MonotonicClockInstalled = true;
  await page.addInitScript(value => {
    let nowMs = value;
    Object.defineProperty(performance, 'now', { configurable: true, value: () => nowMs });
    Object.defineProperty(window, '__move28AdvanceMonotonicClock', {
      configurable: true,
      value(deltaMs) {
        if (!Number.isFinite(deltaMs)) throw new TypeError('INVALID_MONOTONIC_DELTA');
        nowMs += deltaMs;
        return nowMs;
      }
    });
  }, initialMs);
}

async function advanceMonotonicClock(page, deltaMs) {
  return page.evaluate(value => window.__move28AdvanceMonotonicClock(value), deltaMs);
}

async function advanceGuideToReviewedDuration(page) {
  const durationMs = await page.evaluate(() => {
    const state = window.Move28.storage.loadState();
    const sessionId = window.Move28.state.guideSession?.id;
    for (const week of state.plan?.weeks || []) {
      const session = week.sessions?.find(item => item.id === sessionId);
      if (session) return session.estimatedMinutes * 60000;
    }
    throw new Error('GUIDE_SESSION_NOT_REVIEWED');
  });
  return advanceMonotonicClock(page, durationMs);
}

async function completeGuideActions(page) {
  const actionCount = await page.evaluate(() => window.Move28.state.guideSteps.length);
  for (let index = 0; index < actionCount; index += 1) {
    if (index === actionCount - 1) await advanceGuideToReviewedDuration(page);
    await page.locator('#guideNext').click();
  }
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => Boolean(
    window.Move28
      && window.Move28.storage
      && window.Move28.onboardingController
      && window.Move28.capabilityController
      && window.Move28.domain
      && window.Move28.ui
  ));
}

async function resetHttp(page) {
  await installMonotonicClock(page);
  await page.goto('/index.html');
  await waitForAppReady(page);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await waitForAppReady(page);
}

async function completeCapability(page, overrides = {}) {
  await waitForAppReady(page);
  await page.locator('#capabilityAssessmentView[aria-hidden="false"]').waitFor();
  await page.evaluate(data => {
    for (const [key, value] of Object.entries(data)) window.Move28.capabilityController.setField(key, value);
    window.Move28.capabilityController.goTo(2);
  }, { ...safeCapability, ...overrides });
  await page.getByRole('button', { name: /确认并保存能力档案/ }).click();
}

async function completeOnboarding(page, overrides = {}, capabilityOverrides = {}) {
  await waitForAppReady(page);
  await page.getByRole('button', { name: /生成我的4周计划|重新填写问卷|重新完成安全筛查/ }).first().click();
  await page.evaluate(data => {
    for (const [key, value] of Object.entries(data)) {
      window.Move28.onboardingController.setField(key, value);
    }
    window.Move28.onboardingController.goTo(9);
  }, { ...safeIntake, ...overrides });
  await page.locator('input[name="finalConfirmed"]').check();
  await page.getByRole('button', { name: /确认并保存结果/ }).click();
  const needsCapability = await page.evaluate(() => ['normal','conservative'].includes(window.Move28.storage.loadState()?.risk?.level));
  if (needsCapability) await completeCapability(page, capabilityOverrides);
}

async function approvePendingPlan(page) {
  await page.evaluate(() => {
    const state = window.Move28.storage.loadState();
    if (!state?.plan || state.plan.status !== 'pending_review') throw new Error('NO_PENDING_PLAN');
    window.Move28.storage.approvePlanReview({
      reviewerId: 'pilot-reviewer',
      planId: state.plan.id,
      intakeRevision: state.intakeRevision
    });
  });
  await page.reload();
}

module.exports = { gymEquipment, safeIntake, safeCapability, safeReadiness, waitForAppReady, answerSafeReadiness, installMonotonicClock, advanceMonotonicClock, advanceGuideToReviewedDuration, completeGuideActions, resetHttp, completeCapability, completeOnboarding, approvePendingPlan };
