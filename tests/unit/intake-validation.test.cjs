const assert = require('node:assert/strict');
const test = require('node:test');
const onboarding = require('../../src/ui/onboarding.js');

const safe = {
  boundaryAccepted:true, age:30, pregnancyPostpartum:'no', goal:'habit',
  activityDays:'3', walkCapacity:'20_40', strengthExperience:'some', trainingBreak:'no',
  daysPerWeek:'3', sessionMinutes:'30', weekdays:['mon','wed','fri'], gymOftenUnavailable:'no',
  setting:'home', equipment:['stable_chair','resistance_band'], allowSettingSwap:'yes',
  painAreas:['none'], painTrend:'none', acuteInjury:'no', unableToBearWeight:'no', visibleSwelling:'no', dailyActivityLimited:'no', chairStand:'yes', walkTenMinutes:'yes',
  chestSymptoms:'no', exertionalDizziness:'no', unexplainedFainting:'no', restingShortnessOfBreath:'no', unresolvedConcussion:'no',
  doctorRestriction:'none', recentSurgery:'no', complexCondition:'no', uncontrolledBloodPressure:'no',
  cardioPreference:'flat_walk', cardioAvoid:'none', avoidMovements:[], avoidEquipment:[], trackingItems:['completion','rpe','pain','sleep'], sessionPreference:'short_frequent', musicEnabled:'no', finalConfirmed:true
};

test('all ten steps validate a complete reviewed intake', () => {
  assert.equal(onboarding.STEPS.length, 10);
  for (const step of onboarding.STEPS) assert.deepEqual(onboarding.validateStep(step.id, safe), { ok:true, errors:[] }, step.id);
});

test('each step rejects missing required answers and accepts explicit uncertainty on safety screens', () => {
  for (const step of onboarding.STEPS) {
    const result = onboarding.validateStep(step.id, {});
    assert.equal(result.ok, false, `${step.id} must fail closed`);
    assert.ok(result.errors.length > 0);
  }
  const uncertain = { ...safe, chestSymptoms:'unsure', doctorRestriction:'unsure', recentSurgery:'unsure' };
  assert.equal(onboarding.validateStep('safety', uncertain).ok, true);
  assert.notEqual(onboarding.evaluateOnboarding(uncertain).risk.level, 'normal');
});

test('numeric bounds, pain mutual exclusion and schedule defaults are enforced', () => {
  assert.equal(onboarding.validateStep('basics', { ...safe, age:121 }).ok, false);
  assert.equal(onboarding.validateStep('basics', { ...safe, age:30.5 }).ok, false);
  assert.equal(onboarding.validateStep('basics', { ...safe, heightCm:79 }).ok, false);
  assert.equal(onboarding.validateStep('movement', { ...safe, painAreas:['none','knee'] }).ok, false);
  assert.equal(onboarding.validateStep('movement', { ...safe, painAreas:['knee'], painScore:11 }).ok, false);
  assert.equal(onboarding.validateStep('schedule', { ...safe, weekdays:undefined }).ok, true);
  assert.equal(onboarding.validateStep('schedule', { ...safe, daysPerWeek:'3', weekdays:['mon'] }).ok, true);
  assert.deepEqual(onboarding.defaultWeekdaysFor('3'), ['mon','wed','fri']);
  assert.equal(onboarding.evaluateOnboarding({ ...safe, daysPerWeek:'3', weekdays:['mon'] }).canGenerate, true);
});

test('equipment IDs are setting-scoped and home requires a stable chair', () => {
  assert.equal(onboarding.validateStep('equipment', { ...safe, equipment:['leg_press_machine'] }).ok, false);
  assert.equal(onboarding.validateStep('equipment', { ...safe, equipment:['resistance_band'] }).ok, false);
  assert.equal(onboarding.validateStep('equipment', safe).ok, true);
});

test('deriveRiskIntake uses only the Task 4 whitelist and maps activity and pain', () => {
  const derived = onboarding.deriveRiskIntake({ ...safe, name:'secret', phone:'secret', redFlags:false, painTrend:'mild_stable', trainingBreak:'yes', activityDays:'2' });
  assert.equal(derived.stablePain, 'mild_stable');
  assert.equal(derived.activityStatus, 'returning');
  assert.equal(Object.hasOwn(derived, 'name'), false);
  assert.equal(Object.hasOwn(derived, 'phone'), false);
  assert.equal(Object.hasOwn(derived, 'redFlags'), false);
  assert.deepEqual(Object.keys(derived).sort(), ['activityStatus','age','acuteInjury','chairStand','chestSymptoms','complexCondition','dailyActivityLimited','doctorRestriction','exertionalDizziness','pregnancyPostpartum','recentSurgery','restingShortnessOfBreath','stablePain','unableToBearWeight','uncontrolledBloodPressure','unexplainedFainting','unresolvedConcussion','visibleSwelling','walkTenMinutes'].sort());
});

test('age routing preserves risk level while applying pilot eligibility separately', () => {
  const age15 = onboarding.evaluateOnboarding({ ...safe, age:15 });
  assert.equal(age15.risk.level, 'manual_review');
  assert.equal(age15.canGenerate, false);
  const age17 = onboarding.evaluateOnboarding({ ...safe, age:17 });
  assert.equal(age17.risk.level, 'normal');
  assert.equal(age17.pilotEligible, true);
  assert.equal(age17.canGenerate, true);
  const adult = onboarding.evaluateOnboarding(safe);
  assert.equal(adult.risk.level, 'normal');
  assert.equal(adult.canGenerate, true);
});

