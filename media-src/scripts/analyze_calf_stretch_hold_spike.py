#!/usr/bin/env python
"""Reproduce the calf-stretch 20-second hold encoding spike."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "media-build/source-research/gymvisual-prepurchase-previews/calf-stretch.mp4"
SPEC = ROOT / "docs/research/data/move28-media-production-spec.json"
REPORT = ROOT / "docs/research/data/calf-stretch-hold-spike.json"
REVIEW_CONTACT = ROOT / "docs/research/evidence/move28-spikes/calf-stretch/contact-2fps-numbered.jpg"
EXERCISE_ID = "calf-stretch"
SOURCE_SHA256 = "ca42d32791559d76e71ff50da367618667f1cb90f328605960cd4cd6b5891be7"
SPEC_SHA256 = "4a74392ce0631ee82e7e136dd7cfcb2a3f5afd8f534406ffc498056bfd62a397"
CONTACT_SHA256 = "45b8eb2122fc859b916ace32e0b47e454e6c0b132495e76d63968999e56178e8"
SOURCE_FRAME_COUNT = 281
FPS = 30
INGRESS_END = 89          # 1-based, inclusive
CANONICAL_HOLD_FRAME = 121
SOURCE_HOLD_END = 194
RELEASE_START = 195
HOLD_FRAMES = 20 * FPS
OUTPUT_FRAME_COUNT = INGRESS_END + HOLD_FRAMES + (SOURCE_FRAME_COUNT - RELEASE_START + 1)


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str], *, text: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, capture_output=True, text=text)


def json_bytes(payload: dict[str, object]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def best_effort_unlink(path: Path) -> None:
    try:
        if path.is_file() or path.is_symlink():
            path.unlink(missing_ok=True)
    except OSError:
        pass


def stage_bytes(path: Path, content: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    owned = True
    try:
        handle = os.fdopen(descriptor, "wb")
        owned = False
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        return temporary
    except Exception:
        if owned:
            try:
                os.close(descriptor)
            except OSError:
                pass
        best_effort_unlink(temporary)
        raise


def transactional_write(outputs: list[tuple[Path, bytes]]) -> None:
    if len({path.resolve() for path, _ in outputs}) != len(outputs):
        raise ValueError("transaction output paths must be unique")
    for path, _ in outputs:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and not (path.is_file() or path.is_symlink()):
            raise ValueError("transaction output target must be a file")
    staged: list[tuple[Path, Path]] = []
    backups: list[tuple[Path, Path]] = []
    installed: list[Path] = []
    preserved: set[Path] = set()
    try:
        for path, content in outputs:
            staged.append((path, stage_bytes(path, content)))
        for path, temporary in staged:
            if path.exists() or path.is_symlink():
                descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".bak", dir=path.parent)
                os.close(descriptor)
                backup = Path(name)
                backup.unlink()
                path.replace(backup)
                backups.append((path, backup))
            temporary.replace(path)
            installed.append(path)
        for _, backup in backups:
            best_effort_unlink(backup)
    except Exception as install_error:
        rollback_errors: list[OSError] = []
        for path in reversed(installed):
            best_effort_unlink(path)
        for path, backup in reversed(backups):
            try:
                if backup.exists():
                    backup.replace(path)
            except OSError as rollback_error:
                preserved.add(backup)
                rollback_errors.append(rollback_error)
        if rollback_errors:
            raise ExceptionGroup("transaction install and rollback failed", [install_error, *rollback_errors])
        raise
    finally:
        for _, temporary in staged:
            best_effort_unlink(temporary)
        for _, backup in backups:
            if backup not in preserved:
                best_effort_unlink(backup)


def atomic_write(path: Path, content: bytes) -> None:
    transactional_write([(path, content)])


def load_contract(path: Path) -> dict[str, object]:
    if not path.is_file() or file_hash(path) != SPEC_SHA256:
        raise ValueError("frozen production specification is missing or changed")
    spec = json.loads(path.read_text(encoding="utf-8"))
    package = next(item for item in spec["editPackages"] if item["exerciseId"] == EXERCISE_ID)
    expected = {
        "sourceEvidenceSha256": SOURCE_SHA256,
        "strategy": "peak-pose-hold-extension",
        "fallback": "custom-3d",
        "releaseBlocked": True,
    }
    for key, value in expected.items():
        if package.get(key) != value:
            raise ValueError(f"frozen calf-stretch contract {key} drifted")
    required_allowed = {"extend-peak-pose-to-twenty-seconds", "use-motionless-source-pose-hold", "append-controlled-release"}
    required_forbidden = {"retain-repetitive-toe-tapping", "claim-twenty-second-hold-under-twenty-seconds", "use-frame-interpolation-during-static-hold"}
    if not required_allowed <= set(package["allowedOperations"]):
        raise ValueError("frozen hold-edit operations drifted")
    if not required_forbidden <= set(package["forbiddenOperations"]):
        raise ValueError("frozen hold-edit prohibitions drifted")
    return package


def extract_all_frames(source: Path, destination: Path) -> list[Path]:
    destination.mkdir(parents=True)
    run(["ffmpeg", "-v", "error", "-i", str(source), "-an", "-vsync", "0", str(destination / "%04d.png")])
    frames = sorted(destination.glob("*.png"))
    if len(frames) != SOURCE_FRAME_COUNT:
        raise ValueError("candidate decoded frame count drifted")
    return frames


def pixel_hash(path: Path) -> str:
    with Image.open(path) as image:
        return hashlib.sha256(image.convert("RGB").tobytes()).hexdigest()


def identical_runs(hashes: list[str]) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = 0
    for index in range(1, len(hashes) + 1):
        if index == len(hashes) or hashes[index] != hashes[start]:
            if index - start >= 2:
                runs.append((start + 1, index))
            start = index
    return runs


def render_contact(source: Path, destination: Path) -> bytes:
    sampled = destination / "sampled"
    sampled.mkdir(parents=True)
    run(["ffmpeg", "-v", "error", "-i", str(source), "-vf", "fps=2,scale=400:-1", str(sampled / "%03d.png")])
    frames = sorted(sampled.glob("*.png"))
    if len(frames) != 19:
        raise ValueError("2fps review frame count drifted")
    labeled: list[Image.Image] = []
    for index, frame in enumerate(frames):
        image = Image.open(frame).convert("RGB")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 80, 24), fill="white")
        draw.text((5, 5), f"{index:02d} {index / 2:.1f}s", fill="black")
        labeled.append(image)
    width, height = labeled[0].size
    sheet = Image.new("RGB", (width * 5, height * 4), "white")
    for index, image in enumerate(labeled):
        sheet.paste(image, ((index % 5) * width, (index // 5) * height))
    output = destination / "contact.jpg"
    sheet.save(output, quality=92)
    return output.read_bytes()


def link_or_copy(source: Path, destination: Path) -> None:
    try:
        os.link(source, destination)
    except OSError:
        shutil.copyfile(source, destination)


def verify_encoded_candidate(output: Path, canonical_pixel_hash: str) -> dict[str, object]:
    probe = json.loads(run([
        "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration",
        "-of", "json", str(output),
    ], text=True).stdout)
    stream = probe["streams"][0]
    if int(stream["nb_read_frames"]) != OUTPUT_FRAME_COUNT or stream["avg_frame_rate"] != "30/1":
        raise ValueError("encoded spike timeline drifted")
    with tempfile.TemporaryDirectory(prefix="move28-calf-decode-") as temporary:
        decoded_root = Path(temporary)
        run(["ffmpeg", "-v", "error", "-i", str(output), "-an", "-vsync", "0", str(decoded_root / "%04d.png")])
        decoded = sorted(decoded_root.glob("*.png"))
        if len(decoded) != OUTPUT_FRAME_COUNT:
            raise ValueError("encoded spike decoded frame count drifted")
        hold_hashes = {pixel_hash(frame) for frame in decoded[INGRESS_END:INGRESS_END + HOLD_FRAMES]}
        if len(hold_hashes) != 1:
            raise ValueError("encoded hold contains motion or multiple pixel frames")
        decoded_hold_hash = next(iter(hold_hashes))
        if decoded_hold_hash != canonical_pixel_hash:
            raise ValueError("encoded hold does not preserve the canonical source pixels")
    return {
        "path": str(output),
        "sha256": file_hash(output),
        "codec": stream["codec_name"],
        "width": stream["width"],
        "height": stream["height"],
        "fps": FPS,
        "frameCount": OUTPUT_FRAME_COUNT,
        "durationSeconds": OUTPUT_FRAME_COUNT / FPS,
        "holdUniqueDecodedFrames": 1,
        "sourceHoldPixelSha256": canonical_pixel_hash,
        "decodedHoldPixelSha256": decoded_hold_hash,
    }


def encode_candidate(frames: list[Path], output: Path) -> dict[str, object]:
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="move28-calf-encode-") as temporary:
        sequence = Path(temporary)
        selected = frames[:INGRESS_END] + [frames[CANONICAL_HOLD_FRAME - 1]] * HOLD_FRAMES + frames[RELEASE_START - 1:]
        if len(selected) != OUTPUT_FRAME_COUNT:
            raise ValueError("candidate frame assembly drifted")
        for index, frame in enumerate(selected, 1):
            link_or_copy(frame, sequence / f"{index:04d}.png")
        run([
            "ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", str(sequence / "%04d.png"),
            "-an", "-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "gbrp", str(output),
        ])
    return verify_encoded_candidate(output, pixel_hash(frames[CANONICAL_HOLD_FRAME - 1]))


def analyze(source: Path, spec: Path, candidate: Path | None) -> dict[str, object]:
    if source.resolve() in {spec.resolve(), REPORT.resolve(), REVIEW_CONTACT.resolve()}:
        raise ValueError("source and evidence paths must be distinct")
    if not source.is_file() or file_hash(source) != SOURCE_SHA256:
        raise ValueError("frozen calf-stretch source is missing or changed")
    contract = load_contract(spec)
    with tempfile.TemporaryDirectory(prefix="move28-calf-spike-") as temporary:
        temporary_root = Path(temporary)
        frames = extract_all_frames(source, temporary_root / "frames")
        hashes = [pixel_hash(frame) for frame in frames]
        runs = identical_runs(hashes)
        if (90, 120) not in runs or (121, 194) not in runs:
            raise ValueError("reviewed source hold runs drifted")
        contact = render_contact(source, temporary_root / "contact")
        if hashlib.sha256(contact).hexdigest() != CONTACT_SHA256 or file_hash(REVIEW_CONTACT) != CONTACT_SHA256:
            raise ValueError("numbered review contact sheet drifted")
        candidate_evidence = encode_candidate(frames, candidate) if candidate else None
    return {
        "schemaVersion": 1,
        "exerciseId": EXERCISE_ID,
        "productionSpecSha256": SPEC_SHA256,
        "source": {
            "sha256": SOURCE_SHA256,
            "frameCount": SOURCE_FRAME_COUNT,
            "fps": FPS,
            "durationSeconds": SOURCE_FRAME_COUNT / FPS,
            "width": 400,
            "height": 224,
        },
        "manualMotionReview": {
            "basis": "numbered-2fps-contact-sheet-plus-full-frame-comparison",
            "contactSheetSha256": CONTACT_SHA256,
            "uprightChairSitting": True,
            "forwardLegVisible": True,
            "heelGrounded": True,
            "activeDorsiflexionVisible": True,
            "assistiveToolCount": 0,
            "handsDoNotPullFoot": True,
            "reviewedSourceHoldFramesInclusive": [90, 194],
            "canonicalHoldFrame": CANONICAL_HOLD_FRAME,
            "releaseStartsAtFrame": RELEASE_START,
        },
        "automatedFrameEvidence": {
            "identicalRunsInclusive": [list(run_) for run_ in runs],
            "canonicalRunInclusive": [121, 194],
            "canonicalRunSeconds": 74 / FPS,
        },
        "encodingPlan": {
            "phaseOrder": ["neutral", "dorsiflex", "hold-20s", "release"],
            "ingressSourceFramesInclusive": [1, INGRESS_END],
            "holdSourceFrame": CANONICAL_HOLD_FRAME,
            "holdCopies": HOLD_FRAMES,
            "holdSeconds": 20,
            "releaseSourceFramesInclusive": [RELEASE_START, SOURCE_FRAME_COUNT],
            "frameInterpolation": False,
            "repetitiveToeTappingRetained": False,
            "outputFrameCount": OUTPUT_FRAME_COUNT,
            "outputDurationSeconds": OUTPUT_FRAME_COUNT / FPS,
        },
        "candidateEncoding": candidate_evidence,
        "decision": "go",
        "nextStage": "controlled-edit-production",
        "fallback": contract["fallback"],
        "releaseEligible": False,
        "conclusion": "The frozen source contains a clean active-dorsiflexion pose and controlled release. Replace its peak region with 600 exact copies of one reviewed source frame to encode a true 20-second static hold without interpolation or repetitive toe tapping.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--spec", type=Path, default=SPEC)
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--candidate-webm", type=Path)
    args = parser.parse_args()
    try:
        resolved = {args.source.resolve(), args.spec.resolve(), REVIEW_CONTACT.resolve()}
        outputs = {args.report.resolve()}
        if args.candidate_webm:
            outputs.add(args.candidate_webm.resolve())
        if len(outputs) != (2 if args.candidate_webm else 1) or outputs & resolved:
            raise ValueError("input and output paths must be distinct")
        candidate_target = args.candidate_webm.resolve() if args.candidate_webm else None
        if candidate_target:
            with tempfile.TemporaryDirectory(prefix="move28-calf-output-") as temporary:
                staged_candidate = Path(temporary) / "candidate.webm"
                report = analyze(args.source.resolve(), args.spec.resolve(), staged_candidate)
                report["candidateEncoding"]["path"] = str(candidate_target)
                transactional_write([
                    (args.report, json_bytes(report)),
                    (candidate_target, staged_candidate.read_bytes()),
                ])
        else:
            report = analyze(args.source.resolve(), args.spec.resolve(), None)
            atomic_write(args.report, json_bytes(report))
        print(json.dumps({"ok": True, "decision": report["decision"], "report": str(args.report)}, allow_nan=False))
        return 0
    except Exception:
        print(json.dumps({"ok": False, "error": "analysis_failed"}, allow_nan=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
