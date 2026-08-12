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
FINAL4_EVIDENCE_ROOT = ROOT / "docs" / "research" / "evidence" / "move28-final4"
OUT = ROOT / "media-build" / "source-research" / "move28-3d-candidate-review.html"
ALLOWED_STATUSES = {"purchase-exact-candidate", "purchase-edit-candidate", "custom-3d", "unresolved"}
EXPECTED_STATUS_BY_ID = {
    "seated-leg-raise": "purchase-exact-candidate",
    "ankle-circle": "custom-3d",
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
    "dead-bug": "custom-3d",
    "heel-slide": "purchase-exact-candidate",
    "bird-dog-regression": "custom-3d",
    "elliptical-trainer": "purchase-exact-candidate",
    "flat-walk": "purchase-exact-candidate",
    "supported-standing-march": "custom-3d",
    "hamstring-stretch": "purchase-exact-candidate",
    "calf-stretch": "purchase-edit-candidate",
}
EXPECTED_PRODUCT_URL_BY_ID = {
    'seated-leg-raise': 'https://gymvisual.com/videos/19328-seated-marching-on-a-chair-male.html',
    'ankle-circle': 'https://gymvisual.com/animated-gifs/23889-seated-single-leg-foot-circle-male.html',
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
    'dead-bug': 'https://gymvisual.com/videos/18372-lying-alternate-toe-tap-female.html',
    'heel-slide': 'https://gymvisual.com/animated-gifs/25143-lying-supine-heel-slide-male.html',
    'bird-dog-regression': 'https://gymvisual.com/animated-gifs/13987-sliding-leg-bird-dog.html',
    'elliptical-trainer': 'https://gymvisual.com/animated-gifs/4187-walk-elliptical-cross-trainer.html',
    'flat-walk': 'https://gymvisual.com/animated-gifs/4766-walking-on-treadmill.html',
    'supported-standing-march': 'https://gymvisual.com/animated-gifs/15232-marching-on-spot-female.html',
    'hamstring-stretch': 'https://gymvisual.com/animated-gifs/3374-hamstring-stretch.html',
    'calf-stretch': 'https://gymvisual.com/videos/20530-sitting-toe-tapping-stretch-on-a-chair-female.html',
}

EXPECTED_EVIDENCE_IDENTITY_BY_ID = {
    'seated-leg-raise': ('gymvisual-watermarked-video-preview', 'https://gymvisual.com/img/vid/08000/84161201-seated-marching-on-a-chair-male-hips-view.mp4'),
    'ankle-circle': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/4/0/9/7/8/40978.gif'),
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
    'dead-bug': ('gymvisual-watermarked-video-preview', 'https://gymvisual.com/img/vid/07000/76991201-lying-alternate-toe-tap-female-thighs-view.mp4'),
    'heel-slide': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/4/2/7/9/7/42797.gif'),
    'bird-dog-regression': ('local-reference-current', 'project-local:assets/gifs/26_四点支撑单肢滑动.gif'),
    'elliptical-trainer': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/8/7/6/2/8762.gif'),
    'flat-walk': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/9/3/9/6/9396.gif'),
    'supported-standing-march': ('local-reference-current', 'project-local:assets/gifs/24_扶椅原地踏步.gif'),
    'hamstring-stretch': ('gymvisual-watermarked-comp', 'https://gymvisual.com/img/p/6/9/7/8/6978.gif'),
    'calf-stretch': ('gymvisual-watermarked-video-preview', 'https://gymvisual.com/img/vid/09000/92711201-sitting-toe-tapping-stretch-on-a-chair-female-st-view.mp4'),
}

