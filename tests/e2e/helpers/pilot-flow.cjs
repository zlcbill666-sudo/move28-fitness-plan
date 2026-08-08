'use strict';

const gymEquipment = [
  'stable_chair', 'exercise_mat', 'leg_press_machine', 'leg_curl_machine',
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

async function resetHttp(page) {
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

async function completeOnboarding(page, overrides = {}) {
  await page.getByRole('button', { name: /生成我的4周计划|重新填写问卷|重新完成安全筛查/ }).first().click();
  await page.evaluate(data => {
    for (const [key, value] of Object.entries(data)) {
      window.Move28.onboardingController.setField(key, value);
    }
    window.Move28.onboardingController.goTo(9);
  }, { ...safeIntake, ...overrides });
  await page.locator('input[name="finalConfirmed"]').check();
  await page.getByRole('button', { name: /确认并保存结果/ }).click();
}

async function approvePendingPlan(page) {
  await page.evaluate(() => {
    const key = 'move28-pilot-v1';
    const state = JSON.parse(localStorage.getItem(key));
    if (!state?.plan || state.plan.status !== 'pending_review') throw new Error('NO_PENDING_PLAN');
    state.plan.status = 'active';
    state.plan.review = {
      status: 'approved',
      reviewerId: 'pilot-reviewer',
      reviewedAt: '2030-01-02T03:04:05.000Z',
      planId: state.plan.id,
      intakeRevision: state.intakeRevision
    };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
}

module.exports = { gymEquipment, safeIntake, resetHttp, completeOnboarding, approvePendingPlan };
