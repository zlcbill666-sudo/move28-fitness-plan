# 智能健身计划两人试用版 Implementation Plan

> **For Hermes:** Use `subagent-driven-development` to implement this plan task-by-task. Each task must pass spec review and code-quality review before moving on.

**Goal:** 把现有固定28天静态计划改造成可离线运行、根据用户问卷生成4周入门计划的两人试用版，同时保留GIF单动作跟练、音乐和本地记录。

**Architecture:** 保持静态、零构建运行方式，避免破坏GitHub Pages和“双击 `index.html` 离线打开”。将当前单文件中的数据、纯规则和UI逐步拆为经典脚本；所有模块挂载到唯一的 `window.Move28` 命名空间，并同时提供 `module.exports` 供Node测试。核心生成链路为确定性问卷→风险分流→动作匹配→4周生成→校验→跟练；首试不连接外部AI。

**Tech Stack:** HTML5、CSS、原生JavaScript、Node >=20内置 `node:test`、`@playwright/test@1.62.1`、系统版Google Chrome、浏览器 `localStorage`、GitHub Pages、离线ZIP。

**Design source:** `docs/plans/2026-08-07-intelligent-fitness-pilot-design.md`

---

## 0. 实施原则

1. 在功能分支 `feature/intelligent-plan-pilot` 开发；两人试用完成前不替换当前公开页面。
2. 每项功能遵循 RED→GREEN→REFACTOR；不得先写实现再补测试。
3. 风险引擎和计划校验器是硬门槛，UI、解释模板或管理员不能绕过。
4. 首试通过离线ZIP交付给两名成年人；静态“邀请码”不能当作安全认证，因此第一版不伪造登录体系。
5. 原始健康问卷只在本地保存；测试必须断言不会进入URL、控制台、网络请求或第三方服务。
6. 任何新增动作必须有GIF、结构化剂量、禁忌标签、回退/进阶和审核状态。
7. 保留当前页面作为迁移基线；每次重构先跑行为特征测试。

## 1. 目标文件结构

```text
健身计划公开版/
├── index.html
├── README.md
├── 使用说明.txt
├── package.json
├── package-lock.json
├── playwright.config.cjs
├── .gitignore
├── assets/
│   ├── css/app.css
│   ├── audio/*.mp3
│   └── gifs/*.gif
├── src/
│   ├── namespace.js
│   ├── data/
│   │   ├── exercise-catalog.js
│   │   ├── legacy-demo-plan.js
│   │   └── tracker-fields.js
│   ├── domain/
│   │   ├── risk-engine.js
│   │   ├── movement-matcher.js
│   │   ├── plan-generator.js
│   │   ├── plan-validator.js
│   │   └── weekly-adaptation.js
│   ├── storage/
│   │   └── local-store.js
│   ├── ui/
│   │   ├── onboarding.js
│   │   ├── dashboard.js
│   │   ├── workout-guide.js
│   │   ├── weekly-review.js
│   │   └── privacy-tools.js
│   └── app.js
├── tests/
│   ├── fixtures/
│   │   ├── risk-cases.json
│   │   ├── generator-cases.json
│   │   └── invalid-plans.json
│   ├── helpers/load-script.cjs
│   ├── unit/*.test.cjs
│   └── e2e/*.spec.cjs
└── docs/
    ├── plans/*.md
    └── pilot/
        ├── reviewer-checklist.md
        ├── participant-guide.md
        └── issue-log-template.md
```

## 2. 模块约定

所有运行时代码使用同一轻量包装，既兼容浏览器经典脚本和 `file://`，也兼容Node单元测试：

```js
(function (root, factory) {
  const api = factory(root.Move28 || {});
  root.Move28 = Object.assign(root.Move28 || {}, api);
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, function (Move28) {
  'use strict';
  return { /* exported functions */ };
});
```

禁止创建多个全局变量；UI只能调用公开API，不能复制风险或生成规则。

---

### Task 1: 建立可重复测试基线

**Objective:** 引入零构建测试工具，并记录当前页面的关键行为，防止拆文件时回归。

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `playwright.config.cjs`
- Create: `.gitignore`
- Create: `tests/e2e/current-page.spec.cjs`

**Step 1: 创建测试脚本**

