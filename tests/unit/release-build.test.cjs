const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const projectRoot=path.resolve(__dirname,'../..');
const {BUILD_EPOCH_MS,buildRelease}=require('../../scripts/build-release.cjs');
const temporaryRoots=new Set();

test.afterEach(()=>{
  for(const root of temporaryRoots)fs.rmSync(root,{recursive:true,force:true});
  temporaryRoots.clear();
});

function fixture(){
  const root=fs.mkdtempSync(path.join(projectRoot,'.task-f-test-'));
  temporaryRoots.add(root);
  fs.mkdirSync(path.join(root,'release'),{recursive:true});
  return root;
}

function write(root,relative,contents='fixture'){
  const target=path.join(root,...relative.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,contents);
}

function writeManifest(root,files,forbiddenPrefixes=[]){
  fs.writeFileSync(path.join(root,'release','runtime-manifest.json'),JSON.stringify({
    schemaVersion:1,
    purpose:'test participant runtime allowlist',
    files,
    forbiddenPrefixes
  },null,2));
}

function build(root){
  return buildRelease({rootDir:root});
}

test('build copies only the sorted allowlist with deterministic bytes and timestamps',()=>{
  const root=fixture();
  write(root,'assets/app.bin',Buffer.from([0,1,2,255]));
  write(root,'index.html','<!doctype html>');
  writeManifest(root,['index.html','assets/app.bin']);

  const first=build(root);
  assert.deepEqual(first.files,['assets/app.bin','index.html']);
  assert.equal(fs.readFileSync(path.join(root,'dist','index.html'),'utf8'),'<!doctype html>');
  assert.deepEqual(fs.readFileSync(path.join(root,'dist','assets','app.bin')),Buffer.from([0,1,2,255]));
  assert.equal(fs.statSync(path.join(root,'dist','index.html')).mtimeMs,BUILD_EPOCH_MS);

  fs.writeFileSync(path.join(root,'index.html'),'updated');
  const second=build(root);
  assert.deepEqual(second,first);
  assert.equal(fs.readFileSync(path.join(root,'dist','index.html'),'utf8'),'updated');
  assert.equal(fs.statSync(path.join(root,'dist','index.html')).mtimeMs,BUILD_EPOCH_MS);
});

test('build rejects non-normalized, absolute, escaping and non-portable paths',()=>{
  const invalid=[
    '', '.', './index.html', 'a//b', 'a/./b', 'a/../b', '../escape.txt',
    '/absolute.txt', 'C:/absolute.txt', '\\\\server\\share.txt', 'a\\b',
    'trailing.', 'trailing ', 'a:b', 'aux.txt', 'nested/COM1.js', 'nul\0byte'
  ];
  for(const candidate of invalid){
    const root=fixture();
    writeManifest(root,[candidate]);
    assert.throws(()=>build(root),/manifest path/i,candidate);
  }
});

test('build rejects portable duplicate paths after case and Unicode normalization',()=>{
  for(const files of [['A.txt','a.txt'],['e\u0301.txt','é.txt']]){
    const root=fixture();
    writeManifest(root,files);
    assert.throws(()=>build(root),/duplicate manifest path/i,files.join(','));
  }
});

test('build rejects missing files and directory entries',()=>{
  const missingRoot=fixture();
  writeManifest(missingRoot,['missing.txt']);
  assert.throws(()=>build(missingRoot),/missing allowlisted file/i);

  const directoryRoot=fixture();
  fs.mkdirSync(path.join(directoryRoot,'directory'));
  writeManifest(directoryRoot,['directory']);
  assert.throws(()=>build(directoryRoot),/not a regular file/i);
});

test('build rejects symlinked files and symlinked path components',()=>{
  const fileRoot=fixture();
  write(fileRoot,'real.txt');
  fs.symlinkSync(path.join(fileRoot,'real.txt'),path.join(fileRoot,'link.txt'),'file');
  writeManifest(fileRoot,['link.txt']);
  assert.throws(()=>build(fileRoot),/symbolic link/i);

  const directoryRoot=fixture();
  write(directoryRoot,'real/secret.txt');
  fs.symlinkSync(
    path.join(directoryRoot,'real'),
    path.join(directoryRoot,'linked'),
    process.platform==='win32'?'junction':'dir'
  );
  writeManifest(directoryRoot,['linked/secret.txt']);
  assert.throws(()=>build(directoryRoot),/symbolic link/i);
});

test('build enforces forbidden prefixes from the manifest',()=>{
  const root=fixture();
  write(root,'tests/private.txt');
  writeManifest(root,['tests/private.txt'],['tests/']);
  assert.throws(()=>build(root),/forbidden prefix/i);
});

test('build refuses an existing artifact with extra files and preserves it',()=>{
  const root=fixture();
  write(root,'index.html');
  writeManifest(root,['index.html']);
  write(root,'dist/unexpected.txt','preserve');

  assert.throws(()=>build(root),/existing dist is not the exact allowlist/i);
  assert.equal(fs.readFileSync(path.join(root,'dist','unexpected.txt'),'utf8'),'preserve');
});

test('build cannot target repository root or escape its fixed dist directory',()=>{
  const root=fixture();
  write(root,'index.html');
  writeManifest(root,['index.html']);

  assert.throws(()=>buildRelease({rootDir:root,outputDir:root}),/output directory must be/i);
  assert.throws(()=>buildRelease({rootDir:root,outputDir:path.dirname(root)}),/output directory must be/i);
});
