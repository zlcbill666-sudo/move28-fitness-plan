'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { projectRoot, clearMove28ModuleCache, loadScript } = require('../helpers/load-script.cjs');

const cases = JSON.parse(fs.readFileSync(path.join(projectRoot,'tests','fixtures','generator-cases.json'),'utf8'));
const gymEquipment = ['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'];
const baseIntake = Object.freeze({
  age:30,finalConfirmed:true,daysPerWeek:'3',sessionMinutes:'45',weekdays:['mon','wed','fri'],setting:'gym',equipment:gymEquipment,
  avoidMovements:[],avoidEquipment:[],cardioPreference:'mixed',cardioAvoid:'none',strengthExperience:'some',trainingBreak:'no',allowSettingSwap:'yes'
});
function risk(level='normal'){return {level,ruleVersion:'pilot-v2',reasons:[]}}
function loadGenerator(){
  clearMove28ModuleCache();
  const generatorPath=path.join(projectRoot,'src','domain','plan-generator.js');
  delete require.cache[generatorPath];
  return {...require(generatorPath),...loadScript('exerciseCatalog')};
}
function generate(api,intake={},level='normal',extra={}){
  return api.generatePlan({intake:{...baseIntake,...intake},risk:risk(level),intakeRevision:1,...extra});
}
function circularGap(a,b){
  const order=['mon','tue','wed','thu','fri','sat','sun'];
  const gap=Math.abs(order.indexOf(a)-order.indexOf(b));
  return Math.min(gap,7-gap);
}

test('fixture矩阵生成固定四周并遵守1/2/3/4+周结构与时长上限', () => {
  const api=loadGenerator();
  for(const item of cases){
    const result=generate(api,{daysPerWeek:item.daysPerWeek,sessionMinutes:item.sessionMinutes,weekdays:item.weekdays,trainingBreak:item.trainingBreak||'no'},item.riskLevel);
    assert.equal(result.status,'generated',`${item.name}: ${JSON.stringify(result)}`);
    assert.equal(result.weeks.length,4);
    assert.deepEqual(result.weeks.map(week=>week.number),[1,2,3,4]);
    assert.deepEqual(result.weeks.map(week=>week.focus),['适应','重复并小幅增加','条件渐进','巩固']);
    for(const week of result.weeks){
      assert.deepEqual(week.sessions.map(session=>session.intent),item.expectedIntents,item.name);
      assert.ok(week.sessions.length<=4);
      assert.ok(week.sessions.every(session=>session.estimatedMinutes<=Number(item.sessionMinutes)));
      assert.ok(week.sessions.every(session=>item.weekdays.includes(session.weekday)));
    }
  }
});

test('全身力量固定五种动作意图且全部由approved目录匹配', () => {
  const api=loadGenerator();
  const plan=generate(api);
  const approved=new Map(api.exerciseCatalog.filter(item=>item.reviewStatus==='approved').map(item=>[item.id,item]));
  const expected=['knee_dominant','posterior_chain','horizontal_push','horizontal_pull','core_stability'];
  for(const week of plan.weeks)for(const session of week.sessions.filter(item=>item.intent==='full_body_strength')){
    assert.deepEqual(session.actions.map(action=>action.pattern),expected);
    for(const action of session.actions){
      assert.ok(approved.has(action.exerciseId));
      assert.equal(action.phase,'main');
      assert.equal(action.sets,2);
      assert.ok(action.reps>=8&&action.reps<=12);
      assert.equal(action.rpe,5);
    }
  }
});

test('2天计划会从全部可用星期中选择非连续组合', () => {
  const api=loadGenerator();
  const result=generate(api,{daysPerWeek:'2',weekdays:['mon','tue','thu'],sessionMinutes:'30'});
  assert.equal(result.status,'generated');
  assert.deepEqual(result.weeks[0].sessions.map(session=>session.weekday),['mon','thu']);
});

test('力量日非连续并处理周日到周一的跨周恢复边界', () => {
  const api=loadGenerator();
  const valid=generate(api,{daysPerWeek:'2',weekdays:['mon','thu'],sessionMinutes:'30'});
  assert.equal(valid.status,'generated');
  for(const week of valid.weeks){
    const days=week.sessions.filter(item=>item.intent==='full_body_strength').map(item=>item.weekday);
    assert.ok(circularGap(days[0],days[1])>=2);
  }
  const invalid=generate(api,{daysPerWeek:'2',weekdays:['sun','mon'],sessionMinutes:'30'});
  assert.equal(invalid.status,'manual_review');
  assert.equal(invalid.plan,null);
  assert.equal(invalid.errors[0].code,'RECOVERY_SCHEDULE_UNAVAILABLE');
});

