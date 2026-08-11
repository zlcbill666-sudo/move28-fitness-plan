# 媒体来源与许可记录

本记录用于审计项目新增动作媒体的来源、权利和动作一致性。未列入本记录或权利状态不明确的新增媒体不得标记为 `approved`。

## 2026-08-10：首批17个 ExerciseDB 动作媒体追溯

### 结论

`assets/gifs/02_坐姿抬腿.gif` 至 `assets/gifs/18_小腿拉伸.gif` 均来自 AscendAPI / ExerciseDB V1 免费媒体 CDN。原始制作会话中的下载脚本记录了 Exercise ID 和完整 URL；2026-08-10 再次请求对应 URL 后，17个远端响应与仓库文件的 SHA-256 均逐字节一致。

这17个文件虽然已在目录中用于动作内容审核，但仓库没有保存能够明确覆盖公开商业产品分发的媒体授权文本。ExerciseDB 的公开 GitHub 仓库标注 AGPL-3.0，官方文档也面向健身产品提供订阅服务；然而仓库软件许可是否覆盖 CDN 媒体输出、以及免费API是否允许下载后随商业产品永久再分发，公开页面未作足够明确的说明。因此：

- 来源状态：**已确认**；
- 动作匹配状态：**已审核，但部分仅作轨迹参考**；
- 商业权利状态：**未确认（blocked）**；
- 公开产品处置：取得明确书面商业媒体授权前，不得把这17个文件视为可长期发布的正式商业资产；应由原创、可追溯的新媒体替换。

### 来源映射

| 文件 | 动作 ID | ExerciseDB 名称 | Exercise ID | 原始 URL | 商业权利 |
|---|---|---|---|---|---|
| `02_坐姿抬腿.gif` | `seated-leg-raise` | seated leg raise | `Hgs6Nl1` | `https://static.exercisedb.dev/media/Hgs6Nl1.gif` | blocked |
| `03_脚踝绕环.gif` | `ankle-circle` | ankle circles | `uL9CsKm` | `https://static.exercisedb.dev/media/uL9CsKm.gif` | blocked |
| `04_坐姿腿举.gif` | `seated-leg-press` | sled 45° leg press (side pov) | `2Qh2J1e` | `https://static.exercisedb.dev/media/2Qh2J1e.gif` | blocked |
| `05_坐姿腿弯举.gif` | `seated-leg-curl` | lever seated leg curl | `Zg3XY7P` | `https://static.exercisedb.dev/media/Zg3XY7P.gif` | blocked |
| `06_臀桥.gif` | `glute-bridge` | low glute bridge on floor | `u0cNiij` | `https://static.exercisedb.dev/media/u0cNiij.gif` | blocked |
| `07_推胸机.gif` | `chest-press-machine` | lever chest press | `DOoWcnA` | `https://static.exercisedb.dev/media/DOoWcnA.gif` | blocked |
| `08_坐姿划船.gif` | `seated-row` | lever seated row | `7I6LNUG` | `https://static.exercisedb.dev/media/7I6LNUG.gif` | blocked |
| `09_抗旋转推压.gif` | `pallof-press` | band horizontal pallof press | `9pa4H5m` | `https://static.exercisedb.dev/media/9pa4H5m.gif` | blocked |
| `10_高位坐姿起立.gif` | `high-seat-sit-to-stand` | smith chair squat | `Gu2rNJd` | `https://static.exercisedb.dev/media/Gu2rNJd.gif` | blocked |
| `11_坐姿腿屈伸.gif` | `seated-leg-extension` | lever leg extension | `my33uHU` | `https://static.exercisedb.dev/media/my33uHU.gif` | blocked |
| `12_髋外展机.gif` | `hip-abduction-machine` | lever seated hip abduction | `CHpahtl` | `https://static.exercisedb.dev/media/CHpahtl.gif` | blocked |
| `13_墙壁俯卧撑.gif` | `wall-push-up` | push-up (wall) | `LEH9jxP` | `https://static.exercisedb.dev/media/LEH9jxP.gif` | blocked |
| `14_死虫式.gif` | `dead-bug` | dead bug | `iny3m5y` | `https://static.exercisedb.dev/media/iny3m5y.gif` | blocked |
| `15_椭圆机.gif` | `elliptical-trainer` | walk elliptical cross trainer | `rjtuP6X` | `https://static.exercisedb.dev/media/rjtuP6X.gif` | blocked |
| `16_平地慢走.gif` | `flat-walk` | walking on incline treadmill | `rjiM4L3` | `https://static.exercisedb.dev/media/rjiM4L3.gif` | blocked |
| `17_大腿后侧拉伸.gif` | `hamstring-stretch` | hamstring stretch | `99rWm7w` | `https://static.exercisedb.dev/media/99rWm7w.gif` | blocked |
| `18_小腿拉伸.gif` | `calf-stretch` | seated calf stretch (male) | `17bqEXD` | `https://static.exercisedb.dev/media/17bqEXD.gif` | blocked |

