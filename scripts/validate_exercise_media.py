#!/usr/bin/env python
"""Validate MOVE 28 exercise media provenance and release readiness."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "exercises" / "manifest.json"
REQUIRED_REVIEWS = ("rights", "motion", "visual", "safety")
REQUIRED_OUTPUTS = ("gif",)
ALLOWED_RIGHTS = {"confirmed", "blocked"}
ALLOWED_PRODUCTION = {"reference_only", "replacement_required", "approved"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def asset_path(value: str) -> Path:
    path = (ROOT / value).resolve()
    try:
        path.relative_to(ROOT.resolve())
    except ValueError as exc:
        raise ValueError(f"path escapes project root: {value}") from exc
    return path


def validate_asset(item: dict[str, Any], release: bool) -> list[str]:
    errors: list[str] = []
    item_id = str(item.get("id") or "<missing-id>")
    current = item.get("current") or {}
    current_path = current.get("path")
    expected_hash = current.get("sha256")

    if not isinstance(current_path, str) or not current_path:
        errors.append(f"{item_id}: current.path missing")
    else:
        try:
            path = asset_path(current_path)
        except ValueError as exc:
            errors.append(f"{item_id}: {exc}")
        else:
            if not path.is_file():
                errors.append(f"{item_id}: current asset missing: {current_path}")
            elif not isinstance(expected_hash, str) or sha256(path) != expected_hash:
                errors.append(f"{item_id}: current SHA-256 mismatch")

    rights = item.get("rights") or {}
    production = item.get("production") or {}
    rights_status = rights.get("status")
    production_status = production.get("status")
    release_eligible = production.get("releaseEligible")

    if rights_status not in ALLOWED_RIGHTS:
        errors.append(f"{item_id}: invalid rights.status={rights_status!r}")
    if production_status not in ALLOWED_PRODUCTION:
        errors.append(f"{item_id}: invalid production.status={production_status!r}")
    if not isinstance(release_eligible, bool):
        errors.append(f"{item_id}: production.releaseEligible must be boolean")

    if release_eligible is True:
        if rights_status != "confirmed" or production_status != "approved":
            errors.append(f"{item_id}: approved release requires confirmed rights and production.status=approved")
        reviews = item.get("reviews") or {}
        for review in REQUIRED_REVIEWS:
            if reviews.get(review) != "approved":
                errors.append(f"{item_id}: review {review} is not approved")
        replacement = item.get("replacement") or {}
        source = replacement.get("source")
        if not isinstance(source, str) or not source:
            errors.append(f"{item_id}: replacement.source missing")
        else:
            try:
                source_path = asset_path(source)
                if not source_path.is_file():
                    errors.append(f"{item_id}: replacement source missing: {source}")
            except ValueError as exc:
                errors.append(f"{item_id}: {exc}")
        for output in REQUIRED_OUTPUTS:
            record = replacement.get(output)
            output_path = record.get("path") if isinstance(record, dict) else None
            if not isinstance(output_path, str) or not output_path:
                errors.append(f"{item_id}: replacement.{output}.path missing")
                continue
            try:
                path = asset_path(output_path)
            except ValueError as exc:
                errors.append(f"{item_id}: {exc}")
                continue
            if not path.is_file():
                errors.append(f"{item_id}: replacement output missing: {output_path}")
            elif record.get("sha256") != sha256(path):
                errors.append(f"{item_id}: replacement.{output} SHA-256 mismatch")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", action="store_true", help="require every release-eligible asset to have approved outputs")
    args = parser.parse_args()

    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "assets": 0, "releaseBlocked": 0, "errors": [str(exc)]}, ensure_ascii=False))
        return 1

    errors: list[str] = []
    assets = manifest.get("assets")
    if manifest.get("schemaVersion") != 1:
        errors.append("manifest.schemaVersion must equal 1")
    if not isinstance(assets, list):
        errors.append("manifest.assets must be an array")
        assets = []

    ids = [item.get("id") for item in assets if isinstance(item, dict)]
    if len(ids) != len(set(ids)):
        errors.append("manifest asset IDs must be unique")
    if len(assets) != 25:
        errors.append(f"manifest must contain 25 assets, got {len(assets)}")

    for item in assets:
        if not isinstance(item, dict):
            errors.append("manifest asset must be an object")
            continue
        errors.extend(validate_asset(item, args.release))

    release_eligible = sum(
        1 for item in assets
        if isinstance(item, dict) and (item.get("production") or {}).get("releaseEligible") is True
    )
    release_blocked = sum(
        1 for item in assets
        if isinstance(item, dict) and (item.get("production") or {}).get("releaseEligible") is not True
    )
    report = {
        "ok": not errors,
        "mode": "release" if args.release else "audit",
        "assets": len(assets),
        "releaseEligible": release_eligible,
        "releaseBlocked": release_blocked,
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
