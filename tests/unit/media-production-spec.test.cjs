'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const specPath = path.join(projectRoot, 'docs', 'research', 'data', 'move28-media-production-spec.json');
const pythonCache = path.join(projectRoot, 'media-src', 'scripts', '__pycache__');

function snapshotFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath).toString('base64') : null;
}

function snapshotTree(root) {
  if (!fs.existsSync(root)) return null;
  return fs.readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const filePath = path.join(entry.parentPath || entry.path, entry.name);
      return [path.relative(root, filePath), fs.readFileSync(filePath).toString('base64')];
    })
    .sort((left, right) => left[0].localeCompare(right[0]));
}

function runPython(args, options = {}) {
  const before = snapshotTree(pythonCache);
  const result = spawnSync('python', ['-B', ...args], options);
  assert.deepEqual(snapshotTree(pythonCache), before, 'Python probe modified repository __pycache__');
  return result;
}

function loadSpec() {
  return JSON.parse(fs.readFileSync(specPath, 'utf8'));
}

function runWithInputs(script, spec, matrix, args = []) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'move28-media-spec-'));
  const tempSpec = path.join(tempRoot, 'spec.json');
  const tempMatrix = path.join(tempRoot, 'matrix.json');
  const tempOutput = path.join(tempRoot, 'review.html');
  fs.writeFileSync(tempSpec, `${JSON.stringify(spec, null, 2)}\n`);
  fs.writeFileSync(tempMatrix, `${JSON.stringify(matrix, null, 2)}\n`);
  const probe = `import importlib.util, pathlib, sys\np=pathlib.Path(sys.argv[1]); s=importlib.util.spec_from_file_location('review', p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.SPEC=pathlib.Path(sys.argv[2]); m.MATRIX=pathlib.Path(sys.argv[3]); m.OUT=pathlib.Path(sys.argv[4]); sys.argv=[sys.argv[0],*sys.argv[5:]]; raise SystemExit(m.main())`;
  const result = runPython(['-c', probe, script, tempSpec, tempMatrix, tempOutput, ...args], { cwd: projectRoot, encoding: 'utf8' });
  const outputExists = fs.existsSync(tempOutput);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  return { result, outputExists };
}

