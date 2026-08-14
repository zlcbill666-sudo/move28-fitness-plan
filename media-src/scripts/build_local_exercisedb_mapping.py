#!/usr/bin/env python
"""Build the frozen MOVE28 mapping for the user's local ExerciseDB library."""
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
REPORT = ROOT / "docs/research/data/move28-local-exercisedb-mapping.json"
CONTACT = ROOT / "docs/research/evidence/local-exercisedb/move28-local-candidates.jpg"
CATALOG_SHA256 = "27ab190da3b14df6d2fb3bb18c134123589940feaf240e8cc6d877811b75002e"
DATABASE_SHA256 = "a28dfeafa409fcaf737a6d27c4694d9bddc52ba69f12b37121be1e81b90b5c2d"

# Classification is a frozen manual full-loop review against exercise-catalog.js.
# The script verifies source identity and technical properties; it does not infer motion semantics.
MAPPING = [
    ("seated-leg-raise", "reject", "Hgs6Nl1", "后倾训练凳上双腿同时抬高，属于核心训练，不是有靠背椅上小幅交替抬膝。"),
    ("ankle-circle", "near", "uL9CsKm", "踝绕环轨迹接近，但候选为站姿交叉腿，无稳固座椅支撑。"),
    ("seated-leg-press", "exact", "10Z2DXU", "双脚45度腿举机，屈伸轨迹、器械和支撑匹配。"),
    ("seated-leg-curl", "exact", "Zg3XY7P", "坐姿腿弯举机，脚跟向下后方屈膝并受控返回。"),
    ("glute-bridge", "exact", "u0cNiij", "仰卧屈膝双脚支撑，抬髋至肩髋膝接近直线。"),
    ("wall-hip-hinge", "reject", None, "全库未发现背对墙、臀部后移轻触墙面的徒手髋铰链。"),
    ("chest-press-machine", "exact", "T0yTjgW", "坐姿背贴垫，双手从胸高近水平向前推压；替换原上斜候选DOoWcnA。"),
    ("standing-band-chest-press", "reject", "4x5Okof", "候选为坐姿弹力带推胸，不是前后分腿站姿双手推胸。"),
    ("seated-row", "exact", "7I6LNUG", "坐姿划船机，双肘水平向后拉并受控伸臂。"),
    ("band-row", "reject", "Nu7jqFE", "候选坐姿且弹力带绕脚，不是胸高固定点站姿划船。"),
    ("pallof-press", "exact", "9pa4H5m", "身体侧对胸高弹力带，双手前推且躯干保持抗旋转。"),
    ("high-seat-sit-to-stand", "reject", "b63ZzGe", "候选为扶物下蹲，臀部不接触高位稳固座面。"),
    ("seated-leg-extension", "exact", "my33uHU", "坐姿腿屈伸机完成双膝伸展与返回，未见明显膝反曲。"),
    ("seated-knee-extension-unloaded", "reject", None, "全库未发现有靠背椅上交替单侧无负重伸膝。"),
    ("supported-calf-raise", "near", "bJYHBIN", "平地双脚提踵轨迹匹配，但没有双手轻扶稳固椅背。"),
    ("hip-abduction-machine", "exact", "CHpahtl", "坐姿髋外展机，双膝从并拢位置向外打开并返回。"),
    ("wall-push-up", "exact", "LEH9jxP", "双手撑墙、身体保持直线，胸靠近墙面后推回。"),
    ("dead-bug", "reject", "iny3m5y", "候选为对侧手脚伸展，难度和轨迹不等于双臂体侧交替脚跟点地。"),
    ("heel-slide", "reject", "LNE3wfo", "候选从双腿伸直开始再屈膝，不符合双膝屈曲起始、单侧脚跟前滑合同。"),
    ("bird-dog-regression", "reject", None, "全库未发现手不离垫的四点支撑单肢贴垫滑动。"),
    ("elliptical-trainer", "exact", "rjtuP6X", "直立使用椭圆机并扶内侧固定把手，步幅连续且较小。"),
    ("flat-walk", "near", "rjiM4L3", "跑台步行轨迹匹配，但候选明确为上坡跑台，合同要求0坡度。"),
    ("supported-standing-march", "near", "ealLwvX", "交替抬膝匹配，但以墙支撑且幅度较高，不是双手扶椅小幅踏步。"),
    ("hamstring-stretch", "reject", "xGgAGPm", "候选在椅上动态抬放直腿，没有进入并保持轻柔静态牵拉。"),
    ("calf-stretch", "near", "17bqEXD", "坐地并用手拉脚，合同要求坐稳椅面且不借助外力主动勾脚。"),
]

