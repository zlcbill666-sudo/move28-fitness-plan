'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'media-src/scripts/build_local_exercisedb_mapping.py');
const reportPath = path.join(root, 'docs/research/data/move28-local-exercisedb-mapping.json');
const contactPath = path.join(root, 'docs/research/evidence/local-exercisedb/move28-local-candidates.jpg');
const catalog = require('../../src/data/exercise-catalog.js').exerciseCatalog;
const manifestPath = path.join(root, 'assets/exercises/manifest.json');
const library = 'E:\\个人用\\健身\\健身动作动画\\bootstrapping-lab-exercisedb-api';
const python = process.env.PYTHON || 'python';

function loadReport() {
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(args) {
  return spawnSync(python, ['-B', ...args], { cwd: root, encoding: 'utf8' });
}

test('当前媒体发布证据完整覆盖25项且与正式manifest一致', () => {
  const report = loadReport();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.mapping.map(item => item.exerciseId), catalog.map(item => item.id));
  assert.deepEqual(report.mapping.map(item => item.exerciseId), manifest.assets.map(item => item.id));
  assert.deepEqual(report.counts, { exact: 17, project_owned: 8 });
  assert.equal(report.releaseEligibleCount, 25);
  assert.ok(report.mapping.every(item => item.releaseEligible === true));
  assert.equal(report.decision, 'current-formal-manifest-25-item-gif-release-evidence');
  assert.equal(report.reviewMethod.semanticClassificationIsManual, true);
  assert.deepEqual(report.reviewMethod.automatedChecks, [
    'catalog-sha256', 'formal-manifest-sha256', 'source-sha256', 'record-identity',
    'gif-format', 'dimensions', 'frame-count', 'release-gate-binding',
  ]);
  for (const item of report.mapping) {
    const asset = manifest.assets.find(entry => entry.id === item.exerciseId);
    assert.ok(asset, item.exerciseId);
    assert.equal(item.formalManifest.replacementPath, asset.replacement.gif.path);
    assert.equal(item.formalManifest.productionStatus, 'approved');
    assert.match(item.candidate.sha256, /^[a-f0-9]{64}$/);
    assert.equal(item.candidate.width, 180);
    assert.equal(item.candidate.height, 180);
    assert.ok(item.candidate.frameCount >= 2);
  }
});

test('十七项本地ExerciseDB候选身份固定且三项重审结论不再保留旧near/reject语义', () => {
  const report = loadReport();
  const exact = Object.fromEntries(report.mapping.filter(item => item.classification === 'exact').map(item => [item.exerciseId, item.candidate.exerciseDbId]));
  assert.deepEqual(exact, {
    'seated-leg-raise': 'Hgs6Nl1',
    'ankle-circle': 'uL9CsKm',
    'seated-leg-press': '10Z2DXU',
    'seated-leg-curl': 'Zg3XY7P',
    'glute-bridge': 'u0cNiij',
    'chest-press-machine': 'T0yTjgW',
    'seated-row': '7I6LNUG',
    'pallof-press': '9pa4H5m',
    'high-seat-sit-to-stand': 'Gu2rNJd',
    'seated-leg-extension': 'my33uHU',
    'hip-abduction-machine': 'CHpahtl',
    'wall-push-up': 'LEH9jxP',
    'dead-bug': 'iny3m5y',
    'elliptical-trainer': 'rjtuP6X',
    'flat-walk': 'rjiM4L3',
    'hamstring-stretch': '99rWm7w',
    'calf-stretch': '17bqEXD',
  });
  const byId = Object.fromEntries(report.mapping.map(item => [item.exerciseId, item]));
  assert.equal(byId['ankle-circle'].classification, 'exact');
  assert.match(byId['ankle-circle'].reason, /站姿脚踝绕环/);
  assert.equal(byId['high-seat-sit-to-stand'].classification, 'exact');
  assert.match(byId['high-seat-sit-to-stand'].reason, /史密斯机/);
  assert.equal(byId['flat-walk'].classification, 'exact');
  assert.match(byId['flat-walk'].reason, /坡度跑台慢走/);
  assert.doesNotMatch(JSON.stringify([byId['ankle-circle'], byId['high-seat-sit-to-stand'], byId['flat-walk']]), /0坡度|reject|near/);
});

