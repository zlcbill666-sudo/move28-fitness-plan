'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const script = path.join(root, 'media-src', 'scripts', 'analyze_seated_knee_extension_spike.py');
const reportPath = path.join(root, 'docs', 'research', 'data', 'seated-knee-extension-unloaded-spike.json');
const specPath = path.join(root, 'docs', 'research', 'data', 'move28-media-production-spec.json');
const sourcePath = path.join(root, 'media-build', 'source-research', 'gymvisual-prepurchase-previews', 'seated-knee-extension-unloaded.gif');
const cachePath = path.join(root, 'media-src', 'scripts', '__pycache__');

function snapshotTree(target) {
  if (!fs.existsSync(target)) return null;
  return fs.readdirSync(target, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const file = path.join(entry.parentPath || entry.path, entry.name);
      return [path.relative(target, file), fs.readFileSync(file).toString('base64')];
    })
    .sort((left, right) => left[0].localeCompare(right[0]));
}

function runPython(args) {
  const before = snapshotTree(cachePath);
  const result = spawnSync('python', ['-B', ...args], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.deepEqual(snapshotTree(cachePath), before, 'Python probe modified repository __pycache__');
  return result;
}

test('Spike报告把人工动作审核和自动时间证据分开并给出No-Go', () => {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.exerciseId, 'seated-knee-extension-unloaded');
  assert.equal(report.source.sha256, '6589241da7ec6a8a00b373606ff042d6702199bcbbc2873400db399df93ab6ab');
  assert.equal(report.source.directEvidenceUrl, 'https://gymvisual.com/img/p/4/2/1/1/4/42114.gif');
  assert.equal(report.source.encodedFrameCount, 24);
  assert.equal(report.source.durationSeconds, 5);
  assert.equal(report.source.packets.length, 24);
  assert.equal(report.source.encodedFrameSha256.length, 24);
  assert.deepEqual(report.manualMotionReview, {
    reviewVersion: 1,
    reviewBasis: 'numbered-encoded-frame-contact-sheet',
    contactSheetSha256: 'b035c42f677aa1bd9775f0b2bb6320691743e419a1f7ab110cb1b8cdd01937d2',
    selectedSide: 'first-alternating-side',
    cycleEncodedFrameStart: 0,
    cycleEncodedFrameEnd: 12,
    phaseOrder: ['neutral', 'extend', 'near-straight', 'return', 'neutral'],
    sameSideCompleteReturnVisible: true,
    peakEncodedFrame: 6,
  });
  assert.deepEqual(report.automatedTimingEvidence, {
    peakEncodedFrame: 6,
    peakDurationSeconds: 0.5,
    nominalMotionFrameSeconds: 0.1,
    durationMultiplier: 5,
    prolongedStaticPeak: true,
    forbiddenOperationDetected: 'knee-lock-frame-hold',
    decision: 'no-go',
    fallback: 'custom-3d',
  });
  assert.equal(report.decision, 'no-go');
  assert.equal(report.fallback, 'custom-3d');
  assert.equal(report.releaseEligible, false);
  assert.equal(report.externalActionPerformed, false);
});

