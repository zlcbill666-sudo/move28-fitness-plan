#!/usr/bin/env python
"""Reproduce the supported-calf-raise support-replacement feasibility spike."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "media-build/source-research/gymvisual-prepurchase-previews/supported-calf-raise.gif"
SPEC = ROOT / "docs/research/data/move28-media-production-spec.json"
MATRIX = ROOT / "docs/research/data/move28-3d-candidate-matrix.json"
CATALOG = ROOT / "src/data/exercise-catalog.js"
REPORT = ROOT / "docs/research/data/supported-calf-raise-spike.json"
CONTACT = ROOT / "docs/research/evidence/move28-spikes/supported-calf-raise/contact-numbered.jpg"
SOURCE_SHA256 = "0880cf0843e5c957a38f9c3ebc1e0fa2670e4615ae71df18c017fe20096c7cfa"
SPEC_SHA256 = "db6ec82abf96b9d98fb7382e0be134d4ae2d647db883b87ff3a7f7d5bc461686"
MATRIX_SHA256 = "69d8c340163f311a645be99feba0ffea1df2acedf0e981e9c3fa7f38d43813c8"
CATALOG_SHA256 = "dda57ea5063208e0515c8778921e8155fb42f22bb59c89f6f71d99862d3014ed"
CONTACT_SHA256 = "c16672018862c1403b3ddafbd04ed1a2b058da4314b0cb67f13f572a77576365"
FRAME_COUNT = 12
DURATION_SECONDS = 3.0
PEAK_FRAME = 6  # zero-based encoded GIF frame


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


def extract_frames(source: Path, destination: Path) -> list[Path]:
    destination.mkdir(parents=True)
    run(["ffmpeg", "-v", "error", "-i", str(source), "-vsync", "0", "-start_number", "0", str(destination / "%03d.png")])
    frames = sorted(destination.glob("*.png"))
    if len(frames) != FRAME_COUNT:
        raise ValueError("frozen source decoded frame count drifted")
    return frames


def probe_packets(source: Path) -> list[dict[str, object]]:
    raw = json.loads(run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_packets",
        "-show_entries", "packet=pts_time,duration_time", "-of", "json", str(source),
    ], text=True).stdout)["packets"]
    packets = [{
        "index": index,
        "ptsSeconds": float(packet["pts_time"]),
        "durationSeconds": float(packet["duration_time"]),
    } for index, packet in enumerate(raw)]
    if len(packets) != FRAME_COUNT:
        raise ValueError("frozen source packet count drifted")
    end = packets[-1]["ptsSeconds"] + packets[-1]["durationSeconds"]
    if abs(end - DURATION_SECONDS) > 1e-9:
        raise ValueError("frozen source duration drifted")
    for packet in packets:
        if not math.isfinite(packet["durationSeconds"]) or packet["durationSeconds"] <= 0:
            raise ValueError("packet durations must be finite and positive")
    return packets


def render_contact(frames: list[Path], destination: Path) -> bytes:
    images: list[Image.Image] = []
    for index, frame in enumerate(frames):
        with Image.open(frame) as source:
            image = source.convert("RGB").resize((360, 360))
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 55, 28), fill="white")
        draw.text((7, 7), str(index), fill="black")
        images.append(image)
    sheet = Image.new("RGB", (2160, 720), "white")
    for index, image in enumerate(images):
        sheet.paste(image, ((index % 6) * 360, (index // 6) * 360))
    output = destination / "contact.jpg"
    sheet.save(output, quality=95)
    return output.read_bytes()


def load_frozen_inputs(spec_path: Path, matrix_path: Path, catalog_path: Path) -> dict[str, object]:
    expected = ((spec_path, SPEC_SHA256), (matrix_path, MATRIX_SHA256), (catalog_path, CATALOG_SHA256))
    for path, digest in expected:
        if not path.is_file() or file_hash(path) != digest:
            raise ValueError("frozen input is missing or changed")
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    package = next(item for item in spec["editPackages"] if item["exerciseId"] == "supported-calf-raise")
    required_prerequisites = {"editable-3d-scene-and-rig", "replaceable-support-object", "tracked-hand-contact-anchors"}
    if set(package["inputPrerequisites"]) != required_prerequisites:
        raise ValueError("support-replacement prerequisites drifted")
    if package["sourceEvidenceSha256"] != SOURCE_SHA256 or package["fallback"] != "custom-3d" or package["releaseBlocked"] is not True:
        raise ValueError("support-replacement contract drifted")
    matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
    candidate = next(item for item in matrix["assets"] if item["id"] == "supported-calf-raise")
    if candidate["evidence"]["sha256"] != SOURCE_SHA256 or candidate["evidence"]["kind"] != "gymvisual-watermarked-comp":
        raise ValueError("candidate identity drifted")
    catalog = catalog_path.read_text(encoding="utf-8")
    catalog_tokens = (
        "id:'supported-calf-raise'",
        "equipmentOptions:[['stable_chair']]",
        "双手只轻扶椅背保持平衡",
        "停顿1秒，再受控落回，不弹跳",
    )
    if not all(token in catalog for token in catalog_tokens):
        raise ValueError("supported calf raise catalog contract drifted")
    return package


def best_effort_unlink(path: Path) -> None:
    try:
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


def analyze(source: Path, spec: Path, matrix: Path, catalog: Path) -> tuple[dict[str, object], bytes]:
    if not source.is_file() or file_hash(source) != SOURCE_SHA256:
        raise ValueError("frozen candidate is missing or changed")
    contract = load_frozen_inputs(spec, matrix, catalog)
    with tempfile.TemporaryDirectory(prefix="move28-supported-calf-") as temporary:
        root = Path(temporary)
        frames = extract_frames(source, root / "frames")
        packets = probe_packets(source)
        contact = render_contact(frames, root)
    if hashlib.sha256(contact).hexdigest() != CONTACT_SHA256:
        raise ValueError("numbered contact sheet drifted")
    peak_duration = packets[PEAK_FRAME]["durationSeconds"]
    prerequisites = {
        "editable3dSceneAndRig": False,
        "replaceableSupportObject": False,
        "trackedHandContactAnchors": False,
    }
    return ({
        "schemaVersion": 1,
        "exerciseId": "supported-calf-raise",
        "frozenInputs": {
            "sourceSha256": SOURCE_SHA256,
            "productionSpecSha256": SPEC_SHA256,
            "candidateMatrixSha256": MATRIX_SHA256,
            "exerciseCatalogSha256": CATALOG_SHA256,
        },
        "source": {"kind": "gymvisual-watermarked-comp", "width": 180, "height": 180, "frameCount": FRAME_COUNT, "durationSeconds": DURATION_SECONDS},
        "manualMotionReview": {
            "basis": "numbered-contact-sheet-plus-key-frame-review",
            "contactSheetSha256": CONTACT_SHA256,
            "bilateralCalfRaiseVisible": True,
            "kneesRemainNaturallyExtended": True,
            "handsRemainOnExistingSupport": True,
            "existingSupportIsStableChair": False,
            "existingSupportClassification": "gym-bench-or-machine-support",
            "ballisticBounceVisible": False,
        },
        "automatedTimingEvidence": {
            "peakEncodedFrame": PEAK_FRAME,
            "peakDurationSeconds": peak_duration,
            "meetsOneSecondPeak": peak_duration >= 1.0,
            "packetDurationsSeconds": [packet["durationSeconds"] for packet in packets],
        },
        "editPrerequisites": prerequisites,
        "allEditPrerequisitesMet": all(prerequisites.values()),
        "prohibitedShortcutAssessment": {
            "twoDimensionalChairOverlayWouldBeRequired": True,
            "labelOnlyChairClaimWouldBeRequired": True,
            "bothForbiddenByContract": True,
        },
        "decision": "no-go",
        "nextStage": contract["fallback"],
        "releaseEligible": False,
        "conclusion": "The raster preview preserves the calf-raise motion and a one-second peak, but it contains no editable 3D scene, replaceable support object or tracked hand anchors. Replacing the gym support with a stable chair would require a forbidden 2D overlay or label-only claim, so route to custom 3D.",
    }, contact)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--spec", type=Path, default=SPEC)
    parser.add_argument("--matrix", type=Path, default=MATRIX)
    parser.add_argument("--catalog", type=Path, default=CATALOG)
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--contact", type=Path, default=CONTACT)
    args = parser.parse_args()
    analysis_complete = False
    outputs_validated = False
    try:
        inputs = {args.source.resolve(), args.spec.resolve(), args.matrix.resolve(), args.catalog.resolve()}
        outputs = {args.report.resolve(), args.contact.resolve()}
        if len(outputs) != 2 or inputs & outputs:
            raise ValueError("input and output paths must be distinct")
        outputs_validated = True
        report, contact = analyze(args.source.resolve(), args.spec.resolve(), args.matrix.resolve(), args.catalog.resolve())
        analysis_complete = True
        transactional_write([(args.report, json_bytes(report)), (args.contact, contact)])
        print(json.dumps({"ok": True, "decision": report["decision"], "report": str(args.report)}, allow_nan=False))
        return 0
    except Exception:
        if outputs_validated and not analysis_complete:
            best_effort_unlink(args.report)
            best_effort_unlink(args.contact)
        print(json.dumps({"ok": False, "error": "analysis_failed"}, allow_nan=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
