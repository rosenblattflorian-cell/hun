#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

user_problem_statement: |
  Solar Mitte CRM mit AI Roof Audit Tool. Aktuelle Phase:
  Scan-to-Blueprint Engine — Multi-Format Export (PDF/DXF/OBJ/PNG)
  mit K2-Base-konformen DXF-Layern + Plausibilitäts-Validator + Photo-Audit-Magic-Workflow.

backend:
  - task: "Blueprint Service — generate_dxf with K2-Base layers"
    implemented: true
    working: true
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            ezdxf R2018 mit 8 K2-Base-konformen Layern:
              K2_OUTLINE (1, red)   - Außenkontur Dach
              K2_RIDGE (5, blue)    - First
              K2_EAVE (3, green)    - Traufe
              K2_HIP (6, magenta)   - Walm
              K2_DIM (2, yellow)    - Aligned Dimensions
              K2_OBSTACLE (1, red)  - KEEP-OUT Zonen mit ANSI31-Hatch
              K2_LABEL (7, white)   - Beschriftungen
              K2_MODULE (4, cyan)   - PV-Module
            Smoke-Test (Walmdach 12.5×10m, Pitch 38°, 2 Sperrflächen): 63 KB DXF, 35 K2-Layer-Vorkommen.
            Endpoint: POST /api/blueprint/dxf
        - working: true
          agent: "testing"
          comment: |
            ALL DXF tests PASS (9/9). Walmdach: 62813 bytes with K2_OUTLINE + K2_OBSTACLE confirmed.
            Satteldach (walm=0,first=laenge): 60184 bytes. Pultdach (first<<laenge): 60184 bytes.
            0/5 obstacles relative + absolute (relative=false) all generate valid DXF.
            audit_id-flow with existing roof-audit works (62017 bytes).
            Missing required fields → 400. 401 without bearer token confirmed.

  - task: "Blueprint PDF (Vektor-Blueprint im Solar-Mitte-Branding)"
    implemented: true
    working: true
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            ReportLab A3-Landscape: Header mit SOLAR-MITTE-Branding, Bemaßungspfeile (Trauflänge,
            First, Tiefe, Walm), KEEPOUT-Hatching (rot), PV-Module (cyan), Pitch + Ausrichtung im
            Info-Block, Nordpfeil, Legende. Smoke: 3.3 KB PDF.
            Endpoint: POST /api/blueprint/pdf
        - working: true
          agent: "testing"
          comment: |
            PDF generation works for both Walmdach and Satteldach.
            Content-Type: application/pdf, magic bytes %PDF- confirmed at start.

  - task: "Blueprint OBJ (3D Mesh Export)"
    implemented: true
    working: true
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Parametrisches Walmdach (6 Vertices, 4 Faces) bzw. Satteldach. MTL-Material für
            SolarMitteRoof. Endpoint: POST /api/blueprint/obj
        - working: true
          agent: "testing"
          comment: |
            JSON {obj, mtl, filename_obj, filename_mtl} returned. Walmdach exact: v=6, f=4.
            "v ", "f ", "usemtl SolarMitteRoof" all present in obj string.

  - task: "Blueprint PNG (Top-Down High-Res Render)"
    implemented: true
    working: true
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            PIL/Pillow Render 2400x1700: weißer BG, schwarze Linien, KEEPOUT rot mit Hatching,
            PV-Module cyan, Info-Box, Header. Endpoint: POST /api/blueprint/png
        - working: true
          agent: "testing"
          comment: |
            PNG: 28930 bytes (>10KB), magic bytes \\x89PNG confirmed, Content-Type image/png.

  - task: "Blueprint PDF mit Auto-IDs + Titelblock + Confidence-Banner"
    implemented: true
    working: "NA"
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            PDF v2 erweitert:
              - Auto-ID-Codes für Sperrflächen: ST-01 (Schornstein), DF-01 (Dachfenster),
                LF-01 (Lüfter), GA-01 (Gaube), AN-01 (Antenne), pro Typ counted
              - Titelblock oben rechts: Datum, optionale PROJEKT-Nummer (gelb), Erstell-Author
              - Confidence-Banner (gelb), wenn KI-Konfidenz < 80%: "Bitte Maße manuell verifizieren"
              - Legende um "ERKANNTE BAUTEILE"-Liste erweitert (ID-Code + Label, monospace)
            Visuell durch KI-Analyse bestätigt: 95% confidence, Profi-Bauplan-Niveau.

  - task: "Universal Roof Engine — Trigonometrie + Gerüst-Kalkulation"
    implemented: true
    working: true
    file: "backend/roof_engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Neue Module roof_engine.py:
              compute_roof_geometry(α, h_T, h_F, W, walm_offset) →
                L = (h_F-h_T) / sin(α), Tiefe = L·cos(α), Δh = h_F - h_T
                Auto-Erkennung: Sattel | Pult | Walm | Flach (Heuristik via W-Tiefe-Verhältnis)
                Geneigte Fläche, Grundriss-Fläche, Sparrenlänge
              calculate_scaffolding(h_T, W) →
                Gerüst-Höhe = h_T + 0.7m (DIN/ArbSchG Sicherheits-Überstand)
                Gerüst-Länge = W + 2m (1m je Seite)
                Fläche = h × l, Kostenrahmen €6-9/m², Aufbau-Dauer 0.5d/50m²
                Lastklasse "3 (PV-Standard, ≤ 200 kg/m²)"
                Norm: DIN EN 12811 / ArbSchG / TRBS 2121-1
              rectify_obstacles(geometry, obstacles_pct) →
                konvertiert KI-Hindernisse aus 0..1-Prozent in echte Meter-Koordinaten
              scaffolding_to_bom_item(scaff) →
                Direkt in HERO-Angebots-Position konvertierbar

            Endpoints:
              POST /api/roof-engine/compute       → Geometrie + Gerüst + BOM
              POST /api/roof-engine/scaffolding   → Nur Gerüst-Kalkulation
              POST /api/roof-engine/push-hero     → Sync mit HERO (mock, sync-log Entry)

            Smoke-Tests:
              Sattel α=35°, h_T=4.5, h_F=7.5, W=12.5  →  L=5.23m, Tiefe=8.569m,
                Fläche=130.76m², Gerüst=75.4m², €452-679, 0.75 Tage
              Walm walm_offset=1.5  →  Type "walmdach" korrekt erkannt
              HERO Push: 200 OK, sync-log Entry persistiert
        - working: true
          agent: "testing"
          comment: |
            ALL roof-engine endpoints PASS (15/16 with one minor heuristic disagreement):
            - POST /api/roof-engine/compute Sattel: L=5.23, tiefe=8.569, A=130.76, Δh=3.0 — exakt.
            - Walm (walm_offset=1.5) → suggested_type="walmdach" ✓
            - Flach (α=0) → suggested_type="flachdach", L=0 ✓
            - Edge α=89° validates ✓
            - Edge α=90° → 422 (Pydantic Field le=89; Review erwartet 400, aber 422 ist 
              ebenfalls korrekt da Field-Validierung VOR der ValueError-Branch greift)
            - Edge h_first<h_traufe (α>1) → 400 ✓
            - Edge breite_traufe=0 → 422 ✓
            - obstacles_pct → rectified_obstacles mit x_m/y_m/width_m/height_m ✓
            - 401 ohne Token ✓
            - POST /api/roof-engine/scaffolding (Query-Params) → flaeche=75.4, h=5.2, l=14.5 ✓
            - h_traufe=0 → 400 ✓
            - POST /api/roof-engine/push-hero → is_mock=True, sync-log persistiert ✓

            Minor: Pult-Heuristik triggert NICHT bei {α=8°, h_T=3, h_F=4, W=15}.
            roof_engine.py:96 verwendet Schwelle `breite_traufe > tiefe_h_pult * 4`.
            Mit W=15, tiefe_h_pult=7.117 → 4× = 28.47, W=15 < 28.47 → "satteldach"
            statt "pultdach". Heuristik ist konservativ ausgelegt (nur SEHR lange,
            schmale Dächer werden als Pult erkannt). Funktional kein Bug — die Berechnung
            ist mathematisch korrekt; nur die automatische Typ-Klassifizierung weicht
            vom Reviewer-Erwarten ab. Empfehlung: Schwellenwert auf z.B. 1.8 absenken
            ODER manuelles type-Override im Request unterstützen.

  - task: "Frontend Universal Engine UI im Blueprint-Screen"
    implemented: true
    working: true
    file: "frontend/app/blueprint.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Neue Sektion "UNIVERSAL ROOF ENGINE" oben im Blueprint-Screen (PRO-Badge):
              4 Eingaben (α, W, h_T, h_F) → "Berechnen + Übernehmen" Button
              Ergebnis-Cards: Dachtyp, Sparrenlänge, Tiefe, Fläche, Δh
              Gerüst-Block (gelb): Höhe, Länge, Fläche, Kostenrahmen, Aufbau-Dauer, Lastklasse, Norm
              "Gerüst-BOM an HERO pushen" Button (Apple-Yellow)
              Berechnete Werte werden automatisch in inline-Felder übernommen → 1-Klick-Blueprint
            Visuell verifiziert via Screenshot: Sattel 35°/12.5m → 5.23m Sparre, 75.4m² Gerüst, €452-679.

  - task: "Customer-Login + 3D-Twin Setup (Familie Schmidt)"
    implemented: true
    working: true
    file: "backend (manual seed)"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: false
          agent: "main"
          comment: "Initial passlib bcrypt-Issue — falsche DB (test_database vs solar_crm)."
        - working: true
          agent: "main"
          comment: |
            FIXED: User direkt mit bcrypt + DB_NAME=solar_crm angelegt.
            Customer-User: kunde@solar-mitte.de / kunde123
            Customer-Record: "Familie Schmidt", Berlin
            Roof-Audit: Schmidt Hauptdach (12.5×10m, Walm 1.5m, Pitch 38°)
            Project: Schmidt PV-Anlage (10.5kWp)
            Login-Test: 200 OK mit role="customer"

  - task: "Customer Portal — 3D-Twin (Three.js Web + PNG Mobile)"
    implemented: true
    working: "NA"
    file: "frontend/src/RoofViewer3D.tsx, frontend/app/kunde/index.tsx, backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            RoofViewer3D als universelle Komponente:
              Web: react-three-fiber Canvas mit Auto-Rotation, ambient + directional Lights,
                axesHelper, gridHelper, MeshStandardMaterial (Roof-Brown), Y-Up-Konversion
                aus OBJ-Format, Quad→Triangle-Konversion für BufferGeometry.
              Native Mobile: PNG-Fallback (Top-Down) via /api/blueprint/png mit base64-DataURI
            Backend: GET /api/portal/my erweitert um blueprint_audit_id + audits[] Liste.
            Frontend: kunde/index.tsx zeigt "Mein digitales Dach" Sektion mit 3D-TWIN Badge,
            Hint-Text je nach Platform.

    implemented: true
    working: true
    file: "frontend/app/blueprint.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            Auto-Validate via debounced useEffect bei jeder Änderung. Banner zeigt:
              - Bei Errors: rotes Banner mit Error-Codes + Messages, Export-Buttons disabled
              - Bei Warnings: gelbes Banner mit Warnings, Export bleibt aktiv
              - Bei OK: grünes "Plausibilitätscheck OK"-Banner
            Visuell verifiziert via Screenshot.

    implemented: true
    working: true
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            validate_blueprint() prüft Dimensionen, First/Trauf, Walm, Pitch, Sperrflächen-Lage,
            Größe, Überschneidungen, Module-in-Keepout. Endpoint: POST /api/blueprint/validate
        - working: true
          agent: "testing"
          comment: |
            5 of 6 validate test cases PASS:
              a) valid → ok=true, errors=[] OK
              b) chimney out-of-bounds → OBSTACLE_OVERFLOW_X+Y OK
              c) RIDGE_LONGER_THAN_EAVE + PITCH_OUT_OF_RANGE OK
              d) WALM_NEGATIVE OK
              f) OBSTACLE_OVERLAP warning OK
            
            Minor: Test case e) MODULE_IN_KEEPOUT did NOT trigger with input
            modules=[{"x":4.5,"y":4.5,"w_m":1.5,"h_m":1}] because the API converts module x/y as
            relative percentages (multiplies by L,B) — so x=4.5 → x_m=54m (way outside roof).
            Inconsistent design: w_m/h_m are meters but x/y are fractions and there is no
            "relative" flag for modules (unlike obstacles). Either the model needs a relative
            flag or x/y should also be in meters. Not blocking — sending x=0.4,y=0.4 (relative)
            DOES correctly produce MODULE_IN_KEEPOUT (verified). Needs API spec clarification.

  - task: "Blueprint Magic Workflow (Photo-Audit → Blueprint)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            GET /api/photo-audits, POST /api/blueprint/from-photo-audit/{id}?fmt=pdf|dxf|obj|png
        - working: true
          agent: "testing"
          comment: |
            GET /api/photo-audits: 200 (empty list), 401 without token confirmed.
            POST /api/blueprint/from-photo-audit/FAKE-ID-123?fmt=pdf → 404 confirmed.
            Note: invalid-fmt-path with valid id could not be tested because no photo-audits
            exist in the test DB. The 404 path is correctly guarded.

  - task: "Blueprint HERO Push (PDF + DXF an HERO-Akte)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            POST /api/blueprint/push-hero generiert PDF + DXF parallel und ruft
            hero_push_document zweimal. Sync-Log persistiert in db.hero_sync_log. MOCK aktiv.
        - working: false
          agent: "testing"
          comment: |
            CRITICAL BUG: POST /api/blueprint/push-hero returns 500 Internal Server Error.
            Root cause: server.py:1871 calls hero_push_document(content=..., mime=...)
            but hero_service.py:130 expects (hero_project_id, doc_type, filename, pdf_bytes,
            note, metadata). Wrong kwarg names.
        - working: true
          agent: "main"
          comment: |
            FIXED: kwargs angepasst auf doc_type="blueprint", pdf_bytes=..., note=...
            Smoke-Test: 200 OK, is_mock=True, pdf=3144B+dxf=61999B, 2 mock-doc-IDs.

  - task: "Blueprint DXF Layers Doku-Endpoint"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            GET /api/blueprint/dxf-layers liefert Layers + k2_compatible + units + dxf_version.
        - working: true
          agent: "testing"
          comment: |
            200 OK with 8 K2_* layers (K2_OUTLINE/RIDGE/EAVE/HIP/DIM/OBSTACLE/LABEL/MODULE),
            k2_compatible=true, units=meters, dxf_version=R2018. 401 without token.

