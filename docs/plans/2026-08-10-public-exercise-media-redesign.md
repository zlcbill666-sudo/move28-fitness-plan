# Public Exercise Media Redesign Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 用可审计、可商用、动作准确的原创高清动画替换25个现有动作GIF，同时保留最初动作图的教学效果。

**Architecture:** 使用 Blender 生成统一人物、器械、镜头和灯光的方形动作主素材；目标肌群用红色材质显示，其他人体与器械使用灰度材质。每个动作从同一可复现源文件渲染为透明/白底帧序列，再由 FFmpeg 输出 WebM、MP4、静态 WebP 和兼容GIF；网页通过 `<video>` 优先播放高清循环，失败或减少动态时回退到本地首帧。

**Tech Stack:** Blender、Blender Python、FFmpeg/ffprobe、Node.js、Playwright、原生HTML/CSS/JavaScript、Python标准库/Pillow（仅审计与联系表，不用于简易人物绘制）。

---

## 1. 已确认的来源事实

- `02`–`18` 共17个文件来自 AscendAPI / ExerciseDB V1：`https://static.exercisedb.dev/media/{exerciseId}.gif`。
- 原始下载脚本、Exercise ID、文件名映射已从2026-08-07原始会话恢复。
- 2026-08-10重新请求17个URL，远端字节与仓库文件SHA-256全部一致。
- 原脚本把免费数据集描述为“个人非商业教育使用，要求署名”。当前官方公开页面没有提供足以证明“免费API媒体可下载后随商业产品永久再分发”的明确文本。
- `19`–`26` 为项目自有 Pillow 程序化动画，权利清楚，但视觉质量不符合公开产品要求。
- 因此25个现有动作均进入替换范围：17个解决商业权利与清晰度问题，8个解决视觉质量问题。

## 2. 视觉与交互合同

### 2.1 保留的教学效果

- 1:1方形构图，白色或透明背景；
- 灰度人体、服装和器械；
- 当前动作主要目标肌群以 MOVE 28 红色高亮；
- 固定镜头，不切镜、不缩放、不晃动；
- 起点停顿、受控发力、终点停顿、受控回位；
- 不在动画画面内放长文本、水印、品牌或方向箭头；
- 器械和支撑物必须清楚到足以理解动作环境；
- 运动幅度按目录中的入门安全版本，而不是按旧图的大重量或极限幅度。

### 2.2 禁止复制

- 不描摹旧GIF；
- 不逐帧复刻旧人物、器械、镜头或动画时间曲线；
- 不把旧GIF作为生成模型的像素级输入或训练素材；
- 只继承通用教学语言：灰度解剖表现、红色肌群、白底和固定镜头。

### 2.3 输出规格

每个动作必须包含：

| 资产 | 最低规格 | 用途 |
|---|---|---|
| Blender主文件 | 可复现渲染，完整材质/骨骼/关键帧 | 项目自有源文件 |
| 无损帧序列 | 768×768或更高，24fps | 审核与重新编码 |
| WebM | 512×512，VP9，无音频，循环2.5–5秒 | Chrome/Firefox首选 |
| MP4 | 512×512，H.264，无音频，`faststart` | Safari/iOS回退 |
| WebP首帧 | 512×512 | 减少动态、加载失败和分享预览 |
| GIF兼容版 | 360×360或更高，≤1.5MB | 旧界面/离线兜底，不作为首选 |

建议体积：WebM ≤600KB、MP4 ≤900KB、WebP ≤100KB。超出时应先优化画面和编码，不降低到无法辨认的清晰度。

### 2.4 播放与无障碍

- 默认静音、内联、循环；
- 用户点击卡片后才播放，离开视口或关闭训练步骤后暂停；
- 提供“播放/暂停”和“重新播放”控制；
- `prefers-reduced-motion: reduce` 时默认显示首帧，不自动播放；
- 动画加载失败时显示首帧和明确的中文降级提示；
- 动画永远不能替代文字动作步骤、安全提示或人工复核。

## 3. 动作媒体验收合同

每个动作必须记录：

- 稳定动作ID、中文名、源文件路径和输出路径；
- 人物、服装、器械、环境和材质来源；
- 每个外部基础资产的作者、原URL、许可、下载日期和原始SHA-256；
- 项目修改说明和输出SHA-256；
- 主要目标肌群与辅助肌群；
- 起始姿势、终止姿势、运动平面和器械接触点；
- 不应出现的错误动作；
- 动作安全审核人、视觉审核人、审核日期和结论。

状态枚举：

- `draft`：可内部预览；
- `motion_review`：关键帧和轨迹待审；
- `visual_review`：画面、材质和循环待审；
- `rights_review`：来源或授权待审；
- `approved`：四项门禁全部通过；
- `blocked`：不得进入发布包。

## 4. 制作批次

### 原型批次

1. `supported-standing-march`（扶椅原地踏步）：解决当前最明显的粗糙素材投诉；验证人物、椅子、双手支撑、交替抬膝和移动端清晰度。
2. `seated-leg-raise`（坐姿抬腿）：验证坐姿人物、椅子复用和红色髋屈肌/股四头肌表达。
3. `seated-leg-press`（坐姿腿举）：验证复杂器械、接触点和大幅度动作。

