# MOVE 28｜4周确定性入门训练试用版

MOVE 28 是一个静态、local-first、零构建的健身计划产品原型。它通过健康问卷、五项非极限能力校准、确定性规则和人工复核，为普通用户生成固定 4 周的入门训练计划。

## 当前能力

- 16 岁以下特别处理；16 岁及以上进入常规规则流程，但健康红旗始终优先。
- `stop` 与 `manual_review` 不生成可执行训练计划。
- 常规流程固定为：问卷 → 三屏能力校准 → 4 周候选计划 → 完整规则校验 → 人工一致性复核 → 开放训练。
- 能力检查共五项：坐站、髋铰链、墙壁推、地面活动和步行耐受；均为非极限、可跳过，不上传视频、不调用摄像头。
- 候选计划先进入 `pending_review`；validator 与人工复核都通过后才变为 `active`。
- 25 个审核动作均绑定本地 GIF、器械组合、剂量、RPE、休息、安全提示和能力约束。
- 受限能力只显示动作目录中的受控中文变式指导，不展示内部枚举或计划自由文本。
- 每屏一个确定动作；训练中严重信号会使计划失效并要求重新筛查。
- 每周复盘只允许确定性、有限、单变量调整；用户接受调整后必须重新人工复核。
- 问卷、能力档案、计划和训练记录默认只保存在当前浏览器。

## 试用交付边界

参与者的主入口必须是维护者提供的、可转发的 **HTTPS 网址**。参与者不得以 ZIP、`file://` 或压缩包预览作为主要入口。

ZIP 和直接双击 `index.html` 仅用于维护者备份、离线恢复和发布前兼容性验证。当前阶段不自动发布，也不覆盖稳定站点。

## 参与试用

- [参与者指南](docs/pilot/participant-guide.md)
- [人工复核清单](docs/pilot/reviewer-checklist.md)
- [问题记录模板](docs/pilot/issue-log-template.md)
- [维护者离线说明](使用说明.txt)

## 产品研究与更新

- [产品演进知识库](docs/product/move28-evolution-knowledge-base.md)：竞品证据、长期方向、性别与生命周期策略、安全/隐私边界及下次研究流程。
- [近期解释与受控适配实施计划](docs/plans/2026-08-09-explain-and-adapt-implementation.md)：按可信解释、当日适配、反馈闭环和安全顺延分阶段实施。

## 本地维护预览

维护者可在完整目录内直接打开 `index.html`，或运行：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8765/index.html`。必须保持 `assets/`、`src/` 和 `index.html` 的相对目录结构不变。

## 测试

```bash
npm install
npm run test
npm run test:e2e
npm run test:all
```

- `npm run test`：Node 单元/集成测试。
- `npm run test:e2e`：桌面与 390×844 移动视口的真实 Chrome 回归。
- `npm run test:all`：完整发布门禁。
- `tests/e2e/offline-file.spec.cjs` 与 `tests/e2e/offline.spec.cjs`：验证原生 `file://`、离线资源和断网降级。

任何安全、隐私、风险分流、能力约束、计划校验、人工复核或运行时停止测试失败，都阻止交付。

## 隐私与删除

原始问卷、能力档案和训练记录不进入 URL、网络请求或第三方分析。参与者可在“本机数据与隐私”区域查看/下载最小化审核摘要，或删除当前浏览器中的全部 MOVE 28 数据。清理浏览器数据、切换浏览器或使用隐私模式可能导致本地记录丢失。

## 媒体来源

动作 GIF 来源和审核状态见 [docs/media-source-licenses.md](docs/media-source-licenses.md)。跟练音乐来自 Mixkit Fitness Music，曲名与作者在播放器中显示；音乐加载失败只降级为静音，不影响训练步骤与安全停止。
