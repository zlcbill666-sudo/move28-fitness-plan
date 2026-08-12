# Move28 4项编辑与5项定制媒体生产规格

- 日期：2026-08-13
- 状态：内部生产合同已冻结；素材尚未采购、编辑、定制或批准发布
- 基线提交：`0230b75 docs(media): resolve final 3d candidates`
- 机器规格：`docs/research/data/move28-media-production-spec.json`
- 验证器：`media-src/scripts/build_media_production_review.py`
- 审核台：`media-build/source-research/move28-media-production-review.html`（本地生成、被Git忽略）

## 1. 完成边界

本Task完成的是9项媒体的**可执行生产合同**，不是9项成品媒体。它冻结：

- 4项商业候选允许怎样编辑；
- 哪些差距不能靠裁剪、遮盖或改标题掩盖；
- 编辑所需的源文件前提；
- 失败时自动降级为`custom-3d`的条件；
- 5项定制动作的相位、接触、禁用模式、镜头和机器QA指标；
- 全套统一视觉、技术交付物和四道人工门禁。

未执行采购、联系供应商、委托第三方、真人录制、3D制作、正式manifest修改、推送、PR或部署。

## 2. 统一视觉与技术标准

所有编辑和定制成品必须满足：

- 纯白不透明背景；
- 灰白解剖人物；
- 红色目标肌群必须绑定人物表面，不得使用漂浮红块；
- 无水印、无镜头切换、无镜头抖动；
- 固定正交或长焦镜头；
- 人物高度占画面68%～82%；
- 512×512、24fps；
- PNG帧序列为母版；
- WebM/VP9为24fps主格式，GIF为保持批准帧顺序的兼容回退（GIF时间基不伪称精确24fps），另含PNG poster；
- MP4/H.264作为审核兼容格式，并与WebM/GIF从同一批准帧序列编码；
- 无音轨；
- 首尾循环不保留重复尾帧。

每项必须交付：

1. `contract.json`
2. `production-manifest.json`
3. `frames/frame-0000.png`起连续编号的PNG母版；不得缺号、重复或保留重复尾帧
4. `master.webm`
5. `review.mp4`
6. `fallback.gif`
7. `poster.png`
8. `contact-sheet.png`
9. `qa-report.json`
10. `manual-review.json`

输出根目录固定为`media-build/production-motion/<exercise-id>/`。`production-manifest.json`必须逐帧记录路径与SHA-256，计算帧集合根哈希，并让WebM、MP4、GIF、poster、联系表、QA和人工审核记录全部绑定同一个帧集合根哈希。联系表必须精确覆盖`0..frameCount-1`全部帧。

`manual-review.json`只允许`motionGate`、`safetyGate`、`visualGate`和`technicalGate`四项；每项必须是`status=pass`、有限`reviewerId`、UTC秒级`reviewedAt`和指向本包已哈希证据文件的`evidenceSha256`。`qa-report.json`必须声明同一帧集合根哈希且`passed=true`。任何文件缺失、哈希不符、格式探针不符、帧覆盖不全或人工门未通过，`python media-src/scripts/build_media_production_review.py --verify-production`必须失败；正式状态始终保持`releaseBlocked=true`。

## 3. 四项受控编辑

### 3.1 `seated-knee-extension-unloaded`

**目标**：将交替伸膝候选裁为单侧完整循环。

输入必须同时具备：

- 一侧从中立位完成伸膝；
- 同一侧完整受控返回；
- 椅上直立设置完整可见。

允许：

- 只在中立姿势边界裁剪；
- 保留一侧完整动作；
- 删除另一侧重复；
- 去除重复尾帧后重新编码。

禁止：

- 在腿回到中立位前截断；
- 把左侧伸展和右侧返回拼成一个动作；
- 对返回相位加速；
- 在膝锁死帧停留；
- 增加任何负重。

机器验收：单侧动作数=1；相位必须为`neutral → extend → near-straight → return → neutral`；返回相位存在；外部负重数=0；大腿—座面接触比例≥0.95。

任何一项不满足，转`custom-3d`。

### 3.2 `supported-calf-raise`

**目标**：画面必须显示双手轻扶稳固椅背完成双脚提踵。

