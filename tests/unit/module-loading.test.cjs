const assert = require('node:assert/strict');
const test = require('node:test');
const { modules, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

test('all static modules load through CommonJS with useful exports', async (t) => {
  await t.test('namespace exports the shared application shape', () => {
    clearMove28ModuleCache();
    const api = require(modules.namespace);
    assert.ok(api.state);
    assert.ok(api.utils);
    assert.ok(api.data);
    assert.ok(api.ui);
    assert.ok(api.guide);
  });

  await t.test('legacy plan exports the unchanged 4-week, 28-day, 17-exercise catalog', () => {
    clearMove28ModuleCache();
    const { legacyDemoPlan } = require(modules.legacyPlan);
    assert.equal(legacyDemoPlan.weeks.length, 4);
    assert.equal(legacyDemoPlan.days.length, 28);
    assert.equal(legacyDemoPlan.exercises.length, 17);
  });

  await t.test('exercise catalog exports validated browser-independent APIs', () => {
    clearMove28ModuleCache();
    const api = require(modules.exerciseCatalog);
    assert.equal(api.exerciseCatalog.length, 17);
    assert.deepEqual(api.validateExerciseCatalog(api.exerciseCatalog), []);
    assert.deepEqual(api.getApprovedExercises(), api.exerciseCatalog);
    assert.ok(Array.isArray(api.EQUIPMENT_IDS) && api.EQUIPMENT_IDS.includes('stable_chair'));
    assert.deepEqual(api.EXCLUSION_TAGS, ['deep_knee_bend','overhead','floor','single_leg','hinge']);
    assert.deepEqual(api.DOSE_KEYS, ['sets', 'reps', 'rpe', 'restSec', 'durationMin', 'holdSec']);
  });

  await t.test('movement matcher exports deterministic finite mapping APIs', () => {
    clearMove28ModuleCache();
    const api = require(modules.movementMatcher);
    assert.equal(typeof api.matchExercise, 'function');
    assert.equal(typeof api.swapSessionSetting, 'function');
    assert.deepEqual(api.MOVEMENT_INTENTS, ['knee_dominant','posterior_chain','horizontal_push','horizontal_pull','core_stability','low_impact_cardio']);
  });

  await t.test('plan validator exports the hard-gate API', () => {
    clearMove28ModuleCache();
    const api = require(modules.planValidator);
    assert.equal(typeof api.validatePlan, 'function');
    assert.equal(api.RULE_VERSION, 'pilot-v2');
  });

  await t.test('plan generator exports deterministic four-week planning APIs', () => {
    clearMove28ModuleCache();
    const api = require(modules.planGenerator);
    assert.equal(typeof api.generatePlan, 'function');
    assert.equal(api.RULE_VERSION, 'pilot-v2');
    assert.deepEqual(api.STRENGTH_PATTERNS, ['knee_dominant','posterior_chain','horizontal_push','horizontal_pull','core_stability']);
  });

  await t.test('weekly adaptation exports deterministic single-variable API', () => {
    clearMove28ModuleCache();
    const api = require(modules.weeklyAdaptation);
    assert.equal(typeof api.proposeWeeklyChange, 'function');
    assert.equal(api.REVIEW_VERSION, 1);
  });

  await t.test('risk engine exports deterministic browser-independent APIs', () => {
    clearMove28ModuleCache();
    const api = require(modules.riskEngine);
    assert.equal(typeof api.evaluateRisk, 'function');
    assert.equal(api.RULE_VERSION, 'pilot-v2');
    assert.deepEqual(api.RISK_LEVELS, ['normal', 'conservative', 'manual_review', 'stop']);
    assert.equal(api.evaluateRisk({ age: 17, redFlags: false }).level, 'normal');
  });

  await t.test('capability engine exports its deterministic browser-independent API', () => {
    clearMove28ModuleCache();
    const api = require(modules.capabilityEngine);
    assert.equal(typeof api.evaluateCapabilityProfile, 'function');
    assert.deepEqual(Object.keys(api), ['evaluateCapabilityProfile']);
  });

  await t.test('local store exports versioned browser-independent APIs', () => {
    clearMove28ModuleCache();
    const api = require(modules.localStore);
    assert.equal(typeof api.createLocalStore, 'function');
    assert.equal(typeof api.loadState, 'function');
    assert.equal(typeof api.saveIntake, 'function');
    assert.equal(typeof api.saveCapabilityProfileWithPlan, 'function');
    assert.equal(typeof api.savePlan, 'function');
    assert.equal(typeof api.recordWeeklyReview, 'function');
    assert.equal(typeof api.resolveWeeklyReview, 'function');
    assert.equal(typeof api.clearAll, 'function');
    assert.equal(typeof api.exportReviewSummary, 'function');
    assert.equal(api.STORAGE_KEY, 'move28-pilot-v1');
    assert.equal(api.SCHEMA_VERSION, 1);
    assert.equal(api.CONSENT_VERSION, 'pilot-v1');
  });

  await t.test('tracker fields export all 25 fields', () => {
    clearMove28ModuleCache();
    const { trackerFields } = require(modules.trackerFields);
    assert.equal(trackerFields.length, 25);
  });

  await t.test('dashboard exports callable UI APIs without a DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.dashboard);
    assert.equal(typeof api.renderToday, 'function');
    assert.equal(typeof api.renderOverview, 'function');
    assert.equal(typeof api.openTrack, 'function');
  });

  await t.test('workout guide exports callable guide APIs without a DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.workoutGuide);
    assert.equal(typeof api.buildWorkoutSteps, 'function');
    assert.equal(typeof api.renderGuide, 'function');
    assert.equal(typeof api.openWorkout, 'function');
  });

  await t.test('onboarding exports pure guided-intake APIs without a DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.onboarding);
    assert.equal(typeof api.createOnboarding, 'function');
    assert.equal(typeof api.validateStep, 'function');
    assert.equal(typeof api.deriveRiskIntake, 'function');
    assert.equal(api.STEPS.length, 10);
    assert.equal(api.DRAFT_KEY, 'move28-onboarding-draft-v1');
  });

  await t.test('capability assessment exports finite three-screen APIs without a DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.capabilityAssessment);
    assert.equal(typeof api.createCapabilityAssessment, 'function');
    assert.equal(typeof api.validateStep, 'function');
    assert.equal(api.STEPS.length, 3);
    assert.equal(api.DRAFT_KEY, 'move28-capability-draft-v1');
  });

  await t.test('weekly review exports controller API without a DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.weeklyReview);
    assert.equal(typeof api.createWeeklyReview, 'function');
  });

  await t.test('privacy tools export local-only controls without a DOM',()=>{
    clearMove28ModuleCache();const api=require(modules.privacyTools);
    assert.equal(typeof api.createPrivacyTools,'function');assert.equal(typeof api.downloadReviewSummary,'function');
  });

  await t.test('app exports init without initializing the DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.app);
    assert.equal(typeof api.init, 'function');
  });
});

test('先加载legacy计划再加载目录仍共享同一个缓存实例', () => {
  clearMove28ModuleCache();
  const { legacyDemoPlan } = loadScript('legacyPlan');
  const { exerciseCatalog } = loadScript('exerciseCatalog');
  const namespace = loadScript('namespace');
  assert.strictEqual(legacyDemoPlan.exercises, exerciseCatalog);
  assert.strictEqual(namespace.data.exerciseCatalog, exerciseCatalog);
});

test('risk engine 通过 helper 重复加载时共享 CommonJS 缓存实例', () => {
  clearMove28ModuleCache();
  const first = loadScript('riskEngine');
  const second = loadScript('riskEngine');
  assert.strictEqual(first, second);
});

test('capability engine 通过 helper 重复加载时共享 CommonJS 缓存实例', () => {
  clearMove28ModuleCache();
  const first = loadScript('capabilityEngine');
  const second = loadScript('capabilityEngine');
  assert.strictEqual(first, second);
});
