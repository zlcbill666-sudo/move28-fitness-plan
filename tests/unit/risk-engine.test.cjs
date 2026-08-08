'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

const fixtures = JSON.parse(fs.readFileSync(path.join(projectRoot, 'tests', 'fixtures', 'risk-cases.json'), 'utf8'));

function evaluate(intake) {
  clearMove28ModuleCache();
  return loadScript('riskEngine').evaluateRisk(intake);
}

test('风险边界 fixtures 逐项得到精确等级、版本和有序理由', async (t) => {
  assert.ok(fixtures.length >= 20);
  for (const fixture of fixtures) {
    await t.test(fixture.name, () => {
      const result = evaluate(fixture.intake);
      const api=loadScript('riskEngine');
      assert.ok(result.reasons.every(reason=>api.REASON_CODES.includes(reason.code)));
      assert.equal(result.level, fixture.expectedLevel);
      assert.equal(result.ruleVersion, 'pilot-v2');
      assert.deepEqual(result.reasons.map(reason => reason.code), fixture.expectedReasonCodes);
      for (const reason of result.reasons) {
        assert.equal(typeof reason.code, 'string');
        assert.ok(reason.code.length > 0);
        assert.equal(typeof reason.field, 'string');
        assert.ok(reason.field.length > 0);
        assert.equal(typeof reason.message, 'string');
        assert.ok(reason.message.length > 0);
      }
      assert.equal(new Set(result.reasons.map(reason => `${reason.code}:${reason.field}`)).size, result.reasons.length);
    });
  }
});

test('明显肿胀与基础活动能力限制进入正式人工复核理由', () => {
  const cases = [
    ['visibleSwelling', 'yes', 'visibleSwelling_reported'],
    ['dailyActivityLimited', 'yes', 'dailyActivityLimited_reported'],
    ['chairStand', 'no', 'chairStand_limited'],
    ['walkTenMinutes', 'unsure', 'walkTenMinutes_uncertain']
  ];
  for (const [field, value, code] of cases) {
    const result = evaluate({ age: 30, redFlags: false, [field]: value });
    assert.equal(result.level, 'manual_review');
    assert.ok(result.reasons.some(reason => reason.code === code && reason.field === field));
  }
});

test('三条核心分流断言不可回归', () => {
  assert.equal(evaluate({ age: 30, redFlags: false, chestSymptoms: 'yes' }).level, 'stop');
  assert.equal(evaluate({ age: 15, redFlags: false }).level, 'manual_review');
  assert.equal(evaluate({ age: 17, redFlags: false }).level, 'normal');
});

test('年龄仅接受 0～120 的安全整数，并导出产品输入边界', () => {
  const api = loadScript('riskEngine');
  assert.equal(api.MIN_AGE, 0);
  assert.equal(api.MAX_AGE, 120);
  for (const age of [-1, 121, 1e100, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    const result = api.evaluateRisk({ age, redFlags: false });
    assert.notEqual(result.level, 'normal');
    assert.ok(result.reasons.some(reason => reason.code === 'age_out_of_range'));
  }
  const minimum = api.evaluateRisk({ age: 0, redFlags: false });
  assert.equal(minimum.level, 'manual_review');
  assert.ok(minimum.reasons.some(reason => reason.code === 'age_below_16'));
  assert.equal(minimum.reasons.some(reason => reason.code === 'age_out_of_range'), false);
  assert.equal(api.evaluateRisk({ age: 120, redFlags: false }).level, 'normal');
  assert.equal(api.evaluateRisk({ age: 16, redFlags: false }).level, 'normal');
  assert.equal(api.evaluateRisk({ age: 17, redFlags: false }).level, 'normal');
});

test('固定优先级确保低风险规则不能覆盖高风险，且所有理由保留', () => {
  const api = loadScript('riskEngine');
  assert.deepEqual(api.PRIORITY, { normal: 0, conservative: 1, manual_review: 2, stop: 3 });
  assert.deepEqual(api.RISK_LEVELS, ['normal', 'conservative', 'manual_review', 'stop']);
  const result = api.evaluateRisk({
    age: 15,
    redFlags: false,
    chestSymptoms: 'yes',
    complexCondition: 'yes',
    stablePain: 'mild_stable',
    activityStatus: 'inactive_long_term'
  });
  assert.equal(result.level, 'stop');
  assert.deepEqual(result.reasons.map(reason => reason.code), [
    'age_below_16',
    'chest_symptoms_reported',
    'complex_condition_reported',
    'stable_pain_mild',
    'activity_inactive_long_term'
  ]);
});

test('纯函数不修改输入、重复调用确定且结果深冻结', () => {
  const api = loadScript('riskEngine');
  const intake = { age: 30, redFlags: false, chestSymptoms: 'yes', nested: { private: '不应读取' } };
  const before = structuredClone(intake);
  const first = api.evaluateRisk(intake);
  const second = api.evaluateRisk(intake);
  assert.deepEqual(intake, before);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.reasons));
  assert.ok(first.reasons.every(Object.isFrozen));
  assert.throws(() => { first.level = 'normal'; }, TypeError);
  assert.throws(() => { first.reasons.push({}); }, TypeError);
});

