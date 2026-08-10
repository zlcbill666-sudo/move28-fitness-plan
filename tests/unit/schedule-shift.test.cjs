'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

const modulePath=path.resolve(__dirname,'../../src/domain/schedule-shift.js');
const weekdays=['mon','tue','wed','thu','fri','sat','sun'];

function session(week,index,weekday,intent='full_body_strength'){return{id:`w${week}-s${index}`,weekday,intent}}
function plan(schedule=[session(1,1,'mon'),session(1,2,'tue','recovery'),session(1,3,'wed','low_impact_cardio'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'mon')]){
  return{id:'plan-safe',weeks:[1,2,3,4].map(number=>({number,sessions:schedule.filter(item=>item.id.startsWith(`w${number}-`))}))};
}
function input(overrides={}){
  return{plan:plan(),currentWeekNumber:1,sessionId:'w1-s1',intake:{weekdays},completedLogs:[],allowedThroughWeekNumber:1,...overrides};
}
function load(){delete require.cache[modulePath];return require(modulePath)}

const unavailable=(code)=>({status:'unavailable',code,suggestion:null});

test('在当前周选择严格晚于错过训练的第一个空闲可用日且仅返回显示建议',()=>{
  const api=load(),raw=input(),before=structuredClone(raw);
  const first=api.suggestScheduleShift(raw),second=api.suggestScheduleShift(raw);
  assert.deepEqual(first,{status:'available',code:'SCHEDULE_SHIFT_AVAILABLE',suggestion:{planId:'plan-safe',sessionId:'w1-s1',intent:'full_body_strength',from:{weekNumber:1,weekday:'mon'},to:{weekNumber:1,weekday:'thu'},displayOnly:true}});
  assert.deepEqual(first,second);assert.deepEqual(raw,before);
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.suggestion)&&Object.isFrozen(first.suggestion.from)&&Object.isFrozen(first.suggestion.to));
});

test('目标日不能叠加任何未移动训练，恢复和有氧不会误判成力量',()=>{
  const api=load(),schedule=[session(1,1,'mon'),session(1,2,'tue','recovery'),session(1,3,'wed','low_impact_cardio'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'mon')];
  const result=api.suggestScheduleShift(input({plan:plan(schedule)}));
  assert.equal(result.status,'available');assert.deepEqual(result.suggestion.to,{weekNumber:1,weekday:'thu'});
  const cardio=api.suggestScheduleShift(input({plan:plan(schedule),sessionId:'w1-s3'}));
  assert.equal(cardio.status,'available');assert.deepEqual(cardio.suggestion.to,{weekNumber:1,weekday:'thu'});
});

test('力量顺延保持前后至少一个完整恢复日并覆盖周日到周一边界',()=>{
  const api=load();
  const sundayBoundary=[session(1,1,'fri'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'mon')];
  const valid=api.suggestScheduleShift(input({plan:plan(sundayBoundary),sessionId:'w1-s1',intake:{weekdays:['sat']}}));
  assert.deepEqual(valid.suggestion.to,{weekNumber:1,weekday:'sat'});
  const invalid=api.suggestScheduleShift(input({plan:plan(sundayBoundary),sessionId:'w1-s1',intake:{weekdays:['sun']}}));
  assert.deepEqual(invalid,unavailable('NO_SAFE_SHIFT_DAY'));
  const previous=[session(1,1,'mon'),session(1,2,'wed'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'mon')];
  assert.deepEqual(api.suggestScheduleShift(input({plan:plan(previous),sessionId:'w1-s1',intake:{weekdays:['thu']}})),unavailable('NO_SAFE_SHIFT_DAY'));
});

test('仅显式相邻窗口可跨周搜索，不能跳过周边界',()=>{
  const api=load(),schedule=[session(1,1,'fri','low_impact_cardio'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'mon')],base=input({plan:plan(schedule),sessionId:'w1-s1',intake:{weekdays:['tue']}});
  assert.deepEqual(api.suggestScheduleShift(base),unavailable('NO_SAFE_SHIFT_DAY'));
  const allowed=api.suggestScheduleShift({...base,allowedThroughWeekNumber:2});
  assert.equal(allowed.status,'available');assert.deepEqual(allowed.suggestion.to,{weekNumber:2,weekday:'tue'});
  assert.deepEqual(api.suggestScheduleShift({...base,allowedThroughWeekNumber:3}),unavailable('INVALID_SHIFT_INPUT'));
});

