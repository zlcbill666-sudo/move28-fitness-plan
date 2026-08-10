# 今日训练工作台与人工复核状态时间线实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将 MOVE 28 已有可信状态重组为回访用户优先的“今日训练工作台”，并明确展示从问卷到人工复核再到训练的状态时间线。

**Architecture:** 不建立第二套业务状态，也不改变任何处方、持久化或审批规则。`src/app.js::contextFromState()` 在原有 `mode` 旁增加受控 `workflowStage` 展示字段；`src/ui/dashboard.js` 只消费该字段渲染时间线和页面外壳，训练入口继续仅由重新加载并校验后的 `generated` 模式开放。已批准用户通过 `body.app-mode-generated` 隐藏营销 Hero、指标栏和三步说明，直接进入今日卡；其他状态保留原始恢复入口。

**Tech Stack:** 经典 HTML/CSS/JavaScript、CommonJS 单测、Node test runner、Playwright、localStorage、GitHub Pages/file://。

---

## 不变约束

- 仍固定生成 4 周计划；不新增第 5 周。
- `pending_review` 绝不显示训练入口。
- 红旗、能力停止、训练安全停止、周复盘疼痛继续阻断。
- `workflowStage` 只用于展示，不能参与授权或绕过 `storedGeneratedContext()`。
- 不显示原始问卷答案、健康字段、热量、身体评分或恢复百分比。
- 不新增账号、后端、外部埋点、网络依赖或框架。
- HTTP、GitHub Pages 子路径和真实 `file://` 必须继续工作。

## 展示状态合同

| `mode` | `workflowStage` | 时间线当前状态 | 训练入口 |
|---|---|---|---|
| `demo` | `questionnaire` | 完成安全问卷 | 禁止 |
| `review` | `capability_required` | 完成能力校准 | 禁止 |
| `review` | `plan_required` | 计划需人工处理 | 禁止 |
| `review` | `human_review` | 等待人工一致性复核 | 禁止 |
| `blocked` | `risk_blocked` | 安全筛查阻断 | 禁止 |
| `blocked` | `capability_blocked` | 能力校准阻断 | 禁止 |
| `stale` | `rescreen_required` | 重新安全筛查 | 禁止 |
| `invalid` | `invalid` | 本机状态无法验证 | 禁止 |
| `generated` | `ready` | 今日训练可开始 | 允许，仍需训练前状态检查 |

## Task 1：锁定 workflowStage 状态合同

**Objective:** 用单测先锁定每种可信状态到展示阶段的确定性映射。

**Files:**
- Modify: `tests/unit/plan-view.test.cjs`
- Modify later: `src/app.js`

**Steps:**

1. 为未问卷、待能力校准、计划生成失败/缺失、待人工复核、风险阻断、能力阻断、计划失效、非法状态和有效批准计划分别增加 `workflowStage` 断言。
2. 增加 hostile accessor、Proxy、额外字段和 revision 错配用例，确保新字段不会触发 getter，也不会将不可信状态标成 `ready`。
3. 运行：
   ```bash
   npm test -- tests/unit/plan-view.test.cjs
   ```
   预期：新断言先失败，原因是 `workflowStage` 尚未实现。
4. 在 `src/app.js::contextFromState()` 的每个现有返回分支加入固定枚举；不改变原有 `mode`、`plan`、`logs` 和 `message` 语义。
5. 重跑同一测试，预期通过。

## Task 2：锁定今日工作台 E2E 合同

**Objective:** 用浏览器测试定义首次访问、待复核和已批准回访体验。

**Files:**
- Create: `tests/e2e/today-workspace.spec.cjs`
- Reuse: `tests/e2e/helpers/pilot-flow.cjs`

**Steps:**

1. 测试首次访问：
   - Hero 和“生成我的4周计划”可见；
   - 时间线当前项为“安全问卷”；
   - 训练入口不存在；
   - 不写用户记录。
2. 测试待人工复核：
   - 时间线显示问卷、能力校准已完成，人工复核为当前项；
   - Hero 仍保留恢复/编辑入口；
   - 不存在训练入口和计划解释。
3. 测试已批准回访：
   - reload 后 `body.app-mode-generated` 存在；
   - Hero、指标栏、三步说明不占布局；
   - 今日 section 成为主内容首屏；
   - 今日卡显示周次、星期、训练类型、时长、动作数、地点、RPE、解释和唯一主 CTA“开始今天训练”；
   - 时间线显示“今日训练可开始”；
   - CTA 仍先打开训练前状态检查。
4. 测试 stale/blocked/invalid：
   - 显示对应中性状态文案；
   - 不泄漏风险字段/原始答案；
   - 不出现训练入口。
5. 测试 390×844 与 844×390：无横向溢出，时间线和主 CTA 可用；桌面 1280×800 层级清晰。
6. 运行：
   ```bash
   npx playwright test tests/e2e/today-workspace.spec.cjs
   ```
   预期：新测试先失败。

## Task 3：实现人工复核状态时间线

**Objective:** 在现有今日 section 内渲染只读、非授权型流程状态。

**Files:**
- Modify: `index.html`
- Modify: `src/ui/dashboard.js`
- Modify: `assets/css/generated-plan.css`
- Test: `tests/e2e/today-workspace.spec.cjs`

**Steps:**

