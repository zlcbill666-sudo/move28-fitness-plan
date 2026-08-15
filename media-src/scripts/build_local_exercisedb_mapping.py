#!/usr/bin/env python
"""Build the current MOVE28 release media evidence mapping."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LIBRARY = Path(r"E:\个人用\健身\健身动作动画\bootstrapping-lab-exercisedb-api")
CATALOG = ROOT / "src/data/exercise-catalog.js"
MANIFEST = ROOT / "assets/exercises/manifest.json"
REPORT = ROOT / "docs/research/data/move28-local-exercisedb-mapping.json"
CONTACT = ROOT / "docs/research/evidence/local-exercisedb/move28-local-candidates.jpg"
CATALOG_SHA256 = "89e2c278eb0cbb961e445b0824d095ad5cdce5ce48fbf3b776fb21150935f6fb"
MANIFEST_SHA256 = "af99f3e3d6f068b3ea9a5d7f3d92bb0eef482d5bcec670eb62bd8bdb7faf0bfd"
DATABASE_SHA256 = "a28dfeafa409fcaf737a6d27c4694d9bddc52ba69f12b37121be1e81b90b5c2d"

# Classification is a frozen manual full-loop review against the current release catalog and manifest.
# Local ExerciseDB rows are exact or explicitly approved-near matches to current catalog semantics. Project-owned rows are
# approved MOVE 28 Pillow GIFs recorded here so this report covers the full 25-item release gate.
MAPPING = [
    ("seated-leg-raise", "exact", "Hgs6Nl1", "当前目录按本地GIF坐姿抬腿执行，坐姿抬膝热身语义、支撑和幅度已对齐。"),
    ("ankle-circle", "exact", "uL9CsKm", "当前目录已改为站姿脚踝绕环，匹配本地GIF站姿交叉腿踝绕环轨迹。"),
    ("seated-leg-press", "exact", "10Z2DXU", "双脚45度腿举机，屈伸轨迹、器械和支撑匹配。"),
    ("seated-leg-curl", "exact", "Zg3XY7P", "坐姿腿弯举机，脚跟向下后方屈膝并受控返回。"),
    ("glute-bridge", "exact", "u0cNiij", "仰卧屈膝双脚支撑，抬髋至肩髋膝接近直线。"),
    ("wall-hip-hinge", "approved_near", "VtTbiP3", "用户授权将原墙触髋铰链改为动作库相近的弹力带拉髋；已替换为本地ExerciseDB band pull through 并同步为低位弹力带髋铰链口径。"),
    ("chest-press-machine", "exact", "T0yTjgW", "坐姿背贴垫，双手从胸高近水平向前推压。"),
    ("standing-band-chest-press", "approved_near", "4x5Okof", "用户授权明确将原站姿弹力带推胸改为坐姿弹力带推胸；已替换为本地ExerciseDB坐姿弹力带推胸动图并同步动作步骤。"),
    ("seated-row", "exact", "7I6LNUG", "坐姿划船机，双肘水平向后拉并受控伸臂。"),
    ("band-row", "approved_near", "km0sQC0", "按用户授权和本地图库复核结果替换为单臂站姿弹力带低位划船；与弹力带划船训练目标一致，但文案已同步为左右单臂执行。"),
    ("pallof-press", "exact", "9pa4H5m", "身体侧对胸高弹力带，双手前推且躯干保持抗旋转。"),
    ("high-seat-sit-to-stand", "exact", "Gu2rNJd", "当前目录已约束为健身房史密斯机加座椅/高凳门槛，匹配本地GIF smith chair squat。"),
    ("seated-leg-extension", "exact", "my33uHU", "坐姿腿屈伸机完成双膝伸展与返回，未见明显膝反曲。"),
    ("seated-knee-extension-unloaded", "approved_near", "Y1MsI1l", "用户授权明确将原坐姿徒手伸膝改为坐姿弹力带伸膝；已替换为本地ExerciseDB弹力带伸膝动图，视觉复核为坐姿版本。"),
    ("supported-calf-raise", "approved_near", "bJYHBIN", "按用户授权和本地图库复核结果替换为站姿自重提踵；动作本体一致，支撑要求在文案中限定为必要时扶墙或椅背。"),
    ("hip-abduction-machine", "exact", "CHpahtl", "坐姿髋外展机，双膝从并拢位置向外打开并返回。"),
    ("wall-push-up", "exact", "LEH9jxP", "双手撑墙、身体保持直线，胸靠近墙面后推回。"),
    ("dead-bug", "exact", "iny3m5y", "当前目录按本地GIF死虫式执行，对侧手脚伸展轨迹已纳入动作语义。"),
    ("heel-slide", "approved_near", "LNE3wfo", "按用户授权和本地图库复核结果替换为仰卧单腿平台滑动；与脚跟滑动目标接近，文案已同步为毛巾/滑垫/光滑地面滑动。"),
    ("bird-dog-regression", "approved_near", "h1ezqSu", "用户授权将原四点支撑单肢滑动改为动作库相近的跪姿平板肩触碰；已替换为本地ExerciseDB kneeling plank tap shoulder 并同步为核心稳定退阶口径。"),
    ("elliptical-trainer", "exact", "rjtuP6X", "直立使用椭圆机并扶内侧固定把手，步幅连续且较小。"),
    ("flat-walk", "exact", "rjiM4L3", "当前目录已改为坡度跑台慢走，匹配本地GIF walking on incline treadmill；平路为无跑台替代。"),
    ("supported-standing-march", "approved_near", "ealLwvX", "按用户授权和本地图库复核结果替换为扶墙高抬腿；与支撑踏步目标接近，文案已同步为扶墙或稳定椅背的小幅受控抬膝。"),
    ("hamstring-stretch", "exact", "99rWm7w", "当前目录按本地GIF大腿后侧拉伸执行，拉伸姿势和无痛保持提示已对齐。"),
    ("calf-stretch", "exact", "17bqEXD", "当前目录按本地GIF坐姿小腿拉伸执行，主动勾脚牵拉语义已对齐。"),
]

EXPECTED_HASHES = {
    "Hgs6Nl1": "caa505364dc6460d2706733a0bb7b74d1f2f328b31ffaf6ce0bdb138488d87b1",
    "uL9CsKm": "9db2b9ac2818fd4f5de0cbcf18a1bf067e923e6f5ba2c1aeaa8a2eb711d79758",
    "10Z2DXU": "4e4afb16a87ff94ecebf835cd56358e3ac3bbdf66f5743f211651400137ddec3",
    "Zg3XY7P": "83be1db342fcb514086eccd82b6748fe2d957caef22ce1501a9eaded5142d277",
    "u0cNiij": "0488f6ef2f876420c071a2d4243f1f1574d25bba5b5eb72246da4f130d58ad91",
    "T0yTjgW": "789515907e5001da8ced127bcf8969e7ab265f25545bf7f0a80dbb6f0da213b0",
    "7I6LNUG": "96000790878fe1238847466d0f3b81fbcaf6586e9555df38aad41727759c7cbd",
    "9pa4H5m": "043e54c19d80a808d7565e96df9369f0c7909c17ccb93eeb930b50cf15fbab9e",
    "Gu2rNJd": "524dbd970d8bbe996fa6137b0dff27b2908196e73af38d8c5b48c968f341a13d",
    "my33uHU": "ad9602e9eb0584cd73ecc5cdf9f9e273ade4d14336d1554bc35b9242dfbb6f0d",
    "CHpahtl": "f736cf937b8224e209c00d23acf002c74e6a0c94bea1bd7d321650d3a54f0cf5",
    "LEH9jxP": "8025415b2ce801699ecf32864a622883bc623ae10cd48653d4bc689b6c7147e0",
    "iny3m5y": "c3dde2bfa860d8a141861ee94259e9fafee2096c74cb0553c87a05bae9544b21",
    "rjtuP6X": "c77b3bb6811b3a6cca1ba8ccd34b1fbdceb699f1c1d70fcd35a480abb63f50b9",
    "rjiM4L3": "e57e8ade4fff7ad586f0de6dea582a776838e76069923f8bd31ad206b4d33f90",
    "99rWm7w": "536d069f05a4001b47526656e1349861be60a3f524207ff5a6b9375060f5dd30",
    "17bqEXD": "021201135a98e527c2fc0648f31f0a0887887c2d82f87f21af010d96de194799",
    "km0sQC0": "a7a39f7b5a1295714d6d9fd8fa2ea3601991e9ef7751db68ee1b12130110f459",
    "bJYHBIN": "0e5f92103f2e6578a944b22dd23d40a9867250264914aa127481ba5e4147357e",
    "LNE3wfo": "d1b952cced3a26f9793ec0dfffe968edefa00001a5f75c30380f3ed88ca89693",
    "ealLwvX": "fe96a7dfa0e5d61804b960bded9ca2d2c20a01edb94be16b97152d9ff485cf7a",
    "4x5Okof": "01b7cd33c0aa11b2fd5ed47eb16029b8d4d9fcaad218af8690ae71fb883a41a6",
    "Y1MsI1l": "8e729c35488838a6834ba8207f80b5ddd1fcf666481b2e3918f224e91f73ce76",
    "VtTbiP3": "ca37d5b276261259b68bd5069c71988d55e263a7a0a672189945ff6b0ca9ba72",
    "h1ezqSu": "ed2ca1ed7dd11fc42ecc4493f2cdd2dd5e0595f1d63861bdd8befc7bbe587d6d",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (Path(r"C:\Windows\Fonts\msyh.ttc"), Path(r"C:\Windows\Fonts\simsun.ttc")):
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def inspect_gif(source: Path) -> tuple[int, int, int, list[Image.Image]]:
    with Image.open(source) as image:
        if image.format != "GIF" or image.size != (180, 180) or image.n_frames < 2:
            raise ValueError("candidate technical properties changed")
        frames = []
        for index in (0, image.n_frames // 2, image.n_frames - 1):
            image.seek(index)
            frames.append(image.convert("RGB"))
        return image.size[0], image.size[1], image.n_frames, frames


def build(library: Path) -> tuple[dict[str, object], bytes]:
    database = library / "src/data/exercises.json"
    media = library / "media"
    if sha256(CATALOG) != CATALOG_SHA256 or sha256(MANIFEST) != MANIFEST_SHA256 or sha256(database) != DATABASE_SHA256:
        raise ValueError("frozen catalog, manifest, or local database changed")
    records = json.loads(database.read_text(encoding="utf-8"))
    by_id = {item["exerciseId"]: item for item in records}
    if len(records) != 1500 or len(by_id) != 1500:
        raise ValueError("local database must contain 1500 unique records")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = manifest.get("assets")
    if not isinstance(assets, list) or len(assets) != len(MAPPING):
        raise ValueError("formal manifest asset inventory changed")
    manifest_by_id = {item["id"]: item for item in assets}

    rows = []
    cards = []
    for exercise_id, classification, candidate_id, reason in MAPPING:
        asset = manifest_by_id.get(exercise_id)
        if not isinstance(asset, dict):
            raise ValueError("formal manifest is missing mapped exercise")
        production = asset.get("production") or {}
        reviews = asset.get("reviews") or {}
        if production.get("status") != "approved" or production.get("releaseEligible") is not True or any(reviews.get(key) != "approved" for key in ("rights", "motion", "visual", "safety")):
            raise ValueError("formal manifest release approval changed")
        replacement = asset.get("replacement") or {}
        gif = replacement.get("gif") or {}
        replacement_path = ROOT / gif.get("path", "")
        if not replacement_path.is_file() or sha256(replacement_path) != gif.get("sha256"):
            raise ValueError("formal replacement media changed")

        row: dict[str, object] = {
            "exerciseId": exercise_id,
            "classification": classification,
            "manualReviewBasis": "full-loop-frame-review-against-current-release-catalog-and-formal-manifest",
            "reason": reason,
            "releaseEligible": True,
            "formalManifest": {
                "currentPath": asset["current"]["path"],
                "replacementPath": gif["path"],
                "productionStatus": production["status"],
            },
        }
        if classification in ("exact", "approved_near"):
            if not candidate_id or candidate_id not in by_id:
                raise ValueError("local exact candidate is missing from database")
            source = media / f"{candidate_id}.gif"
            expected_hash = EXPECTED_HASHES[candidate_id]
            if sha256(source) != expected_hash or gif.get("sha256") != expected_hash:
                raise ValueError("local exact candidate identity changed")
            width, height, frame_count, frames = inspect_gif(source)
            row["candidate"] = {
                "provider": "local ExerciseDB V1 library",
                "exerciseDbId": candidate_id,
                "name": by_id[candidate_id]["name"],
                "relativePath": f"media/{candidate_id}.gif",
                "sha256": expected_hash,
                "bytes": source.stat().st_size,
                "width": width,
                "height": height,
                "frameCount": frame_count,
            }
        elif classification == "project_owned":
            if candidate_id is not None:
                raise ValueError("project-owned rows must not carry ExerciseDB IDs")
            width, height, frame_count, frames = inspect_gif(replacement_path)
            row["candidate"] = {
                "provider": "MOVE 28 Pillow",
                "exerciseDbId": None,
                "name": asset["name"],
                "relativePath": gif["path"],
                "sha256": gif["sha256"],
                "bytes": replacement_path.stat().st_size,
                "width": width,
                "height": height,
                "frameCount": frame_count,
            }
        else:
            raise ValueError("unknown mapping classification")
        rows.append(row)
        cards.append((exercise_id, classification, row["candidate"]["exerciseDbId"] or "MOVE28", frames))

    counts = {kind: sum(row["classification"] == kind for row in rows) for kind in ("exact", "approved_near", "project_owned")}
    if counts != {"exact": 17, "approved_near": 8, "project_owned": 0}:
        raise ValueError("classification counts changed")

    card_width, card_height = 600, 240
    sheet = Image.new("RGB", (card_width * 2, card_height * ((len(cards) + 1) // 2)), "white")
    title_font, label_font = font(18), font(14)
    for index, (exercise_id, classification, source_id, frames) in enumerate(cards):
        x, y = (index % 2) * card_width, (index // 2) * card_height
        draw = ImageDraw.Draw(sheet)
        draw.rectangle((x, y, x + card_width - 1, y + card_height - 1), outline="#BBBBBB")
        draw.text((x + 8, y + 7), f"{exercise_id} | {classification} | {source_id}", fill="black", font=title_font)
        for frame_index, frame in enumerate(frames):
            sheet.paste(frame, (x + 15 + frame_index * 190, y + 42))
            draw.text((x + 15 + frame_index * 190, y + 222), ("start", "middle", "end")[frame_index], fill="#333333", font=label_font)
    with tempfile.TemporaryDirectory(prefix="move28-local-map-") as temporary:
        contact_path = Path(temporary) / "contact.jpg"
        sheet.save(contact_path, quality=95, optimize=False, progressive=False)
        contact = contact_path.read_bytes()

    report = {
        "schemaVersion": 1,
        "reviewedAt": "2026-08-16",
        "source": {
            "provider": "current formal manifest plus local ExerciseDB V1 library",
            "libraryRoot": str(DEFAULT_LIBRARY),
            "databaseRelativePath": "src/data/exercises.json",
            "databaseSha256": DATABASE_SHA256,
            "recordCount": 1500,
            "exerciseCatalogSha256": CATALOG_SHA256,
            "formalManifestSha256": MANIFEST_SHA256,
        },
        "reviewMethod": {
            "semanticClassificationIsManual": True,
            "automatedChecks": ["catalog-sha256", "formal-manifest-sha256", "source-sha256", "record-identity", "gif-format", "dimensions", "frame-count", "release-gate-binding"],
            "contactSheetSha256": hashlib.sha256(contact).hexdigest(),
        },
        "counts": counts,
        "releaseEligibleCount": 25,
        "decision": "current-formal-manifest-25-item-mixed-local-exercisedb-release-evidence",
        "mapping": rows,
    }
    return report, contact


def best_effort_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def stage_bytes(path: Path, content: bytes) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(name)
    descriptor_owned = True
    try:
        stream = os.fdopen(descriptor, "wb")
        descriptor_owned = False
        with stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        return temporary
    except Exception:
        if descriptor_owned:
            try:
                os.close(descriptor)
            except OSError:
                pass
        best_effort_unlink(temporary)
        raise


def transactional_write(outputs: list[tuple[Path, bytes]]) -> None:
    if len({path.resolve() for path, _ in outputs}) != len(outputs):
        raise ValueError("transaction output paths must be unique")
    staged: list[tuple[Path, Path]] = []
    backups: list[tuple[Path, Path]] = []
    installed: list[Path] = []
    preserved: set[Path] = set()
    try:
        for path, content in outputs:
            if path.exists() and not (path.is_file() or path.is_symlink()):
                raise ValueError("transaction output target must be a file")
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--library", type=Path, default=DEFAULT_LIBRARY)
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--contact", type=Path, default=CONTACT)
    args = parser.parse_args()
    outputs_are_safe_to_clean = False
    try:
        protected = [CATALOG.resolve(), MANIFEST.resolve(), (args.library / "src/data/exercises.json").resolve(), (args.library / "media").resolve()]
        outputs = {args.report.resolve(), args.contact.resolve()}
        if len(outputs) != 2 or any(output == item or output in item.parents or item in output.parents for output in outputs for item in protected):
            raise ValueError("input and output paths must be distinct")
        outputs_are_safe_to_clean = True
        report, contact = build(args.library)
        payload = (json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
        transactional_write([(args.report, payload), (args.contact, contact)])
        print(json.dumps({"ok": True, "report": str(args.report), "contact": str(args.contact), "releaseEligibleCount": report["releaseEligibleCount"]}, ensure_ascii=False))
        return 0
    except Exception:
        if outputs_are_safe_to_clean:
            best_effort_unlink(args.report)
            best_effort_unlink(args.contact)
        print(json.dumps({"ok": False, "error": "mapping_failed"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
