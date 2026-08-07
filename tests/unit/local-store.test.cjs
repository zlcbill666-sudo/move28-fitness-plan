'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  const calls = [];
  return {
    calls,
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { calls.push(['getItem', key]); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { calls.push(['setItem', key]); data.set(key, String(value)); },
    removeItem(key) { calls.push(['removeItem', key]); data.delete(key); },
    raw(key) { return data.get(key); },
    keys() { return [...data.keys()]; }
  };
}

function api() {
  clearMove28ModuleCache();
  return loadScript('localStore');
}

const DEFAULT_STATE = {
  schemaVersion: 1,
  participantId: 'pilot-local',
  intake: null,
  intakeRevision: 0,
  risk: null,
  plan: null,
  logs: {},
  weeklyReviews: [],
  consent: { acceptedAt: null, version: 'pilot-v1' }
};

test('空存储返回完整默认状态、独立副本且只使用唯一自有 key', () => {
  const storage = memoryStorage();
  const moduleApi = api();
  const store = moduleApi.createLocalStore({ storage });
  const first = store.loadState();
  assert.deepEqual(first, DEFAULT_STATE);
  first.logs.changed = true;
  first.consent.version = 'changed';
  assert.deepEqual(store.loadState(), DEFAULT_STATE);
  assert.deepEqual(moduleApi.OWNED_KEYS, ['move28-pilot-v1']);
  assert.ok(storage.calls.every(([, key]) => key === moduleApi.STORAGE_KEY));
  assert.equal(storage.length, 0);
});

test('保存问卷使用深拷贝、revision 递增，并让旧计划明确失效', () => {
  const storage = memoryStorage();
  const store = api().createLocalStore({ storage, participantId: 'pilot-a', now: () => '2030-01-02T03:04:05.000Z' });
  const intake = { age: 30, goals: ['mobility'] };
  const risk = {
    level: 'conservative',
    reasons: [{ code: 'stable_pain_mild', field: 'stablePain', message: '公开理由', rawPain: 'secret' }],
    ruleVersion: 'pilot-v1',
    rawHeight: 188
  };
  const first = store.saveIntake(intake, risk);
  intake.age = 99;
  risk.reasons[0].code = 'changed';
  first.intake.goals.push('mutated-return');
  assert.equal(store.loadState().intake.age, 30);
  assert.deepEqual(store.loadState().risk, {
    level: 'conservative',
    reasons: [{ code: 'stable_pain_mild', field: 'stablePain', message: '公开理由' }],
    ruleVersion: 'pilot-v1'
  });
  assert.equal(store.loadState().intakeRevision, 1);

  const planInput = { planVersion: 'plan-v1', title: '第一版', days: [{ id: 1 }] };
  const planned = store.savePlan(planInput);
  planInput.days[0].id = 999;
  planned.plan.title = 'changed-return';
  assert.equal(store.loadState().plan.days[0].id, 1);
  assert.equal(store.loadState().plan.status, 'active');
  assert.equal(store.loadState().plan.intakeRevision, 1);

  const revised = store.saveIntake({ age: 31 }, { level: 'normal', reasons: [], ruleVersion: 'pilot-v1' });
  assert.equal(revised.intakeRevision, 2);
  assert.equal(revised.plan.status, 'stale');
  assert.equal(revised.plan.staleReason, 'intake_changed');
  assert.equal(revised.plan.staleAt, '2030-01-02T03:04:05.000Z');
  assert.equal(revised.plan.intakeRevision, 1);
  const replacement = store.savePlan({ planVersion: 'plan-v2' });
  assert.equal(replacement.plan.status, 'active');
  assert.equal(replacement.plan.intakeRevision, 2);
  assert.equal('staleReason' in replacement.plan, false);
});

