const test=require('node:test');
const assert=require('node:assert/strict');

const storeApi=require('../../src/storage/local-store.js');
const {generatePlan}=require('../../src/domain/plan-generator.js');
const {exerciseCatalog}=require('../../src/data/exercise-catalog.js');
const app=require('../../src/app.js');

const INTAKE={boundaryAccepted:true,age:30,pregnancyPostpartum:'no',goal:'habit',activityDays:'3',walkCapacity:'20_40',strengthExperience:'some',trainingBreak:'no',daysPerWeek:'2',sessionMinutes:'30',weekdays:['mon','thu'],gymOftenUnavailable:'no',setting:'gym',equipment:['stable_chair','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','elliptical_trainer','treadmill'],allowSettingSwap:'no',painAreas:['none'],painTrend:'none',acuteInjury:'no',unableToBearWeight:'no',visibleSwelling:'no',dailyActivityLimited:'no',chairStand:'yes',walkTenMinutes:'yes',chestSymptoms:'no',exertionalDizziness:'no',unexplainedFainting:'no',restingShortnessOfBreath:'no',unresolvedConcussion:'no',doctorRestriction:'none',recentSurgery:'no',complexCondition:'no',uncontrolledBloodPressure:'no',cardioPreference:'none',cardioAvoid:'none',avoidMovements:[],avoidEquipment:[],trackingItems:['completion'],sessionPreference:'short_frequent',musicEnabled:'no',finalConfirmed:true};
const RISK={level:'normal',reasons:[],ruleVersion:'pilot-v2'};
const CAPABILITY={version:1,completed:true,chairRise:'independent_controlled',wallPushup:'controlled',wallHinge:'controlled',floorAccess:'comfortable',walkTolerance:'comfortable'};

function memoryStorage(initial){let value=initial??null,writes=0;return{getItem:()=>value,setItem(_key,next){writes+=1;value=next},removeItem(){value=null},snapshot:()=>value,writes:()=>writes}}
function approvedStore(options={}){
  const storage=options.storage||memoryStorage();
  const store=storeApi.createLocalStore({storage,now:options.now||(()=> '2030-01-02T03:04:05.000Z')});
  const saved=store.saveIntake(structuredClone(INTAKE),structuredClone(RISK));
  const capable=store.saveCapabilityProfile(structuredClone(CAPABILITY));
  const generated={...generatePlan({intake:saved.intake,risk:saved.risk,intakeRevision:saved.intakeRevision,catalog:exerciseCatalog}),capabilityRevision:capable.capabilityRevision};
  store.savePlan(generated);
  const raw=JSON.parse(storage.snapshot());
  raw.plan.status='active';
  raw.plan.review={status:'approved',reviewerId:'pilot-reviewer',reviewedAt:'2030-01-02T03:04:05.000Z',planId:raw.plan.id,intakeRevision:raw.intakeRevision,capabilityRevision:raw.capabilityRevision};
  storage.setItem(storeApi.STORAGE_KEY,JSON.stringify(raw));
  return{store,storage,state:store.loadState(),session:raw.plan.weeks[0].sessions[0]};
}

test('固定安全理由原子记录事件并使整份计划失效',()=>{
  for(const reasonCode of storeApi.RUNTIME_STOP_REASON_CODES){
    const {store,session}=approvedStore();
    const next=store.recordWorkoutStop({sessionId:session.id,reasonCode,actionIndex:1,occurredAt:'2030-01-02T03:05:00.000Z'});
    assert.equal(next.plan.status,'stale');
    assert.equal(next.plan.staleReason,'runtime-safety-event');
    assert.equal(next.plan.staleAt,'2030-01-02T03:05:00.000Z');
    assert.deepEqual(next.logs[`safety.${next.plan.id}.${session.id}`],{planId:next.plan.id,sessionId:session.id,status:'safety_stopped',reasonCode,actionIndex:1,occurredAt:'2030-01-02T03:05:00.000Z'});
    assert.equal(next.logs[`${next.plan.id}.${session.id}`],undefined);
  }
});