test('时间判定按峰值持续时间语义工作而非依赖固定区间索引', () => {
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); s=importlib.util.spec_from_file_location('spike',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
cases={
 'peak_early':m.classify_peak_hold([.1,.5,.1,.1],1),
 'peak_late':m.classify_peak_hold([.1,.1,.1,.5],3),
 'longer':m.classify_peak_hold([.1,.1,1.0,.1],2),
 'tiny_scale':m.classify_peak_hold([1e-12,2e-12,1e-12],1),
 'nominal':m.classify_peak_hold([.1,.1,.1,.1],2),
 'within_tolerance':m.classify_peak_hold([1.0,1.0+5e-10,1.0],1),
}
print(json.dumps(cases))
`;
  const result = runPython(['-c', probe, script]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const cases = JSON.parse(result.stdout);
  for (const name of ['peak_early', 'peak_late', 'longer', 'tiny_scale']) {
    assert.equal(cases[name].decision, 'no-go');
    assert.equal(cases[name].fallback, 'custom-3d');
  }
  assert.equal(cases.nominal.decision, 'requires-manual-review');
  assert.equal(cases.nominal.fallback, null);
  assert.equal(cases.within_tolerance.decision, 'requires-manual-review');
});

test('时间判定拒绝非法、非有限和越界输入', () => {
  const probe = String.raw`
import importlib.util,json,math,pathlib,sys
p=pathlib.Path(sys.argv[1]); s=importlib.util.spec_from_file_location('spike',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
cases=[
 ([],0),([.1],1),([0,.1],1),([float('nan'),.1],1),([float('inf'),.1],1),([True,.1],1),
 ([.1,.2],True),([.1,.2],1.0),([1e308,1e308],1),
]
results=[]
for durations,index in cases:
 try: m.classify_peak_hold(durations,index); results.append('accepted')
 except ValueError: results.append('rejected')
print(json.dumps(results))
`;
  const result = runPython(['-c', probe, script]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), Array(9).fill('rejected'));
});

test('错误源身份失败关闭且删除旧报告', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const badSource = path.join(temp, 'source.gif');
  const output = path.join(temp, 'report.json');
  fs.writeFileSync(badSource, Buffer.from('not-the-reviewed-source'));
  fs.writeFileSync(output, 'stale');
  const result = runPython([script, '--source', badSource, '--report', output, '--no-contact-sheet']);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(output), false);
  assert.match(result.stdout, /"error": "analysis_failed"/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('畸形规格异常也失败关闭且删除旧报告', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const badSpec = path.join(temp, 'spec.json');
  const output = path.join(temp, 'report.json');
  fs.writeFileSync(badSpec, '{}');
  fs.writeFileSync(output, 'stale');
  const result = runPython([script, '--spec', badSpec, '--report', output, '--no-contact-sheet']);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(output), false);
  assert.doesNotMatch(result.stderr, /Traceback/);
  assert.match(result.stdout, /"ok": false/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('缺失输入明确失败并提示显式获取流程', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const missingSource = path.join(temp, 'missing.gif');
  const output = path.join(temp, 'report.json');
  const result = runPython([script, '--source', missingSource, '--report', output, '--no-contact-sheet']);
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(output), false);
  assert.match(result.stdout, /"error": "analysis_failed"/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('输出路径异常不会泄漏traceback或留下部分报告', { skip: !fs.existsSync(sourcePath) }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const reportDirectory = path.join(temp, 'report.json');
  fs.mkdirSync(reportDirectory);
  const result = runPython([script, '--source', sourcePath, '--report', reportDirectory, '--no-contact-sheet']);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /Traceback/);
  assert.match(result.stdout, /"error": "analysis_failed"/);
  assert.equal(fs.statSync(reportDirectory).isDirectory(), true);
  assert.deepEqual(fs.readdirSync(temp).sort(), ['report.json']);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('报告提交失败时联系表和已有旧产物保持不变', { skip: !fs.existsSync(sourcePath) }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const reportDirectory = path.join(temp, 'report.json');
  const sheet = path.join(temp, 'contact.png');
  fs.mkdirSync(reportDirectory);
  fs.writeFileSync(sheet, 'old-sheet');
  const result = runPython([script, '--source', sourcePath, '--report', reportDirectory, '--contact-sheet', sheet]);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /Traceback/);
  assert.match(result.stdout, /"error": "analysis_failed"/);
  assert.equal(fs.readFileSync(sheet, 'utf8'), 'old-sheet');
  assert.deepEqual(fs.readdirSync(temp).sort(), ['contact.png', 'report.json']);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('联系表写入失败不会创建报告或临时残留', { skip: !fs.existsSync(sourcePath) }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const output = path.join(temp, 'report.json');
  const sheetDirectory = path.join(temp, 'contact.png');
  fs.mkdirSync(sheetDirectory);
  const result = runPython([script, '--source', sourcePath, '--report', output, '--contact-sheet', sheetDirectory]);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stderr, /Traceback/);
  assert.match(result.stdout, /"error": "analysis_failed"/);
  assert.equal(fs.existsSync(output), false);
  assert.deepEqual(fs.readdirSync(temp).sort(), ['contact.png']);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('第二个目标暂存失败会清理第一个临时文件并保留旧产物', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('spike',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
report=root/'report.json'; sheet=root/'contact.png'; report.write_bytes(b'old-report'); sheet.write_bytes(b'old-sheet')
original=m.stage_bytes; calls={'n':0}
def fail_second(path,content):
 calls['n']+=1
 if calls['n']==2: raise OSError('probe')
 return original(path,content)
m.stage_bytes=fail_second
try: m.transactional_write([(report,b'new-report'),(sheet,b'new-sheet')])
except OSError: pass
print(json.dumps({'report':report.read_text(),'sheet':sheet.read_text(),'files':sorted(x.name for x in root.iterdir())}))
`;
  const result = runPython(['-c', probe, script, temp]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    report: 'old-report', sheet: 'old-sheet', files: ['contact.png', 'report.json'],
  });
  fs.rmSync(temp, { recursive: true, force: true });
});