test('load/migrate 对非法、未来和污染状态 fail closed，并只重建白名单字段', () => {
  const moduleApi = api();
  const invalidValues = [
    '{bad', 'null', '[]', '42', '"text"',
    ...[undefined, null, '1', -1, 0, 0.5, 2].map(schemaVersion => JSON.stringify({
      ...(schemaVersion === undefined ? {} : { schemaVersion }),
      intake: { secret: 'must-drop' },
      intakeRevision: 9,
      risk: { level: 'stop', reasons: [], ruleVersion: 'pilot-v1' },
      plan: { planVersion: 'plan-v1' }
    }))
  ];
  for (const raw of invalidValues) {
    const store = moduleApi.createLocalStore({ storage: memoryStorage({ [moduleApi.STORAGE_KEY]: raw }), participantId: 'pilot-b' });
    assert.deepEqual(store.loadState(), { ...DEFAULT_STATE, participantId: 'pilot-b' });
  }

  const polluted = JSON.parse('{"schemaVersion":1,"participantId":"phone-13800138000","intake":{"height":188,"__proto__":{"polluted":true}},"intakeRevision":3,"risk":{"level":"stop","reasons":[{"code":"x","field":"pain","message":"safe","secret":"drop"}],"ruleVersion":"r","height":188},"plan":{"planVersion":"v1"},"logs":{"day1":{"note":"SECRET_LOG"}},"weeklyReviews":[{"score":1}],"consent":{"acceptedAt":"2029-01-01","version":"pilot-v1","secret":"drop"},"unknown":{"secret":"drop"},"height":188}');
  const migrated = moduleApi.migrateState(polluted, 'pilot-a');
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(migrated.participantId, 'pilot-a');
  assert.equal(migrated.unknown, undefined);
  assert.equal(migrated.height, undefined);
  assert.deepEqual(migrated.logs, {});
  assert.deepEqual(migrated.weeklyReviews, []);
  assert.deepEqual(migrated.risk, { level: 'stop', reasons: [{ code: 'x', field: 'pain', message: 'safe' }], ruleVersion: 'r' });
  assert.equal(migrated.risk.height, undefined);
});

test('损坏字段逐字段恢复，不让继承属性或 getter 进入状态', () => {
  let getterCalls = 0;
  const raw = Object.create({ intake: { inherited: true }, logs: { inherited: true } });
  Object.defineProperties(raw, {
    schemaVersion: { value: 1, enumerable: true },
    intakeRevision: { value: -5, enumerable: true },
    risk: { get() { getterCalls += 1; return { level: 'normal' }; }, enumerable: true },
    plan: { value: 'bad', enumerable: true },
    weeklyReviews: { value: {}, enumerable: true }
  });
  const migrated = api().migrateState(raw, 'pilot-a');
  assert.equal(getterCalls, 0);
  assert.deepEqual(migrated, { ...DEFAULT_STATE, participantId: 'pilot-a' });
});

