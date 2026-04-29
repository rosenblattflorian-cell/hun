"""
Solar Mitte CRM — Blueprint Engine Backend Tests
Tests against the internal backend (http://localhost:8001) — all routes /api.
"""
import requests
import sys

BASE = "http://localhost:8001/api"
ADMIN = {"email": "admin@solar-mitte.de", "password": "admin123"}

results = []
def rec(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    results.append((name, ok, detail))

# -------- Auth --------
def login():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]

token = login()
H = {"Authorization": f"Bearer {token}"}
print(f"\n=== Logged in. Token len {len(token)} ===\n")

# 1) GET /api/blueprint/dxf-layers
def test_dxf_layers():
    r401 = requests.get(f"{BASE}/blueprint/dxf-layers", timeout=10)
    rec("dxf-layers 401 without token", r401.status_code == 401, f"got {r401.status_code}")

    r = requests.get(f"{BASE}/blueprint/dxf-layers", headers=H, timeout=10)
    ok = r.status_code == 200
    if ok:
        j = r.json()
        layers = j.get("layers", [])
        names = {l["name"] for l in layers}
        expected = {"K2_OUTLINE","K2_RIDGE","K2_EAVE","K2_HIP","K2_DIM","K2_OBSTACLE","K2_LABEL","K2_MODULE"}
        ok = (
            len(layers) == 8
            and expected.issubset(names)
            and j.get("k2_compatible") is True
            and j.get("units") == "meters"
            and j.get("dxf_version") == "R2018"
        )
        rec("dxf-layers content (8 K2_*, k2_compatible, R2018, meters)", ok,
            f"layers={len(layers)} names={names}")
    else:
        rec("dxf-layers 200", False, f"status={r.status_code} {r.text[:100]}")

# 2) POST /api/blueprint/dxf
def test_dxf():
    # 2i) 401 without token
    r401 = requests.post(f"{BASE}/blueprint/dxf",
                         json={"laenge":12,"breite":10,"first":10}, timeout=15)
    rec("dxf 401 without token", r401.status_code == 401, f"got {r401.status_code}")

    # 2a) Walmdach with obstacles
    body = {
        "laenge":12,"breite":10,"first":10,"walm":1.5,"neigung":35,
        "obstacles":[{"type":"chimney","x":0.4,"y":0.4,"w":0.05,"h":0.05,
                      "label":"Schornstein","relative":True}]
    }
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H, json=body, timeout=30)
    ok = r.status_code == 200 and r.headers.get("content-type","").startswith("application/dxf")
    body_bytes = r.content if ok else b""
    txt = body_bytes.decode("utf-8", errors="ignore")
    ok = ok and len(body_bytes) > 5000 and "K2_OUTLINE" in txt and "K2_OBSTACLE" in txt
    rec("dxf walmdach with chimney (>5KB, has K2_OUTLINE & K2_OBSTACLE)", ok,
        f"status={r.status_code} size={len(body_bytes)}")

    # 2b) Satteldach (walm=0, first=laenge)
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                      json={"laenge":12,"breite":10,"first":12,"walm":0}, timeout=30)
    rec("dxf satteldach (walm=0,first=laenge)", r.status_code == 200,
        f"status={r.status_code} size={len(r.content)}")

    # 2c) Pultdach (walm=0, first=laenge*0.5)
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                      json={"laenge":12,"breite":10,"first":6,"walm":0}, timeout=30)
    rec("dxf pultdach (walm=0,first=laenge*0.5)", r.status_code == 200,
        f"status={r.status_code} size={len(r.content)}")

    # 2d) 0 obstacles
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                      json={"laenge":12,"breite":10,"first":10,"walm":1}, timeout=30)
    rec("dxf with 0 obstacles", r.status_code == 200, f"status={r.status_code}")

    # 2e) 5 relative obstacles
    obs5 = [{"type":"chimney","x":0.1+i*0.15,"y":0.2,"w":0.05,"h":0.05,"relative":True}
            for i in range(5)]
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                      json={"laenge":12,"breite":10,"first":10,"walm":1,"obstacles":obs5}, timeout=30)
    rec("dxf with 5 relative obstacles", r.status_code == 200, f"status={r.status_code}")

    # 2f) absolute obstacles in meters
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                      json={"laenge":12,"breite":10,"first":10,"walm":1,
                            "obstacles":[{"x":2,"y":3,"w":0.5,"h":0.5,"relative":False,"type":"chimney"}]},
                      timeout=30)
    rec("dxf absolute obstacles (relative=false)", r.status_code == 200, f"status={r.status_code}")

    # 2g) audit_id from existing roof-audit
    aud = requests.get(f"{BASE}/roof-audits", headers=H, timeout=10).json()
    if aud:
        aid = aud[0]["id"]
        r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                          json={"audit_id": aid}, timeout=30)
        rec("dxf with audit_id", r.status_code == 200,
            f"status={r.status_code} aud_id={aid[:8]} size={len(r.content)}")
    else:
        # Create one
        new_aud = requests.post(f"{BASE}/roof-audits", headers=H, json={
            "title":"Test-Aufmaß","laenge":12,"breite":10,"first":10,"walm":1.5,"neigung":35
        }, timeout=10)
        if new_aud.status_code == 200:
            aid = new_aud.json()["id"]
            r = requests.post(f"{BASE}/blueprint/dxf", headers=H,
                              json={"audit_id": aid}, timeout=30)
            rec("dxf with audit_id (created new)", r.status_code == 200,
                f"status={r.status_code} aid={aid[:8]}")
        else:
            rec("dxf with audit_id", False, f"could not create roof-audit: {new_aud.status_code}")

    # 2h) missing required fields → 400
    r = requests.post(f"{BASE}/blueprint/dxf", headers=H, json={}, timeout=10)
    rec("dxf missing fields → 400/422", r.status_code in (400, 422),
        f"status={r.status_code}")

