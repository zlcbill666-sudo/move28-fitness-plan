#!/usr/bin/env python
"""Validate and render the Move28 edit/custom production specification."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import os
import re
import stat
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "docs" / "research" / "data" / "move28-media-production-spec.json"
MATRIX = ROOT / "docs" / "research" / "data" / "move28-3d-candidate-matrix.json"
OUT = ROOT / "media-build" / "source-research" / "move28-media-production-review.html"
EDIT_IDS = ["high-seat-sit-to-stand", "seated-knee-extension-unloaded", "supported-calf-raise", "calf-stretch"]
CUSTOM_IDS = ["wall-hip-hinge", "bird-dog-regression", "supported-standing-march", "ankle-circle", "dead-bug"]
EXPECTED_EDIT_STRATEGY = {
    "high-seat-sit-to-stand": "conditional-scene-reedit",
    "seated-knee-extension-unloaded": "phase-locked-unilateral-trim",
    "supported-calf-raise": "conditional-support-replacement",
    "calf-stretch": "peak-pose-hold-extension",
}
EXPECTED_SOURCE_IDENTITY = {
    "high-seat-sit-to-stand": ("https://gymvisual.com/animated-gifs/16441-bodyweight-bench-squat-female.html", "524b58efaa70cf156c13276d180d940906d39645fb4298035b19021e0fbf87f6"),
    "seated-knee-extension-unloaded": ("https://gymvisual.com/animated-gifs/24630-seated-alternate-knee-extension-on-chair-male.html", "6589241da7ec6a8a00b373606ff042d6702199bcbbc2873400db399df93ab6ab"),
    "supported-calf-raise": ("https://gymvisual.com/animated-gifs/6587-standing-calf-raise-with-support-female.html", "0880cf0843e5c957a38f9c3ebc1e0fa2670e4615ae71df18c017fe20096c7cfa"),
    "calf-stretch": ("https://gymvisual.com/videos/20530-sitting-toe-tapping-stretch-on-a-chair-female.html", "ca42d32791559d76e71ff50da367618667f1cb90f328605960cd4cd6b5891be7"),
}
EXPECTED_CATALOG_HASH = {
    "ankle-circle": "ef6e55b3ac755f4a2476eae5d6d0278feb624917e0faf1577b8a1b54289df3c3",
    "wall-hip-hinge": "d4d734a9f26e84ef8abb8582d3bef7fb8757e3269188124e5e58dfc1612c2992",
    "high-seat-sit-to-stand": "1de346ae2b84ee555ceaad562284b49d27b781c167d03ddfcad05ee08ab3b119",
    "seated-knee-extension-unloaded": "0e8eb583e6dec7d61635470d5a154bed72b7f3ba1e9d5e330457e7b1028f93a6",
    "supported-calf-raise": "24c346c11bc4bcc228b27b0588cd8f265496175ca0815c08086288a7961b941a",
    "dead-bug": "9b5bb95ae9dc084d24aec1a3ef7debdd7ef0e3caeee5e90cbd686a7f14a5d723",
    "bird-dog-regression": "ad6eb055cea50e0e9cf43551ad6fa32fa25344adafc0af168469f49638b8ed65",
    "supported-standing-march": "8c63228b7310e8332010cd77d950490dac3660588911e2fe20513a47d2dd7c26",
    "calf-stretch": "e7688ca81c46de86e602a32bc8d78f6e516d699c25da3ab57ff557ce8f51c0da",
}
EXPECTED_PACKAGE_HASH = {
    "high-seat-sit-to-stand": "dea1fb823370efd88d921b97a1372a936c4e9eda3bf7edd9fcfee4da5b3d98e4",
    "seated-knee-extension-unloaded": "84587c3726de60eaa915e4f25c7de224eb461a18c3642b9fa4fb69359c2838dc",
    "supported-calf-raise": "74cabb36612671f3105f3f8327bbf57923cd09e8c30a4ccc9e783161aac3f405",
    "calf-stretch": "19b317f948e16eef4d80cca3b8ddce6931687a84b93aa69ffd6a012ea632e5ec",
    "wall-hip-hinge": "c934f71001e0ecc1c5a2c664ac6490cbd71b19304c1fa72643597ae0ec8d041c",
    "bird-dog-regression": "2c45899f1024e8660d324d3d291c5d4fd933b1c9df1771e82c3f87a614c9d68b",
    "supported-standing-march": "e8fca19e55aed9a192b2ea542a6dfad33962c55a59349810bbeb0bbc8b0f88a8",
    "ankle-circle": "06d1db8ab2604dbc6d70607b0fcdc8a7a195bdc26b2443a14fbdc999b22dda21",
    "dead-bug": "a673abdf1f071ea527005dc45c85076b2aa5933bffb4b7835ed30dfef380c6ef",
}
OPERATORS = {"eq", "gte", "lte", "between"}
EXPECTED_STANDARD_HASH = {
    "visualStandard": "8400b822ac303cbd22c8ad51b7fb288d77ad9b20077f360d42bda513be58a54a",
    "technicalStandard": "9d048bce55118af11e445f3efaddf7dc8d1b9a264140bf53f971196196469150",
    "productionPackageSchema": "b62c8956d80553a48b9b8cad23c779b5240511d04702f33a18882b0776feebe3",
}
EXPECTED_SPEC_HASH = "e5ed6ee9c3ea0e5edacdd449d51775fbf2b19eb673a6370f51cd3e1b08cf9d49"
EXPECTED_MATRIX_HASH = "75da1b45909e34634756f153a4d08861777f953fbd8cb766320f951de803980b"
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def catalog_contracts() -> dict[str, dict[str, object]]:
    ids = EDIT_IDS + CUSTOM_IDS
    script = """