`package.json`：

```json
{
  "name": "move28-fitness-plan",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "node --test",
    "test:unit": "node --test",
    "test:e2e": "playwright test",
    "test:all": "npm test && npm run test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "1.62.1"
  }
}
```

> Windows Node 24 实测会将 `node --test tests/unit` 的目录参数当作模块路径并报错；这里使用 `node --test` 的默认测试发现，自动运行 `.test.cjs`，且不会运行 Playwright 的 `.spec.cjs`。

`playwright.config.cjs`：

```js
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:8765',
    browserName: 'chromium',
    channel: 'chrome',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } }
  ]
});
```

> `browserName: 'chromium'` 与 `channel: 'chrome'` 必须同时保留：测试固定启动机器上预先安装的系统Chrome，而不是Playwright随包下载的Chromium。开发机可复用已启动的本地服务器；CI设置环境变量后会创建独立服务器，避免连接到残留进程。

**Step 2: 写当前行为特征测试**

断言：全流程无console error、pageerror、同源HTTP错误或非预期资源失败；17个动作GIF存在；第1天跟练固定15步、13个动作步骤及精确标题顺序，首尾为说明页且完成后自动记录；四周各7天并可切换到第8～14天；安全区8张卡标题固定；关键CSS样式生效；关闭弹窗停止音乐；390×844无横向溢出；本地记录写入并可清除。仅允许忽略可解释的客户端媒体取消（例如切换音频产生的 `net::ERR_ABORTED`）。

**Step 3: 安装并运行**

Run: `npm install`

Run: `npm run test:e2e`

Expected: desktop和mobile项目全部PASS。

**Step 4: 提交**

```bash
git add package.json package-lock.json playwright.config.cjs .gitignore tests/e2e/current-page.spec.cjs
git commit -m "test: add browser regression baseline"
```

---

### Task 2: 无行为变化地拆分单文件

**Objective:** 将73KB的 `index.html` 拆成可维护文件，但保持当前公开版功能完全一致。

**Files:**
- Create: `assets/css/app.css`
- Create: `src/namespace.js`
- Create: `src/data/legacy-demo-plan.js`
- Create: `src/data/tracker-fields.js`
- Create: `src/ui/dashboard.js`
- Create: `src/ui/workout-guide.js`
- Create: `src/app.js`
- Modify: `index.html` around inline `<style>`, `const DATA`, render functions and final initialization
- Test: `tests/e2e/current-page.spec.cjs`

**Step 1: 运行Task 1测试并保存基线**

Run: `npm run test:e2e`

Expected: PASS before refactor.

**Step 2: 只移动代码，不改变量和值**

按依赖顺序在 `index.html` 末尾加载经典脚本：

```html
<script src="src/namespace.js"></script>
<script src="src/data/legacy-demo-plan.js"></script>
<script src="src/data/tracker-fields.js"></script>
<script src="src/ui/dashboard.js"></script>
<script src="src/ui/workout-guide.js"></script>
<script src="src/app.js"></script>
```

CSS改为：

```html
<link rel="stylesheet" href="assets/css/app.css">
```

**Step 3: 验证HTTP和离线打开**

Run: `npm run test:e2e`

另用Playwright访问 `file:///.../index.html`，断言首屏、GIF和跟练可用；音乐测试允许浏览器策略导致初始暂停，但控制按钮必须存在。

Expected: 与拆分前相同。

**Step 4: 提交**

```bash
git add index.html assets/css src tests/e2e/current-page.spec.cjs
git commit -m "refactor: split static app without behavior changes"
```

---

### Task 3: 建立动作库模型和不变量

**Objective:** 把现有17个动作转换为可审计动作库，并为居家动作扩展预留明确字段。

**Files:**
- Create: `src/data/exercise-catalog.js`
- Create: `tests/unit/exercise-catalog.test.cjs`
- Create: `tests/helpers/load-script.cjs`
- Modify: `src/data/legacy-demo-plan.js`

**Step 1: 写失败测试**

每个动作必须满足：

