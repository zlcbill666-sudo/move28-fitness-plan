(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=factory(root,isCommonJS?{}:(root.Move28||{}));
if(!isCommonJS)root.Move28=Move28;
if(isCommonJS)module.exports=Move28;
})(globalThis,function(root,Move28){
'use strict';
const emptyStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
let storage=emptyStorage;
try{const candidate=root.localStorage;if(candidate&&typeof candidate.getItem==='function'&&typeof candidate.setItem==='function'&&typeof candidate.removeItem==='function')storage=candidate}catch(_error){storage=emptyStorage}
function stored(key,fallback=null){try{const value=storage.getItem(key);return value===null?fallback:value}catch(_error){return fallback}}
function storedJson(key,fallback){try{return JSON.parse(stored(key,JSON.stringify(fallback)))}catch(_error){return fallback}}
function storedInteger(key,fallback,min,max){const value=Number(stored(key,fallback));return Number.isInteger(value)&&value>=min&&value<=max?value:fallback}
function storedRecord(key){const value=storedJson(key,{});if(!value||typeof value!=='object'||Array.isArray(value))return{};const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null?value:{}}
function storedBoolean(key,fallback){const value=stored(key,fallback?'1':'0');return value==='1'?true:value==='0'?false:fallback}
Move28.data=Move28.data||{};
Move28.ui=Move28.ui||{};
Move28.guide=Move28.guide||{};
Move28.state=Move28.state||{
  currentDay:storedInteger('move28-current-day',1,1,28),
  currentWeek:1,
  exerciseFilter:'全部',
  trackDay:1,
  guideDay:1,
  guideStep:0,
  guideSteps:[],
  toastTimer:null,
  clearArmTimer:null,
  clearArmed:false,
  musicEnabled:storedBoolean('move28-music-enabled',true),
  musicKey:'',
  musicVolume:storedInteger('move28-music-volume',32,0,100)/100,
  storeKey:'move28-tracker-v1',
  tracker:storedRecord('move28-tracker-v1')
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