test('回滚失败可观测并保留唯一旧产物备份', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('spike',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
report=root/'report.json'; sheet=root/'contact.png'; report.write_bytes(b'old-report'); sheet.write_bytes(b'old-sheet')
original=m.Path.replace
def injected(self,target):
 if self.suffix=='.tmp' and pathlib.Path(target)==sheet: raise OSError('install-probe')
 if self.suffix=='.bak' and pathlib.Path(target)==report: raise OSError('rollback-probe')
 return original(self,target)
m.Path.replace=injected
caught=None
try: m.transactional_write([(report,b'new-report'),(sheet,b'new-sheet')])
except BaseException as exc: caught={'type':type(exc).__name__,'children':len(exc.exceptions) if isinstance(exc,ExceptionGroup) else 0}
files=sorted(x.name for x in root.iterdir()); backups=[x for x in root.iterdir() if x.suffix=='.bak']
print(json.dumps({'caught':caught,'reportExists':report.exists(),'sheet':sheet.read_text(),'files':files,'backupBytes':backups[0].read_text() if len(backups)==1 else None}))
`;
  const result = runPython(['-c', probe, script, temp]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const outcome = JSON.parse(result.stdout);
  assert.deepEqual(outcome.caught, { type: 'ExceptionGroup', children: 2 });
  assert.equal(outcome.reportExists, false);
  assert.equal(outcome.sheet, 'old-sheet');
  assert.equal(outcome.backupBytes, 'old-report');
  assert.equal(outcome.files.filter((name) => name.endsWith('.bak')).length, 1);
  assert.equal(outcome.files.some((name) => name.endsWith('.tmp')), false);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('输出路径不得与源、规格或另一输出解析为同一路径', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const source = path.join(temp, 'source.gif');
  const spec = path.join(temp, 'spec.json');
  fs.writeFileSync(source, 'source-sentinel');
  fs.writeFileSync(spec, 'spec-sentinel');
  const sourceAlias = runPython([script, '--source', source, '--report', source, '--no-contact-sheet']);
  const specAlias = runPython([script, '--spec', spec, '--report', spec, '--no-contact-sheet']);
  const output = path.join(temp, 'output.bin');
  const outputAlias = runPython([script, '--source', source, '--report', output, '--contact-sheet', output]);
  for (const result of [sourceAlias, specAlias, outputAlias]) {
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "analysis_failed"/);
    assert.doesNotMatch(result.stderr, /Traceback/);
  }
  assert.equal(fs.readFileSync(source, 'utf8'), 'source-sentinel');
  assert.equal(fs.readFileSync(spec, 'utf8'), 'spec-sentinel');
  assert.equal(fs.existsSync(output), false);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('fdopen失败会关闭描述符并删除暂存文件', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const probe = String.raw`
import importlib.util,json,os,pathlib,sys
p=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('spike',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
record={}; original=m.tempfile.mkstemp
def tracked(*args,**kwargs):
 fd,name=original(*args,**kwargs); record['fd']=fd; return fd,name
def fail_fdopen(*args,**kwargs): raise OSError('probe')
m.tempfile.mkstemp=tracked; m.os.fdopen=fail_fdopen
try: m.stage_bytes(target,b'x')
except OSError: pass
try: os.fstat(record['fd']); closed=False
except OSError: closed=True
print(json.dumps({'closed':closed,'files':[x.name for x in target.parent.iterdir()]}))
`;
  const result = runPython(['-c', probe, script, path.join(temp, 'out.bin')]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { closed: true, files: [] });
  fs.rmSync(temp, { recursive: true, force: true });
});

test('本地冻结源可重复生成同一报告和确定性联系表', { skip: !fs.existsSync(sourcePath) }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-knee-spike-'));
  const output = path.join(temp, 'report.json');
  const sheet = path.join(temp, 'contact.png');
  const result = runPython([script, '--source', sourcePath, '--spec', specPath, '--report', output, '--contact-sheet', sheet]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = JSON.parse(fs.readFileSync(output, 'utf8'));
  const frozen = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.deepEqual(generated, frozen);
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(sheet)).digest('hex');
  assert.equal(hash, frozen.manualMotionReview.contactSheetSha256);
  fs.rmSync(temp, { recursive: true, force: true });
});
