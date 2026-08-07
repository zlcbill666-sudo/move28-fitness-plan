(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const validatorApi = isCommonJS ? require('../domain/plan-validator.js') : root.Move28 && root.Move28.domain;
  const catalogApi = isCommonJS ? require('../data/exercise-catalog.js') : root.Move28 && root.Move28.data;
  const api = factory(root, validatorApi || {}, catalogApi || {});
  if (isCommonJS) {
    module.exports = api;
  } else {
    const Move28 = root.Move28 = root.Move28 || {};
    Move28.storage = api;
  }
})(globalThis, function(root, validatorApi, catalogApi) {
  'use strict';

  const STORAGE_KEY = 'move28-pilot-v1';
  const SCHEMA_VERSION = 1;
  const CONSENT_VERSION = 'pilot-v1';
  const OWNED_KEYS = Object.freeze([STORAGE_KEY]);
  const INVALID_DATA_MESSAGE = 'Invalid plain data';
  const READ_ERROR_MESSAGE = 'Unable to read local participant state';
  const SAVE_ERROR_MESSAGE = 'Unable to save local participant state';
  const MAX_PLAIN_NODES = 10000;
  const RISK_LEVELS = new Set(['normal', 'conservative', 'manual_review', 'stop']);
  const PARTICIPANT_ID_PATTERN = /^pilot-[a-z0-9]{1,12}$/;
  const MACHINE_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
  const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const MAX_LOCAL_REASON_MESSAGE_LENGTH = 512;
  const functionToString = Function.prototype.toString;
  const nativeObjectSource = functionToString.call(Object);
  const trustedValidatePlan = typeof validatorApi.validatePlan === 'function' ? validatorApi.validatePlan : null;
  const trustedExerciseCatalog = Array.isArray(catalogApi.exerciseCatalog) ? catalogApi.exerciseCatalog : null;
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
    if (!isArray && prototype !== null) {
      const constructorDescriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
      const constructorPrototype = constructorDescriptor
        && Object.prototype.hasOwnProperty.call(constructorDescriptor, 'value')
        && typeof constructorDescriptor.value === 'function'
        ? Object.getOwnPropertyDescriptor(constructorDescriptor.value, 'prototype')
        : null;
      if (Object.getPrototypeOf(prototype) !== null
        || !constructorPrototype
        || !Object.prototype.hasOwnProperty.call(constructorPrototype, 'value')
        || constructorPrototype.value !== prototype
        || functionToString.call(constructorDescriptor.value) !== nativeObjectSource) {
        throw invalidPlainData();
      }
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
    let nodeCount = 0;

    while (stack.length > 0) {
      const frame = stack.pop();
      const current = frame.value;
      if (!frame.leaving) {
        nodeCount += 1;
        if (nodeCount > MAX_PLAIN_NODES) throw invalidPlainData();
      }
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

      if (value === null || typeof value !== 'object') return value;

      const rootInspection = inspectPlainObject(value);
      const output = rootInspection.isArray ? [] : {};
      const clones = new WeakMap([[value, output]]);
      const stack = [{ output, entries: rootInspection.entries, index: 0 }];
      while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        if (frame.index >= frame.entries.length) {
          stack.pop();
          continue;
        }
        const [key, child] = frame.entries[frame.index];
        frame.index += 1;
        let childClone = child;
        if (child !== null && typeof child === 'object') {
          childClone = clones.get(child);
          if (childClone === undefined) {
            const childInspection = inspectPlainObject(child);
            childClone = childInspection.isArray ? [] : {};
            clones.set(child, childClone);
            stack.push({ output: childClone, entries: childInspection.entries, index: 0 });
          }
        }
        Object.defineProperty(frame.output, key, {
          value: childClone, enumerable: true, configurable: true, writable: true
        });
      }
      return output;
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

  function sanitizeCompletionLogs(value) {
    const logs = cloneObjectOr(value, null, false);
    if (!logs) return {};
    const entries = Object.entries(logs);
    if (entries.length > 256) return {};
    const clean = {};
    for (const record of Object.values(logs)) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
      const planId = sanitizeMachineId(record.planId);
      const sessionId = sanitizeMachineId(record.sessionId);
      const completedAt = typeof record.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(record.completedAt) ? record.completedAt : null;
      if (!planId || !sessionId || record.status !== 'completed' || !completedAt) continue;
      clean[`${planId}.${sessionId}`] = { planId, sessionId, status: 'completed', completedAt };
    }
    return clean;
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

    const logs = ownDataValue(raw, 'logs');
    if (logs.present) defaults.logs = sanitizeCompletionLogs(logs.value);
    // Weekly review writes remain reserved for Task 12.
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
        return { adapter: candidate, durable: true };
      }
    } catch (_error) {
      // Reads may still return the empty state, but writes must report that persistence is unavailable.
    }
    return { adapter: memory, durable: false };
  }

  function createStorageError(message) {
    const error = new Error(message || SAVE_ERROR_MESSAGE);
    error.name = 'StorageError';
    return error;
  }

  function createLocalStore(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const participantId = normalizeParticipantId(settings.participantId);
    const defaultStorage = settings.storage === undefined ? createDefaultStorage() : null;
    const storage = defaultStorage ? defaultStorage.adapter : settings.storage;
    const durable = defaultStorage ? defaultStorage.durable : true;
    const now = typeof settings.now === 'function' ? settings.now : () => new Date().toISOString();

    function readState(options) {
      const strict = Boolean(options && options.strict);
      let serialized;
      try {
        serialized = storage.getItem(STORAGE_KEY);
      } catch (_error) {
        if (strict) throw createStorageError(READ_ERROR_MESSAGE);
        return createDefaultState(participantId);
      }
      if (serialized === null) return createDefaultState(participantId);
      if (typeof serialized !== 'string') {
        if (strict) throw createStorageError(READ_ERROR_MESSAGE);
        return createDefaultState(participantId);
      }
      let raw;
      try {
        raw = JSON.parse(serialized);
      } catch (_error) {
        if (strict) throw createStorageError(READ_ERROR_MESSAGE);
        return createDefaultState(participantId);
      }
      if (strict) {
        const schema = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
          ? ownDataValue(raw, 'schemaVersion')
          : { present: false, value: undefined };
        if (!schema.present || schema.value !== SCHEMA_VERSION) {
          throw createStorageError(READ_ERROR_MESSAGE);
        }
      }
      return migrateState(raw, participantId);
    }

    function loadState() {
      return readState({ strict: false });
    }

    function loadStateForWrite() {
      return readState({ strict: true });
    }

    function persist(state) {
      if (!durable) throw createStorageError();
      let snapshot;
      let serialized;
      try {
        snapshot = clonePlainData(state);
        serialized = JSON.stringify(snapshot);
      } catch (_error) {
        throw createStorageError();
      }
      try {
        storage.setItem(STORAGE_KEY, serialized);
      } catch (_error) {
        throw createStorageError();
      }
      return snapshot;
    }

    function saveIntake(intake, risk) {
      const cleanIntake = clonePlainData(intake);
      if (cleanIntake === null || typeof cleanIntake !== 'object' || Array.isArray(cleanIntake)) {
        throw invalidPlainData();
      }
      let cleanRisk = null;
      if (risk !== undefined && risk !== null) {
        cleanRisk = sanitizeRisk(risk);
        if (!cleanRisk) throw invalidPlainData();
      }
      const state = loadStateForWrite();
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

    function candidateForValidation(plan) {
      const candidate = clonePlainData(plan);
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
      delete candidate.review;
      delete candidate.staleReason;
      delete candidate.staleAt;
      candidate.status = 'generated';
      return candidate;
    }

    function passesTrustedPlanGate(plan, state) {
      const candidate = candidateForValidation(plan);
      if (!candidate || !trustedValidatePlan || !trustedExerciseCatalog) return false;
      try {
        const result = trustedValidatePlan({ plan: candidate, intake: state.intake, risk: state.risk, catalog: trustedExerciseCatalog });
        return Boolean(result && result.ok === true && Array.isArray(result.errors) && result.errors.length === 0);
      } catch (_error) {
        return false;
      }
    }

    function hasReviewApproval(plan, state) {
      const review = plan && plan.review;
      return Boolean(review && review.status === 'approved'
        && sanitizeMachineId(review.reviewerId)
        && review.planId === plan.id
        && review.intakeRevision === state.intakeRevision
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewedAt));
    }

    function savePlan(plan) {
      const cleanPlan = clonePlainData(plan);
      if (cleanPlan === null || typeof cleanPlan !== 'object' || Array.isArray(cleanPlan)) {
        throw invalidPlainData();
      }
      const state = loadStateForWrite();
      if (cleanPlan.status !== 'generated' || cleanPlan.intakeRevision !== state.intakeRevision
        || !passesTrustedPlanGate(cleanPlan, state)) throw createStorageError();
      cleanPlan.status = 'pending_review';
      cleanPlan.intakeRevision = state.intakeRevision;
      cleanPlan.review = null;
      delete cleanPlan.staleReason;
      delete cleanPlan.staleAt;
      state.plan = cleanPlan;
      return persist(state);
    }

    function recordWorkoutCompletion(completion) {
      const clean = clonePlainData(completion);
      if (!clean || typeof clean !== 'object' || Array.isArray(clean)
        || Object.keys(clean).some(key => !['planId', 'sessionId'].includes(key))) throw invalidPlainData();
      const planId = sanitizeMachineId(clean.planId);
      const sessionId = sanitizeMachineId(clean.sessionId);
      if (!planId || !sessionId) throw invalidPlainData();
      const state = loadStateForWrite();
      const plan = state.plan;
      const sessions = plan && Array.isArray(plan.weeks)
        ? plan.weeks.flatMap(week => week && Array.isArray(week.sessions) ? week.sessions : [])
        : [];
      if (!plan || plan.status !== 'active' || plan.id !== planId
        || plan.intakeRevision !== state.intakeRevision
        || !hasReviewApproval(plan, state)
        || !passesTrustedPlanGate(plan, state)
        || !sessions.some(session => session && session.id === sessionId)) throw createStorageError();
      const completedAt = String(now());
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(completedAt)) throw createStorageError();
      state.logs[`${planId}.${sessionId}`] = { planId, sessionId, status: 'completed', completedAt };
      return persist(state);
    }

    function clearAll() {
      if (!durable) return false;
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
        status: ['pending_review', 'active', 'stale'].includes(state.plan.status) ? state.plan.status : null,
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

    return Object.freeze({ loadState, saveIntake, savePlan, recordWorkoutCompletion, clearAll, exportReviewSummary });
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
    recordWorkoutCompletion: defaultStore.recordWorkoutCompletion,
    clearAll: defaultStore.clearAll,
    exportReviewSummary: defaultStore.exportReviewSummary
  });
});