test('八项项目自有Pillow动图作为正式manifest发布证据而非ExerciseDB候选', () => {
  const report = loadReport();
  const projectOwned = report.mapping.filter(item => item.classification === 'project_owned');
  assert.deepEqual(projectOwned.map(item => item.exerciseId), [
    'wall-hip-hinge','standing-band-chest-press','band-row','seated-knee-extension-unloaded',
    'supported-calf-raise','heel-slide','bird-dog-regression','supported-standing-march'
  ]);
  assert.ok(projectOwned.every(item => item.candidate.provider === 'MOVE 28 Pillow'));
  assert.ok(projectOwned.every(item => item.candidate.exerciseDbId === null));
  assert.ok(projectOwned.every(item => item.formalManifest.replacementPath === `assets/exercises/${item.exerciseId}.gif`));
});

test('联系表与报告绑定且本地冻结库可重复生成字节一致输出', { skip: !fs.existsSync(library) }, () => {
  const report = loadReport();
  assert.equal(hash(contactPath), report.reviewMethod.contactSheetSha256);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-local-map-'));
  const generatedReport = path.join(temp, 'report.json');
  const generatedContact = path.join(temp, 'contact.jpg');
  const result = run([script, '--library', library, '--report', generatedReport, '--contact', generatedContact]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readFileSync(generatedReport), fs.readFileSync(reportPath));
  assert.deepEqual(fs.readFileSync(generatedContact), fs.readFileSync(contactPath));
  fs.rmSync(temp, { recursive: true, force: true });
});

test('本地库漂移失败关闭、删除旧双输出且不泄漏错误路径或traceback', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-local-map-bad-'));
  const outputs = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-local-map-bad-out-'));
  fs.mkdirSync(path.join(temp, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'media'), { recursive: true });
  fs.writeFileSync(path.join(temp, 'src/data/exercises.json'), '[]');
  const report = path.join(outputs, 'out.json');
  const contact = path.join(outputs, 'out.jpg');
  fs.writeFileSync(report, 'stale-report');
  fs.writeFileSync(contact, 'stale-contact');
  const result = run([script, '--library', temp, '--report', report, '--contact', contact]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"error": "mapping_failed"/);
  assert.doesNotMatch(result.stderr, /Traceback|exercises\.json/);
  assert.equal(fs.existsSync(report), false);
  assert.equal(fs.existsSync(contact), false);
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(outputs, { recursive: true, force: true });
});

test('输出不得覆盖数据库、动作目录、候选GIF或互相别名', { skip: !fs.existsSync(library) }, () => {
  const candidate = path.join(library, 'media', '10Z2DXU.gif');
  const before = hash(candidate);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-local-map-alias-'));
  const cases = [
    ['--report', candidate, '--contact', path.join(temp, 'contact.jpg')],
    ['--report', path.join(library, 'src/data/exercises.json'), '--contact', path.join(temp, 'contact.jpg')],
    ['--report', path.join(temp, 'same'), '--contact', path.join(temp, 'same')],
  ];
  for (const args of cases) {
    const result = run([script, '--library', library, ...args]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "mapping_failed"/);
  }
  assert.equal(hash(candidate), before);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('双输出事务安装失败回滚旧报告和联系表', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-local-map-transaction-'));
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); spec=importlib.util.spec_from_file_location('mapping',p); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
a=root/'contact'; b=root/'report'; a.write_bytes(b'old-contact'); b.write_bytes(b'old-report'); original=m.Path.replace

def fail_report(self,target):
 if self.suffix=='.tmp' and pathlib.Path(target)==b: raise OSError('probe')
 return original(self,target)
m.Path.replace=fail_report
try: m.transactional_write([(a,b'new-contact'),(b,b'new-report')])
except OSError: pass
print(json.dumps({'a':a.read_text(),'b':b.read_text(),'files':sorted(x.name for x in root.iterdir())}))
`;
  const result = run(['-c', probe, script, temp]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { a: 'old-contact', b: 'old-report', files: ['contact', 'report'] });
  fs.rmSync(temp, { recursive: true, force: true });
});

test('研究映射不得改写正式manifest的25项前台媒体门', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.assets.length, 25);
  assert.deepEqual(manifest.assets.filter(item => item.production.releaseEligible).map(item => item.id), ['seated-leg-raise','ankle-circle','seated-leg-press','seated-leg-curl','glute-bridge','wall-hip-hinge','chest-press-machine','standing-band-chest-press','seated-row','band-row','pallof-press','high-seat-sit-to-stand','seated-leg-extension','seated-knee-extension-unloaded','supported-calf-raise','hip-abduction-machine','wall-push-up','dead-bug','heel-slide','bird-dog-regression','elliptical-trainer','flat-walk','supported-standing-march','hamstring-stretch','calf-stretch']);
  assert.equal(manifest.policy.frontendMediaMode, 'media_enabled');
});