# 3) POST /api/blueprint/pdf
def test_pdf():
    body = {"laenge":12,"breite":10,"first":10,"walm":1.5,"neigung":35,
            "obstacles":[{"type":"chimney","x":0.4,"y":0.4,"w":0.05,"h":0.05,"relative":True}]}
    r = requests.post(f"{BASE}/blueprint/pdf", headers=H, json=body, timeout=30)
    ok = r.status_code == 200 and r.headers.get("content-type","").startswith("application/pdf")
    is_pdf = r.content[:5] == b"%PDF-"
    rec("pdf walmdach (Content-Type, %PDF- magic)", ok and is_pdf,
        f"status={r.status_code} type={r.headers.get('content-type')} firstBytes={r.content[:5]}")

    r = requests.post(f"{BASE}/blueprint/pdf", headers=H,
                      json={"laenge":12,"breite":10,"first":12,"walm":0}, timeout=30)
    rec("pdf satteldach", r.status_code == 200 and r.content[:5] == b"%PDF-",
        f"status={r.status_code}")

# 4) POST /api/blueprint/obj
def test_obj():
    body = {"laenge":12,"breite":10,"first":10,"walm":1.5,"neigung":35}
    r = requests.post(f"{BASE}/blueprint/obj", headers=H, json=body, timeout=30)
    ok = r.status_code == 200
    if ok:
        j = r.json()
        keys = {"obj","mtl","filename_obj","filename_mtl"}
        ok = keys.issubset(j.keys())
        if ok:
            obj = j["obj"]
            v_count = sum(1 for line in obj.split("\n") if line.startswith("v "))
            f_count = sum(1 for line in obj.split("\n") if line.startswith("f "))
            ok = "v " in obj and "f " in obj and "usemtl SolarMitteRoof" in obj
            rec("obj walmdach (v/f/usemtl, 6 vertices, 4 faces)",
                ok and v_count == 6 and f_count == 4,
                f"v={v_count} f={f_count}")
        else:
            rec("obj keys", False, f"missing keys: {keys - set(j.keys())}")
    else:
        rec("obj 200", False, f"status={r.status_code} {r.text[:200]}")

