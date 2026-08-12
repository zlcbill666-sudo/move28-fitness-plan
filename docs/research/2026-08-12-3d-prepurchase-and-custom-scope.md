# Move28 3D媒体候选审核与专业定制范围

- 日期：2026-08-13
- 状态：内部研究；当前阶段按用户明确决策暂时忽略版权与授权问题
- 工作区：`C:\move28-live`（映射至`E:\个人用\健身\健身计划公开版`）

## 1. 路线决策

停止使用当前MakeHuman＋程序化材质＋整段手工IK路线批量生产。已有`glute-bridge-v1`和`supported-standing-march-v2`仅作为失败原型保留，继续保持`releaseBlocked=true`。

改用：

1. 先核验统一商业3D系列；
2. 当前阶段直接推进候选动作、视觉和技术审核，不以版权询证为前置；
3. 未解决与明确缺口合并为专业定制包；
4. 不修改训练动作合同来迁就素材。

## 2. 当前采购前分类

| 类别 | 数量 | 下一步 |
|---|---:|---|
| 精确采购候选 | 16 | 继续逐帧终审并准备产品落地 |
| 需编辑候选 | 4 | 锁定受控裁剪、峰值保持或设置说明后落地 |
| 明确定制 | 5 | 纳入统一专业定制范围 |
| 未解决 | 0 | 25项已全部形成可执行决策 |
| 正式可发布 | 0 | 动作、安全、视觉和技术门禁尚未全部通过 |

机器可读清单：`docs/research/data/move28-3d-candidate-matrix.json`。每项均绑定实际审核证据的`sourceUrl`、SHA-256、字节数、帧数和尺寸；审核台生成时会重新读取本地研究证据并核对字节指纹，不能只靠可变商品URL恢复结论。

## 3. 16项精确采购候选

1. `seated-leg-raise`：GymVisual视频`19328 Seated Marching on a Chair (male)`；逐帧可见椅上直立、交替抬膝和双脚受控回地，产品继续锁定5～10厘米小幅。
2. `seated-leg-press`
3. `seated-leg-curl`
4. `glute-bridge`
5. `chest-press-machine`
6. `standing-band-chest-press`
7. `seated-row`
8. `band-row`
9. `pallof-press`
10. `seated-leg-extension`
11. `hip-abduction-machine`
12. `wall-push-up`
13. `heel-slide`
14. `elliptical-trainer`
15. `hamstring-stretch`
16. `flat-walk`：GymVisual `Walking on Treadmill`，公开预览显示水平跑台、向前步行和完整交替步态。

这16项仅代表“公开水印预览的动作语义可进入后续终审”，不代表正式批准。

## 4. 4项需编辑候选

### `seated-knee-extension-unloaded`

- 候选是椅上交替徒手伸膝；
- 动作主体匹配；
- 若最终产品要求单侧循环，只保留一个完整单侧周期；
- 不允许裁掉关键返回相位或用标题掩盖交替动作。

### `supported-calf-raise`

- 候选为双脚提踵并扶稳固健身器械；
- 支撑安全目的基本匹配，但不是椅背；
- 只有产品合同允许“任意稳固支撑”时才能采用；
- 若必须显示椅背，则转入定制，不能仅改中文标题。

### `high-seat-sit-to-stand`

- 新候选为GymVisual `16441 Bodyweight Bench Squat (female)`；
- 逐帧可见徒手、脚位稳定、臀部坐到长凳后再站起，动作路径匹配；
- 预览使用普通长凳高度，不能证明Move28要求的高位退阶设置；
- 产品必须继续要求使用更高且稳固的座面，不能照搬预览座面高度。

### `calf-stretch`

- 候选为GymVisual视频`20530 Sitting Toe Tapping Stretch on a Chair (female)`；
- 椅上直立、一腿前伸、脚跟着地、无手或拉力工具，主动勾脚路径匹配；
- 原视频是动态点脚，成品必须编辑为背屈峰值的清晰保持段，不能把快速往复当作20秒静态拉伸；
- 若无法形成稳定保持画面，则转专业定制。

## 5. 专业定制范围

### 明确5项

1. `wall-hip-hinge`
   - 无PVC杆；
   - 背对墙；
   - 臀部后移轻触墙；
   - 膝微屈但不能下蹲。
2. `bird-dog-regression`
   - 四点支撑；
   - 一只手全程贴垫前滑；
   - 另外三点稳定；
   - 不抬手、不伸对侧腿。
3. `supported-standing-march`
   - 双手持续轻扶稳固椅背；
   - 小幅交替抬膝；
   - 躯干直立；
   - 支撑脚持续接地。
4. `ankle-circle`
   - 全量GIF和视频目录中，最接近的完整圆周候选是坐地长坐位，不是稳固椅上单脚稍离地；
   - 定制时必须显示稳固椅、单脚稍离地、膝盖安静、顺逆时针完整圆周。
5. `dead-bug`
   - 无手辅助候选`18372 Lying Alternate Toe Tap`是脚尖点地；脚跟候选GymVisual `10147 Wall Press Heel Tap`（https://gymvisual.com/animated-gifs/10147-wall-press-heel-tap-male.html）增加双手推墙；两者均不可改名冒充；
   - 定制时必须双臂体侧、髋膝约90度、交替单侧脚跟点地并受控收回。

这5项作为统一专业定制范围，以同角色、同材质、同镜头和同红肌群风格交付；实际联系或委托第三方前仍需用户授权。

## 6. 当前阶段版权策略

以下条款资料仅作历史留档，不参与当前动作媒体开发门禁。按用户明确决策，当前阶段暂时忽略版权与授权问题；不发送许可询证，也不等待书面回复。来源URL和SHA-256继续保留，仅用于素材身份和技术审计。

## 7. 外部动作边界

内部候选下载评估、转码、逐帧审核和产品接线可继续推进。付款、联系供应商、委托第三方制作等外部动作仍需用户明确授权。

## 8. 候选终审门禁

每个候选资产必须绑定精确文件SHA-256，并分别通过：

- `motionGate`：动作设置、路径、幅度、完整返回；
- `safetyGate`：支撑、接触、关节和退阶语义；
- `visualGate`：统一人物、肌群高亮、器械、构图和循环；
- `technicalGate`：WebM/MP4/GIF/poster、尺寸、帧数、哈希和离线加载。

当前阶段不执行`rightsGate`。任何当前门禁未通过：`releaseEligible=false`。

## 9. 本轮证据

- 对GymVisual公开sitemap中的6,337个GIF和15,290个GIF/视频商品URL做本地标题穷举；
- 下载并逐帧核验4项剩余动作的公开水印视频/GIF预览，证据均记录SHA-256；
- `seated-leg-raise`升级为精确候选，`calf-stretch`进入编辑候选；
- `ankle-circle`和`dead-bug`确认无精确商业候选，转专业定制；
- 未联系、未付款、未下载付费原件、未修改正式manifest。
