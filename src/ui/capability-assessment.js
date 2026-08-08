(function(root, factory) {
  const isCommonJS = typeof module === 'object' && module.exports;
  const Move28 = isCommonJS ? require('../namespace.js') : (root.Move28 = root.Move28 || {});
  const api = factory(root);
  Move28.capabilityAssessment = api;
  if (isCommonJS) module.exports = api;
})(globalThis, function(root) {
  'use strict';

  const safeArrayIsArray = Array.isArray;
  const safeGetPrototypeOf = Object.getPrototypeOf;
  const safeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const safeOwnKeys = Reflect.ownKeys;
  const safeHasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
  const safeSetHas = Function.prototype.call.bind(Set.prototype.has);
  const safeArrayIncludes = Function.prototype.call.bind(Array.prototype.includes);
  const safeArrayPush = Function.prototype.call.bind(Array.prototype.push);
  const safeArrayPop = Function.prototype.call.bind(Array.prototype.pop);
  const SafeWeakSet = WeakSet;
  const safeWeakSetAdd = Function.prototype.call.bind(WeakSet.prototype.add);
  const safeWeakSetHas = Function.prototype.call.bind(WeakSet.prototype.has);
  const safeStructuredClone = typeof root.structuredClone === 'function' ? root.structuredClone.bind(root) : null;
  const safeObjectPrototype = Object.prototype;
  const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  const DRAFT_KEY = 'move28-capability-draft-v1';
  const PROFILE_FIELDS = Object.freeze(['chairRise', 'wallPushup', 'wallHinge', 'floorAccess', 'walkTolerance']);
  const ENUMS = Object.freeze({
    chairRise: Object.freeze(['independent_controlled', 'hands_supported', 'unable_or_painful', 'not_attempted']),
    wallPushup: Object.freeze(['controlled', 'limited_range', 'painful_or_unstable', 'not_attempted']),
    wallHinge: Object.freeze(['controlled', 'limited_range', 'painful_or_unstable', 'not_attempted']),
    floorAccess: Object.freeze(['comfortable', 'needs_support', 'avoid_floor', 'not_attempted']),
    walkTolerance: Object.freeze(['comfortable', 'fatigued_but_stable', 'warning_symptom', 'not_attempted'])
  });
  const STEPS = Object.freeze([
    Object.freeze({ id: 'lower', title: '下肢起身与髋部控制', fields: Object.freeze(['chairRise', 'wallHinge']) }),
    Object.freeze({ id: 'upper', title: '上肢推力与地面可达性', fields: Object.freeze(['wallPushup', 'floorAccess']) }),
    Object.freeze({ id: 'walk', title: '步行耐受与最终确认', fields: Object.freeze(['walkTolerance']) })
  ]);
  const OPTIONS = Object.freeze({
    chairRise: Object.freeze([
      ['independent_controlled', '无需手扶，动作稳定'], ['hands_supported', '需要扶椅或扶腿'],
      ['unable_or_painful', '无法完成或出现疼痛'], ['not_attempted', '未尝试／跳过']
    ]),
    wallPushup: Object.freeze([
      ['controlled', '动作受控'], ['limited_range', '只能完成较小范围'],
      ['painful_or_unstable', '疼痛或不稳'], ['not_attempted', '未尝试／跳过']
    ]),
    wallHinge: Object.freeze([
      ['controlled', '动作受控'], ['limited_range', '只能完成较小范围'],
      ['painful_or_unstable', '疼痛或不稳'], ['not_attempted', '未尝试／跳过']
    ]),
    floorAccess: Object.freeze([
      ['comfortable', '可以舒适完成'], ['needs_support', '需要稳定支撑'],
      ['avoid_floor', '暂时回避地面动作'], ['not_attempted', '未尝试／跳过']
    ]),
    walkTolerance: Object.freeze([
      ['comfortable', '舒适完成'], ['fatigued_but_stable', '疲劳但保持稳定'],
      ['warning_symptom', '出现警示症状并已停止'], ['not_attempted', '未尝试／跳过']
    ])
  });
  const COPY = Object.freeze({
    chairRise: ['高位坐姿起立', '使用稳固、靠墙的高椅，最多3次受控起立；不追求速度或极限。'],
    wallHinge: ['墙触髋铰链', '背对稳固墙面，臀部轻触墙，最多3次；双脚不离地。'],
    wallPushup: ['墙壁俯卧撑', '面对稳固墙面，最多3次受控重复；不做到疲劳。'],
    floorAccess: ['地面可达性', '不要求实际下地。只回答在稳定支撑下到达地面并起身的把握。'],
    walkTolerance: ['五分钟平地步行耐受', '只在安全筛查通过后，以能说短句的速度平地步行；可随时停止。']
  });

  const own = (value, key) => safeHasOwn(value || {}, key);
  function hasSafeCloneGraph(value) {
    const stack = [{ value, depth: 0 }], seen = new SafeWeakSet();
    let nodes = 0;
    while (stack.length) {
      const item = safeArrayPop(stack), current = item.value;
      if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
      if (typeof current === 'number') { if (!Number.isFinite(current)) return false; continue; }
      if (typeof current !== 'object' || item.depth > 16) return false;
      if (safeWeakSetHas(seen, current)) continue;
      safeWeakSetAdd(seen, current);
      if (++nodes > 1000) return false;
      const array = safeArrayIsArray(current), prototype = safeGetPrototypeOf(current);
      if (!array && prototype !== safeObjectPrototype && prototype !== null) return false;
      const keys = safeOwnKeys(current);
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (typeof key !== 'string' || safeSetHas(DANGEROUS_KEYS, key)) return false;
        const descriptor = safeGetOwnPropertyDescriptor(current, key);
        if (!descriptor || !safeHasOwn(descriptor, 'value')) return false;
        if (!(array && key === 'length')) safeArrayPush(stack, { value: descriptor.value, depth: item.depth + 1 });
      }
    }
    return true;
  }
  function sanitizeAnswers(value) {
    try {
      if (!value || typeof value !== 'object' || safeArrayIsArray(value) || !safeStructuredClone) return {};
      if (!hasSafeCloneGraph(value)) return {};
      // Native structuredClone rejects Proxy values. It is called only after every
      // own property is proven to be a data descriptor, so accessors never run.
      const snapshot = safeStructuredClone(value);
      if (!snapshot || typeof snapshot !== 'object' || safeArrayIsArray(snapshot)) return {};
      const output = {};
      for (let index = 0; index < PROFILE_FIELDS.length; index += 1) {
        const field = PROFILE_FIELDS[index];
        const descriptor = safeGetOwnPropertyDescriptor(snapshot, field);
        if (!descriptor || !own(descriptor, 'value')) continue;
        if (typeof descriptor.value === 'string' && safeArrayIncludes(ENUMS[field], descriptor.value)) output[field] = descriptor.value;
      }
      return output;
    } catch (_error) { return {}; }
  }
  function validateStep(stepId, value) {
    const step = STEPS.find(item => item.id === stepId);
    if (!step) return { ok: false, errors: [{ field: 'step', message: '未知校准步骤。' }] };
    const answers = sanitizeAnswers(value);
    const errors = step.fields.filter(field => !own(answers, field)).map(field => ({ field, message: '请选择一个结果；不想尝试时可选择“未尝试／跳过”。' }));
    return { ok: errors.length === 0, errors };
  }
  function buildProfile(value) {
    const answers = sanitizeAnswers(value);
    if (PROFILE_FIELDS.some(field => !own(answers, field))) return null;
    return {
      version: 1, completed: true,
      chairRise: answers.chairRise, wallPushup: answers.wallPushup, wallHinge: answers.wallHinge,
      floorAccess: answers.floorAccess, walkTolerance: answers.walkTolerance
    };
  }
  function createMemoryStorage() {
    const map = new Map();
    return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
  }
  function defaultStorage() {
    try {
      const storage = root.sessionStorage;
      if (storage && typeof storage.getItem === 'function') { storage.getItem(DRAFT_KEY); return storage; }
    } catch (_error) {}
    return createMemoryStorage();
  }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }

  function createCapabilityAssessment(options) {
    const settings = options || {};
    const element = settings.rootElement;
    if (!element || typeof element.querySelector !== 'function') throw new TypeError('rootElement is required');
    const storage = settings.draftStorage || defaultStorage();
    const onComplete = typeof settings.onComplete === 'function' ? settings.onComplete : function() {};
    const onCancel = typeof settings.onCancel === 'function' ? settings.onCancel : function() {};
    let answers = sanitizeAnswers(settings.initialProfile);
    let step = 0;
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
        if (draft && draft.version === 1 && Number.isInteger(draft.step) && draft.answers && typeof draft.answers === 'object') {
          answers = sanitizeAnswers(draft.answers);
          step = Math.max(0, Math.min(STEPS.length - 1, draft.step));
        } else storage.removeItem(DRAFT_KEY);
      }
    } catch (_error) { try { storage.removeItem(DRAFT_KEY); } catch (_removeError) {} }

    function saveDraft() {
      try { storage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, step, answers: sanitizeAnswers(answers) })); return true; }
      catch (_error) { return false; }
    }
    function clearDraft() { try { storage.removeItem(DRAFT_KEY); } catch (_error) {} }
    function safetyNotice() {
      return '<aside class="cap-safety"><b>每屏都适用的安全提示</b><p>准备稳固、无绊倒风险的环境，并确保可随时停止。不要做极限测试。</p><p>如出现胸痛／压迫、接近晕厥、异常气短、突然剧痛、无法承重，或神经／意识异常，请立即停止。</p></aside>';
    }
    function choices(field) {
      const selected = answers[field];
      return `<fieldset class="cap-check"><legend>${esc(COPY[field][0])}</legend><p>${esc(COPY[field][1])}</p><div class="cap-options">${OPTIONS[field].map(([value, label]) => `<label><input type="radio" name="${field}" value="${value}"${selected === value ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>`;
    }
    function render(focusTitle, focusField) {
      const current = STEPS[step];
      const warning = answers.walkTolerance === 'warning_symptom' && step === 2
        ? '<div class="cap-warning" role="status"><b>已记录停止信号</b><span>请不要继续测试。该有效档案仍会保存，但不会自动生成计划。</span></div>' : '';
      element.innerHTML = `<div class="cap-shell" role="document"><header class="cap-head"><div><span>CAPABILITY ${step + 1} / ${STEPS.length}</span><h1 tabindex="-1">${esc(current.title)}</h1></div><button type="button" data-cap-cancel aria-label="退出能力校准">暂时退出 ×</button><div class="cap-progress"><i style="width:${((step + 1) / STEPS.length) * 100}%"></i></div></header><main class="cap-content">${safetyNotice()}${resultMessage ? `<div class="cap-result" role="status">${esc(resultMessage)}</div>` : ''}<div class="cap-errors" role="alert" aria-live="polite"></div><div class="cap-fields">${current.fields.map(choices).join('')}</div>${warning}</main><footer class="cap-foot"><button type="button" data-cap-back>${step === 0 ? '暂时退出' : '← 上一步'}</button><span>草稿仅存当前标签页</span><button type="button" class="cap-next" data-cap-next>${finished ? '完成，返回首页' : step === 2 ? '确认并保存能力档案 →' : '继续 →'}</button></footer></div>`;
      element.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      element.classList.toggle('open', isOpen);
      if (isOpen) {
        const selected = focusField && element.querySelector(`[name="${focusField}"]:checked`);
        if (selected && typeof selected.focus === 'function') selected.focus({ preventScroll: true });
        else if (focusTitle !== false) {
          const title = element.querySelector('.cap-head h1');
          if (title && typeof title.focus === 'function') title.focus({ preventScroll: true });
        }
      }
    }
    function showErrors(errors) {
      const box = element.querySelector('.cap-errors');
      if (!box) return;
      box.innerHTML = errors.map((item, index) => `<p id="cap-error-${index}">${esc(item.message)}</p>`).join('');
      errors.forEach((item, index) => {
        const controls = element.querySelectorAll(`[name="${item.field}"]`);
        Array.from(controls).forEach(control => { control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-describedby', `cap-error-${index}`); });
      });
      const first = errors[0] && element.querySelector(`[name="${errors[0].field}"]`);
      if (first && typeof first.focus === 'function') first.focus();
    }
    function setHistory(push) {
      if (!root.history || !root.location) return;
      const url = `${root.location.pathname || ''}${root.location.search || ''}#capability`;
      try {
        root.history[push ? 'pushState' : 'replaceState']({ move28Capability: true, step }, '', url);
        if (push) ownsHistoryEntry = true;
      } catch (_error) {}
    }
    function releaseHistory() {
      if (!root.history || !root.location || root.location.hash !== '#capability') return;
      if (ownsHistoryEntry && typeof root.history.back === 'function') {
        ownsHistoryEntry = false; suppressNextPop = true;
        try { root.history.back(); return; } catch (_error) { suppressNextPop = false; }
      }
      try { root.history.replaceState(null, '', `${root.location.pathname || ''}${root.location.search || ''}`); } catch (_error) {}
    }
    function setField(field, value) {
      if (!PROFILE_FIELDS.includes(field)) return false;
      if (typeof value === 'string' && ENUMS[field].includes(value)) answers[field] = value;
      else delete answers[field];
      resultMessage = '';
      saveDraft();
      if (isOpen) render(false, field);
      return getState();
    }
    function next() {
      if (finished) { close(); return true; }
      const validation = validateStep(STEPS[step].id, answers);
      if (!validation.ok) { showErrors(validation.errors); return false; }
      if (step < STEPS.length - 1) { step += 1; saveDraft(); setHistory(false); render(); return true; }
      const profile = buildProfile(answers);
      if (!profile) return false;
      try {
        const completion = onComplete(profile);
        clearDraft(); finished = true;
        resultMessage = completion && typeof completion.message === 'string' ? completion.message : '能力档案已保存到本机。';
        render(); releaseHistory(); return true;
      } catch (error) {
        saveDraft();
        resultMessage = error && error.name === 'StorageError'
          ? '本机保存失败。请检查浏览器存储权限后重试；当前答案仍保留在本页。'
          : '暂时无法保存，请稍后重试；当前答案仍保留在本页。';
        render(); return false;
      }
    }
    function goTo(index, fromHistory) {
      const target = Number(index);
      if (!Number.isInteger(target)) return false;
      step = Math.max(0, Math.min(STEPS.length - 1, target)); resultMessage = ''; saveDraft();
      if (!fromHistory) setHistory(false); render(); return true;
    }
    function back() {
      if (step === 0) { close(); return true; }
      step -= 1; saveDraft(); setHistory(false); render(); return true;
    }
    function open() {
      if (isOpen) return false;
      previousFocus = root.document && root.document.activeElement ? root.document.activeElement : null;
      isOpen = true; finished = false; resultMessage = '';
      const currentRoute = Boolean(root.location && root.location.hash === '#capability');
      ownsHistoryEntry = Boolean(currentRoute && root.history && root.history.state && root.history.state.move28Capability);
      setHistory(!currentRoute); render();
      if (root.document && root.document.body) root.document.body.classList.add('capability-open');
      return true;
    }
    function close(fromPop) {
      if (!isOpen) return false;
      if (!finished) saveDraft();
      isOpen = false; render();
      if (root.document && root.document.body) root.document.body.classList.remove('capability-open');
      if (!fromPop) releaseHistory();
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected !== false) previousFocus.focus();
      previousFocus = null;
      if (!finished) onCancel(getState());
      return true;
    }
    function onClick(event) {
      if (event.target.closest('[data-cap-cancel]')) { close(); return; }
      if (event.target.closest('[data-cap-next]')) { next(); return; }
      if (event.target.closest('[data-cap-back]')) back();
    }
    function onChange(event) { if (event.target && event.target.name) setField(event.target.name, event.target.value); }
    function onKeyDown(event) {
      if (!isOpen) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(element.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (root.document.activeElement === first || !element.contains(root.document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    function onPopState(event) {
      if (suppressNextPop) { suppressNextPop = false; return; }
      if (root.location && root.location.hash === '#capability') {
        if (!isOpen) { isOpen = true; if (root.document && root.document.body) root.document.body.classList.add('capability-open'); }
        goTo(event.state && event.state.move28Capability ? event.state.step : step, true);
      } else if (isOpen && step > 0 && !finished) {
        ownsHistoryEntry = false; step -= 1; saveDraft(); setHistory(true); render();
      } else if (isOpen) { ownsHistoryEntry = false; close(true); }
    }
    function getState() { return { step, answers: sanitizeAnswers(answers), isOpen, finished, resultMessage }; }
    function destroy() {
      element.removeEventListener('click', onClick); element.removeEventListener('change', onChange); element.removeEventListener('keydown', onKeyDown);
      if (root.removeEventListener) root.removeEventListener('popstate', onPopState);
      if (isOpen && root.document && root.document.body) root.document.body.classList.remove('capability-open');
      releaseHistory(); isOpen = false; element.classList.remove('open'); element.setAttribute('aria-hidden', 'true'); element.innerHTML = '';
      if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected !== false) previousFocus.focus();
    }

    element.addEventListener('click', onClick); element.addEventListener('change', onChange); element.addEventListener('keydown', onKeyDown);
    if (root.addEventListener) root.addEventListener('popstate', onPopState);
    render();
    if (root.location && root.location.hash === '#capability') open();
    return Object.freeze({ open, close, next, back, goTo, getState, setField, destroy });
  }

  return Object.freeze({ createCapabilityAssessment, sanitizeAnswers, validateStep, buildProfile, STEPS, PROFILE_FIELDS, ENUMS, DRAFT_KEY });
});
