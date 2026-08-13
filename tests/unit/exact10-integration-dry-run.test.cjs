'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const script=path.join(root,'media-src/scripts/build_exact10_integration_dry_run.py');
const contract=path.join(root,'docs/research/data/move28-exact10-integration-dry-run.json');
const candidateRoot=path.join(root,'media-build/internal-candidates/local-exercisedb-exact10');
const candidateManifest=path.join(candidateRoot,'candidate-manifest.json');
const defaultOutput=path.join(root,'media-build/integration-dry-run/exact10');
const outputRoot=path.join(root,'media-build/integration-dry-run');
const hasLocalCandidates=fs.existsSync(candidateManifest);
const localTest=(name,fn)=>test(name,{skip:!hasLocalCandidates},fn);
const python=process.env.PYTHON||'python';
const run=args=>spawnSync(python,['-B',script,...args],{cwd:root,encoding:'utf8'});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const temporary=()=>{fs.mkdirSync(outputRoot,{recursive:true});return fs.mkdtempSync(path.join(outputRoot,'.test-'))};
const protectedFiles=[path.join(root,'src/data/exercise-media-policy.js'),path.join(root,'assets/exercises/manifest.json'),path.join(root,'release/runtime-manifest.json')];

function loadPolicy(file){const context={globalThis:null};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'src/namespace.js'),'utf8'),context);vm.runInContext(fs.readFileSync(file,'utf8'),context);return context.Move28.data.exerciseMediaPolicy}

function fixtureProbe(body){return String.raw`
import hashlib,importlib.util,json,pathlib,sys
p=pathlib.Path(sys.argv[1]);base=pathlib.Path(sys.argv[2]);spec=importlib.util.spec_from_file_location('dry',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
runtime=base/'runtime';runtime.mkdir();candidates=runtime/'candidates';output_root=runtime/'outputs';output_root.mkdir()
(runtime/'src/data').mkdir(parents=True);(runtime/'index.html').write_bytes(b'<html></html>');(runtime/'src/data/exercise-media-policy.js').write_bytes(b'old')
manifest={'schemaVersion':1,'purpose':m.RUNTIME_PURPOSE,'files':['index.html','src/data/exercise-media-policy.js'],'forbiddenPrefixes':[]};(runtime/'runtime.json').write_text(json.dumps(manifest),encoding='utf-8')
(candidates/'gifs').mkdir(parents=True);ids=list(m.EXPECTED_IDS);assets=[]
for i,exercise_id in enumerate(ids):
 payload=('GIF89a'+exercise_id).encode();filename=exercise_id+'.gif';(candidates/'gifs'/filename).write_bytes(payload);assets.append({'exerciseId':exercise_id,'nameZh':'测试','exerciseDbId':f'TEST{i:03d}','filename':filename,'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload),'width':180,'height':180,'frameCount':12,'durationMs':3000,'motionReview':'approved-for-internal-candidate','visualReview':'approved-for-internal-preview','safetyReview':'approved-for-internal-candidate','releaseEligible':False})
candidate={'schemaVersion':1,'kind':'internal-integration-candidate-package','sourceMappingSha256':'1'*64,'candidateCount':10,'releaseEligible':False,'formalManifestModified':False,'assets':assets};raw=(json.dumps(candidate,separators=(',',':'))+'\n').encode();(candidates/'candidate-manifest.json').write_bytes(raw)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
contract_data={'schemaVersion':1,'kind':'internal-media-integration-dry-run','candidateManifestSha256':hashlib.sha256(raw).hexdigest(),'productionPolicySha256':digest(runtime/'src/data/exercise-media-policy.js'),'formalManifestSha256':digest(runtime/'index.html'),'runtimeManifestSha256':digest(runtime/'runtime.json'),'runtimeFileSha256':{name:digest(runtime/pathlib.Path(*name.split('/'))) for name in manifest['files']},'approvedExerciseIds':ids,'expectedDryRun':{'released':10,'blocked':15,'formalReleaseEligible':0},'gates':{'motion':'approved-for-internal-candidate','visual':'approved-for-internal-preview','safety':'approved-for-internal-candidate','rights':'deferred-by-user-for-internal-stage','participantRelease':'blocked'},'forbiddenChanges':['src/data/exercise-media-policy.js','assets/exercises/manifest.json','release/runtime-manifest.json']};contract_path=runtime/'contract.json';contract_path.write_text(json.dumps(contract_data),encoding='utf-8')
m.ROOT=runtime;m.CONTRACT=contract_path;m.CANDIDATES=candidates;m.OUTPUT_ROOT=output_root;m.DEFAULT_OUTPUT=output_root/'exact10';m.RUNTIME_MANIFEST=runtime/'runtime.json';m.PROTECTED={'productionPolicySha256':runtime/'src/data/exercise-media-policy.js','formalManifestSha256':runtime/'index.html','runtimeManifestSha256':runtime/'runtime.json'}
${body}
`}