test('媒体生产规格精确覆盖4项受控编辑和5项专业定制', () => {
  const spec = loadSpec();
  assert.equal(spec.schemaVersion, 1);
  assert.equal(spec.releaseEligible, false);
  assert.equal(spec.externalActionPerformed, false);
  assert.deepEqual(spec.editPackages.map(item => item.exerciseId), [
    'high-seat-sit-to-stand',
    'seated-knee-extension-unloaded',
    'supported-calf-raise',
    'calf-stretch',
  ]);
  assert.deepEqual(spec.customPackages.map(item => item.exerciseId), [
    'wall-hip-hinge',
    'bird-dog-regression',
    'supported-standing-march',
    'ankle-circle',
    'dead-bug',
  ]);
  for (const item of [...spec.editPackages, ...spec.customPackages]) {
    assert.equal(item.releaseBlocked, true, item.exerciseId);
    assert.match(item.catalogContractSha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(spec.editPackages.every(item => item.fallback === 'custom-3d'));
  assert.equal(spec.technicalStandard.review, 'mp4-h264');
  assert.equal(spec.technicalStandard.masterDirectory, 'frames');
  assert.equal(spec.technicalStandard.framePattern, 'frame-%04d.png');
  assert.ok(spec.technicalStandard.requiredFiles.includes('production-manifest.json'));
  assert.ok(spec.technicalStandard.requiredFiles.includes('review.mp4'));
});

test('四项编辑规格锁定不可用文案掩盖的动作与场景差距', () => {
  const byId = Object.fromEntries(loadSpec().editPackages.map(item => [item.exerciseId, item]));
  assert.ok(byId['seated-knee-extension-unloaded'].forbiddenOperations.includes('cut-before-neutral-return'));
  assert.ok(byId['supported-calf-raise'].forbiddenOperations.includes('label-only-chair-claim'));
  assert.ok(byId['supported-calf-raise'].acceptanceCriteria.some(item => item.metric === 'stable_chair_visible' && item.value === true));
  assert.ok(byId['high-seat-sit-to-stand'].forbiddenOperations.includes('two-dimensional-seat-overlay'));
  assert.ok(byId['high-seat-sit-to-stand'].acceptanceCriteria.some(item => item.metric === 'catalog_variant' && item.value === 'high_seat'));
  assert.ok(byId['calf-stretch'].forbiddenOperations.includes('retain-repetitive-toe-tapping'));
  assert.ok(byId['calf-stretch'].acceptanceCriteria.some(item => item.metric === 'continuous_peak_hold_seconds' && item.operator === 'gte' && item.value === 20));
});

test('五项定制规格锁定安全关键接触和禁用模式', () => {
  const byId = Object.fromEntries(loadSpec().customPackages.map(item => [item.exerciseId, item]));
  assert.ok(byId['wall-hip-hinge'].requiredContacts.includes('buttocks-wall-at-peak'));
  assert.ok(byId['wall-hip-hinge'].forbiddenPatterns.includes('squat-pattern'));
  assert.ok(byId['bird-dog-regression'].requiredContacts.includes('sliding-hand-mat'));
  assert.ok(byId['bird-dog-regression'].forbiddenPatterns.includes('opposite-leg-extension'));
  assert.ok(byId['supported-standing-march'].requiredContacts.includes('left-hand-chair'));
  assert.ok(byId['supported-standing-march'].requiredContacts.includes('right-hand-chair'));
  assert.ok(byId['ankle-circle'].qaMetrics.some(item => item.metric === 'clockwise_circle_count' && item.value === 1));
  assert.ok(byId['ankle-circle'].qaMetrics.some(item => item.metric === 'counterclockwise_circle_count' && item.value === 1));
  assert.ok(byId['ankle-circle'].forbiddenPatterns.includes('fast-motion'));
  assert.ok(byId['dead-bug'].requiredContacts.includes('arms-mat-at-sides'));
  assert.ok(byId['dead-bug'].forbiddenPatterns.includes('toe-tap'));
  assert.ok(byId['dead-bug'].forbiddenPatterns.includes('wall-press'));
});

test('生产规格审核台生成器对当前矩阵和运行时目录通过', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const repositoryOutput = path.join(projectRoot, 'media-build', 'source-research', 'move28-media-production-review.html');
  const before = snapshotFile(repositoryOutput);
  const matrixPath = path.join(projectRoot, 'docs', 'research', 'data', 'move28-3d-candidate-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const { result, outputExists } = runWithInputs(script, loadSpec(), matrix);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(outputExists, true);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.editPackages, 4);
  assert.equal(report.customPackages, 5);
  assert.match(report.specSha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshotFile(repositoryOutput), before);
});

test('生产规格审核台对定制候选矩阵身份漂移失败关闭且不留旧审核台', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const matrixPath = path.join(projectRoot, 'docs', 'research', 'data', 'move28-3d-candidate-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const deadBug = matrix.assets.find(item => item.id === 'dead-bug');
  deadBug.url = 'https://example.invalid/drifted-candidate';
  deadBug.risk = 'drifted risk';
  deadBug.evidence.sha256 = '0'.repeat(64);
  const { result, outputExists } = runWithInputs(script, loadSpec(), matrix);
  assert.notEqual(result.status, 0);
  assert.equal(outputExists, false);
});

test('生产规格头字段漂移失败关闭且不留旧审核台', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const matrixPath = path.join(projectRoot, 'docs', 'research', 'data', 'move28-3d-candidate-matrix.json');
  const spec = loadSpec();
  spec.scope = '<script>drift</script>';
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const { result, outputExists } = runWithInputs(script, spec, matrix);
  assert.notEqual(result.status, 0);
  assert.equal(outputExists, false);
});

test('真实生产包拒绝额外目录、重复尾帧、异源视频和伪联系表', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const probe = String.raw`
import copy, hashlib, importlib.util, json, pathlib, shutil, subprocess, sys, tempfile
script=pathlib.Path(sys.argv[1]); spec_path=pathlib.Path(sys.argv[2])
s=importlib.util.spec_from_file_location('review',script); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
spec=json.loads(spec_path.read_text(encoding='utf-8')); package=spec['editPackages'][0]; schema=spec['productionPackageSchema']; technical=spec['technicalStandard']
def run(cmd): subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def build(base, colors):
 root=base/technical['outputRoot']/package['exerciseId']; frames=root/'frames'; frames.mkdir(parents=True)
 for i,color in enumerate(colors): run(['ffmpeg','-y','-f','lavfi','-i',f'color=c={color}:s=512x512:d=0.04','-frames:v','1',str(frames/f'frame-{i:04d}.png')])
 pattern=str(frames/'frame-%04d.png')
 run(['ffmpeg','-y','-framerate','24','-i',pattern,'-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv444p',str(root/'master.webm')])
 run(['ffmpeg','-y','-framerate','24','-i',pattern,'-c:v','libx264','-crf','0','-pix_fmt','yuv444p',str(root/'review.mp4')])
 run(['ffmpeg','-y','-framerate','24','-i',pattern,str(root/'fallback.gif')])
 shutil.copy2(frames/'frame-0000.png',root/'poster.png')
 run(['ffmpeg','-y','-framerate','1','-i',pattern,'-vf','scale=128:128:flags=lanczos,tile=4x1:nb_frames=4:padding=0:margin=0:color=black','-frames:v','1',str(root/'contact-sheet.png')])
 (root/'contract.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 entries=[{'path':f'frames/frame-{i:04d}.png','sha256':sha(frames/f'frame-{i:04d}.png')} for i in range(4)]
 frame_set=hashlib.sha256(''.join(f"{e['path']}:{e['sha256']}\n" for e in entries).encode()).hexdigest()
 evidence=sha(root/'master.webm')
 metrics=package['acceptanceCriteria'] if 'acceptanceCriteria' in package else package['qaMetrics']
 qa={'sourceFrameSetSha256':frame_set,'passed':True,'contactSheetCoverage':list(range(4)),'contactSheetSha256':sha(root/'contact-sheet.png'),'metricResults':[{'metricId':x['id'],'actual':x['value'],'evidenceSha256':evidence} for x in metrics]}
 (root/'qa-report.json').write_text(json.dumps(qa,indent=2)+'\n')
 gates={n:{'status':'pass','reviewerId':'reviewer-001','reviewedAt':'2026-08-13T00:00:00Z','evidenceSha256':evidence} for n in schema['gateNames']}
 (root/'manual-review.json').write_text(json.dumps(gates,indent=2)+'\n')
 artifacts={n:{'sha256':sha(root/n),'sourceFrameSetSha256':frame_set} for n in schema['artifactNames']}
 manifest={'schemaVersion':1,'exerciseId':package['exerciseId'],'contractSha256':sha(root/'contract.json'),'sourceFrameSetSha256':frame_set,'framePattern':technical['framePattern'],'frameCount':4,'frames':entries,'artifacts':artifacts,'mediaProbe':schema['mediaProbeContracts'],'contactSheetCoverage':list(range(4)),'gates':gates}
 (root/'production-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 return root
results={}
with tempfile.TemporaryDirectory() as td:
 base=pathlib.Path(td); m.ROOT=base; root=build(base,['red','green','blue','yellow'])
 m.verify_production_package(spec,package); results['valid']='pass'
 (root/'frames'/'EXTRA-DIR').mkdir()
 try: m.verify_production_package(spec,package); results['extraDir']='accepted'
 except Exception: results['extraDir']='rejected'
 shutil.rmtree(root/'frames'/'EXTRA-DIR')
 original=(root/'frames'/'frame-0003.png').read_bytes(); (root/'frames'/'frame-0003.png').write_bytes((root/'frames'/'frame-0000.png').read_bytes())
 manifest=json.loads((root/'production-manifest.json').read_text()); manifest['frames'][3]['sha256']=sha(root/'frames'/'frame-0003.png'); (root/'production-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 try: m.verify_production_package(spec,package); results['duplicateTerminal']='accepted'
 except Exception: results['duplicateTerminal']='rejected'
 (root/'frames'/'frame-0003.png').write_bytes(original)
 manifest=json.loads((root/'production-manifest.json').read_text());
 blue=base/'blue'; blue.mkdir(); run(['ffmpeg','-y','-f','lavfi','-i','color=c=black:s=512x512:r=24:d=0.1667','-frames:v','4','-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv444p',str(blue/'wrong.webm')]); shutil.copy2(blue/'wrong.webm',root/'master.webm'); manifest['artifacts']['master.webm']['sha256']=sha(root/'master.webm'); (root/'production-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 try: m.verify_production_package(spec,package); results['foreignVideo']='accepted'
 except Exception: results['foreignVideo']='rejected'
 root=pathlib.Path(td)/technical['outputRoot']/package['exerciseId']; shutil.rmtree(root); root=build(base,['red','green','blue','yellow'])
 run(['ffmpeg','-y','-f','lavfi','-i','color=c=black:s=512x128','-frames:v','1',str(root/'contact-sheet.png')]); manifest=json.loads((root/'production-manifest.json').read_text()); manifest['artifacts']['contact-sheet.png']['sha256']=sha(root/'contact-sheet.png'); qa=json.loads((root/'qa-report.json').read_text()); qa['contactSheetSha256']=sha(root/'contact-sheet.png'); (root/'qa-report.json').write_text(json.dumps(qa,indent=2)+'\n'); manifest['artifacts']['qa-report.json']['sha256']=sha(root/'qa-report.json'); (root/'production-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 try: m.verify_production_package(spec,package); results['fakeSheet']='accepted'
 except Exception: results['fakeSheet']='rejected'
 root=pathlib.Path(td)/technical['outputRoot']/package['exerciseId']; shutil.rmtree(root); root=build(base,['red','green','blue','yellow'])
 qa=json.loads((root/'qa-report.json').read_text()); qa['metricResults'][0]['actual']=False; (root/'qa-report.json').write_text(json.dumps(qa,indent=2)+'\n'); manifest=json.loads((root/'production-manifest.json').read_text()); manifest['artifacts']['qa-report.json']['sha256']=sha(root/'qa-report.json'); (root/'production-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 try: m.verify_production_package(spec,package); results['failedMetric']='accepted'
 except Exception: results['failedMetric']='rejected'
print(json.dumps(results))
`;
  const result = runPython(['-c', probe, script, specPath], { cwd: projectRoot, encoding: 'utf8', timeout: 300000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    valid: 'pass', extraDir: 'rejected', duplicateTerminal: 'rejected', foreignVideo: 'rejected', fakeSheet: 'rejected', failedMetric: 'rejected',
  });
});

