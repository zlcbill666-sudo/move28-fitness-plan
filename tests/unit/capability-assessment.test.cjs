const assert = require('node:assert/strict');
const test = require('node:test');
const { modules, clearMove28ModuleCache } = require('../helpers/load-script.cjs');

const complete = {
  version: 1,
  completed: true,
  chairRise: 'independent_controlled',
  wallPushup: 'controlled',
  wallHinge: 'controlled',
  floorAccess: 'comfortable',
  walkTolerance: 'comfortable'
};

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key) ?? null; }
  };
}

function fakeRoot() {
  const listeners = new Map();
  const classes = new Set();
  return {
    innerHTML: '',
    attributes: {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), toggle(value, on) { on ? classes.add(value) : classes.delete(value); } },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contains() { return false; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event) { const handler = listeners.get(type); if (handler) handler(event); }
  };
}

function load() {
  clearMove28ModuleCache();
  return require(modules.capabilityAssessment);
}

test('module loads without DOM and exports the finite three-screen contract', () => {
  const api = load();
  assert.equal(typeof api.createCapabilityAssessment, 'function');
  assert.equal(api.DRAFT_KEY, 'move28-capability-draft-v1');
  assert.deepEqual(api.STEPS.map(step => step.id), ['lower', 'upper', 'walk']);
  assert.deepEqual(api.PROFILE_FIELDS, ['chairRise', 'wallPushup', 'wallHinge', 'floorAccess', 'walkTolerance']);
});

test('sanitizer retains only finite answers and drops extra or invalid fields', () => {
  const { sanitizeAnswers } = load();
  assert.deepEqual(sanitizeAnswers({ ...complete, name: 'secret', notes: 'private', wallHinge: 'invented' }), {
    chairRise: 'independent_controlled', wallPushup: 'controlled', floorAccess: 'comfortable', walkTolerance: 'comfortable'
  });
  assert.deepEqual(sanitizeAnswers(Object.create({ chairRise: 'independent_controlled' })), {});
});

test('each screen validates its own required finite fields, including skip values', () => {
  const { validateStep } = load();
  assert.equal(validateStep('lower', {}).ok, false);
  assert.deepEqual(validateStep('lower', { chairRise: 'not_attempted', wallHinge: 'not_attempted' }), { ok: true, errors: [] });
  assert.equal(validateStep('upper', { wallPushup: 'controlled' }).errors[0].field, 'floorAccess');
  assert.equal(validateStep('walk', { walkTolerance: 'warning_symptom' }).ok, true);
});

test('buildProfile emits exactly the fixed versioned schema and preserves warning answer', () => {
  const { buildProfile } = load();
  const profile = buildProfile({ ...complete, extra: 'discard' });
  assert.deepEqual(profile, complete);
  assert.deepEqual(Object.keys(profile), ['version', 'completed', 'chairRise', 'wallPushup', 'wallHinge', 'floorAccess', 'walkTolerance']);
  assert.equal(buildProfile({ ...complete, walkTolerance: 'warning_symptom' }).walkTolerance, 'warning_symptom');
  assert.equal(buildProfile({ ...complete, wallPushup: 'bad' }), null);
});

test('controller validates Next, supports Back, skip, completion and clears draft only on success', () => {
  const { createCapabilityAssessment, DRAFT_KEY } = load();
  const storage = memoryStorage();
  const root = fakeRoot();
  let received;
  const controller = createCapabilityAssessment({ rootElement: root, draftStorage: storage, onComplete(profile) { received = profile; return { message: 'saved' }; } });
  controller.open();
  assert.equal(controller.next(), false);
  controller.setField('chairRise', 'not_attempted'); controller.setField('wallHinge', 'not_attempted');
  assert.equal(controller.next(), true); assert.equal(controller.getState().step, 1);
  assert.equal(controller.back(), true); assert.equal(controller.getState().step, 0);
  controller.setField('chairRise', complete.chairRise); controller.setField('wallHinge', complete.wallHinge); controller.next();
  controller.setField('wallPushup', complete.wallPushup); controller.setField('floorAccess', complete.floorAccess); controller.next();
  controller.setField('walkTolerance', 'warning_symptom'); controller.next();
  assert.equal(received.walkTolerance, 'warning_symptom');
  assert.equal(storage.value(DRAFT_KEY), null);
});

test('draft recovery is bounded and strips pollution, PII and extra fields', () => {
  const api = load();
  const storage = memoryStorage({
    [api.DRAFT_KEY]: JSON.stringify({ version: 1, step: 99, answers: { chairRise: 'hands_supported', wallHinge: 'controlled', name: 'secret', __proto__: { polluted: true } } })
  });
  const controller = api.createCapabilityAssessment({ rootElement: fakeRoot(), draftStorage: storage });
  assert.deepEqual(controller.getState().answers, { chairRise: 'hands_supported', wallHinge: 'controlled' });
  assert.equal(controller.getState().step, 2);
  assert.equal({}.polluted, undefined);
});

test('StorageError completion preserves answers and draft for retry', () => {
  const api = load();
  const storage = memoryStorage();
  const controller = api.createCapabilityAssessment({ rootElement: fakeRoot(), draftStorage: storage, initialProfile: complete, onComplete() { const error = new Error('blocked'); error.name = 'StorageError'; throw error; } });
  controller.open(); controller.goTo(2);
  assert.equal(controller.next(), false);
  assert.deepEqual(controller.getState().answers, api.sanitizeAnswers(complete));
  assert.notEqual(storage.value(api.DRAFT_KEY), null);
  assert.match(controller.getState().resultMessage, /本机保存失败/);
});

test('Back on first screen and Escape close restore closed state without clearing draft', () => {
  const api = load();
  const storage = memoryStorage(); const root = fakeRoot();
  const controller = api.createCapabilityAssessment({ rootElement: root, draftStorage: storage });
  controller.open(); controller.setField('chairRise', 'not_attempted');
  assert.equal(controller.back(), true); assert.equal(controller.getState().isOpen, false);
  controller.open();
  root.dispatch('keydown', { key: 'Escape', preventDefault() {}, shiftKey: false });
  assert.equal(controller.getState().isOpen, false);
  assert.notEqual(storage.value(api.DRAFT_KEY), null);
});
