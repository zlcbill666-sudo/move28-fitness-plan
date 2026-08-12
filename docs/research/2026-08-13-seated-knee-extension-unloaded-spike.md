# 坐姿徒手伸膝裁剪 Spike 结论

- 日期：2026-08-13
- 动作：`seated-knee-extension-unloaded`
- 结论：**No-Go；按冻结合同转 `custom-3d`**
- 发布状态：继续阻塞；本Spike没有修改正式manifest、动作目录或现有GIF

## 候选身份与复现输入

- 产品页：`https://gymvisual.com/animated-gifs/24630-seated-alternate-knee-extension-on-chair-male.html`
- 冻结证据直链：`https://gymvisual.com/img/p/4/2/1/1/4/42114.gif`
- 本地审核副本：`media-build/source-research/gymvisual-prepurchase-previews/seated-knee-extension-unloaded.gif`
- SHA-256：`6589241da7ec6a8a00b373606ff042d6702199bcbbc2873400db399df93ab6ab`
- 技术信息：180×180 GIF、24个编码帧、总时长5秒；编码帧持续时间不均匀

审核副本属于内部研究输入，被仓库规则排除。新检出环境必须显式获取并验证哈希：

```bash
python -B media-src/scripts/analyze_seated_knee_extension_spike.py --fetch-source
```

脚本只在本地输入不存在且显式传入`--fetch-source`时下载；下载内容不匹配冻结SHA即失败。默认运行不隐式联网，缺少输入会明确失败。

## 人工动作审核

编号编码帧联系表用于人工动作语义审核。审核版本1确认第一侧编码帧0–12形成完整连续周期：

1. 中立；
2. 伸膝；
3. 接近伸直；
4. 完整回程；
5. 回到中立。

峰值位于编码帧6。上述阶段、侧别和动作完整性是**人工审核注释**，不是脚本从像素自动推导的结论。脚本确定性重建联系表并把SHA-256写入结构化报告，以绑定人工审核所依据的画面。

## 自动时间证据与No-Go原因

FFprobe逐包时间证据显示：

- 普通运动帧的中位持续时间：0.1秒；
- 人工标注的峰值编码帧6持续时间：0.5秒；
- 峰值静止时长是普通运动帧的5倍。

该0.5秒峰值静止命中冻结合同禁止项：

`knee-lock-frame-hold`

冻结合同没有给该禁项设置“达到1秒才算”的阈值，因此此前用平均帧率推算“1秒静止”的说法错误，现已删除。No-Go依据是经人工定位的峰值姿势具有异常延长的静止保持，而不是依赖某个固定播放帧区间。

不能通过以下方式把候选伪装成合格成品：

- 删除动作内部峰值帧；
- 对回程或峰值做速度渐变；
- 补造不存在的动作相位。

冻结合同只允许在中立姿势边界裁剪、保留同一侧完整动作和删除另一侧重复，不允许重构内部动作时序。

## 可重复验证

```bash
python -B media-src/scripts/analyze_seated_knee_extension_spike.py
node --test tests/unit/seated-knee-extension-spike.test.cjs
```

结构化报告：

`docs/research/data/seated-knee-extension-unloaded-spike.json`

版本化人工审核联系表（随研究证据提交）：

`docs/research/evidence/move28-spikes/seated-knee-extension-unloaded/contact-numbered.png`

本地重新生成的编号联系表：

`media-build/spikes/seated-knee-extension-unloaded/contact-numbered.png`

结构化报告明确区分：

- `manualMotionReview`：人工确认的侧别、完整动作、峰值位置及联系表哈希；
- `automatedTimingEvidence`：逐包PTS、持续时间、峰值相对普通运动帧的时长倍数；
- 冻结候选SHA-256；
- `no-go`决策与`custom-3d`回退。

错误源、缺失输入、畸形规格、时间线不连续或冻结合同漂移均删除旧报告并失败关闭。

## 下一步

停止继续加工该采购候选。将`seated-knee-extension-unloaded`纳入后续专业定制批次；定制版本仍须遵守原生产合同，并在真实成品存在前保持发布阻塞。
