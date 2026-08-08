# 居家动作库与能力评估设计

**日期：** 2026-08-08  
**状态：** 设计基线  
**范围：** 居家低器械优先，不引入视频上传、账号或云端健康数据

## 目标

在保持当前确定性安全架构的前提下：

1. 补齐居家完整全身计划，首先解决水平拉动作缺口；
2. 用5项非极限、可跳过的简单功能检查建立能力档案；
3. 让能力档案真正影响动作难度、动作排除、支持方式和初始剂量；
4. 所有新动作继续经过可信目录、独立validator和人工复核；
5. 保持local-first、静态托管、无后端、无视频上传。

## 方案选择

### 采用：受控动作扩充＋规则化能力档案

不使用摄像头姿态识别，不让LLM判断动作质量，不根据体重或年龄猜测能力。能力评估只接受有限枚举答案，并转换为确定性约束。

### 暂不采用

- 视频上传或云端姿态分析；
- 最大次数、计时冲刺、单腿平衡等可能诱导极限尝试的测试；
- 任意自由文本伤病描述；
- 根据一次自测自动升级到高难动作；
- 未审核媒体或仅凭名称生成新动作。

## 用户流程

```text
现有10步问卷
→ 风险为 normal / conservative
→ 可选的3屏能力校准
→ capability profile
→ 动作匹配与剂量生成
→ validator
→ pending_review
→ 人工复核
```

能力校准允许“未尝试”。未尝试不会当作通过，而会选择更简单动作或增加保守约束。出现胸部症状、接近晕厥、异常气短、神经症状或急性严重疼痛时立即停止校准并回到安全分流。

## 五项能力检查

### 1. 高位坐姿起立

使用稳固、靠墙的高椅，最多做3次受控起立，不追求速度。

结果：

- `independent_controlled`：无需手扶，动作稳定；
- `hands_supported`：需要扶椅或扶腿；
- `unable_or_painful`：无法完成或出现疼痛；
- `not_attempted`：未尝试。

映射：需要手扶或未尝试时保留难度1并使用高位版本；无法完成或疼痛进入人工复核。

### 2. 墙壁俯卧撑

面对墙完成最多3次受控重复，不追求疲劳。

结果：

- `controlled`；
- `limited_range`；
- `painful_or_unstable`；
- `not_attempted`。

映射：受限时使用近墙、短行程变体；疼痛或不稳进入人工复核；未尝试保持最简单水平推。

### 3. 墙触髋铰链

背对墙，以臀部轻触墙面完成最多3次，双脚不离地。

结果同上。受限或未尝试时不自动使用髋铰链动作；疼痛进入人工复核。

### 4. 地面可达性

不要求实际下地，只询问是否能在稳定支撑下安全到达地面并起身。

结果：

- `comfortable`；
- `needs_support`；
- `avoid_floor`；
- `not_attempted`。

映射：除 `comfortable` 外默认加入 `floor` 排除标签。该项不作为医疗判断。

### 5. 五分钟平地步行耐受

只在现有安全筛查通过后进行；保持能说短句的速度，可随时停止。

结果：

- `comfortable`；
- `fatigued_but_stable`；
- `warning_symptom`；
- `not_attempted`。

映射：疲劳但稳定进入保守有氧；警示症状停止自动生成并重新筛查；未尝试使用最低有氧剂量。

## 能力档案

新增纯数据结构：

```js
{
  version: 1,
  completed: true,
  chairRise: 'independent_controlled',
  wallPushup: 'controlled',
  wallHinge: 'controlled',
  floorAccess: 'comfortable',
  walkTolerance: 'comfortable'
}
```

派生结果：

```js
{
  difficultyCap: 1 | 2,
  exclusions: ['floor', 'hinge'],
  variants: {
    knee_dominant: 'high_seat' | 'standard',
    horizontal_push: 'close_wall' | 'standard'
  },
  cardioStartMinutes: 8 | 10 | 15,
  requiresManualReview: boolean,
  stopReason: string | null
}
```

