(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const Move28 = isCommonJS ? require('../namespace.js') : (root.Move28 = root.Move28 || {});
  const api = factory();
  Move28.domain = Object.assign(Move28.domain || {}, api);
  if (isCommonJS) module.exports = api;
})(globalThis, function() {
  'use strict';

  const RULE_VERSION = 'pilot-v1';
  const RISK_LEVELS = Object.freeze(['normal', 'conservative', 'manual_review', 'stop']);
  const PRIORITY = Object.freeze({ normal: 0, conservative: 1, manual_review: 2, stop: 3 });
  const TRI_STATE_VALUES = Object.freeze(['no', 'yes', 'unsure']);
  const DOCTOR_RESTRICTION_VALUES = Object.freeze(['none', 'clear_modification', 'unclear', 'prohibited', 'unsure']);
  const ACTIVITY_STATUS_VALUES = Object.freeze(['active', 'returning', 'inactive_long_term']);
  const STABLE_PAIN_VALUES = Object.freeze(['none', 'mild_stable', 'unsure', 'acute_or_worsening']);

  // 字段顺序也是理由输出顺序的一部分；修改顺序必须升级规则版本。
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

  function deepFreeze(value) {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) deepFreeze(nested);
    return Object.freeze(value);
  }

  function evaluateRisk(intake) {
    const source = intake !== null && typeof intake === 'object' && !Array.isArray(intake) ? intake : {};
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

    if (!Number.isFinite(source.age) || !Number.isInteger(source.age)) {
      add('manual_review', 'age_invalid_or_missing', 'age', '年龄缺失或不是有限整数，需要人工复核。');
    } else if (source.age < 16) {
      add('manual_review', 'age_below_16', 'age', '年龄低于16岁，需要人工复核。');
    }

    const hasRedFlags = Object.hasOwn(source, 'redFlags');
    if (hasRedFlags) {
      if (source.redFlags === true) {
        add('stop', 'red_flags_reported', 'redFlags', '已报告健康红旗，应停止自动生成计划。');
      } else if (source.redFlags !== false) {
        add('manual_review', 'red_flags_invalid', 'redFlags', '红旗汇总值无效，需要人工复核。');
      }
    }

    const detailedScreenComplete = SAFETY_SCREEN_FIELDS.every(field => Object.hasOwn(source, field));
    if (source.redFlags !== false && !detailedScreenComplete) {
      add('manual_review', 'incomplete_safety_screen', 'safetyScreen', '安全筛查不完整，不能默认为安全。');
    }

    for (const definition of STOP_FIELD_DEFINITIONS) {
      if (!Object.hasOwn(source, definition.field)) continue;
      const value = source[definition.field];
      if (value === 'yes') {
        add('stop', `${definition.stem}_reported`, definition.field, `已报告${definition.label}，应停止自动生成计划。`);
      } else if (value === 'unsure') {
        add('stop', `${definition.stem}_uncertain`, definition.field, `${definition.label}不确定，按停止风险处理。`);
      } else if (value !== 'no') {
        add('stop', `${definition.stem}_invalid`, definition.field, `${definition.label}答案无效，按不确定的停止风险处理。`);
      }
    }

    if (Object.hasOwn(source, 'doctorRestriction')) {
      const restriction = source.doctorRestriction;
      if (restriction === 'clear_modification') {
        add('manual_review', 'doctor_restriction_clear_modification', 'doctorRestriction', '医生要求明确调整，需要人工复核。');
      } else if (restriction === 'unclear') {
        add('stop', 'doctor_restriction_unclear', 'doctorRestriction', '医生限制边界不明，应停止自动生成计划。');
      } else if (restriction === 'prohibited') {
        add('stop', 'doctor_restriction_prohibited', 'doctorRestriction', '医生已明确禁止，应停止自动生成计划。');
      } else if (restriction === 'unsure') {
        add('manual_review', 'doctor_restriction_uncertain', 'doctorRestriction', '是否存在医生限制不确定，需要人工复核。');
      } else if (restriction !== 'none') {
        add('manual_review', 'doctor_restriction_invalid', 'doctorRestriction', '医生限制答案无效，需要人工复核。');
      }
    }

    for (const definition of MANUAL_FIELD_DEFINITIONS) {
      if (!Object.hasOwn(source, definition.field)) continue;
      const value = source[definition.field];
      if (value === 'yes') {
        add('manual_review', `${definition.stem}_reported`, definition.field, `已报告${definition.label}，需要人工复核。`);
      } else if (value === 'unsure') {
        add('manual_review', `${definition.stem}_uncertain`, definition.field, `${definition.label}不确定，需要人工复核。`);
      } else if (value !== 'no') {
        add('manual_review', `${definition.stem}_invalid`, definition.field, `${definition.label}答案无效，按不确定风险人工复核。`);
      }
    }

    if (Object.hasOwn(source, 'stablePain')) {
      const pain = source.stablePain;
      if (pain === 'mild_stable') {
        add('conservative', 'stable_pain_mild', 'stablePain', '存在轻度稳定疼痛，应采用保守方案。');
      } else if (pain === 'unsure') {
        add('manual_review', 'stable_pain_uncertain', 'stablePain', '疼痛状态不确定，需要人工复核。');
      } else if (pain === 'acute_or_worsening') {
        add('stop', 'stable_pain_acute_or_worsening', 'stablePain', '疼痛急性或正在加重，应停止自动生成计划。');
      } else if (pain !== 'none') {
        add('manual_review', 'stable_pain_invalid', 'stablePain', '疼痛答案无效，按不确定风险人工复核。');
      }
    }

    if (Object.hasOwn(source, 'activityStatus')) {
      const activity = source.activityStatus;
      if (activity === 'returning') {
        add('conservative', 'activity_returning', 'activityStatus', '正在恢复训练，应采用保守方案。');
      } else if (activity === 'inactive_long_term') {
        add('conservative', 'activity_inactive_long_term', 'activityStatus', '长期不活动，应采用保守方案。');
      } else if (activity !== 'active') {
        add('manual_review', 'activity_status_invalid', 'activityStatus', '活动状态答案无效，需要人工复核。');
      }
    }

    return deepFreeze({ level, reasons, ruleVersion: RULE_VERSION });
  }

  return Object.freeze({
    evaluateRisk,
    PRIORITY,
    RULE_VERSION,
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