权威目录器械是`stable_chair`。不得将候选中的健身器械改名为“椅子”，也不得修改运行时动作合同接受任意支撑。

编辑前提：

- 获得可编辑3D场景和骨骼；
- 支撑物可以替换；
- 双手接触锚点可以重算。

允许：

- 用稳固椅子替换健身支撑物；
- 重算双手—椅背持续接触；
- 保持原提踵轨迹；
- 重新构图和完整渲染。

禁止：

- 二维贴图遮盖原支撑物；
- 只改标题或说明；
- 保留健身器械支撑；
- 删除手部支撑；
- 加入屈膝弹跳。

机器验收：稳固椅清晰可见；手—椅接触比例≥0.98；双侧脚跟峰值高度差≤12mm；峰值保持≥1秒；弹震反向次数=0。

若拿不到可编辑3D源或无法重算接触，直接转`custom-3d`，禁止进行二维伪修复。

### 3.3 `high-seat-sit-to-stand`

**目标**：将普通长凳设置纠正为Move28审核过的高位座面变式。

编辑前提：

- 获得可编辑3D场景和骨骼；
- 座面几何可修改；
- 起立、站直、缓慢坐回完整存在。

允许：

- 提高座面；
- 重新定向髋、膝、踝轨迹；
- 重算臀部—座面接触和离开帧；
- 重新构图和完整渲染。

禁止：

- 二维叠加高座面；
- 只在文字中声称高位；
- 保留普通长凳高度；
- 用手撑腿起身；
- 删除缓慢坐回相位。

机器验收：高位稳固座面清晰可见；接触相位为`seated → leave → stand → descend → seated`；手臂助力帧=0；脚掌接地比例≥0.98；目录变式必须为`high_seat`。

若拿不到可编辑场景或改高座面后动作轨迹不自然，转`custom-3d`。

### 3.4 `calf-stretch`

**目标**：将动态脚尖点动转成主动踝背屈并保持20秒的静态拉伸演示。

输入必须同时显示：

- 坐在稳固椅子前部且躯干直立；
- 一腿前伸，脚跟着地；
- 主动背屈峰值清晰；
- 无手、毛巾或弹力带辅助。

允许：

- 选择一个干净背屈周期；
- 将峰值静止姿势延长至20秒；
- 使用同一真实源姿势做无运动保持；
- 加入受控放松相位；
- 编码成长时WebM。

禁止：

- 保留连续点脚；
- 不足20秒却标为20秒；
- 增加手、毛巾或弹力带；
- 脚跟离地；
- 静态保持期间进行插帧运动。

机器验收：脚跟接地比例≥0.99；连续峰值保持≥20秒；辅助工具数=0；保持段逐帧运动≤1px；相位为`neutral → dorsiflex → hold-20s → release`。

若源峰值无法稳定冻结或保持段出现可见抖动，转`custom-3d`。

## 4. 五项专业定制

### 4.1 `wall-hip-hinge`

- 场景：墙面、平地、无PVC杆；
- 相位：直立 → 臀部后移 → 轻触墙 → 回到直立；
- 必需接触：双脚持续接地，峰值臀部轻触墙；
- 禁止：下蹲、弓腰、脚跟抬起、撞墙、PVC杆；
- 镜头：侧前方三分之四，墙触点、双脚和头部均可见；
- QA：峰值臀—墙≤5mm；脚滑≤5mm；膝向前位移≤40mm；躯干节段角漂移≤10°。

### 4.2 `bird-dog-regression`

- 场景：垫上四点支撑；
- 相位：中立 → 单手贴垫前滑 → 舒适终点 → 贴垫滑回 → 换侧；
- 必需接触：双膝、支撑手、滑动手始终接垫；
- 禁止：手抬起、对侧腿伸展、躯干旋转、塌腰、臀部后坐；
- 镜头：前侧三分之四，双手和双膝全部可见；
- QA：滑动手接垫比例≥0.99；支撑点丢失帧=0；骨盆滚转≤8°；伸腿帧=0。

### 4.3 `supported-standing-march`

