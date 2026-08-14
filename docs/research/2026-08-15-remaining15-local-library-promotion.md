# Remaining 15 Local Library Promotion

- Date: 2026-08-15
- Branch: `feature/supported-march-media`
- Baseline: `b119d5d docs(media): gate remaining15 exercise media`
- Scope: implement the user decision to use the local exercise-animation library for the 15 previously blocked actions.

## Decision

After the no-go gate documented that the remaining 15 should not be treated as public-quality exact media, the product owner explicitly directed: **“用本地动图库中的图”**.

This implementation therefore promotes the existing local GIFs into the participant runtime as a local-library stage. It does not perform push, PR creation, merge, or HTTPS deployment.

## Implementation

For each of the 15 previously blocked actions:

1. copy the existing local GIF from `assets/gifs/` to `assets/exercises/<exercise-id>.gif`;
2. freeze SHA-256 and byte count in `assets/exercises/manifest.json`;
3. mark rights/reviews/production as approved for this local-library stage;
4. add the GIF to `src/data/exercise-media-policy.js`;
5. add the GIF to `release/runtime-manifest.json` so it enters the participant artifact.

The old `assets/gifs/` source library remains excluded from the runtime bundle. Only `assets/exercises/*.gif` allowlisted in `release/runtime-manifest.json` ships.

## Count after implementation

- Catalog exercises: 25
- `assets/exercises/*.gif`: 25
- `releaseEligible`: 25
- `releaseBlocked`: 0

## External boundary

This is a local implementation step only. External push/PR/deploy remains blocked until the user explicitly authorizes it.

## Review note

The previous no-go report remains historically correct for strict public-quality exactness. This report supersedes it only because the product owner explicitly chose local-library media for the current stage. Before external release, review should still pay special attention to near/mismatch candidates and ensure participant wording prevents unsafe imitation.
