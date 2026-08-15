# Move28 本地 ExerciseDB 8 项替换复核（2026-08-16）

- 来源库：`E:\个人用\健身\健身动作动画\bootstrapping-lab-exercisedb-api`
- 复核口径：按用户要求不撤回 8 项、不走 CSS 修图；全部改用本地 ExerciseDB 动作库相近动作，并对不完全等价项同步修改动作定义/文案。
- 最终联系表：`docs/research/evidence/local-exercisedb/move28-approved-replacements-2026-08-16.jpg`
- 最终联系表 SHA-256：`39eb8a328ec5eb09832511e2c70940549b92fbfc9d58a8236afa3c7b0c45282a`
- 最终计数：`exact=17 / approved_near=8 / project_owned=0 / releaseEligible=25 / blocked=0`

| Move28 ID | 决策 | 来源 | 新名称/口径 | 说明 |
|---|---|---|---|---|
| `wall-hip-hinge` | `replace_and_change_definition_to_near_library_action` | `VtTbiP3` / band pull through | 弹力带拉髋 | 用户授权将原墙触髋铰链改为动作库相近的弹力带拉髋；已替换为本地ExerciseDB band pull through 并同步为低位弹力带髋铰链口径。 |
| `standing-band-chest-press` | `replace_and_change_definition` | `4x5Okof` / resistance band seated chest press | 坐姿弹力带推胸 | 用户授权明确将原站姿弹力带推胸改为坐姿弹力带推胸；已替换为本地ExerciseDB坐姿弹力带推胸动图并同步动作步骤。 |
| `band-row` | `replace_and_sync_copy` | `km0sQC0` / band one arm standing low row | 单臂弹力带低位划船 | 按用户授权和本地图库复核结果替换为单臂站姿弹力带低位划船；与弹力带划船训练目标一致，但文案已同步为左右单臂执行。 |
| `seated-knee-extension-unloaded` | `replace_and_change_definition` | `Y1MsI1l` / resistance band leg extension | 坐姿弹力带伸膝 | 用户授权明确将原坐姿徒手伸膝改为坐姿弹力带伸膝；已替换为本地ExerciseDB弹力带伸膝动图，视觉复核为坐姿版本。 |
| `supported-calf-raise` | `replace_and_sync_copy` | `bJYHBIN` / bodyweight standing calf raise | 站姿支撑提踵 | 按用户授权和本地图库复核结果替换为站姿自重提踵；动作本体一致，支撑要求在文案中限定为必要时扶墙或椅背。 |
| `heel-slide` | `replace_and_sync_copy` | `LNE3wfo` / single leg platform slide | 仰卧单腿滑动 | 按用户授权和本地图库复核结果替换为仰卧单腿平台滑动；与脚跟滑动目标接近，文案已同步为毛巾/滑垫/光滑地面滑动。 |
| `bird-dog-regression` | `replace_and_change_definition_to_near_library_action` | `h1ezqSu` / kneeling plank tap shoulder (male) | 跪姿平板肩触碰 | 用户授权将原四点支撑单肢滑动改为动作库相近的跪姿平板肩触碰；已替换为本地ExerciseDB kneeling plank tap shoulder 并同步为核心稳定退阶口径。 |
| `supported-standing-march` | `replace_and_sync_copy` | `ealLwvX` / high knee against wall | 扶墙支撑原地抬膝 | 按用户授权和本地图库复核结果替换为扶墙高抬腿；与支撑踏步目标接近，文案已同步为扶墙或稳定椅背的小幅受控抬膝。 |

## 风险边界

- 这 8 项均为 `approved_near`，不是重新宣称为原始 exact 动作；已同步 catalog 名称、器械、步骤和安全提示，避免“图和文字不一致”。
- `wall-hip-hinge` 已按用户要求从“墙触髋铰链”改为 `VtTbiP3` 对应的 **弹力带拉髋**；风险边界是必须使用轻阻力且固定点牢固，腰/髋/大腿后侧锐痛或放射痛即停止。
- `bird-dog-regression` 已按用户要求从“四点支撑单肢滑动”改为 `h1ezqSu` 对应的 **跪姿平板肩触碰**；风险边界是手腕、肩、膝、腰疼痛即停止，必要时膝下加垫，避免地面者不做。
- `standing-band-chest-press` 与 `seated-knee-extension-unloaded` 已按用户明确指令分别改为 **坐姿弹力带推胸** 与 **坐姿弹力带伸膝**。
- 当前正式 manifest 与 mapping 为 `approved_near=8 / project_owned=0`；不再保留项目自有问题图作为发布证据。
