'use strict';

const {test,expect}=require('@playwright/test');
const {resetHttp,completeOnboarding,approvePendingPlan,completeGuideActions}=require('./helpers/pilot-flow.cjs');

const SAFE_READINESS=Object.freeze({time:'full',equipment:'unchanged',space:'normal',noise:'normal',energy:'normal',symptom:'none'});

async function setup(page){
  await resetHttp(page);
  await completeOnboarding(page,{daysPerWeek:'3',weekdays:['mon','wed','fri']});
  await page.getByRole('button',{name:'完成，返回首页'}).click();
  await approvePendingPlan(page);
}

async function openReadiness(page){
  await page.getByRole('button',{name:'开始今天训练'}).click();
  await expect(page.locator('#sessionReadinessView')).toHaveAttribute('aria-hidden','false');
  await expect(page.getByRole('heading',{name:'开始前确认今天的条件'})).toBeVisible();
}

async function selectCardio(page){
  await page.locator('#weekView .day-card.cardio').getByRole('button',{name:'查看此节'}).click();
  await expect(page.locator('#todayCard h3')).toHaveText('低冲击有氧');
}

async function selectReadiness(page,overrides={}){
  const answers={...SAFE_READINESS,...overrides};
  for(const [field,value] of Object.entries(answers))await page.locator(`select[name=${field}]`).selectOption(value);
}

async function previewBodyweight(page){
  await selectCardio(page);
  await openReadiness(page);
  await selectReadiness(page,{equipment:'bodyweight_only'});
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await expect(page.locator('.readiness-comparison')).toBeVisible();
}

async function setupWithMalformedStorageResult(page,method){
  await page.addInitScript(target=>{
    const shell={};
    Object.defineProperty(shell,'storage',{configurable:true,set(api){
      const wrapped={...api,[target]:()=>undefined};
      Object.defineProperty(shell,'storage',{value:Object.freeze(wrapped),writable:true,configurable:true});
    }});
    globalThis.Move28=shell;
  },method);
  await setup(page);
}

test.beforeEach(async({page})=>setup(page));

test('六项默认均为显式请选择，未回答提交固定阻断并聚焦首项',async({page})=>{
  await openReadiness(page);
  const fields=['time','equipment','space','noise','energy','symptom'];
  for(const field of fields){
    const select=page.locator(`select[name=${field}]`);
    await expect(select).toHaveValue('');
    await expect(select.locator('option:checked')).toHaveText('请选择');
  }
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await expect(page.getByRole('heading',{name:'请先完成全部 6 项选择'})).toBeVisible();
  await expect(page.locator('select[name=time]')).toBeFocused();
  await expect(page.locator('.readiness-result button')).toHaveCount(0);
  await expect(page.locator('.readiness-comparison')).toHaveCount(0);
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await page.locator('select[name=time]').selectOption('full');
  await page.locator('select[name=equipment]').selectOption('unchanged');
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await expect(page.getByRole('heading',{name:'请先完成全部 6 项选择'})).toBeVisible();
  await expect(page.locator('select[name=space]')).toBeFocused();
  await expect(page.locator('.readiness-result button')).toHaveCount(0);
  await page.evaluate(()=>{
    const select=document.querySelector('select[name=time]'),option=document.createElement('option');
    option.value='RAW_SECRET_EXCEPTION';option.textContent='未知选项';select.append(option);select.value=option.value;
  });
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await expect(page.getByRole('heading',{name:'请先完成全部 6 项选择'})).toBeVisible();
  await expect(page.locator('.readiness-result')).not.toContainText('RAW_SECRET_EXCEPTION');
});