test('第4周结束后固定unavailable且绝不创建第5周',()=>{
  const api=load(),schedule=[session(1,1,'mon'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'sun')];
  const result=api.suggestScheduleShift(input({plan:plan(schedule),currentWeekNumber:4,sessionId:'w4-s1',intake:{weekdays:['mon']},allowedThroughWeekNumber:4}));
  assert.deepEqual(result,unavailable('CYCLE_COMPLETE'));assert.equal(JSON.stringify(result).includes('weekNumber":5'),false);
  const blocked=[session(1,1,'mon'),session(2,1,'mon'),session(3,1,'mon'),session(4,1,'fri'),session(4,2,'sun')];
  assert.deepEqual(api.suggestScheduleShift(input({plan:plan(blocked),currentWeekNumber:4,sessionId:'w4-s1',intake:{weekdays:['sat']},allowedThroughWeekNumber:4})),unavailable('NO_SAFE_SHIFT_DAY'));
});

test('已完成的训练不能再顺延，完成日志必须精确绑定当前计划与session',()=>{
  const api=load(),completed={planId:'plan-safe',sessionId:'w1-s1',status:'completed',completedAt:'2030-01-02T03:04:05.000Z'};
  assert.deepEqual(api.suggestScheduleShift(input({completedLogs:[completed]})),unavailable('SESSION_ALREADY_COMPLETED'));
  assert.deepEqual(api.suggestScheduleShift(input({completedLogs:[{...completed,planId:'other'}]})),unavailable('INVALID_SHIFT_INPUT'));
  assert.deepEqual(api.suggestScheduleShift(input({completedLogs:[{...completed,sessionId:'missing'}]})),unavailable('INVALID_SHIFT_INPUT'));
});

test('错过session必须唯一属于当前周，输入星期与计划结构必须有限合法',()=>{
  const api=load(),duplicate=plan();duplicate.weeks[1].sessions.push({...duplicate.weeks[0].sessions[0]});
  for(const raw of [input({sessionId:'missing'}),input({currentWeekNumber:2}),input({plan:duplicate}),input({intake:{weekdays:['mon','mon']}}),input({intake:{weekdays:['funday']}})])assert.deepEqual(api.suggestScheduleShift(raw),unavailable('INVALID_SHIFT_INPUT'));
});

test('getter、Proxy、稀疏数组与污染键零执行、零抛出并fail closed',()=>{
  const api=load();let reads=0;
  const getter=input();Object.defineProperty(getter.plan.weeks[0],'sessions',{enumerable:true,get(){reads+=1;return[]}});
  assert.deepEqual(api.suggestScheduleShift(getter),unavailable('INVALID_SHIFT_INPUT'));assert.equal(reads,0);
  const sparse=input();sparse.intake.weekdays=new Array(2);assert.deepEqual(api.suggestScheduleShift(sparse),unavailable('INVALID_SHIFT_INPUT'));
  const revoked=Proxy.revocable(input(),{});revoked.revoke();assert.doesNotThrow(()=>api.suggestScheduleShift(revoked.proxy));assert.deepEqual(api.suggestScheduleShift(revoked.proxy),unavailable('INVALID_SHIFT_INPUT'));
  const polluted=input();Object.defineProperty(polluted,'__proto__',{value:{polluted:true},enumerable:true});assert.deepEqual(api.suggestScheduleShift(polluted),unavailable('INVALID_SHIFT_INPUT'));
});

test('加载后篡改可信intrinsic固定fail closed且不执行替换函数',()=>{
  const api=load(),raw=input(),original={descriptors:Object.getOwnPropertyDescriptors,keys:Reflect.ownKeys,push:Array.prototype.push};let calls=0;const trap=()=>{calls+=1;throw new Error('SECRET')};let result;
  try{Object.getOwnPropertyDescriptors=trap;Reflect.ownKeys=trap;Array.prototype.push=trap;result=api.suggestScheduleShift(raw)}finally{Object.getOwnPropertyDescriptors=original.descriptors;Reflect.ownKeys=original.keys;Array.prototype.push=original.push}
  assert.deepEqual(result,unavailable('INVALID_SHIFT_INPUT'));assert.equal(calls,0);
});

test('CommonJS与classic script暴露相同纯domain API',()=>{
  const api=load();assert.equal(typeof api.suggestScheduleShift,'function');
  const source=fs.readFileSync(modulePath,'utf8'),context=vm.createContext({});vm.runInContext('structuredClone=value=>JSON.parse(JSON.stringify(value))',context);vm.runInContext(source,context);
  assert.equal(typeof context.Move28.domain.suggestScheduleShift,'function');
  const result=vm.runInContext(`Move28.domain.suggestScheduleShift(${JSON.stringify(input())})`,context);
  assert.equal(result.status,'available');
});