const {exerciseCatalog}=require('./src/data/exercise-catalog.js');
const ids=new Set(JSON.parse(process.argv[1])); const out={};
for(const x of exerciseCatalog) if(ids.has(x.id)) out[x.id]={equipmentOptions:x.equipmentOptions,dose:x.dose,setup:x.start,movement:x.steps,errors:x.errors,safety:x.safety};
process.stdout.write(JSON.stringify(out));
"""
    result = subprocess.run(["node", "-e", script, json.dumps(ids)], cwd=ROOT, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def contract_hash(contract: dict[str, object]) -> str:
    payload = json.dumps(contract, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_unsafe_path(path: Path) -> bool:
    if path.is_symlink():
        return True
    try:
        attributes = getattr(path.stat(follow_symlinks=False), "st_file_attributes", 0)
    except FileNotFoundError:
        return False
    except OSError:
        return True
    return bool(attributes & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0))


def metric_passes(metric: dict[str, object], actual: object) -> bool:
    operator = metric["operator"]
    expected = metric["value"]
    if isinstance(actual, float) and not math.isfinite(actual):
        return False
    if operator == "eq":
        return type(actual) is type(expected) and actual == expected
    if not isinstance(actual, (int, float)) or isinstance(actual, bool):
        return False
    if operator == "gte":
        return actual >= expected
    if operator == "lte":
        return actual <= expected
    if operator == "between":
        return expected[0] <= actual <= expected[1]
    return False


def probe_media(path: Path, expected: dict[str, object]) -> None:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=format_name:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", str(path)],
        text=True,
        capture_output=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    streams = payload.get("streams", [])
    video = [stream for stream in streams if stream.get("codec_type") == "video"]
    audio = [stream for stream in streams if stream.get("codec_type") == "audio"]
    if len(video) != 1 or len(audio) != expected["audioStreams"]:
        raise ValueError(f"{path.name} stream count is invalid")
    stream = video[0]
    if stream.get("codec_name") != expected["videoCodec"] or stream.get("width") != expected["width"] or stream.get("height") != expected["height"]:
        raise ValueError(f"{path.name} codec or dimensions are invalid")
    if "fps" in expected and stream.get("r_frame_rate") != f"{expected['fps']}/1":
        raise ValueError(f"{path.name} frame rate is invalid")
    format_name = payload.get("format", {}).get("format_name", "")
    aliases = {"webm": "webm", "mp4": "mp4", "gif": "gif", "png": "png_pipe"}
    if aliases[expected["format"]] not in format_name:
        raise ValueError(f"{path.name} container is invalid")


def decoded_pixels(path: Path, width: int, height: int, frame_index: int = 0) -> bytes:
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"select=eq(n\\,{frame_index})", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
        check=True,
    )
    if len(result.stdout) != width * height * 3:
        raise ValueError(f"{path.name} decoded frame is invalid")
    return result.stdout


def decoded_pixel_hash(path: Path, width: int, height: int, frame_index: int = 0) -> str:
    return hashlib.sha256(decoded_pixels(path, width, height, frame_index)).hexdigest()


def expected_contact_sheet(frame_pattern: Path, frame_count: int, layout: dict[str, object]) -> bytes:
    columns = int(layout["columns"])
    rows = (frame_count + columns - 1) // columns
    thumb_width = int(layout["thumbnailWidth"])
    thumb_height = int(layout["thumbnailHeight"])
    result = subprocess.run(
        ["ffmpeg", "-v", "error", "-framerate", "1", "-i", str(frame_pattern), "-vf", f"scale={thumb_width}:{thumb_height}:flags=lanczos,tile={columns}x{rows}:nb_frames={frame_count}:padding=0:margin=0:color=black", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
        check=True,
    )
    expected_size = columns * thumb_width * rows * thumb_height * 3
    if len(result.stdout) != expected_size:
        raise ValueError("contact sheet source rendering is invalid")
    return result.stdout


def decoded_frame_count(path: Path) -> int:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "default=nokey=1:noprint_wrappers=1", str(path)],
        text=True,
        capture_output=True,
        check=True,
    )
    return int(result.stdout.strip())


def visual_sequence_frame_maes(path: Path, frame_paths: list[Path], width: int, height: int) -> list[float]:
    def fingerprints(source: Path, frame_limit: int | None = None) -> bytes:
        command = ["ffmpeg", "-v", "error"]
        if frame_limit is not None:
            command.extend(["-framerate", "1"])
        command.extend(["-i", str(source)])
        if frame_limit is not None:
            command.extend(["-frames:v", str(frame_limit)])
        command.extend(["-vf", f"scale={width}:{height}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
        result = subprocess.run(command, capture_output=True, check=True)
        return result.stdout
    decoded = fingerprints(path)
    source_pattern = frame_paths[0].parent / "frame-%04d.png"
    sources = fingerprints(source_pattern, len(frame_paths))
    if len(decoded) != len(sources) or not sources:
        raise ValueError(f"{path.name} visual fingerprint frame count is invalid")
    frame_size = width * height * 3
    return [
        sum(abs(left - right) for left, right in zip(decoded[offset:offset + frame_size], sources[offset:offset + frame_size])) / frame_size
        for offset in range(0, len(sources), frame_size)
    ]


def verify_production_package(spec: dict[str, object], package: dict[str, object]) -> None:
    exercise_id = package["exerciseId"]
    technical = spec["technicalStandard"]
    schema = spec["productionPackageSchema"]
    root = ROOT / technical["outputRoot"] / exercise_id
    output_root = ROOT / technical["outputRoot"]
    try:
        root.relative_to(ROOT)
    except ValueError as exc:
        raise ValueError(f"{exercise_id} production path escapes project root") from exc
    path_chain = [output_root, root]
    current = output_root.parent
    while current != ROOT and current != current.parent:
        path_chain.append(current)
        current = current.parent
    if current != ROOT or any(is_unsafe_path(path) for path in path_chain):
        raise ValueError(f"{exercise_id} production path contains a link or reparse point")
    required_file_paths = [root / name for name in technical["requiredFiles"]]
    required_dir_paths = [root / name for name in technical["requiredDirectories"]]
    if not root.is_dir() or any(not path.is_file() or is_unsafe_path(path) for path in required_file_paths) or any(not path.is_dir() or is_unsafe_path(path) for path in required_dir_paths):
        raise ValueError(f"{exercise_id} production package is incomplete")
    if {entry.name for entry in root.iterdir()} != set(technical["requiredFiles"] + technical["requiredDirectories"]):
        raise ValueError(f"{exercise_id} production package has unknown files")
    manifest = json.loads((root / "production-manifest.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or set(manifest) != set(schema["manifestRequiredFields"]) or manifest.get("schemaVersion") != schema["schemaVersion"] or manifest.get("exerciseId") != exercise_id:
        raise ValueError(f"{exercise_id} production manifest is invalid")
    contract_path = root / "contract.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    if contract != package or manifest.get("contractSha256") != file_hash(contract_path):
        raise ValueError(f"{exercise_id} contract binding is invalid")
    frames = manifest.get("frames")
    frame_count = manifest.get("frameCount")
    if not isinstance(frame_count, int) or isinstance(frame_count, bool) or frame_count < 2 or not isinstance(frames, list) or len(frames) != frame_count or manifest.get("framePattern") != technical["framePattern"]:
        raise ValueError(f"{exercise_id} frame manifest is invalid")
    expected_paths = [f"frames/frame-{index:04d}.png" for index in range(frame_count)]
    frame_directory = root / technical["masterDirectory"]
    frame_entries = list(frame_directory.iterdir())
    actual_frame_paths = sorted(path.relative_to(root).as_posix() for path in frame_entries)
    if actual_frame_paths != expected_paths or any(not path.is_file() or is_unsafe_path(path) for path in frame_entries):
        raise ValueError(f"{exercise_id} frame directory has missing, extra, or unsafe entries")
    frame_lines: list[str] = []
    frame_pixel_hashes: list[str] = []
    for index, entry in enumerate(frames):
        if not isinstance(entry, dict) or set(entry) != set(schema["frameEntryFields"]) or entry.get("path") != expected_paths[index] or not SHA256_RE.fullmatch(str(entry.get("sha256", ""))):
            raise ValueError(f"{exercise_id} frame entry is invalid")
        frame_path = root / entry["path"]
        if not frame_path.is_file() or frame_path.is_symlink() or file_hash(frame_path) != entry["sha256"]:
            raise ValueError(f"{exercise_id} frame hash is invalid")
        probe_media(frame_path, {"format": "png", "videoCodec": "png", "width": technical["width"], "height": technical["height"], "audioStreams": 0})
        pixels = decoded_pixels(frame_path, technical["width"], technical["height"])
        frame_pixel_hashes.append(hashlib.sha256(pixels).hexdigest())
        frame_lines.append(f"{entry['path']}:{entry['sha256']}\n")
    if frame_pixel_hashes[0] == frame_pixel_hashes[-1]:
        raise ValueError(f"{exercise_id} has a duplicate terminal frame")
    frame_set_hash = hashlib.sha256("".join(frame_lines).encode()).hexdigest()
    if manifest.get("sourceFrameSetSha256") != frame_set_hash:
        raise ValueError(f"{exercise_id} frame-set binding is invalid")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, dict) or set(artifacts) != set(schema["artifactNames"]):
        raise ValueError(f"{exercise_id} artifact manifest is invalid")
    media_evidence_hashes: set[str] = set()
    for name, entry in artifacts.items():
        if not isinstance(entry, dict) or set(entry) != set(schema["artifactEntryFields"]) or entry.get("sourceFrameSetSha256") != frame_set_hash or not SHA256_RE.fullmatch(str(entry.get("sha256", ""))):
            raise ValueError(f"{exercise_id} artifact binding is invalid")
        if file_hash(root / name) != entry["sha256"]:
            raise ValueError(f"{exercise_id} artifact hash is invalid")
        if name not in {"qa-report.json", "manual-review.json"}:
            media_evidence_hashes.add(entry["sha256"])
    if manifest.get("mediaProbe") != schema["mediaProbeContracts"]:
        raise ValueError(f"{exercise_id} media probes do not match the frozen codecs")
    for name, expected in schema["mediaProbeContracts"].items():
        probe_media(root / name, expected)
    visual_binding = schema["artifactVisualBinding"]
    frame_pattern = frame_directory / "frame-%04d.png"
    frame_paths = [root / path for path in expected_paths]
    for name in ("master.webm", "review.mp4", "fallback.gif"):
        binding = visual_binding[name]
        actual_count = decoded_frame_count(root / name)
        frame_maes = visual_sequence_frame_maes(root / name, frame_paths, binding["fingerprintWidth"], binding["fingerprintHeight"])
        failed_frames = [index for index, mae in enumerate(frame_maes) if mae > binding["maxMeanAbsoluteError"]]
        if actual_count != frame_count or len(frame_maes) != frame_count or failed_frames:
            raise ValueError(f"{exercise_id} {name} is not derived from the approved frame sequence (frames={actual_count}, failedFrames={failed_frames})")
    if decoded_pixel_hash(root / "poster.png", technical["width"], technical["height"]) != frame_pixel_hashes[visual_binding["poster.png"]["sourceFrameIndex"]]:
        raise ValueError(f"{exercise_id} poster is not the approved source frame")
    layout = schema["contactSheetLayout"]
    rows = (frame_count + layout["columns"] - 1) // layout["columns"]
    sheet_width = layout["columns"] * layout["thumbnailWidth"]
    sheet_height = rows * layout["thumbnailHeight"]
    if decoded_pixels(root / "contact-sheet.png", sheet_width, sheet_height) != expected_contact_sheet(frame_pattern, frame_count, layout):
        raise ValueError(f"{exercise_id} contact sheet does not contain every approved frame")
    if manifest.get("contactSheetCoverage") != list(range(frame_count)):
        raise ValueError(f"{exercise_id} contact sheet does not cover every frame")
    gates = manifest.get("gates")
    if not isinstance(gates, dict) or set(gates) != set(schema["gateNames"]):
        raise ValueError(f"{exercise_id} gates are incomplete")
    for gate in gates.values():
        if not isinstance(gate, dict) or set(gate) != set(schema["gateEntryFields"]) or gate.get("status") != schema["gateStatusRequired"] or not re.fullmatch(schema["reviewerIdPattern"], str(gate.get("reviewerId", ""))) or not re.fullmatch(schema["reviewedAtPattern"], str(gate.get("reviewedAt", ""))) or gate.get("evidenceSha256") not in media_evidence_hashes:
            raise ValueError(f"{exercise_id} gate evidence is invalid")
    manual_review = json.loads((root / "manual-review.json").read_text(encoding="utf-8"))
    qa_report = json.loads((root / "qa-report.json").read_text(encoding="utf-8"))
    if manual_review != gates or not isinstance(qa_report, dict) or set(qa_report) != set(schema["qaReportFields"]) or qa_report.get("sourceFrameSetSha256") != frame_set_hash or qa_report.get("passed") is not True or qa_report.get("contactSheetCoverage") != list(range(frame_count)) or qa_report.get("contactSheetSha256") != file_hash(root / "contact-sheet.png"):
        raise ValueError(f"{exercise_id} QA or manual review is invalid")
    metric_contracts = package["acceptanceCriteria"] if "acceptanceCriteria" in package else package["qaMetrics"]
    metric_results = qa_report.get("metricResults")
    evidence_hashes = media_evidence_hashes
    if not isinstance(metric_results, list) or len(metric_results) != len(metric_contracts):
        raise ValueError(f"{exercise_id} QA metric results are incomplete")
    results_by_id: dict[str, dict[str, object]] = {}
    for result in metric_results:
        if not isinstance(result, dict) or set(result) != set(schema["metricResultFields"]) or not isinstance(result.get("metricId"), str) or result["metricId"] in results_by_id or result.get("evidenceSha256") not in evidence_hashes:
            raise ValueError(f"{exercise_id} QA metric result is invalid")
        results_by_id[result["metricId"]] = result
    if set(results_by_id) != {metric["id"] for metric in metric_contracts}:
        raise ValueError(f"{exercise_id} QA metric identities do not match the contract")
    for metric in metric_contracts:
        if not metric_passes(metric, results_by_id[metric["id"]].get("actual")):
            raise ValueError(f"{exercise_id} QA metric {metric['id']} failed its contract")


def require_string_list(item: dict[str, object], key: str) -> None:
    value = item.get(key)
    if not isinstance(value, list) or not value or any(not isinstance(entry, str) or not entry for entry in value) or len(value) != len(set(value)):
        raise ValueError(f"{item.get('exerciseId', 'package')} has invalid {key}")


def validate_metrics(item: dict[str, object], key: str) -> None:
    metrics = item.get(key)
    if not isinstance(metrics, list) or not metrics:
        raise ValueError(f"{item['exerciseId']} has no {key}")
    ids: list[str] = []
    for metric in metrics:
        if not isinstance(metric, dict) or set(metric) not in ({"id", "metric", "operator", "value"}, {"id", "metric", "operator", "value", "unit"}):
            raise ValueError(f"{item['exerciseId']} has invalid metric fields")
        if any(not isinstance(metric.get(field), str) or not metric[field] for field in ("id", "metric", "operator")):
            raise ValueError(f"{item['exerciseId']} has invalid metric identity")
        if metric["operator"] not in OPERATORS:
            raise ValueError(f"{item['exerciseId']} has invalid metric operator")
        value = metric["value"]
        if metric["operator"] == "between":
            if not isinstance(value, list) or len(value) != 2 or any(not isinstance(v, (int, float)) or isinstance(v, bool) for v in value) or value[0] > value[1]:
                raise ValueError(f"{item['exerciseId']} has invalid between metric")
        elif isinstance(value, dict) or value is None or isinstance(value, float) and (value != value or abs(value) == float("inf")):
            raise ValueError(f"{item['exerciseId']} has invalid metric value")
        ids.append(metric["id"])
    if len(ids) != len(set(ids)):
        raise ValueError(f"{item['exerciseId']} has duplicate metric IDs")


def validate(spec: object, matrix: object, contracts: dict[str, dict[str, object]]) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    if not isinstance(spec, dict) or spec.get("schemaVersion") != 1 or spec.get("updatedAt") != "2026-08-13" or spec.get("scope") != "Internal production specification for four controlled edits and five custom 3D actions." or spec.get("releaseEligible") is not False or spec.get("externalActionPerformed") is not False:
        raise ValueError("production specification header is invalid")
    expected_top_fields = {"schemaVersion", "updatedAt", "scope", "releaseEligible", "externalActionPerformed", "sourceMatrix", "visualStandard", "technicalStandard", "productionPackageSchema", "editPackages", "customPackages"}
    if set(spec) != expected_top_fields:
        raise ValueError("production specification has unknown or missing top-level fields")
    if spec.get("sourceMatrix") != "docs/research/data/move28-3d-candidate-matrix.json":
        raise ValueError("source matrix identity has drifted")
    visual = spec.get("visualStandard")
    technical = spec.get("technicalStandard")
    expected_visual_fields = {"background", "figure", "targetHighlight", "watermark", "camera", "subjectHeightPercent", "forbidden"}
    expected_technical_fields = {"width", "height", "fps", "master", "masterDirectory", "framePattern", "primary", "review", "fallback", "poster", "audioTracks", "duplicateTerminalFrame", "requiredDirectories", "requiredFiles", "requiredGates", "outputRoot"}
    if not isinstance(visual, dict) or set(visual) != expected_visual_fields or not isinstance(technical, dict) or set(technical) != expected_technical_fields:
        raise ValueError("visual or technical standard has unknown or missing fields")
    if visual.get("background") != "pure-white-opaque" or visual.get("figure") != "gray-white-anatomical-human" or visual.get("targetHighlight") != "red-surface-bound-muscle-region" or visual.get("watermark") != "none":
        raise ValueError("visual standard is incomplete")
    require_string_list(visual, "forbidden")
    expected_files = {"contract.json", "production-manifest.json", "master.webm", "review.mp4", "fallback.gif", "poster.png", "contact-sheet.png", "qa-report.json", "manual-review.json"}
    expected_gates = {"motionGate", "safetyGate", "visualGate", "technicalGate"}
    if technical.get("width") != 512 or technical.get("height") != 512 or technical.get("fps") != 24 or technical.get("master") != "png-sequence" or technical.get("masterDirectory") != "frames" or technical.get("framePattern") != "frame-%04d.png" or technical.get("review") != "mp4-h264" or technical.get("audioTracks") != 0 or technical.get("duplicateTerminalFrame") is not False:
        raise ValueError("technical standard is incomplete")
    if technical.get("requiredDirectories") != ["frames"] or set(technical.get("requiredFiles", [])) != expected_files or set(technical.get("requiredGates", [])) != expected_gates:
        raise ValueError("technical deliverables or gates have drifted")
    package_schema = spec.get("productionPackageSchema")
    if not isinstance(package_schema, dict):
        raise ValueError("production package schema is invalid")
    for key, standard in (("visualStandard", visual), ("technicalStandard", technical), ("productionPackageSchema", package_schema)):
        standard_hash = hashlib.sha256(json.dumps(standard, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        if standard_hash != EXPECTED_STANDARD_HASH[key]:
            raise ValueError(f"{key} has drifted from the reviewed baseline")
    spec_hash = hashlib.sha256(json.dumps(spec, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if spec_hash != EXPECTED_SPEC_HASH:
        raise ValueError("production specification has drifted from the reviewed baseline")
    edits = spec.get("editPackages")
    customs = spec.get("customPackages")
    if not isinstance(edits, list) or not isinstance(customs, list) or [item.get("exerciseId") for item in edits] != EDIT_IDS or [item.get("exerciseId") for item in customs] != CUSTOM_IDS:
        raise ValueError("production package IDs are missing, extra, duplicated, or out of order")
    if not isinstance(matrix, dict) or not isinstance(matrix.get("assets"), list):
        raise ValueError("candidate matrix is invalid")
    matrix_hash = hashlib.sha256(json.dumps(matrix, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if matrix_hash != EXPECTED_MATRIX_HASH:
        raise ValueError("candidate matrix identity has drifted from the reviewed baseline")
    matrix_by_id = {item["id"]: item for item in matrix["assets"]}
    for item in edits:
        exercise_id = item["exerciseId"]
        required = {"exerciseId", "sourceProductUrl", "sourceEvidenceSha256", "strategy", "inputPrerequisites", "allowedOperations", "forbiddenOperations", "acceptanceCriteria", "fallback", "releaseBlocked", "catalogContractSha256"}
        if set(item) != required or item.get("releaseBlocked") is not True or item.get("fallback") != "custom-3d":
            raise ValueError(f"{exercise_id} edit package fields or fallback are invalid")
        if item.get("strategy") != EXPECTED_EDIT_STRATEGY[exercise_id]:
            raise ValueError(f"{exercise_id} edit strategy has drifted")
        if (item.get("sourceProductUrl"), item.get("sourceEvidenceSha256")) != EXPECTED_SOURCE_IDENTITY[exercise_id]:
            raise ValueError(f"{exercise_id} source identity has drifted")
        matrix_item = matrix_by_id.get(exercise_id)
        if not matrix_item or matrix_item.get("status") != "purchase-edit-candidate" or matrix_item.get("url") != item["sourceProductUrl"] or matrix_item.get("evidence", {}).get("sha256") != item["sourceEvidenceSha256"]:
            raise ValueError(f"{exercise_id} no longer matches the reviewed candidate matrix")
        for key in ("inputPrerequisites", "allowedOperations", "forbiddenOperations"):
            require_string_list(item, key)
        validate_metrics(item, "acceptanceCriteria")
    for item in customs:
        exercise_id = item["exerciseId"]
        required = {"exerciseId", "targetRegions", "scene", "requiredContacts", "phases", "forbiddenPatterns", "cameraRequirements", "qaMetrics", "releaseBlocked", "catalogContractSha256"}
        if set(item) != required or item.get("releaseBlocked") is not True:
            raise ValueError(f"{exercise_id} custom package fields are invalid")
        if matrix_by_id.get(exercise_id, {}).get("status") != "custom-3d":
            raise ValueError(f"{exercise_id} no longer matches the custom candidate matrix")
        for key in ("targetRegions", "scene", "requiredContacts", "phases", "forbiddenPatterns", "cameraRequirements"):
            require_string_list(item, key)
        validate_metrics(item, "qaMetrics")
    if set(contracts) != set(EDIT_IDS + CUSTOM_IDS):
        raise ValueError("runtime catalog contracts are missing or extra")
    for item in edits + customs:
        exercise_id = item["exerciseId"]
        actual = contract_hash(contracts[exercise_id])
        if item.get("catalogContractSha256") != EXPECTED_CATALOG_HASH[exercise_id] or actual != EXPECTED_CATALOG_HASH[exercise_id]:
            raise ValueError(f"{exercise_id} runtime catalog contract has drifted")
        package_hash = hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        if package_hash != EXPECTED_PACKAGE_HASH[exercise_id]:
            raise ValueError(f"{exercise_id} production package has drifted from the reviewed baseline")
    return edits, customs


def render(spec: dict[str, object], edits: list[dict[str, object]], customs: list[dict[str, object]], spec_hash: str) -> str:
    cards: list[str] = []
    for kind, packages in (("受控编辑", edits), ("专业定制", customs)):
        for item in packages:
            metric_key = "acceptanceCriteria" if kind == "受控编辑" else "qaMetrics"
            metrics = "".join(f"<li><code>{html.escape(metric['metric'])}</code> {html.escape(metric['operator'])} <b>{html.escape(json.dumps(metric['value'], ensure_ascii=False))}</b></li>" for metric in item[metric_key])
            warnings = item.get("forbiddenOperations", item.get("forbiddenPatterns", []))
            warning_list = "".join(f"<li>{html.escape(entry)}</li>" for entry in warnings)
            cards.append(f"<article><h2>{html.escape(item['exerciseId'])}</h2><p class='kind'>{kind}</p><h3>失败关闭项</h3><ul>{warning_list}</ul><h3>机器验收</h3><ul>{metrics}</ul><p><b>releaseBlocked=true</b></p></article>")
    return f"""<!doctype html><html lang='zh-CN'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Move28媒体生产规格审核</title><style>body{{font:15px system-ui;margin:24px;background:#f5f5f5;color:#222}}header{{background:#fff;border-left:5px solid #b51f2e;padding:18px;margin-bottom:18px}}main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}}article{{background:#fff;padding:16px;border:1px solid #ddd;border-radius:8px}}code{{word-break:break-word}}.kind{{color:#b51f2e;font-weight:700}}li{{margin:5px 0}}</style><header><h1>Move28 4项编辑＋5项定制生产规格</h1><p>仅为内部生产合同，不表示素材已编辑、已制作、已采购或可发布。正式manifest继续25/25阻塞。</p><p>规格SHA-256：<code>{spec_hash}</code></p></header><main>{''.join(cards)}</main></html>"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-production", action="store_true")
    args = parser.parse_args()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix(".html.tmp")
    temporary.unlink(missing_ok=True)
    try:
        spec_bytes = SPEC.read_bytes()
        spec = json.loads(spec_bytes)
        matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
        edits, customs = validate(spec, matrix, catalog_contracts())
        if args.verify_production:
            for package in edits + customs:
                verify_production_package(spec, package)
        spec_hash = hashlib.sha256(spec_bytes).hexdigest()
        temporary.write_text(render(spec, edits, customs, spec_hash), encoding="utf-8")
        os.replace(temporary, OUT)
    except Exception:
        temporary.unlink(missing_ok=True)
        OUT.unlink(missing_ok=True)
        raise
    print(json.dumps({"ok": True, "output": str(OUT), "specSha256": spec_hash, "editPackages": len(edits), "customPackages": len(customs)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
