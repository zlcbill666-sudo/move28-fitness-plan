const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const workflow=fs.readFileSync(path.join(root,'.github','workflows','pages.yml'),'utf8');

test('Pages workflow uses only official actions pinned to full commit SHAs',()=>{
  const uses=[...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)].map(match=>match[1]);
  assert.deepEqual(uses,[
    'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd',
    'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
    'actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9',
    'actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b',
    'actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128'
  ]);
  for(const action of uses)assert.match(action,/^actions\/[a-z-]+@[0-9a-f]{40}$/);
});

test('Pages workflow tests and builds before uploading only dist',()=>{
  const ordered=[
    'run: npm ci',
    'run: npm test',
    'run: npm run build',
    'run: npm run test:artifact',
    'uses: actions/upload-pages-artifact@'
  ].map(fragment=>workflow.indexOf(fragment));
  assert.equal(ordered.every(index=>index>=0),true,ordered);
  assert.deepEqual(ordered,[...ordered].sort((left,right)=>left-right));

  const uploadBlocks=[...workflow.matchAll(/uses:\s*actions\/upload-pages-artifact@[\s\S]*?(?=\n\s*-\s|$)/g)];
  assert.equal(uploadBlocks.length,1);
  assert.match(uploadBlocks[0][0],/\n\s+path:\s*dist\s*(?:#.*)?$/m);
  assert.match(uploadBlocks[0][0],/\n\s+include-hidden-files:\s*true\s*(?:#.*)?$/m);
  assert.doesNotMatch(workflow,/\n\s+path:\s*(?:\.|\.\/|\$\{\{\s*github\.workspace\s*\}\})\s*$/m);
});

test('Pages workflow has least privileges and cannot change Pages enablement',()=>{
  assert.match(workflow,/^permissions:\s*\n\s+contents:\s*read/m);
  assert.match(workflow,/\n\s+permissions:\s*\n\s+pages:\s*write\s*\n\s+id-token:\s*write/m);
  assert.match(workflow,/persist-credentials:\s*false/);
  assert.match(workflow,/enablement:\s*false/);
  assert.doesNotMatch(workflow,/enablement:\s*true/);
  assert.match(workflow,/environment:\s*\n\s+name:\s*github-pages/m);
});
