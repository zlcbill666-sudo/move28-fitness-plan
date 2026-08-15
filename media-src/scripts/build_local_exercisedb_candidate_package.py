#!/usr/bin/env python
"""Build and verify the legacy Exact10 local ExerciseDB integration candidates."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import shutil
import stat
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LIBRARY = Path(r"E:\个人用\健身\健身动作动画\bootstrapping-lab-exercisedb-api")
MAPPING = ROOT / "docs/research/data/move28-local-exercisedb-strict-mapping-2026-08-13.json"
DEFAULT_OUTPUT = ROOT / "media-build/internal-candidates/local-exercisedb-exact10"
MAPPING_SHA256 = "729c164aeecabdbc441ccd5f0abc64df9dacf9b00d207e03b06c6bd896c8136f"
EXPECTED_EXACT = {
    "seated-leg-press": "10Z2DXU",
    "seated-leg-curl": "Zg3XY7P",
    "glute-bridge": "u0cNiij",
    "chest-press-machine": "T0yTjgW",
    "seated-row": "7I6LNUG",
    "pallof-press": "9pa4H5m",
    "seated-leg-extension": "my33uHU",
    "hip-abduction-machine": "CHpahtl",
    "wall-push-up": "LEH9jxP",
    "elliptical-trainer": "rjtuP6X",
}
DISPLAY_NAMES = {
    "seated-leg-press": "坐姿腿举",
    "seated-leg-curl": "坐姿腿弯举",
    "glute-bridge": "臀桥",
    "chest-press-machine": "推胸机",
    "seated-row": "坐姿划船",
    "pallof-press": "抗旋转推压",
    "seated-leg-extension": "坐姿腿屈伸",
    "hip-abduction-machine": "髋外展机",
    "wall-push-up": "墙壁俯卧撑",
    "elliptical-trainer": "椭圆机／交叉训练机",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
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


def assert_safe_path_chain(path: Path, trusted_root: Path | None = None) -> None:
    current = path
    while True:
        if trusted_root is not None and current == trusted_root:
            return
        if is_unsafe_path(current):
            raise ValueError("path contains a link or reparse point")
        parent = current.parent
        if parent == current:
            return
        current = parent


def load_exact_mapping() -> list[dict[str, object]]:
    if sha256(MAPPING) != MAPPING_SHA256:
        raise ValueError("frozen mapping changed")
    report = json.loads(MAPPING.read_text(encoding="utf-8"))
    exact = [item for item in report["mapping"] if item["classification"] == "exact"]
    identities = {item["exerciseId"]: item["candidate"]["exerciseDbId"] for item in exact}
    if identities != EXPECTED_EXACT or report["releaseEligibleCount"] != 0:
        raise ValueError("exact candidate scope changed")
    return exact


def inspect_gif(path: Path) -> dict[str, int]:
    with Image.open(path) as image:
        if image.format != "GIF" or image.size != (180, 180) or image.n_frames < 2:
            raise ValueError("candidate is not an approved 180x180 animated GIF")
        duration_ms = 0
        for index in range(image.n_frames):
            image.seek(index)
            duration = image.info.get("duration")
            if not isinstance(duration, int) or duration <= 0:
                raise ValueError("candidate frame duration is invalid")
            duration_ms += duration
        return {"width": 180, "height": 180, "frameCount": image.n_frames, "durationMs": duration_ms}


def manifest_bytes(records: list[dict[str, object]]) -> bytes:
    payload = {
        "schemaVersion": 1,
        "kind": "internal-integration-candidate-package",
        "sourceMappingSha256": MAPPING_SHA256,
        "candidateCount": 10,
        "releaseEligible": False,
        "formalManifestModified": False,
        "assets": records,
    }
    return (json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def preview_bytes(records: list[dict[str, object]]) -> bytes:
    cards = []
    for record in records:
        exercise_id = html.escape(str(record["exerciseId"]))
        name = html.escape(str(record["nameZh"]))
        filename = html.escape(str(record["filename"]))
        source_id = html.escape(str(record["exerciseDbId"]))
        cards.append(
            f'<article class="card" data-exercise-id="{exercise_id}">'
            f'<img src="gifs/{filename}" alt="{name}动作候选" loading="lazy">'
            f'<div><h2>{name}</h2><code>{exercise_id}</code><p>ExerciseDB {source_id}</p>'
            '<strong>内部候选 · 未开放发布</strong></div></article>'
        )
    document = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Move28 本地动作候选预览</title><style>
:root{color-scheme:light;font-family:system-ui,"Microsoft YaHei",sans-serif;background:#f5f6f8;color:#20242b}
body{margin:0;padding:24px}header{max-width:1100px;margin:0 auto 20px}h1{margin:0 0 8px;font-size:28px}header p{margin:0;color:#555}
.grid{max-width:1100px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.card{background:white;border:1px solid #d9dde3;border-radius:16px;padding:16px;display:grid;grid-template-columns:180px 1fr;gap:16px;align-items:center;box-shadow:0 4px 16px #18202b12}
.card img{width:180px;height:180px;object-fit:contain;background:white}.card h2{margin:0 0 8px;font-size:20px}.card p{color:#666}.card strong{display:block;color:#a1262d;font-size:13px}.card code{font-size:12px}
@media(max-width:640px){body{padding:14px}.card{grid-template-columns:1fr}.card img{margin:auto;width:min(100%,260px);height:auto}}
</style></head><body><header><h1>Move28 本地动作候选</h1><p>10项逐帧审核Exact候选，仅供内部产品接入预览；正式媒体仍保持关闭。</p></header><main class="grid">""" + "".join(cards) + "</main></body></html>\n"
    return document.encode("utf-8")


