# 当前开发会话 Checkpoint

- 更新时间：2026-08-16 06:48
- Repo：`C:\move28-live`（实际目录 `E:\个人用\健身\健身计划公开版`）
- Branch：`main`（本地相对 `origin/main` ahead 1）
- 当前范围：用本地 ExerciseDB 动作库替换 8 项问题动图，保持 25 项动作图全部上架
- 当前结论：本地实现、完整验证门与两轮独立复审均已通过；本地提交已创建，未推送、未部署 HTTPS；推送/PR/合并/部署前需要用户明确授权。

## 本次完成

1. 撤回并淘汰 PR #6 的 CSS 深色画布遮罩路线；当前修复不再依赖隐藏白边或修图。
2. 按用户要求从 `E:\个人用\健身\健身动作动画\bootstrapping-lab-exercisedb-api` 本地 ExerciseDB 动作库替换 8 项问题图，全部记录为 `local ExerciseDB V1 library` 来源。
3. 8 项当前替换口径：
   - `wall-hip-hinge` → **弹力带拉髋**，来源 `VtTbiP3` / `band pull through`。
   - `standing-band-chest-press` → **坐姿弹力带推胸**，来源 `4x5Okof` / `resistance band seated chest press`。
   - `band-row` → **单臂弹力带低位划船**，来源 `km0sQC0` / `band one arm standing low row`。
   - `seated-knee-extension-unloaded` → **坐姿弹力带伸膝**，来源 `Y1MsI1l` / `resistance band leg extension`。
   - `supported-calf-raise` → **站姿支撑提踵**，来源 `bJYHBIN` / `bodyweight standing calf raise`。
   - `heel-slide` → **仰卧单腿滑动**，来源 `LNE3wfo` / `single leg platform slide`。
   - `bird-dog-regression` → **跪姿平板肩触碰**，来源 `h1ezqSu` / `kneeling plank tap shoulder (male)`。
   - `supported-standing-march` → **扶墙支撑原地抬膝**，来源 `ealLwvX` / `high knee against wall`。
4. 同步更新：
   - `assets/exercises/*.gif` 与旧 `assets/gifs/*.gif` 对应 8 项文件；
   - `assets/exercises/manifest.json`；
   - `src/data/exercise-catalog.js`；
   - 本地 ExerciseDB mapping、Exact10 dry-run、media production review、calf/support spike 相关冻结 hash；
   - 单测与 E2E 断言。
5. 新增/更新研究证据：
   - `docs/research/data/move28-local-exercisedb-8-replacement-search-2026-08-16.json`
   - `docs/research/move28-local-exercisedb-8-replacement-search-2026-08-16.md`
   - `docs/research/evidence/local-exercisedb/move28-approved-replacements-2026-08-16.jpg`
   - `docs/research/data/move28-local-exercisedb-mapping.json`

## 最新验证证据

- `python -B media-src/scripts/build_local_exercisedb_mapping.py`：通过，`releaseEligibleCount: 25`。
- `python scripts/validate_exercise_media.py --release`：通过，25 assets / 25 releaseEligible / 0 releaseBlocked / errors=[]。
- `python -B media-src/scripts/build_media_production_review.py`：通过，4 edit packages / 5 custom packages。
- `python -B media-src/scripts/analyze_supported_calf_raise_spike.py`：通过。
- `python -B media-src/scripts/analyze_calf_stretch_hold_spike.py`：通过。
- `npm test`：通过，462 tests / 458 pass / 4 skipped / 0 fail。
- `npm test` fresh rerun（证据报告修正后）：通过，462 tests / 458 pass / 4 skipped / 0 fail。
- `npx playwright test tests/e2e/current-page.spec.cjs:125 --project=desktop --project=mobile --workers=1 --reporter=line`：通过，2 passed。
- `npm run test:e2e`：通过，234 passed / 4 skipped，约 10.0m。
- `npm run build`：通过，`Built dist with 64 allowlisted files.`
- `npm run test:release`：通过，16 tests / 15 pass / 1 skipped / 0 fail。
- `npm run test:artifact`：通过，2 tests / 2 pass / 0 fail。
- `git diff --check`：通过，仅 Windows CRLF 提示，无 whitespace error。
- 独立规格复审：`APPROVED`。
- 独立代码质量/安全复审：`APPROVED`。

## 当前工作树边界

- 本地提交已创建；准确 commit hash 以 `git log -1 --oneline` 为准。
- `git status`：`main...origin/main [ahead 1]`，提交后应保持工作树干净。
- 独立规格审查与代码质量/安全审查均已批准当前 diff。
- 推送分支、创建/合并 PR、发布 GitHub Pages、线上 HTTPS 验证，均属于外部动作，必须等用户明确授权。

## 下一步建议

1. 向用户汇报 commit hash。
2. 等待是否授权 push / PR / merge / deploy / live verify。
