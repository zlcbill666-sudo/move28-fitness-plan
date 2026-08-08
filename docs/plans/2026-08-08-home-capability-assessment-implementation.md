# Home Capability Assessment Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a safe five-check capability profile and complete the approved low-equipment home movement path without weakening existing plan gates.

**Architecture:** Extend the existing deterministic pipeline with a pure capability engine between intake/risk routing and movement matching. Persist a versioned capability profile and bind generated plans, approvals, workout access, and weekly revisions to `capabilityRevision`. New exercises enter the frozen catalog only after media and metadata validation.

**Tech Stack:** Static classic JavaScript, CommonJS-compatible modules, Node test runner, Playwright, local GIF assets, GitHub Pages.

---

## Delivery rules

- Work only on `feature/home-capability-assessment`.
- Preserve zero-build static hosting and `file://` support.
- Use `scripts` already loaded by `index.html`; no new dependency.
- Use `npm run test`, `npx playwright test --workers=2`, and real public-URL smoke verification.
- Every task follows implementation → tests → specification review → quality/security review.
- Do not publish the branch until all new media, tests, and dual reviews pass.

### Task 1: Characterize current home-plan limitation

**Objective:** Lock the existing horizontal-pull failure and current 17-action catalog before adding behavior.

**Files:**
- Modify: `tests/unit/plan-generator.test.cjs`
- Modify: `tests/unit/movement-matcher.test.cjs`

**Steps:**
1. Add a test proving a default home plan with chair, wall, mat, band and walking route currently returns `REQUIRED_MOVEMENT_UNAVAILABLE` for `horizontal_pull`.
2. Add a test proving `band-row` is not yet approved/selectable.
3. Run both files and verify the new assertions describe the current limitation.
4. Commit: `test: characterize home movement gap`.

### Task 2: Add the pure capability engine

**Objective:** Convert five finite assessment answers into immutable generation constraints.

**Files:**
- Create: `src/domain/capability-engine.js`
- Create: `tests/unit/capability-engine.test.cjs`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `tests/unit/module-loading.test.cjs`

**Public API:**

```js
evaluateCapabilityProfile(profile)
// -> {status, difficultyCap, exclusions, variants,
//     cardioStartMinutes, reasonCodes}
```

**Steps:**
1. Write tests for valid profiles, each `not_attempted` route, pain/manual-review routes, warning-symptom stop, deep freeze, deterministic output, and malicious inputs.
2. Run the test and verify failure because the module does not exist.
3. Implement strict enum parsing, canonical plain-data checks, dangerous-key rejection, and fixed reason codes.
4. Add the module to CommonJS and classic-script load order.
5. Run capability and module-loading tests.
6. Commit: `feat: add deterministic capability engine`.

### Task 3: Add versioned capability persistence

**Objective:** Persist capability answers and stale prior plans on any change.

**Files:**
- Modify: `src/storage/local-store.js`
- Modify: `tests/unit/local-store.test.cjs`

**State additions:**

```js
capabilityProfile: null,
capabilityResult: null,
capabilityRevision: 0
```

Plan additions:

```js
capabilityRevision: 1
```

**Steps:**
1. Add failing tests for save/readback, revision increments, stale plan, migration, invalid profile rejection, silent storage failure, approval mismatch, and workout access mismatch.
2. Add `saveCapabilityProfile(profile, result)` that recomputes the trusted capability result.
3. Bind `savePlan`, `approvePlanReview`, `recordWorkoutCompletion`, weekly review, and dossier generation to the current capability revision.
4. Update migration with fail-closed defaults; do not infer a capability pass from old data.
5. Run local-store tests.
6. Commit: `feat: persist capability revisions`.

### Task 4: Build the three-screen capability calibration UI

**Objective:** Collect five checks after eligible onboarding without free text or maximal testing.

**Files:**
- Create: `src/ui/capability-assessment.js`
- Create: `tests/unit/capability-assessment.test.cjs`
- Modify: `index.html`
- Modify: `assets/css/generated-plan.css`
- Modify: `src/app.js`
- Modify: `tests/e2e/onboarding.spec.cjs`

**Steps:**
1. Add unit tests for finite fields, skip behavior, warning stop, Back/Escape, draft recovery, storage failure, and no DOM module loading.
2. Add three screens: lower body, upper/core/floor, walking tolerance.
3. Show explicit prerequisites and stop instructions on every active check.
4. Integrate after `normal/conservative` risk routing and before generation.
5. Verify 390×844 single-column layout and no horizontal overflow.
6. Commit: `feat: add capability calibration flow`.

### Task 5: Add approved band-row action and media

**Objective:** Close the hard home horizontal-pull gap with one reviewed action before broader catalog growth.

**Files:**
- Add: `assets/gifs/<new-band-row-file>.gif`
- Modify: `src/data/exercise-catalog.js`
- Modify: `src/domain/movement-matcher.js`
- Modify: `tests/unit/exercise-catalog.test.cjs`
- Modify: `tests/unit/movement-matcher.test.cjs`
- Modify: `tests/e2e/current-page.spec.cjs`
- Add/update: media source/license record under `docs/`

