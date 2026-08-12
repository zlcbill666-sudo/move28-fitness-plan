# 25个动作重制任务交接记录

- 更新时间：2026-08-10
- 项目目录：`C:\move28-live`
- 当前任务：按同一套原创3D流程重制动作目录中的25个动作
- 当前状态：**进行中，尚未形成发布候选**
- Git状态：本轮新增内容均为未跟踪文件；未提交、未推送、未部署

> 当前策略覆盖（2026-08-13）：按用户明确决策，内部研究、编辑、转码、动作核验和产品接线暂时忽略版权与授权，不以许可询证或版权复审为开发前置。来源记录仅用于素材身份审计。正式manifest继续25/25阻塞，直到用户另行明确正式发布政策并完成独立发布批准；付款、联系供应商、委托第三方、推送、PR和HTTPS部署仍需明确授权。

## 一、目标与固定标准

25个动作统一使用：

- MakeHuman 1.3.0 官方捆绑CC0基础人体；
- Blender 5.2.0 LTS；
- 同一人物、163骨骼、灰白人物材质、纯白背景、统一灯光和镜头体系；
- 红色目标肌群；
- 原创程序化器械和动作，不把旧GIF或ExerciseDB素材作为正式发布资产；
- 每项内部候选必须经过动作语义、安全、视觉和技术审核；
- 最终输出MP4/WebM、WebP首帧和兼容降级素材；
- 发布前验证HTTP、`file://`、移动端、减少动态和资源加载失败降级。

## 二、已完成项

### 1. MakeHuman官方基础资产

- 已下载并验证MakeHuman Community 1.3.0官方Windows包；
- 包大小：`340817639`字节；
- ZIP CRC：通过；
- SHA-256：`4437e431d3fcc1f882a639079e68b298ec69e7920af6ec5e5561496774ebbb91`；
- 许可范围固定为官方捆绑资产，CC0-1.0；
- 禁止第三方社区资产和未知许可资产；
- 官方许可原文已保存到项目；
- MakeHuman自动导出插件已完成并真实运行；
- 基础FBX已成功生成，大小约`1351132`字节；
- 导出状态为`ok: true`，骨骼为`default.mhskel`。

### 2. Blender统一人物库

- MakeHuman FBX已真实导入Blender 5.2.0；
- 主体网格：`move28_humanMesh`，13,380顶点；
- 眼部网格：`high-polyMesh`，1,064顶点；
- 骨骼数量：163；
- 导入人物高度：约`16.368091`个Blender场景单位；
- 已建立中灰高粗糙度人物材质、浅灰眼部材质、白色世界背景、三点光和接触阴影；
- 已保存权威人物库`character.blend`；
- 已生成中立诊断图；
- 已排除胶囊人方案，失败的胶囊人源脚本、`.blend`和正式预览已删除；仅残留一个无效的`__pycache__`文件，提交前需清理。

### 3. “扶椅原地踏步”代表性原型

已完成原型场景构建：

- 稳固开放式椅背，避免实心椅背遮挡膝轨迹；
- 双手扶椅IK；
- 双腿5骨骼IK；
- 24fps；
- 关键帧：1、25、49、73、97；
- 左右腿交替小幅抬起；
- 脚部峰值位移约1.05场景单位；
- 红色髋屈肌/股四头肌区域直接分配到主体网格面，不再使用会脱离身体的复制网格；
- 当前红色面数：612；
- 已保存原型`.blend`、峰值PNG和构建报告。

真实构建报告：

```json
{
  "ok": true,
  "exerciseId": "supported-standing-march",
  "frames": [1, 25, 49, 73, 97],
  "fps": 24,
  "highlightedFaces": 612,
  "requiredContacts": [
    "left_hand-chair",
    "right_hand-chair",
    "support_foot-ground"
  ]
}
```

原型仍只是**动画测试候选**，不是发布合格素材。最后一次把红色权重阈值从0.42提高到0.62后已重建，但尚未完成新的视觉复审和完整循环复审。

### 4. 25项统一架构与安全基线

- 已确认动作目录共有25项；
- 已只读建立25项动作安全/视觉验收矩阵；
- 已提出统一架构：共享人物/骨骼/材质/灯光/镜头/器械库 + 25份声明式动作数据 + 无状态构建脚本；
- 该矩阵和架构目前只存在于Hermes子代理输出缓存，尚未整理为项目内的正式`motion.schema.json`和25份动作声明文件；
- 子代理完整输出位置：
  - `C:\Users\Administrator\AppData\Local\hermes\profiles\weixin\cache\delegation\subagent-summary-1-20260810_215016_442868.txt`
  - `C:\Users\Administrator\AppData\Local\hermes\profiles\weixin\cache\delegation\subagent-summary-2-20260810_215016_444864.txt`

