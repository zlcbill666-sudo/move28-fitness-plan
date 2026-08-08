const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const { evaluateCapabilityProfile } = require('../../src/domain/capability-engine.js');

function ideal(overrides = {}) {
  return {
    version: 1,
    completed: true,
    chairRise: 'independent_controlled',
    wallPushup: 'controlled',
    wallHinge: 'controlled',
    floorAccess: 'comfortable',
    walkTolerance: 'comfortable',
    ...overrides,
  };
}

const INVALID_RESULT = {
  status: 'manual_review',
  difficultyCap: 1,
  exclusions: ['floor', 'hinge'],
  variants: { knee_dominant: 'high_seat', horizontal_push: 'close_wall' },
  cardioStartMinutes: 0,
  reasonCodes: ['INVALID_INPUT'],
};

test('全理想答案产生唯一 normal 路径与难度上限 2', () => {
  assert.deepEqual(evaluateCapabilityProfile(ideal()), {
    status: 'normal',
    difficultyCap: 2,
    exclusions: [],
    variants: { knee_dominant: 'standard', horizontal_push: 'standard' },
    cardioStartMinutes: 15,
    reasonCodes: [],
  });
});

test('每类保守答案均降级，理由码按固定字段顺序输出且去重', () => {
  const cases = [
    ['chairRise', 'hands_supported', 'CHAIR_RISE_HANDS_SUPPORTED'],
    ['wallPushup', 'limited_range', 'WALL_PUSHUP_LIMITED_RANGE'],
    ['wallHinge', 'limited_range', 'WALL_HINGE_LIMITED_RANGE'],
    ['floorAccess', 'needs_support', 'FLOOR_ACCESS_NEEDS_SUPPORT'],
    ['floorAccess', 'avoid_floor', 'FLOOR_ACCESS_AVOID_FLOOR'],
    ['walkTolerance', 'fatigued_but_stable', 'WALK_TOLERANCE_FATIGUED_BUT_STABLE'],
  ];
  for (const [field, value, reason] of cases) {
    const result = evaluateCapabilityProfile(ideal({ [field]: value }));
    assert.equal(result.status, 'conservative', `${field}:${value}`);
    assert.equal(result.difficultyCap, 1);
    assert.deepEqual(result.reasonCodes, [reason]);
  }

  const combined = evaluateCapabilityProfile(ideal({
    chairRise: 'hands_supported',
    wallPushup: 'limited_range',
    wallHinge: 'limited_range',
    floorAccess: 'avoid_floor',
    walkTolerance: 'fatigued_but_stable',
  }));
  assert.deepEqual(combined.reasonCodes, [
    'CHAIR_RISE_HANDS_SUPPORTED',
    'WALL_PUSHUP_LIMITED_RANGE',
    'WALL_HINGE_LIMITED_RANGE',
    'FLOOR_ACCESS_AVOID_FLOOR',
    'WALK_TOLERANCE_FATIGUED_BUT_STABLE',
  ]);
  assert.equal(new Set(combined.reasonCodes).size, combined.reasonCodes.length);
});

test('任一 not_attempted 均保守并产生字段专属理由', () => {
  const fields = ['chairRise', 'wallPushup', 'wallHinge', 'floorAccess', 'walkTolerance'];
  for (const field of fields) {
    const result = evaluateCapabilityProfile(ideal({ [field]: 'not_attempted' }));
    assert.equal(result.status, 'conservative', field);
    assert.equal(result.difficultyCap, 1);
    assert.deepEqual(result.reasonCodes, [`${field.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()}_NOT_ATTEMPTED`]);
  }
});

test('三类疼痛或失稳答案进入 manual_review', () => {
  for (const [field, value, reason] of [
    ['chairRise', 'unable_or_painful', 'CHAIR_RISE_UNABLE_OR_PAINFUL'],
    ['wallPushup', 'painful_or_unstable', 'WALL_PUSHUP_PAINFUL_OR_UNSTABLE'],
    ['wallHinge', 'painful_or_unstable', 'WALL_HINGE_PAINFUL_OR_UNSTABLE'],
  ]) {
    const result = evaluateCapabilityProfile(ideal({ [field]: value }));
    assert.equal(result.status, 'manual_review');
    assert.equal(result.difficultyCap, 1);
    assert.deepEqual(result.reasonCodes, [reason]);
  }
});

test('stop > manual_review > conservative，且高优先级不丢失低优先级理由', () => {
  const result = evaluateCapabilityProfile(ideal({
    chairRise: 'unable_or_painful',
    wallPushup: 'limited_range',
    walkTolerance: 'warning_symptom',
  }));
  assert.equal(result.status, 'stop');
  assert.deepEqual(result.reasonCodes, [
    'CHAIR_RISE_UNABLE_OR_PAINFUL',
    'WALL_PUSHUP_LIMITED_RANGE',
    'WALK_TOLERANCE_WARNING_SYMPTOM',
  ]);

  const manualOverConservative = evaluateCapabilityProfile(ideal({
    chairRise: 'hands_supported', wallHinge: 'painful_or_unstable',
  }));
  assert.equal(manualOverConservative.status, 'manual_review');
});

