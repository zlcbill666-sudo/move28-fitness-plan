(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const validatorApi = isCommonJS ? require('../domain/plan-validator.js') : root.Move28 && root.Move28.domain;
  const catalogApi = isCommonJS ? require('../data/exercise-catalog.js') : root.Move28 && root.Move28.data;
  const adaptationApi = isCommonJS ? require('../domain/weekly-adaptation.js') : root.Move28 && root.Move28.domain;
  const riskApi = isCommonJS ? require('../domain/risk-engine.js') : root.Move28 && root.Move28.domain;
  const capabilityApi = isCommonJS ? require('../domain/capability-engine.js') : root.Move28 && root.Move28.domain;
  const dailyExecutionApi = isCommonJS ? require('../domain/daily-execution-validator.js') : root.Move28 && root.Move28.domain;
  const api = factory(root, validatorApi || {}, catalogApi || {}, adaptationApi || {}, riskApi || {}, capabilityApi || {}, dailyExecutionApi || {});
  if (isCommonJS) {
    module.exports = api;
  } else {
    const Move28 = root.Move28 = root.Move28 || {};
    Move28.storage = api;
  }
})(globalThis, function(root, validatorApi, catalogApi, adaptationApi, riskApi, capabilityApi, dailyExecutionApi) {
  'use strict';

  // Hostile classic-script peers can replace realm intrinsics after this script loads.
  // Capture every intrinsic used by the plain-data inspection/cloning boundary once.
  const safeArrayIsArray = Array.isArray;
  const safeGetPrototypeOf = Object.getPrototypeOf;
  const safeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const safeOwnKeys = Reflect.ownKeys;
  const safeDefineProperty = Object.defineProperty;
  const safeHasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  const safeFunctionToString = Function.prototype.call.bind(Function.prototype.toString);
  const safeArrayPush = Function.prototype.call.bind(Array.prototype.push);
  const safeArrayPop = Function.prototype.call.bind(Array.prototype.pop);
  const safeArraySort = Function.prototype.call.bind(Array.prototype.sort);
  const SafeWeakSet = WeakSet;
  const safeWeakSetAdd = Function.prototype.call.bind(WeakSet.prototype.add);
  const safeWeakSetDelete = Function.prototype.call.bind(WeakSet.prototype.delete);
  const safeWeakSetHas = Function.prototype.call.bind(WeakSet.prototype.has);
  const SafeWeakMap = WeakMap;
  const safeWeakMapGet = Function.prototype.call.bind(WeakMap.prototype.get);
  const safeWeakMapSet = Function.prototype.call.bind(WeakMap.prototype.set);

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
  const ADAPTATION_ID_PATTERN = /^daily\.[a-z0-9._-]{1,494}$/;
  const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  const RUNTIME_STOP_REASON_CODES = Object.freeze(['chest_pain_or_pressure','near_faint_or_faint','abnormal_shortness_of_breath','sudden_severe_pain','unable_to_bear_weight','neurologic_or_consciousness_change','joint_pain_persisted_or_worsened']);
  const RUNTIME_STOP_REASON_SET = new Set(RUNTIME_STOP_REASON_CODES);
  const MAX_LOCAL_REASON_MESSAGE_LENGTH = 512;
  const nativeObjectSource = safeFunctionToString(Object);
  const trustedValidatePlan = typeof validatorApi.validatePlan === 'function' ? validatorApi.validatePlan : null;
  const trustedExerciseCatalog = Array.isArray(catalogApi.exerciseCatalog) ? catalogApi.exerciseCatalog : null;
  const trustedProposeWeeklyChange = typeof adaptationApi.proposeWeeklyChange === 'function' ? adaptationApi.proposeWeeklyChange : null;
  const trustedDeriveRiskIntake = typeof riskApi.deriveRiskIntake === 'function' ? riskApi.deriveRiskIntake : null;
  const trustedEvaluateRisk = typeof riskApi.evaluateRisk === 'function' ? riskApi.evaluateRisk : null;
  const trustedEvaluateCapabilityProfile = typeof capabilityApi.evaluateCapabilityProfile === 'function'
    ? capabilityApi.evaluateCapabilityProfile : null;
  const trustedValidateDailyExecution = typeof dailyExecutionApi.validateDailyExecution === 'function'
    ? dailyExecutionApi.validateDailyExecution : null;
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
      capabilityProfile: null,
      capabilityResult: null,
      capabilityRevision: 0,
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
    const isArray = safeArrayIsArray(value);
    const prototype = safeGetPrototypeOf(value);
    if (!isArray && prototype !== null) {
      const constructorDescriptor = safeGetOwnPropertyDescriptor(prototype, 'constructor');
      const constructorPrototype = constructorDescriptor
        && safeHasOwn(constructorDescriptor, 'value')
        && typeof constructorDescriptor.value === 'function'
        ? safeGetOwnPropertyDescriptor(constructorDescriptor.value, 'prototype')
        : null;
      if (safeGetPrototypeOf(prototype) !== null
        || !constructorPrototype
        || !safeHasOwn(constructorPrototype, 'value')
        || constructorPrototype.value !== prototype
        || safeFunctionToString(constructorDescriptor.value) !== nativeObjectSource) {
        throw invalidPlainData();
      }
    }

    const keys = safeOwnKeys(value);
    const entries = [];
    if (isArray) {
      const lengthDescriptor = safeGetOwnPropertyDescriptor(value, 'length');
      if (!lengthDescriptor || !safeHasOwn(lengthDescriptor, 'value')) {
        throw invalidPlainData();
      }
      const length = lengthDescriptor.value;
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        const key = keys[keyIndex];
        if (key === 'length') continue;
        if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
          throw invalidPlainData();
        }
        const descriptor = safeGetOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !safeHasOwn(descriptor, 'value')) {
          throw invalidPlainData();
        }
        safeArrayPush(entries, [key, descriptor.value]);
      }
      if (entries.length !== length) throw invalidPlainData();
      safeArraySort(entries, (a, b) => Number(a[0]) - Number(b[0]));
      return { isArray, entries };
    }

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const key = keys[keyIndex];
      if (typeof key !== 'string') throw invalidPlainData();
      const descriptor = safeGetOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !safeHasOwn(descriptor, 'value')) {
        throw invalidPlainData();
      }
      safeArrayPush(entries, [key, descriptor.value]);
    }
    return { isArray, entries };
  }

  function validatePrimitive(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    throw invalidPlainData();
  }

  function validatePlainGraph(value) {
    const active = new SafeWeakSet();
    const validated = new SafeWeakSet();
    const stack = [{ value, leaving: false }];
    let nodeCount = 0;

    while (stack.length > 0) {
      const frame = safeArrayPop(stack);
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
        safeWeakSetDelete(active, current);
        safeWeakSetAdd(validated, current);
        continue;
      }
      if (safeWeakSetHas(active, current)) throw invalidPlainData();
      if (safeWeakSetHas(validated, current)) continue;
      safeWeakSetAdd(active, current);
      const inspected = inspectPlainObject(current);
      safeArrayPush(stack, { value: current, leaving: true });
      for (let index = inspected.entries.length - 1; index >= 0; index -= 1) {
        safeArrayPush(stack, { value: inspected.entries[index][1], leaving: false });
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
      const clones = new SafeWeakMap();
      safeWeakMapSet(clones, value, output);
      const stack = [{ output, entries: rootInspection.entries, index: 0 }];
      while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        if (frame.index >= frame.entries.length) {
          safeArrayPop(stack);
          continue;
        }
        const entry = frame.entries[frame.index];
        const key = entry[0];
        const child = entry[1];
        frame.index += 1;
        let childClone = child;
        if (child !== null && typeof child === 'object') {
          childClone = safeWeakMapGet(clones, child);
          if (childClone === undefined) {
            const childInspection = inspectPlainObject(child);
            childClone = childInspection.isArray ? [] : {};
            safeWeakMapSet(clones, child, childClone);
            safeArrayPush(stack, { output: childClone, entries: childInspection.entries, index: 0 });
          }
        }
        safeDefineProperty(frame.output, key, {
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
      const descriptor = safeGetOwnPropertyDescriptor(object, key);
      return descriptor && safeHasOwn(descriptor, 'value')
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
      if (!isObject || safeArrayIsArray(cloned) !== requireArray) return fallback;
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

  function recomputeTrustedCapability(profile) {
    try {
      if (!trustedEvaluateCapabilityProfile) return null;
      const result = clonePlainData(trustedEvaluateCapabilityProfile(profile));
      if (!result || typeof result !== 'object' || Array.isArray(result)
        || !RISK_LEVELS.has(result.status)
        || !Number.isSafeInteger(result.difficultyCap) || result.difficultyCap < 1 || result.difficultyCap > 2
        || !Array.isArray(result.exclusions) || result.exclusions.some(value => !['floor', 'hinge'].includes(value))
        || !result.variants || typeof result.variants !== 'object' || Array.isArray(result.variants)
        || !['standard', 'high_seat'].includes(result.variants.knee_dominant)
        || !['standard', 'close_wall'].includes(result.variants.horizontal_push)
        || !Number.isSafeInteger(result.cardioStartMinutes) || result.cardioStartMinutes < 0
        || !Array.isArray(result.reasonCodes)
        || result.reasonCodes.some(code => typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(code))
        || result.reasonCodes.includes('INVALID_INPUT')) return null;
      return {
        status: result.status,
        difficultyCap: result.difficultyCap,
        exclusions: [...result.exclusions],
        variants: {
          knee_dominant: result.variants.knee_dominant,
          horizontal_push: result.variants.horizontal_push
        },
        cardioStartMinutes: result.cardioStartMinutes,
        reasonCodes: [...result.reasonCodes]
      };
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

  function capabilityResultsEqual(left, right) {
    return Boolean(left && right
      && left.status === right.status
      && left.difficultyCap === right.difficultyCap
      && left.cardioStartMinutes === right.cardioStartMinutes
      && Array.isArray(left.exclusions) && Array.isArray(right.exclusions)
      && left.exclusions.length === right.exclusions.length
      && left.exclusions.every((value, index) => value === right.exclusions[index])
      && left.variants && right.variants
      && left.variants.knee_dominant === right.variants.knee_dominant
      && left.variants.horizontal_push === right.variants.horizontal_push
      && Array.isArray(left.reasonCodes) && Array.isArray(right.reasonCodes)
      && left.reasonCodes.length === right.reasonCodes.length
      && left.reasonCodes.every((value, index) => value === right.reasonCodes[index]));
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
        const adaptationId = typeof record.adaptationId === 'string' && ADAPTATION_ID_PATTERN.test(record.adaptationId)
          ? record.adaptationId : null;
        if (completedAt) clean[`${planId}.${sessionId}`] = adaptationId
          ? { planId, sessionId, adaptationId, status: 'completed', completedAt }
          : { planId, sessionId, status: 'completed', completedAt };
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
        || !Number.isSafeInteger(record.capabilityRevision) || record.capabilityRevision < 1
        || !Number.isSafeInteger(record.weekNumber) || record.weekNumber < 1 || record.weekNumber > 4 || !submittedAt || !answers
        || !proposal || !WEEKLY_TYPES.has(proposal.type) || !reasonCode || !variableValid
        || !(proposal.targetWeekNumber === null || (Number.isSafeInteger(proposal.targetWeekNumber) && proposal.targetWeekNumber >= 2 && proposal.targetWeekNumber <= 4))
        || !WEEKLY_DECISIONS.has(record.decision) || decidedAt === undefined || (record.decision === 'pending') !== (decidedAt === null)
        || (record.decision === 'accepted') !== (resultPlanId !== null)
        || (record.decision === 'accepted' && resultPlanId !== expectedResultPlanId)
        || (resultPlanId !== null && resultPlanId === planId)) continue;
      clean.push({ id, reviewVersion: 1, planId, resultPlanId, intakeRevision: record.intakeRevision,
        capabilityRevision: record.capabilityRevision, weekNumber: record.weekNumber,
        submittedAt, answers, proposal: { type: proposal.type, targetWeekNumber: proposal.targetWeekNumber,
          variable: variable || null, reasonCode }, decision: record.decision, decidedAt });
    }
    return clean;
  }

  function weeklyPlanLineage(reviews, currentPlanId, capabilityRevision) {
    const lineage = new Set([currentPlanId]);
    const accepted = reviews.filter(record => record && record.capabilityRevision === capabilityRevision && record.decision === 'accepted');
    const incoming = new Map();
    const outgoing = new Map();
    for (const record of accepted) {
      if (incoming.has(record.resultPlanId) || outgoing.has(record.planId)) return lineage;
      incoming.set(record.resultPlanId, record.planId);
      outgoing.set(record.planId, record.resultPlanId);
    }
    const globallyVisited = new Set();
    for (const start of outgoing.keys()) {
      if (globallyVisited.has(start)) continue;
      const path = new Set();
      let cursor = start;
      while (outgoing.has(cursor)) {
        if (path.has(cursor)) return new Set([currentPlanId]);
        path.add(cursor); globallyVisited.add(cursor); cursor = outgoing.get(cursor);
      }
    }
    let cursor = currentPlanId;
    while (incoming.has(cursor)) {
      const parent = incoming.get(cursor);
      if (lineage.has(parent)) return new Set([currentPlanId]);
      lineage.add(parent); cursor = parent;
    }
    for (const record of accepted) {
      if (!lineage.has(record.planId) || !lineage.has(record.resultPlanId)) return new Set([currentPlanId]);
    }
    return lineage;
  }

  function buildWeeklyLineageSummary(reviews, currentPlanId, capabilityRevision) {
    const accepted = reviews.filter(record => record && record.capabilityRevision === capabilityRevision && record.decision === 'accepted');
    const lineage = weeklyPlanLineage(reviews, currentPlanId, capabilityRevision);
    if (accepted.some(record => !lineage.has(record.planId) || !lineage.has(record.resultPlanId))) return null;
    const byResultPlanId = new Map(accepted.map(record => [record.resultPlanId, record]));
    const edges = [];
    let cursor = currentPlanId;
    while (byResultPlanId.has(cursor)) {
      const record = byResultPlanId.get(cursor);
      edges.unshift(Object.freeze({
        sourcePlanId: record.planId,
        resultPlanId: record.resultPlanId,
        weekNumber: record.weekNumber,
        capabilityRevision: record.capabilityRevision
      }));
      cursor = record.planId;
    }
    return Object.freeze({
      validationResult: 'passed',
      currentPlanId,
      acceptedEdges: Object.freeze(edges)
    });
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

    const capabilityProfile = ownDataValue(raw, 'capabilityProfile');
    const capabilityRevision = ownDataValue(raw, 'capabilityRevision');
    const capabilityFieldsDeclared = capabilityProfile.present && capabilityRevision.present;
    let capabilityValid = false;
    if (capabilityFieldsDeclared && Number.isSafeInteger(capabilityRevision.value) && capabilityRevision.value >= 1
      && capabilityProfile.value !== null) {
      const cleanProfile = cloneObjectOr(capabilityProfile.value, null, false);
      const trustedResult = cleanProfile && recomputeTrustedCapability(cleanProfile);
      if (cleanProfile && trustedResult) {
        defaults.capabilityProfile = cleanProfile;
        defaults.capabilityResult = trustedResult;
        defaults.capabilityRevision = capabilityRevision.value;
        capabilityValid = true;
      }
    }
    const plan = ownDataValue(raw, 'plan');
    if (!riskMismatch && plan.present && plan.value !== null) defaults.plan = cloneObjectOr(plan.value, null, false);
    if (defaults.plan && !capabilityValid) {
      defaults.plan.status = 'stale';
      defaults.plan.staleReason = 'capability_required';
      defaults.plan.staleAt = '1970-01-01T00:00:00.000Z';
    } else if (defaults.plan && capabilityValid && defaults.plan.capabilityRevision !== defaults.capabilityRevision) {
      defaults.plan.status = 'stale';
      defaults.plan.staleReason = 'capability_revision_mismatch';
      defaults.plan.staleAt = '1970-01-01T00:00:00.000Z';
    }

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
        if (storage.getItem(STORAGE_KEY) !== serialized) throw new Error('PERSISTENCE_MISMATCH');
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

    function saveCapabilityProfile(profile) {
      const cleanProfile = clonePlainData(profile);
      if (!cleanProfile || typeof cleanProfile !== 'object' || Array.isArray(cleanProfile)) throw invalidPlainData();
      const trustedResult = recomputeTrustedCapability(cleanProfile);
      if (!trustedResult) throw invalidPlainData();
      const state = loadStateForWrite();
      if (state.capabilityRevision >= Number.MAX_SAFE_INTEGER) throw createStorageError();
      state.capabilityProfile = cleanProfile;
      state.capabilityResult = trustedResult;
      state.capabilityRevision += 1;
      if (state.plan) {
        state.plan.status = 'stale';
        state.plan.staleReason = 'capability_changed';
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
        const result = clonePlainData(trustedValidatePlan({ plan: candidate, intake: state.intake, risk: state.risk,
          capabilityResult: state.capabilityResult, capabilityRevision: state.capabilityRevision, catalog: trustedExerciseCatalog }));
        if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.ok !== 'boolean' || !Array.isArray(result.errors)) return 'unavailable';
        return result.ok === true && result.errors.length === 0 ? 'passed' : 'failed';
      } catch (_error) {
        return 'unavailable';
      }
    }

    function passesTrustedPlanGate(plan, state) {
      return trustedPlanValidationResult(plan, state) === 'passed';
    }

    function hasCurrentCapabilityBinding(plan, state, options) {
      const requireReview = Boolean(options && options.requireReview);
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)
        || !state || typeof state !== 'object' || Array.isArray(state)
        || !state.capabilityProfile || typeof state.capabilityProfile !== 'object' || Array.isArray(state.capabilityProfile)
        || !state.capabilityResult || typeof state.capabilityResult !== 'object' || Array.isArray(state.capabilityResult)
        || !Number.isSafeInteger(state.capabilityRevision) || state.capabilityRevision < 1
        || !['normal', 'conservative'].includes(state.capabilityResult.status)
        || plan.capabilityRevision !== state.capabilityRevision) return false;
      const trustedResult = recomputeTrustedCapability(state.capabilityProfile);
      if (!trustedResult || !capabilityResultsEqual(state.capabilityResult, trustedResult)) return false;
      if (!requireReview) return true;
      return Boolean(plan.review && plan.review.capabilityRevision === state.capabilityRevision);
    }

    function isPlanApprovedForState(plan, state) {
      const review = plan && plan.review;
      return Boolean(review && review.status === 'approved'
        && sanitizeMachineId(review.reviewerId)
        && review.planId === plan.id
        && review.intakeRevision === state.intakeRevision
        && hasCurrentCapabilityBinding(plan, state, { requireReview: true })
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(review.reviewedAt));
    }

    function savePlan(plan) {
      const cleanPlan = clonePlainData(plan);
      if (cleanPlan === null || typeof cleanPlan !== 'object' || Array.isArray(cleanPlan)) {
        throw invalidPlainData();
      }
      const state = loadStateForWrite();
      if (cleanPlan.status !== 'generated' || cleanPlan.intakeRevision !== state.intakeRevision
        || !hasCurrentCapabilityBinding(cleanPlan, state, { requireReview: false })
        || !passesTrustedPlanGate(cleanPlan, state)) throw createStorageError();
      cleanPlan.status = 'pending_review';
      cleanPlan.intakeRevision = state.intakeRevision;
      cleanPlan.capabilityRevision = state.capabilityRevision;
      cleanPlan.review = null;
      delete cleanPlan.staleReason;
      delete cleanPlan.staleAt;
      state.plan = cleanPlan;
      return persist(state);
    }

    function saveCapabilityProfileWithPlan(profile, plan) {
      const cleanProfile = clonePlainData(profile);
      const cleanPlan = clonePlainData(plan);
      if (!cleanProfile || typeof cleanProfile !== 'object' || Array.isArray(cleanProfile)
        || !cleanPlan || typeof cleanPlan !== 'object' || Array.isArray(cleanPlan)) throw invalidPlainData();
      const trustedResult = recomputeTrustedCapability(cleanProfile);
      if (!trustedResult || !['normal', 'conservative'].includes(trustedResult.status)) throw createStorageError();
      const state = loadStateForWrite();
      if (state.capabilityRevision >= Number.MAX_SAFE_INTEGER) throw createStorageError();
      const nextRevision = state.capabilityRevision + 1;
      state.capabilityProfile = cleanProfile;
      state.capabilityResult = trustedResult;
      state.capabilityRevision = nextRevision;
      if (cleanPlan.status !== 'generated' || cleanPlan.intakeRevision !== state.intakeRevision
        || cleanPlan.capabilityRevision !== nextRevision
        || !hasCurrentCapabilityBinding(cleanPlan, state, { requireReview: false })
        || !passesTrustedPlanGate(cleanPlan, state)) throw createStorageError();
      cleanPlan.status = 'pending_review';
      cleanPlan.intakeRevision = state.intakeRevision;
      cleanPlan.capabilityRevision = nextRevision;
      cleanPlan.review = null;
      delete cleanPlan.staleReason;
      delete cleanPlan.staleAt;
      state.plan = cleanPlan;
      return persist(state);
    }

    function buildDetailedReviewDossier() {
      const state = loadStateForWrite(), plan = state.plan;
      const trustedRisk = state.intake && recomputeTrustedRisk(state.intake);
      const planId = plan && sanitizeMachineId(plan.id);
      const availableWeekdays = state.intake && Array.isArray(state.intake.weekdays)
        ? state.intake.weekdays.filter(day => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(day))
        : [];
      const selectedSetting = state.intake && ['home', 'gym'].includes(state.intake.setting) ? state.intake.setting : null;
      const trustedEquipmentIds = new Set(trustedExerciseCatalog.flatMap(exercise => exercise.equipmentOptions.flat()));
      const availableEquipment = state.intake && Array.isArray(state.intake.equipment)
        ? state.intake.equipment.filter(item => trustedEquipmentIds.has(item))
        : [];
      if (!planId || !trustedRisk || !risksEqual(state.risk, trustedRisk)
        || !selectedSetting
        || !['pending_review', 'active'].includes(plan.status)
        || !hasCurrentCapabilityBinding(plan, state, { requireReview: plan.status === 'active' })
        || !passesTrustedPlanGate(plan, state)) throw createStorageError();
      const lineageSummary = buildWeeklyLineageSummary(state.weeklyReviews, planId, state.capabilityRevision);
      if (!lineageSummary) throw createStorageError();
      const catalogById = new Map(trustedExerciseCatalog.map(exercise => [exercise.id, exercise]));
      const weeks = plan.weeks.map(week => Object.freeze({
        number: week.number,
        sessions: Object.freeze(week.sessions.map(session => Object.freeze({
          weekday: session.weekday,
          intent: session.intent,
          setting: session.setting,
          estimatedMinutes: session.estimatedMinutes,
          actions: Object.freeze(session.actions.map(action => {
            const exercise = catalogById.get(action.exerciseId);
            if (!exercise) throw createStorageError();
            return Object.freeze({
              id: exercise.id,
              name: exercise.name,
              reviewStatus: exercise.reviewStatus,
              pattern: action.pattern,
              phase: action.phase,
              variant: Object.prototype.hasOwnProperty.call(action, 'variant') ? action.variant : null,
              equipmentOptions: Object.freeze(exercise.equipmentOptions.map(option => Object.freeze([...option]))),
              contraindications: Object.freeze([...exercise.contraindications]),
              dose: Object.freeze(Object.fromEntries(['sets', 'reps', 'rpe', 'restSec', 'durationMin', 'holdSec']
                .filter(key => Object.prototype.hasOwnProperty.call(action, key)).map(key => [key, action[key]]))),
              gif: exercise.gif,
              cues: Object.freeze({ ...exercise.cues })
            });
          }))
        })))
      }));
      return Object.freeze({
        participantId: normalizeParticipantId(state.participantId),
        planId,
        intakeRevision: state.intakeRevision,
        capabilityStatus: state.capabilityResult.status,
        capabilityRevision: state.capabilityRevision,
        constraintCodes: Object.freeze([...state.capabilityResult.reasonCodes]),
        selectedSetting,
        availableEquipment: Object.freeze([...availableEquipment]),
        availableWeekdays: Object.freeze([...availableWeekdays]),
        ruleVersion: trustedRisk.ruleVersion,
        riskLevel: trustedRisk.level,
        riskCodes: Object.freeze(trustedRisk.reasons.map(reason => reason.code)),
        planVersion: TRUSTED_PLAN_VERSIONS.has(plan.planVersion) ? plan.planVersion : null,
        validationResult: 'passed',
        lineage: lineageSummary,
        weeks: Object.freeze(weeks)
      });
    }

    function approvePlanReview(input) {
      const clean = clonePlainData(input);
      if (!clean || typeof clean !== 'object' || Array.isArray(clean)
        || Object.keys(clean).length !== 3
        || Object.keys(clean).some(key => !['reviewerId', 'planId', 'intakeRevision'].includes(key))) throw invalidPlainData();
      const reviewerId = sanitizeMachineId(clean.reviewerId), planId = sanitizeMachineId(clean.planId);
      if (!reviewerId || !planId || !Number.isSafeInteger(clean.intakeRevision) || clean.intakeRevision < 1) throw invalidPlainData();
      const state = loadStateForWrite(), plan = state.plan;
      const trustedRisk = state.intake && recomputeTrustedRisk(state.intake);
      if (!plan || plan.status !== 'pending_review' || plan.id !== planId
        || plan.intakeRevision !== state.intakeRevision || clean.intakeRevision !== state.intakeRevision
        || !hasCurrentCapabilityBinding(plan, state, { requireReview: false })
        || !trustedRisk || !risksEqual(state.risk, trustedRisk)
        || !['normal', 'conservative'].includes(trustedRisk.level)
        || !passesTrustedPlanGate(plan, state)) throw createStorageError();
      const reviewedAt = String(now());
      if (!UTC_ISO_PATTERN.test(reviewedAt)) throw createStorageError();
      plan.status = 'active';
      plan.review = { status: 'approved', reviewerId, reviewedAt, planId, intakeRevision: state.intakeRevision,
        capabilityRevision: state.capabilityRevision };
      return persist(state);
    }

    function recordWorkoutCompletion(completion) {
      const clean = clonePlainData(completion);
      const keys = clean && typeof clean === 'object' && !Array.isArray(clean) ? Object.keys(clean) : [];
      const legacy = keys.length === 2 && keys.every(key => ['planId', 'sessionId'].includes(key));
      const adapted = keys.length === 4 && keys.every(key => ['planId', 'sessionId', 'adaptationId', 'manifest'].includes(key));
      if (!legacy && !adapted) throw invalidPlainData();
      const planId = sanitizeMachineId(clean.planId);
      const sessionId = sanitizeMachineId(clean.sessionId);
      const adaptationId = adapted && typeof clean.adaptationId === 'string' && ADAPTATION_ID_PATTERN.test(clean.adaptationId)
        ? clean.adaptationId : null;
      if (!planId || !sessionId || (adapted && !adaptationId)) throw invalidPlainData();
      const state = loadStateForWrite();
      const plan = state.plan;
      const sessions = plan && Array.isArray(plan.weeks)
        ? plan.weeks.flatMap(week => week && Array.isArray(week.sessions) ? week.sessions : [])
        : [];
      if (!plan || plan.status !== 'active' || plan.id !== planId
        || plan.intakeRevision !== state.intakeRevision
        || !isPlanApprovedForState(plan, state)
        || !passesTrustedPlanGate(plan, state)
        || !sessions.some(session => session && session.id === sessionId)) throw createStorageError();
      if (adapted) {
        let validation = null;
        try {
          validation = trustedValidateDailyExecution && trustedValidateDailyExecution({
            plan: state.plan,
            intake: state.intake,
            intakeRevision: state.intakeRevision,
            risk: state.risk,
            capabilityProfile: state.capabilityProfile,
            capabilityRevision: state.capabilityRevision,
            manifest: clean.manifest
          });
        } catch (_error) {
          validation = null;
        }
        if (!validation || validation.ok !== true || !Array.isArray(validation.errors) || validation.errors.length !== 0
          || !clean.manifest || clean.manifest.adaptationId !== adaptationId
          || clean.manifest.sourcePlanId !== planId || clean.manifest.sourceSessionId !== sessionId
          || !clean.manifest.executionSession || clean.manifest.executionSession.id !== sessionId) throw createStorageError();
      }
      const completedAt = String(now());
      if (!UTC_ISO_PATTERN.test(completedAt)) throw createStorageError();
      state.logs[`${planId}.${sessionId}`] = adapted
        ? { planId, sessionId, adaptationId, status: 'completed', completedAt }
        : { planId, sessionId, status: 'completed', completedAt };
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
        || !isPlanApprovedForState(plan, state) || !passesTrustedPlanGate(plan, state)
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
      const lineage = state.plan ? weeklyPlanLineage(state.weeklyReviews, state.plan.id, state.capabilityRevision) : new Set();
      const previousReviews = state.weeklyReviews.filter(item => item.capabilityRevision === state.capabilityRevision && lineage.has(item.planId));
      let proposal;
      try { proposal = trustedProposeWeeklyChange({ plan: state.plan, review,
        previousReviews, intake: state.intake, risk: state.risk,
        capabilityResult: state.capabilityResult, capabilityRevision: state.capabilityRevision }); }
      catch (_error) { return null; }
      return proposal && proposal.status === 'ok' && WEEKLY_TYPES.has(proposal.type) ? proposal : null;
    }

    function recordWeeklyReview(review) {
      const cleanReview = clonePlainData(review);
      if (!cleanReview || typeof cleanReview !== 'object' || Array.isArray(cleanReview)) throw invalidPlainData();
      const state = loadStateForWrite(), plan = state.plan;
      const lineage = plan ? weeklyPlanLineage(state.weeklyReviews, plan.id, state.capabilityRevision) : new Set();
      if (!plan || plan.status !== 'active' || plan.intakeRevision !== state.intakeRevision
        || !isPlanApprovedForState(plan, state) || !passesTrustedPlanGate(plan, state)
        || state.weeklyReviews.length >= MAX_WEEKLY_REVIEWS
        || state.weeklyReviews.some(item => item.capabilityRevision === state.capabilityRevision && lineage.has(item.planId) && item.decision === 'pending')) throw createStorageError();
      const weekNumber = cleanReview.weekNumber;
      const reviewedWeeks = new Set(state.weeklyReviews.filter(item => item.capabilityRevision === state.capabilityRevision && lineage.has(item.planId)).map(item => item.weekNumber));
      const expectedWeekNumber = [1, 2, 3, 4].find(number => !reviewedWeeks.has(number));
      if (weekNumber !== expectedWeekNumber) throw createStorageError();
      const week = Number.isSafeInteger(weekNumber) && weekNumber >= 1 && weekNumber <= 4 ? plan.weeks[weekNumber - 1] : null;
      if (!week || !Array.isArray(week.sessions) || state.weeklyReviews.some(item => item.capabilityRevision === state.capabilityRevision && lineage.has(item.planId) && item.weekNumber === weekNumber)) throw createStorageError();
      const proposal = proposeForState(state, cleanReview);
      if (!proposal) throw createStorageError();
      const submittedAt = String(now());
      if (!UTC_ISO_PATTERN.test(submittedAt)) throw createStorageError();
      const answers = sanitizeWeeklyAnswers({ ...cleanReview, scheduledSessions: week.sessions.length });
      if (!answers) throw invalidPlainData();
      const decision = proposal.type === 'rescreen' ? 'rescreen' : 'pending';
      const record = { id: `weekly.${plan.id}.w${weekNumber}`, reviewVersion: 1, planId: plan.id, resultPlanId: null,
        intakeRevision: state.intakeRevision, capabilityRevision: state.capabilityRevision, weekNumber, submittedAt, answers,
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
        || record.capabilityRevision !== state.capabilityRevision || state.plan.capabilityRevision !== record.capabilityRevision
        || !isPlanApprovedForState(state.plan, state) || !passesTrustedPlanGate(state.plan, state)) throw createStorageError();
      const decidedAt = String(now());
      if (!UTC_ISO_PATTERN.test(decidedAt)) throw createStorageError();
      if (clean.decision === 'accepted') {
        const proposal = proposeForState(state, weeklyReviewInput(record));
        if (!proposal || !proposal.after || proposal.type !== record.proposal.type
          || proposal.variable !== record.proposal.variable || proposal.reason !== record.proposal.reasonCode
          || !hasCurrentCapabilityBinding(proposal.after, state, { requireReview: false })
          || !passesTrustedPlanGate(proposal.after, state)) throw createStorageError();
        const adjusted = clonePlainData(proposal.after);
        adjusted.id = `${state.plan.id}-w${record.weekNumber}-a`;
        adjusted.capabilityRevision = state.capabilityRevision;
        if (!hasCurrentCapabilityBinding(adjusted, state, { requireReview: false })
          || !passesTrustedPlanGate(adjusted, state)) throw createStorageError();
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
      const capabilityStatus = state.capabilityResult && ['normal', 'conservative', 'manual_review', 'stop'].includes(state.capabilityResult.status)
        ? state.capabilityResult.status : null;
      const capabilityRevision = Number.isSafeInteger(state.capabilityRevision) && state.capabilityRevision > 0 ? state.capabilityRevision : null;
      const constraintCodes = state.capabilityResult && Array.isArray(state.capabilityResult.reasonCodes)
        ? state.capabilityResult.reasonCodes.filter(code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code)) : [];
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
        capabilityStatus,
        capabilityRevision,
        constraintCodes: Object.freeze([...constraintCodes]),
        planSummary,
        validationResult
      });
    }

    function exportReviewSummary() {
      return buildReviewSummary(loadState());
    }

    return Object.freeze({ loadState, saveIntake, saveCapabilityProfile, saveCapabilityProfileWithPlan, savePlan, buildDetailedReviewDossier, approvePlanReview, recordWorkoutCompletion, recordWorkoutStop, recordWeeklyReview, resolveWeeklyReview, clearAll, clearAllDetailed, buildReviewSummary, exportReviewSummary });
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
    saveCapabilityProfile: defaultStore.saveCapabilityProfile,
    saveCapabilityProfileWithPlan: defaultStore.saveCapabilityProfileWithPlan,
    savePlan: defaultStore.savePlan,
    buildDetailedReviewDossier: defaultStore.buildDetailedReviewDossier,
    approvePlanReview: defaultStore.approvePlanReview,
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