```js
{
  id: 'chest-press-machine',
  name: '推胸机',
  pattern: 'horizontal_push',
  settings: ['gym'],
  equipment: ['chest_press_machine'],
  difficulty: 1,
  dose: { sets: [1, 3], reps: [8, 15], rpe: [3, 7], restSec: [60, 120] },
  contraindications: [],
  regressionIds: ['wall-push-up'],
  progressionIds: [],
  gif: 'assets/gifs/07_推胸机.gif',
  reviewStatus: 'approved',
  cues: { setup: '', movement: '', breathing: '', pain: '' }
}
```

测试：ID唯一；GIF文件存在；`reviewStatus`仅允许 `draft/approved/retired`；剂量下限不大于上限；替代动作ID存在；生成器不得选择非approved动作。

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/exercise-catalog.test.cjs`

Expected: FAIL because catalog module does not exist.

**Step 3: 实现最小动作库并迁移17个动作**

先保持现有动作文案；没有依据的禁忌标签不要猜，标为 `draft` 并阻止生成，等待人工审核。

**Step 4: 运行测试**

Run: `npm test`

Expected: PASS。

**Step 5: 提交**

```bash
git add src/data/exercise-catalog.js src/data/legacy-demo-plan.js tests
git commit -m "feat: add validated exercise catalog"
```

---

### Task 4: 实现四级风险引擎

**Objective:** 用纯函数实现可测试、不可绕过的健康风险分流。

**Files:**
- Create: `src/domain/risk-engine.js`
- Create: `tests/fixtures/risk-cases.json`
- Create: `tests/unit/risk-engine.test.cjs`

**Public API:**

```js
evaluateRisk(intake) => {
  level: 'normal' | 'conservative' | 'manual_review' | 'stop',
  reasons: [{ code, field, message }],
  ruleVersion: 'pilot-v1'
}
```

**Step 1: 写不少于20个失败案例**

覆盖正常、长期不活动、轻度稳定疼痛、急性损伤、无法承重、胸部症状、活动时头晕、晕厥、静息气短、未恢复脑震荡、医生限制、不确定答案、16岁以下、16～17岁、孕产期、多项命中和修改答案。

核心断言：

```js
assert.equal(evaluateRisk({ chestSymptoms: 'yes' }).level, 'stop');
assert.equal(evaluateRisk({ age: 15 }).level, 'manual_review');
assert.equal(evaluateRisk({ age: 17, redFlags: false }).level, 'normal');
```

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/risk-engine.test.cjs`

Expected: FAIL because `evaluateRisk` is missing.

**Step 3: 实现优先级**

固定优先级：

```js
const PRIORITY = { normal: 0, conservative: 1, manual_review: 2, stop: 3 };
```

规则只返回结构化结果；禁止在UI中重复判断。

**Step 4: 运行测试并检查100%案例**

Run: `npm test`

Expected: all risk fixtures PASS；禁止自动生成案例的level不能低于预期。

**Step 5: 提交**

```bash
git add src/domain/risk-engine.js tests/fixtures/risk-cases.json tests/unit/risk-engine.test.cjs
git commit -m "feat: add deterministic risk routing"
```

---

### Task 5: 建立本地用户档案和版本化存储

**Objective:** 保存问卷、计划和训练记录，同时支持查看、失效和彻底删除。

**Files:**
- Create: `src/storage/local-store.js`
- Create: `tests/unit/local-store.test.cjs`

**Storage key:** `move28-pilot-v1`

**State shape:**

```js
{
  schemaVersion: 1,
  participantId: 'pilot-a',
  intake: {},
  intakeRevision: 1,
  risk: {},
  plan: null,
  logs: {},
  weeklyReviews: [],
  consent: { acceptedAt: null, version: 'pilot-v1' }
}
```

**Step 1: 写失败测试**

测试默认空状态、非法JSON恢复、保存/读取、问卷变更令旧计划失效、删除后所有键消失、迁移函数不会把健康值写到日志。

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/local-store.test.cjs`

Expected: FAIL。

**Step 3: 实现最小API**

```js
loadState();
saveIntake(intake);
savePlan(plan);
clearAll();
exportReviewSummary();
```

`saveIntake`必须递增 `intakeRevision`，并将旧计划标记为 `stale`。

**Step 4: 运行测试并提交**

Run: `npm test`

```bash
git add src/storage/local-store.js tests/unit/local-store.test.cjs
git commit -m "feat: add versioned local participant state"
```

---

### Task 6: 构建分屏问卷

**Objective:** 实现设计文档中的产品边界、基本信息、目标、经验、时间、器械、疼痛、安全、偏好和确认页面。

**Files:**
- Create: `src/ui/onboarding.js`
- Create: `tests/unit/intake-validation.test.cjs`
- Create: `tests/e2e/onboarding.spec.cjs`
- Modify: `index.html` add `#onboardingView`
- Modify: `assets/css/app.css`
- Modify: `src/app.js`

