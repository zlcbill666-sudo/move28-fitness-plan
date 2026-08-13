# Calf stretch 20-second hold encoding spike

Date: 2026-08-13

Exercise: `calf-stretch`（坐姿主动勾脚小腿拉伸）

Decision: **Go to controlled edit production; not release eligible**

## Question

Can the frozen GymVisual candidate be transformed into the catalog's exact sequence—neutral, active dorsiflexion, a continuous 20-second static hold, and controlled release—using only the operations allowed by the frozen production contract?

## Frozen inputs

- Catalog authority: `src/data/exercise-catalog.js`
- Production contract: `docs/research/data/move28-media-production-spec.json`
- Candidate: `media-build/source-research/gymvisual-prepurchase-previews/calf-stretch.mp4`
- Candidate SHA-256: `ca42d32791559d76e71ff50da367618667f1cb90f328605960cd4cd6b5891be7`
- Candidate facts: H.264, 400×224, 30 fps, 281 decoded frames, 9.3667 seconds
- Numbered 2 fps contact sheet: `docs/research/evidence/move28-spikes/calf-stretch/contact-2fps-numbered.jpg`
- Contact-sheet SHA-256: `45b8eb2122fc859b916ace32e0b47e454e6c0b132495e76d63968999e56178e8`

The source is a watermarked internal research preview. It is not a release asset.

## Manual motion review

The full contact sheet and frame-level comparisons show:

- upright sitting on a chair;
- one leg forward;
- heel visibly grounded;
- active ankle dorsiflexion is visible;
- hands remain on the thigh/chair area and do not pull the foot;
- no towel, resistance band or other assistive tool;
- the source includes a controlled return to neutral.

The source already enters a visually static peak region at approximately frame 90. Two exact-pixel runs are present: frames 90–120 and frames 121–194. Frame 121 is the canonical reviewed hold frame. Frame 195 begins the controlled release.

The static images establish visible posture and contact, not subjective stretch sensation. Final production still requires the normal motion, safety, visual and technical gates.

## Encoding plan

At 30 fps:

1. Preserve source frames 1–89 as the neutral-to-dorsiflexion ingress.
2. Use source frame 121 as the sole reviewed hold master.
3. Encode exactly 600 copies of that same source pixel frame (20.0 seconds).
4. Append source frames 195–281 as the controlled release.
5. Do not interpolate the hold.
6. Do not retain repetitive toe tapping.

Expected candidate timeline:

- 89 ingress frames;
- 600 hold frames;
- 87 release frames;
- 776 total frames;
- 25.8667 seconds at 30 fps.

A real GBR lossless VP9 WebM probe produced 776 decoded frames at 30 fps and a 25.866-second container duration. The 600-frame hold contains exactly one unique source pixel frame, and decoding reproduces the approved RGB pixels exactly.

## Decision

**Go** for the controlled edit-production stage. The frozen source and allowed operations can represent the required 20-second active hold without changing exercise, equipment, safety or regression semantics.

This is not approval of the watermarked preview and does not unlock the release manifest. The production package remains blocked until self-hosted deliverables pass all four frozen gates.

## Reproduction

```bash
python -B media-src/scripts/analyze_calf_stretch_hold_spike.py
node --test tests/unit/calf-stretch-hold-spike.test.cjs
```

To generate a temporary encoded WebM candidate without placing it in the release tree:

```bash
python -B media-src/scripts/analyze_calf_stretch_hold_spike.py \
  --candidate-webm <temporary-output.webm>
```