test('约束、变式和有氧时长严格由答案映射', () => {
  const constrained = evaluateCapabilityProfile(ideal({
    chairRise: 'hands_supported', wallPushup: 'limited_range', wallHinge: 'not_attempted',
    floorAccess: 'needs_support', walkTolerance: 'not_attempted',
  }));
  assert.deepEqual(constrained.exclusions, ['floor', 'hinge']);
  assert.deepEqual(constrained.variants, {
    knee_dominant: 'high_seat', horizontal_push: 'close_wall',
  });
  assert.equal(constrained.cardioStartMinutes, 8);
  assert.equal(evaluateCapabilityProfile(ideal({ walkTolerance: 'fatigued_but_stable' })).cardioStartMinutes, 8);
  assert.equal(evaluateCapabilityProfile(ideal({ walkTolerance: 'warning_symptom' })).cardioStartMinutes, 0);
});

test('不修改或冻结输入；相同输入输出字节级确定', () => {
  const profile = ideal({ floorAccess: 'avoid_floor' });
  const before = JSON.stringify(profile);
  const first = evaluateCapabilityProfile(profile);
  const second = evaluateCapabilityProfile(profile);
  assert.equal(JSON.stringify(profile), before);
  assert.equal(Object.isFrozen(profile), false);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
});

test('普通 null-prototype 保持相同语义，跨 realm profile fail closed', () => {
  const nullPrototype = Object.assign(Object.create(null), ideal());
  const crossRealm = vm.runInNewContext(`({
    version: 1,
    completed: true,
    chairRise: 'independent_controlled',
    wallPushup: 'controlled',
    wallHinge: 'controlled',
    floorAccess: 'comfortable',
    walkTolerance: 'comfortable'
  })`);
  assert.deepEqual(evaluateCapabilityProfile(nullPrototype), evaluateCapabilityProfile(ideal()));
  assert.deepEqual(evaluateCapabilityProfile(crossRealm), INVALID_RESULT);
});

test('伪造 null-root 原型与透明 Proxy 原型均 fail closed', () => {
  const forgedProto = Object.create(null);
  Object.defineProperty(forgedProto, 'constructor', { value: function Forged() {} });
  const forgedProfile = Object.assign(Object.create(forgedProto), ideal());

  const proxiedProto = new Proxy(Object.prototype, {});
  const proxiedProfile = Object.assign(Object.create(proxiedProto), ideal());

  for (const value of [forgedProfile, proxiedProfile]) {
    assert.doesNotThrow(() => evaluateCapabilityProfile(value));
    assert.deepEqual(evaluateCapabilityProfile(value), INVALID_RESULT);
  }
});

test('输出为深冻结普通对象', () => {
  const result = evaluateCapabilityProfile(ideal({ floorAccess: 'avoid_floor' }));
  assert.strictEqual(Object.getPrototypeOf(result), Object.prototype);
  assert.strictEqual(Object.getPrototypeOf(result.variants), Object.prototype);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.exclusions));
  assert.ok(Object.isFrozen(result.variants));
  assert.ok(Object.isFrozen(result.reasonCodes));
});

test('非法结构和非法值统一返回固定 INVALID_INPUT', () => {
  const missing = ideal(); delete missing.wallHinge;
  const extra = ideal(); extra.extra = true;
  const dangerousValues = ['__proto__', 'prototype', 'constructor'].map(key => {
    const value = ideal();
    Object.defineProperty(value, key, { value: {}, enumerable: true });
    return value;
  });
  const sparse = []; sparse.length = 1;
  const circular = {}; circular.self = circular;
  const hostileValues = [undefined, null, [], sparse, missing, extra, ...dangerousValues,
    ideal({ version: 2 }), ideal({ completed: false }), ideal({ completed: 1 }),
    ideal({ chairRise: 'unknown' }), ideal({ floorAccess: 1 }), ideal({ floorAccess: Number.NaN }),
    ideal({ floorAccess: Infinity }),
    Object.assign(Object.create({}), ideal()), new (class Profile { constructor() { Object.assign(this, ideal()); } })(),
    new Date(), new Map(),
    ideal({ wallPushup: 1n }), ideal({ wallPushup: Symbol('x') }), ideal({ wallPushup() {} }),
    ideal({ wallPushup: circular }),
  ];
  for (const value of hostileValues) {
    assert.doesNotThrow(() => evaluateCapabilityProfile(value));
    assert.deepEqual(evaluateCapabilityProfile(value), INVALID_RESULT);
  }
});

test('getter/accessor 不执行；throwing/revoked/transparent Proxy 均 fail closed', () => {
  let reads = 0;
  const knownGetter = ideal();
  Object.defineProperty(knownGetter, 'chairRise', { enumerable: true, get() { reads += 1; throw new Error('secret'); } });
  const unknownGetter = ideal();
  Object.defineProperty(unknownGetter, 'extra', { enumerable: true, get() { reads += 1; throw new Error('secret'); } });
  for (const value of [knownGetter, unknownGetter]) {
    assert.deepEqual(evaluateCapabilityProfile(value), INVALID_RESULT);
  }
  assert.equal(reads, 0);

  const throwing = new Proxy(ideal(), { ownKeys() { throw new Error('trap text'); } });
  const descriptorThrowing = new Proxy(ideal(), { getOwnPropertyDescriptor() { throw new Error('trap text'); } });
  const transparent = new Proxy(ideal(), {});
  const { proxy: revoked, revoke } = Proxy.revocable(ideal(), {}); revoke();
  for (const value of [throwing, descriptorThrowing, transparent, revoked]) {
    assert.doesNotThrow(() => evaluateCapabilityProfile(value));
    assert.deepEqual(evaluateCapabilityProfile(value), INVALID_RESULT);
  }
});
