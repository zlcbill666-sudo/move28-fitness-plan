const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release/runtime-manifest.json'),'utf8'));
const files=manifest.files;
const allowed=new Set(files);

const toPosix=value=>value.replaceAll('\\','/');
const localRef=value=>{
  if(!value||value.startsWith('#')||value.startsWith('data:')||/^[a-z]+:/i.test(value))return null;
  return toPosix(value.split(/[?#]/,1)[0]).replace(/^\.\//,'');
};

function htmlRuntimeRefs(){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  return [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/gi)]
    .map(match=>localRef(match[1]))
    .filter(Boolean);
}

function cssRuntimeRefs(){
  return files.filter(file=>file.endsWith('.css')).flatMap(file=>{
    const css=fs.readFileSync(path.join(root,file),'utf8');
    return [...css.matchAll(/url\((['"]?)(.*?)\1\)/gi)]
      .map(match=>localRef(match[2].trim()))
      .filter(Boolean);
  });
}

function audioRuntimeRefs(){
  const source=fs.readFileSync(path.join(root,'src/ui/workout-guide.js'),'utf8');
  return [...source.matchAll(/src:'(assets\/audio\/[^']+\.mp3)'/g)].map(match=>match[1]);
}

test('release runtime manifest is a finite, existing, duplicate-free allowlist',()=>{
  assert.equal(manifest.schemaVersion,1);
  assert.ok(Array.isArray(files));
  assert.ok(Array.isArray(manifest.forbiddenPrefixes));
  const normalized=files.map(file=>path.posix.normalize(file));
  assert.equal(new Set(normalized).size,files.length);
  assert.deepEqual(files,[...files].sort((a,b)=>a.localeCompare(b,'en')));
  for(const [index,file] of files.entries()){
    assert.equal(file,toPosix(file));
    assert.equal(path.isAbsolute(file),false);
    assert.equal(file,normalized[index]);
    assert.equal(file.split('/').includes('..'),false);
    const resolved=path.resolve(root,...file.split('/'));
    assert.equal(resolved.startsWith(`${root}${path.sep}`),true,file);
    assert.equal(fs.statSync(resolved).isFile(),true,file);
    assert.equal(manifest.forbiddenPrefixes.some(prefix=>file.startsWith(prefix)),false,file);
  }
});

test('entry document, styles and dynamic audio close over the release allowlist',()=>{
  const refs=[...htmlRuntimeRefs(),...cssRuntimeRefs(),...audioRuntimeRefs()];
  assert.ok(refs.length>0);
  for(const ref of refs)assert.equal(allowed.has(ref),true,ref);
  const scripts=htmlRuntimeRefs().filter(ref=>ref.startsWith('src/')).sort((a,b)=>a.localeCompare(b,'en'));
  const allowedScripts=files.filter(ref=>ref.startsWith('src/'));
  assert.deepEqual(scripts,allowedScripts);
});

test('participant artifact physically excludes blocked and research media',()=>{
  assert.equal(files.some(file=>/\.(?:gif|jpe?g|png|webp|mp4)$/i.test(file)),false);
  for(const prefix of ['assets/exercises/','assets/gifs/','media-build/','media-src/','docs/research/']){
    assert.equal(manifest.forbiddenPrefixes.includes(prefix),true,prefix);
    assert.equal(files.some(file=>file.startsWith(prefix)),false,prefix);
  }
  for(const required of ['README.md','使用说明.txt','docs/pilot/participant-guide.md','docs/pilot/reviewer-checklist.md','docs/pilot/issue-log-template.md']){
    assert.equal(allowed.has(required),true,required);
  }
});
