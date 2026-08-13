# 当前开发会话 Checkpoint

- 更新时间：2026-08-13
- Repo：`C:\move28-live`（实际目录`E:\个人用\健身\健身计划公开版`）
- Branch：`feature/supported-march-media`
- 本Task基线HEAD：`0230b75 docs(media): resolve final 3d candidates`
- 当前范围：Move28 4项编辑候选可执行编辑规格与5项定制动作统一生产规格
- 当前结论：9项生产合同已机器化冻结；本Task不代表素材已采购、编辑、定制或获准发布

## 当前决策

1. `glute-bridge-v1`和`supported-standing-march-v2`只作为失败研究原型保留，禁止进入正式manifest。
2. 不再继续打磨当前MakeHuman角色作为25项统一商业视觉方案。
3. 冻结源矩阵候选分类（保留采购前决策历史，不回写覆盖）：
   - 16项`purchase-exact-candidate`；
   - 4项`purchase-edit-candidate`；
   - 5项`custom-3d`；
   - 0项`unresolved`。
4. Spike后的当前执行路由：`seated-knee-extension-unloaded`已从“待裁剪验证”转为`custom-3d`，因此后续实际队列为3项继续编辑验证、6项定制；源矩阵仍保留原始采购前分类，No-Go证据以独立Spike报告追加，不篡改历史。
5. 当前阶段按用户明确决策暂时忽略版权与授权问题，不得再把版权询证、许可确认或权利门禁作为内部开发前置。
6. 仍不擅自进行付款、联系供应商或委托第三方等外部动作；内部研究、候选下载评估、转码、动作核验和产品接线可继续推进。

## 当前交付物

- 候选矩阵：`docs/research/data/move28-3d-candidate-matrix.json`
- 采购与定制范围：`docs/research/2026-08-12-3d-prepurchase-and-custom-scope.md`
- Agent交接手册：`docs/handoff/move28-custom-3d-animation-agent-handoff.md`
- 本地审核台生成器：`media-src/scripts/build_3d_candidate_review.py`
- 本地审核台：`media-build/source-research/move28-3d-candidate-review.html`（被Git忽略）
- 9项生产规格：`docs/research/data/move28-media-production-spec.json`
- 人工生产手册：`docs/production/move28-media-edit-and-custom-production-spec.md`
- 生产审核台生成器：`media-src/scripts/build_media_production_review.py`
- 生产审核台：`media-build/source-research/move28-media-production-review.html`（被Git忽略）
- GymVisual条款副本与水印comp：`media-build/source-research/`（仅内部研究、被Git忽略）

矩阵为每项候选保存审核时证据：

- `reviewedAt`；
- 证据类型；
- 原始来源URL；
- SHA-256；
- 字节数、帧数和尺寸。

审核台同时锁定25个动作各自的状态，不只锁定分类总数；任一动作状态互换均应失败关闭。

## 候选分类

### 16项精确采购候选

`seated-leg-raise`、`seated-leg-press`、`seated-leg-curl`、`glute-bridge`、`chest-press-machine`、`standing-band-chest-press`、`seated-row`、`band-row`、`pallof-press`、`seated-leg-extension`、`hip-abduction-machine`、`wall-push-up`、`heel-slide`、`elliptical-trainer`、`flat-walk`、`hamstring-stretch`。

`flat-walk`新候选为GymVisual `Walking on Treadmill`，公开水印预览显示视觉上水平跑台、向前步行和完整交替步态。

### 4项编辑候选

- `seated-knee-extension-unloaded`：可裁成单侧完整循环，但不能裁掉返回相位；
- `supported-calf-raise`：支撑物不是椅背，若合同必须显示椅子则转专业定制；
- `high-seat-sit-to-stand`：`Bodyweight Bench Squat`为徒手坐到长凳再站起，动作路径匹配；画面座面不是高位，产品必须继续要求使用更高稳固座面。
- `calf-stretch`：椅上直立、前伸腿脚跟着地和主动勾脚匹配；必须把动态点脚编辑为背屈峰值保持。

### 5项明确专业定制

- `wall-hip-hinge`
- `bird-dog-regression`
- `supported-standing-march`
- `ankle-circle`
- `dead-bug`：无手辅助候选`18372 Lying Alternate Toe Tap`为脚尖点地；脚跟候选GymVisual `10147 Wall Press Heel Tap`（https://gymvisual.com/animated-gifs/10147-wall-press-heel-tap-male.html）增加双手推墙，均不符合双臂体侧合同。

