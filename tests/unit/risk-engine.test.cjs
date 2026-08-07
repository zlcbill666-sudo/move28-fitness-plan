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
      assert.equal(result.level, fixture.expectedLevel);
      assert.equal(result.ruleVersion, 'pilot-v1');
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

test('三条核心分流断言不可回归', () => {
  assert.equal(evaluate({ age: 30, redFlags: false, chestSymptoms: 'yes' }).level, 'stop');
  assert.equal(evaluate({ age: 15, redFlags: false }).level, 'manual_review');
  assert.equal(evaluate({ age: 17, redFlags: false }).level, 'normal');
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
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(typeof context.globalThis.Move28.domain.evaluateRisk, 'function');
  assert.equal(context.globalThis.Move28.domain.evaluateRisk({ age: 17, redFlags: false }).level, 'normal');
});
