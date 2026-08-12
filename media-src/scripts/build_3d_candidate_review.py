#!/usr/bin/env python
"""Build a fail-closed local review page for the Move28 3D matrix."""
from __future__ import annotations

import hashlib
import html
import json
import os
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs" / "research" / "data" / "move28-3d-candidate-matrix.json"
CATALOG = ROOT / "assets" / "exercises" / "manifest.json"
COMP_ROOT = ROOT / "media-build" / "source-research" / "gymvisual-prepurchase-previews"
OUT = ROOT / "media-build" / "source-research" / "move28-3d-candidate-review.html"
ALLOWED_STATUSES = {"purchase-exact-candidate", "purchase-edit-candidate", "custom-3d", "unresolved"}
EXPECTED_STATUS_BY_ID = {
    "seated-leg-raise": "unresolved",
    "ankle-circle": "unresolved",
    "seated-leg-press": "purchase-exact-candidate",
    "seated-leg-curl": "purchase-exact-candidate",
    "glute-bridge": "purchase-exact-candidate",
    "wall-hip-hinge": "custom-3d",
    "chest-press-machine": "purchase-exact-candidate",
    "standing-band-chest-press": "purchase-exact-candidate",
    "seated-row": "purchase-exact-candidate",
    "band-row": "purchase-exact-candidate",
    "pallof-press": "purchase-exact-candidate",
    "high-seat-sit-to-stand": "purchase-edit-candidate",
    "seated-leg-extension": "purchase-exact-candidate",
    "seated-knee-extension-unloaded": "purchase-edit-candidate",
    "supported-calf-raise": "purchase-edit-candidate",
    "hip-abduction-machine": "purchase-exact-candidate",
    "wall-push-up": "purchase-exact-candidate",
    "dead-bug": "unresolved",
    "heel-slide": "purchase-exact-candidate",
    "bird-dog-regression": "custom-3d",
    "elliptical-trainer": "purchase-exact-candidate",
    "flat-walk": "purchase-exact-candidate",
    "supported-standing-march": "custom-3d",
    "hamstring-stretch": "purchase-exact-candidate",
    "calf-stretch": "unresolved",
}
EXPECTED_PRODUCT_URL_BY_ID = {
    'seated-leg-raise': 'https://gymvisual.com/animated-gifs/2181-seated-leg-raise.html',
    'ankle-circle': 'https://gymvisual.com/animated-gifs/3138-ankle-circles.html',
    'seated-leg-press': 'https://gymvisual.com/animated-gifs/3210-sled-45o-leg-press-side-pov.html',
    'seated-leg-curl': 'https://gymvisual.com/animated-gifs/2096-lever-seated-leg-curl.html',
    'glute-bridge': 'https://gymvisual.com/animated-gifs/6570-low-glute-bridge-on-floor.html',
    'wall-hip-hinge': 'https://gymvisual.com/animated-gifs/12826-pvc-hip-hinge.html',
    'chest-press-machine': 'https://gymvisual.com/animated-gifs/2073-lever-chest-press-plate-loaded.html',
    'standing-band-chest-press': 'https://gymvisual.com/animated-gifs/8958-band-standing-chest-press-male.html',
    'seated-row': 'https://gymvisual.com/animated-gifs/3120-lever-seated-row.html',
    'band-row': 'https://gymvisual.com/animated-gifs/2405-band-straight-back-standing-row.html',
    'pallof-press': 'https://gymvisual.com/animated-gifs/2451-band-horizontal-pallof-press.html',
    'high-seat-sit-to-stand': 'https://gymvisual.com/animated-gifs/16441-bodyweight-bench-squat-female.html',
    'seated-leg-extension': 'https://gymvisual.com/animated-gifs/2082-lever-leg-extension.html',
    'seated-knee-extension-unloaded': 'https://gymvisual.com/animated-gifs/24630-seated-alternate-knee-extension-on-chair-male.html',
    'supported-calf-raise': 'https://gymvisual.com/animated-gifs/6587-standing-calf-raise-with-support-female.html',
    'hip-abduction-machine': 'https://gymvisual.com/animated-gifs/2094-lever-seated-hip-abduction.html',
    'wall-push-up': 'https://gymvisual.com/animated-gifs/2152-push-up-wall.html',
    'dead-bug': 'https://gymvisual.com/animated-gifs/1769-dead-bug.html',
    'heel-slide': 'https://gymvisual.com/animated-gifs/25143-lying-supine-heel-slide-male.html',
    'bird-dog-regression': 'https://gymvisual.com/animated-gifs/13987-sliding-leg-bird-dog.html',
    'elliptical-trainer': 'https://gymvisual.com/animated-gifs/4187-walk-elliptical-cross-trainer.html',
    'flat-walk': 'https://gymvisual.com/animated-gifs/4766-walking-on-treadmill.html',
    'supported-standing-march': 'https://gymvisual.com/animated-gifs/15232-marching-on-spot-female.html',
    'hamstring-stretch': 'https://gymvisual.com/animated-gifs/3374-hamstring-stretch.html',
    'calf-stretch': 'https://gymvisual.com/animated-gifs/3160-seated-calf-stretch-male.html',
}

