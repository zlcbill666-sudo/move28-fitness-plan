# Move28 5项未解决3D候选逐帧复核

- 日期：2026-08-12
- 范围：`seated-leg-raise`、`ankle-circle`、`high-seat-sit-to-stand`、`dead-bug`、`calf-stretch`
- 当前策略：按用户明确决策暂时忽略版权与授权问题；本报告只审动作、安全、视觉和技术匹配。
- 证据：`docs/research/data/unresolved5-gymvisual-evidence-2026-08-12.json`
- 本地联系表：`media-build/source-research/gymvisual-unresolved5-previews/contact-sheet.png`（内部研究，被Git忽略）

## 结论

5个首轮已知GymVisual商品页和公开预览均可读取，但逐帧复核后全部为`reject`；随后扩大站点目录检索，新增`16441 Bodyweight Bench Squat (female)`可作为`high-seat-sit-to-stand`的受控设置候选，因此最终结果为1项`purchase-edit-candidate`、4项继续`unresolved`。不得因标题相似而升级候选。

| Move28 ID | 已知商品 | 可见动作 | 与合同冲突 | 结论 |
|---|---|---|---|---|
| `seated-leg-raise` | `2181 Seated Leg Raise` | 人物坐在无靠背训练凳上，上身明显后仰支撑，双腿接近伸直后整体抬起 | Move28要求坐稳有靠背椅、躯干直立、交替抬一侧膝约5～10厘米 | `reject` |
| `ankle-circle` | `3138 Ankle Circles` | 站姿，一腿交叉/悬空做踝部活动 | Move28要求稳定坐姿、单脚稍离地且膝盖保持安静 | `reject` |
| `high-seat-sit-to-stand` | 首轮`2233 Smith Chair Squat`；扩大检索`16441 Bodyweight Bench Squat (female)` | 首轮为史密斯架杠铃负重深蹲；新候选为徒手、脚位稳定、臀部坐到长凳后再站起 | 新候选动作路径匹配，但普通长凳高度不能证明Move28所需的高位退阶设置；产品必须继续要求使用更高稳固座面 | `purchase-edit-candidate` |
| `dead-bug` | `1769 Dead Bug` | 仰卧，手臂上举并做对侧手脚大幅伸展 | Move28当前退阶合同要求双臂可放身体两侧，只交替脚跟点地再收回 | `reject` |
| `calf-stretch` | `3160 Seated Calf Stretch (male)` | 人物在地面长坐/盘坐切换，身体前倾并以手辅助触脚 | Move28要求坐在稳固椅子前半部，一腿前伸，只靠踝关节主动勾脚，不用手、毛巾或弹力带 | `reject` |

## 证据指纹

| ID | 预览SHA-256 | 字节 | 帧数 | 尺寸 |
|---|---|---:|---:|---:|
| `seated-leg-raise` | `45daa1871a0bc2b608da1c7c3d017fd32d743a7bb6469a20282a98f481a52d8a` | 100712 | 12 | 180×180 |
| `ankle-circle` | `5bdf25f29f257ff9cdff4989375cc1311933dd7454290c60ab7bd69118cbd4fe` | 77348 | 12 | 180×180 |
| `high-seat-sit-to-stand` | `524b58efaa70cf156c13276d180d940906d39645fb4298035b19021e0fbf87f6` | 83489 | 12 | 180×180 |
| `dead-bug` | `8159be89633287ff0fac4ae8842d244c5901635854d1cdeca54ee22be303afe4` | 122868 | 24 | 180×180 |
| `calf-stretch` | `d188aa4f6fa81ee66798c92303ae857bead09e0bae64ba26ce20c51eccce5322` | 177482 | 12 | 180×180 |

## 下一步

1. 不再复用上述5个已拒绝商品。
2. 继续检索时必须先按设置过滤：靠背椅/坐姿、徒手高椅、退阶脚跟点地、椅上主动踝背屈。
3. 如果没有同时满足设置、支撑、运动肢体和幅度的候选，保持`unresolved`并并入专业定制范围。
4. 不修改训练动作合同来迁就现有素材。