def build_staging(library: Path, staging: Path) -> None:
    exact = load_exact_mapping()
    gif_dir = staging / "gifs"
    gif_dir.mkdir(parents=True)
    records: list[dict[str, object]] = []
    for item in exact:
        exercise_id = str(item["exerciseId"])
        candidate = item["candidate"]
        source_id = str(candidate["exerciseDbId"])
        source = library / "media" / f"{source_id}.gif"
        assert_safe_path_chain(source, library)
        if not source.is_file() or sha256(source) != candidate["sha256"]:
            raise ValueError("candidate source missing or changed")
        technical = inspect_gif(source)
        filename = f"{exercise_id}.gif"
        target = gif_dir / filename
        shutil.copyfile(source, target)
        if sha256(target) != candidate["sha256"]:
            raise ValueError("candidate copy changed")
        records.append({
            "exerciseId": exercise_id,
            "nameZh": DISPLAY_NAMES[exercise_id],
            "exerciseDbId": source_id,
            "filename": filename,
            "sha256": candidate["sha256"],
            "bytes": target.stat().st_size,
            **technical,
            "motionReview": "approved-for-internal-candidate",
            "visualReview": "approved-for-internal-preview",
            "safetyReview": "approved-for-internal-candidate",
            "releaseEligible": False,
        })
    (staging / "candidate-manifest.json").write_bytes(manifest_bytes(records))
    (staging / "preview.html").write_bytes(preview_bytes(records))


