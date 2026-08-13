#!/usr/bin/env python
"""Build and verify the isolated Exact10 participant-media dry run."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "docs/research/data/move28-exact10-integration-dry-run.json"
CANDIDATES = ROOT / "media-build/internal-candidates/local-exercisedb-exact10"
OUTPUT_ROOT = ROOT / "media-build/integration-dry-run"
DEFAULT_OUTPUT = OUTPUT_ROOT / "exact10"
RUNTIME_MANIFEST = ROOT / "release/runtime-manifest.json"
RELEASE_VALIDATOR = ROOT / "scripts/build-release.cjs"
PROTECTED = {
    "productionPolicySha256": ROOT / "src/data/exercise-media-policy.js",
    "formalManifestSha256": ROOT / "assets/exercises/manifest.json",
    "runtimeManifestSha256": RUNTIME_MANIFEST,
}
EXPECTED_IDS = [
    "seated-leg-press", "seated-leg-curl", "glute-bridge", "chest-press-machine", "seated-row",
    "pallof-press", "seated-leg-extension", "hip-abduction-machine", "wall-push-up", "elliptical-trainer",
]
EXPECTED_TOP = {"schemaVersion", "kind", "sourceMappingSha256", "candidateCount", "releaseEligible", "formalManifestModified", "assets"}
EXPECTED_ASSET = {"exerciseId", "nameZh", "exerciseDbId", "filename", "sha256", "bytes", "width", "height", "frameCount", "durationMs", "motionReview", "visualReview", "safetyReview", "releaseEligible"}
RUNTIME_PURPOSE = "MOVE 28 participant runtime and maintenance documentation allowlist"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
SAFE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def reject_constant(value: str) -> None:
    raise ValueError(f"non-finite JSON constant: {value}")


def load_json(path: Path, trusted_root: Path | None = None) -> object:
    raw = safe_read(path, trusted_root) if trusted_root is not None else path.read_bytes()
    return json.loads(raw.decode("utf-8"), parse_constant=reject_constant)


def sha256_bytes(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def sha256(path: Path) -> str:
    return sha256_bytes(safe_read(path, path.parent))


def is_reparse(path: Path) -> bool:
    try:
        info = path.stat(follow_symlinks=False)
    except FileNotFoundError:
        return False
    except OSError:
        return True
    return path.is_symlink() or bool(getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0))


def assert_plain_chain(path: Path, trusted_root: Path, *, leaf_file: bool = True) -> None:
    root = trusted_root.absolute()
    target = path.absolute()
    try:
        relative = target.relative_to(root)
    except ValueError as error:
        raise ValueError("path escapes trusted root") from error
    current = root
    if is_reparse(current) or not current.is_dir():
        raise ValueError("trusted root is not a plain directory")
    for index, part in enumerate(relative.parts):
        current = current / part
        if is_reparse(current):
            raise ValueError("path contains a link or reparse point")
        last = index == len(relative.parts) - 1
        if current.exists() and ((last and leaf_file and not current.is_file()) or (not last and not current.is_dir())):
            raise ValueError("path component has wrong type")


def safe_read(path: Path, trusted_root: Path) -> bytes:
    assert_plain_chain(path, trusted_root)
    expected_real = path.absolute()
    if os.path.normcase(str(path.resolve(strict=True))) != os.path.normcase(str(expected_real)):
        raise ValueError("source escapes trusted root")
    before = path.stat(follow_symlinks=False)
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode):
            raise ValueError("source is not a regular file")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        after = os.fstat(descriptor)
    finally:
        os.close(descriptor)
    identity_before = (before.st_dev, before.st_ino, before.st_size)
    identity_opened = (opened.st_dev, opened.st_ino, opened.st_size)
    identity_after = (after.st_dev, after.st_ino, after.st_size)
    if identity_before != identity_opened or identity_opened != identity_after:
        raise ValueError("source changed while reading")
    if os.path.normcase(str(path.resolve(strict=True))) != os.path.normcase(str(expected_real)):
        raise ValueError("source path changed while reading")
    return b"".join(chunks)


def ensure_output_root() -> None:
    current = ROOT
    for part in OUTPUT_ROOT.relative_to(ROOT).parts:
        current = current / part
        if current.exists():
            if is_reparse(current) or not current.is_dir():
                raise ValueError("dry-run root contains an unsafe component")
        else:
            current.mkdir()


def validate_runtime_manifest() -> list[str]:
    raw = safe_read(RUNTIME_MANIFEST, ROOT)
    runtime = json.loads(raw.decode("utf-8"), parse_constant=reject_constant)
    if not isinstance(runtime, dict) or set(runtime) != {"schemaVersion", "purpose", "files", "forbiddenPrefixes"}:
        raise ValueError("runtime manifest fields changed")
    if runtime["schemaVersion"] != 1 or runtime["purpose"] != RUNTIME_PURPOSE:
        raise ValueError("runtime manifest identity changed")
    probe = (
        "const fs=require('node:fs'),v=require(process.argv[1]);"
        "const m=JSON.parse(fs.readFileSync(0,'utf8'));"
        "const r=v.validateManifest(m);process.stdout.write(JSON.stringify(r.files.map(x=>x.value)));"
    )
    result = subprocess.run(
        ["node", "-e", probe, str(RELEASE_VALIDATOR)], input=raw, capture_output=True, check=False,
    )
    if result.returncode != 0:
        raise ValueError("runtime manifest validation failed")
    files = json.loads(result.stdout.decode("utf-8"), parse_constant=reject_constant)
    if not isinstance(files, list) or len(files) != len(runtime["files"]) or set(files) != set(runtime["files"]):
        raise ValueError("runtime manifest normalization changed")
    return files


def load_contract() -> dict[str, object]:
    contract = load_json(CONTRACT, ROOT)
    fields = {"schemaVersion", "kind", "candidateManifestSha256", "productionPolicySha256", "formalManifestSha256", "runtimeManifestSha256", "runtimeFileSha256", "approvedExerciseIds", "expectedDryRun", "gates", "forbiddenChanges"}
    if not isinstance(contract, dict) or set(contract) != fields:
        raise ValueError("contract fields changed")
    if contract["schemaVersion"] != 1 or contract["kind"] != "internal-media-integration-dry-run":
        raise ValueError("contract identity changed")
    if contract["approvedExerciseIds"] != EXPECTED_IDS or contract["expectedDryRun"] != {"released": 10, "blocked": 15, "formalReleaseEligible": 0}:
        raise ValueError("dry-run identities changed")
    if contract["gates"] != {"motion": "approved-for-internal-candidate", "visual": "approved-for-internal-preview", "safety": "approved-for-internal-candidate", "rights": "deferred-by-user-for-internal-stage", "participantRelease": "blocked"}:
        raise ValueError("review gates changed")
    if contract["forbiddenChanges"] != ["src/data/exercise-media-policy.js", "assets/exercises/manifest.json", "release/runtime-manifest.json"]:
        raise ValueError("protected scope changed")
    for key in ("candidateManifestSha256", *PROTECTED):
        if not isinstance(contract[key], str) or not HEX64.fullmatch(contract[key]):
            raise ValueError("contract digest is invalid")
    for key, path in PROTECTED.items():
        if sha256_bytes(safe_read(path, ROOT)) != contract[key]:
            raise ValueError("protected production input changed")
    files = validate_runtime_manifest()
    hashes = contract["runtimeFileSha256"]
    if not isinstance(hashes, dict) or set(hashes) != set(files) or any(not isinstance(value, str) or not HEX64.fullmatch(value) for value in hashes.values()):
        raise ValueError("runtime digest inventory changed")
    for relative in files:
        source = ROOT.joinpath(*relative.split("/"))
        if sha256_bytes(safe_read(source, ROOT)) != hashes[relative]:
            raise ValueError("runtime source changed")
    return contract


def load_candidates(contract: dict[str, object]) -> list[dict[str, object]]:
    manifest_path = CANDIDATES / "candidate-manifest.json"
    raw = safe_read(manifest_path, ROOT)
    if sha256_bytes(raw) != contract["candidateManifestSha256"]:
        raise ValueError("candidate manifest changed")
    manifest = json.loads(raw.decode("utf-8"), parse_constant=reject_constant)
    if not isinstance(manifest, dict) or set(manifest) != EXPECTED_TOP:
        raise ValueError("candidate manifest fields changed")
    if manifest["schemaVersion"] != 1 or manifest["kind"] != "internal-integration-candidate-package" or manifest["candidateCount"] != 10 or manifest["releaseEligible"] is not False or manifest["formalManifestModified"] is not False:
        raise ValueError("candidate manifest identity changed")
    if not isinstance(manifest["sourceMappingSha256"], str) or not HEX64.fullmatch(manifest["sourceMappingSha256"]):
        raise ValueError("candidate source digest invalid")
    assets = manifest["assets"]
    if not isinstance(assets, list) or len(assets) != 10:
        raise ValueError("candidate asset count changed")
    seen_ids: set[str] = set(); seen_files: set[str] = set(); seen_sources: set[str] = set()
    for item, expected_id in zip(assets, EXPECTED_IDS):
        if not isinstance(item, dict) or set(item) != EXPECTED_ASSET or item["exerciseId"] != expected_id:
            raise ValueError("candidate asset identity changed")
        filename = item["filename"]
        if not isinstance(filename, str) or filename != f"{expected_id}.gif" or not SAFE_ID.fullmatch(expected_id):
            raise ValueError("candidate filename invalid")
        if not isinstance(item["exerciseDbId"], str) or not re.fullmatch(r"[A-Za-z0-9]{7}", item["exerciseDbId"]):
            raise ValueError("candidate source identity invalid")
        if not isinstance(item["nameZh"], str) or not item["nameZh"].strip() or not isinstance(item["sha256"], str) or not HEX64.fullmatch(item["sha256"]):
            raise ValueError("candidate evidence invalid")
        integers = (item["bytes"], item["width"], item["height"], item["frameCount"], item["durationMs"])
        if any(type(value) is not int or value <= 0 for value in integers) or integers[1:] != (180, 180, 12, 3000):
            raise ValueError("candidate technical evidence invalid")
        if item["motionReview"] != "approved-for-internal-candidate" or item["visualReview"] != "approved-for-internal-preview" or item["safetyReview"] != "approved-for-internal-candidate" or item["releaseEligible"] is not False:
            raise ValueError("candidate review gate changed")
        if expected_id in seen_ids or filename in seen_files or item["exerciseDbId"] in seen_sources:
            raise ValueError("candidate identity is duplicated")
        seen_ids.add(expected_id); seen_files.add(filename); seen_sources.add(item["exerciseDbId"])
        source = CANDIDATES / "gifs" / filename
        contents = safe_read(source, ROOT)
        if sha256_bytes(contents) != item["sha256"] or len(contents) != item["bytes"]:
            raise ValueError("candidate media changed")
    return assets


def policy_bytes(records: list[dict[str, object]]) -> bytes:
    mapping = {item["exerciseId"]: f"assets/exercises/{item['filename']}" for item in records}
    payload = json.dumps(mapping, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return f"""(function(root,factory){{
const isCommonJS=typeof module==='object'&&module.exports;
const Move28=isCommonJS?require('../namespace.js'):(root.Move28=root.Move28||{{}});
const api=factory();if(isCommonJS)module.exports=api;else{{Move28.data=Move28.data||{{}};Move28.data.exerciseMediaPolicy=api}}
}})(globalThis,function(){{'use strict';
const MEDIA=Object.freeze({payload});const IDS=Object.freeze(Object.keys(MEDIA));const own=Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const BLOCKED=Object.freeze({{status:'blocked',title:'动作媒体审核中',message:'请仅按已复核的文字步骤和安全提示执行。'}});
function isReleaseEligible(id){{return typeof id==='string'&&own(MEDIA,id)}}
function presentationFor(id){{return isReleaseEligible(id)?Object.freeze({{status:'released',title:'动作示范',message:'',src:MEDIA[id]}}):BLOCKED}}
return Object.freeze({{mode:'integration_dry_run',releaseEligibleIds:IDS,isReleaseEligible,presentationFor}});
}});\n""".encode("utf-8")


def expected_output_hashes(contract: dict[str, object], assets: list[dict[str, object]]) -> dict[str, str]:
    hashes = dict(contract["runtimeFileSha256"])
    hashes["src/data/exercise-media-policy.js"] = sha256_bytes(policy_bytes(assets))
    hashes.update({f"assets/exercises/{item['filename']}": item["sha256"] for item in assets})
    return hashes


def assert_safe_output(output: Path) -> Path:
    target = output.absolute()
    assert_plain_chain(target, ROOT, leaf_file=False)
    resolved_root = OUTPUT_ROOT.resolve()
    resolved = target.resolve()
    if resolved == resolved_root or resolved_root not in resolved.parents:
        raise ValueError("output must be a strict child of the dry-run root")
    return target


def build_staging(staging: Path) -> None:
    contract = load_contract(); assets = load_candidates(contract); files = validate_runtime_manifest()
    app = staging / "app"
    for relative in files:
        source = ROOT.joinpath(*relative.split("/")); target = app.joinpath(*relative.split("/"))
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(safe_read(source, ROOT))
    target_media = app / "assets/exercises"; target_media.mkdir(parents=True)
    for item in assets:
        (target_media / item["filename"]).write_bytes(safe_read(CANDIDATES / "gifs" / item["filename"], ROOT))
    (app / "src/data/exercise-media-policy.js").write_bytes(policy_bytes(assets))
    report = {"schemaVersion": 1, "kind": "internal-media-integration-dry-run-result", "contractSha256": sha256_bytes(safe_read(CONTRACT, ROOT)), "candidateManifestSha256": contract["candidateManifestSha256"], "released": 10, "blocked": 15, "formalReleaseEligible": 0, "participantRelease": "blocked", "appRelativePath": "app/index.html"}
    (staging / "dry-run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def verify_output(output: Path) -> dict[str, object]:
    output = assert_safe_output(output); contract = load_contract(); assets = load_candidates(contract); app = output / "app"
    report = load_json(output / "dry-run-report.json", output)
    expected_report = {"schemaVersion": 1, "kind": "internal-media-integration-dry-run-result", "contractSha256": sha256_bytes(safe_read(CONTRACT, ROOT)), "candidateManifestSha256": contract["candidateManifestSha256"], "released": 10, "blocked": 15, "formalReleaseEligible": 0, "participantRelease": "blocked", "appRelativePath": "app/index.html"}
    if report != expected_report:
        raise ValueError("dry-run report changed")
    expected = expected_output_hashes(contract, assets)
    actual = {path.relative_to(app).as_posix(): path for path in app.rglob("*") if path.is_file()}
    if set(actual) != set(expected):
        raise ValueError("dry-run runtime closure changed")
    for relative, digest in expected.items():
        if sha256_bytes(safe_read(actual[relative], app)) != digest:
            raise ValueError("dry-run output content changed")
    return {"ok": True, "released": 10, "blocked": 15, "participantRelease": "blocked", "output": str(output)}


def install(output: Path) -> None:
    ensure_output_root(); output = assert_safe_output(output)
    staging = Path(tempfile.mkdtemp(prefix=f".{output.name}.", suffix=".tmp", dir=OUTPUT_ROOT)); backup: Path | None = None; installed = False
    try:
        build_staging(staging); verify_output(staging)
        if output.exists():
            backup = Path(tempfile.mkdtemp(prefix=f".{output.name}.", suffix=".bak", dir=OUTPUT_ROOT)); backup.rmdir(); output.replace(backup)
        staging.replace(output); installed = True; verify_output(output)
        if backup: shutil.rmtree(backup); backup = None
    except Exception:
        if installed and output.exists(): shutil.rmtree(output)
        if backup and backup.exists(): backup.replace(output); backup = None
        raise
    finally:
        if staging.exists(): shutil.rmtree(staging)


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT); parser.add_argument("--verify", action="store_true"); args = parser.parse_args()
    try:
        output = args.output.absolute(); result = verify_output(output) if args.verify else (install(output) or verify_output(output)); print(json.dumps(result, ensure_ascii=False, allow_nan=False)); return 0
    except Exception:
        print(json.dumps({"ok": False, "error": "integration_dry_run_failed"}, ensure_ascii=False)); return 1


if __name__ == "__main__":
    raise SystemExit(main())