test('恶意结构、非法年龄、非法枚举与缺失关键题不抛异常且不判 normal', () => {
  const malicious = [null, [], 'health=yes', 42, { age: NaN }, { age: Infinity }, { age: 30.5 },
    { age: 30, redFlags: false, chestSymptoms: 'invalid' },
    { age: 30, redFlags: false, pregnancyPostpartum: '' },
    { age: 30, redFlags: false, doctorRestriction: '__proto__' },
    { age: 30, redFlags: false, stablePain: 'unknown' },
    { age: 30 }
  ];
  for (const value of malicious) {
    let result;
    assert.doesNotThrow(() => { result = evaluate(value); });
    assert.notEqual(result.level, 'normal', JSON.stringify(value));
  }
  assert.equal(evaluate({ age: 30, redFlags: false, chestSymptoms: 'invalid' }).level, 'stop');
});

test('只接受自有数据属性，原型链字段与 Object.prototype 污染不能绕过筛查', () => {
  const inheritedRedFlags = Object.assign(Object.create({ redFlags: false }), { age: 30 });
  const inheritedResult = evaluate(inheritedRedFlags);
  assert.equal(inheritedResult.level, 'manual_review');
  assert.ok(inheritedResult.reasons.some(reason => reason.code === 'incomplete_safety_screen'));

  const inheritedBoth = Object.create({ age: 30, redFlags: false });
  const inheritedBothResult = evaluate(inheritedBoth);
  assert.equal(inheritedBothResult.level, 'manual_review');
  assert.ok(inheritedBothResult.reasons.some(reason => reason.code === 'age_invalid_or_missing'));
  assert.ok(inheritedBothResult.reasons.some(reason => reason.code === 'incomplete_safety_screen'));

  Object.prototype.redFlags = false;
  try {
    const pollutedResult = evaluate({ age: 30 });
    assert.notEqual(pollutedResult.level, 'normal');
    assert.ok(pollutedResult.reasons.some(reason => reason.code === 'incomplete_safety_screen'));
  } finally {
    delete Object.prototype.redFlags;
  }
});

test('原型上的停止字段不作为自有命中，但缺失筛查仍需人工复核', () => {
  const result = evaluate(Object.assign(Object.create({ chestSymptoms: 'yes' }), { age: 30 }));
  assert.equal(result.level, 'manual_review');
  assert.ok(result.reasons.some(reason => reason.code === 'incomplete_safety_screen'));
  assert.equal(result.reasons.some(reason => reason.code === 'chest_symptoms_reported'), false);
});