test('键盘主动完成六项后保持原路线，刷新重开恢复六项空值',async({page})=>{
  await openReadiness(page);
  const expected=Object.entries(SAFE_READINESS);
  for(const [field,value] of expected){
    await expect(page.locator(`select[name=${field}]`)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(`select[name=${field}]`)).toHaveValue(value);
    await page.keyboard.press('Tab');
  }
  await expect(page.getByRole('button',{name:'检查今天状态'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.readiness-result')).toContainText('今天可以按原计划进行');
  await page.getByRole('button',{name:'按原计划继续'}).click();
  await expect(page.locator('#sessionReadinessView')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  await page.reload();
  await openReadiness(page);
  for(const [field] of expected)await expect(page.locator(`select[name=${field}]`)).toHaveValue('');
  await expect(page.getByRole('button',{name:'按原计划继续'})).toHaveCount(0);
});

test('警示、疼痛和不可用路由都不显示任何继续训练入口',async({page})=>{
  const cases=[
    ['身体信号','warning','出现警示信号，请停止训练'],
    ['身体信号','pain','今天需要人工确认'],
    ['可用时间','20_min','当前条件暂不支持安全适配']
  ];
  for(const [label,value,message] of cases){
    await openReadiness(page);
    await selectReadiness(page);
    await page.getByLabel(label).selectOption(value);
    await page.getByRole('button',{name:'检查今天状态'}).click();
    await expect(page.locator('.readiness-result')).toContainText(message);
    await expect(page.getByRole('button',{name:/按原计划继续|确认本次适配|开始适配训练/})).toHaveCount(0);
    await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
    await page.getByRole('button',{name:'关闭今天状态确认'}).click();
  }
});

test('调整方案先预览原session与本次调整及有限理由，确认前不进入跟练',async({page})=>{
  await previewBodyweight(page);
  await expect(page.locator('.readiness-comparison')).toContainText('原计划');
  await expect(page.locator('.readiness-comparison')).toContainText('本次调整');
  await expect(page.locator('.readiness-comparison')).toContainText('器械改为已确认可用的徒手支持条件');
  await expect(page.locator('.readiness-support')).toContainText('稳固椅子');
  await expect(page.locator('.readiness-support')).toContainText('运动垫');
  await expect(page.locator('.readiness-support')).toContainText('墙面');
  await expect(page.locator('.readiness-support')).toContainText('平地步行路线');
  await expect(page.locator('#sessionReadinessView textarea')).toHaveCount(0);
  await expect(page.locator('#sessionReadinessView')).not.toContainText('chestSymptoms');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:'确认本次适配'})).toBeVisible();
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('确认会重载当前存储并在revision变化时重新路由、提案和独立校验后阻断',async({page})=>{
  await previewBodyweight(page);
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    state.capabilityRevision+=1;
    localStorage.setItem('move28-pilot-v1',JSON.stringify(state));
  });
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await expect(page.locator('.readiness-result')).toContainText('当前计划或能力档案已经变化');
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('button',{name:/按原计划继续|开始适配训练/})).toHaveCount(0);
});

test('刷新丢弃未确认调整，不能把预览当成正式适配',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  expect(adaptationId).toMatch(/^daily\./);
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  await page.reload();
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#sessionReadinessView')).toHaveAttribute('aria-hidden','true');
});

test('已确认适配只能经adaptationId可信加载，完成绑定且不持久化manifest或健康数据',async({page})=>{
  const before=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));return{plan:JSON.stringify(state.plan),intake:JSON.stringify(state.intake)}});
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  const loaded=await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId);
  expect(loaded.adaptationId).toBe(adaptationId);
  expect(loaded.sourceSessionId).toBe(loaded.session.id);
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  await completeGuideActions(page);
  await expect(page.getByRole('heading',{name:'这节训练感觉如何？'})).toBeVisible();
  const summary=page.locator('.guide-completion');await expect(summary).toBeVisible();await expect(summary).toContainText(`完成动作${actionCount} 项`);await expect(summary).toContainText('下一次训练');
  await page.getByRole('button',{name:'刚刚好'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('move28-pilot-v1')));
  const record=Object.values(stored.logs).find(item=>item.adaptationId===adaptationId);
  expect(Object.keys(record)).toEqual(['planId','sessionId','adaptationId','status','completedAt','capabilityRevision','feedbackCode','feedbackAt']);
  expect(record.planId).toBe(loaded.planId);
  expect(record.sessionId).toBe(loaded.sourceSessionId);
  expect(record.status).toBe('completed');
  expect(record.capabilityRevision).toBe(stored.capabilityRevision);
  expect(record.feedbackCode).toBe('appropriate');
  expect(record.feedbackAt).toMatch(/Z$/);
  expect(record).not.toHaveProperty('manifest');
  expect(JSON.stringify(record)).not.toContain('equipmentSnapshot');
  expect(JSON.stringify(stored.plan)).toBe(before.plan);
  expect(JSON.stringify(stored.intake)).toBe(before.intake);
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('适配授权在普通退出后立即撤销且不能复用',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.locator('.guide-close').click();
  await page.getByRole('button',{name:'确认普通退出'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  expect(await page.evaluate(id=>Move28.guide.openWorkout({adaptationId:id,catalog:Move28.data.exerciseCatalog}),adaptationId)).toBe(false);
});

test('适配授权在安全停止成功保存后撤销',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/胸部不适或压迫感/}).click();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'训练已安全停止'})).toBeVisible();
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('公共适配入口不能用自定义回调绕过完成持久化和授权撤销',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.evaluate(()=>{
    window.__move28TrustedOpenWorkout=Move28.guide.openWorkout;
    Move28.guide.openWorkout=({adaptationId:id})=>{window.__move28CapturedAdaptationId=id;return true};
  });
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  expect(await page.evaluate(()=>window.__move28CapturedAdaptationId)).toBe(adaptationId);
  expect(await page.evaluate(id=>{
    Move28.guide.openWorkout=window.__move28TrustedOpenWorkout;
    return Move28.guide.openWorkout({adaptationId:id,catalog:Move28.data.exerciseCatalog,onComplete:()=>{throw new Error('caller completion failed')},onStop:()=>true});
  },adaptationId)).toBe(true);
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  await completeGuideActions(page);
  const result=await page.evaluate(id=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    return{record:Object.values(state.logs).find(item=>item.adaptationId===id)||null,authorized:Move28.sessionReadiness.loadConfirmedAdaptation(id)};
  },adaptationId);
  expect(result.record).toMatchObject({adaptationId,status:'completed'});
  expect(result.authorized).toBeNull();
});

