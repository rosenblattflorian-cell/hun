"""
Solar Mitte Backend — Test Suite for NEW endpoints
====================================================
Tests:
 1) Universal Roof Engine: /api/roof-engine/{compute,scaffolding,push-hero}
 2) Blueprint mit Gerüst-Linie (h_traufe optional) /api/blueprint/{pdf,dxf,png,dxf-layers}
 3) Customer Portal /api/portal/my (Erweiterung blueprint_audit_id + audits[])
 4) Modul-Stammdaten /api/admin/modules (CRUD + seed)
 5) Regression: /api/auth/login, /api/blueprint/validate, /api/dashboard/stats
"""
import os
import sys
import json
import requests

BASE = os.environ.get("BACKEND_URL", "https://solar-crm-hub-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@solar-mitte.de", "password": "admin123"}
CUSTOMER = {"email": "kunde@solar-mitte.de", "password": "kunde123"}

PASS, FAIL = [], []

def ok(name, detail=""):
    PASS.append((name, detail))
    print(f"OK   {name}  {detail}")

def fail(name, detail=""):
    FAIL.append((name, detail))
    print(f"FAIL {name}  {detail}")

def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    if r.status_code != 200:
        return None, f"login {creds['email']} -> {r.status_code} {r.text[:200]}"
    return r.json().get("access_token"), None

def H(token):
    return {"Authorization": f"Bearer {token}"}

