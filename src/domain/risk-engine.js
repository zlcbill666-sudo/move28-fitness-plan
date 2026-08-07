(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const Move28 = isCommonJS ? require('../namespace.js') : (root.Move28 = root.Move28 || {});
  const api = factory(root);
  Move28.domain = Object.assign(Move28.domain || {}, api);
  if (isCommonJS) module.exports = api;
})(globalThis, function(root) {
  'use strict';

  const nativeStructuredClone = typeof root.structuredClone === 'function'
    ? root.structuredClone.bind(root)
    : null;
  const RULE_VERSION = 'pilot-v1';
  const MIN_AGE = 0;
  const MAX_AGE = 120;
  const RISK_LEVELS = Object.freeze(['normal', 'conservative', 'manual_review', 'stop']);
  const PRIORITY = Object.freeze({ normal: 0, conservative: 1, manual_review: 2, stop: 3 });
  const TRI_STATE_VALUES = Object.freeze(['no', 'yes', 'unsure']);
  const DOCTOR_RESTRICTION_VALUES = Object.freeze(['none', 'clear_modification', 'unclear', 'prohibited', 'unsure']);
  const ACTIVITY_STATUS_VALUES = Object.freeze(['active', 'returning', 'inactive_long_term']);
  const STABLE_PAIN_VALUES = Object.freeze(['none', 'mild_stable', 'unsure', 'acute_or_worsening']);

  // 任何风险语义、理由码或理由顺序变化都必须升级 RULE_VERSION。
  // 字段顺序也是理由输出顺序的一部分。
  const STOP_FIELD_DEFINITIONS = Object.freeze([
    Object.freeze({ field: 'chestSymptoms', stem: 'chest_symptoms', label: '胸部症状' }),
    Object.freeze({ field: 'exertionalDizziness', stem: 'exertional_dizziness', label: '活动时头晕' }),
    Object.freeze({ field: 'unexplainedFainting', stem: 'unexplained_fainting', label: '不明原因晕厥' }),
    Object.freeze({ field: 'restingShortnessOfBreath', stem: 'resting_shortness_of_breath', label: '静息气短' }),
    Object.freeze({ field: 'acuteInjury', stem: 'acute_injury', label: '急性损伤' }),
    Object.freeze({ field: 'unableToBearWeight', stem: 'unable_to_bear_weight', label: '无法承重' }),
    Object.freeze({ field: 'unresolvedConcussion', stem: 'unresolved_concussion', label: '未恢复脑震荡' })
  ]);
  const MANUAL_FIELD_DEFINITIONS = Object.freeze([
    Object.freeze({ field: 'pregnancyPostpartum', stem: 'pregnancy_postpartum', label: '孕产期情况' }),
    Object.freeze({ field: 'recentSurgery', stem: 'recent_surgery', label: '近期手术' }),
    Object.freeze({ field: 'complexCondition', stem: 'complex_condition', label: '复杂健康情况' }),
    Object.freeze({ field: 'uncontrolledBloodPressure', stem: 'uncontrolled_blood_pressure', label: '未控制血压' })
  ]);
  const STOP_FIELDS = Object.freeze(STOP_FIELD_DEFINITIONS.map(item => item.field));
  const MANUAL_REVIEW_FIELDS = Object.freeze(MANUAL_FIELD_DEFINITIONS.map(item => item.field));
  const SAFETY_SCREEN_FIELDS = Object.freeze([
    ...STOP_FIELDS,
    'doctorRestriction',
    ...MANUAL_REVIEW_FIELDS,
    'stablePain'
  ]);
  const KNOWN_INTAKE_FIELDS = Object.freeze([
    'age',
    'redFlags',
    ...STOP_FIELDS,
    'doctorRestriction',
    ...MANUAL_REVIEW_FIELDS,
    'stablePain',
    'activityStatus'
  ]);

  function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) deepFreeze(nested);
    return Object.freeze(value);
  }

  function isCanonicalCloneGraph(value, seen = new WeakSet()) {
    if (value === null || typeof value !== 'object') return typeof value !== 'function';
    if (seen.has(value)) return true;

    let isArray;
    let prototype;
    let ownKeys;
    try {
      isArray = Array.isArray(value);
      prototype = Object.getPrototypeOf(value);
      ownKeys = Reflect.ownKeys(value);
    } catch (_error) {
      return false;
    }

    if (!isArray && prototype !== null) {
      try {
        if (Object.getPrototypeOf(prototype) !== null) return false;
        const constructorDescriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
        if (constructorDescriptor === undefined
          || !Object.prototype.hasOwnProperty.call(constructorDescriptor, 'value')
          || typeof constructorDescriptor.value !== 'function') return false;
      } catch (_error) {
        return false;
      }
    }

    seen.add(value);
    for (const key of ownKeys) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch (_error) {
        return false;
      }
      if (descriptor === undefined
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || !isCanonicalCloneGraph(descriptor.value, seen)) return false;
    }
    return true;
  }

  function evaluateRisk(intake) {
    const reasons = [];
    const seenReasons = new Set();
    let level = 'normal';

    function add(nextLevel, code, field, message) {
      const identity = `${code}:${field}`;
      if (!seenReasons.has(identity)) {
        seenReasons.add(identity);
        reasons.push({ code, field, message });
      }
      if (PRIORITY[nextLevel] > PRIORITY[level]) level = nextLevel;
    }

    // 先递归检查整个可达图均由 plain data descriptor 组成，再调用初始化时捕获的
    // structuredClone 拒绝 Proxy 和不可克隆值。规则只读取顶层白名单描述符快照。
    const source = Object.create(null);
    const presentFields = new Set();
    const descriptors = new Map();
    let intakeUnreadable = false;
    let canReadProperties = intake !== null && typeof intake === 'object';
    if (canReadProperties) {
      try {
        if (Array.isArray(intake)) canReadProperties = false;
      } catch (_error) {
        canReadProperties = false;
        intakeUnreadable = true;
      }
    }

    if (!canReadProperties) {
      if (intake !== null && typeof intake === 'object') intakeUnreadable = true;
    } else {
      let ownKeys = [];
      try {
        ownKeys = Reflect.ownKeys(intake);
      } catch (_error) {
        intakeUnreadable = true;
      }

      for (const key of ownKeys) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(intake, key);
          if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            intakeUnreadable = true;
          } else {
            descriptors.set(key, descriptor);
          }
        } catch (_error) {
          intakeUnreadable = true;
        }
      }

      if (!intakeUnreadable && !isCanonicalCloneGraph(intake)) {
        intakeUnreadable = true;
      }

      if (!intakeUnreadable) {
        if (nativeStructuredClone === null) {
          intakeUnreadable = true;
        } else {
          try {
            nativeStructuredClone(intake);
          } catch (_error) {
            intakeUnreadable = true;
          }
        }
      }

      for (const field of KNOWN_INTAKE_FIELDS) {
        const descriptor = descriptors.get(field);
        if (descriptor === undefined) continue;
        presentFields.add(field);
        source[field] = descriptor.value;
      }
    }

    if (intakeUnreadable) {
      add('manual_review', 'intake_unreadable', 'intake', '部分输入无法安全读取，需要人工复核。');
    }

    if (!presentFields.has('age') || typeof source.age !== 'number' || Number.isNaN(source.age)) {
      add('manual_review', 'age_invalid_or_missing', 'age', '年龄缺失或不是有限整数，需要人工复核。');
    } else if (!Number.isSafeInteger(source.age) || source.age < MIN_AGE || source.age > MAX_AGE) {
      add('manual_review', 'age_out_of_range', 'age', '年龄超出产品支持的有效输入范围，需要人工复核。');
    } else if (source.age < 16) {
      add('manual_review', 'age_below_16', 'age', '年龄低于16岁，需要人工复核。');
    }

    const hasRedFlags = presentFields.has('redFlags');
    if (hasRedFlags) {
      if (source.redFlags === true) {
        add('stop', 'red_flags_reported', 'redFlags', '已报告健康红旗，应停止自动生成计划。');
      } else if (source.redFlags !== false) {
        add('manual_review', 'red_flags_invalid', 'redFlags', '红旗汇总值无效，需要人工复核。');
      }
    }

    const detailedScreenComplete = SAFETY_SCREEN_FIELDS.every(field => presentFields.has(field));
    if (source.redFlags !== false && !detailedScreenComplete) {
      add('manual_review', 'incomplete_safety_screen', 'safetyScreen', '安全筛查不完整，不能默认为安全。');
    }

    for (const definition of STOP_FIELD_DEFINITIONS) {
      if (!presentFields.has(definition.field)) continue;
      const value = source[definition.field];
      if (value === 'yes') {
        add('stop', `${definition.stem}_reported`, definition.field, `已报告${definition.label}，应停止自动生成计划。`);
      } else if (value === 'unsure') {
        add('stop', `${definition.stem}_uncertain`, definition.field, `${definition.label}不确定，按停止风险处理。`);
      } else if (!TRI_STATE_VALUES.includes(value)) {
        add('stop', `${definition.stem}_invalid`, definition.field, `${definition.label}答案无效，按不确定的停止风险处理。`);
      }
    }

    if (presentFields.has('doctorRestriction')) {
      const restriction = source.doctorRestriction;
      if (restriction === 'clear_modification') {
        add('manual_review', 'doctor_restriction_clear_modification', 'doctorRestriction', '医生要求明确调整，需要人工复核。');
      } else if (restriction === 'unclear') {
        add('stop', 'doctor_restriction_unclear', 'doctorRestriction', '医生限制边界不明，应停止自动生成计划。');
      } else if (restriction === 'prohibited') {
        add('stop', 'doctor_restriction_prohibited', 'doctorRestriction', '医生已明确禁止，应停止自动生成计划。');
      } else if (restriction === 'unsure') {
        add('manual_review', 'doctor_restriction_uncertain', 'doctorRestriction', '是否存在医生限制不确定，需要人工复核。');
      } else if (!DOCTOR_RESTRICTION_VALUES.includes(restriction)) {
        add('manual_review', 'doctor_restriction_invalid', 'doctorRestriction', '医生限制答案无效，需要人工复核。');
      }
    }

    for (const definition of MANUAL_FIELD_DEFINITIONS) {
      if (!presentFields.has(definition.field)) continue;
      const value = source[definition.field];
      if (value === 'yes') {
        add('manual_review', `${definition.stem}_reported`, definition.field, `已报告${definition.label}，需要人工复核。`);
      } else if (value === 'unsure') {
        add('manual_review', `${definition.stem}_uncertain`, definition.field, `${definition.label}不确定，需要人工复核。`);
      } else if (!TRI_STATE_VALUES.includes(value)) {
        add('manual_review', `${definition.stem}_invalid`, definition.field, `${definition.label}答案无效，按不确定风险人工复核。`);
      }
    }

    if (presentFields.has('stablePain')) {
      const pain = source.stablePain;
      if (pain === 'mild_stable') {
        add('conservative', 'stable_pain_mild', 'stablePain', '存在轻度稳定疼痛，应采用保守方案。');
      } else if (pain === 'unsure') {
        add('manual_review', 'stable_pain_uncertain', 'stablePain', '疼痛状态不确定，需要人工复核。');
      } else if (pain === 'acute_or_worsening') {
        add('stop', 'stable_pain_acute_or_worsening', 'stablePain', '疼痛急性或正在加重，应停止自动生成计划。');
      } else if (!STABLE_PAIN_VALUES.includes(pain)) {
        add('manual_review', 'stable_pain_invalid', 'stablePain', '疼痛答案无效，按不确定风险人工复核。');
      }
    }

    if (presentFields.has('activityStatus')) {
      const activity = source.activityStatus;
      if (activity === 'returning') {
        add('conservative', 'activity_returning', 'activityStatus', '正在恢复训练，应采用保守方案。');
      } else if (activity === 'inactive_long_term') {
        add('conservative', 'activity_inactive_long_term', 'activityStatus', '长期不活动，应采用保守方案。');
      } else if (!ACTIVITY_STATUS_VALUES.includes(activity)) {
        add('manual_review', 'activity_status_invalid', 'activityStatus', '活动状态答案无效，需要人工复核。');
      }
    }

    return deepFreeze({ level, reasons, ruleVersion: RULE_VERSION });
  }

  return Object.freeze({
    evaluateRisk,
    PRIORITY,
    RULE_VERSION,
    MIN_AGE,
    MAX_AGE,
    RISK_LEVELS,
    TRI_STATE_VALUES,
    DOCTOR_RESTRICTION_VALUES,
    ACTIVITY_STATUS_VALUES,
    STABLE_PAIN_VALUES,
    STOP_FIELDS,
    MANUAL_REVIEW_FIELDS,
    SAFETY_SCREEN_FIELDS
  });
});