### 视觉与媒体基准

共同视觉语言为白色背景、灰度解剖人物与器械、红色目标肌群、单动作固定机位、无画面文字和无可见水印。17个文件均为180×180 GIF；16个主要为12帧、约3秒循环，跑步机为24帧、约5秒循环。该规格只作为旧版效果参考，不作为新资产的清晰度上限。

原创替换媒体必须保留上述教学效果，但不得描摹、逐帧复刻或训练式复制具体原图。每个新动作须有独立源文件、创作记录、SHA-256、动作安全审核、目标肌群审核和明确的项目自有商业权利。

## `assets/gifs/19_弹力带划船.gif`

| 字段 | 记录 |
|---|---|
| 动作 ID | `band-row` |
| 中文名 | 弹力带划船 |
| 创建日期 | 2026-08-08 |
| 来源 | Move28 项目原创；使用 Python Pillow 11.3.0 程序化逐帧绘制，不含外部图片、字体、人物肖像或第三方素材 |
| 权利人 | Move28 项目 |
| 许可/用途 | 项目自有媒体；允许在本项目及其公开、商业发行版本中使用、复制、修改和分发 |
| 第三方署名要求 | 无 |
| 文件规格 | GIF89a，180×180，15 帧，循环播放；4×超采样绘制后以 LANCZOS 缩小，实现抗锯齿 |
| SHA-256 | `29cb4c95531f1c003159e3b3f69bef8c9999ea0c47a8e8b764cab1345e35dc4c` |
| 审核状态 | 已审核（approved） |

### 内容审核

动画专门表现站姿弹力带水平划船，而非复用其他动作：

- 固定点位于胸口高度，双股弹力带从固定点连接双手；
- 双脚稳定着地，训练者全程保持直立、中立躯干，并用垂直参考线强调不后仰；
- 肩部保持下沉，肘沿身体两侧后拉至手靠近肋骨；
- 15 帧按“伸臂 → 后拉 → 短暂停顿 → 受控回位”循环；
- 不叠加水平运动箭头，避免将手部方向误读为躯干前后移动；
- 画面不示范甩动、耸肩、肘外张或后仰借力。

审核结论：媒体与 `band-row` 的器械、场景、动作提示及安全边界一致，可随目录条目标记为 `approved`。

## Task6 第一组原创媒体

以下三项均由 Move28 项目使用 Python Pillow 11.3.0 程序化逐帧绘制，不含外部图片、字体文件拷贝、人物肖像或第三方素材。权利人为 Move28 项目，允许在本项目及其公开、商业发行版本中使用、复制、修改和分发，无第三方署名要求。