test('逐帧感知指纹拒绝WebM、MP4和GIF中的单个异源帧', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const probe = String.raw`
import importlib.util, json, pathlib, subprocess, sys, tempfile
p=pathlib.Path(sys.argv[1]); s=importlib.util.spec_from_file_location('review',p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
def run(cmd): subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
with tempfile.TemporaryDirectory() as td:
 root=pathlib.Path(td); frames=root/'frames'; frames.mkdir()
 run(['ffmpeg','-y','-f','lavfi','-i','color=c=red:s=32x32:r=24:d=4.1667','-frames:v','100','-start_number','0',str(frames/'frame-%04d.png')])
 run(['ffmpeg','-y','-f','lavfi','-i','color=c=black:s=32x32','-frames:v','1',str(frames/'frame-0050.png')])
 pattern=str(frames/'frame-%04d.png')
 outputs={'webm':['-c:v','libvpx-vp9','-lossless','1','-pix_fmt','yuv444p'],'mp4':['-c:v','libx264','-crf','0','-pix_fmt','yuv444p'],'gif':[]}
 for ext,codec in outputs.items(): run(['ffmpeg','-y','-framerate','24','-i',pattern,*codec,str(root/f'wrong.{ext}')])
 run(['ffmpeg','-y','-f','lavfi','-i','color=c=red:s=32x32','-frames:v','1',str(frames/'frame-0050.png')])
 sources=[frames/f'frame-{i:04d}.png' for i in range(100)]
 result={ext:[i for i,v in enumerate(m.visual_sequence_frame_maes(root/f'wrong.{ext}',sources,32,32)) if v>12] for ext in outputs}
 print(json.dumps(result))
`;
  const result = runPython(['-c', probe, script], { cwd: projectRoot, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { webm: [50], mp4: [50], gif: [50] });
});