EXPECTED_EVIDENCE_IDENTITY_BY_ID = {
    'seated-leg-raise': ('local-reference-current', 'https://static.exercisedb.dev/media/Hgs6Nl1.gif'),
    'ankle-circle': ('local-reference-current', 'https://static.exercisedb.dev/media/uL9CsKm.gif'),
    'seated-leg-press': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/6/6/9/8/6698.gif'),
    'seated-leg-curl': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/1/0/4/8/2/10482.gif'),
    'glute-bridge': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/1/2/4/4/4/12444.gif'),
    'wall-hip-hinge': ('local-reference-current', 'project-local:assets/gifs/20_墙触髋铰链.gif'),
    'chest-press-machine': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/5/3/1/3/5313.gif'),
    'standing-band-chest-press': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/1/6/9/8/3/16983.gif'),
    'seated-row': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/6/6/1/4/6614.gif'),
    'band-row': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/5/6/4/6/5646.gif'),
    'pallof-press': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/5/6/9/2/5692.gif'),
    'high-seat-sit-to-stand': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/2/9/0/0/3/29003.gif'),
    'seated-leg-extension': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/5/3/2/2/5322.gif'),
    'seated-knee-extension-unloaded': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/4/2/1/1/4/42114.gif'),
    'supported-calf-raise': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/1/2/4/9/8/12498.gif'),
    'hip-abduction-machine': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/1/2/7/1/4/12714.gif'),
    'wall-push-up': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/3/7/5/5/1/37551.gif'),
    'dead-bug': ('local-reference-current', 'https://static.exercisedb.dev/media/iny3m5y.gif'),
    'heel-slide': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/4/2/7/9/7/42797.gif'),
    'bird-dog-regression': ('local-reference-current', 'project-local:assets/gifs/26_四点支撑单肢滑动.gif'),
    'elliptical-trainer': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/8/7/6/2/8762.gif'),
    'flat-walk': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/9/3/9/6/9396.gif'),
    'supported-standing-march': ('local-reference-current', 'project-local:assets/gifs/24_扶椅原地踏步.gif'),
    'hamstring-stretch': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/6/9/7/8/6978.gif'),
    'calf-stretch': ('local-reference-current', 'https://static.exercisedb.dev/media/17bqEXD.gif'),
}

EXPECTED_STATUS_COUNTS = {
    "purchase-exact-candidate": 15,
    "purchase-edit-candidate": 3,
    "custom-3d": 3,
    "unresolved": 4,
}
REQUIRED_FIELDS = {"id", "name", "status", "source", "url", "risk", "evidence"}
EVIDENCE_FIELDS = {"reviewedAt", "kind", "sourceUrl", "sha256", "bytes", "frames", "width", "height"}
EVIDENCE_KINDS = {"gymvisual-watermarked-comp", "local-reference-current"}


def is_canonical_gymvisual_url(value: str, path_prefix: str) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = urlparse(value)
        return (
            parsed.scheme == "https"
            and parsed.hostname in {"gymvisual.com", "www.gymvisual.com"}
            and parsed.username is None
            and parsed.password is None
            and parsed.port is None
            and parsed.query == ""
            and parsed.fragment == ""
            and parsed.path.startswith(path_prefix)
            and "//" not in parsed.path
        )
    except ValueError:
        return False


def evidence_path(asset: dict[str, object], catalog_by_id: dict[str, dict[str, object]]) -> Path:
    evidence = asset["evidence"]
    if evidence["kind"] == "local-reference-current":
        return ROOT / catalog_by_id[asset["id"]]["current"]["path"]
    filename = "flat-walk-male.gif" if asset["id"] == "flat-walk" else f"{asset['id']}.gif"
    return COMP_ROOT / filename


