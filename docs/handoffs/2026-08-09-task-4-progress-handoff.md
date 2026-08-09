# MOVE28 Task 4 当前进度交接

日期：2026-08-09

## 仓库与分支

- 工作目录：`C:\move28-live`
- 真实目录：`E:\个人用\健身\健身计划公开版`
- 当前分支：`feature/explain-and-adapt-plan`
- 开始本阶段前的 HEAD：`fad0521 fix: harden session adaptation boundaries`
- 线上稳定版本仍为：`4833828d6aaf6806795756609947ffe771fc1512`
- 当前进度尚未推送、合并或部署。

## 当前状态

Task 4 的主体实现已完成，并已保存为一个阶段性提交，但尚未完成最终全量 Playwright、视觉验收和最新代码双重复审，因此不能标记为最终完成。

## 已完成内容

1. 新增训练前“今日状态确认”界面，所有正常仪表盘训练入口先进入该流程。
2. 默认保持原训练节；只有显式检查后才能进入原计划跟练。
3. 输入限定为固定枚举：时间、器械、空间、噪声、精力和身体信号，不收集自由文本。
4. `stop`、`manual_review` 和无审核适配模型的状态不提供继续训练入口。
5. 器械适配候选仅在内存中预览，展示原训练节、候选训练节、动作/变式/剂量和有限原因。
6. 候选必须显式确认；确认时重新读取当前状态、重新路由、重新生成候选并调用独立执行校验器。
7. 已确认适配只允许通过私有注册表中的 `adaptationId` 打开，不接受调用方直接传入 manifest 或 execution session。
8. 适配授权会在完成、普通退出、安全停止、新 readiness 流程或启动失败后撤销；刷新后不恢复授权。
9. 原四周计划和长期问卷保持不变；完成日志只保存有限绑定元数据，不保存 manifest、器械快照或健康输入。
10. 保持 classic-script/CommonJS 双加载、静态部署、原生 `file://` 和离线兼容。
11. 已更新既有 E2E 流程，使原训练入口经过今日状态确认。

## 已修改或新增文件

### 产品代码

- `src/ui/session-readiness.js`：新增今日状态 UI、候选预览、显式确认、内存授权及撤销。
- `src/app.js`：接线 readiness、原训练/适配训练入口、完成与停止后的授权撤销。
- `src/ui/dashboard.js`：今日训练按钮改为进入 readiness。
- `src/ui/workout-guide.js`：新增仅接受 `adaptationId` 的独立适配入口及执行元数据。
- `src/storage/local-store.js`：新增适配完成记录的独立重校验和有限持久化边界。
- `index.html`：新增 readiness dialog 和脚本顺序。
- `assets/css/generated-plan.css`：新增 readiness 桌面端/移动端样式。

### 测试与加载器

- `tests/e2e/session-readiness.spec.cjs`
- `tests/e2e/runtime-stop.spec.cjs`
- `tests/e2e/full-pilot-flow.spec.cjs`
- `tests/e2e/generated-plan.spec.cjs`
- `tests/e2e/offline-file.spec.cjs`
- `tests/e2e/offline.spec.cjs`
- `tests/e2e/recovery.spec.cjs`
- `tests/helpers/load-script.cjs`
- `tests/unit/local-store.test.cjs`
- `tests/unit/module-loading.test.cjs`

## 已完成验证

- `npm run test`：309/309 通过。
- Task 4 Playwright：16/16 通过（桌面端和移动端）。
- Runtime-stop Playwright：10/10 通过（桌面端和移动端）。
- 原生 `file://` 离线测试此前已通过；新增脚本已加入离线资源清单。
- `npm audit --audit-level=high`：0 vulnerabilities。
- 相关 `node --check`：通过。
- `git diff --check`：通过。

## 尚未完成 / 恢复后的下一步

1. 重新运行完整 Playwright：`npx playwright test --workers=1`。
2. 修复完整回归中可能仍按旧入口编写的测试或真实回归。
3. 在窄屏、横屏和桌面端完成视觉验收：默认保持、候选预览、警示阻断、陈旧确认、完成和停止。
4. 对当前最新代码重新进行独立规格审查。
5. 对当前最新代码重新进行独立质量/安全审查，重点检查：TOCTOU、确认双击、授权撤销、模块加载后内建污染、完成持久化隐私边界。
6. 修复审查问题并重跑全量测试。
7. 仅在全部通过后创建 Task 4 最终闭合提交；不要改写本阶段性提交。
8. Task 4 闭合后再进入 Task 5（训练后反馈闭环）。

## 停止点说明

本文件记录的是用户要求停止开发时的阶段性状态。恢复时先检查 `git status --short --branch`、最近提交和本文件，不要假定 Task 4 已最终完成，也不要推送、合并或部署，除非用户再次明确要求。
