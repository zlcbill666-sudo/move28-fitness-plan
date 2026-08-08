# Move28 能力评估扩展交接摘要

更新时间：2026-08-09 02:23（Asia/Shanghai）

## 当前分支

```text
feature/home-capability-assessment
```

基线稳定提交：

```text
d4c3166 feat: bind plans to capability constraints
```

线上 GitHub Pages 仍保持上一阶段稳定版，本分支尚未发布。

## 已完成内容

### Task 1～8

已完成居家低器械能力评估、25项可信动作目录、能力驱动计划生成和独立 validator 闭环。

确定性链路：

```text
问卷与安全门
→ 五项能力评估
→ 可信能力档案
→ 动作匹配
→ 四周计划生成
→ 独立 validator
→ pending_review
→ 人工批准
```

Task 7/8 已通过独立复审：

```text
规格：PASS
质量／安全：APPROVED
Critical：0
Important：0
```

### Task 9 当前已完成部分

1. `src/domain/weekly-adaptation.js`
   - 人工批准记录必须满足 `review.capabilityRevision === plan.capabilityRevision`。
   - 连续“过轻”判断绑定 intake revision 与 capability revision。
   - 允许在同一可信计划 lineage 内继承上一周反馈，不再被调整后的新 plan ID 截断。

2. `src/storage/local-store.js`
   - 周复盘记录显式保存 `capabilityRevision`。
   - 迁移、lineage、提交、建议重算和建议处理均按能力 revision 隔离。
   - reviewer detailed dossier 增加：
     - `capabilityStatus`
     - `capabilityRevision`
     - `constraintCodes`
     - 每项计划动作的受控 `variant`
   - 最小审核摘要同步增加脱敏能力状态、revision 和约束码。
   - 不导出原始五项能力答案、问卷、具体病史或自由文本。

3. 测试更新：
   - `tests/unit/local-store.test.cjs`
   - `tests/unit/weekly-adaptation.test.cjs`
   - `tests/unit/weekly-storage.test.cjs`
   - 覆盖批准能力版本门、周复盘能力版本持久化、跨调整 lineage 的连续反馈和 dossier 脱敏字段。

## 当前文件位置

项目目录：

```text
E:\个人用\健身\健身计划公开版
```

Windows ASCII junction：

```text
C:\move28-live
```

实施规格：

```text
docs/plans/2026-08-08-home-capability-assessment-implementation.md
```

核心文件：

```text
src/domain/capability-engine.js
src/domain/plan-generator.js
src/domain/plan-validator.js
src/domain/weekly-adaptation.js
src/storage/local-store.js
src/ui/workout-guide.js
src/data/exercise-catalog.js
```

## 停止点与未完成内容

Task 9 尚未完成，不应标记 completed，也不应发布：

1. 跟练页面尚未显示受控变式的可信指导：
   - `high_seat`：高位起立设置；
   - `close_wall`：近墙、小幅度设置。
   - 指导必须来自可信动作目录元数据，不直接显示原始枚举字符串。

2. 仍需补强：
   - 多次计划调整的 lineage 测试；
   - 刷新恢复后的周次连续性；
   - 能力 revision 更新后，旧训练历史保留但不得污染新计划；
   - 调整候选继续满足能力难度、排除、variant 和有氧剂量硬门。

3. Task 9 完成后必须进行独立规格复审与质量／安全复审。

## 后续步骤

1. 完成 `workout-guide.js` 的受控变式／幅度指导，并补纯函数及浏览器测试。
2. 补多跳 lineage、刷新恢复和能力版本隔离测试。
3. 运行：

```bash
npm run test
npx playwright test tests/e2e/onboarding.spec.cjs --workers=1
npx playwright test tests/e2e/generated-plan.spec.cjs --workers=1
git diff --check
```

4. Task 9 取得：

```text
规格 PASS
质量／安全 APPROVED
```

5. 再进入 Task 10：迁移剩余 Playwright、完整回归、隐私检查、推送和真实 HTTPS 发布验收。

## 发布约束

- 当前本分支不得直接覆盖 GitHub Pages 稳定版本。
- 发布前必须完成全量测试和双重复审。
- ZIP／`file://` 仅作为维护备份，参与者入口必须是可转发 HTTPS 地址。