def verify_package(package: Path) -> dict[str, object]:
    frozen = {item["exerciseId"]: item["candidate"] for item in load_exact_mapping()}
    assert_safe_path_chain(package, ROOT if package.is_relative_to(ROOT) else None)
    if not package.is_dir():
        raise ValueError("package must be a real directory")
    manifest_path = package / "candidate-manifest.json"
    preview = package / "preview.html"
    if any(is_unsafe_path(path) or not path.is_file() for path in (manifest_path, preview)):
        raise ValueError("package documents must be real files")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if set(manifest) != {"schemaVersion", "kind", "sourceMappingSha256", "candidateCount", "releaseEligible", "formalManifestModified", "assets"}:
        raise ValueError("manifest fields changed")
    if manifest["schemaVersion"] != 1 or manifest["kind"] != "internal-integration-candidate-package":
        raise ValueError("manifest contract changed")
    if manifest["sourceMappingSha256"] != MAPPING_SHA256 or manifest["candidateCount"] != 10:
        raise ValueError("manifest source or count changed")
    if manifest["releaseEligible"] is not False or manifest["formalManifestModified"] is not False:
        raise ValueError("internal package cannot authorize release")
    assets = manifest["assets"]
    if not isinstance(assets, list) or len(assets) != 10:
        raise ValueError("package must contain ten assets")
    ids = [item["exerciseId"] for item in assets]
    if ids != list(EXPECTED_EXACT) or len(ids) != len(set(ids)):
        raise ValueError("asset identity or order changed")
    expected_files = {"candidate-manifest.json", "preview.html", "gifs"}
    if {entry.name for entry in package.iterdir()} != expected_files:
        raise ValueError("unexpected package root entry")
    gif_dir = package / "gifs"
    if is_unsafe_path(gif_dir) or not gif_dir.is_dir():
        raise ValueError("gifs must be a real directory")
    filenames = {f"{exercise_id}.gif" for exercise_id in EXPECTED_EXACT}
    gif_entries = list(gif_dir.iterdir())
    if {entry.name for entry in gif_entries} != filenames or any(is_unsafe_path(entry) or not entry.is_file() for entry in gif_entries):
        raise ValueError("unexpected GIF set")
    preview_text = preview.read_text(encoding="utf-8")
    for item in assets:
        if set(item) != {"exerciseId", "nameZh", "exerciseDbId", "filename", "sha256", "bytes", "width", "height", "frameCount", "durationMs", "motionReview", "visualReview", "safetyReview", "releaseEligible"}:
            raise ValueError("asset fields changed")
        exercise_id = item["exerciseId"]
        expected = frozen[exercise_id]
        if item["exerciseDbId"] != EXPECTED_EXACT[exercise_id] or item["exerciseDbId"] != expected["exerciseDbId"] or item["filename"] != f"{exercise_id}.gif":
            raise ValueError("asset mapping changed")
        path = gif_dir / item["filename"]
        technical = inspect_gif(path)
        frozen_technical = {"width": expected["width"], "height": expected["height"], "frameCount": expected["frameCount"], "durationMs": 3000}
        if technical != frozen_technical:
            raise ValueError("asset technical contract changed")
        if item["sha256"] != expected["sha256"] or item["sha256"] != sha256(path) or item["bytes"] != expected["bytes"] or item["bytes"] != path.stat().st_size or any(item[key] != value for key, value in technical.items()):
            raise ValueError("asset evidence mismatch")
        if item["motionReview"] != "approved-for-internal-candidate" or item["visualReview"] != "approved-for-internal-preview" or item["safetyReview"] != "approved-for-internal-candidate" or item["releaseEligible"] is not False:
            raise ValueError("review gate changed")
        if f'gifs/{item["filename"]}' not in preview_text:
            raise ValueError("preview omits an asset")
    return {"ok": True, "candidateCount": 10, "releaseEligible": False, "package": str(package)}


def install_package(library: Path, output: Path) -> None:
    library = library.absolute()
    assert_safe_path_chain(library)
    media = library / "media"
    if is_unsafe_path(media) or not media.is_dir():
        raise ValueError("library media must be a real directory")
    library = library.resolve()
    output = output.absolute()
    assert_safe_path_chain(output, ROOT if output.is_relative_to(ROOT) else None)
    resolved_output = output.resolve()
    protected = [MAPPING.resolve(), Path(__file__).resolve(), (ROOT / "assets/exercises/manifest.json").resolve(), (library / "media").resolve()]
    if any(resolved_output == path or resolved_output in path.parents or path in resolved_output.parents for path in protected):
        raise ValueError("output overlaps protected input")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.is_symlink() or (output.exists() and not output.is_dir()):
        raise ValueError("output must be a real directory path")
    staging = Path(tempfile.mkdtemp(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent))
    backup: Path | None = None
    installed = False
    try:
        build_staging(library, staging)
        verify_package(staging)
        if output.exists():
            backup = Path(tempfile.mkdtemp(prefix=f".{output.name}.", suffix=".bak", dir=output.parent))
            backup.rmdir()
            output.replace(backup)
        staging.replace(output)
        installed = True
        verify_package(output)
        if backup:
            shutil.rmtree(backup)
            backup = None
    except Exception:
        if installed and output.exists():
            shutil.rmtree(output)
        if backup and backup.exists():
            backup.replace(output)
            backup = None
        raise
    finally:
        if staging.exists():
            shutil.rmtree(staging)
        if backup and backup.exists():
            # Preserve a backup when rollback itself could not complete.
            pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--library", type=Path, default=DEFAULT_LIBRARY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    try:
        if args.verify:
            result = verify_package(args.output.absolute())
        else:
            install_package(args.library.absolute(), args.output.absolute())
            result = verify_package(args.output.absolute())
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0
    except Exception:
        print(json.dumps({"ok": False, "error": "candidate_package_failed"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
