# MOVE 28 解释与受控适配实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在不改变确定性计划、安全门和人工复核边界的前提下，增加可信计划解释、当日条件受控适配、训练反馈和安全顺延。

**Architecture:** 新决策逻辑放在纯 domain 模块中，以有限枚举输入和深冻结输出表达；UI 只渲染可信结果。任何动作或剂量变化都必须经过现有 matcher、catalog provenance、plan validator 和 revision 绑定，疼痛始终进入停止或复核路径。当日建议不静默覆盖已批准计划，后续需要持久化时使用显式来源边和原子写入。

**Tech Stack:** Static classic JavaScript, CommonJS-compatible modules, Node test runner, Playwright, localStorage, GitHub Pages.

---

## 总体验收原则

- 保持 `file://`、HTTP、断网和 GitHub Pages 兼容；不引入构建步骤和运行时网络依赖。
- 不新增自由文本进入处方引擎。
- 不读取或显示原始健康问卷答案。
- 不使用性别作为计划或动作代理。
- 疼痛、急性症状和医生限制不能被普通适配绕过。
- 新的计划差异必须具有稳定原因码和用户可理解的解释。
- 每个代码任务执行 RED → GREEN → REFACTOR，并经过独立规格与质量/安全复审。

## Task 1：可信计划解释层

**Objective:** 在已批准计划的“今天”卡片中解释训练场景、起步策略、周结构和能力约束，不回显原始问卷或自由文本。

**Files:**

- Create: `src/domain/plan-explanation.js`
- Modify: `index.html`
- Modify: `src/ui/dashboard.js`
- Modify: `assets/css/generated-plan.css`
- Test: `tests/unit/plan-explanation.test.cjs`
- Test: `tests/unit/module-loading.test.cjs`
- Test: `tests/e2e/generated-plan.spec.cjs`
- Test: `tests/e2e/offline-file.spec.cjs`

**Public contract:**

```js
buildPlanExplanation({ plan, capabilityResult, capabilityRevision })
```

Successful output uses a finite schema:

```js
{
  version: 'plan-explanation.v1',
  strategy: 'standard_start' | 'conservative_start',
  setting: 'home' | 'gym',
  weeklySessionRange: { min: 1..7, max: 1..7 },
  durationRange: { min: integer, max: integer },
  reasonCodes: ['...'],
  reasonLabels: ['受控中文文案'],
  validationResult: 'passed'
}
```

Failure returns one fixed shape without partial explanation:

```js
{ version: 'plan-explanation.v1', validationResult: 'failed' }
```

**Step 1: Write failing pure-function tests**

Cover:

- normal and conservative valid plans;
- controlled reason-code-to-label mapping;
- home/gym and duration/session summaries;
- exact output keys and deep freeze;
- unknown reason code, plan/revision mismatch, invalid plan shape;
- getter, nested accessor, Proxy, sparse array and dangerous key with zero getter execution;
- absence of raw intake, health answers, review metadata and arbitrary plan strings.

Run:

```bash
node --test tests/unit/plan-explanation.test.cjs
```

Expected: FAIL because module/API does not exist.

**Step 2: Implement minimal pure domain module**

- Capture required native intrinsics at module load.
- Canonicalize only own data properties.
- Accept only active normal/conservative capability context with positive matching revision.
- Derive setting, week-1 session count and duration range from validated finite plan fields.
- Map only recognized capability reason codes to fixed Chinese labels.
- Deep-freeze output.
- Export CommonJS and attach to `Move28.domain` in classic-script mode.

**Step 3: Run focused unit tests**

```bash
node --test tests/unit/plan-explanation.test.cjs tests/unit/module-loading.test.cjs
```

Expected: PASS.

**Step 4: Integrate with trusted dashboard context**

- Load `plan-explanation.js` after plan generation/validation modules and before storage/UI.
- `dashboard.js` binds the trusted explanation builder at module initialization.
- `storedGeneratedContext()` builds explanation only after the active plan passes existing review and validator checks.
- Render a compact “为什么这样安排” panel inside generated Today view.
- If explanation fails, fail closed by withholding the explanation panel; do not invalidate an otherwise valid approved plan.
- Escape every rendered label.

**Step 5: Add browser and offline tests**

Verify:

- approved normal/conservative plan displays finite explanation;
- pending, blocked, stale and demo modes do not display personalized explanation;
- raw health answers and raw capability enum values do not appear in DOM;
- desktop/mobile geometry and `file://` script manifest remain valid.

Run:

```bash
npx playwright test tests/e2e/generated-plan.spec.cjs tests/e2e/offline-file.spec.cjs --workers=1
```

Expected: PASS.

**Step 6: Review and commit**

- Independent specification review.
- Independent quality/security review.
- Run `npm run test`, full Playwright, `node --check`, resource audit and `git diff --check`.
- Commit only after both reviews approve.

## Task 2：当日条件有限输入与路由

**Objective:** 建立“今天条件变了”的纯决策层，先区分可适配条件和必须停止/复核的条件，不立即修改计划。

**Files:**

- Create: `src/domain/session-readiness.js`
- Modify: `index.html`
- Test: `tests/unit/session-readiness.test.cjs`
- Test: `tests/unit/module-loading.test.cjs`

**Finite input:**

```js
{
  time: 'full' | '20_min' | '15_min',
  equipment: 'unchanged' | 'bodyweight_only',
  space: 'normal' | 'limited',
  noise: 'normal' | 'quiet_only',
  energy: 'normal' | 'low',
  symptom: 'none' | 'pain' | 'warning'
}
```

**Finite result:**

- `keep_session`
- `adapt_candidate`
- `manual_review`
- `stop`

**Hard rules:**