**Steps:**
1. Acquire or create a truthful band-row animation with documented permission; reject unrelated or unsafe media.
2. Add failing catalog tests for ID, media existence, equipment, dose, cues, contraindications and relations.
3. Add `band-row` as difficulty1, settings home/gym, equipment option `resistance_band`, pattern `horizontal_pull`.
4. Add it to home horizontal-pull priority.
5. Verify a band-equipped home profile matches it and no-band profiles fail.
6. Commit: `feat: add approved home band row`.

### Task 6: Add seven reviewed home actions

**Objective:** Expand the home regression and support surface while keeping required patterns finite.

**Files:**
- Add: seven GIFs under `assets/gifs/`
- Modify: `src/data/exercise-catalog.js`
- Modify: `src/domain/movement-matcher.js`
- Modify: catalog/matcher/browser tests
- Update: media source/license record

**Actions:**

```text
wall-hip-hinge
standing-band-chest-press
seated-knee-extension-unloaded
supported-calf-raise
supported-standing-march
heel-slide
bird-dog-regression
```

**Steps per action:**
1. Add failing metadata/media test.
2. Add reviewed local media and attribution.
3. Add complete catalog entry with exact equipment options and dose.
4. Wire only justified movement mappings; auxiliary actions remain catalog-only until a session template consumes them.
5. Run catalog and matcher tests after each action.
6. Commit in focused groups, not one unreviewable bulk commit.

### Task 7: Make generator capability-aware

**Objective:** Let capability constraints affect action selection and initial dose without permitting unsafe upgrades.

**Files:**
- Modify: `src/domain/plan-generator.js`
- Modify: `src/domain/movement-matcher.js`
- Modify: `tests/unit/plan-generator.test.cjs`
- Modify: `tests/fixtures/generator-cases.json`

**Steps:**
1. Add fixtures for independent, supported, floor-avoid, hinge-avoid, low-walk-tolerance, and skipped profiles.
2. Require current capability result/revision in canonical generator input.
3. Merge capability exclusions with user exclusions.
4. Pass `difficultyCap` to matcher.
5. Apply only downward dose changes and controlled variants.
6. Prove same input remains deterministic and input objects remain unchanged.
7. Commit: `feat: generate from capability constraints`.

### Task 8: Extend the validator hard gate

**Objective:** Reject plans that contradict capability constraints or revision state.

**Files:**
- Modify: `src/domain/plan-validator.js`
- Modify: `tests/unit/plan-validator.test.cjs`
- Modify: `tests/fixtures/invalid-plans.json`

**New error contracts:**

```text
CAPABILITY_REVISION_MISMATCH
CAPABILITY_EXCLUSION_CONFLICT
CAPABILITY_DIFFICULTY_EXCEEDED
CAPABILITY_VARIANT_MISMATCH
CARDIO_START_EXCEEDED
```

**Steps:**
1. Add one invalid fixture per contract.
2. Require trusted capability input and matching revision.
3. Check action difficulty, exclusions, variant and initial cardio dose.
4. Ensure every validation caller passes capability context.
5. Run validator, generator, local-store and weekly-adaptation tests.
6. Commit: `feat: validate capability-bound plans`.

### Task 9: Integrate workout, weekly review and dossier

**Objective:** Carry capability constraints through approval, guided execution and revisions.

**Files:**
- Modify: `src/app.js`
- Modify: `src/ui/workout-guide.js`
- Modify: `src/domain/weekly-adaptation.js`
- Modify: `src/storage/local-store.js`
- Modify: related unit/E2E tests

**Steps:**
1. Add capability-aware approval and active-context tests.
2. Display selected variant/range guidance from trusted catalog metadata.
3. Prevent weekly progression beyond capability limits.
4. Add capability level, revision and fixed constraint codes to dossier; do not expose raw answers.
5. Verify capability edits stale approved plans and preserve historical completion lineage safely.
6. Commit: `feat: bind plans to capability profile`.

### Task 10: Full verification and pilot release

**Objective:** Prove local, offline and deployed behavior before updating the pilot URL.

**Files:**
- Modify: `README.md`
- Modify: `使用说明.txt`
- Modify: `docs/pilot/participant-guide.md`
- Modify: `docs/pilot/reviewer-checklist.md`
- Add/modify: full-flow, offline and recovery E2E specs

**Steps:**
1. Run `npm run test` and require zero failures.
2. Run `npx playwright test --workers=2` and require zero failures.
3. Rebuild the offline ZIP and run extracted `file://` desktop/mobile tests.
4. Run `git diff --check` and `node --check` for every changed JS/CJS file.
5. Obtain independent specification and quality/security approvals.
6. Commit final docs and verification.
7. Push the branch only after user-facing media is accepted.
8. Update GitHub Pages source and force a build.
9. Verify the real HTTPS URL at desktop and 390×844, including no external health-data requests.

## Definition of done

- Home profiles with stable chair, wall and resistance band can generate a complete validated plan.
- Missing required equipment fails atomically with an actionable message.
- Five capability checks alter selection/dose only through finite deterministic constraints.
- Capability changes stale existing plans and require reapproval.
- Every new selectable action has truthful reviewed media and full catalog metadata.
- Existing risk, storage, privacy, offline and weekly-review invariants remain green.
