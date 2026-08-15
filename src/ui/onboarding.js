(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const Move28 = isCommonJS ? require('../namespace.js') : (root.Move28 = root.Move28 || {});
  const riskApi = isCommonJS ? require('../domain/risk-engine.js') : (Move28.domain || {});
  const api = factory(root, Move28, riskApi);
  Move28.onboarding = api;
  if (isCommonJS) module.exports = api;
})(globalThis, function(root, Move28, riskApi) {
  'use strict';

  const DRAFT_KEY = 'move28-onboarding-draft-v1';
  const trustedDeriveActivityStatus = typeof riskApi.deriveActivityStatus === 'function' ? riskApi.deriveActivityStatus : null;
  const trustedDeriveRiskIntake = typeof riskApi.deriveRiskIntake === 'function' ? riskApi.deriveRiskIntake : null;
  const TRI = Object.freeze(['no', 'yes', 'unsure']);
  const EQUIPMENT = Object.freeze({
    gym: ['stable_chair', 'exercise_mat', 'smith_machine', 'leg_press_machine', 'leg_curl_machine', 'chest_press_machine', 'seated_row_machine', 'resistance_band', 'cable_machine', 'elliptical_trainer', 'treadmill'],
    home: ['stable_chair', 'exercise_mat', 'resistance_band', 'wall']
  });
  const PAIN_AREAS = Object.freeze(['none', 'shoulder', 'knee', 'lower_back', 'hip', 'ankle', 'other']);
  const STEPS = Object.freeze([
    { id: 'boundary', eyebrow: '使用边界', title: '先确认这项服务适合你', rail: '4周建立基线，不承诺固定期限结果' },
    { id: 'basics', eyebrow: '基本情况', title: '告诉我们训练起点', rail: '只收集计划需要的最少信息' },
    { id: 'goal', eyebrow: '训练目标', title: '这4周，你最想建立什么？', rail: '选择一个现实、可持续的首要目标' },
    { id: 'experience', eyebrow: '活动经验', title: '你最近的活动基础如何？', rail: '用于控制首周负荷，而不是评价能力' },
    { id: 'schedule', eyebrow: '时间安排', title: '把计划放进真实生活', rail: '可执行的时间表比理想数字更重要' },
    { id: 'equipment', eyebrow: '场景器械', title: '你通常在哪里训练？', rail: '仅使用已审核场景与器械' },
    { id: 'movement', eyebrow: '疼痛与动作能力', title: '确认当前动作边界', rail: '答案用于安全路由，不用于诊断' },
    { id: 'safety', eyebrow: '安全筛查', title: '逐项完成安全确认', rail: '不确定可以如实选择，但不会被当作安全' },
    { id: 'preferences', eyebrow: '训练偏好', title: '让执行方式更顺手', rail: '只选择偏好，不收集自由文本' },
    { id: 'confirm', eyebrow: '确认与路由', title: '核对你的训练基线', rail: '风险在每次修改后重新计算' }
  ]);

  const ENUMS = Object.freeze({
    pregnancyPostpartum: TRI,
    goal: ['habit', 'daily_fitness', 'low_impact_fat_loss', 'basic_strength'],
    activityDays: ['0', '1', '2', '3', '4plus'],
    walkCapacity: ['under_10', '10_20', '20_40', '40plus'],
    strengthExperience: ['none', 'some', 'regular_under_6m', 'experienced'], trainingBreak: TRI,
    daysPerWeek: ['1', '2', '3', '4', '5plus'], sessionMinutes: ['20', '30', '45', '60', '75'],
    gymOftenUnavailable: TRI, setting: ['gym', 'home'], allowSettingSwap: TRI,
    painTrend: ['none', 'mild_stable', 'unsure', 'acute_or_worsening'],
    acuteInjury: TRI, unableToBearWeight: TRI, visibleSwelling: TRI, dailyActivityLimited: TRI, chairStand: TRI, walkTenMinutes: TRI,
    chestSymptoms: TRI, exertionalDizziness: TRI, unexplainedFainting: TRI,
    restingShortnessOfBreath: TRI, unresolvedConcussion: TRI,
    doctorRestriction: ['none', 'clear_modification', 'unclear', 'prohibited', 'unsure'],
    recentSurgery: TRI, complexCondition: TRI, uncontrolledBloodPressure: TRI,
    cardioPreference: ['elliptical', 'flat_walk', 'mixed', 'none'],
    cardioAvoid: ['none', 'elliptical', 'flat_walk'],
    sessionPreference: ['short_frequent', 'longer_fewer'], musicEnabled: TRI
  });
  const ARRAY_ENUMS = Object.freeze({
    weekdays: ['mon','tue','wed','thu','fri','sat','sun'],
    equipment: [...new Set([...EQUIPMENT.gym, ...EQUIPMENT.home])],
    painAreas: PAIN_AREAS,
    avoidMovements: ['deep_knee_bend','overhead','floor','single_leg','hinge'],
    avoidEquipment: [...new Set([...EQUIPMENT.gym, ...EQUIPMENT.home])],
    trackingItems: ['none','completion','rpe','pain','sleep']
  });
  const NUMBER_FIELDS = Object.freeze(['age','heightCm','weightKg','waistCm','painScore']);
  const BOOLEAN_FIELDS = Object.freeze(['boundaryAccepted','finalConfirmed']);
  const INTAKE_FIELDS = Object.freeze([
    ...BOOLEAN_FIELDS,
    ...NUMBER_FIELDS,
    ...Object.keys(ENUMS),
    ...Object.keys(ARRAY_ENUMS)
  ]);
  const INTAKE_FIELD_SET = new Set(INTAKE_FIELDS);

  function own(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }
  function error(field, message) { return { field, message }; }
  function enumError(intake, field, message) {
    return !own(intake, field) || !ENUMS[field].includes(String(intake[field])) ? error(field, message) : null;
  }
  function validOptionalNumber(value, min, max) {
    return value === undefined || value === '' || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
  }
  function sanitizeArray(candidate, allowed) {
    if (!Array.isArray(candidate)) return null;
    try {
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      const lengthDescriptor = descriptors.length;
      if (!lengthDescriptor || !own(lengthDescriptor, 'value')) return null;
      const length = lengthDescriptor.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > allowed.length) return null;
      if (Reflect.ownKeys(descriptors).length !== length + 1) return null;
      const output = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !own(descriptor, 'value')) return null;
        const item = descriptor.value;
        if (typeof item !== 'string' || !allowed.includes(item)) return null;
        output.push(item);
      }
      return output;
    } catch (_error) { return null; }
  }
  function sanitizeIntake(value) {
    const output = {};
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return output;
    try {
      for (const field of INTAKE_FIELDS) {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        if (!descriptor || !own(descriptor, 'value')) continue;
        const candidate = descriptor.value;
        if (BOOLEAN_FIELDS.includes(field)) {
          if (typeof candidate === 'boolean') output[field] = candidate;
        } else if (NUMBER_FIELDS.includes(field)) {
          if (typeof candidate === 'number' && Number.isFinite(candidate)) output[field] = candidate;
        } else if (own(ENUMS, field)) {
          if (typeof candidate === 'string' && ENUMS[field].includes(candidate)) output[field] = candidate;
        } else if (own(ARRAY_ENUMS, field)) {
          const canonical = sanitizeArray(candidate, ARRAY_ENUMS[field]);
          if (canonical) output[field] = canonical;
        }
      }
    } catch (_error) { return {}; }
    return output;
  }

  function validateStep(stepId, intake) {
    const data = sanitizeIntake(intake);
    const errors = [];
    const addEnum = (field, message) => { const item = enumError(data, field, message); if (item) errors.push(item); };
    if (stepId === 'boundary') {
      if (data.boundaryAccepted !== true) errors.push(error('boundaryAccepted', '请先勾选“我理解”后继续。'));
    } else if (stepId === 'basics') {
      if (!Number.isSafeInteger(data.age) || data.age < 0 || data.age > 120) errors.push(error('age', '年龄须为0–120之间的安全整数。'));
      if (!validOptionalNumber(data.heightCm, 80, 250)) errors.push(error('heightCm', '身高请填写80–250厘米。'));
      if (!validOptionalNumber(data.weightKg, 20, 400)) errors.push(error('weightKg', '体重请填写20–400千克。'));
      if (!validOptionalNumber(data.waistCm, 40, 250)) errors.push(error('waistCm', '腰围请填写40–250厘米。'));
      addEnum('pregnancyPostpartum', '请选择孕期或产后情况。');
    } else if (stepId === 'goal') addEnum('goal', '请选择一个训练目标。');
    else if (stepId === 'experience') {
      ['activityDays', 'walkCapacity', 'strengthExperience', 'trainingBreak'].forEach(field => addEnum(field, '请完成此项。'));
    } else if (stepId === 'schedule') {
      ['daysPerWeek', 'sessionMinutes', 'gymOftenUnavailable'].forEach(field => addEnum(field, '请完成此项。'));
      if (!Array.isArray(data.weekdays) || data.weekdays.length < 1) errors.push(error('weekdays', '请至少选择一个可训练日。'));
      else if (new Set(data.weekdays).size !== data.weekdays.length || data.weekdays.some(day => !['mon','tue','wed','thu','fri','sat','sun'].includes(day))) errors.push(error('weekdays', '训练日选择无效。'));
      else {
        const requested = data.daysPerWeek === '5plus' ? 5 : Number(data.daysPerWeek);
        if (Number.isFinite(requested) && data.weekdays.length < requested) errors.push(error('weekdays', '可训练日数量不能少于每周训练天数。'));
      }
    } else if (stepId === 'equipment') {
      ['setting', 'allowSettingSwap'].forEach(field => addEnum(field, '请完成此项。'));
      const allowed = EQUIPMENT[data.setting] || [];
      if (!Array.isArray(data.equipment) || data.equipment.length < 1 || data.equipment.some(id => !allowed.includes(id)) || new Set(data.equipment).size !== data.equipment.length) errors.push(error('equipment', '请至少选择一项当前场景下的已审核器械。'));
      if (data.setting === 'home' && (!Array.isArray(data.equipment) || !data.equipment.includes('stable_chair'))) errors.push(error('equipment', '居家训练至少需要一把稳固椅子。'));
    } else if (stepId === 'movement') {
      if (!Array.isArray(data.painAreas) || data.painAreas.length < 1 || data.painAreas.some(area => !PAIN_AREAS.includes(area)) || (data.painAreas.includes('none') && data.painAreas.length > 1)) errors.push(error('painAreas', '请选择“无疼痛”或具体疼痛部位，二者不能同时选择。'));
      const hasPain = Array.isArray(data.painAreas) && !data.painAreas.includes('none');
      if (hasPain && (!Number.isInteger(data.painScore) || data.painScore < 0 || data.painScore > 10)) errors.push(error('painScore', '有疼痛时请填写0–10的整数评分。'));
      ['painTrend', 'acuteInjury', 'unableToBearWeight', 'visibleSwelling', 'dailyActivityLimited', 'chairStand', 'walkTenMinutes'].forEach(field => addEnum(field, '请完成此项。'));
    } else if (stepId === 'safety') {
      ['chestSymptoms','exertionalDizziness','unexplainedFainting','restingShortnessOfBreath','unresolvedConcussion','doctorRestriction','recentSurgery','complexCondition','uncontrolledBloodPressure'].forEach(field => addEnum(field, '此项必须回答；不确定时请选择“不确定”。'));
    } else if (stepId === 'preferences') {
      ['cardioPreference','cardioAvoid','sessionPreference','musicEnabled'].forEach(field => addEnum(field, '请完成此项。'));
      if (data.cardioAvoid !== 'none' && (data.cardioPreference === data.cardioAvoid || data.cardioPreference === 'mixed')) errors.push(error('cardioAvoid', '喜欢与排斥的有氧方式不能冲突。'));
      if (own(data,'avoidMovements') && (!Array.isArray(data.avoidMovements) || new Set(data.avoidMovements).size !== data.avoidMovements.length)) errors.push(error('avoidMovements', '回避动作选择无效。'));
      if (!Array.isArray(data.trackingItems) || data.trackingItems.length < 1 || new Set(data.trackingItems).size !== data.trackingItems.length || (data.trackingItems.includes('none') && data.trackingItems.length > 1)) errors.push(error('trackingItems', '请选择愿意记录的项目，或明确选择“不记录”。'));
      const equipmentAllowed = EQUIPMENT[data.setting] || [];
      if (own(data,'avoidEquipment') && (!Array.isArray(data.avoidEquipment) || data.avoidEquipment.some(id => !equipmentAllowed.includes(id)) || new Set(data.avoidEquipment).size !== data.avoidEquipment.length)) errors.push(error('avoidEquipment', '回避器械选择无效。'));
    } else if (stepId === 'confirm') {
      if (data.finalConfirmed !== true) errors.push(error('finalConfirmed', '请确认信息准确并理解安全路由。'));
    } else errors.push(error('step', '未知步骤。'));
    return { ok: errors.length === 0, errors };
  }
  function validateAll(intake, includeConfirmation = true) {
    const steps = includeConfirmation ? STEPS : STEPS.slice(0, -1);
    const errors = [];
    for (const step of steps) {
      const result = validateStep(step.id, intake);
      result.errors.forEach(item => errors.push({ ...item, stepId:step.id }));
    }
    return { ok:errors.length === 0, errors };
  }

  function deriveActivityStatus(intake) {
    return trustedDeriveActivityStatus ? trustedDeriveActivityStatus(intake) : 'unknown';
  }
  function deriveRiskIntake(intake) {
    return trustedDeriveRiskIntake ? trustedDeriveRiskIntake(intake) : null;
  }
  function evaluateOnboarding(intake, evaluator) {
    const evaluate = evaluator || riskApi.evaluateRisk;
    if (typeof evaluate !== 'function') throw new Error('Risk evaluator unavailable');
    const canonical = sanitizeIntake(intake);
    const risk = evaluate(deriveRiskIntake(canonical));
    const adult = Number.isSafeInteger(canonical.age) && canonical.age >= 16;
    const intakeComplete = validateAll(canonical, false).ok;
    const pilotEligible = intakeComplete && adult && (risk.level === 'normal' || risk.level === 'conservative');
    return { risk, adult, intakeComplete, pilotEligible, canGenerate:pilotEligible };
  }

  const LABELS = Object.freeze({
    habit:'建立运动习惯', daily_fitness:'提升日常体能', low_impact_fat_loss:'低冲击减脂起步', basic_strength:'建立基础力量',
    gym:'健身房', home:'居家', normal:'常规起步', conservative:'保守起步', manual_review:'待人工审核', stop:'暂不进入自动计划', unsure:'不确定',
    elliptical:'椭圆机', flat_walk:'0坡度平地走', mixed:'两者交替', none:'暂无偏好',
    stable_chair:'稳固椅子', smith_machine:'史密斯机', exercise_mat:'训练垫', resistance_band:'弹力带', wall:'可用墙面',
    leg_press_machine:'腿举机', leg_curl_machine:'腿弯举机', chest_press_machine:'推胸机', seated_row_machine:'坐姿划船机',
    cable_machine:'龙门架', elliptical_trainer:'椭圆机', treadmill:'跑步机',
    shoulder:'肩部', knee:'膝部', lower_back:'下背部', hip:'髋部', ankle:'踝部', other:'其他部位',
    deep_knee_bend:'深屈膝', overhead:'过顶动作', floor:'地面动作', single_leg:'单腿动作', hinge:'髋铰链',
    completion:'完成状态', rpe:'训练RPE', pain:'疼痛', sleep:'睡眠'
  });
  function display(value) { return LABELS[value] || String(value); }
  function buildIntakeSummary(intake, risk) {
    const rows = [];
    const push = (label, value) => { if (value !== undefined && value !== null && value !== '') rows.push({ label, value: display(value) }); };
    push('首要目标', intake.goal); push('训练场景', intake.setting);
    push('身高', Number.isFinite(intake.heightCm) ? `${intake.heightCm} cm` : undefined);
    push('体重', Number.isFinite(intake.weightKg) ? `${intake.weightKg} kg` : undefined);
    push('腰围', Number.isFinite(intake.waistCm) ? `${intake.waistCm} cm` : undefined);
    push('每周安排', intake.daysPerWeek ? `${intake.daysPerWeek === '5plus' ? '5+' : intake.daysPerWeek}天` : undefined);
    push('单次时长', intake.sessionMinutes ? `${intake.sessionMinutes}分钟` : undefined);
    if (Array.isArray(intake.equipment) && intake.equipment.length) push('可用器械', intake.equipment.map(display).join(' / '));
    if (intake.setting === 'home' && Array.isArray(intake.equipment) && !intake.equipment.includes('resistance_band')) push('器械限制', '无弹力带，水平拉动作覆盖有限');
    if (Array.isArray(intake.painAreas) && !intake.painAreas.includes('none')) push('疼痛部位', intake.painAreas.map(display).join(' / '));
    if (Array.isArray(intake.avoidMovements) && intake.avoidMovements.length) push('主动回避', intake.avoidMovements.map(display).join(' / '));
    if (Array.isArray(intake.avoidEquipment) && intake.avoidEquipment.length) push('回避器械', intake.avoidEquipment.map(display).join(' / '));
    if (['yes', 'unsure'].includes(intake.dailyActivityLimited)) push('基础活动', '日常活动受限，需要人工确认');
    push('有氧偏好', intake.cardioPreference);
    if (intake.cardioAvoid && intake.cardioAvoid !== 'none') push('排斥有氧', intake.cardioAvoid);
    if (Array.isArray(intake.trackingItems) && intake.trackingItems.length) push('本机记录', intake.trackingItems.includes('none') ? '不记录' : intake.trackingItems.map(display).join(' / '));
    if (risk) push('安全路由', risk.level);
    if (risk && risk.level !== 'normal') push('保守假设', risk.reasons && risk.reasons.length ? '按更高风险项处理，不确定不视为安全' : '降低首周负荷');
    return rows;
  }

  function createMemoryStorage() {
    const map = new Map();
    return { getItem:k => map.has(k) ? map.get(k) : null, setItem:(k,v) => map.set(k,String(v)), removeItem:k => map.delete(k) };
  }
  function defaultDraftStorage() {
    try {
      const candidate = root.sessionStorage;
      if (candidate && typeof candidate.getItem === 'function') { candidate.getItem(DRAFT_KEY); return candidate; }
    } catch (_error) {}
    return createMemoryStorage();
  }
  function cleanInitial(value) {
    return sanitizeIntake(value);
  }

  function createOnboarding(options) {
    const settings = options || {};
    const element = settings.rootElement;
    if (!element || typeof element.querySelector !== 'function') throw new TypeError('rootElement is required');
    const storage = settings.draftStorage || defaultDraftStorage();
    const onComplete = typeof settings.onComplete === 'function' ? settings.onComplete : function() {};
    const onCancel = typeof settings.onCancel === 'function' ? settings.onCancel : function() {};
    let intake = cleanInitial(settings.initialIntake);
    let step = 0;
    let confirmedStep = -1;
    let isOpen = false;
    let finished = false;
    let resultMessage = '';
    let previousFocus = null;
    let ownsHistoryEntry = false;
    let suppressNextPop = false;

    try {
      const raw = storage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.version === 1 && draft.intake && Number.isInteger(draft.step)) {
          intake = cleanInitial(draft.intake); step = Math.max(0, Math.min(9, draft.step)); confirmedStep = Number.isInteger(draft.confirmedStep) ? Math.max(-1, Math.min(9, draft.confirmedStep)) : -1;
        } else storage.removeItem(DRAFT_KEY);
      }
    } catch (_error) { try { storage.removeItem(DRAFT_KEY); } catch (_removeError) {} }

    function saveDraft(nextStep) {
      try { storage.setItem(DRAFT_KEY, JSON.stringify({ version:1, step:nextStep, confirmedStep, intake:sanitizeIntake(intake) })); } catch (_error) {}
    }
    function clearDraft() { try { storage.removeItem(DRAFT_KEY); } catch (_error) {} }
    function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
    function checked(field, value) {
      const current = intake[field];
      return (Array.isArray(current) ? current.includes(value) : current === value) ? ' checked' : '';
    }
    function choices(field, options, extraClass) {
      return `<div class="ob-choices ${extraClass || ''}" data-field-group="${field}">${options.map(([value,label,hint]) => `<label class="ob-choice"><input type="radio" name="${field}" value="${value}"${checked(field,value)}><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`).join('')}</div>`;
    }
    function checks(field, options) {
      return `<div class="ob-checks" data-field-group="${field}">${options.map(([value,label]) => `<label class="ob-check"><input type="checkbox" name="${field}" value="${value}"${checked(field,value)}><span>${label}</span></label>`).join('')}</div>`;
    }
    function numberField(field, label, placeholder, suffix, required) {
      const bounds = { age:[0,120,1], heightCm:[80,250,1], weightKg:[20,400,.1], waistCm:[40,250,.1], painScore:[0,10,1] }[field] || [];
      const attributes = bounds.length ? ` min="${bounds[0]}" max="${bounds[1]}" step="${bounds[2]}"` : '';
      return `<label class="ob-number"><span>${label}${required ? ' *' : ' <small>可选</small>'}</span><div><input type="number" name="${field}" inputmode="numeric"${attributes} value="${own(intake,field) ? esc(intake[field]) : ''}" placeholder="${placeholder}">${suffix ? `<i>${suffix}</i>` : ''}</div></label>`;
    }
    function tri(field, question, positiveLabel) {
      return `<fieldset class="ob-question"><legend>${question}</legend>${choices(field, [['no','否',''],['yes',positiveLabel || '是',''],['unsure','不确定','']], 'ob-choices-compact')}</fieldset>`;
    }

    function stepBody() {
      if (step === 0) return `<div class="ob-boundary"><span class="ob-big-index">01</span><h3>这是训练起步工具，不是医疗服务</h3><ul><li><b>4周建立基线</b>，用于观察可持续行动，不保证在固定期限达到体重或体型结果。</li><li>不提供诊断、康复治疗或急救。出现紧急症状请立即联系当地急救服务。</li><li>安全筛查会保守处理“不确定”，必要时停止自动路由并建议咨询合适的专业人员。</li></ul><label class="ob-consent"><input type="checkbox" name="boundaryAccepted" value="true"${intake.boundaryAccepted === true ? ' checked' : ''}><span><b>我理解</b>以上产品边界，并愿意逐项如实回答。</span></label></div>`;
      if (step === 1) return `<div class="ob-form-grid">${numberField('age','年龄','例如 32','岁',true)}${numberField('heightCm','身高','例如 170','cm',false)}${numberField('weightKg','体重','例如 85','kg',false)}${numberField('waistCm','腰围','例如 95','cm',false)}</div><div class="ob-privacy">仅用于训练路由；不需要可识别身份的信息或精确出生日期。</div>${tri('pregnancyPostpartum','你目前是否处于孕期或产后恢复阶段？')}`;
      if (step === 2) return choices('goal', [['habit','建立运动习惯','先把每周行动稳定下来'],['daily_fitness','提升日常体能','走路、起身和日常活动更从容'],['low_impact_fat_loss','低冲击减脂起步','以可持续训练支持体重管理'],['basic_strength','建立基础力量','学习并稳定完成基础力量动作']]);
      if (step === 3) return `<fieldset class="ob-question"><legend>最近4周，每周有几天累计活动20分钟以上？</legend>${choices('activityDays',[['0','0天',''],['1','1天',''],['2','2天',''],['3','3天',''],['4plus','4天以上','']], 'ob-choices-compact')}</fieldset><fieldset class="ob-question"><legend>你能连续平地步行多久？</legend>${choices('walkCapacity',[['under_10','不足10分钟',''],['10_20','10–20分钟',''],['20_40','20–40分钟',''],['40plus','40分钟以上','']], 'ob-choices-compact')}</fieldset><fieldset class="ob-question"><legend>力量训练经验</legend>${choices('strengthExperience',[['none','从未训练',''],['some','做过少量训练',''],['regular_under_6m','规律不足6个月',''],['experienced','规律训练更久','']], 'ob-choices-compact')}</fieldset>${tri('trainingBreak','最近是否中断训练超过3个月？')}`;
      if (step === 4) return `<fieldset class="ob-question"><legend>每周希望安排几天训练？</legend>${choices('daysPerWeek',[['1','1天',''],['2','2天',''],['3','3天',''],['4','4天',''],['5plus','5天以上','']], 'ob-choices-compact')}</fieldset><fieldset class="ob-question"><legend>单次可用时长</legend>${choices('sessionMinutes',[['20','20分钟',''],['30','30分钟',''],['45','45分钟',''],['60','60分钟',''],['75','75分钟','']], 'ob-choices-compact')}</fieldset><fieldset class="ob-question"><legend>通常哪些天可以训练？</legend>${checks('weekdays',[['mon','周一'],['tue','周二'],['wed','周三'],['thu','周四'],['fri','周五'],['sat','周六'],['sun','周日']])}</fieldset>${tri('gymOftenUnavailable','健身房是否经常临时无法使用？')}`;
      if (step === 5) {
        const setting = intake.setting;
        const equipmentOptions = setting === 'gym' ? [['stable_chair','稳固椅/凳'],['smith_machine','史密斯机'],['exercise_mat','训练垫'],['leg_press_machine','腿举机'],['leg_curl_machine','腿弯举机'],['chest_press_machine','推胸机'],['seated_row_machine','坐姿划船机'],['resistance_band','弹力带'],['cable_machine','龙门架'],['elliptical_trainer','椭圆机'],['treadmill','跑步机']] : [['stable_chair','稳固椅子（居家必需）'],['exercise_mat','训练垫'],['resistance_band','弹力带'],['wall','可用墙面']];
        return `${choices('setting',[['gym','健身房','器械更完整'],['home','居家','最低配置：稳固椅子；推荐弹力带']])}${setting ? `<fieldset class="ob-question"><legend>勾选你确定可用的器械</legend>${checks('equipment',equipmentOptions)}${setting === 'home' && Array.isArray(intake.equipment) && !intake.equipment.includes('resistance_band') ? '<p class="ob-inline-warning">没有弹力带时，居家水平拉动作覆盖有限；后续不会假设你有该器械。</p>' : ''}${setting === 'home' ? '<p class="ob-muted">首版动作目录尚无已审核的哑铃动作，因此本轮不把哑铃列为可用器械。</p>' : ''}</fieldset>` : '<p class="ob-muted">先选择场景，再核对器械。</p>'}${tri('allowSettingSwap','计划是否可以在健身房与居家版本间切换？')}`;
      }
      if (step === 6) {
        const hasPain = Array.isArray(intake.painAreas) && !intake.painAreas.includes('none');
        return `<fieldset class="ob-question"><legend>目前是否有疼痛部位？</legend>${checks('painAreas',[['none','无疼痛'],['shoulder','肩'],['knee','膝'],['lower_back','下背'],['hip','髋'],['ankle','踝'],['other','其他部位']])}</fieldset>${hasPain ? numberField('painScore','当前疼痛评分','0–10','/ 10',true) : ''}<fieldset class="ob-question"><legend>疼痛趋势</legend>${choices('painTrend',[['none','无疼痛',''],['mild_stable','轻度且稳定',''],['unsure','不确定',''],['acute_or_worsening','急性或正在加重','']], 'ob-choices-compact')}</fieldset>${tri('acuteInjury','目前是否存在急性损伤？')}${tri('unableToBearWeight','目前是否无法用患侧承重？')}${tri('visibleSwelling','目前是否存在明显肿胀？')}${tri('dailyActivityLimited','疼痛或身体情况是否影响走路、坐下起立、上下楼或日常活动？')}${tri('chairStand','你能否不用他人协助，从稳固椅子站起？','能')}${tri('walkTenMinutes','你能否以舒适速度连续步行10分钟？','能')}`;
      }
      if (step === 7) return `${tri('chestSymptoms','近半年是否发生心脏或脑血管事件，或活动/静息时出现胸痛、胸闷、压迫感？')}${tri('exertionalDizziness','活动时是否出现明显头晕或失去平衡？')}${tri('unexplainedFainting','近期是否有不明原因晕厥？')}${tri('restingShortnessOfBreath','静息时是否有异常气短？')}${tri('unresolvedConcussion','是否有尚未恢复或未获许可恢复运动的脑震荡？')}<fieldset class="ob-question"><legend>医生是否对运动有明确限制？</legend>${choices('doctorRestriction',[['none','没有限制',''],['clear_modification','有清晰的调整要求',''],['unclear','有限制但边界不清',''],['prohibited','明确禁止运动',''],['unsure','不确定','']], 'ob-choices-compact')}</fieldset>${tri('recentSurgery','近期是否做过手术且尚未明确恢复运动？')}${tri('complexCondition','是否有疾病、药物或身体情况需要专业人员协同管理？')}${tri('uncontrolledBloodPressure','如果知道血压，是否已达到医生要求处理或尚未控制的范围？')}`;
      if (step === 8) {
        const avoidEquipmentOptions = (EQUIPMENT[intake.setting] || []).map(id => [id, display(id)]);
        return `<fieldset class="ob-question"><legend>更喜欢的低冲击有氧方式</legend>${choices('cardioPreference',[['elliptical','椭圆机',''],['flat_walk','0坡度平地走',''],['mixed','两者都可以',''],['none','暂无偏好','']], 'ob-choices-compact')}</fieldset><fieldset class="ob-question"><legend>明确排斥的有氧方式</legend>${choices('cardioAvoid',[['none','没有',''],['elliptical','不做椭圆机',''],['flat_walk','不做平地走','']], 'ob-choices-compact')}</fieldset><fieldset class="ob-question"><legend>希望回避的动作（可不选）</legend>${checks('avoidMovements',[['deep_knee_bend','深屈膝'],['overhead','过顶动作'],['floor','地面动作'],['single_leg','单腿动作'],['hinge','髋铰链']])}</fieldset><fieldset class="ob-question"><legend>不愿使用的器械（可不选）</legend>${checks('avoidEquipment',avoidEquipmentOptions)}</fieldset><fieldset class="ob-question"><legend>愿意在本机记录哪些项目？（可选择不记录）</legend>${checks('trackingItems',[['none','不记录'],['completion','完成状态'],['rpe','训练RPE'],['pain','疼痛'],['sleep','睡眠']])}</fieldset><fieldset class="ob-question"><legend>训练节奏偏好</legend>${choices('sessionPreference',[['short_frequent','短时、频率高',''],['longer_fewer','单次较长、次数少','']])}</fieldset>${tri('musicEnabled','跟练时默认开启背景音乐吗？')}`;
      }
      const evaluation = evaluateOnboarding(intake);
      const risk = evaluation.risk;
      const summary = buildIntakeSummary(intake, risk);
      const statusClass = `ob-risk-${risk.level}`;
      const functionalFields = Array.isArray(riskApi.FUNCTIONAL_REVIEW_FIELDS) ? riskApi.FUNCTIONAL_REVIEW_FIELDS : [];
      const needsFunctionalReview = Array.isArray(risk.reasons) && risk.reasons.some(reason => functionalFields.includes(reason.field));
      const manualCopy = needsFunctionalReview ? '<b>基础活动能力需要人工审核</b><span>当前试用不会自动生成计划；请先复核日常活动限制与适合的训练起点。</span>' : '<b>需要人工审核</b><span>在获得人工复核前，不进入计划生成。</span>';
      const routeCopy = risk.level === 'stop' ? '<b>暂不进入自动计划</b><span>你的答案触发了停止条件。请停止自动训练路由，并向医生或与该情况匹配的合格专业人员咨询；如有紧急症状请联系急救服务。</span>' : risk.level === 'manual_review' ? manualCopy : !evaluation.adult ? '<b>16岁以下需要人工审核</b><span>当前不会自动生成计划，请先完成适龄人工复核。</span>' : risk.level === 'conservative' ? '<b>可以保守起步</b><span>首周将采用更低负荷和更谨慎的进阶边界。</span>' : '<b>可以进入常规生成流程</b><span>当前筛查未触发额外限制；训练中仍需持续观察身体信号。</span>';
      return `<div class="ob-route ${statusClass}" data-risk-level="${risk.level}">${routeCopy}</div><div class="ob-summary">${summary.map(row => `<div><span>${esc(row.label)}</span><b>${esc(row.value)}</b></div>`).join('')}</div><div class="ob-edit-links"><button type="button" data-go="1">修改基本情况</button><button type="button" data-go="4">修改时间</button><button type="button" data-go="5">修改器械</button><button type="button" data-go="6">修改疼痛与动作能力</button><button type="button" data-go="7">修改安全筛查</button></div>${risk.reasons && risk.reasons.length ? `<details class="ob-reasons"><summary>查看安全路由依据（${risk.reasons.length}项）</summary><ul>${risk.reasons.map(reason => `<li>${esc(reason.message)}</li>`).join('')}</ul></details>` : ''}<label class="ob-consent"><input type="checkbox" name="finalConfirmed" value="true"${intake.finalConfirmed === true ? ' checked' : ''}><span><b>我确认</b>以上答案准确，并理解此结果不是诊断；最终确认后才保存到本机。</span></label>`;
    }

    function render() {
      const meta = STEPS[step];
      const progress = ((step + 1) / STEPS.length) * 100;
      element.innerHTML = `<div class="ob-shell" role="document"><aside class="ob-rail"><a class="ob-brand" href="#top" data-cancel><i>28</i><span>MOVE 28<small>GUIDED ASSESSMENT</small></span></a><div class="ob-rail-copy"><span>ASSESSMENT ${String(step + 1).padStart(2,'0')}</span><h2>${meta.rail}</h2><p>答案只在当前标签页保存草稿；最终确认后才写入本机参与者状态。</p></div><ol aria-label="问卷进度">${STEPS.map((item,index) => `<li class="${index === step ? 'active' : index <= confirmedStep ? 'done' : ''}"><i>${String(index + 1).padStart(2,'0')}</i><span>${item.eyebrow}</span></li>`).join('')}</ol></aside><section class="ob-panel"><header class="ob-head"><div><span>${meta.eyebrow}</span><b>${step + 1} / ${STEPS.length}</b></div><button type="button" data-cancel>暂时退出 ×</button><div class="ob-progress"><i style="width:${progress}%"></i></div></header><main class="ob-content"><div class="ob-title"><span>STEP ${String(step + 1).padStart(2,'0')}</span><h1 tabindex="-1">${meta.title}</h1></div>${resultMessage ? `<div class="ob-saved" role="status">${resultMessage}</div>` : ''}<div class="ob-errors" role="alert" aria-live="polite"></div><div class="ob-step-body">${stepBody()}</div></main><footer class="ob-foot"><button type="button" class="ob-back" data-back>${step === 0 ? '暂时退出' : '← 上一步'}</button><span>草稿仅存当前标签页</span><button type="button" class="ob-next" data-next>${finished ? '完成，返回首页' : step === 9 ? '确认并保存结果 →' : '继续 →'}</button></footer></section></div>`;
      element.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      element.classList.toggle('open', isOpen);
      if (isOpen) {
        const focusTarget = element.querySelector('.ob-title h1');
        if (focusTarget) { focusTarget.setAttribute('tabindex','-1'); focusTarget.focus({ preventScroll:true }); }
      }
    }

    function showErrors(errors) {
      const box = element.querySelector('.ob-errors');
      if (!box) return;
      box.innerHTML = errors.map((item,index) => `<p id="ob-error-${index}" data-error-for="${esc(item.field)}">${esc(item.message)}</p>`).join('');
      errors.forEach((item,index) => element.querySelectorAll(`[name="${item.field}"]`).forEach(control => {
        control.setAttribute('aria-invalid','true'); control.setAttribute('aria-describedby',`ob-error-${index}`);
      }));
      const field = errors[0] && element.querySelector(`[name="${errors[0].field}"]`);
      if (field) field.focus();
    }
    function setField(field, value) {
      if (!INTAKE_FIELD_SET.has(field)) return false;
      if (value === undefined || value === '') delete intake[field];
      else {
        const canonical = sanitizeIntake({ [field]:value });
        if (own(canonical, field)) intake[field] = canonical[field]; else delete intake[field];
      }
      if (field !== 'finalConfirmed') delete intake.finalConfirmed;
      return getState();
    }
    function updateFromControl(control) {
      const field = control.name;
      if (!field) return;
      if (control.type === 'number') {
        setField(field, control.value === '' ? undefined : Number(control.value));
      } else if (control.type === 'checkbox') {
        if (field === 'boundaryAccepted' || field === 'finalConfirmed') setField(field, control.checked);
        else {
          let values = Array.isArray(intake[field]) ? intake[field].slice() : [];
          if (control.checked && !values.includes(control.value)) values.push(control.value);
          if (!control.checked) values = values.filter(value => value !== control.value);
          if ((field === 'painAreas' || field === 'trackingItems') && control.checked) values = control.value === 'none' ? ['none'] : values.filter(value => value !== 'none');
          setField(field, values);
        }
      } else setField(field, control.value);
      if (field === 'setting') { intake.equipment = []; intake.avoidEquipment = []; }
      render();
    }
    function setHistory(nextStep, push) {
      if (!root.history || !root.location) return;
      const state = { move28Onboarding:true, step:nextStep };
      const url = `${root.location.pathname || ''}${root.location.search || ''}#onboarding`;
      try {
        root.history[push ? 'pushState' : 'replaceState'](state, '', url);
        if (push) ownsHistoryEntry = true;
      } catch (_error) {}
    }
    function releaseHistoryEntry() {
      if (!root.history || !root.location || root.location.hash !== '#onboarding') return;
      if (ownsHistoryEntry && typeof root.history.back === 'function') {
        ownsHistoryEntry = false; suppressNextPop = true;
        try { root.history.back(); return; } catch (_error) { suppressNextPop = false; }
      }
      try { root.history.replaceState(null, '', `${root.location.pathname || ''}${root.location.search || ''}`); } catch (_error) {}
    }
    function next() {
      if (finished) { close(); return true; }
      const validation = step === 9 ? validateAll(intake, true) : validateStep(STEPS[step].id, intake);
      if (!validation.ok) {
        if (step === 9 && validation.errors[0] && validation.errors[0].stepId !== 'confirm') {
          step = STEPS.findIndex(item => item.id === validation.errors[0].stepId);
          saveDraft(step); setHistory(step, false); render();
          showErrors(validation.errors.filter(item => item.stepId === STEPS[step].id));
        } else showErrors(validation.errors);
        return false;
      }
      confirmedStep = Math.max(confirmedStep, step);
      if (step < 9) {
        step += 1; saveDraft(step); setHistory(step, false); render(); return true;
      }
      const evaluation = evaluateOnboarding(intake);
      const payload = { intake:sanitizeIntake(intake), risk:evaluation.risk, pilotEligible:evaluation.pilotEligible, canGenerate:evaluation.canGenerate };
      try {
        const completionResult = onComplete(payload);
        clearDraft(); finished = true;
        resultMessage = completionResult && typeof completionResult.message === 'string'
          ? completionResult.message
          : evaluation.canGenerate ? '问卷与安全结果已保存到本机。' : '筛查结果已保存到本机；未进入计划生成。';
        render(); releaseHistoryEntry();
      } catch (exception) {
        resultMessage = exception && exception.name === 'StorageError' ? '本机保存失败。请检查浏览器存储权限后重试；你的答案未通过网络发送。' : '暂时无法保存，请稍后重试。';
        render();
      }
      return true;
    }
    function goTo(index, fromHistory) {
      const target = Math.max(0, Math.min(9, Number(index)));
      if (!Number.isInteger(target)) return false;
      step = target; resultMessage = ''; if (!fromHistory) setHistory(step, false); render(); return true;
    }
    function back() {
      if (step === 0) { close(); return true; }
      step -= 1; setHistory(step, false); render(); return true;
    }
    function open() {
      if (isOpen) return;
      previousFocus = root.document && root.document.activeElement ? root.document.activeElement : null;
      isOpen = true; finished = false; resultMessage = '';
      const currentIsRoute = root.location && root.location.hash === '#onboarding';
      ownsHistoryEntry = Boolean(currentIsRoute && root.history && root.history.state && root.history.state.move28Onboarding);
      setHistory(step, !currentIsRoute); render();
      if (root.document && root.document.body) root.document.body.classList.add('onboarding-open');
    }
    function close(fromPop) {
      if (!isOpen) return;
      if (!finished) saveDraft(step);
      isOpen = false; render();
      if (root.document && root.document.body) root.document.body.classList.remove('onboarding-open');
      if (!fromPop) releaseHistoryEntry();
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected !== false) previousFocus.focus();
      previousFocus = null;
      if (!finished) onCancel(getState());
    }
    function onPopState(event) {
      if (suppressNextPop) { suppressNextPop = false; return; }
      if (root.location && root.location.hash === '#onboarding') {
        if (!isOpen) { isOpen = true; if (root.document && root.document.body) root.document.body.classList.add('onboarding-open'); }
        const historyStep = event.state && event.state.move28Onboarding ? event.state.step : step;
        goTo(historyStep, true);
      } else if (isOpen && step > 0 && !finished) {
        ownsHistoryEntry = false; step -= 1; setHistory(step, true); render();
      } else if (isOpen) { ownsHistoryEntry = false; close(true); }
    }
    function onClick(event) {
      const cancel = event.target.closest('[data-cancel]'); if (cancel) { event.preventDefault(); close(); return; }
      if (event.target.closest('[data-next]')) { next(); return; }
      if (event.target.closest('[data-back]')) { back(); return; }
      const go = event.target.closest('[data-go]'); if (go) goTo(Number(go.dataset.go));
    }
    function onChange(event) { if (event.target && event.target.name) updateFromControl(event.target); }
    function onKeyDown(event) {
      if (!isOpen) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(element.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (root.document.activeElement === first || !element.contains(root.document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    element.addEventListener('click', onClick);
    element.addEventListener('change', onChange);
    element.addEventListener('keydown', onKeyDown);
    if (root.addEventListener) root.addEventListener('popstate', onPopState);
    render();
    if (root.location && root.location.hash === '#onboarding') open();

    function getState() { return { step, confirmedStep, intake:cleanInitial(intake), isOpen, finished, evaluation:evaluateOnboarding(intake) }; }
    function destroy() {
      element.removeEventListener('click',onClick);
      element.removeEventListener('change',onChange);
      element.removeEventListener('keydown',onKeyDown);
      if (root.removeEventListener) root.removeEventListener('popstate',onPopState);
      if (isOpen && root.document && root.document.body) root.document.body.classList.remove('onboarding-open');
      releaseHistoryEntry();
      isOpen = false; element.classList.remove('open'); element.setAttribute('aria-hidden','true');
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected !== false) previousFocus.focus();
      previousFocus = null; element.innerHTML='';
    }
    return Object.freeze({ open, close, next, back, goTo, getState, setField, destroy });
  }

  return Object.freeze({ createOnboarding, validateStep, validateAll, sanitizeIntake, buildIntakeSummary, deriveRiskIntake, evaluateOnboarding, deriveActivityStatus, STEPS, DRAFT_KEY, EQUIPMENT, PAIN_AREAS, INTAKE_FIELDS });
});