**Step 1: 写失败测试**

断言：一屏一个主题；安全问题逐项回答；关键“不确定”不可跳过；16岁以下进入特别处理；返回修改会重新计算风险；摘要不展示未填写的可选字段；无姓名、手机、身份证或精确生日字段。

**Step 2: 运行失败测试**

Run: `npm run test:all`

Expected: onboarding tests FAIL。

**Step 3: 实现最小问卷状态机**

```js
createOnboarding({ initialIntake, onComplete, onCancel });
validateStep(stepId, intake);
buildIntakeSummary(intake, risk);
```

用户确认前不生成计划。`stop`显示明确阻断页；`manual_review`显示待审核页；两者都不调用生成器。

**Step 4: 移动端验证**

Run: `npm run test:e2e -- --grep onboarding`

Expected: 390×844无横向滚动；主按钮可单手点击；浏览器返回/刷新不丢失已确认步骤。

**Step 5: 提交**

```bash
git add index.html assets/css/app.css src/ui/onboarding.js src/app.js tests
git commit -m "feat: add guided participant intake"
```

---

### Task 7: 实现动作模式匹配和有限场景替换

**Objective:** 先选择动作模式，再匹配健身房或居家动作；仅支持审核过的有限映射。

**Files:**
- Create: `src/domain/movement-matcher.js`
- Create: `tests/unit/movement-matcher.test.cjs`
- Modify: `src/data/exercise-catalog.js`
- Add later after asset review: `assets/gifs/19_弹力带划船.gif`
- Add later after asset review: `assets/gifs/20_靠墙髋铰链.gif`

**Public API:**

```js
matchExercise({ pattern, setting, equipment, exclusions, difficulty })
swapSessionSetting(session, targetSetting, catalog)
```

**Step 1: 写失败测试**

断言：同模式替换；排除禁忌；器械不足返回结构化错误；没有approved动作时不得回退到draft；健身房→居家切换不改变session intent。

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/movement-matcher.test.cjs`

Expected: FAIL。

**Step 3: 实现最小映射**

首版只支持：膝主导、后侧链、水平推、水平拉、核心稳定、低冲击有氧。不要实现任意动作推荐系统。

**Step 4: 资产审核门槛**

新增GIF必须人工确认动作内容、授权、文件名、尺寸、加载和文字提示；未审核前保持 `draft`，相关居家完整计划应返回“缺少已审核水平拉动作”。

**Step 5: 运行测试并提交**

```bash
npm test
git add src/domain/movement-matcher.js src/data/exercise-catalog.js tests/unit/movement-matcher.test.cjs assets/gifs
git commit -m "feat: add approved movement substitutions"
```

---

### Task 8: 实现4周计划生成器

**Objective:** 根据风险、可用天数、时长、经验和场景生成结构化4周计划。

**Files:**
- Create: `src/domain/plan-generator.js`
- Create: `tests/fixtures/generator-cases.json`
- Create: `tests/unit/plan-generator.test.cjs`

**Output shape:**

```js
{
  id: 'plan-...',
  schemaVersion: 1,
  ruleVersion: 'pilot-v1',
  intakeRevision: 1,
  riskLevel: 'normal',
  status: 'generated',
  assumptions: [],
  weeks: [{ number: 1, focus: '适应', sessions: [] }]
}
```

每个session包含 `intent`、`setting`、`estimatedMinutes` 和确定性 `actions`；每个action包含 `exerciseId`、sets/reps或duration、RPE、restSec和phase。

**Step 1: 写失败案例**

至少覆盖1/2/3/4+可用天数、20/30/45/60/75分钟、normal/conservative、健身房/居家、无关键器械、训练中断后回归。

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/plan-generator.test.cjs`

