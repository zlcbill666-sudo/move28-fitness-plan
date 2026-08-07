(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=factory(root,isCommonJS?{}:(root.Move28||{}));
if(!isCommonJS)root.Move28=Move28;
if(isCommonJS)module.exports=Move28;
})(globalThis,function(root,Move28){
'use strict';
const emptyStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const storage=root.localStorage&&typeof root.localStorage.getItem==='function'?root.localStorage:emptyStorage;
Move28.data=Move28.data||{};
Move28.ui=Move28.ui||{};
Move28.guide=Move28.guide||{};
Move28.state=Move28.state||{
  currentDay:Number(storage.getItem('move28-current-day')||1),
  currentWeek:1,
  exerciseFilter:'全部',
  trackDay:1,
  guideDay:1,
  guideStep:0,
  guideSteps:[],
  toastTimer:null,
  clearArmTimer:null,
  clearArmed:false,
  musicEnabled:storage.getItem('move28-music-enabled')!=='0',
  musicKey:'',
  musicVolume:Number(storage.getItem('move28-music-volume')||32)/100,
  storeKey:'move28-tracker-v1',
  tracker:JSON.parse(storage.getItem('move28-tracker-v1')||'{}')
};
Move28.utils=Move28.utils||{
  $:s=>root.document?root.document.querySelector(s):null,
  $$:s=>root.document?[...root.document.querySelectorAll(s)]:[],
  esc:s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
  localDate:()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)},
  storage
};
return Move28;
});