EXPECTED_EVIDENCE_FINGERPRINT_BY_ID = {
    'seated-leg-raise': ('f735450721998ae094ebb3a236879bb70677474e306909427478c0fb91bdf64a', 687688),
    'ankle-circle': ('0512b3806a4ba4e38da205ce19fd7aa47220e82378fb854fe39c0d7c607467c7', 147085),
    'seated-leg-press': ('8e0285df1689b6b0d9a25a42c996508f2dccd198d772bc72cd0d7d6708df041a', 106073),
    'seated-leg-curl': ('427f9adc2381377b87a48256c7c470924ab5c2d2833e7838a2628e2fe840fbe5', 152555),
    'glute-bridge': ('f961b6ccb89b9200c9af0d426ad805cdc8cffd719d8feb822d8d41c7a2a68885', 99387),
    'wall-hip-hinge': ('0295ad78498e4d3ce7a1a5363230c2c661539fdaeab1418d7ba0a879dff6e23a', 74802),
    'chest-press-machine': ('7404ec756dfffb376fca555ae72d9ca0d780e6e1586a6143b494ad7d9dad041d', 110159),
    'standing-band-chest-press': ('8af7e42d92b6ac7461112454d46fb0f0b0342c37ef022e7eb4bc47b8b311fb50', 88186),
    'seated-row': ('5dc3a2cb1b1a476c33bc966e6942e66de44abdeadbf031a46a22c7330799175c', 147674),
    'band-row': ('ab3057d6932b40d4cfdfc33e708ee6928942940f4e7b810fe949a3e4ed32acf4', 76802),
    'pallof-press': ('6d221d928db3efa04442ed76e9302bba0b89c2586b31e620050eaa70735e1653', 83423),
    'high-seat-sit-to-stand': ('524b58efaa70cf156c13276d180d940906d39645fb4298035b19021e0fbf87f6', 83489),
    'seated-leg-extension': ('f28298054ae2622ec27c911bf8129d14893b3be3f0db42b1e39058172ca5fdab', 129522),
    'seated-knee-extension-unloaded': ('6589241da7ec6a8a00b373606ff042d6702199bcbbc2873400db399df93ab6ab', 211369),
    'supported-calf-raise': ('0880cf0843e5c957a38f9c3ebc1e0fa2670e4615ae71df18c017fe20096c7cfa', 103517),
    'hip-abduction-machine': ('c7ce2c1ee534c5975409b3bb2478e70e81c6940e7c992752ec28b4776a9dd5d7', 190803),
    'wall-push-up': ('55476617ace73f0d22467d2eff79acc4d0300e70fddb562a0cc0a7e26ad7d86e', 97645),
    'dead-bug': ('98c1a15e7d8c0ac16ee88f73179f056178f785470293640cf9165e10e8c4ddc2', 682574),
    'heel-slide': ('5bc148e1ac79cefb22ed1c493b40ff68a71fd0ddac519a72002a9d710bb4ec1e', 69567),
    'bird-dog-regression': ('496256aeafebeb85251491078dc21db17fe3a1b9c79e5573693a309fca9fec49', 89851),
    'elliptical-trainer': ('a63a176e8cfe231fb9047be034babe6e2559beecb59768e8b458c50cc2857a28', 131683),
    'flat-walk': ('ddb13742ad39be153289f5676ef0527272c3f270a8ac115a202ebfb60c3a333e', 228377),
    'supported-standing-march': ('4a3af28d4fbf1af4ea09ffb6115e072603417e5ccb84f3b7da799b5cddfff1ed', 93827),
    'hamstring-stretch': ('7933571d02a426fdb22affcddbfd6430c3572d4b1cd094aa8631862b50b16fc0', 98326),
    'calf-stretch': ('ca42d32791559d76e71ff50da367618667f1cb90f328605960cd4cd6b5891be7', 304310),
}