25项已全部完成商业候选决策，没有遗留`unresolved`。

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
- `npm run test`：395 passed、0 failed。
- 本轮状态互换、商品URL漂移、证据身份漂移、证据字节篡改、矩阵与文件同步篡改、拒绝候选身份漂移和视频路径伪装：均失败关闭；
- Dead Bug被拒脚跟候选GymVisual `10147 Wall Press Heel Tap`及其双手推墙冲突已结构化锁定；
- 本轮最终规格复审：`PASS`；
- 本轮最终质量复审：`APPROVED`。

当前Task新增验证：

- 生产审核台生成：4项编辑、5项定制，规格文件SHA-256为`db6ec82abf96b9d98fb7382e0be134d4ae2d647db883b87ff3a7f7d5bc461686`，规范化合同SHA-256为`e5ed6ee9c3ea0e5edacdd449d51775fbf2b19eb673a6370f51cd3e1b08cf9d49`；
- 新增规格测试：10 passed、0 failed；
- 20秒保持降级、双手支撑删除、fallback漂移、目录指纹伪造、未知批准字段、候选矩阵完整身份漂移、规格头字段漂移、镜头标准漂移和输出根目录漂移：均失败关闭；
- 生产包真实临时探针：合法PNG/WebM/MP4/GIF/poster/联系表/QA/四门包通过；额外文件/目录/符号链接/reparse point、PNG篡改、重复尾帧、异源视频、单帧异源或错序、伪联系表、未达标QA指标和NaN/±Infinity数值均失败关闭；WebM/MP4/GIF通过真实解码帧数、逐帧顺序和逐帧感知指纹绑定母版，poster和联系表通过解码像素绑定；每项acceptanceCriteria/qaMetrics均由验证器按冻结运算符执行并绑定已哈希证据；
- `--verify-production`：当前9项成品尚未制作，按设计失败且不留旧审核台；
- 当前Task完整测试：424 passed、0 failed；
- 坐姿徒手伸膝Spike：候选SHA-256绑定通过；24个不等时长GIF编码帧、总时长5秒；人工审核确认第一侧编码帧0–12为完整周期、峰值位于帧6；FFprobe逐包证据显示峰值帧持续0.5秒、普通运动帧中位持续0.1秒，即静止5倍；命中`knee-lock-frame-hold`，结论`no-go/custom-3d`；聚焦测试14 passed、0 failed；显式下载复现成功且SHA一致；
- 小腿拉伸20秒保持Spike：完整规格SHA-256冻结通过；冻结MP4为30fps、281帧、9.3667秒；人工审核确认坐姿直立、前伸腿脚跟着地、主动背屈、无手/毛巾/弹力带辅助；逐帧证据确认帧90–120及121–194为静止峰值区，选择帧121作为唯一母帧，方案为保留帧1–89进入、复制600帧形成20秒保持、接回帧195–281释放；真实GBR无损VP9探针为776帧、25.8667秒，保持区只有一个唯一像素帧且解码RGB哈希与源母帧完全一致；结论`go/controlled-edit-production`但`releaseEligible:false`；专项9 passed、0 failed；
- 当前Task规格与质量双审：小腿拉伸Spike最终增量待双审。

## 下一步

1. `seated-knee-extension-unloaded`裁剪Spike已完成：人工审核确认第一侧编码帧0–12具备完整伸展与回程；逐包时间证据显示峰值编码帧6持续0.5秒，是普通运动帧中位持续时间的5倍，命中`knee-lock-frame-hold`；结论`no-go`，按冻结合同转`custom-3d`；结构化证据见`docs/research/data/seated-knee-extension-unloaded-spike.json`；
2. 下一独立Task执行`calf-stretch`20秒保持编码Spike；
3. `supported-calf-raise`、`high-seat-sit-to-stand`若无可编辑3D源，直接按合同转定制；
4. 专业定制先做`wall-hip-hinge`与`supported-standing-march`代表原型，并把`seated-knee-extension-unloaded`纳入定制队列；
5. 实际联系供应商、付款、真人录制或委托第三方前需用户授权；
6. 正式manifest继续25/25阻塞。