def verify_evidence_bytes(assets: list[dict[str, object]], catalog_by_id: dict[str, dict[str, object]]) -> None:
    for asset in assets:
        path = evidence_path(asset, catalog_by_id)
        payload = path.read_bytes()
        evidence = asset["evidence"]
        if len(payload) != evidence["bytes"] or hashlib.sha256(payload).hexdigest() != evidence["sha256"]:
            raise ValueError(f"asset {asset['id']} evidence bytes do not match the reviewed fingerprint")


def validate(data: object, expected_ids: list[str]) -> list[dict[str, object]]:
    if not isinstance(data, dict) or data.get("schemaVersion") != 1 or data.get("releaseEligible") is not False:
        raise ValueError("matrix header is invalid or releaseEligible is not false")
    assets = data.get("assets")
    if not isinstance(assets, list) or len(assets) != len(expected_ids):
        raise ValueError("matrix asset count does not match the release catalog")
    ids: list[str] = []
    for index, asset in enumerate(assets):
        if not isinstance(asset, dict) or set(asset) != REQUIRED_FIELDS:
            raise ValueError(f"asset {index} has invalid fields")
        string_fields = REQUIRED_FIELDS - {"evidence"}
        if any(not isinstance(asset[key], str) or not asset[key].strip() for key in string_fields):
            raise ValueError(f"asset {index} contains an invalid string")
        if asset["status"] not in ALLOWED_STATUSES:
            raise ValueError(f"asset {asset['id']} has an invalid status")
        evidence = asset["evidence"]
        if not isinstance(evidence, dict) or set(evidence) != EVIDENCE_FIELDS:
            raise ValueError(f"asset {asset['id']} has invalid evidence fields")
        expected_evidence_identity = EXPECTED_EVIDENCE_IDENTITY_BY_ID.get(asset["id"])
        if (evidence.get("kind"), evidence.get("sourceUrl")) != expected_evidence_identity:
            raise ValueError(f"asset {asset['id']} evidence identity has drifted from the reviewed baseline")
        if evidence.get("kind") not in EVIDENCE_KINDS or evidence.get("reviewedAt") != "2026-08-12":
            raise ValueError(f"asset {asset['id']} has invalid evidence identity")
        if not isinstance(evidence.get("sha256"), str) or len(evidence["sha256"]) != 64 or any(c not in "0123456789abcdef" for c in evidence["sha256"]):
            raise ValueError(f"asset {asset['id']} has an invalid evidence hash")
        if any(not isinstance(evidence.get(key), int) or isinstance(evidence.get(key), bool) or evidence[key] <= 0 for key in ("bytes", "frames", "width", "height")):
            raise ValueError(f"asset {asset['id']} has invalid evidence media metadata")
        source_url = evidence.get("sourceUrl", "")
        if evidence["kind"] == "gymvisual-watermarked-comp":
            if not is_canonical_gymvisual_url(source_url, "/img/p/") or not source_url.endswith(".gif"):
                raise ValueError(f"asset {asset['id']} has an invalid GymVisual evidence source URL")
        elif not isinstance(source_url, str) or not (source_url.startswith("https://static.exercisedb.dev/media/") or source_url.startswith("project-local:assets/gifs/")):
            raise ValueError(f"asset {asset['id']} has an invalid local-reference source identity")
        if asset["url"] != EXPECTED_PRODUCT_URL_BY_ID.get(asset["id"]):
            raise ValueError(f"asset {asset['id']} product URL has drifted from the reviewed baseline")
        if not is_canonical_gymvisual_url(asset["url"], "/animated-gifs/") or not asset["url"].endswith(".html"):
            raise ValueError(f"asset {asset['id']} has a noncanonical GymVisual product URL")
        ids.append(asset["id"])
    if len(ids) != len(set(ids)) or ids != expected_ids:
        raise ValueError("matrix IDs are duplicate, missing, extra, or out of catalog order")
    actual_status_by_id = {asset["id"]: asset["status"] for asset in assets}
    if actual_status_by_id != EXPECTED_STATUS_BY_ID:
        raise ValueError("matrix per-exercise statuses have drifted from the reviewed baseline")
    if Counter(asset["status"] for asset in assets) != Counter(EXPECTED_STATUS_COUNTS):
        raise ValueError("matrix status counts have drifted from the reviewed baseline")
    return assets


