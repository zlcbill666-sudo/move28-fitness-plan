# 当前开发会话 Checkpoint

- 更新时间：2026-08-15 CST
- Repo：`C:\move28-live`（实际目录 `E:\个人用\健身\健身计划公开版`）
- Branch：`feature/supported-march-media`
- 当前范围：25项动作图按图对齐并准备发布
- 当前结论：本地已完成 25 项动作图全上架合同、动作目录语义对齐、测试与 release artifact 门禁；独立规格审查与代码质量/安全审查均 `APPROVED`；尚未推送、未部署 HTTPS。

## 本次完成

1. 按用户最新决策“未上架的动作以动作图为准，修改动作内容”，把前台媒体策略改为 25 项动作图全部上架。
2. `assets/exercises/manifest.json` 与 `src/data/exercise-media-policy.js` 已同步为：
   - `mode: media_enabled`
   - `releaseEligibleIds: 25`
   - `releaseBlocked: 0`
3. 动作目录已按动图语义调整重点不匹配项，例如：
   - `ankle-circle`：站姿脚踝绕环。
   - `high-seat-sit-to-stand`：史密斯/座椅触点深蹲变式。
   - `flat-walk`：低速坡度跑台慢走，保留平路慢走替代说明。
4. 首页、参与者指南、复核清单、动作库、跟练页和 release runtime 合同已同步为 25 项动作图上架，同时保留“文字步骤、无痛范围和停止信号优先”的安全边界。
5. 已新增媒体质量审计记录：
   - `docs/research/data/move28-exercise-media-quality-review-2026-08-15.json`

## 最新验证证据

- `python scripts/validate_exercise_media.py --release`：通过，25 assets / 25 releaseEligible / 0 blocked / errors=[]。
- Focused media/unit：通过。
- Exact10 integration dry-run：`build_exact10_integration_dry_run.py` 与 `--verify` 均通过。
- `npm test`：通过，462 tests / 458 pass / 4 skipped / 0 fail。
- `npm run test:e2e`：通过，234 passed / 4 skipped。
- `npm run build`：通过，生成 `dist`，64 个 allowlisted files。
- `npm run test:release`：通过，16 tests / 15 pass / 1 skipped / 0 fail。
- `npm run test:artifact`：通过，2 tests / 2 pass / 0 fail。
- `git diff --check`：通过，仅有既有 Windows CRLF 提示，无 whitespace error。

## 当前工作树边界

- 独立规格审查与代码质量/安全审查：`deleg_a7a8f5ab` 两路均 `APPROVED`。
- 本地改动已完成提交前验证；推送分支、创建/合并 PR、发布公开 HTTPS 或变更线上入口前，需要用户明确授权。

## 下一步建议

1. 创建本地提交，保存 25 项动作图上架改动与本 checkpoint。
2. 向用户确认后再执行 push / GitHub Pages 发布 / 线上 HTTPS 复核。
