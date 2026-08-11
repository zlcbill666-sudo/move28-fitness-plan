(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory();
if(isCommonJS)module.exports=api;
else{Move28.data=Move28.data||{};Move28.data.exerciseMediaPolicy=api}
})(globalThis,function(){
'use strict';
const RELEASE_ELIGIBLE_IDS=Object.freeze([]);
const eligibleIds=new Set(RELEASE_ELIGIBLE_IDS);
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const BLOCKED_PRESENTATION=Object.freeze({
  status:'blocked',
  title:'动作媒体审核中',
  message:'本动作暂不展示视频或GIF。请仅按已复核的文字步骤、无痛范围和安全停止提示执行。'
});
const RELEASED_PRESENTATION=Object.freeze({status:'released',title:'动作示范',message:''});
function isReleaseEligible(exerciseId){return typeof exerciseId==='string'&&safeSetHas(eligibleIds,exerciseId)}
function presentationFor(exerciseId){return isReleaseEligible(exerciseId)?RELEASED_PRESENTATION:BLOCKED_PRESENTATION}
return Object.freeze({mode:'text_only',releaseEligibleIds:RELEASE_ELIGIBLE_IDS,isReleaseEligible,presentationFor});
});
