const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

const modules = Object.freeze({
  namespace: path.join(projectRoot, 'src', 'namespace.js'),
  riskEngine: path.join(projectRoot, 'src', 'domain', 'risk-engine.js'),
  capabilityEngine: path.join(projectRoot, 'src', 'domain', 'capability-engine.js'),
  movementMatcher: path.join(projectRoot, 'src', 'domain', 'movement-matcher.js'),
  planValidator: path.join(projectRoot, 'src', 'domain', 'plan-validator.js'),
  planGenerator: path.join(projectRoot, 'src', 'domain', 'plan-generator.js'),
  planExplanation: path.join(projectRoot, 'src', 'domain', 'plan-explanation.js'),
  sessionReadiness: path.join(projectRoot, 'src', 'domain', 'session-readiness.js'),
  dailyExecutionValidator: path.join(projectRoot, 'src', 'domain', 'daily-execution-validator.js'),
  sessionAdaptation: path.join(projectRoot, 'src', 'domain', 'session-adaptation.js'),
  weeklyAdaptation: path.join(projectRoot, 'src', 'domain', 'weekly-adaptation.js'),
  localStore: path.join(projectRoot, 'src', 'storage', 'local-store.js'),
  exerciseCatalog: path.join(projectRoot, 'src', 'data', 'exercise-catalog.js'),
  legacyPlan: path.join(projectRoot, 'src', 'data', 'legacy-demo-plan.js'),
  trackerFields: path.join(projectRoot, 'src', 'data', 'tracker-fields.js'),
  dashboard: path.join(projectRoot, 'src', 'ui', 'dashboard.js'),
  sessionReadinessUi: path.join(projectRoot, 'src', 'ui', 'session-readiness.js'),
  workoutGuide: path.join(projectRoot, 'src', 'ui', 'workout-guide.js'),
  onboarding: path.join(projectRoot, 'src', 'ui', 'onboarding.js'),
  capabilityAssessment: path.join(projectRoot, 'src', 'ui', 'capability-assessment.js'),
  weeklyReview: path.join(projectRoot, 'src', 'ui', 'weekly-review.js'),
  privacyTools: path.join(projectRoot, 'src', 'ui', 'privacy-tools.js'),
  app: path.join(projectRoot, 'src', 'app.js'),
});

function clearMove28ModuleCache() {
  const dependencySafeOrder = [
    modules.app,
    modules.privacyTools,
    modules.weeklyReview,
    modules.workoutGuide,
    modules.sessionReadinessUi,
    modules.capabilityAssessment,
    modules.onboarding,
    modules.localStore,
    modules.weeklyAdaptation,
    modules.sessionAdaptation,
    modules.dailyExecutionValidator,
    modules.sessionReadiness,
    modules.planExplanation,
    modules.planGenerator,
    modules.planValidator,
    modules.movementMatcher,
    modules.dashboard,
    modules.trackerFields,
    modules.legacyPlan,
    modules.exerciseCatalog,
    modules.capabilityEngine,
    modules.riskEngine,
    modules.namespace,
  ];
  for (const modulePath of dependencySafeOrder) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
}

function loadScript(name) {
  const modulePath = modules[name] || path.resolve(projectRoot, name);
  return require(modulePath);
}

module.exports = { projectRoot, modules, clearMove28ModuleCache, loadScript };
