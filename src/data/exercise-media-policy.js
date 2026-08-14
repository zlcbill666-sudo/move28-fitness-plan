(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory();
if(isCommonJS)module.exports=api;
else{Move28.data=Move28.data||{};Move28.data.exerciseMediaPolicy=api}
})(globalThis,function(){
'use strict';
const MEDIA=Object.freeze({"seated-leg-press":"assets/exercises/seated-leg-press.gif","seated-leg-curl":"assets/exercises/seated-leg-curl.gif","glute-bridge":"assets/exercises/glute-bridge.gif","chest-press-machine":"assets/exercises/chest-press-machine.gif","seated-row":"assets/exercises/seated-row.gif","pallof-press":"assets/exercises/pallof-press.gif","seated-leg-extension":"assets/exercises/seated-leg-extension.gif","hip-abduction-machine":"assets/exercises/hip-abduction-machine.gif","wall-push-up":"assets/exercises/wall-push-up.gif","elliptical-trainer":"assets/exercises/elliptical-trainer.gif"});
const RELEASE_ELIGIBLE_IDS=Object.freeze(Object.keys(MEDIA));
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const BLOCKED_PRESENTATION=Object.freeze({
  status:'blocked',
  title:'动作媒体审核中',
  message:'本动作暂不展示视频或GIF。请仅按已复核的文字步骤、无痛范围和安全停止提示执行。'
});
function isReleaseEligible(exerciseId){return typeof exerciseId==='string'&&safeHasOwn(MEDIA,exerciseId)}
function presentationFor(exerciseId){return isReleaseEligible(exerciseId)?Object.freeze({status:'released',title:'动作示范',message:'',src:MEDIA[exerciseId]}):BLOCKED_PRESENTATION}
return Object.freeze({mode:'media_enabled',releaseEligibleIds:RELEASE_ELIGIBLE_IDS,isReleaseEligible,presentationFor});
});