Expected: FAIL。

**Step 3: 实现最小周结构**

- 1天：1次全身＋步行建议；
- 2天：2次非连续全身；
- 3天：2次全身＋1次低冲击有氧；
- 4天以上：首周期最多3次结构化训练＋1次恢复。

四周依次为适应、重复小幅增加、条件渐进、巩固；每周只允许一个主要变量变化。

**Step 4: 运行测试并提交**

```bash
npm test
git add src/domain/plan-generator.js tests/fixtures/generator-cases.json tests/unit/plan-generator.test.cjs
git commit -m "feat: generate structured four-week plans"
```

---

### Task 9: 实现计划校验器硬门槛

**Objective:** 拒绝时长超限、禁忌动作、媒体缺失、恢复冲突和异常进阶计划。

**Files:**
- Create: `src/domain/plan-validator.js`
- Create: `tests/fixtures/invalid-plans.json`
- Create: `tests/unit/plan-validator.test.cjs`
- Modify: `src/domain/plan-generator.js`

**Public API:**

```js
validatePlan({ plan, intake, risk, catalog }) => {
  ok: boolean,
  errors: [{ code, path, message }]
}
```

**Step 1: 写失败测试**

每个不变量单独一个fixture：超时、非approved动作、GIF不存在、剂量越界、禁忌未过滤、连续力量日、替换模式不一致、conservative出现高RPE、同周多变量增加、空动作队列。

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/plan-validator.test.cjs`

Expected: FAIL。

**Step 3: 实现并强制接入生成器**

生成器返回前必须调用校验器；失败时返回：

```js
{ status: 'manual_review', plan: null, errors }
```

不得返回“带警告但仍可开始”的危险计划。

**Step 4: 运行所有单元测试**

Run: `npm test`

Expected: risk、catalog、matcher、generator和validator全部PASS。

**Step 5: 提交**

```bash
git add src/domain/plan-validator.js src/domain/plan-generator.js tests
git commit -m "feat: block invalid generated plans"
```

---

### Task 10: 将生成计划接入现有首页和单动作跟练

**Objective:** 用用户生成计划替代写死的 `DATA.days`，同时保留演示计划作为未开始问卷时的只读示例。

**Files:**
- Modify: `src/ui/dashboard.js`
- Modify: `src/ui/workout-guide.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Create: `tests/e2e/generated-plan.spec.cjs`

**Step 1: 写失败E2E**

完成正常问卷→生成计划→首页显示第1周→进入训练→每屏一个动作→GIF与剂量匹配→完成后记录。断言页面中不存在例行选择清单。

**Step 2: 运行失败测试**

Run: `npm run test:e2e -- --grep generated-plan`

Expected: FAIL。

**Step 3: 适配渲染器**

`workout-guide.js`只接收：

```js
openWorkout({ session, catalog, onComplete, onStop });
```

它不得自行选择动作；动作替换必须在生成或明确场景切换时完成。

**Step 4: 保留演示模式**

未完成问卷时可查看现有28天示例，但按钮明确写“示例计划”；不能把示例记录混入用户计划。

**Step 5: 运行全部测试并提交**

```bash
npm run test:all
git add index.html src/ui src/app.js tests/e2e/generated-plan.spec.cjs
git commit -m "feat: render generated plans in guided workouts"
```

---

### Task 11: 实现训练中的暂停、停止和重新筛查

**Objective:** 在训练过程中处理胸部症状、晕厥感、异常气短、突发剧痛和持续疼痛。

**Files:**
- Modify: `src/ui/workout-guide.js`
- Modify: `src/storage/local-store.js`
- Modify: `assets/css/app.css`
- Create: `tests/unit/runtime-safety.test.cjs`
- Create: `tests/e2e/runtime-stop.spec.cjs`

**Step 1: 写失败测试**

断言：每页可见停止入口；严重症状不能“忽略继续”；安全停止保留已完成动作但不标记整节完成；旧计划变为stale；下周不得自动进阶；普通退出与安全停止有不同状态。

**Step 2: 运行失败测试**

Run: `npm test && npm run test:e2e -- --grep runtime`

Expected: FAIL。

**Step 3: 实现安全状态**