test('安全停止保留既有完成记录且只执行一次持久写入',()=>{
  const {store,storage,state,session}=approvedStore();
  const other=state.plan.weeks.flatMap(week=>week.sessions).find(item=>item.id!==session.id);
  store.recordWorkoutCompletion({planId:state.plan.id,sessionId:other.id});
  const before=storage.writes();
  const next=store.recordWorkoutStop({sessionId:session.id,reasonCode:'sudden_severe_pain',actionIndex:0,occurredAt:'2030-01-02T03:06:00.000Z'});
  assert.equal(storage.writes(),before+1);
  assert.equal(next.logs[`${state.plan.id}.${other.id}`].status,'completed');
  assert.throws(()=>store.recordWorkoutStop({sessionId:session.id,reasonCode:'sudden_severe_pain',actionIndex:0,occurredAt:'2030-01-02T03:07:00.000Z'}),error=>error.name==='StorageError');
});

test('未知理由、自由文本、非法索引/时间和非本计划session全部拒绝',()=>{
  const {store,session}=approvedStore();
  const base={sessionId:session.id,reasonCode:'chest_pain_or_pressure',actionIndex:0,occurredAt:'2030-01-02T03:05:00.000Z'};
  for(const input of [
    {...base,reasonCode:'other'},
    {...base,note:'secret'},
    {...base,actionIndex:-1},
    {...base,actionIndex:session.actions.length},
    {...base,occurredAt:'today'},
    {...base,sessionId:'unknown-session'}
  ])assert.throws(()=>store.recordWorkoutStop(input));
  assert.equal(store.loadState().plan.status,'active');
});

test('安全停止输入对getter、Proxy和污染对象fail closed且零getter执行',()=>{
  const {store,session}=approvedStore();let reads=0;
  const hostile={sessionId:session.id,reasonCode:'chest_pain_or_pressure',actionIndex:0,occurredAt:'2030-01-02T03:05:00.000Z'};
  Object.defineProperty(hostile,'note',{enumerable:true,get(){reads+=1;return'secret'}});
  assert.throws(()=>store.recordWorkoutStop(hostile));assert.equal(reads,0);
  assert.throws(()=>store.recordWorkoutStop(new Proxy(hostile,{ownKeys(){throw new Error('SECRET')}})));
  assert.equal(store.loadState().plan.status,'active');
});

test('迁移仅恢复合法安全事件并丢弃自由文本和未知状态',()=>{
  const {storage,state,session}=approvedStore();
  const raw=JSON.parse(storage.snapshot()),planId=state.plan.id;
  raw.logs={
    good:{planId,sessionId:session.id,status:'safety_stopped',reasonCode:'near_faint_or_faint',actionIndex:1,occurredAt:'2030-01-02T03:05:00.000Z'},
    bad:{planId,sessionId:session.id,status:'safety_stopped',reasonCode:'other',actionIndex:0,occurredAt:'2030-01-02T03:05:00.000Z',note:'secret'}
  };
  storage.setItem(storeApi.STORAGE_KEY,JSON.stringify(raw));
  const loaded=storeApi.createLocalStore({storage}).loadState();
  assert.deepEqual(Object.keys(loaded.logs),[`safety.${planId}.${session.id}`]);
  assert.equal('note'in loaded.logs[`safety.${planId}.${session.id}`],false);
});

test('重筛理由固定映射到疼痛活动页或心肺神经页',()=>{
  for(const reason of ['sudden_severe_pain','unable_to_bear_weight','joint_pain_persisted_or_worsened'])assert.equal(app.rescreenStepForReason(reason),6);
  for(const reason of ['chest_pain_or_pressure','near_faint_or_faint','abnormal_shortness_of_breath','neurologic_or_consciousness_change'])assert.equal(app.rescreenStepForReason(reason),7);
});

test('active计划与当前安全停止事件并存时迁移和视图均fail closed',()=>{
  const {storage,state,session}=approvedStore();
  const raw=JSON.parse(storage.snapshot());
  raw.logs[`safety.${state.plan.id}.${session.id}`]={planId:state.plan.id,sessionId:session.id,status:'safety_stopped',reasonCode:'unable_to_bear_weight',actionIndex:0,occurredAt:'2030-01-02T03:05:00.000Z'};
  storage.setItem(storeApi.STORAGE_KEY,JSON.stringify(raw));
  const loaded=storeApi.createLocalStore({storage}).loadState();
  assert.equal(loaded.plan.status,'stale');
  assert.equal(loaded.plan.staleReason,'runtime-safety-event');
  assert.equal(app.contextFromState(loaded).mode,'stale');
  const direct=structuredClone(raw);
  assert.equal(app.contextFromState(direct).mode,'stale');
});
