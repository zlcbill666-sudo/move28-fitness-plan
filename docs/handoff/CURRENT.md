# 当前开发会话 Checkpoint

- 更新时间：2026-08-14
- Repo：`C:\move28-live`（实际目录 `E:\个人用\健身\健身计划公开版`）
- Branch：`feature/supported-march-media`
- 当前HEAD基线：`4f0559f build(media): add exact10 integration dry run`
- 当前范围：Exact10隔离预演后的仓库收口与下一Task准备
- 当前结论：仓库内正式代码与研究基线已收口；旧/冲突/暂停路线文件已移出工作区；正式manifest仍保持25/25阻塞，参与者媒体仍0/25开放

## 本次收口结果

1. 已审查本轮剩余未跟踪文件：共21个。
2. 21/21均已移出Git工作区，归档到仓库外：

   `C:\move28-local-archive\paused-media-routes-2026-08-14`

3. 归档清单：

   `C:\move28-local-archive\paused-media-routes-2026-08-14\cleanup-manifest-2026-08-14.json`

4. 移出的文件类型：
   - 8月11日旧ExerciseDB/GymVisual调研报告与中间矩阵；
   - 与8月13日严格映射结论冲突的旧覆盖数据；
   - 已放弃的自制3D/GIF harness与Glute Bridge V7.x草稿；
   - 旧的下载/指纹脚本；
   - 不再被当前已提交严格映射引用的原始ExerciseDB API快照。

5. 保留在仓库内的权威基线仍是8月13日以后已提交文件：
   - `docs/research/2026-08-13-local-exercisedb-strict-mapping.md`
   - `docs/research/data/move28-local-exercisedb-mapping.json`
   - `docs/research/data/move28-exact10-integration-dry-run.json`
   - `media-src/scripts/build_local_exercisedb_mapping.py`
   - `media-src/scripts/build_local_exercisedb_candidate_package.py`
   - `media-src/scripts/build_exact10_integration_dry_run.py`
   - 对应unit测试与隔离预演测试。

## 当前决策

1. `src/data/exercise-catalog.js`仍是25项正式动作语义的唯一权威来源。
2. 当前本地ExerciseDB严格映射为10项`exact`、5项`near`、10项`reject`；旧报告里13/25 exact、23/25候选等结论不得再作为当前产品判断依据。
3. 10项Exact只能进入隔离预演或后续内部候选接入流程；未正式批准前不得进入参与者正式manifest。
4. 5项`near`与10项`reject`不得混入正式接入包。
5. 用户已放弃自制3D路线；除非用户明确恢复，不再推进GymVisual/Blender/Glute Bridge V7.x草稿路线。
6. 推送、建PR、合并、部署公开HTTPS等外部动作仍需用户明确授权。

## 当前交付物

- 严格映射报告：`docs/research/2026-08-13-local-exercisedb-strict-mapping.md`
- 冻结映射数据：`docs/research/data/move28-local-exercisedb-mapping.json`
- 本地候选联系表：`docs/research/evidence/local-exercisedb/move28-local-candidates.jpg`
- Exact10隔离预演合同：`docs/research/data/move28-exact10-integration-dry-run.json`
- Exact10隔离预演构建器：`media-src/scripts/build_exact10_integration_dry_run.py`
- Exact10候选包构建器：`media-src/scripts/build_local_exercisedb_candidate_package.py`

## 最近验证

- 上一Task最终验证：`npm test`为461项、457 passed、0 failed、4 skipped；普通媒体审计`ok:true`、25/25阻塞；release负向门禁按预期`ok:false`、25/25阻塞；隔离预演`--verify`输出`released:10`、`blocked:15`、`participantRelease:"blocked"`；`git diff --check`通过。
- 本次收口验证：`git diff --check`通过；`npm run test`为460项、456 passed、0 failed、4 skipped；`python scripts/validate_exercise_media.py`输出`ok:true`、25项资产、25项发布阻塞；`python scripts/validate_exercise_media.py --release`按设计退出1并输出`ok:false`、25项发布阻塞。

## 下一步

1. 对本次checkpoint更新运行验证并创建独立本地收口提交；
2. 新独立Task开始设计10项Exact候选逐项进入正式manifest前的发布策略；
3. 发布策略必须继续包含运行时manifest、正式manifest、媒体审计、浏览器预览、release负向门禁和人工复核硬门；
4. 若下一Task需要真正开放任何参与者媒体，必须先完成独立规格审查、代码质量审查和用户明确发布授权。
