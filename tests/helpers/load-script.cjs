const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

const modules = Object.freeze({
  namespace: path.join(projectRoot, 'src', 'namespace.js'),
  exerciseCatalog: path.join(projectRoot, 'src', 'data', 'exercise-catalog.js'),
  legacyPlan: path.join(projectRoot, 'src', 'data', 'legacy-demo-plan.js'),
  trackerFields: path.join(projectRoot, 'src', 'data', 'tracker-fields.js'),
  dashboard: path.join(projectRoot, 'src', 'ui', 'dashboard.js'),
  workoutGuide: path.join(projectRoot, 'src', 'ui', 'workout-guide.js'),
  app: path.join(projectRoot, 'src', 'app.js'),
});

function clearMove28ModuleCache() {
  for (const modulePath of Object.values(modules)) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
}

function loadScript(name) {
  const modulePath = modules[name] || path.resolve(projectRoot, name);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

module.exports = { projectRoot, modules, clearMove28ModuleCache, loadScript };