- `warning` → `stop`；
- `pain` → 至少 `manual_review`，不得生成普通替换；
- unknown/missing/hostile input → fixed fail-closed result；
- 该模块只路由，不自行生成动作或剂量。

**Verification:** focused unit tests plus hostile-input probes.

**Architecture gate:** Task 2 只负责路由。它不得改写 `state.plan.weeks`、生成 weekly lineage，或把 matcher 结果直接送进跟练页。疼痛固定进入安全阻断；当前缺少审核数据的时间、低精力、空间和噪声条件固定返回 `unavailable`。

## Task 3：受控动作与器械适配候选

**Objective:** 先只为器械变化生成可审计的单次执行清单；保持已批准四周计划字节不变，并由独立执行校验器证明安全。

**Files:**

- Create: `src/domain/session-adaptation.js`
- Create: `src/domain/daily-execution-validator.js`
- Modify: `src/domain/movement-matcher.js` only if existing public contract cannot express required alternatives
- Modify: `src/domain/plan-validator.js` only if session-level candidate needs a shared validated wrapper
- Test: `tests/unit/session-adaptation.test.cjs`
- Test: `tests/unit/plan-validator.test.cjs`

**Rules:**

- 输出 `DailyExecutionManifest`，至少绑定 source plan/session、intake/capability revision、plan/policy version、固定原因码、逐项 diff、器械快照和批准状态；
- 每次适配先重新加载并验证 active、已批准的源四周计划，再精确定位源 session；
- 保持 session intent、pattern、phase 和动作数量；
- 只使用 trusted approved catalog；
- 只使用用户当前可用器械；
- 维持 capability exclusions、difficulty cap；替换动作必须重新推导 variant，不能继承旧动作 variant；
- 只改变一个变量；
- 全节原子成功或失败，不返回部分候选；
- 不修改 `state.plan.weeks`，不创建 weekly lineage；
- 15/20 分钟、低精力模式在有经过审核的耗时模型和减量顺序前返回不可适配；
- quiet/space 模式只有目录存在明确审核标签时才开放，否则返回不可适配。

## Task 4：当日适配 UI 与显式确认

**Objective:** 在开始训练前显示有限条件选择、适配理由和确认结果，未经确认不替换当前 session。

**Files:**

- Create: `src/ui/session-readiness.js`
- Modify: `index.html`
- Modify: `src/ui/dashboard.js`
- Modify: `src/ui/workout-guide.js`
- Modify: `assets/css/generated-plan.css`
- Test: `tests/e2e/session-readiness.spec.cjs`
- Test: `tests/e2e/runtime-stop.spec.cjs`

**Rules:**

- 默认保持原计划；
- 疼痛/警示不显示“继续训练”；
- 确认前展示原 session、候选 session 和变化原因；
- 适配记录绑定 plan、session、capability revision 和原因码；
- 跟练入口必须通过 `adaptationId` 重新加载并验证执行清单，不能放宽现有 session 相等检查；
- 完成记录绑定 `planId + sourceSessionId + adaptationId`；
- 刷新后不能把未确认候选当成正式训练；
- 当日适配不改变长期 intake 偏好。

## Task 5：训练后反馈闭环

**Objective:** 用普通用户能回答的四类反馈影响周复盘，不引入伪精确恢复分数。

**Files:**

- Modify: `src/ui/workout-guide.js`
- Modify: `src/ui/weekly-review.js`
- Modify: `src/domain/weekly-adaptation.js`
- Modify: `src/storage/local-store.js`
- Test: `tests/unit/weekly-adaptation.test.cjs`
- Test: `tests/unit/weekly-storage.test.cjs`
- Test: `tests/e2e/weekly-review.spec.cjs`

**Feedback:**

- `too_easy`
- `appropriate`
- `too_hard`
- `pain`

**Rules:**

- 反馈绑定 session/plan/capability revision；
- 疼痛立即触发 rescreen；
- 单次过轻不自动进阶；
- 过重、低恢复优先减量；
- 不展示恢复百分比。

## Task 6：安全顺延

**Objective:** 允许错过训练后安全移动到下一个可用日，但不叠加训练或压缩恢复。

**Files:**

- Create: `src/domain/schedule-shift.js`
- Modify: `src/storage/local-store.js`
- Modify: `src/ui/dashboard.js`
- Test: `tests/unit/schedule-shift.test.cjs`
- Test: `tests/e2e/generated-plan.spec.cjs`

**Rules:**

- 只能在当前周或明确允许的窗口移动；
- 不允许同日两节力量；
- 保持跨周恢复边界；
- 第4周结束后不创建第5周；
- 移动结果需要重新验证和人工复核，或仅作为显示日历而不改变处方，具体在设计审查时二选一。

## Task 7：横屏/大屏与完成摘要

**Objective:** 提升跟练可读性和训练结束反馈，不改变处方。

**Files:**

- Modify: `assets/css/app.css`
- Modify: `assets/css/generated-plan.css`
- Modify: `src/ui/workout-guide.js`
- Test: `tests/e2e/generated-plan.spec.cjs`

**Acceptance:**

- 390×844、844×390、1280×800 均无横向溢出；
- 横屏动作、剂量、停止提示和主按钮均可见；
- 完成页展示本节完成动作、实际时长和下一次训练，不展示虚假消耗热量。

## 发布门

每个 Task 独立满足：

1. focused unit/E2E 通过；
2. `npm run test` 通过；
3. 完整 Playwright 通过；
4. `file://` 解压包回归通过；
5. 隐私导出仍不含原始健康答案；
6. 独立规格 PASS；
7. 独立质量/安全 APPROVED；
8. 提交、推送、Pages 构建和真实 HTTPS 桌面/移动验证。