```js
recordWorkoutStop({ sessionId, reasonCode, actionIndex, occurredAt });
invalidatePlan('runtime-safety-event');
```

自由文本症状不写入控制台或URL。

**Step 4: 移动端可用性验证**

390×844下停止按钮不能被音乐栏或固定底栏遮挡；确认页必须区分“普通退出”和“因不适停止”。

**Step 5: 提交**

```bash
git add src/ui/workout-guide.js src/storage/local-store.js assets/css/app.css tests
git commit -m "feat: add in-workout safety stop flow"
```

---

### Task 12: 实现每周复盘和单变量调整

**Objective:** 每周收集完成度、难度、疼痛、疲劳和下周时间，并让用户确认后调整。

**Files:**
- Create: `src/domain/weekly-adaptation.js`
- Create: `src/ui/weekly-review.js`
- Create: `tests/unit/weekly-adaptation.test.cjs`
- Create: `tests/e2e/weekly-review.spec.cjs`
- Modify: `src/storage/local-store.js`
- Modify: `src/app.js`

**Public API:**

```js
proposeWeeklyChange({ plan, weekNumber, review }) => {
  type: 'keep' | 'reduce' | 'replace' | 'progress_one_variable' | 'rescreen',
  before,
  after,
  reason
}
```

**Step 1: 写失败测试**

覆盖：时间不足→缩短；过难→降量；适合→保持；连续过轻且无疼痛→单变量进阶；疼痛新发/加重→重新筛查；疲劳差→不进阶。未经确认不得修改plan。

**Step 2: 运行失败测试**

Run: `npm run test:unit -- tests/unit/weekly-adaptation.test.cjs`

Expected: FAIL。

**Step 3: 实现最小调整集合**

不同时修改频次、动作、强度和总量；所有调整再次通过 `validatePlan`。

**Step 4: 实现UI**

固定展示“原计划／建议变化／原因”，提供“确认调整”和“保持原计划”。拒绝调整也记录，但不惩罚用户。

**Step 5: 运行测试并提交**

```bash
npm run test:all
git add src/domain/weekly-adaptation.js src/ui/weekly-review.js src/storage/local-store.js src/app.js tests
git commit -m "feat: add user-confirmed weekly adaptation"
```

---

### Task 13: 实现隐私工具和最小化人工审核摘要

**Objective:** 让用户查看、导出和删除本地数据，并生成不含身份信息的审核摘要。

**Files:**
- Create: `src/ui/privacy-tools.js`
- Create: `tests/unit/privacy-tools.test.cjs`
- Create: `tests/e2e/privacy.spec.cjs`
- Modify: `src/storage/local-store.js`
- Modify: `index.html`
- Modify: `assets/css/app.css`

**Step 1: 写失败测试**

断言：健康答案不进入URL、console、网络请求；审核摘要只有participantId、规则版本、风险级别、命中代码、计划摘要和校验结果；删除后刷新不恢复；CSV旧记录也一并删除或明确单独下载状态。

**Step 2: 运行失败测试**

Run: `npm test && npm run test:e2e -- --grep privacy`

Expected: FAIL。

**Step 3: 实现**

```js
buildReviewSummary(state);
downloadReviewSummary(summary);
confirmAndClearAll();
```

审核摘要不包含姓名、联系方式、原始自由文本、精确生日或完整病史。

**Step 4: 网络拦截验证**

Playwright监听所有request；在用户未明确操作导出前，健康数据相关网络请求数量必须为0。

**Step 5: 提交**

```bash
git add src/ui/privacy-tools.js src/storage/local-store.js index.html assets/css/app.css tests
git commit -m "feat: add local data privacy controls"
```

---

### Task 14: 完成离线、异常恢复和移动端端到端验证

**Objective:** 证明两人试用版在HTTP和双击离线模式下都可用，失败时不会绕过安全规则。

**Files:**
- Create: `tests/e2e/offline.spec.cjs`
- Create: `tests/e2e/recovery.spec.cjs`
- Create: `tests/e2e/full-pilot-flow.spec.cjs`
- Modify: `playwright.config.cjs`

**Required scenarios:**