- 场景：稳固椅、平地；
- 相位：站稳 → 左膝小幅抬起 → 左脚回地 → 右膝小幅抬起 → 右脚回地；
- 必需接触：双手持续轻扶椅背，支撑脚持续接地；
- 禁止：单手离开、躯干倾斜、高抬膝、直腿踢、跺脚、椅子滑动；
- 镜头：前侧三分之四，双手接触和双脚均可见；
- QA：双手接触比例≥0.99；脚离地高度5～10cm；躯干偏离竖直≤8°；椅子滑动≤2mm。

### 4.4 `ankle-circle`

- 场景：稳固椅、平地；
- 相位：坐稳 → 工作脚稍离地 → 慢速展示一个完整顺时针圆周 → 中立 → 慢速展示一个完整逆时针圆周 → 脚回地 → 换侧；产品中的顺逆各10次由剂量文字负责，不得为塞入20圈而加速媒体；
- 必需接触：骨盆—椅面、支撑脚—地面；
- 禁止：坐地长坐位、膝盖画圈、小腿大幅摆动、仅脚趾摆动、强压范围、快速甩动；
- 镜头：前侧近景，同时显示椅子、膝盖、踝和脚；
- QA：工作膝位移≤15mm；脚离地2～8cm；顺/逆各清楚展示1个完整圆周；圆周闭合误差≤10%。

### 4.5 `dead-bug`

- 场景：垫上仰卧；
- 相位：tabletop中立 → 左脚跟下放/点地/收回 → 右脚跟下放/点地/收回；
- 必需接触：头、躯干和双臂体侧接垫；交替脚跟接垫；
- 禁止：脚尖点地、双手推墙、双臂举过头、双腿同时下放、直腿下放、腰部拱起、借惯性；
- 镜头：侧前方三分之四，双臂、脚跟接触和腰部区域可见；
- QA：初始髋膝角80°～100°；每侧脚跟接触1次；双腿同时下放帧=0；手臂接垫比例≥0.99；腰—垫间隙≤10mm。

## 5. 生产顺序

1. 先确认4项编辑候选是否可获得满足前提的可编辑源；
2. `seated-knee-extension-unloaded`可先用现有完整帧做裁剪Spike；
3. `calf-stretch`可先做20秒保持编码Spike；
4. `supported-calf-raise`和`high-seat-sit-to-stand`若无可编辑3D源，立即转定制，不进行二维伪修复；
5. 5项定制先制作`wall-hip-hinge`作为墙接触代表、`supported-standing-march`作为椅支撑代表；
6. 代表动作通过动作、安全和视觉评审后，再批量制作其余3项；
7. 每项独立生成QA和人工审核文件，不允许一份总报告替代逐项结论。

## 6. 验证

生产包验证不得只信任manifest自报的同源SHA：WebM、MP4和GIF必须解码为与PNG母版相同的帧数和顺序，并逐帧比较冻结的32×32 RGB感知指纹；poster必须与指定母版帧解码像素完全一致；联系表必须按冻结的4列、128×128缩略图、行优先布局由全部母版帧重建并做解码像素比较。`frames/`内任何额外文件、目录或符号链接均失败，首尾母版解码像素重复也失败。

`qa-report.json`必须对本动作每个`acceptanceCriteria`或`qaMetrics`恰好给出一个`metricId`、实测`actual`和包内已哈希证据SHA；验证器亲自执行`eq/gte/lte/between`比较，不能用总`passed=true`替代逐项达标。项目根到`outputRoot`、动作包、`frames/`及全部交付项的任一级符号链接或Windows reparse point均失败关闭。

```bash
python -m py_compile media-src/scripts/build_media_production_review.py
python media-src/scripts/build_media_production_review.py
# 当前9项成品尚未制作，此命令必须失败；未来仅在9个真实生产包全部通过时成功
python media-src/scripts/build_media_production_review.py --verify-production
node --test tests/unit/media-production-spec.test.cjs
python scripts/validate_exercise_media.py
npm run test
```

发布模式仍必须失败并报告25项`releaseEligible=false`。不要为了让发布测试通过而修改正式manifest。

## 7. 外部动作边界

当前可以继续进行本地规格验证、裁剪Spike、编码Spike、定制脚本原型和审核台建设。以下动作仍需用户明确授权：

- 购买商业素材；
- 联系GymVisual或其他供应商；
- 委托第三方制作；
- 录制或收集真人素材；
- 推送分支、创建/合并PR；
- 部署公开HTTPS版本。
