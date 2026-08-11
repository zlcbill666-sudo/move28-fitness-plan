#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const BUILD_EPOCH_MS=Date.UTC(2000,0,1,0,0,0);
const WINDOWS_RESERVED=/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const WINDOWS_INVALID=/[<>:"\\|?*\u0000-\u001f]/;

function fail(message){
  throw new Error(`Release build failed: ${message}`);
}

function comparePortable(left,right){
  return left<right?-1:left>right?1:0;
}

function canonicalPath(value){
  return value.normalize('NFC').toLowerCase();
}

function validateRelativePath(value,label='manifest path'){
  if(typeof value!=='string'||value.length===0)fail(`${label} must be a non-empty string`);
  if(value.includes('\\'))fail(`${label} must use forward slashes: ${JSON.stringify(value)}`);
  if(path.posix.isAbsolute(value)||path.win32.isAbsolute(value)){
    fail(`${label} must be relative: ${JSON.stringify(value)}`);
  }
  if(path.posix.normalize(value)!==value||value==='.'||value.endsWith('/')){
    fail(`${label} is not normalized: ${JSON.stringify(value)}`);
  }
  const segments=value.split('/');
  if(segments.some(segment=>segment===''||segment==='.'||segment==='..')){
    fail(`${label} is not normalized: ${JSON.stringify(value)}`);
  }
  for(const segment of segments){
    if(WINDOWS_INVALID.test(segment)||/[. ]$/.test(segment)||WINDOWS_RESERVED.test(segment)){
      fail(`${label} is not portable: ${JSON.stringify(value)}`);
    }
  }
  return {canonical:canonicalPath(value),segments,value};
}

function validateManifest(manifest){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))fail('manifest must be an object');
  if(manifest.schemaVersion!==1)fail('manifest schemaVersion must be 1');
  if(!Array.isArray(manifest.files)||manifest.files.length===0){
    fail('manifest files must be a non-empty array');
  }
  if(!Array.isArray(manifest.forbiddenPrefixes)){
    fail('manifest forbiddenPrefixes must be an array');
  }

  const filePaths=manifest.files.map(value=>validateRelativePath(value));
  const seen=new Map();
  for(const entry of filePaths){
    const prior=seen.get(entry.canonical);
    if(prior!==undefined){
      fail(`duplicate manifest path: ${JSON.stringify(prior)} and ${JSON.stringify(entry.value)}`);
    }
    seen.set(entry.canonical,entry.value);
  }
  for(const entry of filePaths){
    if(entry.value!==entry.value.normalize('NFC')){
      fail(`manifest path is not Unicode-normalized: ${JSON.stringify(entry.value)}`);
    }
  }
  const prefixPaths=manifest.forbiddenPrefixes.map(value=>{
    if(typeof value!=='string'||!value.endsWith('/')){
      fail(`forbidden prefix must end with "/": ${JSON.stringify(value)}`);
    }
    const core=value.slice(0,-1);
    const validated=validateRelativePath(core,'forbidden prefix');
    return {...validated,value,canonical:`${validated.canonical}/`};
  });
  const seenPrefixes=new Set();
  for(const prefix of prefixPaths){
    if(seenPrefixes.has(prefix.canonical))fail(`duplicate forbidden prefix: ${JSON.stringify(prefix.value)}`);
    seenPrefixes.add(prefix.canonical);
  }
  const sortedPrefixes=[...manifest.forbiddenPrefixes].sort(comparePortable);
  if(!manifest.forbiddenPrefixes.every((value,index)=>value===sortedPrefixes[index])){
    fail('manifest forbiddenPrefixes must be sorted by portable code-point order');
  }
  for(const entry of filePaths){
    if(prefixPaths.some(prefix=>`${entry.canonical}/`.startsWith(prefix.canonical))){
      fail(`manifest path uses a forbidden prefix: ${JSON.stringify(entry.value)}`);
    }
    if(entry.canonical==='dist'||entry.canonical.startsWith('dist/')){
      fail(`manifest path cannot include build output: ${JSON.stringify(entry.value)}`);
    }
  }

  return {
    files:filePaths.sort((left,right)=>comparePortable(left.value,right.value)),
    forbiddenPrefixes:prefixPaths
  };
}

function isMissing(error){
  return error&&error.code==='ENOENT';
}

function lstatRequired(target,missingMessage){
  try{
    return fs.lstatSync(target);
  }catch(error){
    if(isMissing(error))fail(missingMessage);
    throw error;
  }
}

function assertPlainPath(rootDir,relative,{leafType='file',description='allowlisted file'}={}){
  const parts=relative.split('/');
  let current=rootDir;
  for(const [index,part] of parts.entries()){
    current=path.join(current,part);
    const stats=lstatRequired(current,`missing ${description}: ${relative}`);
    if(stats.isSymbolicLink())fail(`${description} uses a symbolic link: ${relative}`);
    const isLeaf=index===parts.length-1;
    if(!isLeaf&&!stats.isDirectory())fail(`${description} has a non-directory path component: ${relative}`);
    if(isLeaf&&leafType==='file'&&!stats.isFile())fail(`${description} is not a regular file: ${relative}`);
    if(isLeaf&&leafType==='directory'&&!stats.isDirectory())fail(`${description} is not a directory: ${relative}`);
  }
  return current;
}

