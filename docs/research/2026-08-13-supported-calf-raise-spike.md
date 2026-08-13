# Supported calf raise support-replacement spike

Date: 2026-08-13

Exercise: `supported-calf-raise`（扶椅提踵）

Decision: **No-Go; route to custom 3D**

## Question

Can the frozen GymVisual raster candidate be converted from gym-equipment support to the catalog-required stable chair without changing the calf-raise motion or using a misleading overlay?

## Frozen inputs

The analyzer binds the complete SHA-256 identities of:

- the 180×180, 12-frame, 3-second GymVisual preview;
- the production specification;
- the 25-exercise candidate matrix;
- the runtime exercise catalog;
- the numbered review contact sheet.

Any byte drift fails closed.

## Catalog contract

The official catalog requires:

- a stable chair that will not slide;
- upright standing behind the chair;
- both hands providing light balance support;
- feet at hip width;
- naturally extended knees;
- a controlled bilateral heel rise;
- a one-second peak pause;
- a controlled return without bouncing.

The wording cannot be weakened to accept generic gym equipment.

## What the raster candidate preserves

Manual review of the frozen numbered contact sheet confirms:

- a visible bilateral calf raise and return;
- naturally extended knees;
- continuous hand contact with the existing support;
- no visible ballistic knee bounce;
- a gym bench or machine support, not a stable chair.

FFprobe packet evidence confirms encoded frame 6 lasts exactly one second. The motion timing therefore satisfies the peak-pause requirement independently of the support mismatch.

## Why the edit is not feasible

The frozen production contract requires all three prerequisites:

1. editable 3D scene and rig;
2. replaceable support object;
3. tracked hand-contact anchors.

The available input is only a watermarked raster GIF. It includes none of those prerequisites. A chair replacement would therefore require either:

- compositing a two-dimensional chair over the existing support; or
- retaining the existing object while claiming in labels that it is a chair.

Both shortcuts are explicitly forbidden. They cannot prove chair geometry, stability, occlusion, bilateral hand contact, or continuous contact ratio.

## Decision

**No-Go.** Preserve the motion findings as reference only and route `supported-calf-raise` to `custom-3d`.

The custom animation must use an actual stable chair, tracked bilateral hand contact, symmetric heel rise within the frozen tolerance, a one-second peak, and no ballistic direction reversal.

## Release boundary

This spike does not produce publishable participant media. The candidate remains watermarked research evidence, `releaseEligible` remains false, and the formal manifest stays blocked.

## Reproduction

```text
python -B media-src/scripts/analyze_supported_calf_raise_spike.py
node --test tests/unit/supported-calf-raise-spike.test.cjs
```