test('公共适配入口不能用自定义回调绕过严重停止持久化',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.evaluate(()=>{
    window.__move28TrustedOpenWorkout=Move28.guide.openWorkout;
    Move28.guide.openWorkout=({adaptationId:id})=>{window.__move28CapturedAdaptationId=id;return true};
  });
  await page.getByRole('button',{name:'确认本次适配'}).click();
  expect(await page.evaluate(id=>{
    Move28.guide.openWorkout=window.__move28TrustedOpenWorkout;
    return Move28.guide.openWorkout({adaptationId:id,catalog:Move28.data.exerciseCatalog,onComplete:()=>true,onStop:()=>{throw new Error('caller stop failed')}});
  },adaptationId)).toBe(true);
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/胸部不适或压迫感/}).click();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'训练已安全停止'})).toBeVisible();
  const result=await page.evaluate(id=>{
    const state=JSON.parse(localStorage.getItem('move28-pilot-v1'));
    return{planStatus:state.plan.status,safetyLogs:Object.values(state.logs).filter(item=>item.status==='safety_stopped').length,authorized:Move28.sessionReadiness.loadConfirmedAdaptation(id)};
  },adaptationId);
  expect(result).toEqual({planStatus:'stale',safetyLogs:1,authorized:null});
});

test('适配安全停止保存失败仍撤销授权并保持可重试',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/胸部不适或压迫感/}).click();
  await page.evaluate(()=>{window.__move28OriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('blocked')}});
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'停止记录尚未保存'})).toBeVisible();
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
  await page.evaluate(()=>{Storage.prototype.setItem=window.__move28OriginalSetItem;delete window.__move28OriginalSetItem});
  await page.getByRole('button',{name:'重试保存'}).click();
  await expect(page.getByRole('heading',{name:'训练已安全停止'})).toBeVisible();
});

