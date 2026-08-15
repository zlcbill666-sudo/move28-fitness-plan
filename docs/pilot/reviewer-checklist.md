# MOVE 28 两人试用人工复核清单

> 适用于邀请制两人试用。复核是运营硬门，不是医疗许可、登录认证或密码学授权。只有指定复核人可以批准；`stop`/`manual_review` 不得由普通复核人改成可训练状态。

## 1. 记录批次

- 匿名编号：`pilot-________`
- HTTPS 试用网址：`https://________`
- 构建提交：`________`
- Plan ID：`________`
- Intake revision：`________`
- Capability revision：`________`
- 复核人：`________`
- 复核日期：`________`

确认参与者使用的是本批次 HTTPS 地址，而不是旧缓存、ZIP 或其他站点。

## 2. 取得脱敏详细材料

参与者完成问卷和能力校准后，页面必须显示“人工一致性复核完成前不会开放训练入口”，且没有训练按钮。

在页面“计划等待人工复核”区域点击“下载复核 dossier”。该 JSON 只含固定脱敏字段，不含原始健康答案、异常详情、完整浏览器存储或网址健康数据。不要粘贴到普通群聊。

由指定复核人查看文件并至少核对：

- `participantId`、`planId`、`intakeRevision`、`capabilityRevision`；
- `riskLevel`、`riskCodes`、`ruleVersion`；
- `capabilityStatus`、`constraintCodes`；
- `selectedSetting`、`availableEquipment`、`availableWeekdays`；
- `validationResult === "passed"`；
- `lineage.validationResult === "passed"`，且 `lineage.currentPlanId === planId`；
- 4 周计划、每周训练日、动作、场景、器械、剂量和文字动作指导。

完成文件检查后，回到参与者生成该计划的同一浏览器，展开“指定复核人入口”，导入刚下载的 dossier。页面必须显示“已匹配当前本机候选计划”。若下载失败、导入失败、字段缺失、revision 不一致或 validation 不是 `passed`，立即停止，不批准。

该流程不上传 dossier，也不能跨浏览器、跨设备或跨 plan/revision 批准。

## 3. 风险与能力硬门

- [ ] 风险仅为 `normal` 或 `conservative`。
- [ ] 没有胸部不适/压迫、异常气短、晕厥、急性重大损伤、无法承重、未恢复脑震荡等停止信号。
- [ ] 16 岁以下、孕期/产后、近期手术、复杂病情或明确医生限制未被普通自动流程放行。
- [ ] 能力档案为当前 intake 对应的最新 revision。
- [ ] 跳过项目被保守处理，没有被当成“能力正常”。
- [ ] 警示症状能力档案没有生成可执行计划。
- [ ] `constraintCodes` 与计划动作/变式/剂量一致。

## 4. 场景、器械与动作

逐周逐节检查：

- [ ] 每节 `setting` 与 dossier 的 `selectedSetting` 一致；当前试用不允许训练当天临时切换场景。
- [ ] 每个动作至少一组 `equipmentOptions` 能由 dossier 的 `availableEquipment` 满足；没有要求参与者自创替代动作。
- [ ] 每个动作 ID 来自审核目录，动作内容的 `reviewStatus === "approved"`。
- [ ] 当前参与者界面以已复核文字步骤为准；25项动作图已按当前素材对齐动作内容并显示；动图只作辅助示范，文字步骤和停止信号仍优先。
- [ ] 禁忌动作已排除，动作模式没有因回退而失真。
- [ ] `high_seat`、`close_wall` 等变式只用于匹配动作，并在跟练页显示可信中文指导，不显示内部枚举。
- [ ] 居家计划不混入 dossier 未列出的健身房器械；健身房计划不假设 `availableEquipment` 未列出的器械。

## 5. 剂量、时长与进阶

- [ ] 计划固定 4 周。
- [ ] 每周训练日与可用星期一致。
- [ ] sets/reps/duration、RPE、休息和预计时长均在 validator 边界内。
- [ ] 保守能力不会获得更高难度、更多组数或更激进有氧剂量。
- [ ] 无跑步、跳跃、极限测试、憋气或快速减重承诺。
- [ ] 每周复盘一次最多调整一个受控变量。

## 6. 批准

只有第 2–5 节全部通过时：

1. 在“指定复核人入口”填写受控复核人编号；
2. 逐项勾选页面上的三项批准确认；
3. 点击“批准并开放当前计划”。

页面会在保存决定前再次比对导入 dossier 与当前本机 canonical plan、intake revision、capability revision 和 lineage。任一字段变化都会固定失败并保持训练锁定。

随后刷新并确认：

- [ ] `plan.status === "active"`；
- [ ] `plan.review.capabilityRevision === state.capabilityRevision`；
- [ ] 首页出现“开始本节训练”；
- [ ] 打开首节跟练时文字动作指导、剂量、受控变式、安全停止按钮正常；
- [ ] 跟练页对25项动作显示已上架动图；
- [ ] 刷新后训练入口仍存在。

## 7. 周调整重新复核

参与者接受周调整后，新计划必须重新进入 `pending_review`。重新执行本清单，并额外确认：

- [ ] `lineage.validationResult === "passed"`，且每条 `acceptedEdges` 的 `resultPlanId` 等于下一条的 `sourcePlanId`；
- [ ] 最后一条边的 `resultPlanId === planId`，所有边的 `capabilityRevision` 等于 dossier 当前 revision；
- [ ] `weekNumber` 按当前 revision 的已接受链连续前进；底层硬门已拒绝重复边、分叉、合流、循环和断链；
- [ ] 调整前完成记录保留，但旧计划不能继续训练；
- [ ] 新候选仍通过完整 validator，而不是只验证被调整字段。

## 8. 拒绝与记录

任一项失败：

1. 在已匹配当前会话的复核面板点击“拒绝并要求返工”；若 dossier 无法匹配，则保持 pending 并停止；
2. 在 `issue-log-template.md` 记录固定错误提示、Plan ID、revision、步骤和复现条件；
3. 不记录完整健康答案；
4. 修复后使用新构建重新跑完整门禁和本清单。
