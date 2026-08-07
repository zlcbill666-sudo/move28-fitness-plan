(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory(Move28);
Move28.data=Object.assign(Move28.data||{},api);
if(isCommonJS)module.exports=api;
})(globalThis,function(Move28){
'use strict';
const trackerFields=[{"key":"f1","label":"天数","help":"第1～28天"},{"key":"f2","label":"日期","help":"实际执行日期"},{"key":"f3","label":"周次","help":"第1～4周"},{"key":"f4","label":"星期","help":"周一至周日"},{"key":"f5","label":"计划训练","help":"当天计划类型"},{"key":"f6","label":"完成状态","help":"未填写/已完成/部分完成/休息/因不适暂停"},{"key":"f7","label":"晨起体重(kg)","help":"起床排空后、进食饮水前测量"},{"key":"f8","label":"腰围(cm)","help":"每周固定一天，肚脐水平自然呼气后测量"},{"key":"f9","label":"收缩压(mmHg)","help":"按医生要求在相似条件下测量"},{"key":"f10","label":"舒张压(mmHg)","help":"按医生要求在相似条件下测量"},{"key":"f11","label":"血压测量时间","help":"例如07:30或训练前"},{"key":"f12","label":"静息心率(bpm)","help":"安静坐位休息后记录"},{"key":"f13","label":"步数","help":"手机或手环全天步数"},{"key":"f14","label":"有氧(分钟)","help":"椭圆机/平地走总分钟"},{"key":"f15","label":"力量(分钟)","help":"包含热身与器械训练总分钟"},{"key":"f16","label":"睡眠(小时)","help":"前一晚实际睡眠时长"},{"key":"f17","label":"饮水(L)","help":"当天饮水总量，按医生建议调整"},{"key":"f18","label":"奶茶/含糖饮料(杯)","help":"当天杯数；没有填0"},{"key":"f19","label":"外卖(餐)","help":"当天外卖餐数；没有填0"},{"key":"f20","label":"精力(1-5)","help":"1很差，3一般，5很好"},{"key":"f21","label":"肩部痛(0-10)","help":"0无痛，10最严重"},{"key":"f22","label":"膝痛(0-10)","help":"0无痛，10最严重"},{"key":"f23","label":"腰痛(0-10)","help":"0无痛，10最严重"},{"key":"f24","label":"异常症状","help":"无/胸痛/眩晕/异常气短/心悸/剧烈头痛/其他"},{"key":"f25","label":"备注","help":"训练重量、饮食、恢复或就医情况"}];
return{trackerFields};
});