def main():
    print(f"BASE = {BASE}")
    # -------- Auth --------
    admin_token, err = login(ADMIN)
    if err:
        fail("auth.admin.login", err); print("CRITICAL"); return 1
    ok("auth.admin.login", "200 + access_token")

    cust_token, err = login(CUSTOMER)
    if err:
        fail("auth.customer.login", err)
    else:
        ok("auth.customer.login", "200 + role=customer")

    # ============================================================
    # 1) UNIVERSAL ROOF ENGINE
    # ============================================================
    print("\n--- 1) ROOF ENGINE ---")

    body = {"alpha_deg": 35, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code != 200:
        fail("re.compute.sattel", f"HTTP {r.status_code}: {r.text[:200]}")
    else:
        d = r.json()
        g = d.get("geometry", {})
        s = d.get("scaffolding", {})
        msgs = []
        if g.get("suggested_type") != "satteldach":
            msgs.append(f"type={g.get('suggested_type')}!=satteldach")
        if not (5.20 <= g.get("sparrenlaenge_m", 0) <= 5.26):
            msgs.append(f"L={g.get('sparrenlaenge_m')}!=~5.23")
        if not (8.55 <= g.get("tiefe_horizontal_m", 0) <= 8.59):
            msgs.append(f"tiefe={g.get('tiefe_horizontal_m')}!=~8.57")
        if abs(g.get("hoehe_dach_m", 0) - 3.0) > 0.01:
            msgs.append(f"dh={g.get('hoehe_dach_m')}!=3.0")
        if not (130.0 <= g.get("flaeche_geneigt_m2", 0) <= 131.5):
            msgs.append(f"area={g.get('flaeche_geneigt_m2')}!=~130.76")
        if not s.get("hoehe_geruest_m") or not s.get("laenge_geruest_m"):
            msgs.append("scaffolding missing")
        if "hero_bom_item" not in d:
            msgs.append("hero_bom_item missing")
        if "rectified_obstacles" not in d:
            msgs.append("rectified_obstacles missing")
        if msgs:
            fail("re.compute.sattel", "; ".join(msgs))
        else:
            ok("re.compute.sattel", f"L={g['sparrenlaenge_m']} tiefe={g['tiefe_horizontal_m']} A={g['flaeche_geneigt_m2']}")

    body = {"alpha_deg": 35, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5, "walm_offset": 1.5}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 200 and r.json()["geometry"]["suggested_type"] == "walmdach":
        ok("re.compute.walm", "type=walmdach")
    else:
        fail("re.compute.walm", f"HTTP {r.status_code}")

    # Pult — sehr lang/flach
    body = {"alpha_deg": 8, "h_traufe": 3, "h_first": 4, "breite_traufe": 15}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        g = r.json()["geometry"]
        t = g["suggested_type"]
        if t == "pultdach":
            ok("re.compute.pult", "type=pultdach")
        else:
            fail("re.compute.pult", f"type={t}!=pultdach (W=15, tiefe={g['tiefe_horizontal_m']:.2f}, threshold W>4*tiefe={4*g['tiefe_horizontal_m']:.2f})")
    else:
        fail("re.compute.pult", f"HTTP {r.status_code}: {r.text[:200]}")

    # Flach
    body = {"alpha_deg": 0, "h_traufe": 3, "h_first": 3, "breite_traufe": 10}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        d = r.json()["geometry"]
        if d["suggested_type"] == "flachdach" and d["sparrenlaenge_m"] == 0:
            ok("re.compute.flach", "type=flachdach L=0")
        else:
            fail("re.compute.flach", f"type={d['suggested_type']} L={d['sparrenlaenge_m']}")
    else:
        fail("re.compute.flach", f"HTTP {r.status_code}: {r.text[:200]}")

    # alpha=89 valid
    body = {"alpha_deg": 89, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        ok("re.compute.alpha89", "validates")
    else:
        fail("re.compute.alpha89", f"HTTP {r.status_code}")

    # alpha=90 must reject
    body = {"alpha_deg": 90, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code in (400, 422):
        ok("re.compute.alpha90.reject", f"HTTP {r.status_code}")
    else:
        fail("re.compute.alpha90.reject", f"HTTP {r.status_code} expected 400/422")

    # h_first < h_traufe with alpha>1 -> 400
    body = {"alpha_deg": 35, "h_traufe": 4.5, "h_first": 3.0, "breite_traufe": 12.5}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 400:
        ok("re.compute.h_first<h_traufe.400", r.json().get("detail",""))
    else:
        fail("re.compute.h_first<h_traufe.400", f"HTTP {r.status_code}")

    # breite_traufe=0 -> 422
    body = {"alpha_deg": 35, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 0}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 422:
        ok("re.compute.breite0.422", "")
    else:
        fail("re.compute.breite0.422", f"HTTP {r.status_code}")

    # obstacles_pct -> rectified
    body = {"alpha_deg": 35, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5,
            "obstacles_pct": [{"x": 0.2, "y": 0.3, "w": 0.1, "h": 0.1, "type": "schornstein"}]}
    r = requests.post(f"{API}/roof-engine/compute", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        rect = r.json().get("rectified_obstacles", [])
        if rect and all(k in rect[0] for k in ("x_m", "y_m", "width_m", "height_m")):
            ok("re.compute.obstacles", f"{len(rect)} rectified")
        else:
            fail("re.compute.obstacles", f"rectified={rect}")
    else:
        fail("re.compute.obstacles", f"HTTP {r.status_code}")

    # 401
    r = requests.post(f"{API}/roof-engine/compute", json={"alpha_deg": 35, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5}, timeout=15)
    if r.status_code == 401:
        ok("re.compute.401", "")
    else:
        fail("re.compute.401", f"HTTP {r.status_code}")

    # scaffolding
    r = requests.post(f"{API}/roof-engine/scaffolding?h_traufe=4.5&breite_traufe=12.5", headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        d = r.json()
        msgs = []
        if abs(d.get("flaeche_m2", 0) - 75.4) > 0.1: msgs.append(f"flaeche={d.get('flaeche_m2')}!=75.4")
        if abs(d.get("hoehe_geruest_m", 0) - 5.2) > 0.05: msgs.append(f"h={d.get('hoehe_geruest_m')}!=5.2")
        if abs(d.get("laenge_geruest_m", 0) - 14.5) > 0.05: msgs.append(f"l={d.get('laenge_geruest_m')}!=14.5")
        if msgs: fail("re.scaff.values", "; ".join(msgs))
        else: ok("re.scaff.values", "75.4 5.2 14.5")
    else:
        fail("re.scaff.values", f"HTTP {r.status_code}: {r.text[:200]}")

    # scaffolding h=0 -> 400
    r = requests.post(f"{API}/roof-engine/scaffolding?h_traufe=0&breite_traufe=12.5", headers=H(admin_token), timeout=15)
    if r.status_code == 400:
        ok("re.scaff.h0.400", "")
    else:
        fail("re.scaff.h0.400", f"HTTP {r.status_code}")

    # 401
    r = requests.post(f"{API}/roof-engine/scaffolding?h_traufe=4.5&breite_traufe=12.5", timeout=15)
    if r.status_code == 401:
        ok("re.scaff.401", "")
    else:
        fail("re.scaff.401", f"HTTP {r.status_code}")

    # push-hero
    body = {"alpha_deg": 35, "h_traufe": 4.5, "h_first": 7.5, "breite_traufe": 12.5}
    r = requests.post(f"{API}/roof-engine/push-hero", json=body, headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        d = r.json()
        if d.get("is_mock") is True and d.get("type") == "roof_engine_push" and d.get("id"):
            ok("re.push-hero", f"is_mock=True id={d['id'][:8]}")
        else:
            fail("re.push-hero", f"unexpected: {json.dumps(d)[:200]}")
    else:
        fail("re.push-hero", f"HTTP {r.status_code}: {r.text[:200]}")

    r = requests.post(f"{API}/roof-engine/push-hero", json=body, timeout=15)
    if r.status_code == 401:
        ok("re.push-hero.401", "")
    else:
        fail("re.push-hero.401", f"HTTP {r.status_code}")

    # ============================================================
    # 2) BLUEPRINT mit h_traufe
    # ============================================================
    print("\n--- 2) BLUEPRINT mit h_traufe ---")

    bp_body = {"laenge": 12.5, "breite": 10, "first": 10.0, "walm": 1.5, "neigung": 38, "h_traufe": 4.5}

    r = requests.post(f"{API}/blueprint/pdf", json=bp_body, headers=H(admin_token), timeout=30)
    if r.status_code == 200 and r.content[:5] == b"%PDF-" and len(r.content) > 3 * 1024:
        ok("bp.pdf.h_traufe", f"{len(r.content)//1024} KB")
    else:
        fail("bp.pdf.h_traufe", f"HTTP {r.status_code} size={len(r.content)} magic={r.content[:5]!r}")

    r = requests.post(f"{API}/blueprint/dxf", json=bp_body, headers=H(admin_token), timeout=30)
    if r.status_code == 200 and len(r.content) > 50 * 1024 and b"K2_SCAFFOLDING" in r.content:
        ok("bp.dxf.scaffolding_layer", f"{len(r.content)//1024} KB")
    else:
        contains = b"K2_SCAFFOLDING" in r.content
        fail("bp.dxf.scaffolding_layer", f"HTTP {r.status_code} size={len(r.content)} K2_SCAFFOLDING={contains}")

    r = requests.post(f"{API}/blueprint/png", json=bp_body, headers=H(admin_token), timeout=30)
    if r.status_code == 200 and r.content[:4] == b"\x89PNG" and len(r.content) > 25 * 1024:
        ok("bp.png.h_traufe", f"{len(r.content)//1024} KB")
    else:
        fail("bp.png.h_traufe", f"HTTP {r.status_code} size={len(r.content)} magic={r.content[:4]!r}")

    bp_body2 = {"laenge": 12.5, "breite": 10, "first": 10.0, "walm": 1.5, "neigung": 38}
    r = requests.post(f"{API}/blueprint/pdf", json=bp_body2, headers=H(admin_token), timeout=30)
    if r.status_code == 200 and r.content[:5] == b"%PDF-":
        ok("bp.pdf.no_h_traufe", f"{len(r.content)//1024} KB")
    else:
        fail("bp.pdf.no_h_traufe", f"HTTP {r.status_code}")

    r = requests.get(f"{API}/blueprint/dxf-layers", headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        layers = r.json().get("layers", [])
        names = [l["name"] for l in layers]
        if len(layers) == 9 and "K2_SCAFFOLDING" in names:
            ok("bp.layers.9", f"{len(layers)} incl K2_SCAFFOLDING")
        else:
            fail("bp.layers.9", f"count={len(layers)} K2_SCAFFOLDING={'K2_SCAFFOLDING' in names} names={names}")
    else:
        fail("bp.layers.9", f"HTTP {r.status_code}")

    # ============================================================
    # 3) /portal/my
    # ============================================================
    print("\n--- 3) /api/portal/my ---")

    if cust_token:
        r = requests.get(f"{API}/portal/my", headers=H(cust_token), timeout=15)
        if r.status_code == 200:
            d = r.json()
            msgs = []
            cust = d.get("customer", {})
            if "Schmidt" not in (cust.get("name") or ""):
                msgs.append(f"customer.name={cust.get('name')}")
            if not d.get("blueprint_audit_id"):
                msgs.append("blueprint_audit_id is None")
            audits = d.get("audits") or []
            if not isinstance(audits, list) or len(audits) < 1:
                msgs.append(f"audits={audits}")
            else:
                for k in ("id", "title", "laenge", "breite", "first", "walm", "neigung"):
                    if k not in audits[0]:
                        msgs.append(f"audit missing {k}")
            ref = d.get("referral") or {}
            if not (ref.get("code") or "").startswith("SM-"):
                msgs.append(f"referral.code={ref.get('code')}")
            if msgs:
                fail("portal.my.customer", "; ".join(msgs))
            else:
                ok("portal.my.customer", f"name={cust['name']} audit={d['blueprint_audit_id'][:8]} ref={ref['code']}")
        else:
            fail("portal.my.customer", f"HTTP {r.status_code}: {r.text[:200]}")
    else:
        fail("portal.my.customer", "no customer token")

    r = requests.get(f"{API}/portal/my", headers=H(admin_token), timeout=15)
    if r.status_code in (400, 403):
        ok("portal.my.admin.reject", f"HTTP {r.status_code}")
    else:
        fail("portal.my.admin.reject", f"HTTP {r.status_code}")

    r = requests.get(f"{API}/portal/my", timeout=15)
    if r.status_code == 401:
        ok("portal.my.401", "")
    else:
        fail("portal.my.401", f"HTTP {r.status_code}")

    # ============================================================
    # 4) /api/admin/modules
    # ============================================================
    print("\n--- 4) /api/admin/modules ---")

    r = requests.post(f"{API}/admin/modules/seed", headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        d = r.json()
        ok("modules.seed.first", f"seeded={d.get('seeded')} total={d.get('total')}")
    else:
        fail("modules.seed.first", f"HTTP {r.status_code}: {r.text[:200]}")

    r = requests.post(f"{API}/admin/modules/seed", headers=H(admin_token), timeout=15)
    if r.status_code == 200 and r.json().get("seeded") == 0:
        ok("modules.seed.idempotent", "0 second time")
    else:
        fail("modules.seed.idempotent", f"HTTP {r.status_code} seeded={r.json().get('seeded') if r.ok else 'NA'}")

    r = requests.get(f"{API}/admin/modules", headers=H(admin_token), timeout=15)
    if r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 5:
        ok("modules.list", f"{len(r.json())} modules")
    else:
        fail("modules.list", f"HTTP {r.status_code}")

    r = requests.get(f"{API}/admin/modules?active_only=true", headers=H(admin_token), timeout=15)
    if r.status_code == 200:
        ok("modules.list.active_only", f"{len(r.json())} active")
    else:
        fail("modules.list.active_only", f"HTTP {r.status_code}")

    r = requests.get(f"{API}/admin/modules/INVALID-ID-XYZ", headers=H(admin_token), timeout=15)
    if r.status_code == 404:
        ok("modules.get.404", "")
    else:
        fail("modules.get.404", f"HTTP {r.status_code}")

    new_mod = {
        "name": "NeoStar 2L", "brand": "Astronergy", "leistung_wp": 480,
        "laenge_mm": 1800, "breite_mm": 1135, "gewicht_kg": 23.5,
        "glas_glas": True, "technologie": "topcon", "zellen_count": 144,
    }
    r = requests.post(f"{API}/admin/modules", json=new_mod, headers=H(admin_token), timeout=15)
    new_id = None
    if r.status_code == 201 and r.json().get("id"):
        new_id = r.json()["id"]
        ok("modules.create", f"id={new_id[:8]}")
    else:
        fail("modules.create", f"HTTP {r.status_code}: {r.text[:200]}")

    if new_id:
        r = requests.put(f"{API}/admin/modules/{new_id}",
                         json={"leistung_wp": 485, "active": False},
                         headers=H(admin_token), timeout=15)
        if r.status_code == 200 and r.json().get("leistung_wp") == 485 and r.json().get("active") is False:
            ok("modules.update", "leistung_wp=485 active=False")
        else:
            fail("modules.update", f"HTTP {r.status_code}: {r.text[:200]}")

    if new_id:
        r = requests.delete(f"{API}/admin/modules/{new_id}", headers=H(admin_token), timeout=15)
        if r.status_code == 200:
            ok("modules.delete", "")
        else:
            fail("modules.delete", f"HTTP {r.status_code}")

    if cust_token:
        valid_mod = {"name": "Test Module", "brand": "Test", "leistung_wp": 400,
                     "laenge_mm": 1700, "breite_mm": 1100, "gewicht_kg": 20}
        r = requests.post(f"{API}/admin/modules", json=valid_mod, headers=H(cust_token), timeout=15)
        if r.status_code == 403:
            ok("modules.create.customer.403", r.json().get("detail",""))
        else:
            fail("modules.create.customer.403", f"HTTP {r.status_code} (got {r.text[:200]})")

    bad = {"name": "Big", "brand": "X", "leistung_wp": 5000,
           "laenge_mm": 1700, "breite_mm": 1100, "gewicht_kg": 20}
    r = requests.post(f"{API}/admin/modules", json=bad, headers=H(admin_token), timeout=15)
    if r.status_code == 422:
        ok("modules.validation.wp_too_high", "")
    else:
        fail("modules.validation.wp_too_high", f"HTTP {r.status_code}")

    bad = {"name": "Neg", "brand": "X", "leistung_wp": -10,
           "laenge_mm": 1700, "breite_mm": 1100, "gewicht_kg": 20}
    r = requests.post(f"{API}/admin/modules", json=bad, headers=H(admin_token), timeout=15)
    if r.status_code == 422:
        ok("modules.validation.wp_negative", "")
    else:
        fail("modules.validation.wp_negative", f"HTTP {r.status_code}")

    # ============================================================
    # 5) REGRESSION
    # ============================================================
    print("\n--- 5) REGRESSION ---")

    r = requests.post(f"{API}/blueprint/validate",
                      json={"laenge": 12.5, "breite": 10, "first": 10.0, "walm": 1.5, "neigung": 38},
                      headers=H(admin_token), timeout=15)
    if r.status_code == 200 and "ok" in r.json():
        ok("regression.validate", f"ok={r.json()['ok']}")
    else:
        fail("regression.validate", f"HTTP {r.status_code}")

    r = requests.get(f"{API}/dashboard/stats", headers=H(admin_token), timeout=15)
    if r.status_code == 200 and "total_customers" in r.json():
        ok("regression.dashboard", f"total_customers={r.json()['total_customers']}")
    else:
        fail("regression.dashboard", f"HTTP {r.status_code}")

    print("\n" + "=" * 60)
    print(f"PASS: {len(PASS)}  FAIL: {len(FAIL)}")
    if FAIL:
        print("\nFAILED:")
        for n, d in FAIL:
            print(f"  ! {n}: {d}")
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(main())