test('审核摘要严格最小化，不含问卷、理由文本、日志、自由文本或同意时间', () => {
  const moduleApi = api();
  const secret = 'SECRET_MARKER_9283';
  const storage = memoryStorage({
    [moduleApi.STORAGE_KEY]: JSON.stringify({
      schemaVersion: 1,
      participantId: 'pilot-a',
      intake: { height: 188, weight: 90, pain: secret, freeText: secret },
      intakeRevision: 4,
      risk: { level: 'manual_review', reasons: [{ code: 'review', field: 'pain', message: secret }], ruleVersion: 'pilot-v1' },
      plan: { status: 'stale', planVersion: 'plan-v2', intakeRevision: 3, notes: secret },
      logs: { d1: { exercises: secret }, healthAnswer: 'SECRET_LOG' },
      weeklyReviews: [{ note: secret, healthAnswer: 'SECRET_LOG' }],
      consent: { acceptedAt: '2029-02-03T00:00:00.000Z', version: 'pilot-v1' }
    })
  });
  const summary = moduleApi.createLocalStore({ storage, participantId: 'pilot-a' }).exportReviewSummary();
  assert.deepEqual(summary, {
    schemaVersion: 1,
    participantId: 'pilot-a',
    intakeRevision: 4,
    risk: { level: 'manual_review', reasonCodes: ['review'], ruleVersion: 'pilot-v1' },
    plan: { status: 'stale', planVersion: 'plan-v2', intakeRevision: 3 },
    logCount: 0,
    weeklyReviewCount: 0,
    consent: { accepted: true, version: 'pilot-v1' }
  });
  const serialized = JSON.stringify(summary);
  for (const forbidden of [secret, 'height', 'weight', 'pain', 'freeText', 'message', 'field', 'acceptedAt', 'exercises']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  const loaded = moduleApi.createLocalStore({ storage, participantId: 'pilot-a' }).loadState();
  assert.equal(JSON.stringify(loaded).includes('healthAnswer'), false);
  assert.equal(JSON.stringify(loaded).includes('SECRET_LOG'), false);
  summary.risk.reasonCodes.push('changed');
  assert.deepEqual(moduleApi.createLocalStore({ storage, participantId: 'pilot-a' }).exportReviewSummary().risk.reasonCodes, ['review']);
});

test('审核摘要只导出严格机器标识符，恶意持久化元数据无法夹带自由文本', () => {
  const moduleApi = api();
  const marker = 'RAW_HEALTH_FREE_TEXT_9283';
  const maliciousStorage = memoryStorage({
    [moduleApi.STORAGE_KEY]: JSON.stringify({
      schemaVersion: 1,
      intakeRevision: 2,
      risk: {
        level: 'manual_review',
        reasons: [{ code: marker, field: 'stablePain', message: 'local only' }],
        ruleVersion: marker
      },
      plan: { status: marker, planVersion: marker, intakeRevision: 2 },
      logs: { [marker]: marker },
      weeklyReviews: [{ note: marker }]
    })
  });
  const maliciousStore = moduleApi.createLocalStore({ storage: maliciousStorage });
  assert.equal(JSON.stringify(maliciousStore.exportReviewSummary()).includes(marker), false);
  const maliciousLoaded = maliciousStore.loadState();
  assert.equal(JSON.stringify(maliciousLoaded.logs).includes(marker), false);
  assert.equal(JSON.stringify(maliciousLoaded.weeklyReviews).includes(marker), false);

  const validStorage = memoryStorage({
    [moduleApi.STORAGE_KEY]: JSON.stringify({
      schemaVersion: 1,
      risk: {
        level: 'conservative',
        reasons: [{ code: 'stable_pain_mild', field: 'stablePain', message: '仅本地' }],
        ruleVersion: 'pilot-v1'
      },
      plan: { status: 'active', planVersion: 'plan-v1', intakeRevision: 0 }
    })
  });
  assert.deepEqual(moduleApi.createLocalStore({ storage: validStorage }).exportReviewSummary(), {
    schemaVersion: 1,
    participantId: 'pilot-local',
    intakeRevision: 0,
    risk: { level: 'conservative', reasonCodes: ['stable_pain_mild'], ruleVersion: 'pilot-v1' },
    plan: { status: 'active', planVersion: 'plan-v1', intakeRevision: 0 },
    logCount: 0,
    weeklyReviewCount: 0,
    consent: { accepted: false, version: 'pilot-v1' }
  });
});

test('clearAll 只删除 OWNED_KEYS，失败不报告成功', () => {
  const moduleApi = api();
  const storage = memoryStorage({
    [moduleApi.STORAGE_KEY]: JSON.stringify({ ...DEFAULT_STATE, participantId: 'pilot-a' }),
    'move28-tracker-v1': '{"keep":true}',
    'move28-music-enabled': '0',
    'move28-music-volume': '20'
  });
  const store = moduleApi.createLocalStore({ storage, participantId: 'pilot-a' });
  assert.equal(store.clearAll(), true);
  assert.equal(storage.raw(moduleApi.STORAGE_KEY), undefined);
  assert.equal(storage.raw('move28-tracker-v1'), '{"keep":true}');
  assert.equal(storage.raw('move28-music-enabled'), '0');
  assert.equal(storage.raw('move28-music-volume'), '20');
  assert.deepEqual(store.loadState(), { ...DEFAULT_STATE, participantId: 'pilot-a' });

  const failing = moduleApi.createLocalStore({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => { throw new Error(secretText()); } } });
  assert.equal(failing.clearAll(), false);
  function secretText() { return 'private storage failure'; }
});

test('恶意保存值零 getter 执行且 Proxy/BigInt/function/cycle 均拒绝，存储不变', () => {
  const moduleApi = api();
  const storage = memoryStorage();
  const store = moduleApi.createLocalStore({ storage });
  store.saveIntake({ age: 20 });
  const before = storage.raw(moduleApi.STORAGE_KEY);
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'secret', { enumerable: true, get() { getterCalls += 1; return 'health secret'; } });
  const cyclic = {}; cyclic.self = cyclic;
  const values = [accessor, new Proxy({ age: 20 }, {}), { n: 1n }, { fn() {} }, cyclic];
  for (const value of values) {
    assert.throws(() => store.saveIntake(value), error => error instanceof TypeError && error.message === 'Invalid plain data');
    assert.equal(storage.raw(moduleApi.STORAGE_KEY), before);
  }
  assert.equal(getterCalls, 0);
});

