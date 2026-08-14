(function(root,factory){
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{});
const api=factory();
Move28.data=Object.assign(Move28.data||{},api);
if(isCommonJS)module.exports=api;
})(globalThis,function(){
'use strict';
const safeGetOwnPropertyDescriptor=Object.getOwnPropertyDescriptor.bind(Object);
const safeReflectOwnKeys=Reflect.ownKeys.bind(Reflect);
const safeHasOwnProperty=Function.call.bind(Object.prototype.hasOwnProperty);
const safeArrayIsArray=Array.isArray.bind(Array);
const safeStructuredClone=typeof globalThis.structuredClone==='function'?globalThis.structuredClone.bind(globalThis):null;
const VARIANT_GUIDANCE_FIELDS=Object.freeze(['label','setup','range']);
function inspectVariantGuidance(item,expectedVariant){
  try{
    const descriptor=safeGetOwnPropertyDescriptor(item,'variantGuidance');
    if(!descriptor)return{present:false,valid:false};
    if(!safeHasOwnProperty(descriptor,'value'))return{present:true,valid:false};
    const guidance=descriptor.value;
    if(!expectedVariant||!guidance||typeof guidance!=='object'||safeArrayIsArray(guidance))return{present:true,valid:false};
    const guidanceKeys=safeReflectOwnKeys(guidance);
    if(guidanceKeys.length!==1||guidanceKeys[0]!==expectedVariant)return{present:true,valid:false};
    const entryDescriptor=safeGetOwnPropertyDescriptor(guidance,expectedVariant);
    if(!entryDescriptor||!safeHasOwnProperty(entryDescriptor,'value'))return{present:true,valid:false};
    const entry=entryDescriptor.value;
    if(!entry||typeof entry!=='object'||safeArrayIsArray(entry))return{present:true,valid:false};
    const entryKeys=safeReflectOwnKeys(entry);
    if(entryKeys.length!==VARIANT_GUIDANCE_FIELDS.length||VARIANT_GUIDANCE_FIELDS.some(key=>!entryKeys.includes(key)))return{present:true,valid:false};
    for(const key of VARIANT_GUIDANCE_FIELDS){
      const field=safeGetOwnPropertyDescriptor(entry,key);
      if(!field||!safeHasOwnProperty(field,'value')||typeof field.value!=='string'||!field.value.trim())return{present:true,valid:false};
    }
    if(!safeStructuredClone)return{present:true,valid:false};
    safeStructuredClone(guidance);
    return{present:true,valid:true};
  }catch(_error){return{present:true,valid:false}}
}
function deepFreeze(value,seen=new WeakSet()){
  if(value===null||(typeof value!=='object'&&typeof value!=='function')||seen.has(value))return value;
  seen.add(value);
  for(const key of Reflect.ownKeys(value)){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(descriptor&&Object.hasOwn(descriptor,'value'))deepFreeze(descriptor.value,seen);
  }
  return Object.freeze(value);
}
const PATTERNS=deepFreeze(['mobility','knee_dominant','knee_flexion','hip_extension','horizontal_push','horizontal_pull','anti_rotation','knee_extension','hip_abduction','anti_extension','cardio','locomotion','hinge']);
const SETTINGS=deepFreeze(['gym','home','outdoors']);
const REVIEW_STATUSES=deepFreeze(['draft','approved','retired']);
const EXCLUSION_TAGS=deepFreeze(['deep_knee_bend','overhead','floor','single_leg','hinge']);
const EQUIPMENT_IDS=deepFreeze(['stable_chair','stable_high_bench','exercise_mat','leg_press_machine','leg_curl_machine','chest_press_machine','seated_row_machine','resistance_band','cable_machine','leg_extension_machine','hip_abduction_machine','wall','elliptical_trainer','treadmill','flat_walking_route']);
const DOSE_KEYS=deepFreeze(['sets','reps','rpe','restSec','durationMin','holdSec']);
const VARIANT_GUIDANCE_BY_EXERCISE=deepFreeze(Object.assign(Object.create(null),{'high-seat-sit-to-stand':'high_seat','wall-push-up':'close_wall'}));
const MEDIA_LAUNCH_STATUSES=deepFreeze(['exact_ready','near_pending','near_approved','gap_blocked']);
const MEDIA_MATCH_VERDICTS=deepFreeze(['exact','near','approved_near','gap']);
const MEDIA_RIGHTS_STATUSES=deepFreeze(['confirmed','pending','blocked']);
const MEDIA_POLICY_BY_EXERCISE=deepFreeze(Object.assign(Object.create(null),{
  "seated-leg-raise":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"坐姿抬腿","sourceExerciseDbId":"Hgs6Nl1","sourceExerciseDbName":"seated leg raise","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "ankle-circle":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"脚踝绕环","sourceExerciseDbId":"uL9CsKm","sourceExerciseDbName":"ankle circles","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "seated-leg-press":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"坐姿腿举","sourceExerciseDbId":"10Z2DXU","sourceExerciseDbName":"sled 45в° leg press","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "seated-leg-curl":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"坐姿腿弯举","sourceExerciseDbId":"Zg3XY7P","sourceExerciseDbName":"lever seated leg curl","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "glute-bridge":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"臀桥","sourceExerciseDbId":"u0cNiij","sourceExerciseDbName":"low glute bridge on floor","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "wall-hip-hinge":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"墙触髋铰链","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "chest-press-machine":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"推胸机","sourceExerciseDbId":"T0yTjgW","sourceExerciseDbName":"lever chest press","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "standing-band-chest-press":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"站姿弹力带推胸","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "seated-row":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"坐姿划船","sourceExerciseDbId":"7I6LNUG","sourceExerciseDbName":"lever seated row","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "band-row":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"弹力带划船","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "pallof-press":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"抗旋转推压","sourceExerciseDbId":"9pa4H5m","sourceExerciseDbName":"band horizontal pallof press","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "high-seat-sit-to-stand":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"高位坐姿起立","sourceExerciseDbId":"Gu2rNJd","sourceExerciseDbName":"smith chair squat","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "seated-leg-extension":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"坐姿腿屈伸","sourceExerciseDbId":"my33uHU","sourceExerciseDbName":"lever leg extension","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "seated-knee-extension-unloaded":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"坐姿徒手伸膝","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "supported-calf-raise":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"扶椅提踵","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "hip-abduction-machine":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"髋外展机","sourceExerciseDbId":"CHpahtl","sourceExerciseDbName":"lever seated hip abduction","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "wall-push-up":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"墙壁俯卧撑","sourceExerciseDbId":"LEH9jxP","sourceExerciseDbName":"push-up (wall)","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "dead-bug":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"死虫式","sourceExerciseDbId":"iny3m5y","sourceExerciseDbName":"dead bug","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "heel-slide":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"仰卧脚跟滑动","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "bird-dog-regression":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"四点支撑单肢滑动","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "elliptical-trainer":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"椭圆机／交叉训练机","sourceExerciseDbId":"rjtuP6X","sourceExerciseDbName":"walk elliptical cross trainer","mediaFailureReason":"本地ExerciseDB精确动图已接入应用并通过本阶段运动、视觉和安全复核。"},
  "flat-walk":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"平地慢走","sourceExerciseDbId":"rjiM4L3","sourceExerciseDbName":"walking on incline treadmill","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "supported-standing-march":{"mediaLaunchStatus":"exact_ready","mediaMatchVerdict":"exact","mediaRightsStatus":"confirmed","approvedDisplayName":"扶椅原地踏步","sourceExerciseDbId":"MOVE28PILLOW","sourceExerciseDbName":"Move28 project-owned local GIF","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "hamstring-stretch":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"大腿后侧拉伸","sourceExerciseDbId":"99rWm7w","sourceExerciseDbName":"hamstring stretch","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"},
  "calf-stretch":{"mediaLaunchStatus":"near_approved","mediaMatchVerdict":"approved_near","mediaRightsStatus":"confirmed","approvedDisplayName":"小腿拉伸","sourceExerciseDbId":"17bqEXD","sourceExerciseDbName":"seated calf stretch (male)","mediaFailureReason":"本地动图库素材已接入应用并按本阶段全动作上架要求开放；外部发布前仍需统一复核动作语义差异。"}
}));
function mediaValue(source,key){
  try{const descriptor=safeGetOwnPropertyDescriptor(source,key);return descriptor&&safeHasOwnProperty(descriptor,'value')?descriptor.value:undefined}catch(_error){return undefined}
}
function mediaEligibilityForExercise(source,options){
  const allowReference=Boolean(options&&typeof options==='object'&&options.allowReferenceMediaForLocalPrototype===true);
  if(!source||typeof source!=='object'||safeArrayIsArray(source))return Object.freeze({selectable:false,code:'INVALID_MEDIA_SCHEMA',reason:'动作媒体记录不是对象。'});
  const reviewStatus=mediaValue(source,'reviewStatus');
  if(reviewStatus!=='approved')return Object.freeze({selectable:false,code:'EXERCISE_NOT_APPROVED',reason:'动作未通过动作目录审核。'});
  const launch=mediaValue(source,'mediaLaunchStatus'),verdict=mediaValue(source,'mediaMatchVerdict'),rights=mediaValue(source,'mediaRightsStatus');
  const approvedDisplayName=mediaValue(source,'approvedDisplayName'),sourceExerciseDbId=mediaValue(source,'sourceExerciseDbId');
  if(!MEDIA_LAUNCH_STATUSES.includes(launch)||!MEDIA_MATCH_VERDICTS.includes(verdict)||!MEDIA_RIGHTS_STATUSES.includes(rights)||typeof approvedDisplayName!=='string'||!approvedDisplayName.trim())return Object.freeze({selectable:false,code:'INVALID_MEDIA_SCHEMA',reason:'动作媒体状态字段非法。'});
  if(allowReference)return Object.freeze({selectable:true,mode:'local_reference'});
  if(verdict==='gap'||launch==='gap_blocked')return Object.freeze({selectable:false,code:'MEDIA_MATCH_NOT_APPROVED',reason:mediaValue(source,'mediaFailureReason')||'动作媒体语义缺口未关闭。'});
  const hasProvenance=typeof sourceExerciseDbId==='string'&&/^[A-Za-z0-9]{3,20}$/.test(sourceExerciseDbId);
  if(!hasProvenance)return Object.freeze({selectable:false,code:'MEDIA_PROVENANCE_MISSING',reason:'缺少可审计的媒体来源ID。'});
  if(!((launch==='exact_ready'&&verdict==='exact')||(launch==='near_approved'&&verdict==='approved_near')))return Object.freeze({selectable:false,code:'MEDIA_MATCH_NOT_APPROVED',reason:mediaValue(source,'mediaFailureReason')||'近似或未批准媒体不能用于公开生成。'});
  if(rights!=='confirmed')return Object.freeze({selectable:false,code:'MEDIA_RIGHTS_BLOCKED',reason:mediaValue(source,'mediaFailureReason')||'公开发布媒体授权未确认。'});
  return Object.freeze({selectable:true,mode:'public_release'});
}
function isMediaSelectable(source,options){return mediaEligibilityForExercise(source,options).selectable===true}
const strengthDose={sets:[2,3],reps:[8,12],rpe:[5,6],restSec:[60,90]};
const warmupDose={sets:[1,1],reps:[10,10],rpe:[1,3],restSec:[0,30]};
const cardioDose={sets:[1,1],reps:[1,1],rpe:[4,5],restSec:[0,0],durationMin:[8,40]};
const supportedCardioDose={sets:[1,1],reps:[1,1],rpe:[2,4],restSec:[0,60],durationMin:[2,10]};
const stretchDose={sets:[1,1],reps:[1,1],rpe:[1,3],restSec:[0,0],holdSec:[20,20]};
function exercise(meta,legacy){
  const equipmentOptions=meta.equipmentOptions.map(option=>[...option]);
  const media=MEDIA_POLICY_BY_EXERCISE[meta.id]||{mediaLaunchStatus:'gap_blocked',mediaMatchVerdict:'gap',mediaRightsStatus:'blocked',approvedDisplayName:meta.name,sourceExerciseDbId:null,sourceExerciseDbName:null,mediaFailureReason:'动作缺少媒体策略。'};
  return Object.assign({},meta,media,{
    settings:[...meta.settings],equipment:[...new Set(equipmentOptions.flat())],equipmentOptions,
    dose:Object.fromEntries(Object.entries(meta.dose).map(([key,range])=>[key,[...range]])),
    contraindications:[...(meta.contraindications||[])],regressionIds:[...(meta.regressionIds||[])],progressionIds:[...(meta.progressionIds||[])],
    reviewStatus:'approved',
    cues:{setup:legacy.start,movement:legacy.steps,breathing:legacy.breath,pain:legacy.safety},
    groups:[...legacy.groups],start:legacy.start,steps:legacy.steps,breath:legacy.breath,errors:legacy.errors,safety:legacy.safety
  });
}
const exerciseCatalog=deepFreeze([
exercise({id:'seated-leg-raise',name:'坐姿抬腿',pattern:'mobility',settings:['gym','home'],equipmentOptions:[['stable_chair']],difficulty:1,dose:warmupDose,gif:'assets/gifs/02_坐姿抬腿.gif'},{groups:['力量A','力量B'],start:'坐在有靠背的椅子上，双脚踩地，腹部轻收，双手扶椅侧保持稳定。',steps:'交替抬起一侧膝盖约5～10厘米，再缓慢放下；躯干保持直立，不向后甩。',breath:'抬腿时呼气，放下时吸气。',errors:'用身体后仰借力；动作过快；抬得过高导致腰部紧张。',safety:'只作为热身；腰部不适时减小幅度。'}),
exercise({id:'ankle-circle',name:'脚踝绕环',pattern:'mobility',settings:['gym','home'],equipmentOptions:[['stable_chair']],difficulty:1,dose:warmupDose,gif:'assets/gifs/03_脚踝绕环.gif'},{groups:['力量A','力量B'],start:'坐稳，一只脚稍离地，膝盖保持不动。',steps:'用脚尖缓慢画圆，顺时针10次、逆时针10次，然后换脚。',breath:'自然呼吸。',errors:'小腿和膝盖跟着大幅摆动；速度过快。',safety:'踝部出现锐痛时停止；不要强压活动范围。'}),
exercise({id:'seated-leg-press',name:'坐姿腿举',pattern:'knee_dominant',settings:['gym'],equipmentOptions:[['leg_press_machine']],difficulty:2,dose:strengthDose,contraindications:['deep_knee_bend'],regressionIds:['high-seat-sit-to-stand'],gif:'assets/gifs/04_坐姿腿举.gif'},{groups:['力量A'],start:'背部和臀部贴靠垫，双脚与肩同宽放在踏板中部，膝盖与脚尖同向。',steps:'解除安全锁后缓慢屈膝至舒适范围；脚掌均匀发力推开踏板；顶端不锁死膝盖，再受控返回。',breath:'推起时呼气，回落时吸气；绝不憋气。',errors:'膝盖内扣；臀部离开坐垫；下放过深；顶端锁膝；追求大重量。',safety:'先轻重量；膝或腰出现锐痛立即停止；高血压不做力竭。'}),
exercise({id:'seated-leg-curl',name:'坐姿腿弯举',pattern:'knee_flexion',settings:['gym'],equipmentOptions:[['leg_curl_machine']],difficulty:2,dose:strengthDose,gif:'assets/gifs/05_坐姿腿弯举.gif'},{groups:['力量A'],start:'调整座椅，使机器转轴与膝关节对齐；小腿垫位于脚踝上方，背部贴靠垫。',steps:'脚跟向下后方弯曲至舒适位置，短暂停顿，再用3秒缓慢回到起点。',breath:'弯曲时呼气，回位时吸气。',errors:'臀部抬起；借惯性甩动；回位过快；垫子压在小腿中段。',safety:'膝后侧疼痛时减小幅度或停止。'}),
exercise({id:'glute-bridge',name:'臀桥',pattern:'hip_extension',settings:['gym','home'],equipmentOptions:[['exercise_mat']],difficulty:1,dose:strengthDose,contraindications:['floor'],regressionIds:['wall-hip-hinge'],gif:'assets/gifs/06_臀桥.gif'},{groups:['力量A'],start:'仰卧屈膝，双脚与髋同宽，脚跟距臀部约一脚长，双臂放在身体两侧。',steps:'收紧腹部和臀部，脚跟发力抬髋；肩—髋—膝接近直线即可，停1秒后缓慢放下。',breath:'抬起时呼气，放下时吸气。',errors:'腰部过度反弓；用脚尖发力；膝盖向内夹；抬得过高。',safety:'肩部活动受限不需要用手臂撑地发力；腰痛时缩小幅度。'}),
exercise({id:'wall-hip-hinge',name:'墙触髋铰链',pattern:'hinge',settings:['home','gym'],equipmentOptions:[['wall']],difficulty:1,dose:strengthDose,contraindications:['hinge'],progressionIds:['glute-bridge'],gif:'assets/gifs/20_墙触髋铰链.gif'},{groups:['力量A'],start:'背对墙站立，脚跟离墙约一脚长，双脚与髋同宽，膝盖微屈，双臂轻放胸前。',steps:'保持脊柱中立，将臀部向后送至轻触墙面；脚掌不离地，短暂停顿后收紧臀部站直，不把动作做成下蹲。',breath:'向后送髋时吸气，站直时呼气。',errors:'弓腰或抬头；膝盖大幅前移变成下蹲；重心落到脚尖；撞击墙面。',safety:'先确认墙面及脚下稳定；腰、髋或大腿后侧出现锐痛、麻木或放射痛时立即停止。'}),
exercise({id:'chest-press-machine',name:'推胸机',pattern:'horizontal_push',settings:['gym'],equipmentOptions:[['chest_press_machine']],difficulty:2,dose:strengthDose,regressionIds:['wall-push-up','standing-band-chest-press'],gif:'assets/gifs/07_推胸机.gif'},{groups:['力量A','力量B'],start:'调座椅，使把手大致位于胸部中下方；背部贴垫，优先中立握，肩胛轻轻后收下沉。',steps:'在肩部无痛范围内向前推，不锁肘；缓慢回到手肘略低于肩的位置，不让把手过度后撤。',breath:'推时呼气，回时吸气。',errors:'耸肩；手肘张开过大；把手回得太深；挺腰；憋气。',safety:'肩部痛超过轻微不适立即取消；使用很轻重量，不做肩上推举替代。'}),
exercise({id:'standing-band-chest-press',name:'站姿弹力带推胸',pattern:'horizontal_push',settings:['home','gym'],equipmentOptions:[['resistance_band']],difficulty:1,dose:strengthDose,progressionIds:['chest-press-machine'],gif:'assets/gifs/21_站姿弹力带推胸.gif'},{groups:['力量A','力量B'],start:'将弹力带牢固固定在身后胸口高度，采用前后分腿站姿，双手置于胸侧，收紧腹部并让肩膀远离耳朵。',steps:'保持躯干直立，将双手平稳向前推至手肘接近伸直但不锁死；短暂停顿，再受控回到胸侧。',breath:'向前推时呼气，受控回位时吸气。',errors:'固定点不牢；肋骨外翻或身体前倾；耸肩；手肘锁死；弹力带快速弹回。',safety:'先确认固定点牢固并使用轻阻力；肩、胸、肘或腰出现锐痛时立即停止。'}),
exercise({id:'seated-row',name:'坐姿划船',pattern:'horizontal_pull',settings:['gym'],equipmentOptions:[['seated_row_machine']],difficulty:2,dose:strengthDose,regressionIds:['band-row'],gif:'assets/gifs/08_坐姿划船.gif'},{groups:['力量A','力量B'],start:'胸部贴靠胸垫或背部保持中立，优先中立握；肩膀远离耳朵。',steps:'先轻收肩胛，再将手肘向身体两侧后拉；拉至手肘与躯干接近即可，缓慢伸臂返回。',breath:'拉回时呼气，伸臂时吸气。',errors:'身体后仰借力；耸肩；手肘过度后伸；快速放回重量。',safety:'肩部仅在无痛范围；肩前方夹痛时减小幅度或取消。'}),
exercise({id:'band-row',name:'弹力带划船',pattern:'horizontal_pull',settings:['home','gym'],equipmentOptions:[['resistance_band']],difficulty:1,dose:strengthDose,progressionIds:['seated-row'],gif:'assets/gifs/19_弹力带划船.gif'},{groups:['力量A','力量B'],start:'将弹力带牢固固定在胸口高度，面对固定点稳定站立，双脚与髋同宽，躯干中立，双手握住弹力带并伸臂。',steps:'肩膀保持远离耳朵，肘沿身体两侧向后拉至手靠近肋骨；短暂停顿，再受控伸臂回到起点，全程不后仰借力。',breath:'后拉时呼气，受控回位时吸气。',errors:'固定点不牢；耸肩；肘向外张开；身体后仰借力；松手或快速弹回。',safety:'先确认固定点牢固并使用轻阻力；肩、肘或腰出现锐痛时立即停止。'}),
exercise({id:'pallof-press',name:'抗旋转推压',pattern:'anti_rotation',settings:['gym','home'],equipmentOptions:[['resistance_band'],['cable_machine']],difficulty:2,dose:strengthDose,gif:'assets/gifs/09_抗旋转推压.gif'},{groups:['力量A'],start:'弹力带或拉力器调到胸口高度，身体侧对固定点，双脚略宽于肩，双手握把放胸前。',steps:'收紧腹部，将双手缓慢向前推出；身体不向拉力方向旋转，停1秒后收回。',breath:'推出时缓慢呼气，收回时吸气。',errors:'躯干旋转；耸肩；重量过大；屏住呼吸。',safety:'肩部不适时降低把手高度、缩短推出距离或取消。'}),
exercise({id:'high-seat-sit-to-stand',name:'高位坐姿起立',pattern:'knee_dominant',settings:['gym','home'],equipmentOptions:[['stable_high_bench'],['stable_chair']],difficulty:1,dose:strengthDose,progressionIds:['seated-leg-press'],gif:'assets/gifs/10_高位坐姿起立.gif',variantGuidance:{high_seat:{label:'高位座椅变式',setup:'使用稳固、不会滑动的较高座椅；座面高度以起立时膝部无明显疼痛为准。',range:'只在可控、无痛范围内起立和坐回；若仍需猛冲或膝痛，继续提高座面或停止。'}}},{groups:['力量B'],start:'选稳固且较高的长凳/椅子，脚略宽于肩，脚尖微向外；身体坐在前半部。',steps:'上身轻微前倾，脚掌发力站起；站直但不后仰，再将臀部向后送，缓慢坐回。',breath:'站起时呼气，坐下时吸气。',errors:'膝盖内扣；猛扑起身；直接跌坐；用手臂大力撑腿。',safety:'实际训练只使用稳固高位座椅，不使用史密斯负重；膝痛时提高座位或停止。'}),
exercise({id:'seated-leg-extension',name:'坐姿腿屈伸',pattern:'knee_extension',settings:['gym'],equipmentOptions:[['leg_extension_machine']],difficulty:2,dose:strengthDose,regressionIds:['seated-knee-extension-unloaded'],gif:'assets/gifs/11_坐姿腿屈伸.gif'},{groups:['力量B'],start:'调座椅使膝关节对准机器转轴，小腿垫在脚踝上方，背部贴垫。',steps:'缓慢伸膝至接近伸直但不锁死，停1秒，再用3秒回落。',breath:'伸腿时呼气，回落时吸气。',errors:'甩腿；锁死膝盖；回落过快；重量过大。',safety:'膝前侧疼痛时减小幅度、减重或取消，改做无痛腿弯举。'}),
exercise({id:'seated-knee-extension-unloaded',name:'坐姿徒手伸膝',pattern:'knee_extension',settings:['home','gym'],equipmentOptions:[['stable_chair']],difficulty:1,dose:strengthDose,progressionIds:['seated-leg-extension'],gif:'assets/gifs/22_坐姿徒手伸膝.gif'},{groups:['力量B'],start:'坐在稳固有靠背的椅子上，双脚踩地，背部保持直立，双手轻扶椅面或椅侧。',steps:'保持大腿稳定，缓慢伸直一侧膝盖至接近伸直但不锁死；短暂停顿，再受控放回并换腿。',breath:'伸膝时呼气，放回时吸气。',errors:'身体后仰借力；甩腿；膝盖锁死；大腿离开椅面；回落过快。',safety:'先使用无负重和舒适幅度；膝前侧出现锐痛、卡住或明显肿胀时立即停止。'}),
exercise({id:'supported-calf-raise',name:'扶椅提踵',pattern:'mobility',settings:['home','gym'],equipmentOptions:[['stable_chair']],difficulty:1,dose:strengthDose,gif:'assets/gifs/23_扶椅提踵.gif'},{groups:['力量B','有氧C'],start:'站在稳固椅背后方，双脚与髋同宽，双手只轻扶椅背保持平衡，躯干直立。',steps:'保持膝盖自然伸展，缓慢抬起双脚跟至舒适高度；停顿1秒，再受控落回，不弹跳。',breath:'抬起时呼气，落下时吸气。',errors:'手臂大力压椅；屈膝跳起；脚踝向外翻；快速砸下脚跟。',safety:'先确认椅子不会滑动；小腿、跟腱或脚踝出现锐痛，或站立不稳时立即停止。'}),
exercise({id:'hip-abduction-machine',name:'髋外展机',pattern:'hip_abduction',settings:['gym'],equipmentOptions:[['hip_abduction_machine']],difficulty:2,dose:strengthDose,gif:'assets/gifs/12_髋外展机.gif'},{groups:['力量B'],start:'背部贴靠垫，双脚踩稳，膝外侧贴住挡垫，骨盆保持中立。',steps:'双膝缓慢向外打开至臀侧发力但不疼，停1秒后受控合回。',breath:'打开时呼气，合回时吸气。',errors:'身体前后摆动；快速弹开；重量过大；双膝猛撞回位。',safety:'髋或膝出现锐痛时缩小范围或停止。'}),
exercise({id:'wall-push-up',name:'墙壁俯卧撑',pattern:'horizontal_push',settings:['gym','home'],equipmentOptions:[['wall']],difficulty:1,dose:strengthDose,progressionIds:['chest-press-machine'],gif:'assets/gifs/13_墙壁俯卧撑.gif',variantGuidance:{close_wall:{label:'近墙小幅变式',setup:'双脚站得更靠近墙面，让身体倾斜角度更小；双手置于胸口至肩下高度。',range:'胸部只靠近墙到肩部无痛且身体仍成一直线的范围，再平稳推回。'}}},{groups:['力量B'],start:'面对墙站立，双手略宽于肩、放在胸口至肩下高度；双脚后退，使身体成一直线。',steps:'弯肘让胸部缓慢靠近墙面，手肘约向下后方30～45度；再推回起点，不锁肘。',breath:'靠近墙时吸气，推开时呼气。',errors:'塌腰；耸肩；手放太高；手肘完全向外张。',safety:'肩部无痛才做；疼痛时取消，距离墙更近可降低难度。'}),
exercise({id:'dead-bug',name:'死虫式',pattern:'anti_extension',settings:['gym','home'],equipmentOptions:[['exercise_mat']],difficulty:1,dose:strengthDose,contraindications:['floor'],regressionIds:['heel-slide','bird-dog-regression'],gif:'assets/gifs/14_死虫式.gif'},{groups:['力量B'],start:'仰卧，髋膝约90度，双臂可放身体两侧；腰部轻轻贴地。',steps:'腹部收紧，交替让一侧脚跟缓慢点地再收回；保持腰部不拱起。',breath:'脚跟下放时呼气，收回时吸气。',errors:'腰部离地；动作过快；腿伸得过低；憋气。',safety:'腰部不适时减小幅度或改坐姿交替抬膝。'}),
exercise({id:'heel-slide',name:'仰卧脚跟滑动',pattern:'anti_extension',settings:['home','gym'],equipmentOptions:[['exercise_mat']],difficulty:1,dose:strengthDose,contraindications:['floor'],progressionIds:['dead-bug'],gif:'assets/gifs/25_仰卧脚跟滑动.gif'},{groups:['力量B'],start:'仰卧在垫上，双膝弯曲、双脚踩地，腹部轻收，腰背保持自然稳定。',steps:'让一侧脚跟贴着垫面缓慢向前滑，滑至腰背仍稳定的范围；再沿原路受控收回并换侧。',breath:'脚跟向前滑时呼气，收回时吸气。',errors:'脚跟离地；腰部拱起；腿完全甩直；动作过快；憋气。',safety:'地面起落不安全或被要求避免地面动作时不做；腰、髋或膝出现锐痛时立即停止。'}),
exercise({id:'bird-dog-regression',name:'四点支撑单肢滑动',pattern:'anti_extension',settings:['home','gym'],equipmentOptions:[['exercise_mat']],difficulty:1,dose:strengthDose,contraindications:['floor'],progressionIds:['dead-bug'],gif:'assets/gifs/26_四点支撑单肢滑动.gif'},{groups:['力量B'],start:'在垫上四点支撑，双手在肩下、双膝在髋下，背部保持自然平直，腹部轻收。',steps:'保持三个支撑点稳定，将一只手沿垫面缓慢向前滑动至舒适距离；手不离地，随后受控滑回并换侧。',breath:'向前滑时呼气，滑回时吸气。',errors:'手抬离地；躯干旋转或塌腰；臀部向后坐；滑得过远；屏住呼吸。',safety:'手腕、肩、膝或腰出现锐痛时立即停止；需要时在膝下增加软垫，避免地面者不做。'}),
exercise({id:'elliptical-trainer',name:'椭圆机／交叉训练机',pattern:'cardio',settings:['gym'],equipmentOptions:[['elliptical_trainer']],difficulty:1,dose:cardioDose,regressionIds:['flat-walk'],gif:'assets/gifs/15_椭圆机.gif'},{groups:['力量A','力量B','有氧C'],start:'双脚踩稳踏板，双手轻扶固定把手，躯干直立；先确认膝盖与脚尖方向一致。',steps:'力量日前用最低阻力慢速热身8～10分钟；有氧日先慢5分钟，再进入RPE 4～5。步幅保持小而顺，不追求速度。',breath:'自然、连续呼吸；全程能说短句，不憋气。',errors:'死死抓把手；身体前趴；阻力过高；步幅过大；突然停止。',safety:'膝或腰不适时先降阻力、缩短步幅；仍不适则改为0坡度平地慢走或停止。'}),
exercise({id:'flat-walk',name:'平地慢走',pattern:'locomotion',settings:['gym','home','outdoors'],equipmentOptions:[['treadmill'],['flat_walking_route']],difficulty:1,dose:cardioDose,regressionIds:['supported-standing-march'],gif:'assets/gifs/16_平地慢走.gif'},{groups:['力量A','力量B','有氧C'],start:'跑步机坡度必须设为0；若在室内或户外步行，必须选择平整、无坡度、无障碍的路线。先站稳、系好鞋带，再从舒适慢速开始。',steps:'力量日前慢走8～10分钟热身；有氧阶段保持自然小步幅，结束前逐步降速3～5分钟。全程只走路，不跑步、不爬坡。',breath:'自然呼吸，能说短句。',errors:'扶住扶手悬挂身体；跨大步；跑步机坡度不是0；选择有坡度或不平整路线；突然下机。',safety:'实际计划始终保持0坡度；平衡不稳时降低速度并扶固定把手，仍不稳则停止。'}),
exercise({id:'supported-standing-march',name:'扶椅原地踏步',pattern:'locomotion',settings:['home','gym'],equipmentOptions:[['stable_chair']],difficulty:1,dose:supportedCardioDose,progressionIds:['flat-walk'],gif:'assets/gifs/24_扶椅原地踏步.gif'},{groups:['力量A','力量B','有氧C'],start:'站在稳固椅背后方，双手轻扶，双脚与髋同宽，先确认身体站稳。',steps:'交替抬起一侧膝盖至舒适高度，再受控放下；保持小幅、缓慢、连续，不追求抬高或速度。',breath:'自然连续呼吸，全程能够说短句。',errors:'手臂悬挂身体；膝盖抬得过高；身体左右摇晃；快速跺脚；憋气。',safety:'先做2分钟并随时停下；胸痛、接近晕厥、异常气短或明显不稳时立即停止。'}),
exercise({id:'hamstring-stretch',name:'大腿后侧拉伸',pattern:'mobility',settings:['gym','home'],equipmentOptions:[['stable_chair'],['exercise_mat']],difficulty:1,dose:stretchDose,gif:'assets/gifs/17_大腿后侧拉伸.gif'},{groups:['有氧C'],start:'坐姿或仰卧选择稳定版本，背部保持自然，一侧腿轻微伸直。',steps:'缓慢移动至大腿后侧出现轻微牵拉，保持20秒后换侧；不追求碰脚尖。',breath:'持续自然呼吸。',errors:'弹震；弓腰硬压；拉到疼痛。',safety:'只做轻柔放松；出现神经样放射痛立即停止。'}),
exercise({id:'calf-stretch',name:'小腿拉伸',pattern:'mobility',settings:['gym','home'],equipmentOptions:[['stable_chair']],difficulty:1,dose:stretchDose,gif:'assets/gifs/18_小腿拉伸.gif'},{groups:['有氧C'],start:'坐在稳固椅子前半部，躯干直立，一腿向前伸，脚跟着地，膝盖保持微屈或自然伸直；双手放在大腿或椅面，不拿毛巾、弹力带等拉力工具。',steps:'只靠踝关节主动发力，将脚尖缓慢向身体方向勾，至小腿后侧轻微牵拉；保持20秒后放松并换侧。不要用手或任何器械拉脚尖。',breath:'自然呼吸。',errors:'用手、毛巾或弹力带拉脚尖；猛勾或弹震；膝盖锁死；身体后仰代偿；出现疼痛仍继续。',safety:'不使用外力辅助，只做到轻微牵拉；踝关节或小腿出现疼痛、麻木时立即停止。'})
]);
function validateExerciseCatalog(catalog){
  const errors=[];
  const add=(path,message)=>errors.push({path,message});
  if(!Array.isArray(catalog)){add('catalog','必须是数组');return errors}
  const ids=new Set(),names=new Set();
  const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for(let index=0;index<catalog.length;index++){
    const base=`catalog[${index}]`;
    if(!Object.hasOwn(catalog,index)){add(base,'必须是对象，数组不得包含空位');continue}
    const item=catalog[index];
    if(!item||typeof item!=='object'){add(base,'必须是对象');continue}
    for(const field of ['id','name','pattern','settings','equipment','equipmentOptions','difficulty','dose','contraindications','regressionIds','progressionIds','gif','reviewStatus','cues','mediaLaunchStatus','mediaMatchVerdict','mediaRightsStatus','approvedDisplayName','sourceExerciseDbId','sourceExerciseDbName','mediaFailureReason'])if(!Object.hasOwn(item,field))add(`${base}.${field}`,'缺少必需字段');
    if(typeof item.id!=='string'||!slugPattern.test(item.id))add(`${base}.id`,'必须是稳定英文slug');
    else if(ids.has(item.id))add(`${base}.id`,'ID重复');else ids.add(item.id);
    if(typeof item.name!=='string'||!item.name)add(`${base}.name`,'必须是非空名称');
    else if(names.has(item.name))add(`${base}.name`,'名称重复');else names.add(item.name);
    if(!PATTERNS.includes(item.pattern))add(`${base}.pattern`,'模式枚举非法');
    if(!Array.isArray(item.settings)||!item.settings.length)add(`${base}.settings`,'必须包含合法场景');
    else{
      const seenSettings=new Set();
      for(let settingIndex=0;settingIndex<item.settings.length;settingIndex++){
        if(!Object.hasOwn(item.settings,settingIndex)||!SETTINGS.includes(item.settings[settingIndex]))add(`${base}.settings`,'必须包含合法场景');
        else if(seenSettings.has(item.settings[settingIndex]))add(`${base}.settings`,'场景不得重复');
        else seenSettings.add(item.settings[settingIndex]);
      }
    }
    const equipmentValid=Array.isArray(item.equipment)&&item.equipment.length>0;
    if(!equipmentValid)add(`${base}.equipment`,'器械数组不能为空');
    else{
      if(new Set(item.equipment).size!==item.equipment.length)add(`${base}.equipment`,'器械ID不得重复');
      if(item.equipment.some(id=>typeof id!=='string'||!EQUIPMENT_IDS.includes(id)))add(`${base}.equipment`,'包含未知器械ID');
    }
    const optionsValid=Array.isArray(item.equipmentOptions)&&item.equipmentOptions.length>0;
    const optionUnion=new Set(),optionSignatures=new Set();
    if(!optionsValid)add(`${base}.equipmentOptions`,'器械方案数组不能为空');
    else for(let optionIndex=0;optionIndex<item.equipmentOptions.length;optionIndex++){
      const optionPath=`${base}.equipmentOptions[${optionIndex}]`;
      if(!Object.hasOwn(item.equipmentOptions,optionIndex)){add(optionPath,'器械方案不能为空');continue}
      const option=item.equipmentOptions[optionIndex];
      if(!Array.isArray(option)||!option.length){add(optionPath,'器械方案不能为空');continue}
      if(new Set(option).size!==option.length)add(optionPath,'方案内器械ID不得重复');
      const optionIdsValid=option.every(id=>typeof id==='string'&&EQUIPMENT_IDS.includes(id));
      if(!optionIdsValid)add(optionPath,'包含未知器械ID');
      else{
        option.forEach(id=>optionUnion.add(id));
        const signature=JSON.stringify([...option].sort());
        if(optionSignatures.has(signature))add(optionPath,'器械方案不得重复');else optionSignatures.add(signature);
      }
    }
    if(equipmentValid&&optionsValid){
      const equipmentSet=new Set(item.equipment);
      if(equipmentSet.size!==optionUnion.size||[...equipmentSet].some(id=>!optionUnion.has(id)))add(`${base}.equipment`,'必须精确等于equipmentOptions的器械ID并集');
    }
    if(!Number.isInteger(item.difficulty)||item.difficulty<1||item.difficulty>3)add(`${base}.difficulty`,'难度必须是1～3整数');
    if(!REVIEW_STATUSES.includes(item.reviewStatus))add(`${base}.reviewStatus`,'审核状态非法');
    if(!Array.isArray(item.contraindications))add(`${base}.contraindications`,'必须是数组');
    else if(new Set(item.contraindications).size!==item.contraindications.length||item.contraindications.some(tag=>!EXCLUSION_TAGS.includes(tag)))add(`${base}.contraindications`,'必须是无重复的已审核排除标签');
    for(const field of ['regressionIds','progressionIds']){
      const relations=item[field];
      if(!Array.isArray(relations)){add(`${base}.${field}`,'必须是数组');continue}
      const seenRelations=new Set();
      for(let relationIndex=0;relationIndex<relations.length;relationIndex++){
        const relationPath=`${base}.${field}[${relationIndex}]`;
        if(!Object.hasOwn(relations,relationIndex)||typeof relations[relationIndex]!=='string'||!slugPattern.test(relations[relationIndex])){add(relationPath,'必须是稳定英文slug');continue}
        if(seenRelations.has(relations[relationIndex]))add(`${base}.${field}`,'关系ID不得重复');else seenRelations.add(relations[relationIndex]);
      }
    }
    if(typeof item.gif!=='string'||!/^assets\/gifs\/[^/]+\.gif$/.test(item.gif))add(`${base}.gif`,'必须是assets/gifs下的GIF相对路径');
    if(!MEDIA_LAUNCH_STATUSES.includes(item.mediaLaunchStatus))add(`${base}.mediaLaunchStatus`,'媒体上线状态非法');
    if(!MEDIA_MATCH_VERDICTS.includes(item.mediaMatchVerdict))add(`${base}.mediaMatchVerdict`,'媒体匹配结论非法');
    if(!MEDIA_RIGHTS_STATUSES.includes(item.mediaRightsStatus))add(`${base}.mediaRightsStatus`,'媒体权利状态非法');
    if(typeof item.approvedDisplayName!=='string'||!item.approvedDisplayName.trim())add(`${base}.approvedDisplayName`,'媒体批准展示名不能为空');
    if(typeof item.mediaFailureReason!=='string'||!item.mediaFailureReason.trim())add(`${base}.mediaFailureReason`,'媒体阻塞/授权说明不能为空');
    const provenanceRequired=item.mediaMatchVerdict==='exact'||item.mediaMatchVerdict==='near'||item.mediaMatchVerdict==='approved_near';
    if(provenanceRequired){
      if(typeof item.sourceExerciseDbId!=='string'||!/^[A-Za-z0-9]{3,20}$/.test(item.sourceExerciseDbId))add(`${base}.sourceExerciseDbId`,'EXACT/NEAR媒体必须包含可审计ExerciseDB ID');
      if(typeof item.sourceExerciseDbName!=='string'||!item.sourceExerciseDbName.trim())add(`${base}.sourceExerciseDbName`,'EXACT/NEAR媒体必须包含候选名称');
    }else if(item.sourceExerciseDbId!==null||item.sourceExerciseDbName!==null)add(`${base}.sourceExerciseDbId`,'GAP媒体不得伪造候选来源');
    if(item.mediaLaunchStatus==='exact_ready'&&item.mediaMatchVerdict!=='exact')add(`${base}.mediaMatchVerdict`,'exact_ready必须对应exact');
    if(item.mediaLaunchStatus==='near_pending'&&item.mediaMatchVerdict!=='near')add(`${base}.mediaMatchVerdict`,'near_pending必须对应near');
    if(item.mediaLaunchStatus==='near_approved'&&item.mediaMatchVerdict!=='approved_near')add(`${base}.mediaMatchVerdict`,'near_approved必须对应approved_near');
    if(item.mediaLaunchStatus==='gap_blocked'&&item.mediaMatchVerdict!=='gap')add(`${base}.mediaMatchVerdict`,'gap_blocked必须对应gap');
    if(!item.dose||typeof item.dose!=='object'||Array.isArray(item.dose))add(`${base}.dose`,'必须是剂量对象');
    else{
      for(const key of Object.keys(item.dose))if(!DOSE_KEYS.includes(key))add(`${base}.dose.${key}`,'未知剂量字段');
      for(const key of ['sets','reps','rpe','restSec'])if(!Object.hasOwn(item.dose,key))add(`${base}.dose.${key}`,'缺少必需剂量字段');
      for(const [key,range] of Object.entries(item.dose)){
        if(!DOSE_KEYS.includes(key))continue;
        const rangeValid=Array.isArray(range)&&range.length===2&&range.every(Number.isFinite)&&range[0]<=range[1];
        if(!rangeValid){add(`${base}.dose.${key}`,'必须是有效的[min,max]范围');continue}
        if((key==='sets'||key==='reps'||key==='durationMin'||key==='holdSec')&&range.some(value=>value<=0))add(`${base}.dose.${key}`,'数值必须大于0');
        if(key==='restSec'&&range.some(value=>value<0))add(`${base}.dose.${key}`,'休息秒数不得小于0');
        if(key==='rpe'&&range.some(value=>value<0||value>10))add(`${base}.dose.${key}`,'RPE必须在0～10之间');
      }
    }
    if(!item.cues||['setup','movement','breathing','pain'].some(key=>typeof item.cues[key]!=='string'))add(`${base}.cues`,'必须包含四项文字提示');
    const expectedDescriptor=safeGetOwnPropertyDescriptor(VARIANT_GUIDANCE_BY_EXERCISE,item.id);
    const expectedVariant=expectedDescriptor&&safeHasOwnProperty(expectedDescriptor,'value')?expectedDescriptor.value:null;
    const inspectedGuidance=inspectVariantGuidance(item,expectedVariant);
    if(Boolean(expectedVariant)!==inspectedGuidance.present)add(`${base}.variantGuidance`,expectedVariant?'缺少受控变式指导':'该动作不允许受控变式指导');
    if(inspectedGuidance.present&&!inspectedGuidance.valid)add(`${base}.variantGuidance.${expectedVariant||'unknown'}`,'必须只包含该动作已审核的非空label、setup和range');
  }
  for(let index=0;index<catalog.length;index++){
    if(!Object.hasOwn(catalog,index))continue;
    const item=catalog[index];
    if(!item||typeof item!=='object')continue;
    for(const field of ['regressionIds','progressionIds'])for(const relatedId of Array.isArray(item[field])?item[field]:[]){
      if(typeof relatedId!=='string'||!slugPattern.test(relatedId))continue;
      if(relatedId===item.id)add(`catalog[${index}].${field}`,'不能自引用');
      else if(!ids.has(relatedId))add(`catalog[${index}].${field}`,'引用的动作不存在');
    }
  }
  return errors;
}
function getApprovedExercises(catalog=exerciseCatalog){return catalog.filter(exercise=>exercise.reviewStatus==='approved')}
return{exerciseCatalog,validateExerciseCatalog,getApprovedExercises,mediaEligibilityForExercise,isMediaSelectable,PATTERNS,SETTINGS,REVIEW_STATUSES,EXCLUSION_TAGS,EQUIPMENT_IDS,DOSE_KEYS,VARIANT_GUIDANCE_BY_EXERCISE,MEDIA_LAUNCH_STATUSES,MEDIA_MATCH_VERDICTS,MEDIA_RIGHTS_STATUSES};
});
