# Move28 自制3D动作动画交接手册

- 日期：2026-08-12
- 项目：`C:\move28-live`
- 面向：接手制作的另一个Agent
- 当前边界：内部研究、原型、编辑、转码和产品接线暂时忽略版权；正式媒体manifest、发布白名单和`releaseEligible`保持25/25阻塞，直到用户另行确定正式发布政策并完成独立发布批准

## 1. 任务目标

为Move28的25项动作制作统一、可离线、自托管的3D循环媒体：

- 灰白解剖人物；
- 红色目标肌群；
- 纯白背景；
- 固定、清楚、无水印镜头；
- 每段展示完整起始、动作、末端和受控返回；
- WebM优先，GIF兼容；
- 每项都具备来源身份、动作、安全、视觉、技术和SHA-256证据。

当前正式发布状态必须保持：25/25阻塞。

## 2. 已验证的本机条件

- 仓库ASCII别名：`C:\move28-live`（底层实际目录含中文；shell必须继续使用别名）。
- Blender：`C:\move28-tools\blender-5.2.0-windows-x64\blender.exe`，实测5.2.0 LTS。
- FFmpeg/ffprobe：在PATH中。
- Python：3.11。
- MakeHuman 1.3.0官方捆绑资产：CC0-1.0；许可和包哈希见`media-src/provenance.json`。
- 权威角色库：`media-src/blender/libraries/character.blend`。
- 角色：MakeHuman网格，163骨骼；详细导入证据见`docs/handoff/exercise-media-handoff.md`。
- 已有原型：`supported-standing-march-v2.blend`和构建报告，但视觉门禁未通过。

Blender不在PATH，必须使用绝对路径。

## 3. 25项来源决策

机器可读矩阵：

`docs/research/data/move28-3d-candidate-matrix.json`

本地审核台：

`media-build/source-research/move28-3d-candidate-review.html`

当前分类：

- 15项：GymVisual精确采购候选；
- 3项：需要受控裁剪或设置说明的编辑候选；
- 3项：没有精确商业候选，优先专业定制3D；
- 4项：现有候选与动作合同分叉，保持未解决，优先寻找新商品，找不到则纳入专业定制。

确定优先自制/定制的3项：

1. `wall-hip-hinge`：臀部后移轻触墙，无PVC杆；
2. `bird-dog-regression`：一只手全程贴垫前滑，另外三点支撑；
3. `supported-standing-march`：双手持续扶稳固椅背，小幅交替抬膝。

保持未解决、不得采用当前商品的4项：

1. `seated-leg-raise`：需证明有靠背坐姿、直立躯干、交替小幅抬膝；
2. `ankle-circle`：需坐稳、一脚稍离地且膝盖不动；
3. `dead-bug`：标准对侧伸展不是屈膝脚跟点地退阶；
4. `calf-stretch`：需椅上、脚跟着地、无拉力工具、主动勾脚保持。

新增编辑候选：`high-seat-sit-to-stand`使用GymVisual `16441 Bodyweight Bench Squat (female)`；逐帧动作路径为徒手坐到长凳再站起，但普通凳高不能替代本地`high_seat`合同，产品必须继续要求更高稳固座面。证据SHA-256：`524b58efaa70cf156c13276d180d940906d39645fb4298035b19021e0fbf87f6`。

`flat-walk`已在2026-08-12找到并逐帧核验GymVisual `Walking on Treadmill`：跑台水平、向前步行、步态完整，转为精确候选。

内部候选评估、编辑、转码和产品接线不受版权询证阻塞。付款、联系供应商、委托第三方均为外部动作，必须先取得用户明确授权。

## 4. 三条自制路线比较

### 路线A：纯Blender手工IK/关键帧

适用：约束明确、动作简单、器械接触可结构化的动作，例如墙触髋铰链、脚跟滑动、坐姿勾脚。

优点：