test('严格写路径读取失败时保持原状态且绝不调用 setItem', () => {
  const moduleApi = api();
  const original = JSON.stringify({
    ...DEFAULT_STATE,
    intakeRevision: 7,
    plan: { planVersion: 'plan-v1', status: 'active', intakeRevision: 7 }
  });
  for (const [label, failOnlyOnce, save] of [
    ['saveIntake-first', true, store => store.saveIntake({ age: 21 })],
    ['saveIntake-always', false, store => store.saveIntake({ age: 21 })],
    ['savePlan-first', true, store => store.savePlan({ planVersion: 'plan-v2' })],
    ['savePlan-always', false, store => store.savePlan({ planVersion: 'plan-v2' })]
  ]) {
    let getCalls = 0;
    let setCalls = 0;
    let raw = original;
    const storage = {
      getItem() {
        getCalls += 1;
        if (!failOnlyOnce || getCalls === 1) throw new Error(`private-${label}`);
        return raw;
      },
      setItem(_key, value) { setCalls += 1; raw = String(value); },
      removeItem() {}
    };
    const store = moduleApi.createLocalStore({ storage });
    assert.throws(save.bind(null, store), error => error.name === 'StorageError'
      && error.message === 'Unable to read local participant state');
    assert.equal(setCalls, 0, label);
    assert.equal(raw, original, label);
  }
});

test('严格写路径不覆盖非法JSON、非法schema或非字符串读取结果，宽松load仍返回默认状态', () => {
  const moduleApi = api();
  const futureState = JSON.stringify({ ...DEFAULT_STATE, schemaVersion: 2, intakeRevision: 7 });
  const missingSchema = JSON.stringify({ intake: { age: 30 }, intakeRevision: 7 });
  for (const rawValue of ['{damaged', 'null', '[]', '42', futureState, missingSchema, undefined, 42, {}]) {
    let setCalls = 0;
    let raw = rawValue;
    const storage = {
      getItem: () => raw,
      setItem(_key, value) { setCalls += 1; raw = String(value); },
      removeItem() {}
    };
    const store = moduleApi.createLocalStore({ storage });
    assert.deepEqual(store.loadState(), DEFAULT_STATE);
    for (const save of [
      () => store.saveIntake({ age: 22 }),
      () => store.savePlan({ planVersion: 'plan-v1' })
    ]) {
      assert.throws(save, error => error.name === 'StorageError'
        && error.message === 'Unable to read local participant state');
    }
    assert.equal(setCalls, 0);
    assert.equal(raw, rawValue);
  }
});

test('跨 realm 普通对象和数组可保存，跨 realm class/Date/Map 仍拒绝', () => {
  const moduleApi = api();
  const storage = memoryStorage();
  const store = moduleApi.createLocalStore({ storage });
  const intake = vm.runInNewContext('({ age: 28, profile: { goals: ["mobility", { code: "strength" }] } })');
  const savedIntake = store.saveIntake(intake);
  assert.deepEqual(savedIntake.intake, {
    age: 28,
    profile: { goals: ['mobility', { code: 'strength' }] }
  });
  const plan = vm.runInNewContext('({ planVersion: "plan-v1", weeks: [{ days: [1, 2, 3] }] })');
  const savedPlan = store.savePlan(plan);
  assert.deepEqual(savedPlan.plan.weeks, [{ days: [1, 2, 3] }]);

  const before = storage.raw(moduleApi.STORAGE_KEY);
  const rejected = vm.runInNewContext('(() => { class Intake { constructor() { this.age = 20; } } return [new Intake(), new Date(), new Map([["age", 20]])]; })()');
  const disguisedClass = vm.runInNewContext('(() => { class Intake { constructor() { this.age = 20; } } Object.setPrototypeOf(Intake.prototype, null); return new Intake(); })()');
  rejected.push(disguisedClass);
  for (const value of rejected) {
    assert.throws(() => store.saveIntake(value), error => error instanceof TypeError
      && error.message === 'Invalid plain data');
    assert.equal(storage.raw(moduleApi.STORAGE_KEY), before);
  }
});