1. 正常健身房用户完整问卷→4周生成→首次跟练；
2. 居家用户缺少弹力带→明确受限结果，不能伪造完整计划；
3. `stop`用户生成计划数为0；
4. 16岁以下进入人工审核，16～17岁按规则生成但不显示激进减重话术；
5. 修改健康答案使旧计划失效；
6. 训练中新症状触发停止；
7. 每周调整必须确认；
8. 刷新、断网、重复提交不绕过校验；
9. 删除后数据不恢复；
10. 390×844无横向溢出，GIF、音乐控制和固定按钮不重叠。

**Step 1: 写测试并确认能发现故意破坏**

临时反转一个fixture预期，确认测试失败；立刻恢复fixture。

**Step 2: 运行完整验证**

Run: `npm run test:all`

Expected: all unit and E2E tests PASS；无控制台错误和失败资源。

**Step 3: 生成离线ZIP并从解压目录复测**

ZIP必须包含 `index.html`、`src/`、`assets/`、`README.md` 和 `使用说明.txt`；不得包含 `node_modules/`、测试报告或用户数据。

**Step 4: 提交**

```bash
git add tests playwright.config.cjs
git commit -m "test: cover complete pilot workflow"
```

---

### Task 15: 准备两人试用材料和人工复核流程

**Objective:** 形成可执行的试用交付包，而不是只交一个网页。

**Files:**
- Create: `docs/pilot/reviewer-checklist.md`
- Create: `docs/pilot/participant-guide.md`
- Create: `docs/pilot/issue-log-template.md`
- Modify: `README.md`
- Modify: `使用说明.txt`

**Reviewer checklist:**

- 问卷完整性和风险分流；
- 计划规则版本和校验结果；
- 时间上限、动作模式、器械、禁忌和GIF；
- 复核人、日期、问题、处理结果；
- `stop`不得由普通管理员改为normal。

**Participant guide:**

- 4周周期说明；
- 数据只保存在当前浏览器；
- 如何开始、暂停、停止、切换当天场景；
- 何时停止训练；
- 如何完成周复盘、导出摘要和删除数据；
- 反馈渠道和问题截图要求。

**Step 1: 文档审查**

让未参与开发的人根据说明完成一次模拟流程，记录所有需要口头补充的地方并修订。

**Step 2: 最终命令**

Run: `npm run test:all`

Run: `git diff --check`

Expected: all PASS；无空白错误。

**Step 3: 代码审查**

独立检查：安全规则、隐私、可维护性、重复逻辑、未使用代码和公开页面泄露。

**Step 4: 提交试用材料**

```bash
git add README.md 使用说明.txt docs/pilot
git commit -m "docs: add two-user pilot operations guide"
```

两人试用完成前不推送替换现有GitHub Pages主页面。先交付离线ZIP；扩大公开测试前根据试用问题修订规则、重新运行完整测试并进行人工复核。

---

## 3. 实施阶段统一验收命令

```bash
npm install
npm test
npm run test:e2e
npm run test:all
git diff --check
```

预期：所有命令退出码为0。任何安全、隐私或计划校验测试失败都阻止生成试用包。

## 4. 明确不做

- 不引入React、Vue、数据库或后端账号系统；
- 不在首试中连接LLM或第三方分析；
- 不做任意器械组合和无限动作推荐；
- 不做营养热量处方、康复、孕产、复杂慢病或竞技计划；
- 不用两人试用结果宣传减脂效果、安全效果或广泛适用性；
- 不把客户端邀请码描述成安全认证；
- 不在测试前直接替换公开网站。

## 5. 完成定义

只有同时满足以下条件，第一版才算可以交给两名用户：

1. 不少于20个固定风险边界案例100%通过；
2. `stop`和禁止自动生成案例生成计划数为0；
3. 计划中所有动作均为approved且GIF有效；
4. 所有训练时长、剂量、恢复和场景替换通过校验；
5. 问卷修改和训练中安全事件都会令旧计划失效；
6. 每周调整未经确认不会生效；
7. 健康答案不会进入URL、控制台、通用埋点或第三方服务；
8. 用户能查看、导出最小摘要并彻底删除本地数据；
9. HTTP、离线文件和390×844移动端流程全部通过；
10. 两份计划均经统一人工清单复核后才交付。
