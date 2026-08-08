(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const validatorApi = isCommonJS ? require('../domain/plan-validator.js') : root.Move28 && root.Move28.domain;
  const catalogApi = isCommonJS ? require('../data/exercise-catalog.js') : root.Move28 && root.Move28.data;
  const adaptationApi = isCommonJS ? require('../domain/weekly-adaptation.js') : root.Move28 && root.Move28.domain;
  const riskApi = isCommonJS ? require('../domain/risk-engine.js') : root.Move28 && root.Move28.domain;
  const api = factory(root, validatorApi || {}, catalogApi || {}, adaptationApi || {}, riskApi || {});
  if (isCommonJS) {
    module.exports = api;
  } else {
    const Move28 = root.Move28 = root.Move28 || {};
    Move28.storage = api;
  }
})(globalThis, function(root, validatorApi, catalogApi, adaptationApi, riskApi) {
  'use strict';

  const STORAGE_KEY = 'move28-pilot-v1';
  const SCHEMA_VERSION = 1;
  const CONSENT_VERSION = 'pilot-v1';
  const OWNED_KEYS = Object.freeze([STORAGE_KEY, 'move28-tracker-v1', 'move28-current-day', 'move28-music-enabled', 'move28-music-volume']);
  const ONBOARDING_DRAFT_KEY = 'move28-onboarding-draft-v1';
  const INVALID_DATA_MESSAGE = 'Invalid plain data';
  const READ_ERROR_MESSAGE = 'Unable to read local participant state';
  const SAVE_ERROR_MESSAGE = 'Unable to save local participant state';
  const MAX_PLAIN_NODES = 10000;
  const RISK_LEVELS = new Set(['normal', 'conservative', 'manual_review', 'stop']);
  const PARTICIPANT_ID_PATTERN = /^pilot-[a-z0-9]{1,12}$/;
  const MACHINE_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
  const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  const RUNTIME_STOP_REASON_CODES = Object.freeze(['chest_pain_or_pressure','near_faint_or_faint','abnormal_shortness_of_breath','sudden_severe_pain','unable_to_bear_weight','neurologic_or_consciousness_change','joint_pain_persisted_or_worsened']);
  const RUNTIME_STOP_REASON_SET = new Set(RUNTIME_STOP_REASON_CODES);
  const MAX_LOCAL_REASON_MESSAGE_LENGTH = 512;
  const functionToString = Function.prototype.toString;
  const nativeObjectSource = functionToString.call(Object);
  const trustedValidatePlan = typeof validatorApi.validatePlan === 'function' ? validatorApi.validatePlan : null;
  const trustedExerciseCatalog = Array.isArray(catalogApi.exerciseCatalog) ? catalogApi.exerciseCatalog : null;
  const trustedProposeWeeklyChange = typeof adaptationApi.proposeWeeklyChange === 'function' ? adaptationApi.proposeWeeklyChange : null;
  const trustedDeriveRiskIntake = typeof riskApi.deriveRiskIntake === 'function' ? riskApi.deriveRiskIntake : null;
  const trustedEvaluateRisk = typeof riskApi.evaluateRisk === 'function' ? riskApi.evaluateRisk : null;
  const TRUSTED_RISK_CODES = new Set(Array.isArray(riskApi.REASON_CODES) ? riskApi.REASON_CODES : []);
  const TRUSTED_RULE_VERSIONS = new Set(['pilot-v1', typeof riskApi.RULE_VERSION === 'string' ? riskApi.RULE_VERSION : 'pilot-v2']);
  const TRUSTED_PLAN_VERSIONS = new Set(TRUSTED_RULE_VERSIONS);
  const WEEKLY_DECISIONS = new Set(['pending','accepted','rejected','rescreen']);
  const WEEKLY_TYPES = new Set(['keep','reduce','replace','progress_one_variable','rescreen']);
  const WEEKLY_COMPLETION_REASONS = new Set(['completed','time','difficulty','fatigue','other']);
  const WEEKLY_DIFFICULTIES = new Set(['too_light','suitable','too_hard']);
  const WEEKLY_MOVEMENT_QUALITIES = new Set(['stable','unsure','poor']);
  const WEEKLY_PAIN_STATUSES = new Set(['none','stable','new','worsened']);
  const WEEKLY_PAIN_AREAS = new Set(['shoulder','knee','lower_back','hip','ankle','other']);
  const WEEKLY_RECOVERY = new Set(['good','fair','poor']);
  const WEEKLY_TIME = new Set(['less','same','more']);
  const MAX_WEEKLY_REVIEWS = 16;
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

  function recomputeTrustedRisk(intake) {
    try {
      if (!trustedDeriveRiskIntake || !trustedEvaluateRisk) return null;
      const derived = trustedDeriveRiskIntake(intake);
      if (!derived) return null;
      return sanitizeRisk(trustedEvaluateRisk(derived));
    } catch (_error) { return null; }
  }

  function risksEqual(left, right) {
    if (!left || !right || left.level !== right.level || left.ruleVersion !== right.ruleVersion
      || left.reasons.length !== right.reasons.length) return false;
    return left.reasons.every((reason, index) => {
      const other = right.reasons[index];
      return other && reason.code === other.code && reason.field === other.field && reason.message === other.message;
    });
  }

  function sanitizeWorkoutLogs(value) {
    const logs = cloneObjectOr(value, null, false);
    if (!logs) return {};
    const entries = Object.entries(logs);
    if (entries.length > 256) return {};
    const clean = {};
    for (const record of Object.values(logs)) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
      const planId = sanitizeMachineId(record.planId);
      const sessionId = sanitizeMachineId(record.sessionId);
      if (!planId || !sessionId) continue;
      if (record.status === 'completed') {
        const completedAt = typeof record.completedAt === 'string' && UTC_ISO_PATTERN.test(record.completedAt) ? record.completedAt : null;
        if (completedAt) clean[`${planId}.${sessionId}`] = { planId, sessionId, status: 'completed', completedAt };
        continue;
      }
      const reasonCode = sanitizeMachineId(record.reasonCode);
      const occurredAt = typeof record.occurredAt === 'string' && UTC_ISO_PATTERN.test(record.occurredAt) ? record.occurredAt : null;
      if (record.status !== 'safety_stopped' || !RUNTIME_STOP_REASON_SET.has(reasonCode)
        || !Number.isSafeInteger(record.actionIndex) || record.actionIndex < 0 || record.actionIndex > 255 || !occurredAt) continue;
      clean[`safety.${planId}.${sessionId}`] = { planId, sessionId, status: 'safety_stopped', reasonCode, actionIndex: record.actionIndex, occurredAt };
    }
    return clean;
  }

  function sanitizeWeeklyAnswers(value) {
    const answers = cloneObjectOr(value, null, false);
    if (!answers || !Number.isSafeInteger(answers.completedSessions) || !Number.isSafeInteger(answers.scheduledSessions)
      || answers.completedSessions < 0 || answers.completedSessions > answers.scheduledSessions
      || !WEEKLY_COMPLETION_REASONS.has(answers.completionReason) || !WEEKLY_DIFFICULTIES.has(answers.difficulty)
      || !WEEKLY_MOVEMENT_QUALITIES.has(answers.movementQuality) || !WEEKLY_PAIN_STATUSES.has(answers.painStatus)
      || !Array.isArray(answers.painAreas) || answers.painAreas.length > 6 || new Set(answers.painAreas).size !== answers.painAreas.length
      || answers.painAreas.some(area => !WEEKLY_PAIN_AREAS.has(area)) || typeof answers.painAffectsDailyActivity !== 'boolean'
      || !WEEKLY_RECOVERY.has(answers.recovery) || !WEEKLY_TIME.has(answers.nextWeekTime)
      || (answers.painStatus === 'none') !== (answers.painAreas.length === 0)) return null;
    return { completedSessions: answers.completedSessions, scheduledSessions: answers.scheduledSessions,
      completionReason: answers.completionReason, difficulty: answers.difficulty, movementQuality: answers.movementQuality,
      painStatus: answers.painStatus, painAreas: [...answers.painAreas], painAffectsDailyActivity: answers.painAffectsDailyActivity,
      recovery: answers.recovery, nextWeekTime: answers.nextWeekTime };
  }

  function sanitizeWeeklyReviews(value) {
    const reviews = cloneObjectOr(value, null, true);
    if (!reviews || reviews.length > MAX_WEEKLY_REVIEWS) return [];
    const clean = [];
    for (const record of reviews) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
      const id = sanitizeMachineId(record.id), planId = sanitizeMachineId(record.planId);
      const expectedResultPlanId = sanitizeMachineId(`${planId || ''}-w${record.weekNumber}-a`);
      const inferredResultPlanId = record.decision === 'accepted' && (record.resultPlanId === null || record.resultPlanId === undefined)
        ? expectedResultPlanId : null;
      const resultPlanId = record.resultPlanId === null || record.resultPlanId === undefined ? inferredResultPlanId : sanitizeMachineId(record.resultPlanId);
      const answers = sanitizeWeeklyAnswers(record.answers);
      const proposal = cloneObjectOr(record.proposal, null, false);
      const submittedAt = typeof record.submittedAt === 'string' && UTC_ISO_PATTERN.test(record.submittedAt) ? record.submittedAt : null;
      const decidedAt = record.decidedAt === null || (typeof record.decidedAt === 'string' && UTC_ISO_PATTERN.test(record.decidedAt)) ? record.decidedAt : undefined;
      const variable = proposal && proposal.variable === null ? null : proposal && sanitizeMachineId(proposal.variable);
      const variableValid = proposal && (proposal.variable === null || variable !== null);
      const reasonCode = proposal && sanitizeMachineId(proposal.reasonCode);
      if (!id || !planId || record.reviewVersion !== 1 || !Number.isSafeInteger(record.intakeRevision) || record.intakeRevision < 1
        || !Number.isSafeInteger(record.weekNumber) || record.weekNumber < 1 || record.weekNumber > 4 || !submittedAt || !answers
        || !proposal || !WEEKLY_TYPES.has(proposal.type) || !reasonCode || !variableValid
        || !(proposal.targetWeekNumber === null || (Number.isSafeInteger(proposal.targetWeekNumber) && proposal.targetWeekNumber >= 2 && proposal.targetWeekNumber <= 4))
        || !WEEKLY_DECISIONS.has(record.decision) || decidedAt === undefined || (record.decision === 'pending') !== (decidedAt === null)
        || (record.decision === 'accepted') !== (resultPlanId !== null)
        || (record.decision === 'accepted' && resultPlanId !== expectedResultPlanId)
        || (resultPlanId !== null && resultPlanId === planId)) continue;
      clean.push({ id, reviewVersion: 1, planId, resultPlanId, intakeRevision: record.intakeRevision, weekNumber: record.weekNumber,
        submittedAt, answers, proposal: { type: proposal.type, targetWeekNumber: proposal.targetWeekNumber,
          variable: variable || null, reasonCode }, decision: record.decision, decidedAt });
    }
    return clean;
  }

  function weeklyPlanLineage(reviews, currentPlanId) {
    const lineage = new Set([currentPlanId]);
    let changed = true;
    while (changed && lineage.size <= MAX_WEEKLY_REVIEWS + 1) {
      changed = false;
      for (const record of reviews) {
        if (record && record.decision === 'accepted' && lineage.has(record.resultPlanId) && !lineage.has(record.planId)) {
          lineage.add(record.planId); changed = true;
        }
      }
    }
    return lineage;
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

    const persistedParticipant = ownDataValue(raw, 'participantId');
    if (persistedParticipant.present && typeof persistedParticipant.value === 'string' && PARTICIPANT_ID_PATTERN.test(persistedParticipant.value)) {
      defaults.participantId = persistedParticipant.value;
    }

    const intake = ownDataValue(raw, 'intake');
    if (intake.present && intake.value !== null) {
      defaults.intake = cloneObjectOr(intake.value, null, false);
    }

    const revision = ownDataValue(raw, 'intakeRevision');
    if (revision.present && Number.isSafeInteger(revision.value) && revision.value >= 0) {
      defaults.intakeRevision = revision.value;
    }

    const risk = ownDataValue(raw, 'risk');
    const storedRisk = risk.present && risk.value !== null ? sanitizeRisk(risk.value) : null;
    const recomputedRisk = defaults.intake ? recomputeTrustedRisk(defaults.intake) : null;
    const riskMismatch = Boolean(defaults.intake && (!storedRisk || !recomputedRisk || !risksEqual(storedRisk, recomputedRisk)));
    defaults.risk = recomputedRisk;

    const plan = ownDataValue(raw, 'plan');
    if (!riskMismatch && plan.present && plan.value !== null) defaults.plan = cloneObjectOr(plan.value, null, false);

    const logs = ownDataValue(raw, 'logs');
    if (logs.present) defaults.logs = sanitizeWorkoutLogs(logs.value);
    const currentStops = defaults.plan ? Object.values(defaults.logs).filter(record => record.status === 'safety_stopped' && record.planId === defaults.plan.id) : [];
    if (currentStops.length) {
      const event = currentStops[0];
      const sessions = Array.isArray(defaults.plan.weeks)
        ? defaults.plan.weeks.flatMap(week => week && Array.isArray(week.sessions) ? week.sessions : [])
        : [];
      const session = sessions.find(item => item && item.id === event.sessionId);
      const bound = currentStops.length === 1 && session && Array.isArray(session.actions) && event.actionIndex < session.actions.length;
      if (defaults.plan.status !== 'stale' || defaults.plan.staleReason !== 'runtime-safety-event'
        || defaults.plan.staleAt !== event.occurredAt || !bound) {
        defaults.plan.status = 'stale';
        defaults.plan.staleReason = bound ? 'runtime-safety-event' : 'runtime-safety-state-inconsistent';
        defaults.plan.staleAt = event.occurredAt;
      }
    }
    const weeklyReviews = ownDataValue(raw, 'weeklyReviews');
    if (weeklyReviews.present) defaults.weeklyReviews = sanitizeWeeklyReviews(weeklyReviews.value);
    const currentPainReview = defaults.plan && defaults.weeklyReviews.find(record => record.planId === defaults.plan.id && record.decision === 'rescreen');
    if (currentPainReview && !currentStops.length && (defaults.plan.status !== 'stale' || defaults.plan.staleReason !== 'weekly_pain_rescreen')) {
      defaults.plan.status = 'stale'; defaults.plan.staleReason = 'weekly_pain_rescreen'; defaults.plan.staleAt = currentPainReview.decidedAt;
    }

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
      const trustedRisk = recomputeTrustedRisk(cleanIntake);
      if (!trustedRisk) throw invalidPlainData();
      if (risk !== undefined && risk !== null) {
        const suppliedRisk = sanitizeRisk(risk);
        if (!suppliedRisk || !risksEqual(suppliedRisk, trustedRisk)) throw invalidPlainData();
      }
      const state = loadStateForWrite();
      state.intake = cleanIntake;
      state.risk = trustedRisk;
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

    function trustedPlanValidationResult(plan, state) {
      const candidate = candidateForValidation(plan);
      if (!candidate) return 'failed';
      if (!trustedValidatePlan || !trustedExerciseCatalog) return 'unavailable';
      try {
        const result = clonePlainData(trustedValidatePlan({ plan: candidate, intake: state.intake, risk: state.risk, catalog: trustedExerciseCatalog }));
        if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.ok !== 'boolean' || !Array.isArray(result.errors)) return 'unavailable';
        return result.ok === true && result.errors.length === 0 ? 'passed' : 'failed';
      } catch (_error) {
        return 'unavailable';
      }
    }

    function passesTrustedPlanGate(plan, state) {
      return trustedPlanValidationResult(plan, state) === 'passed';
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
      if (!UTC_ISO_PATTERN.test(completedAt)) throw createStorageError();
      state.logs[`${planId}.${sessionId}`] = { planId, sessionId, status: 'completed', completedAt };
      return persist(state);
    }

    function recordWorkoutStop(stop) {
      const clean = clonePlainData(stop);
      const allowed = ['sessionId', 'reasonCode', 'actionIndex', 'occurredAt'];
      if (!clean || typeof clean !== 'object' || Array.isArray(clean)
        || Object.keys(clean).length !== allowed.length
        || Object.keys(clean).some(key => !allowed.includes(key))) throw invalidPlainData();
      const sessionId = sanitizeMachineId(clean.sessionId);
      const reasonCode = sanitizeMachineId(clean.reasonCode);
      if (!sessionId || !RUNTIME_STOP_REASON_SET.has(reasonCode)
        || !Number.isSafeInteger(clean.actionIndex) || clean.actionIndex < 0
        || typeof clean.occurredAt !== 'string' || !UTC_ISO_PATTERN.test(clean.occurredAt)) throw invalidPlainData();
      const state = loadStateForWrite();
      const plan = state.plan;
      const sessions = plan && Array.isArray(plan.weeks)
        ? plan.weeks.flatMap(week => week && Array.isArray(week.sessions) ? week.sessions : [])
        : [];
      const session = sessions.find(item => item && item.id === sessionId);
      if (!plan || plan.status !== 'active' || plan.intakeRevision !== state.intakeRevision
        || !hasReviewApproval(plan, state) || !passesTrustedPlanGate(plan, state)
        || !session || !Array.isArray(session.actions) || clean.actionIndex >= session.actions.length) throw createStorageError();
      const event = { planId: plan.id, sessionId, status: 'safety_stopped', reasonCode, actionIndex: clean.actionIndex, occurredAt: clean.occurredAt };
      state.logs[`safety.${plan.id}.${sessionId}`] = event;
      plan.status = 'stale';
      plan.staleReason = 'runtime-safety-event';
      plan.staleAt = clean.occurredAt;
      return persist(state);
    }

    function weeklyReviewInput(record) {
      const answers = record.answers;
      return { reviewVersion: 1, weekNumber: record.weekNumber, completedSessions: answers.completedSessions,
        completionReason: answers.completionReason, difficulty: answers.difficulty, movementQuality: answers.movementQuality,
        painStatus: answers.painStatus, painAreas: [...answers.painAreas], painAffectsDailyActivity: answers.painAffectsDailyActivity,
        recovery: answers.recovery, nextWeekTime: answers.nextWeekTime };
    }

    function proposeForState(state, review) {
      if (!trustedProposeWeeklyChange) return null;
      let proposal;
      try { proposal = trustedProposeWeeklyChange({ plan: state.plan, review,
        previousReviews: state.weeklyReviews, intake: state.intake, risk: state.risk }); }
      catch (_error) { return null; }
      return proposal && proposal.status === 'ok' && WEEKLY_TYPES.has(proposal.type) ? proposal : null;
    }

    function recordWeeklyReview(review) {
      const cleanReview = clonePlainData(review);
      if (!cleanReview || typeof cleanReview !== 'object' || Array.isArray(cleanReview)) throw invalidPlainData();
      const state = loadStateForWrite(), plan = state.plan;
      const lineage = plan ? weeklyPlanLineage(state.weeklyReviews, plan.id) : new Set();
      if (!plan || plan.status !== 'active' || plan.intakeRevision !== state.intakeRevision
        || !hasReviewApproval(plan, state) || !passesTrustedPlanGate(plan, state)
        || state.weeklyReviews.length >= MAX_WEEKLY_REVIEWS
        || state.weeklyReviews.some(item => lineage.has(item.planId) && item.decision === 'pending')) throw createStorageError();
      const weekNumber = cleanReview.weekNumber;
      const reviewedWeeks = new Set(state.weeklyReviews.filter(item => lineage.has(item.planId)).map(item => item.weekNumber));
      const expectedWeekNumber = [1, 2, 3, 4].find(number => !reviewedWeeks.has(number));
      if (weekNumber !== expectedWeekNumber) throw createStorageError();
      const week = Number.isSafeInteger(weekNumber) && weekNumber >= 1 && weekNumber <= 4 ? plan.weeks[weekNumber - 1] : null;
      if (!week || !Array.isArray(week.sessions) || state.weeklyReviews.some(item => lineage.has(item.planId) && item.weekNumber === weekNumber)) throw createStorageError();
      const proposal = proposeForState(state, cleanReview);
      if (!proposal) throw createStorageError();
      const submittedAt = String(now());
      if (!UTC_ISO_PATTERN.test(submittedAt)) throw createStorageError();
      const answers = sanitizeWeeklyAnswers({ ...cleanReview, scheduledSessions: week.sessions.length });
      if (!answers) throw invalidPlainData();
      const decision = proposal.type === 'rescreen' ? 'rescreen' : 'pending';
      const record = { id: `weekly.${plan.id}.w${weekNumber}`, reviewVersion: 1, planId: plan.id, resultPlanId: null,
        intakeRevision: state.intakeRevision, weekNumber, submittedAt, answers,
        proposal: { type: proposal.type, targetWeekNumber: proposal.targetWeekNumber,
          variable: proposal.variable, reasonCode: proposal.reason },
        decision, decidedAt: decision === 'pending' ? null : submittedAt };
      state.weeklyReviews.push(record);
      if (decision === 'rescreen') {
        plan.status = 'stale'; plan.staleReason = 'weekly_pain_rescreen'; plan.staleAt = submittedAt;
      }
      return persist(state);
    }

    function resolveWeeklyReview(input) {
      const clean = clonePlainData(input);
      if (!clean || typeof clean !== 'object' || Array.isArray(clean)
        || Object.keys(clean).length !== 2 || !sanitizeMachineId(clean.reviewId)
        || !['accepted','rejected'].includes(clean.decision)) throw invalidPlainData();
      const state = loadStateForWrite(), record = state.weeklyReviews.find(item => item.id === clean.reviewId);
      if (!record || record.decision !== 'pending' || !state.plan || state.plan.id !== record.planId
        || state.plan.status !== 'active' || state.plan.intakeRevision !== record.intakeRevision
        || !hasReviewApproval(state.plan, state) || !passesTrustedPlanGate(state.plan, state)) throw createStorageError();
      const decidedAt = String(now());
      if (!UTC_ISO_PATTERN.test(decidedAt)) throw createStorageError();
      if (clean.decision === 'accepted') {
        const proposal = proposeForState(state, weeklyReviewInput(record));
        if (!proposal || !proposal.after || proposal.type !== record.proposal.type
          || proposal.variable !== record.proposal.variable || proposal.reason !== record.proposal.reasonCode
          || !passesTrustedPlanGate(proposal.after, state)) throw createStorageError();
        const adjusted = clonePlainData(proposal.after);
        adjusted.id = `${state.plan.id}-w${record.weekNumber}-a`;
        if (!passesTrustedPlanGate(adjusted, state)) throw createStorageError();
        adjusted.status = 'pending_review'; adjusted.review = null;
        delete adjusted.staleReason; delete adjusted.staleAt;
        record.resultPlanId = adjusted.id;
        state.plan = adjusted;
      }
      record.decision = clean.decision; record.decidedAt = decidedAt;
      return persist(state);
    }

    function clearAllDetailed() {
      const scopeByKey = new Map([
        [STORAGE_KEY, 'local.pilot'], ['move28-tracker-v1', 'local.tracker'],
        ['move28-current-day', 'local.currentDay'], ['move28-music-enabled', 'local.musicEnabled'],
        ['move28-music-volume', 'local.musicVolume']
      ]);
      if (!durable) return Object.freeze({ ok: false, status: 'unavailable', failedScopes: Object.freeze([...scopeByKey.values()]) });
      const failed = new Set();
      for (const key of OWNED_KEYS) {
        try { storage.removeItem(key); } catch (_error) { failed.add(scopeByKey.get(key)); }
      }
      for (const key of OWNED_KEYS) {
        try { if (storage.getItem(key) !== null) failed.add(scopeByKey.get(key)); }
        catch (_error) { failed.add(scopeByKey.get(key)); }
      }
      const failedScopes = Object.freeze([...failed]);
      return Object.freeze({ ok: failedScopes.length === 0, status: failedScopes.length === 0 ? 'deleted' : 'partial_failure', failedScopes });
    }

    function clearAll() {
      return clearAllDetailed().ok;
    }

    function buildReviewSummary(inputState) {
      const cloned = clonePlainData(inputState);
      if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) throw invalidPlainData();
      const state = migrateState(cloned, normalizeParticipantId(cloned.participantId));
      const ruleVersion = state.risk && TRUSTED_RULE_VERSIONS.has(state.risk.ruleVersion) ? state.risk.ruleVersion : null;
      const riskLevel = state.risk && RISK_LEVELS.has(state.risk.level) ? state.risk.level : null;
      const riskCodes = state.risk && Array.isArray(state.risk.reasons)
        ? [...new Set(state.risk.reasons.map(reason => reason && reason.code).filter(code => TRUSTED_RISK_CODES.has(code)))] : [];
      let planSummary = null, validationResult = 'not_applicable';
      if (state.plan) {
        const weeks = Array.isArray(state.plan.weeks) ? state.plan.weeks.slice(0, 4) : [];
        const sessions = weeks.flatMap(week => week && Array.isArray(week.sessions) ? week.sessions.slice(0, 7) : []);
        const actionCount = sessions.reduce((total, session) => total + (session && Array.isArray(session.actions) ? Math.min(session.actions.length, 32) : 0), 0);
        planSummary = Object.freeze({
          status: ['pending_review', 'active', 'stale'].includes(state.plan.status) ? state.plan.status : null,
          planVersion: TRUSTED_PLAN_VERSIONS.has(state.plan.planVersion) ? state.plan.planVersion : null,
          weekCount: weeks.length,
          sessionCount: sessions.length,
          actionCount
        });
        validationResult = trustedPlanValidationResult(state.plan, state);
      }
      return Object.freeze({
        participantId: normalizeParticipantId(state.participantId),
        ruleVersion,
        riskLevel,
        riskCodes: Object.freeze(riskCodes),
        planSummary,
        validationResult
      });
    }

    function exportReviewSummary() {
      return buildReviewSummary(loadState());
    }

    return Object.freeze({ loadState, saveIntake, savePlan, recordWorkoutCompletion, recordWorkoutStop, recordWeeklyReview, resolveWeeklyReview, clearAll, clearAllDetailed, buildReviewSummary, exportReviewSummary });
  }

  function createLocalParticipantId() {
    try {
      if (!root.document || !root.crypto || typeof root.crypto.getRandomValues !== 'function') return 'pilot-local';
      const bytes = new Uint8Array(4); root.crypto.getRandomValues(bytes);
      return `pilot-${[...bytes].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    } catch (_error) { return 'pilot-local'; }
  }

  const defaultStore = createLocalStore({ participantId: createLocalParticipantId() });
  return Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    CONSENT_VERSION,
    OWNED_KEYS,
    ONBOARDING_DRAFT_KEY,
    RUNTIME_STOP_REASON_CODES,
    createLocalStore,
    migrateState,
    createDefaultState,
    loadState: defaultStore.loadState,
    saveIntake: defaultStore.saveIntake,
    savePlan: defaultStore.savePlan,
    recordWorkoutCompletion: defaultStore.recordWorkoutCompletion,
    recordWorkoutStop: defaultStore.recordWorkoutStop,
    recordWeeklyReview: defaultStore.recordWeeklyReview,
    resolveWeeklyReview: defaultStore.resolveWeeklyReview,
    clearAll: defaultStore.clearAll,
    clearAllDetailed: defaultStore.clearAllDetailed,
    buildReviewSummary: defaultStore.buildReviewSummary,
    exportReviewSummary: defaultStore.exportReviewSummary
  });
});