- 动画关键帧和场景由项目自行制作、可重复；
- 角色基于有明确CC0来源的MakeHuman捆绑基础资产，不等于从零原创全部模型；
- 可对接触、轨迹和循环精确编码。

缺点：

- 人体动作容易僵硬；
- 扶椅踏步原型已经证明，仅凭手调IK容易出现错误抬膝、遮挡和低质人物表现；
- 不适合直接批量制作25项。

结论：只用于简单动作、器械和最后的接触修正，不作为全套动作源。

### 路线B：自有视频 + FreeMoCap

适用：快速单动作MVP、一个或多个自有摄像机、真人能准确执行动作。

优点：

- 动作语义来自真人；
- Windows支持，内部生产效率较高；
- 很适合扶椅、靠墙、坐姿等特殊动作。

限制：

- FreeMoCap为AGPL-3.0；将其作为内部生产工具，不嵌入或分发到Move28产品；
- 骨骼会有抖动、脚滑和接触误差；
- 输出仍需Blender清理和重定向。

结论：首个动作MVP的最快路线。

### 路线C：自有多机位视频 + Pose2Sim + OpenSim

适用：安全敏感、关节轨迹和支撑必须严格验证的正式生产链。

优点：

- Pose2Sim为BSD-3-Clause；
- OpenSim为Apache-2.0，明确适合商业使用；
- 可获得更可靠的3D运动学和关节角证据；
- 可将人体运动学QA与最终视觉渲染分开。

限制：

- 需要同步多机位、标定板、相机参数和更复杂清理；
- 首次搭建时间高于FreeMoCap。

结论：正式可扩展路线；先用一个动作与FreeMoCap做A/B试验，再决定主链。

### 不采用

- 文生视频直接生成康复动作：肢体、器械接触、左右关系和循环不可靠；
- ComfyUI-MotionCapture/GVHMR：打包模型仅允许研究/非营利，且SMPL/SMPL-X另有许可；
- HY-Motion：地域与商业条款不适合全球公开产品；
- 未审查的Blender MCP工作流：自定义节点/插件等同执行第三方代码；
- 继续打磨低质量手工MakeHuman IK作为25项统一方案。

## 5. 推荐分阶段实施

### Phase 0：冻结合同

每个动作先建立一个声明文件，至少包含：

```json
{
  "exerciseId": "supported-standing-march",
  "sourceTakeId": "take-001",
  "requiredContacts": ["left-hand-chair", "right-hand-chair", "support-foot-ground"],
  "forbiddenPatterns": ["trunk-lean", "straight-leg-kick", "support-loss"],
  "targetMuscles": ["hip-flexors", "quadriceps"],
  "fps": 24,
  "frameCount": 96,
  "releaseBlocked": true
}
```

合同必须来自`src/data/exercise-catalog.js`，不能仅凭动作名称编写。

### Phase 1：录制自有动作源

先只录制`wall-hip-hinge`和`supported-standing-march`，分别代表墙面接触与扶椅平衡。

录制要求：

- 演示者签署内部素材使用授权；
- 不拍脸或使用纯色服装，避免隐私和品牌；
- 2～3机位，固定相机，60fps优先；
- 同步拍手/闪光；
- 标定空间尺寸、地面、椅背高度、墙面位置；
- 每个动作录制5次完整、缓慢、无口令干扰的循环；
- 保存原视频哈希、录制日期、演示者授权和take编号；
- 原视频仅保存在`media-src/capture/`或安全外部存储，不进入发布包。

### Phase 2：FreeMoCap与Pose2Sim双路线Spike

同一take分别处理，输出：

- 原始3D关键点/骨骼；
- 清理后的运动；
- Blender可导入FBX/BVH或等价轨迹；
- 关节角、接触和抖动报告；
- 路线耗时和失败原因。

选择标准：

- 脚滑和手—支撑漂移最小；
- 膝、髋、踝轨迹可解释；
- 循环端点可闭合；
- Blender重定向后不出现关节翻转；
- 处理流程可脚本化重跑。