def render(assets: list[dict[str, object]], matrix_hash: str) -> str:
    counts = Counter(asset["status"] for asset in assets)
    rows = []
    for index, asset in enumerate(assets, 1):
        escaped = {key: html.escape(asset[key], quote=True) for key in REQUIRED_FIELDS - {"evidence"}}
        evidence = asset["evidence"]
        evidence_summary = html.escape(f"{evidence['kind']} · {evidence['sha256'][:12]}… · {evidence['frames']} frames", quote=True)
        rows.append(f'''<tr><td>{index:02d}</td><td><b>{escaped['name']}</b><br><code>{escaped['id']}</code></td><td><span class="{escaped['status']}">{escaped['status']}</span></td><td>{escaped['source']}<br><a target="_blank" rel="noreferrer" href="{escaped['url']}">查看公开候选页</a><br><small>{evidence_summary}</small></td><td>{escaped['risk']}</td><td><select data-id="{escaped['id']}"><option value="pending">未审核</option><option value="accept-source">认可该来源方向</option><option value="custom-3d">改为自制3D</option><option value="reject">拒绝候选</option></select><textarea rows="2" placeholder="人工备注"></textarea></td></tr>''')
    return f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Move28 3D候选审核</title><style>body{{font:14px system-ui;margin:20px;background:#111;color:#eee}}table{{border-collapse:collapse;width:100%;min-width:1100px}}th,td{{border:1px solid #555;padding:9px;vertical-align:top}}th{{position:sticky;top:0;background:#222}}a{{color:#82b7ff}}code{{color:#bbb}}span{{display:inline-block;padding:4px 7px;border-radius:5px}}.purchase-exact-candidate{{background:#17683c}}.purchase-edit-candidate{{background:#8a6414}}.custom-3d{{background:#7a2626}}.unresolved{{background:#555}}select,textarea{{box-sizing:border-box;width:100%;margin-bottom:6px;background:#292929;color:#fff;border:1px solid #666;padding:6px}}button{{padding:9px;margin:8px}}.note{{background:#222;padding:12px;border-left:4px solid #c33}}</style><h1>Move28 25项3D候选审核</h1><div class="note">仅供内部选型。当前阶段按用户决策暂时忽略版权与授权；“认可来源方向”只表示动作候选进入后续视觉、技术和安全审核，不等于正式发布批准。未解决项目禁止采用当前商品。</div><p>精确采购候选 {counts['purchase-exact-candidate']}｜需编辑候选 {counts['purchase-edit-candidate']}｜建议自制/定制 {counts['custom-3d']}｜未解决 {counts['unresolved']}｜正式可发布 0</p><button id="save">保存本地进度</button><button id="export">导出审核JSON</button><div style="overflow:auto"><table><thead><tr><th>#</th><th>动作</th><th>建议</th><th>来源</th><th>语义风险</th><th>人工结论</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div><script>const MATRIX='{matrix_hash}',K='move28-3d-review-'+MATRIX,rows=[...document.querySelectorAll('tbody tr')];function data(){{return rows.map(r=>({{id:r.querySelector('select').dataset.id,result:r.querySelector('select').value,note:r.querySelector('textarea').value.trim()}}))}}function save(){{localStorage.setItem(K,JSON.stringify({{matrixSha256:MATRIX,assets:data()}}))}}try{{const saved=JSON.parse(localStorage.getItem(K)||'null');if(saved&&saved.matrixSha256===MATRIX)for(const x of saved.assets){{const s=document.querySelector(`select[data-id="${{x.id}}"]`);if(s){{s.value=x.result;s.nextElementSibling.value=x.note||''}}}}}}catch(e){{}}document.addEventListener('change',save);document.querySelector('#save').onclick=save;document.querySelector('#export').onclick=()=>{{save();const payload={{schemaVersion:1,scope:'internal 3D source direction review only',matrixSha256:MATRIX,assets:data()}},u=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}})),a=document.createElement('a');a.href=u;a.download='move28-3d-candidate-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}};</script>'''


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix(".html.tmp")
    temporary.unlink(missing_ok=True)
    try:
        matrix_bytes = DATA.read_bytes()
        data = json.loads(matrix_bytes)
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        expected_ids = [asset["id"] for asset in catalog["assets"]]
        catalog_by_id = {asset["id"]: asset for asset in catalog["assets"]}
        assets = validate(data, expected_ids)
        verify_evidence_bytes(assets, catalog_by_id)
        matrix_hash = hashlib.sha256(matrix_bytes).hexdigest()
        temporary.write_text(render(assets, matrix_hash), encoding="utf-8")
        os.replace(temporary, OUT)
    except Exception:
        temporary.unlink(missing_ok=True)
        OUT.unlink(missing_ok=True)
        raise
    print(json.dumps({"ok": True, "output": str(OUT), "matrixSha256": matrix_hash, "assets": len(assets)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