EXPECTED_STATUS_COUNTS = {
    "purchase-exact-candidate": 16,
    "purchase-edit-candidate": 4,
    "custom-3d": 5,
    "unresolved": 0,
}
REQUIRED_FIELDS = {"id", "name", "status", "source", "url", "risk", "evidence"}
EVIDENCE_FIELDS = {"reviewedAt", "kind", "sourceUrl", "sha256", "bytes", "frames", "width", "height"}
EVIDENCE_KINDS = {"gymvisual-watermarked-comp", "gymvisual-watermarked-video-preview", "local-reference-current"}
FINAL4_IDS = {"seated-leg-raise", "ankle-circle", "dead-bug", "calf-stretch"}
EVIDENCE_FILE_BY_ID = {
    "seated-leg-raise": "seated-leg-raise.mp4",
    "ankle-circle": "ankle-circle.gif",
    "dead-bug": "dead-bug.mp4",
    "calf-stretch": "calf-stretch.mp4",
}
EXPECTED_REJECTED_CANDIDATES = {
    "dead-bug": [{
        "productId": "10147",
        "title": "Wall Press Heel Tap (male)",
        "productUrl": "https://gymvisual.com/animated-gifs/10147-wall-press-heel-tap-male.html",
        "previewUrl": "https://gymvisual.com/img/p/1/8/5/7/5/18575.gif",
        "reasonCode": "wall_press_conflicts_with_arms_at_sides",
    }],
}


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
    if asset["id"] in EVIDENCE_FILE_BY_ID:
        return FINAL4_EVIDENCE_ROOT / EVIDENCE_FILE_BY_ID[asset["id"]]
    filename = "flat-walk-male.gif" if asset["id"] == "flat-walk" else f"{asset['id']}.gif"
    return COMP_ROOT / filename


def verify_evidence_bytes(assets: list[dict[str, object]], catalog_by_id: dict[str, dict[str, object]]) -> None:
    for asset in assets:
        path = evidence_path(asset, catalog_by_id)
        payload = path.read_bytes()
        evidence = asset["evidence"]
        actual = (hashlib.sha256(payload).hexdigest(), len(payload))
        matrix_fingerprint = (evidence["sha256"], evidence["bytes"])
        expected = EXPECTED_EVIDENCE_FINGERPRINT_BY_ID.get(asset["id"])
        if matrix_fingerprint != expected or actual != expected:
            raise ValueError(f"asset {asset['id']} evidence bytes do not match the reviewed fingerprint")


def validate(data: object, expected_ids: list[str]) -> list[dict[str, object]]:
    if not isinstance(data, dict) or data.get("schemaVersion") != 1 or data.get("releaseEligible") is not False:
        raise ValueError("matrix header is invalid or releaseEligible is not false")
    if data.get("rejectedCandidates") != EXPECTED_REJECTED_CANDIDATES:
        raise ValueError("matrix rejected-candidate identities have drifted from the reviewed baseline")
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
        expected_reviewed_at = "2026-08-13" if asset["id"] in FINAL4_IDS else "2026-08-12"
        if evidence.get("kind") not in EVIDENCE_KINDS or evidence.get("reviewedAt") != expected_reviewed_at:
            raise ValueError(f"asset {asset['id']} has invalid evidence identity")
        if not isinstance(evidence.get("sha256"), str) or len(evidence["sha256"]) != 64 or any(c not in "0123456789abcdef" for c in evidence["sha256"]):
            raise ValueError(f"asset {asset['id']} has an invalid evidence hash")
        if any(not isinstance(evidence.get(key), int) or isinstance(evidence.get(key), bool) or evidence[key] <= 0 for key in ("bytes", "frames", "width", "height")):
            raise ValueError(f"asset {asset['id']} has invalid evidence media metadata")
        source_url = evidence.get("sourceUrl", "")
        if evidence["kind"] == "gymvisual-watermarked-comp":
            if not is_canonical_gymvisual_url(source_url, "/img/p/") or not source_url.endswith(".gif"):
                raise ValueError(f"asset {asset['id']} has an invalid GymVisual evidence source URL")
        elif evidence["kind"] == "gymvisual-watermarked-video-preview":
            if not is_canonical_gymvisual_url(source_url, "/img/vid/") or not source_url.endswith(".mp4"):
                raise ValueError(f"asset {asset['id']} has an invalid GymVisual video evidence source URL")
        elif not isinstance(source_url, str) or not (source_url.startswith("https://static.exercisedb.dev/media/") or source_url.startswith("project-local:assets/gifs/")):
            raise ValueError(f"asset {asset['id']} has an invalid local-reference source identity")
        if asset["url"] != EXPECTED_PRODUCT_URL_BY_ID.get(asset["id"]):
            raise ValueError(f"asset {asset['id']} product URL has drifted from the reviewed baseline")
        if not (
            is_canonical_gymvisual_url(asset["url"], "/animated-gifs/")
            or is_canonical_gymvisual_url(asset["url"], "/videos/")
        ) or not asset["url"].endswith(".html"):
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