EXPECTED_HASHES = {
    "Hgs6Nl1": "caa505364dc6460d2706733a0bb7b74d1f2f328b31ffaf6ce0bdb138488d87b1",
    "uL9CsKm": "9db2b9ac2818fd4f5de0cbcf18a1bf067e923e6f5ba2c1aeaa8a2eb711d79758",
    "10Z2DXU": "4e4afb16a87ff94ecebf835cd56358e3ac3bbdf66f5743f211651400137ddec3",
    "Zg3XY7P": "83be1db342fcb514086eccd82b6748fe2d957caef22ce1501a9eaded5142d277",
    "u0cNiij": "0488f6ef2f876420c071a2d4243f1f1574d25bba5b5eb72246da4f130d58ad91",
    "T0yTjgW": "789515907e5001da8ced127bcf8969e7ab265f25545bf7f0a80dbb6f0da213b0",
    "4x5Okof": "01b7cd33c0aa11b2fd5ed47eb16029b8d4d9fcaad218af8690ae71fb883a41a6",
    "7I6LNUG": "96000790878fe1238847466d0f3b81fbcaf6586e9555df38aad41727759c7cbd",
    "Nu7jqFE": "e7a436616c28f1c64ead3be3c9dc38e8c833bc6e3d4ef4cae1ca44369b637846",
    "9pa4H5m": "043e54c19d80a808d7565e96df9369f0c7909c17ccb93eeb930b50cf15fbab9e",
    "b63ZzGe": "d046da32f9e3cde2ba3641a2c34b005c5ac57260806bf2653589504ed4e9d830",
    "my33uHU": "ad9602e9eb0584cd73ecc5cdf9f9e273ade4d14336d1554bc35b9242dfbb6f0d",
    "bJYHBIN": "0e5f92103f2e6578a944b22dd23d40a9867250264914aa127481ba5e4147357e",
    "CHpahtl": "f736cf937b8224e209c00d23acf002c74e6a0c94bea1bd7d321650d3a54f0cf5",
    "LEH9jxP": "8025415b2ce801699ecf32864a622883bc623ae10cd48653d4bc689b6c7147e0",
    "iny3m5y": "c3dde2bfa860d8a141861ee94259e9fafee2096c74cb0553c87a05bae9544b21",
    "LNE3wfo": "d1b952cced3a26f9793ec0dfffe968edefa00001a5f75c30380f3ed88ca89693",
    "rjtuP6X": "c77b3bb6811b3a6cca1ba8ccd34b1fbdceb699f1c1d70fcd35a480abb63f50b9",
    "rjiM4L3": "e57e8ade4fff7ad586f0de6dea582a776838e76069923f8bd31ad206b4d33f90",
    "ealLwvX": "fe96a7dfa0e5d61804b960bded9ca2d2c20a01edb94be16b97152d9ff485cf7a",
    "xGgAGPm": "257310dc444d87aa419523395587eaf50c52785c21dec5b57b197f4256419045",
    "17bqEXD": "021201135a98e527c2fc0648f31f0a0887887c2d82f87f21af010d96de194799",
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


def build(library: Path) -> tuple[dict[str, object], bytes]:
    database = library / "src/data/exercises.json"
    media = library / "media"
    if sha256(CATALOG) != CATALOG_SHA256 or sha256(database) != DATABASE_SHA256:
        raise ValueError("frozen catalog or local database changed")
    records = json.loads(database.read_text(encoding="utf-8"))
    by_id = {item["exerciseId"]: item for item in records}
    if len(records) != 1500 or len(by_id) != 1500:
        raise ValueError("local database must contain 1500 unique records")

    rows = []
    cards = []
    for exercise_id, classification, candidate_id, reason in MAPPING:
        row: dict[str, object] = {
            "exerciseId": exercise_id,
            "classification": classification,
            "manualReviewBasis": "full-loop-frame-review-against-current-catalog-contract",
            "reason": reason,
            "releaseEligible": False,
        }
        if candidate_id:
            source = media / f"{candidate_id}.gif"
            if candidate_id not in by_id or sha256(source) != EXPECTED_HASHES[candidate_id]:
                raise ValueError("frozen candidate is missing or changed")
            with Image.open(source) as image:
                if image.format != "GIF" or image.size != (180, 180) or image.n_frames < 2:
                    raise ValueError("candidate technical properties changed")
                frames = []
                for index in (0, image.n_frames // 2, image.n_frames - 1):
                    image.seek(index)
                    frames.append(image.convert("RGB"))
                frame_count = image.n_frames
            row["candidate"] = {
                "exerciseDbId": candidate_id,
                "name": by_id[candidate_id]["name"],
                "relativePath": f"media/{candidate_id}.gif",
                "sha256": EXPECTED_HASHES[candidate_id],
                "bytes": source.stat().st_size,
                "width": 180,
                "height": 180,
                "frameCount": frame_count,
            }
            cards.append((exercise_id, classification, candidate_id, frames))
        else:
            row["candidate"] = None
        rows.append(row)

    counts = {kind: sum(row["classification"] == kind for row in rows) for kind in ("exact", "near", "reject")}
    if counts != {"exact": 10, "near": 5, "reject": 10}:
        raise ValueError("classification counts changed")

    card_width, card_height = 600, 240
    sheet = Image.new("RGB", (card_width * 2, card_height * ((len(cards) + 1) // 2)), "white")
    title_font, label_font = font(18), font(14)
    for index, (exercise_id, classification, candidate_id, frames) in enumerate(cards):
        x, y = (index % 2) * card_width, (index // 2) * card_height
        draw = ImageDraw.Draw(sheet)
        draw.rectangle((x, y, x + card_width - 1, y + card_height - 1), outline="#BBBBBB")
        draw.text((x + 8, y + 7), f"{exercise_id} | {classification} | {candidate_id}", fill="black", font=title_font)
        for frame_index, frame in enumerate(frames):
            sheet.paste(frame, (x + 15 + frame_index * 190, y + 42))
            draw.text((x + 15 + frame_index * 190, y + 222), ("start", "middle", "end")[frame_index], fill="#333333", font=label_font)
    with tempfile.TemporaryDirectory(prefix="move28-local-map-") as temporary:
        contact_path = Path(temporary) / "contact.jpg"
        sheet.save(contact_path, quality=95, optimize=False, progressive=False)
        contact = contact_path.read_bytes()

    report = {
        "schemaVersion": 1,
        "reviewedAt": "2026-08-13",
        "source": {
            "provider": "local ExerciseDB V1 library",
            "libraryRoot": str(DEFAULT_LIBRARY),
            "databaseRelativePath": "src/data/exercises.json",
            "databaseSha256": DATABASE_SHA256,
            "recordCount": 1500,
            "exerciseCatalogSha256": CATALOG_SHA256,
        },
        "reviewMethod": {
            "semanticClassificationIsManual": True,
            "automatedChecks": ["source-sha256", "record-identity", "gif-format", "dimensions", "frame-count"],
            "contactSheetSha256": hashlib.sha256(contact).hexdigest(),
        },
        "counts": counts,
        "releaseEligibleCount": 0,
        "decision": "use-exact-local-candidates-for-next-internal-integration-stage",
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
    analysis_complete = False
    outputs_validated = False
    try:
        candidate_inputs = {
            (args.library / "media" / f"{candidate_id}.gif").resolve()
            for _, _, candidate_id, _ in MAPPING if candidate_id
        }
        inputs = {
            (args.library / "src/data/exercises.json").resolve(),
            CATALOG.resolve(),
            *candidate_inputs,
        }
        outputs = {args.report.resolve(), args.contact.resolve()}
        if len(outputs) != 2 or inputs & outputs:
            raise ValueError("input and output paths must be distinct")
        outputs_validated = True
        report, contact = build(args.library.resolve())
        analysis_complete = True
        report_bytes = (json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
        transactional_write([(args.contact, contact), (args.report, report_bytes)])
        print(json.dumps({"ok": True, "counts": report["counts"], "releaseEligible": 0}, ensure_ascii=False))
        return 0
    except Exception:
        if outputs_validated and not analysis_complete:
            best_effort_unlink(args.report)
            best_effort_unlink(args.contact)
        print(json.dumps({"ok": False, "error": "mapping_failed"}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
