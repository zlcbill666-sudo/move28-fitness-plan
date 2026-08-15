const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release/runtime-manifest.json'),'utf8'));
const files=manifest.files;
const allowed=new Set(files);
const mediaPolicy=require('../../src/data/exercise-media-policy.js');

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

test('participant artifact only includes allowlisted local-library media and excludes research media',()=>{
  const mediaFiles=files.filter(file=>/\.(?:gif|jpe?g|png|webp|mp4)$/i.test(file));
  assert.deepEqual(mediaPolicy.releaseEligibleIds, []);
  assert.equal(mediaPolicy.mode, 'text_only_quality_review');
  assert.equal(mediaFiles.every(file=>file.startsWith('assets/exercises/')&&file.endsWith('.gif')), true);
  assert.equal(manifest.forbiddenPrefixes.includes('assets/exercises/'), false);
  for(const prefix of ['assets/gifs/','media-build/','media-src/','docs/research/']){
    assert.equal(manifest.forbiddenPrefixes.includes(prefix),true,prefix);
    assert.equal(files.some(file=>file.startsWith(prefix)),false,prefix);
  }
  for(const required of ['README.md','使用说明.txt','docs/pilot/participant-guide.md','docs/pilot/reviewer-checklist.md','docs/pilot/issue-log-template.md']){
    assert.equal(allowed.has(required),true,required);
  }
});

test('ordinary pilot review instructions require visible local handoff and text-only media quality gate',()=>{
  const reviewer=fs.readFileSync(path.join(root,'docs/pilot/reviewer-checklist.md'),'utf8');
  const participant=fs.readFileSync(path.join(root,'docs/pilot/participant-guide.md'),'utf8');
  for(const document of [reviewer,participant]){
    assert.equal(/(?:开发者\s*)?Console|控制台命令/i.test(document),false);
    assert.match(document,/文字(?:步骤|说明|指导)/);
    assert.match(document,/文字(?:步骤|说明|指导)/);
    assert.match(document,/动图/);
    assert.match(document,/暂停展示|不依赖动图示范/);
    assert.doesNotMatch(document,/25项本地动图库GIF(?:会|均)|首批10项Exact|仍blocked|文字替代/);
  }
  assert.match(reviewer,/下载复核 dossier/);
  assert.match(reviewer,/导入/);
  assert.match(reviewer,/拒绝并要求返工/);
  assert.match(reviewer,/不显示低质本地GIF/);
});
