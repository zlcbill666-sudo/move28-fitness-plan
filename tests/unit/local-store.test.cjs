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

const VALID_INTAKE = Object.freeze({boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment:['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'],allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no',finalConfirmed:true});
const VALID_RISK = Object.freeze({level:'normal',ruleVersion:'pilot-v2',reasons:[]});
function generateValidPlan(revision){
  clearMove28ModuleCache();
  const generator=loadScript('planGenerator'),catalog=loadScript('exerciseCatalog');
  return generator.generatePlan({intake:structuredClone(VALID_INTAKE),risk:structuredClone(VALID_RISK),intakeRevision:revision,catalog:catalog.exerciseCatalog});
}
function approveStoredPlan(storage,moduleApi,reviewedAt='2030-01-02T03:04:05.000Z'){
  const raw=JSON.parse(storage.raw(moduleApi.STORAGE_KEY));
  raw.plan.status='active';
  raw.plan.review={status:'approved',reviewerId:'pilot-reviewer',reviewedAt,planId:raw.plan.id,intakeRevision:raw.intakeRevision};
  storage.setItem(moduleApi.STORAGE_KEY,JSON.stringify(raw));
}

test('空存储返回完整默认状态、独立副本且只使用唯一自有 key', () => {
  const storage = memoryStorage();
  const moduleApi = api();
  const store = moduleApi.createLocalStore({ storage });
  const first = store.loadState();
  assert.deepEqual(first, DEFAULT_STATE);
  first.logs.changed = true;
  first.consent.version = 'changed';
  assert.deepEqual(store.loadState(), DEFAULT_STATE);
  assert.deepEqual(moduleApi.OWNED_KEYS, ['move28-pilot-v1','move28-tracker-v1','move28-current-day','move28-music-enabled','move28-music-volume']);
  assert.ok(storage.calls.every(([, key]) => key === moduleApi.STORAGE_KEY));
  assert.equal(storage.length, 0);
});

test('完成记录只绑定人工复核后的active计划和已知session，刷新后仍可恢复', () => {
  const storage = memoryStorage();
  const moduleApi=api();
  const store = moduleApi.createLocalStore({ storage, now: () => '2030-01-02T03:04:05.000Z' });
  store.saveIntake(structuredClone(VALID_INTAKE), structuredClone(VALID_RISK));
  const plan=generateValidPlan(1);store.savePlan(plan);
  assert.throws(()=>store.recordWorkoutCompletion({planId:plan.id,sessionId:plan.weeks[0].sessions[0].id}),error=>error.name==='StorageError');
  approveStoredPlan(storage,moduleApi);
  const sessionId=plan.weeks[0].sessions[0].id;
  const saved = store.recordWorkoutCompletion({ planId: plan.id, sessionId });
  assert.deepEqual(saved.logs, {
    [`${plan.id}.${sessionId}`]: { planId: plan.id, sessionId, status: 'completed', completedAt: '2030-01-02T03:04:05.000Z' }
  });
  assert.deepEqual(store.loadState().logs, saved.logs);
  assert.throws(() => store.recordWorkoutCompletion({ planId: plan.id, sessionId: 'w9-s9' }), error => error.name === 'StorageError');
  assert.throws(() => store.recordWorkoutCompletion({ planId: 'other-plan', sessionId }), error => error.name === 'StorageError');
  assert.throws(() => store.recordWorkoutCompletion({ planId: plan.id, sessionId, note: 'secret' }), TypeError);
});

test('保存问卷使用深拷贝、revision 递增，并让旧计划明确失效', () => {
  const storage = memoryStorage();
  const store = api().createLocalStore({ storage, participantId: 'pilot-a', now: () => '2030-01-02T03:04:05.000Z' });
  const forgedRisk = { level: 'conservative', reasons: [{ code: 'stable_pain_mild', field: 'stablePain', message: '伪造理由' }], ruleVersion: 'pilot-v1' };
  assert.throws(() => store.saveIntake(structuredClone(VALID_INTAKE), forgedRisk), TypeError);
  assert.equal(storage.raw('move28-pilot-v1'), undefined);
  const intake = structuredClone(VALID_INTAKE);
  const risk = structuredClone(VALID_RISK);
  const first = store.saveIntake(intake, risk);
  intake.age = 99;
  risk.level = 'stop';
  first.intake.avoidMovements.push('mutated-return');
  assert.equal(store.loadState().intake.age, 30);
  assert.deepEqual(store.loadState().risk, VALID_RISK);
  assert.equal(store.loadState().intakeRevision, 1);

  const validState=store.saveIntake(structuredClone(VALID_INTAKE),structuredClone(VALID_RISK));
  assert.equal(validState.intakeRevision,2);
  const planInput=generateValidPlan(2);
  const planned = store.savePlan(planInput);
  assert.equal(planned.plan.status, 'pending_review');
  assert.equal(planned.plan.intakeRevision, 2);
  assert.equal(planned.plan.review, null);
  assert.throws(()=>store.savePlan({id:'evil-plan',status:'generated',intakeRevision:2,weeks:[]}),error=>error.name==='StorageError');

  const revisedIntake=structuredClone(VALID_INTAKE);revisedIntake.age=31;
  const revised = store.saveIntake(revisedIntake, structuredClone(VALID_RISK));
  assert.equal(revised.intakeRevision, 3);
  assert.equal(revised.plan.status, 'stale');
  assert.equal(revised.plan.staleReason, 'intake_changed');
  assert.equal(revised.plan.staleAt, '2030-01-02T03:04:05.000Z');
  assert.equal(revised.plan.intakeRevision, 2);
  const replacement = store.savePlan(generateValidPlan(3));
  assert.equal(replacement.plan.status, 'pending_review');
  assert.equal(replacement.plan.intakeRevision, 3);
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
  assert.equal(migrated.risk.level, 'manual_review');
  assert.equal(migrated.risk.ruleVersion, 'pilot-v2');
  assert.equal(migrated.risk.reasons.some(reason => reason.code === 'x'), false);
  assert.equal(migrated.plan, null);
});

test('持久化风险结论必须由可信引擎重算，停止条件不能伪造成normal',()=>{
  const moduleApi=api(),dangerousIntake={...structuredClone(VALID_INTAKE),chestSymptoms:'yes'};
  const forged={...DEFAULT_STATE,participantId:'pilot-a',intake:dangerousIntake,intakeRevision:1,risk:structuredClone(VALID_RISK),plan:generateValidPlan(1)};
  const migrated=moduleApi.migrateState(forged,'pilot-newvalue');
  assert.equal(migrated.participantId,'pilot-a');
  assert.equal(migrated.risk.level,'stop');
  assert.ok(migrated.risk.reasons.some(reason=>reason.code==='chest_symptoms_reported'));
  assert.equal(migrated.plan,null);
  const summary=moduleApi.buildReviewSummary(forged);
  assert.equal(summary.riskLevel,'stop');assert.equal(summary.planSummary,null);assert.equal(summary.validationResult,'not_applicable');
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
      intake: { ...VALID_INTAKE, height: 188, weight: 90, pain: secret, freeText: secret },
      intakeRevision: 4,
      risk: VALID_RISK,
      plan: { status: 'stale', planVersion: 'pilot-v2', intakeRevision: 3, notes: secret },
      logs: { d1: { exercises: secret }, healthAnswer: 'SECRET_LOG' },
      weeklyReviews: [{ note: secret, healthAnswer: 'SECRET_LOG' }],
      consent: { acceptedAt: '2029-02-03T00:00:00.000Z', version: 'pilot-v1' }
    })
  });
  const summary = moduleApi.createLocalStore({ storage, participantId: 'pilot-a' }).exportReviewSummary();
  assert.deepEqual(summary, {
    participantId: 'pilot-a',
    ruleVersion: 'pilot-v2',
    riskLevel: 'normal',
    riskCodes: [],
    planSummary: { status: 'stale', planVersion: 'pilot-v2', weekCount: 0, sessionCount: 0, actionCount: 0 },
    validationResult: 'failed'
  });
  const serialized = JSON.stringify(summary);
  for (const forbidden of [secret, 'height', 'weight', 'pain', 'freeText', 'message', 'field', 'acceptedAt', 'exercises']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  const loaded = moduleApi.createLocalStore({ storage, participantId: 'pilot-a' }).loadState();
  assert.equal(JSON.stringify(loaded).includes('healthAnswer'), false);
  assert.equal(JSON.stringify(loaded).includes('SECRET_LOG'), false);
  assert.throws(() => summary.riskCodes.push('changed'), TypeError);
  assert.deepEqual(moduleApi.createLocalStore({ storage, participantId: 'pilot-a' }).exportReviewSummary().riskCodes, []);
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
  const versionLeakSummary = moduleApi.buildReviewSummary({ ...DEFAULT_STATE, intake: structuredClone(VALID_INTAKE), intakeRevision: 2, risk: structuredClone(VALID_RISK), plan: { status:'stale', planVersion:marker, intakeRevision:2 } });
  assert.equal(versionLeakSummary.planSummary.planVersion, null);
  assert.equal(JSON.stringify(versionLeakSummary).includes(marker), false);

  const conservativeIntake = { ...VALID_INTAKE, trainingBreak: 'yes' };
  const riskEngine = loadScript('riskEngine');
  const conservativeRisk = riskEngine.evaluateRisk(riskEngine.deriveRiskIntake(conservativeIntake));
  const validStorage = memoryStorage({
    [moduleApi.STORAGE_KEY]: JSON.stringify({
      schemaVersion: 1,
      intake: conservativeIntake,
      intakeRevision: 2,
      risk: conservativeRisk,
      plan: { status: 'active', planVersion: 'pilot-v2', intakeRevision: 2 }
    })
  });
  assert.deepEqual(moduleApi.createLocalStore({ storage: validStorage }).exportReviewSummary(), {
    participantId: 'pilot-local',
    ruleVersion: 'pilot-v2',
    riskLevel: 'conservative',
    riskCodes: ['activity_returning'],
    planSummary: { status: 'active', planVersion: 'pilot-v2', weekCount: 0, sessionCount: 0, actionCount: 0 },
    validationResult: 'failed'
  });
});