test('normal仅第2周增加次数，后两周等待反馈；conservative不自动进阶', () => {
  const api=loadGenerator();
  const normal=generate(api,{daysPerWeek:'1',weekdays:['mon'],sessionMinutes:'20'},'normal');
  assert.deepEqual(normal.weeks.map(week=>week.sessions[0].actions[0].reps),[8,9,9,9]);
  const conservative=generate(api,{daysPerWeek:'1',weekdays:['mon'],sessionMinutes:'20',trainingBreak:'yes'},'conservative');
  assert.deepEqual(conservative.weeks.map(week=>week.sessions[0].actions[0].reps),[8,8,8,8]);
  for(const week of conservative.weeks)for(const action of week.sessions[0].actions){
    assert.equal(action.sets,2);
    assert.equal(action.rpe,5);
    assert.equal(action.restSec,90);
  }
  assert.ok(conservative.assumptions.some(item=>item.code==='catalog_floor_for_conservative'));
  assert.ok(conservative.assumptions.some(item=>item.code==='returning_to_training'));
});

test('有氧偏好和排斥通过matcher选择动作，不复制动作映射', () => {
  const api=loadGenerator();
  const elliptical=generate(api,{cardioPreference:'elliptical'});
  assert.equal(elliptical.weeks[0].sessions.find(item=>item.intent==='low_impact_cardio').actions[0].exerciseId,'elliptical-trainer');
  const walk=generate(api,{cardioPreference:'flat_walk'});
  assert.equal(walk.weeks[0].sessions.find(item=>item.intent==='low_impact_cardio').actions[0].exerciseId,'flat-walk');
  const avoidElliptical=generate(api,{cardioPreference:'none',cardioAvoid:'elliptical'});
  assert.equal(avoidElliptical.weeks[0].sessions.find(item=>item.intent==='low_impact_cardio').actions[0].exerciseId,'flat-walk');
});

test('器械与动作回避生效，缺少关键动作时整份计划原子失败', () => {
  const api=loadGenerator();
  const noRow=generate(api,{equipment:gymEquipment.filter(item=>item!=='seated_row_machine')});
  assert.equal(noRow.status,'manual_review');
  assert.equal(noRow.plan,null);
  assert.equal(noRow.errors[0].code,'REQUIRED_MOVEMENT_UNAVAILABLE');
  assert.equal(noRow.errors[0].pattern,'horizontal_pull');
  assert.equal(noRow.errors[0].cause.code,'INSUFFICIENT_EQUIPMENT');
  const floor=generate(api,{avoidMovements:['floor']});
  assert.equal(floor.status,'generated');
  assert.ok(floor.weeks.flatMap(week=>week.sessions).flatMap(session=>session.actions).every(action=>!['glute-bridge','dead-bug'].includes(action.exerciseId)));
});

test('居家水平拉仍缺approved动作，不能伪造完整计划或回退draft', () => {
  const api=loadGenerator();
  const intake={setting:'home',equipment:['stable_chair','exercise_mat','resistance_band','wall'],daysPerWeek:'2',weekdays:['mon','thu'],sessionMinutes:'30'};
  const result=generate(api,intake);
  assert.equal(result.status,'manual_review');
  assert.equal(result.plan,null);
  assert.equal(result.errors[0].pattern,'horizontal_pull');
  assert.equal(result.errors[0].cause.code,'NO_APPROVED_MATCH');
  const draft={...api.exerciseCatalog.find(item=>item.id==='seated-row'),id:'band-row',settings:['home'],equipment:['resistance_band'],equipmentOptions:[['resistance_band']],reviewStatus:'draft'};
  const withDraft=generate(api,intake,'normal',{catalog:[...api.exerciseCatalog,draft]});
  assert.equal(withDraft.status,'manual_review');
  assert.equal(withDraft.errors[0].cause.code,'NO_APPROVED_MATCH');
});

test('自定义catalog被真实消费，空目录和自定义器械方案都可观察', () => {
  const api=loadGenerator();
  const empty=generate(api,{},'normal',{catalog:[]});
  assert.equal(empty.status,'manual_review');
  assert.equal(empty.errors[0].cause.code,'NO_APPROVED_MATCH');
  const original=api.exerciseCatalog.find(item=>item.id==='seated-leg-press');
  const custom={...original,equipment:['treadmill'],equipmentOptions:[['treadmill']]};
  const catalog=api.exerciseCatalog.filter(item=>item.pattern!=='knee_dominant'||item.id===original.id).map(item=>item.id===original.id?custom:item);
  const equipment=gymEquipment.filter(item=>!['leg_press_machine','stable_chair'].includes(item));
  const plan=generate(api,{equipment},'normal',{catalog});
  assert.equal(plan.status,'generated');
  assert.equal(plan.weeks[0].sessions[0].actions[0].exerciseId,'seated-leg-press');
});