function sameRealPath(left,right){
  const normalize=value=>process.platform==='win32'?path.normalize(value).toLowerCase():path.normalize(value);
  return normalize(left)===normalize(right);
}

function readPlainFile(rootDir,rootRealPath,entry){
  const source=assertPlainPath(rootDir,entry.value);
  const expectedReal=path.join(rootRealPath,...entry.segments);
  const actualReal=fs.realpathSync.native(source);
  if(!sameRealPath(actualReal,expectedReal))fail(`allowlisted file escapes source root: ${entry.value}`);

  const noFollow=fs.constants.O_NOFOLLOW||0;
  let descriptor;
  try{
    descriptor=fs.openSync(source,fs.constants.O_RDONLY|noFollow);
    const before=fs.fstatSync(descriptor);
    if(!before.isFile())fail(`allowlisted path is not a regular file: ${entry.value}`);
    const contents=fs.readFileSync(descriptor);
    const after=fs.fstatSync(descriptor);
    if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size){
      fail(`allowlisted file changed while reading: ${entry.value}`);
    }
    return contents;
  }finally{
    if(descriptor!==undefined)fs.closeSync(descriptor);
  }
}

function expectedDirectories(files){
  const result=new Set();
  for(const file of files){
    const parts=file.split('/');
    for(let index=1;index<parts.length;index+=1)result.add(parts.slice(0,index).join('/'));
  }
  return [...result].sort(comparePortable);
}

function inspectArtifact(outputDir){
  const files=[];
  const directories=[];
  function visit(directory,relative=''){
    const entries=fs.readdirSync(directory,{withFileTypes:true})
      .sort((left,right)=>comparePortable(left.name,right.name));
    for(const entry of entries){
      const childRelative=relative?`${relative}/${entry.name}`:entry.name;
      const child=path.join(directory,entry.name);
      const stats=fs.lstatSync(child);
      if(stats.isSymbolicLink())fail(`artifact contains a symbolic link: ${childRelative}`);
      if(stats.isDirectory()){
        directories.push(childRelative);
        visit(child,childRelative);
      }else if(stats.isFile()){
        files.push(childRelative);
      }else{
        fail(`artifact contains a non-file entry: ${childRelative}`);
      }
    }
  }
  visit(outputDir);
  return {directories:directories.sort(comparePortable),files:files.sort(comparePortable)};
}

function assertExactArtifact(outputDir,files){
  const actual=inspectArtifact(outputDir);
  const expectedDirs=expectedDirectories(files);
  if(JSON.stringify(actual.files)!==JSON.stringify(files)||
    JSON.stringify(actual.directories)!==JSON.stringify(expectedDirs)){
    fail('existing dist is not the exact allowlist');
  }
}

function setDeterministicMetadata(target,mode){
  fs.chmodSync(target,mode);
  fs.utimesSync(target,BUILD_EPOCH_MS/1000,BUILD_EPOCH_MS/1000);
}

function buildRelease({rootDir=path.resolve(__dirname,'..'),outputDir}={}){
  const root=path.resolve(rootDir);
  const rootStats=lstatRequired(root,`source root does not exist: ${root}`);
  if(rootStats.isSymbolicLink()||!rootStats.isDirectory())fail(`source root must be a real directory: ${root}`);
  const rootRealPath=fs.realpathSync.native(root);
  const expectedOutput=path.join(root,'dist');
  const output=path.resolve(outputDir||expectedOutput);
  if(output!==expectedOutput)fail(`output directory must be ${expectedOutput}`);

  const manifestRelative='release/runtime-manifest.json';
  const manifestPath=assertPlainPath(root,manifestRelative,{description:'runtime manifest'});
  let manifest;
  try{
    manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  }catch(error){
    fail(`cannot parse runtime manifest: ${error.message}`);
  }
  const validated=validateManifest(manifest);
  const files=validated.files.map(entry=>entry.value);

  // Read and validate the complete source set before creating or changing output.
  const payloads=validated.files.map(entry=>({entry,contents:readPlainFile(root,rootRealPath,entry)}));

  if(fs.existsSync(output)){
    const outputStats=fs.lstatSync(output);
    if(outputStats.isSymbolicLink()||!outputStats.isDirectory())fail('existing dist is not a real directory');
    assertExactArtifact(output,files);
  }else{
    fs.mkdirSync(output);
  }

  for(const {entry,contents} of payloads){
    const target=path.join(output,...entry.segments);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,contents,{flag:'w',mode:0o644});
    setDeterministicMetadata(target,0o644);
  }

  const directories=expectedDirectories(files).sort((left,right)=>{
    const depthDifference=right.split('/').length-left.split('/').length;
    return depthDifference||comparePortable(left,right);
  });
  for(const directory of directories)setDeterministicMetadata(path.join(output,...directory.split('/')),0o755);
  setDeterministicMetadata(output,0o755);
  assertExactArtifact(output,files);

  for(const {entry,contents} of payloads){
    const built=fs.readFileSync(path.join(output,...entry.segments));
    if(!built.equals(contents))fail(`artifact bytes differ from source: ${entry.value}`);
  }
  return {files};
}

if(require.main===module){
  try{
    const result=buildRelease();
    process.stdout.write(`Built dist with ${result.files.length} allowlisted files.\n`);
  }catch(error){
    process.stderr.write(`${error.message}\n`);
    process.exitCode=1;
  }
}

module.exports={BUILD_EPOCH_MS,buildRelease,validateManifest,validateRelativePath};
