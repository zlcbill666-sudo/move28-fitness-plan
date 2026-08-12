# 当前开发会话 Checkpoint

- 更新时间：2026-08-13
- Repo：`C:\move28-live`（实际目录`E:\个人用\健身\健身计划公开版`）
- Branch：`feature/supported-march-media`
- 本Task基线HEAD：`d8d177c Merge pull request #4 from zlcbill666-sudo/feature/pilot-readiness-media`
- 当前范围：Move28 25项动作3D媒体候选落地、动作语义核验和缺口补齐
- 当前结论：停止低质量MakeHuman＋整段手工IK批量路线；商业3D候选优先，专业定制补缺；当前阶段暂时忽略版权与授权问题

## 当前决策

1. `glute-bridge-v1`和`supported-standing-march-v2`只作为失败研究原型保留，禁止进入正式manifest。
2. 不再继续打磨当前MakeHuman角色作为25项统一商业视觉方案。
3. 当前候选分类：
   - 15项`purchase-exact-candidate`；
   - 3项`purchase-edit-candidate`；
   - 3项`custom-3d`；
   - 4项`unresolved`。
4. 当前阶段按用户明确决策暂时忽略版权与授权问题，不得再把版权询证、许可确认或权利门禁作为内部开发前置。
5. 仍不擅自进行付款、联系供应商或委托第三方等外部动作；内部研究、候选下载评估、转码、动作核验和产品接线可继续推进。

## 当前交付物

- 候选矩阵：`docs/research/data/move28-3d-candidate-matrix.json`
- 采购与定制范围：`docs/research/2026-08-12-3d-prepurchase-and-custom-scope.md`
- Agent交接手册：`docs/handoff/move28-custom-3d-animation-agent-handoff.md`
- 本地审核台生成器：`media-src/scripts/build_3d_candidate_review.py`
- 本地审核台：`media-build/source-research/move28-3d-candidate-review.html`（被Git忽略）
- GymVisual条款副本与水印comp：`media-build/source-research/`（仅内部研究、被Git忽略）

矩阵为每项候选保存审核时证据：

- `reviewedAt`；
- 证据类型；
- 原始来源URL；
- SHA-256；
- 字节数、帧数和尺寸。

审核台同时锁定25个动作各自的状态，不只锁定分类总数；任一动作状态互换均应失败关闭。

## 候选分类

### 15项精确采购候选

`seated-leg-press`、`seated-leg-curl`、`glute-bridge`、`chest-press-machine`、`standing-band-chest-press`、`seated-row`、`band-row`、`pallof-press`、`seated-leg-extension`、`hip-abduction-machine`、`wall-push-up`、`heel-slide`、`elliptical-trainer`、`flat-walk`、`hamstring-stretch`。

`flat-walk`新候选为GymVisual `Walking on Treadmill`，公开水印预览显示视觉上水平跑台、向前步行和完整交替步态。

### 3项编辑候选

- `seated-knee-extension-unloaded`：可裁成单侧完整循环，但不能裁掉返回相位；
- `supported-calf-raise`：支撑物不是椅背，若合同必须显示椅子则转专业定制；
- `high-seat-sit-to-stand`：`Bodyweight Bench Squat`为徒手坐到长凳再站起，动作路径匹配；画面座面不是高位，产品必须继续要求使用更高稳固座面。

### 3项明确专业定制

- `wall-hip-hinge`
- `bird-dog-regression`
- `supported-standing-march`

### 4项未解决

- `seated-leg-raise`
- `ankle-circle`
- `dead-bug`
- `calf-stretch`

找不到精确商品时，与3项明确缺口合并为7项专业定制包。

## 当前阶段版权策略

- 按用户明确决策，当前阶段暂时忽略版权与授权问题；
- 不再以版权询证、许可确认、订单证明或`rightsGate`阻止内部开发和候选落地；
- 仍保留来源、URL和SHA-256，仅用于素材身份和技术审计；
- 付款、联系供应商、委托第三方等外部动作仍需明确授权；
- 正式manifest保持25/25阻塞；暂缓版权仅适用于内部阶段，不会自动开放正式发布。只有用户另行明确正式发布政策并完成独立发布批准后，才允许修改正式manifest或发布白名单。

## 最近验证

- `python media-src/scripts/build_3d_candidate_review.py`：通过；
- 媒体审计：25项、0结构错误、25项发布阻塞；
- 发布模式：按设计退出1，25项全部阻塞；
- `git diff --check`：通过；
- `npm run test`：391 passed、0 failed。
- 高位坐站旧商品、旧证据、旧状态和证据字节篡改：均失败关闭；
- 最终规格复审：`PASS`；
- 最终质量复审：`APPROVED`。

## 下一步

1. 下一独立Task继续核验4项`unresolved`：`seated-leg-raise`、`ankle-circle`、`dead-bug`、`calf-stretch`；
2. 可验证者更新矩阵、保存预览指纹并生成审核台；
3. 仍无法精确匹配者进入专业定制范围，但实际联系或委托第三方前需用户授权；
4. 对候选执行动作、安全、视觉和技术门禁；
5. 暂时忽略版权与授权问题，不再停在许可询证。
