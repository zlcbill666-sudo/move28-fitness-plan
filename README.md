# MOVE 28｜本地4周智能训练计划试用版

MOVE 28 是移动端优先、local-first 的固定规则训练计划网页。当前版本用于邀请制两人试用：约3分钟、10步问卷完成后，由确定性风险规则、动作匹配器、4周生成器和独立 validator 生成候选计划；人工一致性复核完成前不开放训练入口。

## 当前产品范围

- 固定生成4周起步计划，不承诺固定期限减重或体型结果。
- 风险分流：`normal / conservative / manual_review / stop`。
- 16岁以下特别处理；16岁及以上进入常规规则流程，但任何健康红旗仍阻止普通自动生成。
- `stop` 与 `manual_review` 不生成可执行训练计划。
- 候选计划先进入 `pending_review`；validator 与人工复核都通过后才变为 `active`。
- 17个审核动作，GIF、器械、剂量、RPE、休息和安全提示均绑定动作目录。
- 每屏一个确定动作，音乐按训练阶段自动切换；音乐失败不会阻断训练或安全停止。
- 训练中严重信号会使计划失效并要求重新筛查。
- 每周复盘只允许有限、确定性、单变量调整；用户接受调整后必须重新人工复核。
- 未完成问卷时仅显示只读28天示例，示例记录不会写入用户计划。

当前试用版不提供账号、云端同步、后端、LLM自由处方、营养热量处方、康复、孕产或复杂疾病计划，也不把客户端流程描述为安全认证。

## 隐私

- 最终问卷、计划、训练记录和周复盘只保存在当前浏览器 `localStorage`。
- 未确认草稿只保存在当前标签页 `sessionStorage`。
- 默认不发送健康或训练数据；只有用户显式下载/发送审核摘要时才离开浏览器。
- 审核摘要使用匿名 `pilot-*` 编号，不包含原始健康答案。
- 隐私区可查看摘要、下载 JSON 并删除全部 MOVE 28 本机数据。
- 网页无法删除已下载、截图、复制或发送的副本，用户和接收方必须手动删除。

## 试用材料

- [参与者指南](docs/pilot/participant-guide.md)
- [人工复核清单](docs/pilot/reviewer-checklist.md)
- [问题记录模板](docs/pilot/issue-log-template.md)
- [简版离线使用说明](使用说明.txt)

参与者问题只通过试用负责人指定的一对一微信会话反馈，不得发送原始问卷、完整浏览器存储或未脱敏截图。

## 离线使用

将交付 ZIP 完整解压后双击 `index.html`。不要直接在压缩包预览窗口打开。整个试用使用同一设备、同一浏览器配置；换浏览器、清理浏览器数据或使用隐私模式可能导致数据丢失。

当前试用计划场景固定，不提供训练当天临时切换按钮。器械或场景变化时应返回问卷修改并重新生成、校验和人工复核，不自行替换动作。

## 音乐来源

音乐来自 [Mixkit Fitness Music](https://mixkit.co/free-stock-music/discover/fitness/)，按其 [Stock Music Free License](https://mixkit.co/license/) 使用，并作为本地音频随离线版提供：

- 热身：Rising Forest — Diego Nava
- 力量：Deep Urban — Eugenio Mininni
- 有氧：Techno Fest Vibes — Alejandro Magaña (A. M.)
- 放松：Summer Dream — Eugenio Mininni

运动时保持较低音量；户外步行优先注意车辆、行人和环境提示音。

## 开发与验收

要求：Node.js 20+、系统版 Google Chrome，以及可运行 `python -m http.server` 的 Python。Playwright 使用系统 Chrome 的 `chrome` channel。

```bash
npm install
npm run test:all
git diff --check
```

`npm run test:all` 会运行 Node 测试，以及桌面和390×844移动视口的 Playwright 回归。安全、隐私、风险分流或 validator 测试任一失败都阻止生成试用包。

两人试用完成前不替换现有 GitHub Pages 主页面；先交付离线 ZIP，根据试用问题修订并重新运行完整门禁。