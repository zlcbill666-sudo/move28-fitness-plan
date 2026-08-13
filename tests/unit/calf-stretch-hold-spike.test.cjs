const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'media-src/scripts/analyze_calf_stretch_hold_spike.py');
const source = path.join(root, 'media-build/source-research/gymvisual-prepurchase-previews/calf-stretch.mp4');
const spec = path.join(root, 'docs/research/data/move28-media-production-spec.json');
const frozenReport = path.join(root, 'docs/research/data/calf-stretch-hold-spike.json');
const evidence = path.join(root, 'docs/research/evidence/move28-spikes/calf-stretch/contact-2fps-numbered.jpg');
const python = process.env.PYTHON || 'python';
const specSha256 = 'db6ec82abf96b9d98fb7382e0be134d4ae2d647db883b87ff3a7f7d5bc461686';

function run(args, options = {}) {
  return spawnSync(python, ['-B', ...args], { cwd: root, encoding: 'utf8', ...options });
}

function temporary() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'move28-calf-hold-'));
}

test('冻结报告记录Go编码方案但继续阻止发布', () => {
  const report = JSON.parse(fs.readFileSync(frozenReport, 'utf8'));
  assert.equal(report.exerciseId, 'calf-stretch');
  assert.equal(report.productionSpecSha256, specSha256);
  assert.equal(report.decision, 'go');
  assert.equal(report.nextStage, 'controlled-edit-production');
  assert.equal(report.releaseEligible, false);
  assert.deepEqual(report.encodingPlan.phaseOrder, ['neutral', 'dorsiflex', 'hold-20s', 'release']);
  assert.equal(report.encodingPlan.holdSourceFrame, 121);
  assert.equal(report.encodingPlan.holdCopies, 600);
  assert.equal(report.encodingPlan.holdSeconds, 20);
  assert.equal(report.encodingPlan.frameInterpolation, false);
  assert.equal(report.encodingPlan.repetitiveToeTappingRetained, false);
  assert.equal(report.manualMotionReview.heelGrounded, true);
  assert.equal(report.manualMotionReview.assistiveToolCount, 0);
});