test('明显肿胀与基础活动受限进入正式人工审核理由', () => {
  const limited = onboarding.evaluateOnboarding({ ...safe, dailyActivityLimited:'yes' });
  assert.equal(limited.risk.level, 'manual_review');
  assert.ok(limited.risk.reasons.some(reason => reason.code === 'dailyActivityLimited_reported'));
  assert.equal(limited.canGenerate, false);
  const uncertainWalk = onboarding.evaluateOnboarding({ ...safe, walkTenMinutes:'unsure' });
  assert.equal(uncertainWalk.risk.level, 'manual_review');
  assert.equal(uncertainWalk.canGenerate, false);
  const swelling = onboarding.evaluateOnboarding({ ...safe, visibleSwelling:'yes' });
  assert.equal(swelling.risk.level, 'manual_review');
  assert.ok(swelling.risk.reasons.some(reason => reason.code === 'visibleSwelling_reported'));
});

test('完整门禁阻止跳过步骤，schema gate 丢弃未知字段且不读取 getter', () => {
  const incomplete = { ...safe };
  delete incomplete.goal;
  assert.equal(onboarding.validateAll(incomplete).ok, false);
  assert.equal(onboarding.evaluateOnboarding(incomplete).canGenerate, false);
  let getterRead = false;
  const hostile = { ...safe, name:'secret', phone:'secret' };
  Object.defineProperty(hostile, 'waistCm', { enumerable:true, get() { getterRead = true; return 90; } });
  const canonical = onboarding.sanitizeIntake(hostile);
  assert.equal(getterRead, false);
  assert.equal(Object.hasOwn(canonical, 'name'), false);
  assert.equal(Object.hasOwn(canonical, 'phone'), false);
  assert.equal(Object.hasOwn(canonical, 'waistCm'), false);
});

test('偏好屏采集有氧排斥、回避器械及四类记录意愿', () => {
  assert.equal(onboarding.validateStep('preferences', safe).ok, true);
  assert.equal(onboarding.validateStep('preferences', { ...safe, cardioAvoid:'flat_walk' }).ok, false);
  assert.equal(onboarding.validateStep('preferences', { ...safe, avoidEquipment:['leg_press_machine'] }).ok, false);
  assert.equal(onboarding.validateStep('preferences', { ...safe, trackingItems:undefined }).ok, false);
});

test('非安全三态问题允许明确选择不确定', () => {
  assert.equal(onboarding.validateStep('experience', { ...safe, trainingBreak:'unsure' }).ok, true);
  assert.equal(onboarding.evaluateOnboarding({ ...safe, trainingBreak:'unsure' }).risk.level, 'conservative');
  assert.equal(onboarding.validateStep('schedule', { ...safe, gymOftenUnavailable:'unsure' }).ok, true);
  assert.equal(onboarding.validateStep('equipment', { ...safe, allowSettingSwap:'unsure' }).ok, true);
  assert.equal(onboarding.validateStep('preferences', { ...safe, musicEnabled:'unsure' }).ok, true);
});

test('所有数组字段拒绝 accessor 和稀疏数组且零 getter 执行', () => {
  for (const field of ['weekdays','equipment','painAreas','avoidMovements','avoidEquipment','trackingItems']) {
    let reads = 0;
    const accessor = [];
    Object.defineProperty(accessor, 0, { enumerable:true, get() { reads += 1; return field === 'weekdays' ? 'mon' : 'none'; } });
    accessor.length = 1;
    const canonical = onboarding.sanitizeIntake({ ...safe, [field]:accessor });
    assert.equal(reads, 0, field);
    assert.equal(Object.hasOwn(canonical, field), false, field);
    const sparse = new Array(1);
    assert.equal(Object.hasOwn(onboarding.sanitizeIntake({ ...safe, [field]:sparse }), field), false, `${field} sparse`);
  }
});

test('stop and conservative answers are recalculated from current values, never cached', () => {
  const changed = { ...safe, chestSymptoms:'yes' };
  assert.equal(onboarding.evaluateOnboarding(changed).risk.level, 'stop');
  changed.chestSymptoms = 'no';
  assert.equal(onboarding.evaluateOnboarding(changed).risk.level, 'normal');
  changed.painTrend = 'mild_stable';
  assert.equal(onboarding.evaluateOnboarding(changed).risk.level, 'conservative');
  assert.equal(onboarding.evaluateOnboarding(changed).canGenerate, true);
});

test('summary omits unfilled optional measurements and contains no PII fields', () => {
  const risk = onboarding.evaluateOnboarding(safe).risk;
  const summary = onboarding.buildIntakeSummary({ ...safe, heightCm:undefined, weightKg:'', waistCm:null }, risk);
  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /height|weight|waist|name|phone|idcard|birthday/i);
  assert.match(serialized, /首要目标/);
  assert.match(serialized, /安全路由/);
  const filled = JSON.stringify(onboarding.buildIntakeSummary({ ...safe, heightCm:170, weightKg:80, waistCm:90 }, risk));
  assert.match(filled, /170厘米/);
  assert.match(filled, /80千克/);
  assert.match(filled, /90厘米/);
});

test('module can be required without document, window, localStorage or sessionStorage', () => {
  assert.equal(typeof onboarding.createOnboarding, 'function');
  assert.equal(onboarding.DRAFT_KEY, 'move28-onboarding-draft-v1');
});