1. 在 `#todayCard` 前增加：
   ```html
   <div id="workflowStatus" class="workflow-status" aria-live="polite"></div>
   ```
2. 在 `dashboard.js` 增加白名单：
   - `questionnaire`
   - `capability_required`
   - `plan_required`
   - `human_review`
   - `risk_blocked`
   - `capability_blocked`
   - `rescreen_required`
   - `invalid`
   - `ready`
3. `setPlanContext()` 对 `workflowStage` 使用自有数据描述符读取，并校验 `mode` 与阶段组合；非法组合统一降级 `invalid`。
4. 渲染四步时间线：安全问卷、能力校准、人工复核、今日训练。状态只允许 `done/current/locked/attention`。
5. 时间线文案仅使用固定字典和现有通用 `message`，不插入原始问卷数据。
6. 非 `generated` 模式不产生任何训练按钮。
7. 运行 E2E 和 `tests/unit/plan-view.test.cjs`，预期通过相应子集。

## Task 4：升级今日训练卡

**Objective:** 让已批准用户首屏一次回答“练什么、多久、多少动作、在哪练、强度多少、为什么”。

**Files:**
- Modify: `src/ui/dashboard.js`
- Modify: `assets/css/generated-plan.css`
- Test: `tests/e2e/today-workspace.spec.cjs`
- Update intentional selectors/copy: existing E2E specs that assert “开始本节训练”

**Steps:**

1. 从已重新校验的 `session` 固定字段计算：
   - `estimatedMinutes`；
   - `actions.length`；
   - `setting`；
   - 当前 action RPE 的最小–最大值；
   - 星期和周次。
2. 不根据身体状态推导任何新指标，不显示热量或恢复百分比。
3. 增加四格摘要：时长、动作数、地点、RPE。
4. 主 CTA 改为“开始今天训练”，仍调用 `openSessionReadiness(session.id)`。
5. 次级安全顺延与“为什么这样安排”保持原语义。
6. 更新仅因新文案而失效的 E2E 选择器，禁止放宽到模糊全页匹配。
7. 运行 generated-plan、session-readiness、full-pilot-flow 和新 E2E。

## Task 5：实现回访用户外壳与渐进披露

**Objective:** 已批准回访用户跳过营销内容，直接进入今日工作台，同时保留所有功能可达性。

**Files:**
- Modify: `src/ui/dashboard.js`
- Modify: `index.html`
- Modify: `assets/css/app.css`
- Modify: `assets/css/generated-plan.css`
- Test: `tests/e2e/today-workspace.spec.cjs`
- Test: `tests/e2e/offline-file.spec.cjs`

**Steps:**

1. `setPlanContext()` 只在重新验证成功的 generated 模式给 `<body>` 设置 `app-mode-generated`；其他模式移除。
2. CSS 在该类下隐藏 `.hero`、`.metric-rail`、`.beginner-strip`，不删除 DOM，以便状态变更后恢复。
3. 让 generated 模式的 `#today` 与 sticky topbar 保持安全间距，并保留四周计划、动作库、安全和隐私锚点。
4. 不新增前端路由、不改变 URL hash、不改脚本顺序。
5. 手机底栏本阶段保持现有可达入口；“今天/计划/进度/更多”完整导航延后到安全进度页阶段，避免空壳入口。
6. 验证从 generated 变成 stale/blocked 后 Hero 恢复，训练入口消失。

## Task 6：完整验证与双重审查

**Objective:** 证明视觉重组没有改变安全、隐私、持久化、离线或跟练合同。

**Files:**
- Modify if needed: `README.md`
- Verify all changed files

**Steps:**

1. 运行完整单测：
   ```bash
   npm test
   ```
2. 运行完整浏览器套件：
   ```bash
   npm run test:e2e
   ```
3. 运行真实 `file://`、HTTP、离线、390×844、844×390、1280×800 专项检查。
4. 检查控制台错误、页面异常、同源 4xx/5xx、请求失败、横向溢出和隐私外发。
5. 运行：
   ```bash
   git diff --check
   git status --short
   ```
6. 独立规格审查必须确认：
   - 所有 stage 映射正确；
   - pending/blocked/stale/invalid 无训练入口；
   - generated 仍经过原硬门和训练前状态检查；
   - 首次用户恢复入口未被隐藏；
   - 没有实现安全进度页、账号或云同步等范围外内容。
7. 规格通过后再做代码质量审查：
   - 不建立重复状态；
   - 不信任外部 context 字段；
   - 无 getter/Proxy/XSS 回归；
   - CSS 不依赖根路径；
   - 移动端与 `file://` 均可用。
8. 修复所有 Critical/Important 项并重复两道审查。

## 完成定义

- 新用户仍能完成问卷和能力校准。
- 待复核计划明确显示当前步骤且不能训练。
- 已批准回访用户打开页面即进入今日工作台。
- 今日卡只有一个主训练 CTA，并先经过 readiness 路由。
- 状态变 stale/blocked/invalid 后页面立即恢复 fail-closed 展示。
- 全量单测和 E2E 通过。
- HTTP、真实 `file://`、竖屏、横屏和桌面验证通过。
- 规格审查和代码质量审查均 APPROVED。
- 只生成本地提交/发布候选；推送、PR 和公开部署需用户确认。