test('冻结源可重复生成相同报告和25.866秒候选WebM', { skip: !fs.existsSync(source) }, () => {
  const temp = temporary();
  const reportPath = path.join(temp, 'report.json');
  const videoPath = path.join(temp, 'candidate.webm');
  const result = run([script, '--source', source, '--spec', spec, '--report', reportPath, '--candidate-webm', videoPath]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const frozen = JSON.parse(fs.readFileSync(frozenReport, 'utf8'));
  assert.deepEqual({ ...generated, candidateEncoding: null }, frozen);
  assert.equal(generated.candidateEncoding.frameCount, 776);
  assert.equal(generated.candidateEncoding.durationSeconds, 776 / 30);
  assert.equal(generated.candidateEncoding.holdUniqueDecodedFrames, 1);
  assert.equal(generated.candidateEncoding.sourceHoldPixelSha256, generated.candidateEncoding.decodedHoldPixelSha256);
  assert.equal(fs.realpathSync.native(generated.candidateEncoding.path), fs.realpathSync.native(videoPath));
  assert.equal(fs.statSync(videoPath).size > 0, true);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('候选编码保持区精确600帧且只含一个源像素帧', { skip: !fs.existsSync(source) }, () => {
  const temp = temporary();
  const videoPath = path.join(temp, 'candidate.webm');
  const probe = String.raw`
import importlib.util,json,pathlib,sys,tempfile
p=pathlib.Path(sys.argv[1]); source=pathlib.Path(sys.argv[2]); out=pathlib.Path(sys.argv[3]); s=importlib.util.spec_from_file_location('calf',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as t:
 frames=m.extract_all_frames(source,pathlib.Path(t)/'frames'); evidence=m.encode_candidate(frames,out)
 print(json.dumps({'evidence':evidence,'holdHash':m.pixel_hash(frames[120]),'sourceRuns':m.identical_runs([m.pixel_hash(f) for f in frames])}))
`;
  const result = run(['-c', probe, script, source, videoPath]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.equal(output.evidence.frameCount, 776);
  assert.equal(output.evidence.durationSeconds, 776 / 30);
  assert.equal(output.evidence.sourceHoldPixelSha256, output.holdHash);
  assert.equal(output.evidence.decodedHoldPixelSha256, output.holdHash);
  assert.deepEqual(output.sourceRuns.filter(([a, b]) => a === 90 || a === 121), [[90, 120], [121, 194]]);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('错误源和漂移合同失败关闭且不泄漏内部异常', () => {
  const temp = temporary();
  const badSource = path.join(temp, 'source.mp4');
  const badSpec = path.join(temp, 'spec.json');
  const reportPath = path.join(temp, 'report.json');
  fs.writeFileSync(badSource, 'wrong');
  fs.writeFileSync(badSpec, '{}');
  for (const args of [
    [script, '--source', badSource, '--report', reportPath],
    [script, '--source', source, '--spec', badSpec, '--report', reportPath],
  ]) {
    const result = run(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "analysis_failed"/);
    assert.doesNotMatch(result.stderr, /Traceback|wrong|spec\.json/);
  }
  fs.rmSync(temp, { recursive: true, force: true });
});

test('规格任意顶层漂移均因完整SHA绑定而失败关闭', { skip: !fs.existsSync(source) }, () => {
  const temp = temporary();
  const changedSpec = path.join(temp, 'spec.json');
  const reportPath = path.join(temp, 'report.json');
  const payload = JSON.parse(fs.readFileSync(spec, 'utf8'));
  payload.reviewedAt = '2099-01-01';
  fs.writeFileSync(changedSpec, `${JSON.stringify(payload)}\n`);
  const result = run([script, '--source', source, '--spec', changedSpec, '--report', reportPath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"error": "analysis_failed"/);
  assert.equal(fs.existsSync(reportPath), false);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('输入输出及双输出路径别名均在写入前拒绝', () => {
  const temp = temporary();
  const sentinel = path.join(temp, 'sentinel.mp4');
  fs.writeFileSync(sentinel, 'keep');
  const sourceAlias = run([script, '--source', sentinel, '--report', sentinel]);
  const specAlias = run([script, '--source', source, '--spec', spec, '--report', spec]);
  const output = path.join(temp, 'same.bin');
  const outputAlias = run([script, '--source', source, '--report', output, '--candidate-webm', output]);
  for (const result of [sourceAlias, specAlias, outputAlias]) {
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /"error": "analysis_failed"/);
  }
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep');
  assert.equal(fs.existsSync(output), false);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('报告与候选视频作为事务提交，第二目标失败时旧双产物不变', () => {
  const temp = temporary();
  const probe = String.raw`
import importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); root=pathlib.Path(sys.argv[2]); s=importlib.util.spec_from_file_location('calf',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
report=root/'report.json'; video=root/'candidate.webm'; report.write_bytes(b'old-report'); video.write_bytes(b'old-video')
original=m.Path.replace
def fail_video(self,target):
 if self.suffix=='.tmp' and pathlib.Path(target)==video: raise OSError('probe')
 return original(self,target)
m.Path.replace=fail_video
try: m.transactional_write([(report,b'new-report'),(video,b'new-video')])
except OSError: pass
print(json.dumps({'report':report.read_text(),'video':video.read_text(),'files':sorted(x.name for x in root.iterdir())}))
`;
  const result = run(['-c', probe, script, temp]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    report: 'old-report', video: 'old-video', files: ['candidate.webm', 'report.json'],
  });
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
  const result = run(['-c', probe, script, path.join(temp, 'out.bin')]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { closed: true, files: [] });
  fs.rmSync(temp, { recursive: true, force: true });
});

test('联系表像素证据和源身份精确绑定', () => {
  const crypto = require('node:crypto');
  const report = JSON.parse(fs.readFileSync(frozenReport, 'utf8'));
  const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash(evidence), report.manualMotionReview.contactSheetSha256);
  assert.equal(hash(source), report.source.sha256);
});