原始枚举保存在本机；dossier仅输出派生能力等级、约束代码和所选动作变体，不输出自由文本。

## 动作库扩充

第一批目标由17项扩充到25项，居家低器械优先：

1. `band-row`：弹力带划船，水平拉，居家完整计划的硬缺口；
2. `wall-hip-hinge`：墙触髋铰链，后侧链、难度1；
3. `standing-band-chest-press`：站姿弹力带推胸，水平推替代；
4. `seated-knee-extension-unloaded`：坐姿徒手伸膝，低难度膝部辅助；
5. `supported-calf-raise`：扶椅提踵，低难度步行准备；
6. `supported-standing-march`：扶椅原地踏步，低冲击有氧回退；
7. `heel-slide`：仰卧脚跟滑动，地面核心/髋膝控制；
8. `bird-dog-regression`：四点支撑单肢滑动，核心稳定回退。

其中只有与必需模式直接对应且媒体/剂量审核通过的动作才能进入生成器。辅助动作先进入目录，不强制加入每节训练。

## 媒体与审核合同

每个动作必须提供：

```text
稳定英文ID
中文名称
动作模式
支持场景
器械方案
难度1～3
剂量范围
禁忌标签
回退/进阶关系
四类动作提示
本地GIF
媒体来源与许可记录
reviewStatus=approved
```

不得复用不对应的旧GIF。媒体未完成审核时只能保持 `draft`，matcher和generator不可选择。

## 匹配逻辑

匹配优先级：

```text
已审核
→ 动作功能一致
→ 场景一致
→ 能力难度上限
→ 能力派生排除
→ 用户主动排除
→ 器械方案满足
→ 固定优先级选择
```

示例：居家水平拉

```text
有弹力带＋能力允许
→ band-row

无弹力带
→ 明确返回 INSUFFICIENT_EQUIPMENT
→ 不伪造毛巾门缝划船等未审核动作
```

## 剂量规则

能力校准只允许降低初始剂量，不允许越过现有上限：

- 难度受限：1～2组、8次、RPE 4～5、休息90秒；
- 普通能力：2组、8次、RPE 5；
- 步行疲劳但稳定：有氧从8分钟开始；
- 未尝试：采用对应动作最简单变体和最低剂量；
- 能力评估不会直接开启RPE 6以上或高影响动作。

周复盘仍是唯一进阶入口；所有调整只改一个主要变量并重新人工复核。

## 状态与失效

能力档案具有独立 `capabilityRevision`。修改任一能力答案时：

```text
旧计划 stale
→ 重算风险与能力约束
→ 重新生成
→ 重新validator
→ pending_review
```

计划记录其 `capabilityRevision`，批准和训练入口都核对该revision。

## 错误处理

- 非法、污染、稀疏、accessor、Proxy或未知枚举：fail closed；
- 能力校准中出现警示症状：停止并重新安全筛查；
- 找不到必需动作：整份计划原子失败；
- 媒体、提示、器械或剂量缺失：validator拒绝；
- 存储失败：保留当前页面输入，不声称保存成功。

## 测试与验收

必须覆盖：

1. 5项能力答案矩阵及派生约束；
2. 警示症状停止、疼痛人工复核、未尝试保守处理；
3. 居家弹力带完整计划成功；
4. 无弹力带水平拉原子失败；
5. 地面回避时无 `floor` 动作；
6. 能力revision变化使旧计划stale；
7. 新动作全部有真实本地媒体和剂量；
8. validator拒绝能力不匹配的动作/变体；
9. 桌面、390×844移动端和 `file://`；
10. 公网URL无健康数据外传。

## 发布边界

本轮只声称支持：

- 16岁以上、通过现有安全筛查的普通或保守用户；
- 居家最低器械：稳固椅子＋墙面＋弹力带；
- 不含康复处方、视频诊断或医疗清除。

两人试用通过前，不扩大到高龄、孕产期、术后、复杂疾病或急性疼痛用户。
