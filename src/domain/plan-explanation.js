(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory(root);
Move28.domain=Move28.domain||{};
Object.assign(Move28.domain,api);
if(isCommonJS)module.exports=api;
})(globalThis,function(root){
'use strict';

const VERSION='plan-explanation.v1';
const nativeStructuredClone=typeof root.structuredClone==='function'?root.structuredClone.bind(root):null;
const safeArrayIsArray=Array.isArray;
const safeGetPrototypeOf=Object.getPrototypeOf;
const safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor;
const safeOwnKeys=Reflect.ownKeys;
const safeHasOwn=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const safeArrayPush=Function.prototype.call.bind(Array.prototype.push);
const safeArrayPop=Function.prototype.call.bind(Array.prototype.pop);
const SafeWeakSet=WeakSet;
const safeWeakSetAdd=Function.prototype.call.bind(WeakSet.prototype.add);
const safeWeakSetHas=Function.prototype.call.bind(WeakSet.prototype.has);
const SafeSet=Set;
const safeSetHas=Function.prototype.call.bind(Set.prototype.has);
const safeSetAdd=Function.prototype.call.bind(Set.prototype.add);
const safeFreeze=Object.freeze;
const safeNumberIsFinite=Number.isFinite;
const safeNumberIsSafeInteger=Number.isSafeInteger;
const safeString=String;
const safeMathMin=Math.min;
const safeMathMax=Math.max;
const nativeObjectPrototype=Object.prototype;
const MAX_KEYS_PER_NODE=1024;
const MAX_TOTAL_KEYS=10000;
const MAX_PROPERTY_KEY_LENGTH=128;
const MAX_STRING_LENGTH=4096;
const MAX_TOTAL_CHARACTERS=100000;
const DANGEROUS_KEYS=new SafeSet(['__proto__','prototype','constructor']);
const ACTIVE_CAPABILITY_STATUSES=new SafeSet(['normal','conservative']);
const RISK_LEVELS=new SafeSet(['normal','conservative']);
const SETTINGS=new SafeSet(['home','gym']);
const SESSION_INTENTS=new SafeSet(['full_body_strength','low_impact_cardio','recovery']);
const RISK_CONSERVATIVE_CODE='RISK_RULE_CONSERVATIVE_START';
const RISK_CONSERVATIVE_LABEL='安全筛查结果要求计划采用保守起步。';

const REASON_LABELS=safeFreeze(Object.assign(Object.create(null),{
  CHAIR_RISE_HANDS_SUPPORTED:'坐站需要手部辅助，计划采用更易控制的起立版本。',
  CHAIR_RISE_NOT_ATTEMPTED:'坐站能力尚未完成检查，计划采用更保守的起立版本。',
  WALL_PUSHUP_LIMITED_RANGE:'墙壁推举活动范围有限，计划采用更靠近墙面的版本。',
  WALL_PUSHUP_NOT_ATTEMPTED:'推举能力尚未完成检查，计划采用更保守的推举版本。',
  WALL_HINGE_LIMITED_RANGE:'髋部折叠活动范围有限，计划暂不安排需要完整髋铰链的动作。',
  WALL_HINGE_NOT_ATTEMPTED:'髋部折叠能力尚未完成检查，计划暂不安排髋铰链动作。',
  FLOOR_ACCESS_NEEDS_SUPPORT:'地面活动需要支撑，计划避免必须上下地面的动作。',
  FLOOR_ACCESS_AVOID_FLOOR:'当前需要避开地面活动，计划只采用站姿或座姿动作。',
  FLOOR_ACCESS_NOT_ATTEMPTED:'地面活动能力尚未完成检查，计划先避免必须上下地面的动作。',
  WALK_TOLERANCE_FATIGUED_BUT_STABLE:'步行后容易疲劳，计划从较短的低冲击有氧开始。',
  WALK_TOLERANCE_NOT_ATTEMPTED:'步行耐受尚未完成检查，计划从较短的低冲击有氧开始。'
}));
const KNOWN_REASON_CODES=new SafeSet(safeOwnKeys(REASON_LABELS));
const NO_CARDIO_REASON_LABELS=safeFreeze(Object.assign(Object.create(null),{
  WALK_TOLERANCE_FATIGUED_BUT_STABLE:'步行后容易疲劳，当前纯力量计划因此采用更保守的训练起点。',
  WALK_TOLERANCE_NOT_ATTEMPTED:'步行耐受尚未完成检查，当前纯力量计划因此采用更保守的训练起点。'
}));

function failed(){return safeFreeze({version:VERSION,validationResult:'failed'});}

function plainRecord(value){
  if(!value||typeof value!=='object')return false;
  const proto=safeGetPrototypeOf(value);
  return proto===null||proto===nativeObjectPrototype;
}

function ownData(value,key){
  if(!value||typeof value!=='object')return undefined;
  const descriptor=safeGetOwnPropertyDescriptor(value,key);
  return descriptor&&safeHasOwn(descriptor,'value')?descriptor.value:undefined;
}

function clonePureData(value){
  if(!nativeStructuredClone)return null;
  try{
    const stack=[{value,depth:0}],seen=new SafeWeakSet();let nodes=0,totalKeys=0,totalCharacters=0;
    while(stack.length){
      const item=safeArrayPop(stack),current=item.value;
      if(current===null||typeof current==='boolean')continue;
      if(typeof current==='string'){
        if(current.length>MAX_STRING_LENGTH||(totalCharacters+=current.length)>MAX_TOTAL_CHARACTERS)return null;
        continue;
      }
      if(typeof current==='number'){if(!safeNumberIsFinite(current))return null;continue;}
      if(typeof current!=='object'||safeWeakSetHas(seen,current)||item.depth>32)return null;
      safeWeakSetAdd(seen,current);
      if(++nodes>10000)return null;
      const array=safeArrayIsArray(current);
      if(!array&&!plainRecord(current))return null;
      const keys=safeOwnKeys(current);
      if(keys.length>MAX_KEYS_PER_NODE||(totalKeys+=keys.length)>MAX_TOTAL_KEYS)return null;
      for(let index=0;index<keys.length;index+=1){
        const key=keys[index];
        if(typeof key!=='string'||key.length>MAX_PROPERTY_KEY_LENGTH||(totalCharacters+=key.length)>MAX_TOTAL_CHARACTERS||safeSetHas(DANGEROUS_KEYS,key))return null;
      }
      if(array){
        const lengthDescriptor=safeGetOwnPropertyDescriptor(current,'length');
        if(!lengthDescriptor||!safeHasOwn(lengthDescriptor,'value')||!safeNumberIsSafeInteger(lengthDescriptor.value)||lengthDescriptor.value>512)return null;
        let dataIndex=0;
        for(let index=0;index<keys.length;index+=1){const key=keys[index];if(key==='length')continue;if(key!==safeString(dataIndex))return null;dataIndex+=1;}
        if(dataIndex!==lengthDescriptor.value)return null;
      }
      for(let index=0;index<keys.length;index+=1){
        const key=keys[index];if(key==='length'&&array)continue;
        const descriptor=safeGetOwnPropertyDescriptor(current,key);
        if(!descriptor||!safeHasOwn(descriptor,'value'))return null;
        safeArrayPush(stack,{value:descriptor.value,depth:item.depth+1});
      }
    }
    return nativeStructuredClone(value);
  }catch(_error){return null;}
}

function buildPlanExplanation(rawInput){
  const input=clonePureData(rawInput);
  if(!input||!plainRecord(input))return failed();
  const plan=ownData(input,'plan'),capability=ownData(input,'capabilityResult'),revision=ownData(input,'capabilityRevision');
  if(!plan||!capability||!safeNumberIsSafeInteger(revision)||revision<1)return failed();
  const planStatus=ownData(plan,'status'),planCapabilityRevision=ownData(plan,'capabilityRevision'),riskLevel=ownData(plan,'riskLevel');
  const capabilityStatus=ownData(capability,'status'),difficultyCap=ownData(capability,'difficultyCap'),capabilityReasonCodes=ownData(capability,'reasonCodes');
  if(planStatus!=='active'||planCapabilityRevision!==revision)return failed();
  if(!safeSetHas(RISK_LEVELS,riskLevel))return failed();
  if(!safeSetHas(ACTIVE_CAPABILITY_STATUSES,capabilityStatus))return failed();
  if(capabilityStatus==='normal'&&difficultyCap!==2)return failed();
  if(capabilityStatus==='conservative'&&difficultyCap!==1)return failed();
  if(!safeArrayIsArray(capabilityReasonCodes))return failed();
  if(capabilityStatus==='normal'&&capabilityReasonCodes.length!==0)return failed();

  const reasonCodes=[],reasonLabels=[];
  const seenReasons=new SafeSet();
  for(let index=0;index<capabilityReasonCodes.length;index+=1){
    const code=capabilityReasonCodes[index];
    if(typeof code!=='string'||!safeSetHas(KNOWN_REASON_CODES,code)||safeSetHas(seenReasons,code))return failed();
    safeSetAdd(seenReasons,code);
  }
  if(capabilityStatus==='conservative'&&capabilityReasonCodes.length===0)return failed();

  const planWeeks=ownData(plan,'weeks');
  if(!safeArrayIsArray(planWeeks)||planWeeks.length!==4)return failed();
  let setting=null,minimumWeeklySessions=null,maximumWeeklySessions=null,min=Infinity,max=-Infinity,hasCardio=false;
  for(let weekIndex=0;weekIndex<planWeeks.length;weekIndex+=1){
    const week=planWeeks[weekIndex],weekNumber=ownData(week,'number'),sessions=ownData(week,'sessions');
    if(!week||weekNumber!==weekIndex+1||!safeArrayIsArray(sessions)||sessions.length<1||sessions.length>7)return failed();
    minimumWeeklySessions=minimumWeeklySessions===null?sessions.length:safeMathMin(minimumWeeklySessions,sessions.length);
    maximumWeeklySessions=maximumWeeklySessions===null?sessions.length:safeMathMax(maximumWeeklySessions,sessions.length);
    for(let sessionIndex=0;sessionIndex<sessions.length;sessionIndex+=1){
      const session=sessions[sessionIndex],intent=ownData(session,'intent'),sessionSetting=ownData(session,'setting'),estimatedMinutes=ownData(session,'estimatedMinutes');
      if(!session||!safeSetHas(SESSION_INTENTS,intent)||!safeSetHas(SETTINGS,sessionSetting)||!safeNumberIsSafeInteger(estimatedMinutes)||estimatedMinutes<5||estimatedMinutes>180)return failed();
      if(intent==='low_impact_cardio')hasCardio=true;
      if(setting===null)setting=sessionSetting;else if(sessionSetting!==setting)return failed();
      min=safeMathMin(min,estimatedMinutes);max=safeMathMax(max,estimatedMinutes);
    }
  }
  if(setting===null||minimumWeeklySessions===null||maximumWeeklySessions===null||!safeNumberIsFinite(min)||!safeNumberIsFinite(max))return failed();

  if(riskLevel==='conservative'){
    safeArrayPush(reasonCodes,RISK_CONSERVATIVE_CODE);
    safeArrayPush(reasonLabels,RISK_CONSERVATIVE_LABEL);
  }
  for(let index=0;index<capabilityReasonCodes.length;index+=1){
    const code=capabilityReasonCodes[index];
    safeArrayPush(reasonCodes,code);
    safeArrayPush(reasonLabels,!hasCardio&&NO_CARDIO_REASON_LABELS[code]?NO_CARDIO_REASON_LABELS[code]:REASON_LABELS[code]);
  }

  const weeklySessionRange=safeFreeze({min:minimumWeeklySessions,max:maximumWeeklySessions});
  const durationRange=safeFreeze({min,max});
  safeFreeze(reasonCodes);safeFreeze(reasonLabels);
  return safeFreeze({
    version:VERSION,
    strategy:riskLevel==='conservative'||capabilityStatus==='conservative'?'conservative_start':'standard_start',
    setting,
    weeklySessionRange,
    durationRange,
    reasonCodes,
    reasonLabels,
    validationResult:'passed'
  });
}

return safeFreeze({buildPlanExplanation});
});
