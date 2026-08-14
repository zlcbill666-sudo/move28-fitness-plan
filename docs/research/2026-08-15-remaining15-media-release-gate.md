# Remaining 15 Exercise Media Release Gate

- Date: 2026-08-15
- Branch: `feature/supported-march-media`
- Baseline HEAD: `7f80f02 docs(handoff): checkpoint exact10 local release`
- Scope: review whether the 15 currently blocked exercise media items can be safely promoted to participant-facing `releaseEligible=true` before any external push/PR/deploy.

## Conclusion

**No-Go for bulk release of the remaining 15.**

The current repository already has placeholder/current GIFs for all 15, but they do not all satisfy the Move28 media contract. Promoting them would either:

1. ship semantic mismatches for beginner/safety-constrained movements; or
2. ship the previously rejected dark-background/simple-vector placeholders that do not match the accepted ExerciseDB visual standard.

The safe state remains:

- 25 catalog exercises total;
- 10 `releaseEligible` Exact10 GIFs already released locally in `a17204a`;
- 15 still blocked pending better exact media or an explicit product decision to change the exercise/media contract.

## Evidence reviewed

- `assets/exercises/manifest.json`
- `docs/research/data/move28-local-exercisedb-mapping.json`
- Current source GIFs under `assets/gifs/`
- Generated local review sheet: `media-build/remaining15-review/remaining15-source-gif-contact-sheet.jpg`
- Generated local technical report: `media-build/remaining15-review/remaining15-source-gif-report.json`

Web search was attempted but the configured Hermes web backend is unavailable in this profile, so this gate relies on the already-local ExerciseDB library and repository research evidence.

## Row-by-row gate

| Exercise | Current source | Local ExerciseDB classification | Gate | Reason |
|---|---|---:|---|---|
| `seated-leg-raise` | `assets/gifs/02_坐姿抬腿.gif` | reject | Block | Current ExerciseDB candidate is a reclined bench double-leg/core raise, not chair-supported small alternating knee lifts. |
| `ankle-circle` | `assets/gifs/03_脚踝绕环.gif` | near | Block | Ankle-circle motion is close, but the candidate is standing/cross-legged and lacks the stable-chair support required by the catalog. |
| `wall-hip-hinge` | `assets/gifs/20_墙触髋铰链.gif` | reject / none | Block | Current GIF is a dark-background simple-vector placeholder; local ExerciseDB has no exact wall-touch hip-hinge candidate. |
| `standing-band-chest-press` | `assets/gifs/21_站姿弹力带推胸.gif` | reject | Block | Current local ExerciseDB candidate is seated band chest press, not split-stance standing band press. Placeholder is semantically close but visually below release bar. |
| `band-row` | `assets/gifs/19_弹力带划船.gif` | reject | Block | Local ExerciseDB candidate is seated/foot-anchored, not chest-height anchored standing row. Placeholder is visually below release bar. |
| `high-seat-sit-to-stand` | `assets/gifs/10_高位坐姿起立.gif` | reject | Block | Current ExerciseDB candidate uses Smith-machine or support-squat semantics, not unweighted high-seat sit-to-stand. |
| `seated-knee-extension-unloaded` | `assets/gifs/22_坐姿徒手伸膝.gif` | reject / none | Block | Placeholder is semantically close but visually below release bar; local ExerciseDB has no exact chair-based unloaded single-leg knee-extension candidate. |
| `supported-calf-raise` | `assets/gifs/23_扶椅提踵.gif` | near | Block | Local ExerciseDB calf raise lacks the required two-hand stable-chair support; placeholder is visually below release bar. |
| `dead-bug` | `assets/gifs/14_死虫式.gif` | reject | Block | ExerciseDB dead-bug candidate is contralateral arm/leg extension, not the catalog's arms-at-side alternating heel tap regression. |
| `heel-slide` | `assets/gifs/25_仰卧脚跟滑动.gif` | reject | Block | ExerciseDB candidate starts from extended legs and flexes, not the catalog's bent-knee single heel slide forward/return. Placeholder is visually below release bar. |
| `bird-dog-regression` | `assets/gifs/26_四点支撑单肢滑动.gif` | reject / none | Block | Placeholder is semantically close but visually below release bar; local ExerciseDB has no hand-on-mat sliding bird-dog regression. |
| `flat-walk` | `assets/gifs/16_平地慢走.gif` | near | Block | ExerciseDB candidate is explicitly incline treadmill; catalog requires 0坡度 flat walking. |
| `supported-standing-march` | `assets/gifs/24_扶椅原地踏步.gif` | near | Block | Local ExerciseDB candidate uses wall support/high-knee semantics, not small chair-supported marching. Placeholder is visually below release bar. |
| `hamstring-stretch` | `assets/gifs/17_大腿后侧拉伸.gif` | reject | Block | Local candidate is dynamic leg raise/hold mismatch, not a gentle static hamstring stretch matching the catalog contract. |
| `calf-stretch` | `assets/gifs/18_小腿拉伸.gif` | near | Block | Candidate uses floor sitting/hand-assisted pull; catalog requires chair sitting and active dorsiflexion without hand/towel/band assistance. |

## Safe continuation paths

1. **Strict public-quality path:** keep all 15 blocked and source or produce new exact media matching the ExerciseDB-like grey anatomical style before release.
2. **Contract-change path:** change selected exercise contracts to match available ExerciseDB candidates, then re-run programming/safety review because the training semantics change.
3. **Explicit temporary-low-fi path:** if the product owner intentionally accepts the existing dark/simple placeholders for internal trial only, mark that as a separate limited-scope product decision, not as public-quality media approval.

No external action was taken.
