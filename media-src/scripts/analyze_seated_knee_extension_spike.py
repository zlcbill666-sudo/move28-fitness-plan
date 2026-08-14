#!/usr/bin/env python
"""Reproduce the seated unloaded knee-extension edit feasibility spike."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import statistics
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "media-build/source-research/gymvisual-prepurchase-previews/seated-knee-extension-unloaded.gif"
SPEC = ROOT / "docs/research/data/move28-media-production-spec.json"
REPORT = ROOT / "docs/research/data/seated-knee-extension-unloaded-spike.json"
CONTACT_SHEET = ROOT / "media-build/spikes/seated-knee-extension-unloaded/contact-numbered.png"
REVIEW_CONTACT_SHEET = ROOT / "docs/research/evidence/move28-spikes/seated-knee-extension-unloaded/contact-numbered.png"
EXERCISE_ID = "seated-knee-extension-unloaded"
SOURCE_URL = "https://gymvisual.com/img/p/4/2/1/1/4/42114.gif"
EXPECTED_SOURCE_SHA256 = "6589241da7ec6a8a00b373606ff042d6702199bcbbc2873400db399df93ab6ab"
ENCODED_FRAME_COUNT = 24
DURATION_SECONDS = 5.0

# Human review annotation. The analyzer verifies this annotation against the
# frozen source, packet timing, generated frame hashes and frozen contract; it
# does not pretend to infer exercise semantics from pixels.
REVIEW_VERSION = 1
REVIEWED_SIDE = "first-alternating-side"
REVIEWED_CYCLE_START = 0
REVIEWED_CYCLE_END = 12
REVIEWED_PEAK_FRAME = 6
REVIEWED_PHASE_ORDER = ["neutral", "extend", "near-straight", "return", "neutral"]


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str], *, text: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, capture_output=True, text=text)


def fetch_frozen_source(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix="move28-knee-source-", suffix=".gif", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=30) as response, temporary_path.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if file_hash(temporary_path) != EXPECTED_SOURCE_SHA256:
            raise ValueError("downloaded candidate source SHA-256 does not match the frozen contract")
        temporary_path.replace(destination)
    finally:
        temporary_path.unlink(missing_ok=True)


def probe_packets(source: Path) -> list[dict[str, object]]:
    result = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_packets",
        "-show_entries", "packet=pts_time,duration_time", "-of", "json", str(source),
    ], text=True)
    raw_packets = json.loads(result.stdout)["packets"]
    packets = [
        {
            "index": index,
            "ptsSeconds": float(packet["pts_time"]),
            "durationSeconds": float(packet["duration_time"]),
        }
        for index, packet in enumerate(raw_packets)
    ]
    if len(packets) != ENCODED_FRAME_COUNT:
        raise ValueError(f"expected {ENCODED_FRAME_COUNT} encoded GIF frames")
    if packets[0]["ptsSeconds"] != 0.0:
        raise ValueError("candidate packet timeline must begin at zero")
    end_time = packets[-1]["ptsSeconds"] + packets[-1]["durationSeconds"]
    if abs(end_time - DURATION_SECONDS) > 1e-9:
        raise ValueError("candidate packet timeline duration drifted")
    for previous, current in zip(packets, packets[1:]):
        expected = previous["ptsSeconds"] + previous["durationSeconds"]
        if abs(current["ptsSeconds"] - expected) > 1e-9:
            raise ValueError("candidate packet timeline is discontinuous")
    return packets


def extract_encoded_frames(source: Path, destination: Path) -> list[Path]:
    destination.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-v", "error", "-i", str(source), "-vsync", "0",
        "-start_number", "0", str(destination / "frame-%04d.png"),
    ])
    frames = sorted(destination.glob("frame-*.png"))
    if len(frames) != ENCODED_FRAME_COUNT:
        raise ValueError(f"expected {ENCODED_FRAME_COUNT} decoded GIF frames")
    return frames


def render_contact_sheet(frames: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-v", "error", "-framerate", "1", "-start_number", "0",
        "-i", str(frames / "frame-%04d.png"),
        "-vf", "scale=256:256:flags=lanczos,drawtext=text='%{n}':x=8:y=8:fontsize=28:fontcolor=yellow:borderw=2:bordercolor=black,tile=6x4:nb_frames=24:padding=2:margin=2:color=black",
        "-frames:v", "1", "-y", str(output),
    ])


def load_contract(spec_path: Path) -> dict[str, object]:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    packages = spec["editPackages"]
    package = next(item for item in packages if item["exerciseId"] == EXERCISE_ID)
    if package["sourceEvidenceSha256"] != EXPECTED_SOURCE_SHA256:
        raise ValueError("frozen production contract source identity drifted")
    if package["sourceProductUrl"] != "https://gymvisual.com/animated-gifs/24630-seated-alternate-knee-extension-on-chair-male.html":
        raise ValueError("frozen production contract product identity drifted")
    if package["fallback"] != "custom-3d":
        raise ValueError("frozen custom-3d fallback drifted")
    forbidden = package["forbiddenOperations"]
    if "knee-lock-frame-hold" not in forbidden or "speed-ramp-return-phase" not in forbidden:
        raise ValueError("frozen knee-lock or speed-ramp prohibition is missing")
    return package


def best_effort_unlink(path: Path) -> None:
    try:
        if path.is_file() or path.is_symlink():
            path.unlink(missing_ok=True)
    except OSError:
        pass


def stage_bytes(path: Path, content: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary_path = Path(temporary_name)
    descriptor_owned = True
    try:
        handle = os.fdopen(descriptor, "wb")
        descriptor_owned = False
        with handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        return temporary_path
    except Exception:
        if descriptor_owned:
            try:
                os.close(descriptor)
            except OSError:
                pass
        best_effort_unlink(temporary_path)
        raise


def transactional_write(outputs: list[tuple[Path, bytes]]) -> None:
    if len({str(path.resolve()) for path, _ in outputs}) != len(outputs):
        raise ValueError("transaction output paths must be unique")
    for path, _ in outputs:
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and not (path.is_file() or path.is_symlink()):
            raise ValueError("transaction output target must be a file")

    staged: list[tuple[Path, Path]] = []
    backups: list[tuple[Path, Path]] = []
    installed: list[Path] = []
    preserved_backups: set[Path] = set()
    try:
        for path, content in outputs:
            staged.append((path, stage_bytes(path, content)))
        for path, temporary_path in staged:
            if path.exists() or path.is_symlink():
                descriptor, backup_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".bak", dir=path.parent)
                os.close(descriptor)
                backup_path = Path(backup_name)
                backup_path.unlink()
                path.replace(backup_path)
                backups.append((path, backup_path))
            temporary_path.replace(path)
            installed.append(path)
        for _, backup_path in backups:
            best_effort_unlink(backup_path)
    except Exception as install_error:
        rollback_errors: list[OSError] = []
        for path in reversed(installed):
            best_effort_unlink(path)
        for path, backup_path in reversed(backups):
            try:
                if backup_path.exists():
                    backup_path.replace(path)
            except OSError as rollback_error:
                preserved_backups.add(backup_path)
                rollback_errors.append(rollback_error)
        if rollback_errors:
            raise ExceptionGroup("transaction install and rollback failed", [install_error, *rollback_errors])
        raise
    finally:
        for _, temporary_path in staged:
            best_effort_unlink(temporary_path)
        for _, backup_path in backups:
            if backup_path not in preserved_backups:
                best_effort_unlink(backup_path)


def json_bytes(payload: dict[str, object]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def classify_peak_hold(packet_durations: list[float], peak_frame: int) -> dict[str, object]:
    if isinstance(peak_frame, bool) or not isinstance(peak_frame, int):
        raise ValueError("manual peak-frame annotation must be an integer")
    if not packet_durations or peak_frame < 0 or peak_frame >= len(packet_durations):
        raise ValueError("manual peak-frame annotation is outside the packet timeline")
    if any(
        isinstance(value, bool) or not isinstance(value, (int, float))
        or not math.isfinite(value) or value <= 0
        for value in packet_durations
    ):
        raise ValueError("packet durations must be finite positive numbers")
    nominal = float(statistics.median(packet_durations))
    peak = float(packet_durations[peak_frame])
    multiplier = peak / nominal
    if not math.isfinite(nominal) or nominal <= 0 or not math.isfinite(multiplier) or multiplier <= 0:
        raise ValueError("derived packet timing values must be finite positive numbers")
    hold = multiplier > 1.0 + 1e-9
    return {
        "peakEncodedFrame": peak_frame,
        "peakDurationSeconds": peak,
        "nominalMotionFrameSeconds": nominal,
        "durationMultiplier": multiplier,
        "prolongedStaticPeak": hold,
        "forbiddenOperationDetected": "knee-lock-frame-hold" if hold else None,
        "decision": "no-go" if hold else "requires-manual-review",
        "fallback": "custom-3d" if hold else None,
    }


def build_report(source: Path, spec_path: Path) -> tuple[dict[str, object], bytes]:
    contract = load_contract(spec_path)
    if not source.is_file():
        raise ValueError("frozen candidate source is missing; use --fetch-source explicitly")
    source_sha256 = file_hash(source)
    if source_sha256 != EXPECTED_SOURCE_SHA256:
        raise ValueError("candidate source SHA-256 does not match the frozen contract")
    packets = probe_packets(source)
    with tempfile.TemporaryDirectory(prefix="move28-knee-spike-") as temporary:
        frame_dir = Path(temporary) / "frames"
        frames = extract_encoded_frames(source, frame_dir)
        frame_hashes = [file_hash(frame) for frame in frames]
        generated_sheet = Path(temporary) / "contact-numbered.png"
        render_contact_sheet(frame_dir, generated_sheet)
        if not REVIEW_CONTACT_SHEET.is_file():
            raise ValueError("versioned manual-review contact sheet is missing")
        # The manual review is bound to the versioned contact sheet bytes.
        # Regenerate a sheet above to prove the frozen source is still decodable,
        # but write the reviewed artifact so local ffmpeg/font rendering drift cannot
        # silently replace the evidence named by the report hash.
        contact_bytes = REVIEW_CONTACT_SHEET.read_bytes()
        contact_hash = hashlib.sha256(contact_bytes).hexdigest()
    timing = classify_peak_hold([packet["durationSeconds"] for packet in packets], REVIEWED_PEAK_FRAME)
    report = {
        "schemaVersion": 2,
        "exerciseId": EXERCISE_ID,
        "source": {
            "productUrl": contract["sourceProductUrl"],
            "directEvidenceUrl": SOURCE_URL,
            "sha256": source_sha256,
            "encodedFrameCount": len(frame_hashes),
            "durationSeconds": DURATION_SECONDS,
            "packets": packets,
            "encodedFrameSha256": frame_hashes,
        },
        "manualMotionReview": {
            "reviewVersion": REVIEW_VERSION,
            "reviewBasis": "numbered-encoded-frame-contact-sheet",
            "contactSheetSha256": contact_hash,
            "selectedSide": REVIEWED_SIDE,
            "cycleEncodedFrameStart": REVIEWED_CYCLE_START,
            "cycleEncodedFrameEnd": REVIEWED_CYCLE_END,
            "phaseOrder": REVIEWED_PHASE_ORDER,
            "sameSideCompleteReturnVisible": True,
            "peakEncodedFrame": REVIEWED_PEAK_FRAME,
        },
        "automatedTimingEvidence": timing,
        "repairAssessment": {
            "interiorPeakFrameDeletionAllowed": False,
            "speedRampAllowed": False,
            "reason": "The frozen contract permits neutral-boundary trimming, not deleting or retiming interior motion phases.",
        },
        "decision": timing["decision"],
        "fallback": timing["fallback"],
        "releaseEligible": False,
        "externalActionPerformed": False,
        "conclusion": "The reviewed unilateral cycle contains a 0.5-second static peak frame, five times the nominal motion-frame duration. This is a prohibited knee-lock-frame-hold; reject the edit candidate and use custom-3d.",
    }
    return report, contact_bytes


def validate_path_boundaries(source: Path, spec: Path, report: Path, contact_sheet: Path | None) -> None:
    inputs = {source.resolve(), spec.resolve(), REVIEW_CONTACT_SHEET.resolve()}
    outputs = [report.resolve()]
    if contact_sheet is not None:
        outputs.append(contact_sheet.resolve())
    if len(set(outputs)) != len(outputs) or any(output in inputs for output in outputs):
        raise ValueError("input and output paths must be distinct")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--spec", type=Path, default=SPEC)
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--contact-sheet", type=Path, default=CONTACT_SHEET)
    parser.add_argument("--no-contact-sheet", action="store_true")
    parser.add_argument("--fetch-source", action="store_true")
    args = parser.parse_args()
    report_built = False
    cleanup_report = False
    try:
        contact_sheet = None if args.no_contact_sheet else args.contact_sheet
        validate_path_boundaries(args.source, args.spec, args.report, contact_sheet)
        cleanup_report = True
        if args.fetch_source and not args.source.is_file():
            fetch_frozen_source(args.source.resolve())
        report, contact_bytes = build_report(args.source.resolve(), args.spec.resolve())
        report_built = True
        outputs = [(args.report, json_bytes(report))]
        if not args.no_contact_sheet:
            outputs.append((args.contact_sheet, contact_bytes))
        transactional_write(outputs)
        print(json.dumps({"ok": True, "decision": report["decision"], "fallback": report["fallback"], "report": str(args.report)}, allow_nan=False))
        return 0
    except Exception:  # Fail closed without exposing paths, HTTP details or tracebacks.
        if cleanup_report and not report_built:
            best_effort_unlink(args.report)
        print(json.dumps({"ok": False, "error": "analysis_failed"}, allow_nan=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
