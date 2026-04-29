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

  - task: "Blueprint Plausibilitäts-Validator"
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
    working: false
    file: "backend/server.py"
    stuck_count: 1
    priority: "medium"
    needs_retesting: true
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
            note, metadata). Wrong kwarg names lead to:
              TypeError: hero_push_document() got an unexpected keyword argument 'content'
            
            FIX: change keywords in server.py api_blueprint_push_hero from
              hero_push_document(hero_project_id=..., filename=..., content=pdf_bytes, mime="application/pdf")
            to
              hero_push_document(hero_project_id=..., doc_type="blueprint",
                                 filename=..., pdf_bytes=pdf_bytes,
                                 note=f"Blueprint-Push für {data.project_title}")
            (and similarly for the DXF call — note hero_service expects pdf_bytes regardless of
            actual format, since mock just logs size).
            
            401 without token correctly enforced.

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

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Blueprint HERO Push (PDF + DXF an HERO-Akte)"
  stuck_tasks:
    - "Blueprint HERO Push (PDF + DXF an HERO-Akte)"
  test_all: false
  test_priority: "stuck_first"

agent_communication:
    - agent: "main"
      message: |
        Blueprint-Engine Phase 2 ist fertig. Bitte ALLE Blueprint-Endpoints durchtesten.
    - agent: "testing"
      message: |
        Backend-Test komplett (31 Tests, 29 PASS, 2 FAIL).
        
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
