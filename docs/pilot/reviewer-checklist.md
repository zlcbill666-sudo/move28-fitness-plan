# MOVE 28 两人试用人工复核清单

> 适用于邀请制两人试用。复核是运营硬门，不是登录或密码学认证。只有指定复核人可以执行批准命令；参与者不得自行批准。

## 1. 复核记录

- 参与者代号：`A / B`（不得填写姓名或联系方式）
- 匿名编号：`pilot-________`
- 构建提交：`________`
- ZIP 文件名/版本：`________`
- Plan ID：`________`
- Intake revision：`________`
- Risk rule version：`________`
- Plan version：`________`
- 复核人机器代号：`pilot-reviewer` / `pilot-reviewer-backup`
- 复核 UTC 时间：`________`
- 结论：`通过 / 拒绝 / 修复后重审`
- 关联问题编号及处理结果：`________`

禁止记录姓名、手机号、邮箱、原始问卷答案、具体病史、完整浏览器状态或未脱敏截图。

## 2. 打开脱敏复核材料

参与者完成问卷后，页面必须显示“等待人工复核”，且没有训练入口。复核人通过一对一屏幕共享或现场操作，在同一浏览器页面按 `F12` 打开 Console，执行：

```js
const dossier = Move28.storage.buildDetailedReviewDossier();
console.log(dossier);
```

该材料只包含匿名编号、规则标识、风险代码、计划结构、器械、剂量、动作和 GIF；不包含年龄及原始健康答案。不得读取、复制或发送完整 `localStorage`。

若命令抛出 `StorageError`，立即拒绝批准，按 S0/S1 问题记录并停止该参与者继续试用。

## 3. 自动硬门

全部勾选后才能继续：

- [ ] 当前状态为 `pending_review`。
- [ ] `validationResult === "passed"`。
- [ ] 风险等级仅为 `normal` 或 `conservative`。
- [ ] 风险版本为当前可信版本（当前为 `pilot-v2`）。
- [ ] Plan ID 与当前计划一致。
- [ ] Intake revision 与当前问卷 revision 一致。
- [ ] 恰好 4 周。
- [ ] `stop` 用户计划数为 0，不能改成 `normal`。
- [ ] `manual_review` 不得由普通复核人批准为自动训练计划。
- [ ] 16 岁以下不进入普通自动生成；16 岁及以上仍受全部健康红旗门禁。
- [ ] 修改问卷、训练安全停止或周复盘疼痛重筛后，旧计划已失效。
- [ ] 用户接受周调整后，新 revision 重新回到 `pending_review`。

## 4. 计划一致性复核

逐周、逐节核对 dossier：

- [ ] 每节 `estimatedMinutes` 不超过问卷选择的单次时间上限。
- [ ] 训练日逐项属于 dossier 的 `availableWeekdays`，且力量日不存在危险连续安排。
- [ ] 1天计划明确为受限结构；2天为非连续全身力量；3天为2次力量＋1次低冲击有氧/恢复；4天以上最多3次结构化训练＋1次恢复。
- [ ] 力量结构优先覆盖膝主导、后侧链、水平推、水平拉、核心稳定。
- [ ] 场景、器械和动作一致；当前居家缺少必要器械时应原子阻断，而不是返回半份计划。
- [ ] 用户回避的动作和器械未出现。
- [ ] 禁忌标签对应动作未出现在计划或跟练队列。
- [ ] 每个动作均来自 `approved` 动作库。
- [ ] 每个动作均有有效 GIF、剂量、RPE/休息及动作提示。
- [ ] 平地走为跑步机 0 坡度，只走不跑。
- [ ] 不含跑步、跳跃、HIIT、力竭或激进减重话术。
- [ ] `conservative` 用户采用更低剂量，且没有自动激进进阶。
- [ ] 音乐失效不会阻止训练停止入口。

## 5. 批准操作

只有全部清单通过、无未关闭 S0/S1 问题时，指定复核人才在 Console 执行：

```js
const dossier = Move28.storage.buildDetailedReviewDossier();
Move28.storage.approvePlanReview({
  reviewerId: "pilot-reviewer",
  planId: dossier.planId,
  intakeRevision: dossier.intakeRevision
});
location.reload();
```

批准 API 会再次执行可信风险重算、当前 revision 核对和完整计划 validator。错误 Plan ID、错误 revision、非法 reviewer ID、非 `pending_review`、`stop`、`manual_review` 或校验失败都会原子拒绝。

注意：本地静态页面不伪装成安全认证系统。该命令是两人 concierge 试用的运营控制，不声明可抵抗拥有 DevTools 的恶意参与者。若未来公开测试需要抗篡改审核，必须引入签名或服务端授权后重新威胁建模。

## 6. 复核后验证

- [ ] 刷新后出现“开始本节训练”。
- [ ] 计划仍绑定相同 Plan ID 和 intake revision。
- [ ] 完成一节后，仅写入该计划对应的完成记录。
- [ ] 安全停止后训练入口关闭，旧计划变为 stale。
- [ ] 周调整接受后训练入口再次关闭，直到新计划重新审核。
- [ ] 记录复核结论、构建版本和问题编号，不记录健康答案。

## 7. 隐私与留存

- 审核材料仅在试用负责人指定的一对一微信会话或现场屏幕共享中使用。
- 不发公开群、GitHub Issue、社交平台或第三方分析服务。
- 不接收完整浏览器存储、原始问卷、精确生日、姓名或联系方式。
- 审核摘要和脱敏附件在试用结束或最后一次复核后 30 天内删除，以较早者为准。
- 页面删除本机数据不会删除已经下载、复制或发送的文件；接收方必须单独删除。