若Pose2Sim主链通过，则以OpenSim做关节角/运动学QA；FreeMoCap保留为快速预览路径。

### Phase 3：Blender重定向和视觉统一

1. 从`character.blend`创建动作专用副本，绝不覆盖权威人物库；
2. 导入BVH/FBX或关键点；
3. 建立骨骼映射表，禁止按骨名猜测后静默跳过；
4. 将root运动、髋膝踝、肩肘腕旋转重定向；
5. 用IK修正安全关键接触：手—椅、臀—墙、脚—地、脚跟—地；
6. 平滑抖动，但不得改变动作语义或幅度；
7. 首尾姿势匹配，删除重复尾帧；
8. 使用统一灰白材质、深灰轮廓、白底、固定灯光和正交/长焦镜头；
9. 红色区域必须绑定同一身体网格的目标肌群面，不能使用漂浮贴片；
10. 器械使用项目自制程序化组件，记录尺寸和接触锚点。

现有代码参考：

- `media-src/scripts/build_supported_march_v2.py`
- `media-src/scripts/build_character_library.py`
- `media-src/scripts/render_review_sequence.py`
- `media-src/scripts/qa_supported_march.py`

不要复制现有v2的视觉结果；它是失败证据，只参考其可复现结构、接触距离记录和输出隔离方式。

### Phase 4：渲染与编码

母版建议：

- 512×512；
- 24fps；
- 4秒/96个不重复尾帧；
- PNG帧序列；
- Blender Standard色彩变换；
- 白底、不透明；
- 人物占画布高度68%～82%。

调用示例：

```bash
cd /c/move28-live
'C:/move28-tools/blender-5.2.0-windows-x64/blender.exe' \
  --background \
  --python-exit-code 1 \
  --python media-src/scripts/<action-builder>.py
```

编码：

```bash
ffmpeg -y -framerate 24 -i frames/frame-%04d.png \
  -c:v libvpx-vp9 -pix_fmt yuv420p -crf 32 -b:v 0 review.webm

ffmpeg -y -framerate 24 -i frames/frame-%04d.png \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart review.mp4
```

GIF使用`palettegen/paletteuse`两遍；产品最终以WebM优先，GIF只作兼容回退。

## 6. 自动QA合同

每项必须生成JSON报告，任一失败则退出非0，且不留下“部分成功”manifest：

- 源合同、源take、Blend、96帧、WebM、MP4、GIF、poster均存在；
- 尺寸、fps、帧数、时长、无音轨符合合同；
- 每个文件有SHA-256；
- 首尾帧循环差异在记录阈值内；
- 白底比例、红色比例、人物包围盒符合范围；
- 目标红色区域不漂移、不闪烁；
- 关键接触距离逐帧记录；
- 脚滑、支撑丢失、膝轨迹、躯干倾斜超过阈值时失败；
- 生成覆盖全部帧的编号联系表，不只抽起中末三帧；
- 输出必须位于`media-build/generated-motion/<exercise-id>/`。

安全关键动作建议记录：

- 手到支撑距离；
- 支撑脚高度和水平漂移；
- 膝—脚尖相对轨迹；
- 躯干与世界竖直夹角；
- 墙触帧的臀部—墙面距离；
- 椅子起立的座面接触/离开帧；
- 跑步机坡度必须在场景数据中显式为0，不能靠画面猜测。

## 7. 人工审核合同

自动QA通过不等于批准。分别记录：

- `motionGate`：动作名称、路径、幅度、完整返回；
- `safetyGate`：支撑、关节、躯干、保守退阶；
- `visualGate`：解剖层次、红肌群、器械、构图、循环；
- `technicalGate`：格式、尺寸、帧数、哈希、离线加载。

当前阶段按用户明确决策暂时忽略版权与授权，`rightsGate`不作为开发前置；来源仍记录以维持素材身份审计。

四项全部通过且人工审核绑定精确SHA-256前，保持：

```json
{"releaseEligible": false, "releaseBlocked": true}
```