test('恶意 getter 永不执行，已知字段不可读时固定人工复核且继续安全求值', () => {
  let ageCalls = 0;
  const ageGetter = { redFlags: false };
  Object.defineProperty(ageGetter, 'age', {
    enumerable: true,
    get() {
      ageCalls += 1;
      throw new Error('AGE_SECRET_THROW');
    }
  });
  let ageResult;
  assert.doesNotThrow(() => { ageResult = evaluate(ageGetter); });
  assert.equal(ageCalls, 0);
  assert.equal(ageResult.level, 'manual_review');
  assert.ok(ageResult.reasons.some(reason => reason.code === 'intake_unreadable' && reason.field === 'intake'));
  assert.ok(ageResult.reasons.some(reason => reason.code === 'age_invalid_or_missing'));

  let safetyCalls = 0;
  const safetyGetter = { age: 30 };
  Object.defineProperty(safetyGetter, 'chestSymptoms', {
    enumerable: true,
    get() {
      safetyCalls += 1;
      throw new Error('SAFETY_SECRET_THROW');
    }
  });
  const safetyResult = evaluate(safetyGetter);
  assert.equal(safetyCalls, 0);
  assert.equal(safetyResult.level, 'manual_review');
  assert.equal(safetyResult.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
  assert.ok(safetyResult.reasons.some(reason => reason.code === 'incomplete_safety_screen'));

  let unknownCalls = 0;
  const unknownGetter = { age: 30, redFlags: false };
  Object.defineProperty(unknownGetter, 'unknownHealthField', {
    enumerable: true,
    get() {
      unknownCalls += 1;
      throw new Error('UNKNOWN_SECRET_THROW');
    }
  });
  const unknownResult = evaluate(unknownGetter);
  assert.equal(unknownCalls, 0);
  assert.notEqual(unknownResult.level, 'normal');
  assert.equal(unknownResult.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
});

test('嵌套对象与更深层数组中的 getter 在 structuredClone 前被拒绝且零调用', () => {
  const objectSecret = 'NESTED_OBJECT_SECRET_84af';
  let objectCalls = 0;
  const nestedObject = {
    age: 30,
    redFlags: false,
    metadata: {
      get secret() {
        objectCalls += 1;
        throw new Error(objectSecret);
      }
    }
  };
  let objectResult;
  assert.doesNotThrow(() => { objectResult = evaluate(nestedObject); });
  assert.equal(objectCalls, 0);
  assert.equal(objectResult.level, 'manual_review');
  assert.equal(objectResult.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
  assert.equal(JSON.stringify(objectResult).includes(objectSecret), false);

  const arraySecret = 'DEEP_ARRAY_SECRET_54d2';
  let arrayCalls = 0;
  const nestedArray = { age: 30, redFlags: false, metadata: [{ deeper: [{}] }] };
  Object.defineProperty(nestedArray.metadata[0].deeper[0], 'secret', {
    enumerable: true,
    get() {
      arrayCalls += 1;
      throw new Error(arraySecret);
    }
  });
  let arrayResult;
  assert.doesNotThrow(() => { arrayResult = evaluate(nestedArray); });
  assert.equal(arrayCalls, 0);
  assert.equal(arrayResult.level, 'manual_review');
  assert.equal(arrayResult.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
  assert.equal(JSON.stringify(arrayResult).includes(arraySecret), false);
});

test('20,000 层无环 plain 对象不会耗尽遍历调用栈，克隆深度受限时 fail closed', () => {
  const metadata = {};
  let cursor = metadata;
  for (let depth = 0; depth < 20_000; depth += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }

  let result;
  assert.doesNotThrow(() => {
    result = evaluate({ age: 30, redFlags: false, metadata });
  });
  assert.equal(result.level, 'manual_review');
  assert.equal(result.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
});

test('嵌套 Proxy 与非 plain 对象均 fail closed', () => {
  const nestedProxy = { age: 30, redFlags: false, metadata: new Proxy({ source: 'self' }, {}) };
  const proxyResult = evaluate(nestedProxy);
  assert.equal(proxyResult.level, 'manual_review');
  assert.equal(proxyResult.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);

  for (const metadata of [new Date(0), new Map([['source', 'self']]), /health/u, new Uint8Array([1])]) {
    const result = evaluate({ age: 30, redFlags: false, metadata });
    assert.equal(result.level, 'manual_review');
    assert.equal(result.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
  }
});

test('抛异常的描述符 Proxy 与 revoked Proxy 均不抛、不判 normal 且不泄露异常文本', () => {
  const trapSecret = 'DESCRIPTOR_TRAP_SECRET_93ac';
  const throwingProxy = new Proxy({ age: 30, redFlags: false }, {
    getOwnPropertyDescriptor() {
      throw new Error(trapSecret);
    }
  });
  let throwingResult;
  assert.doesNotThrow(() => { throwingResult = evaluate(throwingProxy); });
  assert.notEqual(throwingResult.level, 'normal');
  assert.equal(JSON.stringify(throwingResult).includes(trapSecret), false);
  assert.equal(throwingResult.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);

  const revocable = Proxy.revocable({ age: 30, redFlags: false }, {});
  revocable.revoke();
  let revokedResult;
  assert.doesNotThrow(() => { revokedResult = evaluate(revocable.proxy); });
  assert.notEqual(revokedResult.level, 'normal');
  assert.ok(revokedResult.reasons.some(reason => reason.code === 'intake_unreadable'));
});

test('撒谎 Proxy 即使伪造安全描述符并隐藏停止值，也必须 canonical 门禁失败', () => {
  const target = { age: 30, redFlags: true, chestSymptoms: 'yes' };
  const lyingProxy = new Proxy(target, {
    ownKeys() {
      return ['age', 'redFlags'];
    },
    getOwnPropertyDescriptor(_target, key) {
      if (key === 'age') return { configurable: true, enumerable: true, writable: true, value: 30 };
      if (key === 'redFlags') return { configurable: true, enumerable: true, writable: true, value: false };
      return undefined;
    },
    getPrototypeOf() {
      return Object.prototype;
    }
  });
  const result = evaluate(lyingProxy);
  assert.notEqual(result.level, 'normal');
  assert.equal(result.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
});

test('普通 plain data、嵌套 data、循环与 null prototype 数据仍正常按规则求值', () => {
  assert.equal(evaluate({ age: 17, redFlags: false }).level, 'normal');
  assert.equal(evaluate({ age: 30, redFlags: false, metadata: { tags: ['beginner', { source: 'self' }] } }).level, 'normal');
  const nullPrototype = Object.assign(Object.create(null), { age: 30, redFlags: false, chestSymptoms: 'yes' });
  assert.equal(evaluate(nullPrototype).level, 'stop');

  const cyclic = { age: 30, redFlags: false };
  cyclic.self = cyclic;
  assert.equal(evaluate(cyclic).level, 'normal');
});

test('用户修改答案时重新计算，可由低到高及高到低变化且不缓存旧结论', () => {
  const api = loadScript('riskEngine');
  const intake = { age: 30, redFlags: false, activityStatus: 'active' };
  assert.equal(api.evaluateRisk(intake).level, 'normal');
  intake.chestSymptoms = 'yes';
  assert.equal(api.evaluateRisk(intake).level, 'stop');
  intake.chestSymptoms = 'no';
  intake.activityStatus = 'returning';
  assert.equal(api.evaluateRisk(intake).level, 'conservative');
  intake.activityStatus = 'active';
  assert.equal(api.evaluateRisk(intake).level, 'normal');
});

test('输出只包含公共契约，不泄露原始 intake 或额外健康值', () => {
  const secret = 'PRIVATE_HEALTH_VALUE_7f4c';
  const result = evaluate({ age: 30, redFlags: false, chestSymptoms: 'yes', privateNote: secret });
  assert.deepEqual(Object.keys(result), ['level', 'reasons', 'ruleVersion']);
  assert.ok(result.reasons.every(reason => assert.deepEqual(Object.keys(reason), ['code', 'field', 'message']) === undefined));
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(Object.values(result).includes(secret), false);
});

test('经典浏览器 script 加载安全并挂载到 Move28.domain，且不需要 DOM 或 storage', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src', 'domain', 'risk-engine.js'), 'utf8');
  const context = { globalThis: { structuredClone } };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(typeof context.globalThis.Move28.domain.evaluateRisk, 'function');
  assert.equal(context.globalThis.Move28.domain.evaluateRisk({ age: 17, redFlags: false }).level, 'normal');
});

test('经典浏览器环境缺少 structuredClone 时 fail closed', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'src', 'domain', 'risk-engine.js'), 'utf8');
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  const result = context.globalThis.Move28.domain.evaluateRisk({ age: 17, redFlags: false });
  assert.notEqual(result.level, 'normal');
  assert.equal(result.reasons.filter(reason => reason.code === 'intake_unreadable').length, 1);
});