test('QA数值运算拒绝NaN和正负Infinity', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const probe = `import importlib.util,json,pathlib,sys\np=pathlib.Path(sys.argv[1]);s=importlib.util.spec_from_file_location('review',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);values=[float('nan'),float('inf'),float('-inf')];ops=[{'operator':'eq','value':0},{'operator':'gte','value':0},{'operator':'lte','value':0},{'operator':'between','value':[-1,1]}];print(json.dumps({'nonfinite':[m.metric_passes(op,v) for op in ops for v in values],'largeInt':m.metric_passes({'operator':'gte','value':0},10**10000)}))`;
  const result = runPython(['-c', probe, script], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { nonfinite: Array(12).fill(false), largeInt: true });
});

test('没有真实生产包时生产验证模式失败关闭', () => {
  const script = path.join(projectRoot, 'media-src', 'scripts', 'build_media_production_review.py');
  const repositoryOutput = path.join(projectRoot, 'media-build', 'source-research', 'move28-media-production-review.html');
  const before = snapshotFile(repositoryOutput);
  const matrixPath = path.join(projectRoot, 'docs', 'research', 'data', 'move28-3d-candidate-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const { result, outputExists } = runWithInputs(script, loadSpec(), matrix, ['--verify-production']);
  assert.notEqual(result.status, 0);
  assert.equal(outputExists, false);
  assert.equal(snapshotFile(repositoryOutput), before);
});