test('审核摘要对有效计划重新执行可信validator并给出准确规模',()=>{const moduleApi=api(),storage=memoryStorage(),store=moduleApi.createLocalStore({storage,participantId:'pilot-a'});store.saveIntake(structuredClone(VALID_INTAKE),structuredClone(VALID_RISK));const plan=generateValidPlan(1);store.savePlan(plan);const summary=store.exportReviewSummary(),sessions=plan.weeks.flatMap(week=>week.sessions);assert.equal(summary.validationResult,'passed');assert.equal(summary.planSummary.weekCount,4);assert.equal(summary.planSummary.sessionCount,sessions.length);assert.equal(summary.planSummary.actionCount,sessions.reduce((total,session)=>total+session.actions.length,0));assert.deepEqual(Object.keys(summary).sort(),['participantId','planSummary','riskCodes','riskLevel','ruleVersion','validationResult'])});

test('clearAll删除全部Move28本地key、保留无关key，失败时完整尝试且不报告成功', () => {
  const moduleApi = api();
  const storage = memoryStorage({
    [moduleApi.STORAGE_KEY]: JSON.stringify({ ...DEFAULT_STATE, participantId: 'pilot-a' }),
    'move28-tracker-v1': '{"keep":true}',
    'move28-current-day': '9',
    'move28-music-enabled': '0',
    'move28-music-volume': '20',
    'unrelated-site-key': 'keep'
  });
  const store = moduleApi.createLocalStore({ storage, participantId: 'pilot-a' });
  assert.deepEqual(store.clearAllDetailed(), {ok:true,status:'deleted',failedScopes:[]});
  for(const key of moduleApi.OWNED_KEYS)assert.equal(storage.raw(key),undefined,key);
  assert.equal(storage.raw('unrelated-site-key'),'keep');
  assert.deepEqual(store.loadState(), { ...DEFAULT_STATE, participantId: 'pilot-a' });

  const removed=[];
  const failingStorage={getItem:key=>key==='move28-tracker-v1'?'still-there':null,setItem:()=>{},removeItem:key=>{removed.push(key);if(key===moduleApi.STORAGE_KEY)throw new Error('private storage failure')}};
  const failing = moduleApi.createLocalStore({ storage:failingStorage });
  const result=failing.clearAllDetailed();
  assert.equal(result.ok,false);assert.equal(result.status,'partial_failure');
  assert.deepEqual(removed,moduleApi.OWNED_KEYS);
  assert.deepEqual([...result.failedScopes].sort(),['local.pilot','local.tracker']);
  assert.equal(JSON.stringify(result).includes('private storage failure'),false);
  assert.equal(failing.clearAll(),false);
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
  const persisted = moduleApi.migrateState({ ...DEFAULT_STATE, participantId: 'pilot-deadbeef' }, 'pilot-newvalue');
  assert.equal(persisted.participantId, 'pilot-deadbeef');
  const invalidPersisted = moduleApi.migrateState({ ...DEFAULT_STATE, participantId: 'email-user' }, 'pilot-newvalue');
  assert.equal(invalidPersisted.participantId, 'pilot-newvalue');
});