# 5) POST /api/blueprint/png
def test_png():
    body = {"laenge":12,"breite":10,"first":10,"walm":1.5,"neigung":35,
            "obstacles":[{"type":"chimney","x":0.4,"y":0.4,"w":0.05,"h":0.05,"relative":True}]}
    r = requests.post(f"{BASE}/blueprint/png", headers=H, json=body, timeout=60)
    ok = r.status_code == 200
    is_png = r.content[:4] == b"\x89PNG"
    big = len(r.content) > 10240
    type_ok = r.headers.get("content-type","").startswith("image/png")
    rec("png (>10KB, magic \\x89PNG, type image/png)",
        ok and is_png and big and type_ok,
        f"status={r.status_code} size={len(r.content)} type={r.headers.get('content-type')}")

# 6) POST /api/blueprint/validate
def test_validate():
    # 6a) valid
    r = requests.post(f"{BASE}/blueprint/validate", headers=H,
                      json={"laenge":12,"breite":10,"first":12,"walm":0,"neigung":35}, timeout=15)
    j = r.json() if r.status_code == 200 else {}
    rec("validate a) valid → ok=true, errors=[]",
        r.status_code == 200 and j.get("ok") is True and j.get("errors") == [],
        f"ok={j.get('ok')} errs={len(j.get('errors',[]))}")

    # 6b) chimney out of bounds
    r = requests.post(f"{BASE}/blueprint/validate", headers=H,
                      json={"laenge":12,"breite":10,"first":12,
                            "obstacles":[{"type":"chimney","x":0.95,"y":0.95,"w":0.1,"h":0.1,"relative":True}]},
                      timeout=15).json()
    codes = [e.get("code") for e in r.get("errors", [])]
    rec("validate b) obstacle overflow X+Y",
        not r.get("ok") and "OBSTACLE_OVERFLOW_X" in codes and "OBSTACLE_OVERFLOW_Y" in codes,
        f"codes={codes}")

    # 6c) ridge longer than eave + pitch out of range
    r = requests.post(f"{BASE}/blueprint/validate", headers=H,
                      json={"laenge":10,"breite":10,"first":15,"neigung":120}, timeout=15).json()
    codes = [e.get("code") for e in r.get("errors", [])]
    rec("validate c) RIDGE_LONGER_THAN_EAVE + PITCH_OUT_OF_RANGE",
        not r.get("ok") and "RIDGE_LONGER_THAN_EAVE" in codes and "PITCH_OUT_OF_RANGE" in codes,
        f"codes={codes}")

    # 6d) negative walm
    r = requests.post(f"{BASE}/blueprint/validate", headers=H,
                      json={"laenge":12,"breite":10,"first":10,"walm":-1}, timeout=15).json()
    codes = [e.get("code") for e in r.get("errors", [])]
    rec("validate d) WALM_NEGATIVE",
        not r.get("ok") and "WALM_NEGATIVE" in codes, f"codes={codes}")

    # 6e) module in keepout
    r = requests.post(f"{BASE}/blueprint/validate", headers=H, json={
        "laenge":12,"breite":10,"first":12,
        "obstacles":[{"x":0.4,"y":0.4,"w":0.1,"h":0.1,"relative":True,"type":"chimney"}],
        "modules":[{"x":4.5,"y":4.5,"w_m":1.5,"h_m":1}]
    }, timeout=15).json()
    codes = [e.get("code") for e in r.get("errors", [])]
    rec("validate e) MODULE_IN_KEEPOUT",
        "MODULE_IN_KEEPOUT" in codes, f"codes={codes}")

    # 6f) overlapping obstacles
    r = requests.post(f"{BASE}/blueprint/validate", headers=H, json={
        "laenge":12,"breite":10,"first":12,
        "obstacles":[
            {"x":0.4,"y":0.4,"w":0.1,"h":0.1,"relative":True,"type":"chimney"},
            {"x":0.42,"y":0.42,"w":0.1,"h":0.1,"relative":True,"type":"chimney"},
        ]
    }, timeout=15).json()
    wcodes = [w.get("code") for w in r.get("warnings", [])]
    rec("validate f) OBSTACLE_OVERLAP warning",
        "OBSTACLE_OVERLAP" in wcodes, f"warnings={wcodes}")