test('适配训练启动抛异常时关闭授权且不开放跟练',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.evaluate(()=>{Move28.guide.openWorkout=()=>{throw new Error('blocked')}});
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('安全停止流程不依赖模块加载后的数组迭代器',async({page})=>{
  await openReadiness(page);
  await selectReadiness(page);
  await page.getByRole('button',{name:'检查今天状态'}).click();
  await page.getByRole('button',{name:'按原计划继续'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const result=await page.evaluate(()=>{
    const original=Array.prototype[Symbol.iterator];let calls=0;
    Array.prototype[Symbol.iterator]=()=>{calls+=1;throw new Error('TAMPERED_ITERATOR')};
    try{
      const opened=Move28.requestSafetyStop();
      const options=document.querySelector('#guideBody').textContent;
      const selected=Move28.selectSafetyReason('chest_pain_or_pressure');
      const confirmation=document.querySelector('#guideBody').textContent;
      return{opened,selected,calls,hasOption:options.includes('胸部不适或压迫感'),hasConfirmation:confirmation.includes('确认因不适停止')};
    }finally{Array.prototype[Symbol.iterator]=original}
  });
  expect(result).toEqual({opened:true,selected:true,calls:0,hasOption:true,hasConfirmation:true});
});

test('适配完成保存失败后保留授权且重试只写一条完成记录',async({page})=>{
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  await page.evaluate(()=>{window.__move28OriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('blocked')}});
  await completeGuideActions(page);
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#toast')).toContainText('完成记录保存失败');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).not.toBeNull();
  await page.evaluate(()=>{Storage.prototype.setItem=window.__move28OriginalSetItem;delete window.__move28OriginalSetItem});
  await page.locator('#guideNext').click();
  await expect(page.getByRole('heading',{name:'这节训练感觉如何？'})).toBeVisible();
  await page.getByRole('button',{name:'刚刚好'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const records=await page.evaluate(id=>Object.values(JSON.parse(localStorage.getItem('move28-pilot-v1')).logs).filter(item=>item.adaptationId===id),adaptationId);
  expect(records).toHaveLength(1);expect(records[0].feedbackCode).toBe('appropriate');
});

test('适配完成依赖返回畸形状态时不得伪称保存成功',async({page})=>{
  await setupWithMalformedStorageResult(page,'recordWorkoutCompletion');
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  await completeGuideActions(page);
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#toast')).toContainText('完成记录保存失败');
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).not.toBeNull();
});

test('适配停止依赖返回畸形状态时不得进入安全停止成功页',async({page})=>{
  await setupWithMalformedStorageResult(page,'recordWorkoutStop');
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  await page.getByRole('button',{name:'暂停 / 停止训练'}).click();
  await page.getByRole('button',{name:/胸部不适或压迫感/}).click();
  await page.getByRole('button',{name:'确认停止并保存'}).click();
  await expect(page.getByRole('heading',{name:'停止记录尚未保存'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'训练已安全停止'})).toHaveCount(0);
  expect(await page.evaluate(id=>Move28.sessionReadiness.loadConfirmedAdaptation(id),adaptationId)).toBeNull();
});

test('可信反馈依赖返回畸形状态时不得显示保存成功',async({page})=>{
  await setupWithMalformedStorageResult(page,'recordWorkoutFeedback');
  await previewBodyweight(page);
  const adaptationId=await page.locator('.readiness-comparison').getAttribute('data-adaptation-id');
  await page.getByRole('button',{name:'确认本次适配'}).click();
  await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  await completeGuideActions(page);
  await page.getByRole('button',{name:'刚刚好'}).click();
  await expect(page.getByRole('heading',{name:'这节训练感觉如何？'})).toBeVisible();
  await expect(page.getByText('反馈尚未保存，请检查本机存储后重试。')).toBeVisible();
  const record=await page.evaluate(id=>Object.values(JSON.parse(localStorage.getItem('move28-pilot-v1')).logs).find(item=>item.adaptationId===id),adaptationId);
  expect(record.status).toBe('completed');expect(record).not.toHaveProperty('feedbackCode');
});

test('反馈通知回调抛异常不逆转可信保存结果',async({page})=>{
  const opened=await page.evaluate(()=>{
    const persisted=Move28.storage.loadState(),session=persisted.plan.weeks[0].sessions[0];
    return Move28.guide.openWorkout({session,catalog:Move28.data.exerciseCatalog,
      onComplete:event=>Move28.storage.recordWorkoutCompletion({planId:persisted.plan.id,sessionId:event.sessionId}),
      onFeedback:()=>{throw new Error('notification failed')}});
  });
  expect(opened).toBe(true);await page.getByRole('button',{name:'开始本节',exact:true}).click();
  const actionCount=await page.evaluate(()=>Move28.state.guideSteps.length);
  await completeGuideActions(page);
  await page.getByRole('button',{name:'刚刚好'}).click();
  await expect(page.locator('#guideModal')).toHaveAttribute('aria-hidden','true');
  const record=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('move28-pilot-v1')).logs).find(item=>item.feedbackCode==='appropriate'));
  expect(record).toMatchObject({status:'completed',feedbackCode:'appropriate'});
});