test('stop、manual_review、未确认、版本不符及非法revision固定阻止生成', () => {
  const api=loadGenerator();
  const inputs=[
    {intake:baseIntake,risk:risk('stop'),intakeRevision:1},
    {intake:baseIntake,risk:risk('manual_review'),intakeRevision:1},
    {intake:{...baseIntake,finalConfirmed:false},risk:risk(),intakeRevision:1},
    {intake:{...baseIntake,age:17},risk:risk(),intakeRevision:1},
    {intake:{...baseIntake,trainingBreak:'yes'},risk:risk(),intakeRevision:1},
    {intake:baseIntake,risk:{...risk(),ruleVersion:'pilot-v1'},intakeRevision:1},
    {intake:baseIntake,risk:risk(),intakeRevision:-1}
  ];
  for(const input of inputs){
    const result=api.generatePlan(input);
    assert.equal(result.status,'manual_review');
    assert.equal(result.plan,null);
    assert.ok(result.errors.length>0);
  }
});

test('相同输入完全确定、结果深冻结且不修改调用方数据', () => {
  const api=loadGenerator();
  const input={intake:{...baseIntake,equipment:[...baseIntake.equipment],weekdays:[...baseIntake.weekdays],avoidMovements:[],avoidEquipment:[]},risk:risk(),intakeRevision:7};
  const before=structuredClone(input);
  const first=api.generatePlan(input),second=api.generatePlan(input);
  assert.deepEqual(first,second);
  assert.deepEqual(input,before);
  assert.equal(first.id,'plan-pilot-v2-r7-gym-3');
  assert.equal(first.planVersion,'pilot-v2');
  assert.equal(first.ruleVersion,'pilot-v2');
  assert.equal(first.intakeRevision,7);
  assert.equal(Object.isFrozen(first),true);
  assert.equal(Object.isFrozen(first.weeks),true);
  assert.equal(Object.isFrozen(first.weeks[0].sessions[0].actions),true);
});

test('accessor、稀疏数组和revoked Proxy零执行并fail closed', () => {
  const api=loadGenerator();
  let reads=0;
  const equipment=[];
  Object.defineProperty(equipment,0,{enumerable:true,configurable:true,get(){reads+=1;return 'stable_chair'}}); equipment.length=1;
  const hostile=api.generatePlan({intake:{...baseIntake,equipment},risk:risk(),intakeRevision:1});
  assert.equal(hostile.status,'manual_review');
  assert.equal(reads,0);
  const revoked=Proxy.revocable({},{}); revoked.revoke();
  assert.doesNotThrow(()=>api.generatePlan({intake:revoked.proxy,risk:risk(),intakeRevision:1}));
  assert.equal(api.generatePlan({intake:revoked.proxy,risk:risk(),intakeRevision:1}).status,'manual_review');
  class IntakeRecord {}
  const classIntake=Object.assign(new IntakeRecord(),baseIntake);
  assert.equal(api.generatePlan({intake:classIntake,risk:risk(),intakeRevision:1}).status,'manual_review');
  let riskReads=0;
  const hostileRisk={ruleVersion:'pilot-v2'};
  Object.defineProperty(hostileRisk,'level',{enumerable:true,get(){riskReads+=1;return 'normal'}});
  assert.equal(api.generatePlan({intake:baseIntake,risk:hostileRisk,intakeRevision:1}).status,'manual_review');
  assert.equal(riskReads,0);
  let catalogReads=0;
  const catalogRequest={intake:baseIntake,risk:risk(),intakeRevision:1};
  Object.defineProperty(catalogRequest,'catalog',{enumerable:true,get(){catalogReads+=1;return api.exerciseCatalog}});
  assert.equal(api.generatePlan(catalogRequest).status,'manual_review');
  assert.equal(catalogReads,0);
  const crossRealm=vm.runInNewContext(`(${JSON.stringify({intake:baseIntake,risk:risk(),intakeRevision:1})})`);
  assert.equal(api.generatePlan(crossRealm).status,'generated');
  const transparentTop=new Proxy({intake:baseIntake,risk:risk(),intakeRevision:1},{});
  assert.equal(api.generatePlan(transparentTop).status,'manual_review');
  const transparentIntake=new Proxy({...baseIntake},{});
  assert.equal(api.generatePlan({intake:transparentIntake,risk:risk(),intakeRevision:1}).status,'manual_review');
  const transparentEquipment=new Proxy([...baseIntake.equipment],{});
  assert.equal(api.generatePlan({intake:{...baseIntake,equipment:transparentEquipment},risk:risk(),intakeRevision:1}).status,'manual_review');
  const cyclic={intake:baseIntake,risk:risk(),intakeRevision:1}; cyclic.self=cyclic;
  assert.equal(api.generatePlan(cyclic).status,'manual_review');
});

test('经典script与CommonJS均暴露纯生成API且不依赖DOM/storage/时间/随机数', () => {
  const context={structuredClone}; vm.createContext(context);
  for(const relative of ['src/data/exercise-catalog.js','src/domain/movement-matcher.js','src/domain/plan-generator.js']){
    vm.runInContext(fs.readFileSync(path.join(projectRoot,...relative.split('/')),'utf8'),context);
  }
  assert.equal(typeof context.Move28.domain.generatePlan,'function');
  const result=vm.runInContext(`Move28.domain.generatePlan(${JSON.stringify({intake:baseIntake,risk:risk(),intakeRevision:1})})`,context);
  assert.equal(result.status,'generated');
});