frontend:
  - task: "Hub-Screen — 3-Spalten Layout (NO-SCROLL)"
    implemented: true
    working: true
    file: "frontend/app/hub.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "12 Tiles in 3×4 Grid. Verifiziert via Screenshot. Solar-Mitte-Branding."

  - task: "Blueprint Screen — Format-Auswahl & Sperrflächen-Editor + Magic Workflow"
    implemented: true
    working: true
    file: "frontend/app/blueprint.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            5-Step UI:
              0. (optional) Magic-Workflow Banner: "Foto-Audit übernehmen" wenn vorhanden
              1. Aufmaß-Auswahl (Liste oder Manuell)
              2. Sperrflächen-Editor (Add/Remove pro Typ)
              3. Format-Karten (PDF/DXF/OBJ/PNG) — vor Download wird Validate gerufen
              4. HERO-Push
              5. K2-Layer-Liste (Goldstandard-Doku)
            Verifiziert via Screenshot.

  - task: "Blueprint Gerüst-Linie (h_traufe Optional) — PDF/DXF/PNG mit K2_SCAFFOLDING"
    implemented: true
    working: true
    file: "backend/server.py, backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: |
            Blueprint-Endpoints mit optionalem h_traufe-Param getestet:
            - POST /api/blueprint/pdf {h_traufe=4.5}: 3KB+ PDF-Magic ✓
            - POST /api/blueprint/dxf {h_traufe=4.5}: 61KB DXF, "K2_SCAFFOLDING"-Layer enthalten ✓
            - POST /api/blueprint/png {h_traufe=4.5}: 27KB PNG-Magic ✓
            - POST /api/blueprint/pdf OHNE h_traufe: weiterhin 200 OK (Gerüst-Linie weggelassen) ✓
            - GET /api/blueprint/dxf-layers: 9 Layer inkl. "K2_SCAFFOLDING" (color 8, lineweight 25) ✓

  - task: "Customer Portal /portal/my — blueprint_audit_id + audits[]"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: |
            GET /api/portal/my als Customer (kunde@solar-mitte.de):
            - customer.name = "Familie Schmidt" ✓
            - blueprint_audit_id = bf0d9753... (NICHT null) ✓
            - audits[] = 1 Eintrag mit id/title/laenge/breite/first/walm/neigung ✓
            - referral.code = "SM-YIYF14" (startsWith "SM-") ✓
            
            GET /api/portal/my als Admin → 403 ✓
            GET /api/portal/my ohne Token → 401 ✓

  - task: "Admin Modul-Stammdaten CRUD + seed"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: |
            Komplette CRUD-Tests bestanden:
            - POST /api/admin/modules/seed (admin): 200, seeded=N (idempotent: 0 beim 2. Call) ✓
            - GET /api/admin/modules: Liste mit allen geseedeten Modulen ✓
            - active_only=true Query-Param: filtert korrekt ✓
            - GET /api/admin/modules/INVALID-ID → 404 ✓
            - POST /api/admin/modules (admin) NeoStar 2L → 201 Created mit id ✓
            - PUT /api/admin/modules/{id} {leistung_wp:485, active:false} → 200, geänderte Werte ✓
            - DELETE /api/admin/modules/{id} → 200 ✓
            - POST als CUSTOMER mit gültigen Daten → 403 "Nur Admins dürfen Modul-Stammdaten 
              verwalten." (KORREKT: Auth-Check vor Validation via _require_admin in Endpoint-Body) ✓
            - leistung_wp=5000 (>2000) → 422 ✓
            - leistung_wp=-10 (negativ) → 422 ✓

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Blueprint-Engine Phase 2 ist fertig. Bitte ALLE Blueprint-Endpoints durchtesten.
    - agent: "testing"
      message: |
        Phase-2-Tests komplett (37/38 PASS).
    - agent: "testing"
      message: |
        NEUE PHASE: Roof Engine + Modules + Portal Erweiterung getestet (37 PASS, 1 minor):
        
        ✅ Universal Roof Engine /api/roof-engine/*:
          - compute Sattel α=35° h_T=4.5 h_F=7.5 W=12.5 → L=5.23, tiefe=8.569,
            A=130.76, Δh=3.0 (alle Werte mathematisch exakt)
          - compute Walm walm_offset=1.5 → "walmdach" ✓
          - compute Flach α=0 → "flachdach", L=0 ✓
          - Edge α=89° validiert, α=90° → 422 (Pydantic Field le=89 — review erwartete 400,
            422 ist aber semantisch ebenso korrekt)
          - h_first<h_traufe → 400 ✓ ; breite=0 → 422 ✓
          - obstacles_pct → rectified mit x_m/y_m/width_m/height_m ✓
          - 401 ohne Token ✓
          - scaffolding (Query-Params) → flaeche=75.4, h=5.2, l=14.5 ✓
          - h_traufe=0 → 400 ✓
          - push-hero → is_mock=True, sync-log persistiert ✓
        
        ✅ Blueprint mit h_traufe (Gerüst-Linie):
          - PDF (3KB), DXF (61KB enthält "K2_SCAFFOLDING"), PNG (27KB) ✓
          - PDF ohne h_traufe → weiterhin OK ✓
          - GET /api/blueprint/dxf-layers → 9 Layer inkl. "K2_SCAFFOLDING" ✓
        
        ✅ /api/portal/my Customer-View (kunde@solar-mitte.de):
          - customer.name="Familie Schmidt", blueprint_audit_id gesetzt,
            audits[] mit allen Keys, referral.code="SM-…" ✓
          - Admin → 403, ohne Token → 401 ✓
        
        ✅ /api/admin/modules CRUD + seed:
          - seed: erste 5 Module geseedet, idempotent (0 beim 2. Call) ✓
          - LIST mit/ohne active_only ✓
          - GET ungültige ID → 404 ✓
          - POST NeoStar 2L → 201 ✓
          - PUT Update → 200 mit geänderten Werten ✓
          - DELETE → 200 ✓
          - POST als Customer → 403 "Nur Admins dürfen Modul-Stammdaten verwalten."
            (KORREKT: Auth-Check vor Validation via _require_admin im Body) ✓
          - leistung_wp>2000 → 422 ✓ ; negativ → 422 ✓
        
        ✅ Regression: /auth/login (admin+customer), /blueprint/validate, /dashboard/stats
        
        ⚠️ MINOR (kein Blocker):
          - Pult-Heuristik: {α=8°, h_T=3, h_F=4, W=15} liefert "satteldach" statt
            "pultdach". roof_engine.py:96 verwendet `W > tiefe_pult * 4`-Schwelle 
            (28.47m); W=15 ist darunter. Berechnungen sind mathematisch korrekt,
            nur die Auto-Klassifizierung ist konservativ. Falls gewünscht:
            Schwelle senken auf z.B. 1.8 ODER manuelles type-Override im Request.

# ===== Historischer Phase-2 Bericht (vor Roof-Engine) =====
    - agent: "testing"
      message: |
        Phase-2 historisch (31 Tests, 29 PASS, 2 FAIL — vor Fix):
        ✅ Funktionierend:
          - GET /api/blueprint/dxf-layers (8 K2_*-Layer, k2_compatible, R2018)
          - POST /api/blueprint/dxf (Walm/Sattel/Pult/0/5-Sperrflächen/abs/audit_id)
          - POST /api/blueprint/pdf (PDF-Magic OK)
          - POST /api/blueprint/obj (v=6, f=4, usemtl SolarMitteRoof)
          - POST /api/blueprint/png (28KB, PNG-Magic OK)
          - POST /api/blueprint/validate (5 von 6 Test-Cases)
          - GET /api/photo-audits (auth + leere Liste)
          - POST /api/blueprint/from-photo-audit/FAKE → 404
          - Regression: /auth/me, /customers, /dashboard/stats, /roof-audits
          - 401 ohne Token konsistent
        
        ❌ KRITISCHER BUG #1 — POST /api/blueprint/push-hero → 500:
          server.py:1871 ruft hero_push_document(content=..., mime=...) auf,
          aber hero_service.py:130 erwartet (hero_project_id, doc_type, filename, pdf_bytes,
          note, metadata).
          Stacktrace:
            TypeError: hero_push_document() got an unexpected keyword argument 'content'
          FIX (server.py ~Zeile 1871–1880): kwargs umbenennen — content→pdf_bytes,
          mime entfernen, doc_type="blueprint" hinzufügen, optional note=...
        
        ⚠️ DESIGN-INKONSISTENZ — POST /api/blueprint/validate Module-Modell:
          Test-Case e) MODULE_IN_KEEPOUT triggert NICHT mit
          modules=[{"x":4.5,"y":4.5,"w_m":1.5,"h_m":1}], weil die API x/y als 0..1-Anteile
          interpretiert (×L,×B → x_m=54m außerhalb des Daches), während w_m/h_m bereits in
          Metern sind. Es gibt KEINEN "relative"-Flag für Module (im Gegensatz zu Obstacles).
          Mit relativen Werten (x=0.4,y=0.4) funktioniert MODULE_IN_KEEPOUT korrekt.
          Empfehlung: ModuleRequest.relative-Flag analog Obstacle einführen ODER x/y als
          Meter dokumentieren.
        
        Hinweis: from-photo-audit Invalid-Format-Pfad konnte nicht getestet werden, weil
        keine photo_audits in DB existieren. 404-Pfad funktioniert.

        REQUIRED TESTS:
        ===============
        AUTH: Login admin@solar-mitte.de / admin123 → JWT für Bearer

        1) GET /api/blueprint/dxf-layers
           - 200, returns 8 K2_* layers
           - 401 ohne token

        2) POST /api/blueprint/dxf
           Test-Cases:
             a) Walmdach (laenge=12, breite=10, first=10, walm=1.5) — DXF >5KB, enthält "K2_OUTLINE", "K2_OBSTACLE"
             b) Satteldach (walm=0, first=laenge) — DXF valide
             c) Pultdach (walm=0, first<<laenge) — graceful handling
             d) 0 Sperrflächen — funktioniert
             e) 5+ Sperrflächen relativ (relative=true)
             f) Sperrflächen absolut in Meter (relative=false)
             g) audit_id von existierendem RoofAudit
             h) Fehlende Pflichtfelder (laenge, breite, first) → 400
             i) 401 ohne token

        3) POST /api/blueprint/pdf
           - PDF-Magic-Number "%PDF-" am Anfang
           - Walm + Sattel beide funktionieren
           - Mit/ohne Sperrflächen

        4) POST /api/blueprint/obj
           - JSON {obj, mtl, filename_obj, filename_mtl}
           - obj enthält "v ", "f ", "usemtl SolarMitteRoof"
           - 6 Vertices, 4 Faces für Walmdach

        5) POST /api/blueprint/png
           - PNG-Magic-Number "\x89PNG"
           - Größe > 10 KB

        6) POST /api/blueprint/validate
           Test-Cases:
             a) Gültige Daten → ok=true, errors=[]
             b) Schornstein x=0.95, w=0.1 → OBSTACLE_OVERFLOW_X
             c) First > laenge → RIDGE_LONGER_THAN_EAVE
             d) Pitch 120 → PITCH_OUT_OF_RANGE
             e) Negative Walm → WALM_NEGATIVE
             f) Modul innerhalb Sperrfläche → MODULE_IN_KEEPOUT
             g) 2 überlappende Sperrflächen → OBSTACLE_OVERLAP (warning)

        7) GET /api/photo-audits
           - Liste leer ist OK initial

        8) POST /api/blueprint/from-photo-audit/{id}
           - mit nicht-existierender ID → 404
           - mit gültiger ID + fmt=pdf → PDF
           - mit fmt=invalidx → 400

        9) POST /api/blueprint/push-hero
           - response.is_mock=True erwartet
           - sync-log Entry geschrieben
           - 401 ohne token

        Test credentials: /app/memory/test_credentials.md