## 8. 资产身份与隐私

当前阶段暂时忽略版权与授权问题，以下来源信息只用于素材身份和可重复构建，不构成内部开发前置：

- Blender、MakeHuman、FreeMoCap、Pose2Sim和OpenSim版本；
- 人体模型、服装、纹理、HDRI、字体和插件来源；
- 候选预览、动作源及其SHA-256；
- 自有录制take和访问范围。

内部研究、编辑、转码、动作核验和产品接线无需等待许可或权利复审。`unresolved`表示当前商品动作语义不匹配，必须寻找精确候选或进入定制，不能修改动作合同迁就素材。原始人体视频属于敏感素材，限制访问，产品只使用审核后的3D渲染结果。正式发布继续25/25阻塞，直到用户另行确定正式发布政策并完成独立发布批准。

## 9. 目录建议

```text
media-src/
  capture/<exercise-id>/<take-id>/       # 原视频、授权、标定；始终忽略
  motion-contracts/<exercise-id>.json    # 默认忽略；审查后逐文件精确放行
  motion-clean/<exercise-id>/            # 默认忽略；仅可再分发的具体文件可逐项放行
  blender/actions/<exercise-id>.blend    # 默认忽略；来源和依赖审核后逐文件放行
  scripts/build_<exercise-id>.py         # 默认忽略；代码审查后逐文件放行
media-build/
  generated-motion/<exercise-id>/
    frames/
    review.webm
    review.mp4
    review.gif
    poster.png
    contact-sheet.png
    qa-report.json
    manual-review.json
```

不得用`git add .`。提交前逐路径确认，不提交原始视频、第三方预览、缓存、`.blend1`、`__pycache__`或部分帧。

## 10. 接手Agent的第一批任务

只做一个Spike，不批量25项：

1. 阅读本文件、`CURRENT.md`、动作目录和媒体发布边界；
2. 创建`supported-standing-march`动作合同；
3. 规划自有2～3机位录制，不实际联系或拍摄前先让用户确认；
4. 对同一take运行FreeMoCap与Pose2Sim；
5. 生成两套轨迹对比报告；
6. 选胜者重定向到`character.blend`副本；
7. 修复双手—椅背、支撑脚—地面接触和抬膝轨迹；
8. 渲染96帧和WebM；
9. 生成全帧联系表和QA报告；
10. 请求人工动作、安全、视觉审核；
11. 通过后可继续`wall-hip-hinge`，但仍须单独取得用户对专业定制/录制的明确授权；
12. `seated-leg-raise`保持`unresolved`：先继续检索精确商品；只有检索失败、矩阵正式改为`custom-3d`、更新证据并取得用户授权后，才允许制作；
13. 不再以“扶椅踏步、坐姿抬腿、坐姿腿举三个样例”为批量生产前置；当前主线是商业3D采购优先、专业定制补缺，任何全量自制组件库需重新立项批准。

## 11. 验证命令

```bash
cd /c/move28-live
python -m py_compile media-src/scripts/*.py
python scripts/validate_exercise_media.py
npm run test
```

发布模式在正式素材未完成时应继续失败；不要为了让测试变绿而放宽门禁。

## 12. 完成定义

一个自制动作只有在以下条件全部满足时才算“发布候选”：

- 动作合同完整且与运行时目录一致；
- 原始take身份与制作链可追溯；
- 3D轨迹、骨骼映射和清理步骤可重跑；
- 接触与关节QA通过；
- 全帧人工审核通过；
- 视觉达到统一灰白解剖人物＋红肌群标准；
- WebM/GIF/poster技术门禁通过；
- 所有产物绑定SHA-256；
- 独立规格、代码质量、动作安全和视觉复审通过；
- 当前阶段不得修改正式manifest；正式发布政策需由用户另行明确并完成独立发布批准；
- HTTP、`file://`、移动端、离线和失败降级通过。

在此之前只能称为研究原型，不能称为已完成或可发布素材。
