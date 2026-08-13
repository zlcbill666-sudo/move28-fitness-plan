# Move28本地ExerciseDB严格动作映射（2026-08-13）

## 目的

停止自制3D路线后，以当前`src/data/exercise-catalog.js`中的25项动作合同为唯一标准，重新审核用户本地动画库：

`E:\个人用\健身\健身动作动画\bootstrapping-lab-exercisedb-api`

本报告只冻结内部候选映射，不修改正式manifest，不代表动作已向参与者开放。

## 本次真实盘点

- 元数据：1,500条唯一动作记录；
- 本地GIF：1,500个，全部可读取、全部为180×180多帧动画；
- 本地数据库SHA-256：`a28dfeafa409fcaf737a6d27c4694d9bddc52ba69f12b37121be1e81b90b5c2d`；
- 当前动作目录SHA-256：`d375039f0e56528a46113149c32f4bb08e235d596195e3ad7dbff3bc03c41c8e`；
- 严格结果：10项`exact`、5项`near`、10项`reject`；
- 正式发布：0项，正式manifest继续25/25阻塞。

语义结论来自完整循环逐帧人工审核；脚本自动化只验证候选身份、SHA-256、GIF格式、尺寸和帧数，不能把人工动作判断伪装成机器视觉结论。

## 10项精确候选

| Move28动作 | ExerciseDB ID | 本地动作 | 结论 |
|---|---|---|---|
| 坐姿腿举 | `10Z2DXU` | sled 45° leg press | 器械、双脚屈伸轨迹匹配 |
| 坐姿腿弯举 | `Zg3XY7P` | lever seated leg curl | 坐姿屈膝轨迹匹配 |
| 臀桥 | `u0cNiij` | low glute bridge on floor | 仰卧屈膝抬髋匹配 |
| 推胸机 | `T0yTjgW` | lever chest press | 坐姿背贴垫、胸高近水平双臂推压 |
| 坐姿划船 | `7I6LNUG` | lever seated row | 水平后拉匹配 |
| 抗旋转推压 | `9pa4H5m` | band horizontal pallof press | 胸高侧向阻力、双手前推匹配 |
| 坐姿腿屈伸 | `my33uHU` | lever leg extension | 坐姿机器伸膝匹配 |
| 髋外展机 | `CHpahtl` | lever seated hip abduction | 双膝外展轨迹匹配 |
| 墙壁俯卧撑 | `LEH9jxP` | push-up (wall) | 墙面靠近与推回匹配 |
| 椭圆机 | `rjtuP6X` | walk elliptical cross trainer | 直立、固定把手、小步幅匹配 |

推胸机原候选`DOoWcnA`为明显上斜轨迹，本轮改用`T0yTjgW`，避免把肩上/上斜推举错误标作胸高水平推压。

## 5项近似候选

| Move28动作 | ExerciseDB ID | 不可忽略的差异 |
|---|---|---|
| 脚踝绕环 | `uL9CsKm` | 站姿交叉腿，没有稳固椅子 |
| 扶椅提踵 | `bJYHBIN` | 提踵匹配，但没有双手扶椅 |
| 平地慢走 | `rjiM4L3` | 明确为上坡跑台，不是0坡度 |
| 扶椅原地踏步 | `ealLwvX` | 墙面支撑且抬膝较高 |
| 小腿拉伸 | `17bqEXD` | 坐地并用手拉脚，不是椅上主动勾脚 |

这些动作不能直接进入产品，只保留为检索证据。

## 10项拒绝或缺失

- 坐姿抬腿：候选为后倾凳上双腿同时抬高；
- 墙触髋铰链：全库无背对墙触墙版本；
- 站姿弹力带推胸：最近候选为坐姿；
- 弹力带划船：最近候选为弹力带绕脚坐姿划船；
- 高位坐姿起立：候选为扶物下蹲，没有坐到高位座面；
- 坐姿徒手伸膝：全库无椅上交替无负重版本；
- 死虫式：候选为对侧手脚伸展，不是双臂体侧交替脚跟点地；
- 仰卧脚跟滑动：候选从双腿伸直开始屈膝，不符合双膝屈曲起始后单侧前滑；
- 四点支撑单肢滑动：全库无手不离垫版本；
- 大腿后侧拉伸：候选是椅上动态抬放直腿，没有静态保持。

其中`dead-bug`、`heel-slide`和`hamstring-stretch`在旧报告中曾被列作精确覆盖；本轮按当前动作合同逐帧复核后全部纠正为`reject`。

## 可复现交付物

- 冻结映射：`docs/research/data/move28-local-exercisedb-mapping.json`
- 联系表：`docs/research/evidence/local-exercisedb/move28-local-candidates.jpg`
- 生成器：`media-src/scripts/build_local_exercisedb_mapping.py`
- 防回归测试：`tests/unit/local-exercisedb-mapping.test.cjs`

生成器失败关闭：数据库、动作目录或任一候选SHA漂移都会拒绝生成；报告和联系表采用双输出事务安装，第二输出失败时回滚并保留旧双输出。

## 下一Task

把10项`exact`候选复制到独立的内部发布候选目录，使用稳定英文文件名建立产品接入包；完成逐项安全复核、技术校验和UI预览后，再决定是否修改正式manifest。5项`near`和10项`reject`不得混入该接入包。
