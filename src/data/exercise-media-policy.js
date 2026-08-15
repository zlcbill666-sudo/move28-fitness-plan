(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory();
if(isCommonJS)module.exports=api;
else{Move28.data=Move28.data||{};Move28.data.exerciseMediaPolicy=api}
})(globalThis,function(){
'use strict';
const MEDIA=Object.freeze({});
const RELEASE_ELIGIBLE_IDS=Object.freeze([]);
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const BLOCKED_PRESENTATION=Object.freeze({
  status:'blocked',
  title:'动作动图暂停展示',
  message:'当前本地动图视觉质量未达到公开产品标准；请仅按已复核的文字步骤、无痛范围和安全停止提示执行。'
});
function isReleaseEligible(exerciseId){return typeof exerciseId==='string'&&safeHasOwn(MEDIA,exerciseId)}
function presentationFor(exerciseId){return isReleaseEligible(exerciseId)?Object.freeze({status:'released',title:'动作示范',message:'',src:MEDIA[exerciseId]}):BLOCKED_PRESENTATION}
return Object.freeze({mode:'text_only_quality_review',releaseEligibleIds:RELEASE_ELIGIBLE_IDS,isReleaseEligible,presentationFor});
});
