(function(root, factory) {
  'use strict';
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
  const nativeObjectPrototype = Object.prototype;
  const safeObjectValues = Object.values;
  const safeObjectFreeze = Object.freeze;
  const hasOwn = Function.call.bind(nativeObjectPrototype.hasOwnProperty);
  const PROFILE_FIELDS = Object.freeze([
    'version', 'completed', 'chairRise', 'wallPushup', 'wallHinge', 'floorAccess', 'walkTolerance'
  ]);
  const DANGEROUS_KEYS = Object.freeze(['__proto__', 'prototype', 'constructor']);
  const STATUS_PRIORITY = Object.freeze({ normal: 0, conservative: 1, manual_review: 2, stop: 3 });
  const ENUMS = Object.freeze({
    chairRise: Object.freeze(['independent_controlled', 'hands_supported', 'unable_or_painful', 'not_attempted']),
    wallPushup: Object.freeze(['controlled', 'limited_range', 'painful_or_unstable', 'not_attempted']),
    wallHinge: Object.freeze(['controlled', 'limited_range', 'painful_or_unstable', 'not_attempted']),
    floorAccess: Object.freeze(['comfortable', 'needs_support', 'avoid_floor', 'not_attempted']),
    walkTolerance: Object.freeze(['comfortable', 'fatigued_but_stable', 'warning_symptom', 'not_attempted'])
  });

  function deepFreeze(value) {
    const nestedValues = safeObjectValues(value);
    for (let index = 0; index < nestedValues.length; index += 1) {
      const nested = nestedValues[index];
      if (nested !== null && typeof nested === 'object') deepFreeze(nested);
    }
    return safeObjectFreeze(value);
  }

  function invalidResult() {
    return deepFreeze({
      status: 'manual_review',
      difficultyCap: 1,
      exclusions: ['floor', 'hinge'],
      variants: { knee_dominant: 'high_seat', horizontal_push: 'close_wall' },
      cardioStartMinutes: 0,
      reasonCodes: ['INVALID_INPUT']
    });
  }

  function isPlainRecord(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype === nativeObjectPrototype;
  }

  // 在 clone gate 前只通过反射描述符遍历；不会读取调用方属性，也不会执行 getter。
  function validateReachablePlainData(start) {
    const pending = [start];
    const seen = new WeakSet();
    let visited = 0;

    while (pending.length > 0) {
      const value = pending.pop();
      const type = typeof value;
      if (value === null || type === 'string' || type === 'boolean') continue;
      if (type === 'number') {
        if (!Number.isFinite(value)) return false;
        continue;
      }
      if (type !== 'object') return false;
      if (seen.has(value)) return false;
      seen.add(value);
      visited += 1;
      if (visited > 64) return false;

      const isArray = Array.isArray(value);
      if (!isArray && !isPlainRecord(value)) return false;
      const keys = Reflect.ownKeys(value);
      const descriptors = new Map();
      for (const key of keys) {
        if (typeof key !== 'string' || DANGEROUS_KEYS.includes(key)) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !hasOwn(descriptor, 'value')) return false;
        descriptors.set(key, descriptor);
      }

      if (isArray) {
        const lengthDescriptor = descriptors.get('length');
        if (!lengthDescriptor || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || lengthDescriptor.value > 64) return false;
        if (keys.length !== lengthDescriptor.value + 1) return false;
        for (let index = 0; index < lengthDescriptor.value; index += 1) {
          const descriptor = descriptors.get(String(index));
          if (!descriptor) return false;
          pending.push(descriptor.value);
        }
      } else {
        for (const descriptor of descriptors.values()) pending.push(descriptor.value);
      }
    }
    return true;
  }

  function snapshotProfile(profile) {
    try {
      if (!nativeStructuredClone || !isPlainRecord(profile) || !validateReachablePlainData(profile)) return null;
      nativeStructuredClone(profile); // Proxy/uncloneable gate；规则不读取 clone 结果。

      const keys = Reflect.ownKeys(profile);
      if (keys.length !== PROFILE_FIELDS.length || keys.some(key => typeof key !== 'string' || !PROFILE_FIELDS.includes(key))) return null;
      const snapshot = Object.create(null);
      for (const field of PROFILE_FIELDS) {
        const descriptor = Object.getOwnPropertyDescriptor(profile, field);
        if (!descriptor || !hasOwn(descriptor, 'value')) return null;
        snapshot[field] = descriptor.value;
      }
      if (snapshot.version !== 1 || snapshot.completed !== true) return null;
      for (const field of Object.keys(ENUMS)) {
        if (!ENUMS[field].includes(snapshot[field])) return null;
      }
      return snapshot;
    } catch (_error) {
      return null;
    }
  }

  function evaluateCapabilityProfile(profile) {
    const source = snapshotProfile(profile);
    if (source === null) return invalidResult();

    let status = 'normal';
    const reasonCodes = [];
    function add(nextStatus, reasonCode) {
      if (!reasonCodes.includes(reasonCode)) reasonCodes.push(reasonCode);
      if (STATUS_PRIORITY[nextStatus] > STATUS_PRIORITY[status]) status = nextStatus;
    }

    if (source.chairRise === 'hands_supported') add('conservative', 'CHAIR_RISE_HANDS_SUPPORTED');
    else if (source.chairRise === 'unable_or_painful') add('manual_review', 'CHAIR_RISE_UNABLE_OR_PAINFUL');
    else if (source.chairRise === 'not_attempted') add('conservative', 'CHAIR_RISE_NOT_ATTEMPTED');

    if (source.wallPushup === 'limited_range') add('conservative', 'WALL_PUSHUP_LIMITED_RANGE');
    else if (source.wallPushup === 'painful_or_unstable') add('manual_review', 'WALL_PUSHUP_PAINFUL_OR_UNSTABLE');
    else if (source.wallPushup === 'not_attempted') add('conservative', 'WALL_PUSHUP_NOT_ATTEMPTED');

    if (source.wallHinge === 'limited_range') add('conservative', 'WALL_HINGE_LIMITED_RANGE');
    else if (source.wallHinge === 'painful_or_unstable') add('manual_review', 'WALL_HINGE_PAINFUL_OR_UNSTABLE');
    else if (source.wallHinge === 'not_attempted') add('conservative', 'WALL_HINGE_NOT_ATTEMPTED');

    if (source.floorAccess === 'needs_support') add('conservative', 'FLOOR_ACCESS_NEEDS_SUPPORT');
    else if (source.floorAccess === 'avoid_floor') add('conservative', 'FLOOR_ACCESS_AVOID_FLOOR');
    else if (source.floorAccess === 'not_attempted') add('conservative', 'FLOOR_ACCESS_NOT_ATTEMPTED');

    if (source.walkTolerance === 'fatigued_but_stable') add('conservative', 'WALK_TOLERANCE_FATIGUED_BUT_STABLE');
    else if (source.walkTolerance === 'warning_symptom') add('stop', 'WALK_TOLERANCE_WARNING_SYMPTOM');
    else if (source.walkTolerance === 'not_attempted') add('conservative', 'WALK_TOLERANCE_NOT_ATTEMPTED');

    const exclusions = [];
    if (source.floorAccess !== 'comfortable') exclusions.push('floor');
    if (source.wallHinge !== 'controlled') exclusions.push('hinge');

    return deepFreeze({
      status,
      difficultyCap: status === 'normal' ? 2 : 1,
      exclusions,
      variants: {
        knee_dominant: source.chairRise === 'independent_controlled' ? 'standard' : 'high_seat',
        horizontal_push: source.wallPushup === 'controlled' ? 'standard' : 'close_wall'
      },
      cardioStartMinutes: source.walkTolerance === 'comfortable'
        ? 15
        : source.walkTolerance === 'warning_symptom' ? 0 : 8,
      reasonCodes
    });
  }

  return Object.freeze({ evaluateCapabilityProfile });
});