localTest('真实隔离预演精确开放10项，生产仍0项正式发布',()=>{const result=run(['--verify']);assert.equal(result.status,0,result.stderr||result.stdout);const parsed=JSON.parse(result.stdout);assert.equal(parsed.released,10);assert.equal(parsed.blocked,15);assert.equal(parsed.participantRelease,'blocked');const report=JSON.parse(fs.readFileSync(path.join(defaultOutput,'dry-run-report.json'),'utf8'));assert.equal(report.formalReleaseEligible,0);const policy=loadPolicy(path.join(defaultOutput,'app/src/data/exercise-media-policy.js'));assert.equal(policy.releaseEligibleIds.length,10);assert.equal(policy.presentationFor('dead-bug').status,'blocked')});

localTest('真实Dashboard与跟练消费者行为显示媒体且生产policy继续纯文字',()=>{
  const production=loadPolicy(path.join(root,'src/data/exercise-media-policy.js'));assert.equal(production.mode,'text_only');assert.equal(production.releaseEligibleIds.length,0);
  const probe=String.raw`
const path=require('node:path'),root=process.argv[1],app=process.argv[2];
const prod=path.join(root,'src/data/exercise-media-policy.js'),dry=path.join(app,'src/data/exercise-media-policy.js');
require.cache[require.resolve(prod)]={id:prod,filename:prod,loaded:true,exports:require(dry)};
for(const file of ['src/ui/dashboard.js','src/ui/workout-guide.js'])delete require.cache[require.resolve(path.join(root,file))];
const dashboard=require(path.join(root,'src/ui/dashboard.js')),guide=require(path.join(root,'src/ui/workout-guide.js')),exercise={id:'seated-leg-press',name:'坐姿腿举'};
process.stdout.write(JSON.stringify({dashboard:dashboard.exerciseMediaHtml(exercise),guide:guide.guideMediaHtml(exercise)}));`;
  const result=spawnSync(process.execPath,['-e',probe,root,path.join(defaultOutput,'app')],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const html=JSON.parse(result.stdout);assert.match(html.dashboard,/<img src="assets\/exercises\/seated-leg-press\.gif"/);assert.match(html.guide,/<img src="assets\/exercises\/seated-leg-press\.gif"/)
});

test('最小fixture构建与验证确定性且逐文件runtime篡改失败关闭',()=>{const temp=temporary(),probe=fixtureProbe(String.raw`
out=m.DEFAULT_OUTPUT;m.install(out);first=(out/'dry-run-report.json').read_bytes();m.verify_output(out);target=out/'app/index.html';target.write_bytes(b'tampered')
try:m.verify_output(out);ok=True
except Exception:ok=False
print(json.dumps({'ok':ok,'first':len(first),'exists':out.exists()}))`);const result=spawnSync(python,['-B','-c',probe,script,temp],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);assert.equal(parsed.ok,false);assert.equal(parsed.exists,true);assert.ok(parsed.first>0);fs.rmSync(temp,{recursive:true,force:true})});

test('严格拒绝runtime路径攻击、重复碰撞和非有限JSON',()=>{const temp=temporary(),probe=fixtureProbe(String.raw`
cases=['../escape','/absolute','C:/drive','a\\b','CON','index.html'];results=[]
for value in cases:
 data=json.loads(m.RUNTIME_MANIFEST.read_text());data['files']=[data['files'][0],value];m.RUNTIME_MANIFEST.write_text(json.dumps(data))
 try:m.validate_runtime_manifest();results.append(True)
 except Exception:results.append(False)
m.RUNTIME_MANIFEST.write_text('{"schemaVersion":NaN}')
try:m.load_json(m.RUNTIME_MANIFEST);finite=True
except Exception:finite=False
data=manifest.copy();data['purpose']='other';m.RUNTIME_MANIFEST.write_text(json.dumps(data))
try:m.validate_runtime_manifest();purpose=True
except Exception:purpose=False
print(json.dumps({'results':results,'finite':finite,'purpose':purpose}))`);const result=spawnSync(python,['-B','-c',probe,script,temp],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{results:[false,false,false,false,false,false],finite:false,purpose:false});fs.rmSync(temp,{recursive:true,force:true})});

test('严格候选schema、身份、文件名、技术字段与审核门任一漂移失败关闭',()=>{const temp=temporary(),probe=fixtureProbe(String.raw`
base=json.loads((m.CANDIDATES/'candidate-manifest.json').read_text());mutations=[lambda d:d.update(extra=1),lambda d:d['assets'][0].update(filename='../x.gif'),lambda d:d['assets'][0].update(width=181),lambda d:d['assets'][0].update(releaseEligible=True),lambda d:d['assets'][0].update(sha256='0'*64),lambda d:d['assets'][1].update(exerciseId=d['assets'][0]['exerciseId'])];results=[]
for mutate in mutations:
 data=json.loads(json.dumps(base));mutate(data);raw=json.dumps(data,separators=(',',':')).encode();(m.CANDIDATES/'candidate-manifest.json').write_bytes(raw);c=json.loads(m.CONTRACT.read_text());c['candidateManifestSha256']=hashlib.sha256(raw).hexdigest();m.CONTRACT.write_text(json.dumps(c))
 try:m.load_candidates(m.load_contract());results.append(True)
 except Exception:results.append(False)
print(json.dumps(results))`);const result=spawnSync(python,['-B','-c',probe,script,temp],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[false,false,false,false,false,false]);fs.rmSync(temp,{recursive:true,force:true})});

test('候选根上游junction或symlink在读取前失败关闭',t=>{const temp=temporary(),probe=fixtureProbe(String.raw`
real=runtime/'real-candidates';m.CANDIDATES.replace(real)
try:m.CANDIDATES.symlink_to(real,target_is_directory=True)
except Exception as error:print(json.dumps({'skip':str(error)}));raise SystemExit(0)
try:m.load_candidates(m.load_contract());ok=True
except Exception:ok=False
print(json.dumps({'ok':ok}))`);const result=spawnSync(python,['-B','-c',probe,script,temp],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);if(parsed.skip){fs.rmSync(temp,{recursive:true,force:true});t.skip('link unavailable');return}assert.deepEqual(parsed,{ok:false});fs.rmSync(temp,{recursive:true,force:true})});

test('verify拒绝隔离输出根上游junction或symlink',t=>{const temp=temporary(),probe=fixtureProbe(String.raw`
out=m.DEFAULT_OUTPUT;m.install(out);real=runtime/'real-outputs';m.OUTPUT_ROOT.replace(real)
try:m.OUTPUT_ROOT.symlink_to(real,target_is_directory=True)
except Exception as error:print(json.dumps({'skip':str(error)}));raise SystemExit(0)
try:m.verify_output(m.DEFAULT_OUTPUT);ok=True
except Exception:ok=False
print(json.dumps({'ok':ok}))`);const result=spawnSync(python,['-B','-c',probe,script,temp],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const parsed=JSON.parse(result.stdout);if(parsed.skip){fs.rmSync(temp,{recursive:true,force:true});t.skip('link unavailable');return}assert.deepEqual(parsed,{ok:false});fs.rmSync(temp,{recursive:true,force:true})});

test('输出只允许隔离根真子目录并拒绝祖先链接与仓库外目录',t=>{const before=protectedFiles.map(hash);for(const output of [root,path.join(root,'src'),path.join(root,'dist'),outputRoot,path.join(os.tmpdir(),'move28-external-output')]){const result=run(['--output',output]);assert.notEqual(result.status,0);assert.match(result.stdout,/integration_dry_run_failed/)}assert.deepEqual(protectedFiles.map(hash),before);const temp=temporary(),linked=path.join(outputRoot,'.linked-test');try{fs.symlinkSync(defaultOutput,linked,process.platform==='win32'?'junction':'dir')}catch(error){fs.rmSync(temp,{recursive:true,force:true});t.skip(error.code||'link unavailable');return}const result=run(['--output',path.join(linked,'child')]);assert.notEqual(result.status,0);fs.rmSync(linked,{recursive:true,force:true});fs.rmSync(temp,{recursive:true,force:true})});

test('安装失败事务回滚旧输出且CLI错误脱敏',()=>{const temp=temporary(),probe=fixtureProbe(String.raw`
out=m.DEFAULT_OUTPUT;out.mkdir();(out/'sentinel').write_text('old');original=pathlib.Path.replace
def fail(self,target):
 if self.name.startswith('.exact10.') and self.name.endswith('.tmp'):raise OSError('secret-injected')
 return original(self,target)
pathlib.Path.replace=fail
try:m.install(out);ok=True
except Exception:ok=False
print(json.dumps({'ok':ok,'entries':sorted(x.name for x in out.iterdir()),'siblings':sorted(x.name for x in out.parent.iterdir())}))`);const result=spawnSync(python,['-B','-c',probe,script,temp],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{ok:false,entries:['sentinel'],siblings:['exact10']});const cli=run(['--output',path.join(os.tmpdir(),'forbidden')]);assert.notEqual(cli.status,0);assert.match(cli.stdout,/integration_dry_run_failed/);assert.doesNotMatch(cli.stdout+cli.stderr,/Traceback|secret-injected/);fs.rmSync(temp,{recursive:true,force:true})});