## 三、未完成项

### 动作制作

- [ ] “扶椅原地踏步”96帧完整动画序列渲染；
- [ ] “扶椅原地踏步”MP4/WebM编码、接触表和循环审核；
- [ ] “坐姿抬腿”代表性原型；
- [ ] “坐姿腿举”复杂器械代表性原型；
- [ ] 3个代表性原型共同通过动作安全与视觉门禁；
- [ ] 25份声明式动作文件和JSON Schema；
- [ ] 共享椅子、墙、垫、弹力带、拉索、力量器械、跑步机和椭圆机组件库；
- [ ] 剩余24项动作的场景、IK/关键帧、红色肌群、器械、镜头和循环；
- [ ] 25项逐条动作语义、安全和视觉验收。

### 媒体输出与产品接入

- [ ] 25项MP4；
- [ ] 25项WebM；
- [ ] 25项WebP首帧；
- [ ] GIF或其他兼容降级素材；
- [ ] 每个正式输出的SHA-256；
- [ ] 更新媒体台账为正式可发布状态；
- [ ] 将新媒体接入动作目录/网站；
- [ ] HTTP验证；
- [ ] `file://`验证；
- [ ] 移动端和触控验证；
- [ ] `prefers-reduced-motion`验证；
- [ ] 媒体加载失败降级验证；
- [ ] 发布包/ZIP备份；
- [ ] 公开HTTPS发布候选。

### 审核与发布

- [ ] 独立规格复审；
- [ ] 独立代码质量复审；
- [ ] 正式发布政策由用户另行明确；当前内部阶段不执行版权复审；
- [ ] 独立动作安全复审；
- [ ] 发布模式媒体校验通过；
- [ ] Git清理、提交和发布候选构建；
- [ ] 推送、PR和HTTPS部署仍需用户单独明确授权。

## 四、关键项目文件

### 来源、许可和基础人体

- `C:\move28-live\media-src\provenance.json`
- `C:\move28-live\media-src\licenses\MakeHuman-LICENSE.md`
- `C:\move28-live\media-src\licenses\MakeHuman-LICENSE.ASSETS.md`
- `C:\move28-live\media-src\makehuman\z_move28_export.py`
- `C:\move28-live\media-src\base\move28-human.fbx`
- `C:\move28-live\media-src\base\makehuman-export-status.json`
- `C:\move28-live\media-src\base\blender-import-report.json`
- `C:\move28-live\media-src\base\textures\brown_eye.png`

### Blender源资产和脚本

- `C:\move28-live\media-src\scripts\build_character_library.py`
- `C:\move28-live\media-src\scripts\build_supported_march_prototype.py`
- `C:\move28-live\media-src\scripts\render_review_sequence.py`
- `C:\move28-live\media-src\blender\libraries\character.blend`
- `C:\move28-live\media-src\blender\prototypes\supported-standing-march.blend`

### 当前构建输出

- `C:\move28-live\media-build\diagnostics\character-neutral.png`
- `C:\move28-live\media-build\prototypes\supported-standing-march\peak-frame.png`
- `C:\move28-live\media-build\prototypes\supported-standing-march\build-report.json`

### 目录、计划和测试

- `C:\move28-live\src\data\exercise-catalog.js`
- `C:\move28-live\docs\plans\2026-08-10-public-exercise-media-redesign.md`
- `C:\move28-live\tests\unit\makehuman-export-plugin.test.cjs`

### 本地生产工具（不随产品分发）

- Blender：`C:\move28-tools\blender-5.2.0-windows-x64\blender.exe`
- MakeHuman安装目录：`C:\Users\Administrator\AppData\Local\makehuman-community`
- MakeHuman下载包：`C:\move28-tools\makehuman-community-1.3.0-windows.zip`
- FFmpeg：当前PATH中的`ffmpeg`

## 五、测试和真实执行结果

### 完整项目测试

执行：

```bash
cd /c/move28-live
npm run test
```

最近结果：

- tests：358
- pass：358
- fail：0
- cancelled：0
- skipped：0
- duration：约5.335秒

### 新增MakeHuman测试

包含在完整测试内：

- `MakeHuman导出插件不得把正常SystemExit当作失败`：通过；
- `MakeHuman基础资产来源记录必须完整且限于捆绑CC0资产`：通过。

### Blender真实执行

`build_character_library.py`：