test('完整状态超预算时在setItem前失败，原存储保持不变', () => {
  const moduleApi = api();
  const storage = memoryStorage();
  const store = moduleApi.createLocalStore({ storage });
  const largeIntake = Object.fromEntries(Array.from({ length: 6000 }, (_, index) => [`field${index}`, index]));
  store.saveIntake(largeIntake);
  const before = storage.raw(moduleApi.STORAGE_KEY);
  const writesBefore = storage.calls.filter(([method]) => method === 'setItem').length;
  const largePlan = Object.fromEntries(Array.from({ length: 6000 }, (_, index) => [`item${index}`, index]));

  assert.throws(() => store.savePlan(largePlan), error => error.name === 'StorageError'
    && error.message === 'Unable to save local participant state');
  assert.equal(storage.raw(moduleApi.STORAGE_KEY), before);
  assert.equal(storage.calls.filter(([method]) => method === 'setItem').length, writesBefore);
  assert.equal(store.loadState().plan, null);
});

test('迭代克隆保留共享 DAG，超预算深层输入固定拒绝且不修改存储', () => {
  const moduleApi = api();
  const storage = memoryStorage();
  const store = moduleApi.createLocalStore({ storage });
  const shared = { exercises: ['squat'] };
  const saved = store.saveIntake({ monday: shared, friday: shared });
  assert.equal(saved.intake.monday, saved.intake.friday);
  const before = storage.raw(moduleApi.STORAGE_KEY);

  let deep = { value: 1 };
  for (let index = 0; index < 20000; index += 1) deep = { child: deep };
  assert.throws(() => store.saveIntake(deep), error => error instanceof TypeError
    && error.message === 'Invalid plain data' && !(error instanceof RangeError));
  assert.equal(storage.raw(moduleApi.STORAGE_KEY), before);
});

test('setItem 失败抛固定 StorageError 且不伪称成功', () => {
  const store = api().createLocalStore({
    storage: { getItem: () => null, setItem: () => { throw new Error('secret health data'); }, removeItem: () => {} }
  });
  assert.throws(() => store.saveIntake({ age: 20 }), error => error.name === 'StorageError' && error.message === 'Unable to save local participant state');
});

test('participantId 仅接受短 pilot 编号，非法值回退 pilot-local', () => {
  const moduleApi = api();
  for (const valid of ['pilot-a', 'pilot-b', 'pilot-local', 'pilot-ab12']) {
    assert.equal(moduleApi.createDefaultState(valid).participantId, valid);
  }
  for (const invalid of ['Alice', '13800138000', 'pilot_a', 'pilot-', 'pilot-a-very-long-identifier', '', null, {}, 'pilot-中文']) {
    assert.equal(moduleApi.createDefaultState(invalid).participantId, 'pilot-local');
  }
});

test('默认实例在 localStorage getter/方法被禁止时加载不崩并使用私有内存', () => {
  clearMove28ModuleCache();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    let moduleApi;
    assert.doesNotThrow(() => { moduleApi = loadScript('localStore'); });
    moduleApi.saveIntake({ age: 21 });
    assert.equal(moduleApi.loadState().intake.age, 21);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
    clearMove28ModuleCache();
  }
});

test('默认实例在 localStorage 方法调用抛错时切换到私有内存', () => {
  clearMove28ModuleCache();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() { throw new Error('denied'); },
        setItem() { throw new Error('denied'); },
        removeItem() { throw new Error('denied'); }
      }
    });
    const moduleApi = loadScript('localStore');
    assert.equal(moduleApi.saveIntake({ age: 23 }).intakeRevision, 1);
    assert.equal(moduleApi.loadState().intake.age, 23);
    assert.equal(moduleApi.clearAll(), true);
    assert.equal(moduleApi.loadState().intake, null);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
    clearMove28ModuleCache();
  }
});

test('默认实例在可读存储的 removeItem 失败时不伪称清除成功', () => {
  clearMove28ModuleCache();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() { return null; },
        setItem() {},
        removeItem() { throw new Error('denied'); }
      }
    });
    const moduleApi = loadScript('localStore');
    assert.equal(moduleApi.clearAll(), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
    clearMove28ModuleCache();
  }
});

test('classic-script UMD 在无 DOM/localStorage 的 VM 中安全加载并挂载 Move28.storage', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src', 'storage', 'local-store.js'), 'utf8');
  const context = { structuredClone };
  vm.createContext(context);
  assert.doesNotThrow(() => vm.runInContext(source, context));
  assert.equal(typeof context.Move28.storage.createLocalStore, 'function');
  const state = vm.runInContext('Move28.storage.saveIntake({age: 22}); Move28.storage.loadState()', context);
  assert.equal(state.intake.age, 22);
  assert.equal(context.document, undefined);
});