# 7) GET /api/photo-audits
def test_photo_audits():
    r401 = requests.get(f"{BASE}/photo-audits", timeout=10)
    rec("photo-audits 401", r401.status_code == 401, f"got {r401.status_code}")

    r = requests.get(f"{BASE}/photo-audits", headers=H, timeout=10)
    rec("photo-audits 200 list", r.status_code == 200 and isinstance(r.json(), list),
        f"status={r.status_code} count={len(r.json()) if r.status_code==200 else '-'}")

# 8) /api/blueprint/from-photo-audit/{id}
def test_from_photo():
    r = requests.post(f"{BASE}/blueprint/from-photo-audit/FAKE-ID-123?fmt=pdf",
                      headers=H, timeout=15)
    rec("from-photo-audit fake id → 404", r.status_code == 404, f"status={r.status_code}")

    # invalid fmt path with non-existing audit returns 404 first; need a real id for 400
    audits = requests.get(f"{BASE}/photo-audits", headers=H).json()
    if audits:
        aid = audits[0]["id"]
        r = requests.post(f"{BASE}/blueprint/from-photo-audit/{aid}?fmt=invalidx",
                          headers=H, timeout=15)
        rec("from-photo-audit invalid fmt → 400/422", r.status_code in (400, 422),
            f"status={r.status_code}")
    else:
        rec("from-photo-audit invalid fmt path", "SKIP", "No photo audits exist (only 404 path tested)")

# 9) POST /api/blueprint/push-hero
def test_push_hero():
    r401 = requests.post(f"{BASE}/blueprint/push-hero",
                         json={"laenge":12,"breite":10,"first":10}, timeout=15)
    rec("push-hero 401", r401.status_code == 401, f"got {r401.status_code}")

    body = {"laenge":12,"breite":10,"first":10,"walm":0,"neigung":35}
    r = requests.post(f"{BASE}/blueprint/push-hero", headers=H, json=body, timeout=60)
    if r.status_code != 200:
        rec("push-hero 200", False, f"status={r.status_code} body={r.text[:300]}")
        return
    j = r.json()
    ok = (j.get("is_mock") is True
          and j.get("pdf_size", 0) > 0
          and j.get("dxf_size", 0) > 5000)
    rec("push-hero (is_mock=True, pdf_size>0, dxf_size>5000)", ok,
        f"is_mock={j.get('is_mock')} pdf={j.get('pdf_size')} dxf={j.get('dxf_size')}")

# Regression
def test_regression():
    r = requests.get(f"{BASE}/auth/me", headers=H, timeout=10)
    rec("regression /auth/me", r.status_code == 200, f"status={r.status_code}")
    r = requests.get(f"{BASE}/customers", headers=H, timeout=10)
    rec("regression /customers", r.status_code == 200, f"status={r.status_code}")
    r = requests.get(f"{BASE}/dashboard/stats", headers=H, timeout=15)
    rec("regression /dashboard/stats", r.status_code == 200, f"status={r.status_code}")
    r = requests.get(f"{BASE}/roof-audits", headers=H, timeout=10)
    rec("regression /roof-audits", r.status_code == 200, f"status={r.status_code}")


if __name__ == "__main__":
    print("\n--- 1) DXF LAYERS ---")
    test_dxf_layers()
    print("\n--- 2) DXF ---")
    test_dxf()
    print("\n--- 3) PDF ---")
    test_pdf()
    print("\n--- 4) OBJ ---")
    test_obj()
    print("\n--- 5) PNG ---")
    test_png()
    print("\n--- 6) VALIDATE ---")
    test_validate()
    print("\n--- 7) PHOTO-AUDITS ---")
    test_photo_audits()
    print("\n--- 8) FROM-PHOTO-AUDIT ---")
    test_from_photo()
    print("\n--- 9) PUSH-HERO ---")
    test_push_hero()
    print("\n--- REGRESSION ---")
    test_regression()

    fails = [r for r in results if r[1] is False]
    print(f"\n{'='*60}\nTOTAL: {len(results)} | PASS: {len(results)-len(fails)} | FAIL: {len(fails)}")
    if fails:
        print("\nFAILS:")
        for n, _, d in fails:
            print(f"  - {n}: {d}")
        sys.exit(1)