- Blender 5.2.0后台运行成功；
- FBX导入成功；
- `meshCount: 2`；
- `boneCount: 163`；
- `height: 16.368091208860278`；
- `.blend`、JSON报告和PNG均生成。

`build_supported_march_prototype.py`：

- Blender 5.2.0后台运行成功；
- 原型`.blend`、峰值PNG和构建报告均生成；
- 最近退出码：0。

### 尚未验证

- 96帧完整循环没有渲染；
- MP4/WebM没有编码；
- 最后一次红色阈值调整后的峰值图没有完成新的视觉复审；
- 其余24项动作没有制作或测试；
- 发布模式媒体门禁预期仍失败，因为25项正式素材尚未完成。

## 六、当前Git与清理状态

最近`git status --short`：

```text
?? media-build/
?? media-src/
?? tests/unit/makehuman-export-plugin.test.cjs
```

注意：

- 当前所有本轮文件均未提交；
- `media-src`内存在Blender自动备份`.blend1`、Python `__pycache__`和`.pyc`；
- `media-build`属于生成输出；
- 提交前应决定哪些源资产需要版本控制，并清理`.blend1`、`__pycache__`、`.pyc`及临时构建目录；
- 不要把本地MakeHuman/Blender安装目录或340MB下载包提交进仓库。

## 七、当前阻塞点

尝试渲染96帧前，命令包含：

```bash
rm -rf media-build/prototypes/supported-standing-march/frames
```

Hermes将该操作判定为需要删除授权；授权提示超时，因此整条渲染命令被阻止。系统明确要求：

- 不得在未得到用户明确授权前重试同一删除；
- 不得换一种命令绕过授权实现相同删除结果；
- 当前扫描未发现已生成的`frames`文件，因此没有任何96帧序列可继续编码。

这不是MakeHuman下载问题。先前被终止的两个慢速分片下载进程已由并行分片流程替代，官方包已完整校验并投入使用。

## 八、下一步命令

### 1. 先获得用户明确授权

需要用户明确回复类似：

```text
允许清理旧帧并继续制作25个动作
```

### 2. 授权后渲染“扶椅原地踏步”96帧评审序列

```bash
cd /c/move28-live
rm -rf media-build/prototypes/supported-standing-march/frames && \
export MOVE28_BLEND='C:\move28-live\media-src\blender\prototypes\supported-standing-march.blend' \
MOVE28_FRAME_DIR='C:\move28-live\media-build\prototypes\supported-standing-march\frames' && \
'C:/move28-tools/blender-5.2.0-windows-x64/blender.exe' \
  --background \
  media-src/blender/prototypes/supported-standing-march.blend \
  --python-exit-code 1 \
  --python media-src/scripts/render_review_sequence.py
```

预期生成`frame-0001.png`至`frame-0096.png`，不包含与首帧重复的第97帧。

### 3. 验证帧数后编码评审视频

先验证帧数和首尾文件，确认不是部分渲染，再运行FFmpeg。建议命令：

```bash
cd /c/move28-live
python -c "from pathlib import Path; p=Path('media-build/prototypes/supported-standing-march/frames'); files=sorted(p.glob('frame-*.png')); assert len(files)==96,len(files); print(files[0],files[-1])"
ffmpeg -y -framerate 24 \
  -i media-build/prototypes/supported-standing-march/frames/frame-%04d.png \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  media-build/prototypes/supported-standing-march/review.mp4
ffmpeg -y -framerate 24 \
  -i media-build/prototypes/supported-standing-march/frames/frame-%04d.png \
  -c:v libvpx-vp9 -pix_fmt yuv420p -crf 32 -b:v 0 \
  media-build/prototypes/supported-standing-march/review.webm
```

注意：编码前应先用`ffmpeg -version`确认当前可用编码器；命令不得在帧数不足时继续。

### 4. 循环审核通过后继续

按顺序：

1. 生成接触表并严审帧1、25、49、73、96；
2. 修复扶椅踏步的动作、接触、红色区域或镜头问题；
3. 制作“坐姿抬腿”原型；
4. 制作“坐姿腿举”复杂器械原型；
5. 三个代表性原型共同通过后，建立`motion.schema.json`和25份声明式动作文件；
6. 批量制作剩余22项，但每项仍逐条审核，不得只凭脚本成功标记完成；
7. 接入网站并执行媒体、HTTP、`file://`、移动端、减少动态、发布包和独立复审。

## 九、停止点

本交接文件写入后应停止继续开发。当前没有进行中的渲染、编码、推送、PR或部署操作。
