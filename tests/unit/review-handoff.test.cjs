'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const{clearMove28ModuleCache,loadScript}=require('../helpers/load-script.cjs');
function api(){clearMove28ModuleCache();return loadScript('reviewHandoff')}

test('dossier文件名只接受受控participantId和planId',()=>{
  const review=api();
  assert.equal(review.dossierFilename({participantId:'pilot-a1b2',planId:'plan-v1'}),'move28-review-dossier-pilot-a1b2-plan-v1.json');
  assert.equal(review.dossierFilename({participantId:'../../secret',planId:'https://bad'}),'move28-review-dossier-pilot-local-plan-pending.json');
});

test('dossier下载只用Blob object URL且不提供网络回退',()=>{
  const calls=[],timers=[];let parts=null;
  const anchor={hidden:false,click(){calls.push('click')},remove(){calls.push('remove')}};
  const env={Blob:class{constructor(value,options){parts=value;this.type=options.type}},URL:{createObjectURL(){calls.push('url');return'blob:local'},revokeObjectURL(url){calls.push(['revoke',url])}},document:{createElement(tag){assert.equal(tag,'a');return anchor},body:{appendChild(){calls.push('append')}}},setTimeout(fn,delay){timers.push([fn,delay])},fetch(){throw new Error('network must not be used')}};
  const dossier={dossierVersion:'move28.review-dossier.v1',participantId:'pilot-a',planId:'plan-v1'};
  const result=api().downloadReviewDossier(dossier,env);
  assert.deepEqual(result,{ok:true,status:'download_started',filename:'move28-review-dossier-pilot-a-plan-v1.json'});
  assert.deepEqual(JSON.parse(parts[0]),dossier);
  assert.equal(anchor.href,'blob:local');assert.equal(anchor.download,result.filename);
  assert.deepEqual(calls,['url','append','click','remove']);
  assert.equal(timers[0][1],1000);timers[0][0]();assert.deepEqual(calls.at(-1),['revoke','blob:local']);
});

test('导入解析对畸形、超限和非对象dossier固定失败',()=>{
  const review=api(),valid=JSON.stringify({dossierVersion:'move28.review-dossier.v1',planId:'plan-v1'});
  assert.deepEqual(review.parseReviewDossierText(valid),JSON.parse(valid));
  for(const value of ['', '{bad', '[]', 'null', 'text', ' '.repeat(1024*1024+1)])assert.equal(review.parseReviewDossierText(value),null);
});
