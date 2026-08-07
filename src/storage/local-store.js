(function(root, factory) {
  const api = factory(root);
  const isCommonJS = typeof module === 'object' && module.exports;
  if (isCommonJS) {
    module.exports = api;
  } else {
    const Move28 = root.Move28 = root.Move28 || {};
    Move28.storage = api;
  }
})(globalThis, function(root) {
  'use strict';

  const STORAGE_KEY = 'move28-pilot-v1';
  const SCHEMA_VERSION = 1;
  const CONSENT_VERSION = 'pilot-v1';
  const OWNED_KEYS = Object.freeze([STORAGE_KEY]);
  const INVALID_DATA_MESSAGE = 'Invalid plain data';
  const SAVE_ERROR_MESSAGE = 'Unable to save local participant state';
  const RISK_LEVELS = new Set(['normal', 'conservative', 'manual_review', 'stop']);
  const PARTICIPANT_ID_PATTERN = /^pilot-[a-z0-9]{1,12}$/;
  const MACHINE_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
  const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const MAX_LOCAL_REASON_MESSAGE_LENGTH = 512;
  let nativeStructuredClone = null;

  try {
    if (typeof root.structuredClone === 'function') {
      nativeStructuredClone = root.structuredClone.bind(root);
    }
  } catch (_error) {
    nativeStructuredClone = null;
  }

  function normalizeParticipantId(value) {
    return typeof value === 'string' && PARTICIPANT_ID_PATTERN.test(value)
      ? value
      : 'pilot-local';
  }

  function sanitizeMachineId(value) {
    return typeof value === 'string' && MACHINE_ID_PATTERN.test(value) ? value : null;
  }

  function createDefaultState(participantId) {
    return {
      schemaVersion: SCHEMA_VERSION,
      participantId: normalizeParticipantId(participantId),
      intake: null,
      intakeRevision: 0,
      risk: null,
      plan: null,
      logs: {},
      weeklyReviews: [],
      consent: { acceptedAt: null, version: CONSENT_VERSION }
    };
  }

  function invalidPlainData() {
    return new TypeError(INVALID_DATA_MESSAGE);
  }

  function inspectPlainObject(value) {
    const isArray = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (isArray) {
      if (prototype !== Array.prototype) throw invalidPlainData();
    } else if (prototype !== Object.prototype && prototype !== null) {
      throw invalidPlainData();
    }

    const keys = Reflect.ownKeys(value);
    const entries = [];
    if (isArray) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) {
        throw invalidPlainData();
      }
      const length = lengthDescriptor.value;
      for (const key of keys) {
        if (key === 'length') continue;
        if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
          throw invalidPlainData();
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          throw invalidPlainData();
        }
        entries.push([key, descriptor.value]);
      }
      if (entries.length !== length) throw invalidPlainData();
      entries.sort((a, b) => Number(a[0]) - Number(b[0]));
      return { isArray, entries };
    }

    for (const key of keys) {
      if (typeof key !== 'string') throw invalidPlainData();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw invalidPlainData();
      }
      entries.push([key, descriptor.value]);
    }
    return { isArray, entries };
  }

  function validatePrimitive(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    throw invalidPlainData();
  }

  function validatePlainGraph(value) {
    const active = new WeakSet();
    const validated = new WeakSet();
    const stack = [{ value, leaving: false }];

    while (stack.length > 0) {
      const frame = stack.pop();
      const current = frame.value;
      if (current === null || typeof current !== 'object') {
        validatePrimitive(current);
        continue;
      }
      if (frame.leaving) {
        active.delete(current);
        validated.add(current);
        continue;
      }
      if (active.has(current)) throw invalidPlainData();
      if (validated.has(current)) continue;
      active.add(current);
      const inspected = inspectPlainObject(current);
      stack.push({ value: current, leaving: true });
      for (let index = inspected.entries.length - 1; index >= 0; index -= 1) {
        stack.push({ value: inspected.entries[index][1], leaving: false });
      }
    }
  }

  function clonePlainData(value) {
    try {
      validatePlainGraph(value);
      if (nativeStructuredClone) nativeStructuredClone(value);
      else if (value !== null && typeof value === 'object') {
        // Without the native clone gate a transparent Proxy cannot be distinguished safely.
        throw invalidPlainData();
      }

      function cloneNode(current) {
        if (current === null || typeof current !== 'object') return current;
        const inspected = inspectPlainObject(current);
        const output = inspected.isArray ? [] : {};
        for (const [key, child] of inspected.entries) {
          Object.defineProperty(output, key, {
            value: cloneNode(child), enumerable: true, configurable: true, writable: true
          });
        }
        return output;
      }
      return cloneNode(value);
    } catch (_error) {
      throw invalidPlainData();
    }
  }

  function ownDataValue(object, key) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ? { present: true, value: descriptor.value }
        : { present: false, value: undefined };
    } catch (_error) {
      return { present: false, value: undefined };
    }
  }

  function cloneObjectOr(value, fallback, requireArray) {
    try {
      const cloned = clonePlainData(value);
      const isObject = cloned !== null && typeof cloned === 'object';
      if (!isObject || Array.isArray(cloned) !== requireArray) return fallback;
      return cloned;
    } catch (_error) {
      return fallback;
    }
  }

  function sanitizeRisk(value) {
    const risk = cloneObjectOr(value, null, false);
    const ruleVersion = risk && sanitizeMachineId(risk.ruleVersion);
    if (!risk || !RISK_LEVELS.has(risk.level) || !ruleVersion || !Array.isArray(risk.reasons)) {
      return null;
    }
    const reasons = [];
    for (const reason of risk.reasons) {
      if (!reason || typeof reason !== 'object' || Array.isArray(reason)) continue;
      if (!sanitizeMachineId(reason.code)
        || typeof reason.field !== 'string'
        || !FIELD_ID_PATTERN.test(reason.field)
        || typeof reason.message !== 'string'
        || reason.message.length > MAX_LOCAL_REASON_MESSAGE_LENGTH) continue;
      reasons.push({ code: reason.code, field: reason.field, message: reason.message });
    }
    return { level: risk.level, reasons, ruleVersion };
  }

  function migrateState(raw, participantId) {
    const defaults = createDefaultState(participantId);
    if (raw === null || typeof raw !== 'object') return defaults;
    try {
      if (Array.isArray(raw)) return defaults;
    } catch (_error) {
      return defaults;
    }

    const schema = ownDataValue(raw, 'schemaVersion');
    // Version 1 is the first schema: unknown, missing, legacy-looking and future
    // values have no trustworthy migration path and must fail closed.
    if (!schema.present || schema.value !== SCHEMA_VERSION) return defaults;

    const intake = ownDataValue(raw, 'intake');
    if (intake.present && intake.value !== null) {
      defaults.intake = cloneObjectOr(intake.value, null, false);
    }

    const revision = ownDataValue(raw, 'intakeRevision');
    if (revision.present && Number.isSafeInteger(revision.value) && revision.value >= 0) {
      defaults.intakeRevision = revision.value;
    }

    const risk = ownDataValue(raw, 'risk');
    if (risk.present && risk.value !== null) defaults.risk = sanitizeRisk(risk.value);

    const plan = ownDataValue(raw, 'plan');
    if (plan.present && plan.value !== null) defaults.plan = cloneObjectOr(plan.value, null, false);

    // Reserved state shape only. Task 11/12 will add explicit write APIs and
    // whitelist sanitizers before persisted logs or reviews may be accepted.
    defaults.logs = {};
    defaults.weeklyReviews = [];

    const consent = ownDataValue(raw, 'consent');
    const cleanConsent = cloneObjectOr(consent.value, null, false);
    if (cleanConsent) {
      defaults.consent = {
        acceptedAt: typeof cleanConsent.acceptedAt === 'string' ? cleanConsent.acceptedAt : null,
        version: CONSENT_VERSION
      };
    }
    return defaults;
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    };
  }

  function createDefaultStorage() {
    const memory = createMemoryStorage();
    try {
      const candidate = root.localStorage;
      if (candidate
        && typeof candidate.getItem === 'function'
        && typeof candidate.setItem === 'function'
        && typeof candidate.removeItem === 'function') {
        // A read-only probe detects privacy/security blocks without writing any key.
        candidate.getItem(STORAGE_KEY);
        return candidate;
      }
    } catch (_error) {
      // No usable browser storage: the private in-memory adapter is the safe default.
    }
    return memory;
  }

  function createStorageError() {
    const error = new Error(SAVE_ERROR_MESSAGE);
    error.name = 'StorageError';
    return error;
  }

  function createLocalStore(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const participantId = normalizeParticipantId(settings.participantId);
    const storage = settings.storage === undefined ? createDefaultStorage() : settings.storage;
    const now = typeof settings.now === 'function' ? settings.now : () => new Date().toISOString();

    function loadState() {
      let serialized;
      try {
        serialized = storage.getItem(STORAGE_KEY);
      } catch (_error) {
        return createDefaultState(participantId);
      }
      if (typeof serialized !== 'string') return createDefaultState(participantId);
      let raw;
      try {
        raw = JSON.parse(serialized);
      } catch (_error) {
        return createDefaultState(participantId);
      }
      return migrateState(raw, participantId);
    }

    function persist(state) {
      let serialized;
      try {
        serialized = JSON.stringify(state);
        storage.setItem(STORAGE_KEY, serialized);
      } catch (_error) {
        throw createStorageError();
      }
      return clonePlainData(state);
    }

    function saveIntake(intake, risk) {
      const cleanIntake = clonePlainData(intake);
      if (cleanIntake === null || typeof cleanIntake !== 'object' || Array.isArray(cleanIntake)) {
        throw invalidPlainData();
      }
      let cleanRisk = null;
      if (risk !== undefined && risk !== null) {
        clonePlainData(risk);
        cleanRisk = sanitizeRisk(risk);
        if (!cleanRisk) throw invalidPlainData();
      }
      const state = loadState();
      state.intake = cleanIntake;
      state.risk = cleanRisk;
      state.intakeRevision += 1;
      if (state.plan) {
        state.plan.status = 'stale';
        state.plan.staleReason = 'intake_changed';
        state.plan.staleAt = String(now());
      }
      return persist(state);
    }

    function savePlan(plan) {
      const cleanPlan = clonePlainData(plan);
      if (cleanPlan === null || typeof cleanPlan !== 'object' || Array.isArray(cleanPlan)) {
        throw invalidPlainData();
      }
      const state = loadState();
      cleanPlan.status = cleanPlan.status === 'stale' ? 'stale' : 'active';
      cleanPlan.intakeRevision = state.intakeRevision;
      if (cleanPlan.status === 'active') {
        delete cleanPlan.staleReason;
        delete cleanPlan.staleAt;
      }
      state.plan = cleanPlan;
      return persist(state);
    }

    function clearAll() {
      try {
        for (const key of OWNED_KEYS) storage.removeItem(key);
        return true;
      } catch (_error) {
        return false;
      }
    }

    function exportReviewSummary() {
      const state = loadState();
      const cleanRuleVersion = state.risk && sanitizeMachineId(state.risk.ruleVersion);
      const risk = state.risk && RISK_LEVELS.has(state.risk.level) && cleanRuleVersion ? {
        level: state.risk.level,
        reasonCodes: Array.isArray(state.risk.reasons)
          ? state.risk.reasons.map(reason => sanitizeMachineId(reason && reason.code)).filter(Boolean)
          : [],
        ruleVersion: cleanRuleVersion
      } : null;
      const plan = state.plan ? {
        status: state.plan.status === 'active' || state.plan.status === 'stale' ? state.plan.status : null,
        planVersion: sanitizeMachineId(state.plan.planVersion),
        intakeRevision: Number.isSafeInteger(state.plan.intakeRevision) ? state.plan.intakeRevision : null
      } : null;
      return {
        schemaVersion: SCHEMA_VERSION,
        participantId: state.participantId,
        intakeRevision: state.intakeRevision,
        risk,
        plan,
        logCount: Object.keys(state.logs).length,
        weeklyReviewCount: state.weeklyReviews.length,
        consent: { accepted: state.consent.acceptedAt !== null, version: state.consent.version }
      };
    }

    return Object.freeze({ loadState, saveIntake, savePlan, clearAll, exportReviewSummary });
  }

  const defaultStore = createLocalStore();
  return Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    CONSENT_VERSION,
    OWNED_KEYS,
    createLocalStore,
    migrateState,
    createDefaultState,
    loadState: defaultStore.loadState,
    saveIntake: defaultStore.saveIntake,
    savePlan: defaultStore.savePlan,
    clearAll: defaultStore.clearAll,
    exportReviewSummary: defaultStore.exportReviewSummary
  });
});
