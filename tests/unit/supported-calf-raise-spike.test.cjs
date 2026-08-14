const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'media-src/scripts/analyze_supported_calf_raise_spike.py');
const source = path.join(root, 'media-build/source-research/gymvisual-prepurchase-previews/supported-calf-raise.gif');
const spec = path.join(root, 'docs/research/data/move28-media-production-spec.json');
const matrix = path.join(root, 'docs/research/data/move28-3d-candidate-matrix.json');
const catalog = path.join(root, 'src/data/exercise-catalog.js');
const report = path.join(root, 'docs/research/data/supported-calf-raise-spike.json');
const contact = path.join(root, 'docs/research/evidence/move28-spikes/supported-calf-raise/contact-numbered.jpg');
const python = process.env.PYTHON || 'python';

function run(args) {
  return spawnSync(python, ['-B', ...args], { cwd: root, encoding: 'utf8' });
}

function temporary() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'move28-supported-calf-'));
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('冻结报告记录Gymvisual候选动作可用但支撑替换No-Go', () => {
  const data = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(data.exerciseId, 'supported-calf-raise');
  assert.equal(data.manualMotionReview.bilateralCalfRaiseVisible, true);
  assert.equal(data.manualMotionReview.existingSupportIsStableChair, false);
  assert.equal(data.automatedTimingEvidence.peakDurationSeconds, 1);
  assert.equal(data.automatedTimingEvidence.meetsOneSecondPeak, true);
  assert.equal(data.allEditPrerequisitesMet, false);
  assert.deepEqual(data.editPrerequisites, {
    editable3dSceneAndRig: false,
    replaceableSupportObject: false,
    trackedHandContactAnchors: false,
  });
  assert.equal(data.prohibitedShortcutAssessment.bothForbiddenByContract, true);
  assert.equal(data.decision, 'no-go');
  assert.equal(data.nextStage, 'custom-3d');
  assert.equal(data.releaseEligible, false);
});

test('冻结源可重复生成字节相同报告和联系表', { skip: !fs.existsSync(source) }, () => {
  const temp = temporary();
  const generatedReport = path.join(temp, 'report.json');
  const generatedContact = path.join(temp, 'contact.jpg');
  const result = run([script, '--report', generatedReport, '--contact', generatedContact]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(fs.readFileSync(generatedReport), fs.readFileSync(report));
  assert.deepEqual(fs.readFileSync(generatedContact), fs.readFileSync(contact));
  fs.rmSync(temp, { recursive: true, force: true });
});

test('源、规格、矩阵和动作目录均为完整SHA冻结输入', () => {
  const data = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(hash(source), data.frozenInputs.sourceSha256);
  assert.equal(hash(spec), data.frozenInputs.productionSpecSha256);
  assert.equal(hash(matrix), data.frozenInputs.candidateMatrixSha256);
  assert.equal(hash(catalog), data.frozenInputs.exerciseCatalogSha256);
  assert.equal(hash(contact), data.manualMotionReview.contactSheetSha256);
});

test('任一冻结输入漂移都失败关闭并删除旧输出', { skip: !fs.existsSync(source) }, () => {
  const temp = temporary();
  const changed = path.join(temp, 'changed.json');
  const output = path.join(temp, 'report.json');
  fs.writeFileSync(output, 'stale');
  for (const [flag, original] of [['--spec', spec], ['--matrix', matrix], ['--catalog', catalog]]) {
    fs.copyFileSync(original, changed);
    fs.appendFileSync(changed, '\n');
    const result = run([script, flag, changed, '--report', output, '--contact', path.join(temp, 'contact.jpg')]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "analysis_failed"/);
    assert.doesNotMatch(result.stderr, /Traceback|changed\.json/);
    assert.equal(fs.existsSync(output), false);
    fs.writeFileSync(output, 'stale');
  }
  fs.rmSync(temp, { recursive: true, force: true });
});

test('输入输出及双输出路径别名在分析前拒绝', { skip: !fs.existsSync(source) }, () => {
  const temp = temporary();
  const same = path.join(temp, 'same.bin');
  const cases = [
    [script, '--report', source, '--contact', same],
    [script, '--report', spec, '--contact', same],
    [script, '--report', same, '--contact', same],
  ];
  for (const args of cases) {
    const result = run(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "analysis_failed"/);
  }
  assert.equal(hash(source), '0880cf0843e5c957a38f9c3ebc1e0fa2670e4615ae71df18c017fe20096c7cfa');
  fs.rmSync(temp, { recursive: true, force: true });
});

test('第二目标暂存失败清理第一临时文件并保留旧双输出', () => {
  const temp = temporary();
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('calf',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
a=root/'a'; b=root/'b'; a.write_bytes(b'old-a'); b.write_bytes(b'old-b'); original=m.stage_bytes; count=0
def fail_second(path,content):
 global count
 count+=1
 if count==2: raise OSError('probe')
 return original(path,content)
m.stage_bytes=fail_second
try: m.transactional_write([(a,b'new-a'),(b,b'new-b')])
except OSError: pass
print(json.dumps({'a':a.read_text(),'b':b.read_text(),'files':sorted(x.name for x in root.iterdir())}))
`;
  const result = run(['-c', probe, script, temp]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { a: 'old-a', b: 'old-b', files: ['a', 'b'] });
  fs.rmSync(temp, { recursive: true, force: true });
});

test('第二目标安装失败回滚旧双输出且无临时残留', () => {
  const temp = temporary();
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('calf',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
a=root/'a'; b=root/'b'; a.write_bytes(b'old-a'); b.write_bytes(b'old-b'); original=m.Path.replace
def fail_second(self,target):
 if self.suffix=='.tmp' and pathlib.Path(target)==b: raise OSError('probe')
 return original(self,target)
m.Path.replace=fail_second
try: m.transactional_write([(a,b'new-a'),(b,b'new-b')])
except OSError: pass
print(json.dumps({'a':a.read_text(),'b':b.read_text(),'files':sorted(x.name for x in root.iterdir())}))
`;
  const result = run(['-c', probe, script, temp]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { a: 'old-a', b: 'old-b', files: ['a', 'b'] });
  fs.rmSync(temp, { recursive: true, force: true });
});

test('fdopen失败关闭描述符并清理暂存文件', () => {
  const temp = temporary();
  const probe = String.raw`
import importlib.util,json,os,pathlib,sys
p=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('calf',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
record={}; original=m.tempfile.mkstemp
def tracked(*args,**kwargs):
 fd,name=original(*args,**kwargs); record['fd']=fd; return fd,name
def fail(*args,**kwargs): raise OSError('probe')
m.tempfile.mkstemp=tracked; m.os.fdopen=fail
try: m.stage_bytes(target,b'x')
except OSError: pass
try: os.fstat(record['fd']); closed=False
except OSError: closed=True
print(json.dumps({'closed':closed,'files':sorted(x.name for x in target.parent.iterdir())}))
`;
  const result = run(['-c', probe, script, path.join(temp, 'out')]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { closed: true, files: [] });
  fs.rmSync(temp, { recursive: true, force: true });
});