test('默认实例在 localStorage getter 被禁止时加载不崩且写入明确失败', () => {
  clearMove28ModuleCache();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
    let moduleApi;
    assert.doesNotThrow(() => { moduleApi = loadScript('localStore'); });
    assert.throws(()=>moduleApi.saveIntake({ age: 21 }),error=>error.name==='StorageError');
    assert.equal(moduleApi.loadState().intake, null);
    assert.equal(moduleApi.clearAll(),false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
    clearMove28ModuleCache();
  }
});

test('默认实例在 localStorage 方法调用抛错时不伪装成持久保存', () => {
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
    assert.throws(()=>moduleApi.saveIntake({ age: 23 }),error=>error.name==='StorageError');
    assert.equal(moduleApi.loadState().intake,null);
    assert.equal(moduleApi.clearAll(), false);
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
  const riskSource = fs.readFileSync(path.join(projectRoot, 'src', 'domain', 'risk-engine.js'), 'utf8');
  const source = fs.readFileSync(path.join(projectRoot, 'src', 'storage', 'local-store.js'), 'utf8');
  const context = { structuredClone };
  vm.createContext(context);
  assert.doesNotThrow(() => vm.runInContext(`${riskSource}\n${source}`, context));
  assert.equal(typeof context.Move28.storage.createLocalStore, 'function');
  assert.throws(() => vm.runInContext('Move28.storage.saveIntake({age: 22})', context), error=>error.name==='StorageError');
  const state=vm.runInContext('Move28.storage.loadState()',context);
  assert.equal(state.intake, null);
  assert.equal(context.document, undefined);
});