| 文件 | 动作 ID | 规格 | SHA-256 | 审核状态 |
|---|---|---|---|---|
| `assets/gifs/20_墙触髋铰链.gif` | `wall-hip-hinge` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `0295ad78498e4d3ce7a1a5363230c2c661539fdaeab1418d7ba0a879dff6e23a` | approved |
| `assets/gifs/21_站姿弹力带推胸.gif` | `standing-band-chest-press` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `34397eb48b7654597f7ab89d5ff4426ae6a853483f1c9cb4217830ef2687de16` | approved |
| `assets/gifs/22_坐姿徒手伸膝.gif` | `seated-knee-extension-unloaded` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `3a87632b92ad6b25d49046b58feb2ba2930e775922775bc49c63614e8318c5c8` | approved |

### 内容审核

- **墙触髋铰链：** 墙面位于训练者身后，双脚保持着地；动画表现臀部向后触墙、膝部仅轻微弯曲、躯干作为整体前倾后回正，不表现弓腰、深蹲或撞墙。
- **站姿弹力带推胸：** 双股弹力带固定在身后胸口高度，前后分腿站姿稳定；动画表现从胸侧向前推至手肘接近伸直但不锁死，再受控回位，躯干无后仰或前冲。
- **坐姿徒手伸膝：** 人物坐于有靠背的稳固椅子，支撑腿稳定；动画表现单侧小腿由屈曲缓慢抬至接近伸直但不锁膝，再受控放下，不表现甩腿或身体后仰借力。
- 三项均不叠加水平运动箭头，不使用可能被误读为躯干移动的方向提示；15帧循环无明显断裂或残影。

审核结论：三项媒体分别与目录中的动作功能、器械、动作提示和安全边界一致，可标记为 `approved`。

## Task6 第二组原创媒体

以下四项同样由 Move28 项目使用 Python Pillow 11.3.0 程序化逐帧绘制，不含外部图片、字体文件拷贝、人物肖像或第三方素材。权利人为 Move28 项目，允许在本项目及其公开、商业发行版本中使用、复制、修改和分发，无第三方署名要求。

| 文件 | 动作 ID | 规格 | SHA-256 | 审核状态 |
|---|---|---|---|---|
| `assets/gifs/23_扶椅提踵.gif` | `supported-calf-raise` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `c37dc201599f59f37f47fd09100e562251500aed349ca08df7489e0e7d449872` | approved |
| `assets/gifs/24_扶椅原地踏步.gif` | `supported-standing-march` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `4a3af28d4fbf1af4ea09ffb6115e072603417e5ccb84f3b7da799b5cddfff1ed` | approved |
| `assets/gifs/25_仰卧脚跟滑动.gif` | `heel-slide` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `91ce2e1c8574a80deae6f62dcff7562a8bc1940e2846e2047f3533f57544ef93` | approved |
| `assets/gifs/26_四点支撑单肢滑动.gif` | `bird-dog-regression` | GIF89a，180×180，15帧，每帧150ms，无限循环 | `496256aeafebeb85251491078dc21db17fe3a1b9c79e5573693a309fca9fec49` | approved |

### 内容审核

- **扶椅提踵：** 双手仅轻扶稳固椅背，双膝保持自然伸展；脚尖持续着地，脚跟与身体垂直抬起后受控落下，不表现屈膝弹跳或踝部侧翻。
- **扶椅原地踏步：** 双手分别轻扶稳固椅背，形成两个清晰接触点，支撑脚不移动；单膝以舒适小幅度抬起后受控放下，不表现高抬腿、跺脚或躯干摇晃。
- **仰卧脚跟滑动：** 头、躯干和骨盆保持稳定，活动脚跟始终沿垫面滑动；膝盖逐步伸展但不强行锁死，再沿原路收回。
- **四点支撑单肢滑动：** 双膝与一手保持三个稳定支撑点，另一手全程贴垫向前滑动后返回；躯干保持稳定，不表现手臂抬离、塌腰或旋转。
- 四项均不叠加水平运动箭头；15帧往返循环，无明显断裂、残影或方向误导。

审核结论：四项媒体分别与目录中的动作功能、器械、动作提示和安全边界一致，可标记为 `approved`。