原型批次未通过视觉和动作审查前，不批量生产。

### 批次A：无器械/简单支撑

- 坐姿抬腿、脚踝绕环、臀桥、墙触髋铰链、墙壁俯卧撑、死虫式、仰卧脚跟滑动、四点支撑单肢滑动、大腿后侧拉伸、小腿拉伸、扶椅提踵、扶椅原地踏步、坐姿徒手伸膝、高位坐姿起立。

### 批次B：弹力带/拉力器

- 站姿弹力带推胸、弹力带划船、抗旋转推压。

### 批次C：固定器械/有氧器械

- 坐姿腿举、坐姿腿弯举、推胸机、坐姿划船、坐姿腿屈伸、髋外展机、椭圆机、平地慢走。

## 5. 实施任务

### Task 1: 建立媒体清单与失败门禁

**Files:**
- Create: `assets/exercises/manifest.json`
- Create: `scripts/validate_exercise_media.py`
- Create: `tests/media/test_exercise_media_contract.py`
- Modify: `docs/media-source-licenses.md`

**Steps:**
1. 写失败测试：25个目录项都必须存在manifest记录；旧17项权利状态不得是approved；每个approved项必须有源文件和全部输出。
2. 运行媒体测试，确认因manifest缺失而失败。
3. 创建版本化manifest和JSON Schema级别的确定性验证器。
4. 加入路径、哈希、尺寸、时长、编码、体积和状态校验。
5. 运行测试通过并提交。

### Task 2: 建立Blender可复现模板

**Files:**
- Create: `media-src/blender/move28_base.blend`
- Create: `media-src/scripts/render_exercise.py`
- Create: `media-src/scripts/build_outputs.py`
- Create: `media-src/README.md`

**Steps:**
1. 锁定Blender版本、FFmpeg版本、颜色空间、帧率、镜头和灯光。
2. 建立统一人物骨骼、灰度材质、红色肌群覆盖材质、地面和相机。
3. 脚本化输入动作ID、帧范围、相机预设、器械集合和输出目录。
4. 在空白动作上生成可重复哈希的测试帧。
5. 记录基础人物/模型的权利来源；权利不明的资产不得进入模板。

### Task 3: 制作扶椅原地踏步原型

**Files:**
- Create: `media-src/blender/supported-standing-march.blend`
- Create: `assets/exercises/supported-standing-march/*`
- Modify: `assets/exercises/manifest.json`

**Steps:**
1. 锁定入门动作：稳固椅、双手轻扶、支撑脚不移动、单膝小幅抬起、躯干不摇晃。
2. 制作左右交替循环关键帧；不表现高抬腿、跺脚或悬挂椅背。
3. 渲染中间帧联系表和完整循环。
4. 运行媒体验证器和视觉差异检查。
5. 进行动作安全审查和视觉审查；两项通过后才标记approved。

### Task 4: 完成两个跨难度原型

按相同RED→GREEN→REVIEW流程制作坐姿抬腿和坐姿腿举，验证椅子复用与复杂器械管线。

### Task 5: 批量制作剩余22个动作

每个动作单独提交源文件、输出、manifest记录和审核表；不得用“批量生成成功”替代逐条动作审核。

### Task 6: 接入网页媒体组件

**Files:**
- Modify: `src/data/exercise-catalog.js`
- Modify/Create: `src/ui/exercise-media.js`
- Modify: 动作库和训练引导渲染模块
- Modify: `assets/css/*`
- Test: Node单测与Playwright媒体测试

**Steps:**
1. 先写HTTP、`file://`、减少动态、加载失败和离开视口暂停测试。
2. 在目录中增加结构化`media`字段，保留旧`gif`字段直到迁移完成。
3. 实现`<video>`＋`<picture>`降级组件；不引入运行时网络依赖。
4. 迁移全部25项并删除正式界面对旧GIF的引用。
5. 验证移动端布局、无横向溢出、低高度横屏和训练引导。

### Task 7: 发布门禁与独立复审

1. 运行媒体合同测试、单元测试、全量Playwright。
2. 解压发布候选，验证HTTP和真实`file://`。
3. 独立版权复审：来源、许可、SHA、署名和发布范围。
4. 独立动作安全复审：25项逐条动作一致性和错误示范。
5. 独立视觉复审：统一性、清晰度、循环、器械和移动端。
6. 独立代码质量复审。
7. 所有门禁通过后生成本地发布候选；推送、PR、合并和HTTPS部署仍需明确外部授权。

## 6. 发布阻塞规则

以下任一情况阻止发布：

- 任何动作仍引用商业权利不明的旧ExerciseDB GIF；
- 任何新媒体缺少可编辑源文件或SHA-256；
- 基础人物、服装、器械、纹理或字体来源不明；
- 动作轨迹与目录文字不一致；
- 器械接触点错误、关节明显变形、肢体穿模或循环跳变；
- 目标肌群标错；
- 只通过HTTP、未通过`file://`；
- 自动播放忽略减少动态设置；
- 动画失败导致训练步骤或安全说明不可用；
- 任一安全、隐私、状态机或人工复核测试回归。
