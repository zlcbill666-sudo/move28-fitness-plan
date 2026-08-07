const assert = require('node:assert/strict');
const test = require('node:test');
const { modules, clearMove28ModuleCache } = require('../helpers/load-script.cjs');

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
    assert.deepEqual(api.DOSE_KEYS, ['sets', 'reps', 'rpe', 'restSec', 'durationMin', 'holdSec']);
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
    assert.equal(typeof api.guideStepsFor, 'function');
    assert.equal(typeof api.renderGuide, 'function');
    assert.equal(typeof api.openGuide, 'function');
  });

  await t.test('app exports init without initializing the DOM', () => {
    clearMove28ModuleCache();
    const api = require(modules.app);
    assert.equal(typeof api.init, 'function');
  });
});
