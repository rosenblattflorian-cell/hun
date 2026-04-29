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
  mit K2-Base-konformen DXF-Layern (KEEPOUT_OBSTACLES für Sperrflächen).

backend:
  - task: "Blueprint Service — generate_dxf with K2-Base layers"
    implemented: true
    working: "NA"
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Implementiert: ezdxf R2018 mit 8 Layern (ROOF_OUTLINE, ROOF_RIDGE, ROOF_EAVES, ROOF_HIPS, DIMENSIONS, KEEPOUT_OBSTACLES, TEXT_LABELS, PV_MODULES). Smoke-Test via curl: 63KB DXF generated successfully. Walmdach Topologie korrekt. Hatch-Pattern für KEEPOUT-Zonen aktiv."
  - task: "Blueprint PDF (Vektor-Blueprint im Solar-Mitte-Branding)"
    implemented: true
    working: "NA"
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "ReportLab A3-Landscape: Header mit SOLAR-MITTE-Branding, Bemaßungen (Trauflänge, First, Tiefe, Walm), KEEPOUT-Hatching (rot), PV-Module (cyan), Pitch + Ausrichtung im Info-Block, Nordpfeil, Legende. Smoke: 3.3KB PDF generated."
  - task: "Blueprint OBJ (3D Mesh Export)"
    implemented: true
    working: "NA"
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Parametrisches Walmdach (6 Vertices, 4 Faces) bzw. Satteldach (6 Vertices, 4 Faces). MTL-Material für SolarMitteRoof. Smoke: 330B OBJ + MTL generated."
  - task: "Blueprint PNG (Top-Down High-Res Render)"
    implemented: true
    working: "NA"
    file: "backend/blueprint_service.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "PIL/Pillow Render 2400x1700: weißer BG, schwarze Linien, KEEPOUT-Zonen rot mit Hatching, PV-Module cyan, Info-Box, Header. Smoke: 28.7KB PNG generated."
  - task: "Blueprint HERO Push (PDF + DXF an HERO-Akte)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/blueprint/push-hero generiert PDF + DXF parallel und ruft hero_push_document zweimal auf. Sync-Log wird in db.hero_sync_log persistiert. MOCK-Mode aktiv (HERO_IS_MOCK=True)."

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
          comment: "12 Tiles in 3×4 Grid, alle ohne Scrolling sichtbar. Solar-Mitte-Branding (Deep Navy + Apple Green + Yellow). Visuell verifiziert via Screenshot."
  - task: "Blueprint Screen — Format-Auswahl & Sperrflächen-Editor"
    implemented: true
    working: true
    file: "frontend/app/blueprint.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "4-Step UI: Audit-Auswahl, Sperrflächen-Add/Remove, 4 Format-Cards (PDF/DXF/OBJ/PNG), HERO-Push, DXF-Layer-Liste. Visuell verifiziert via Screenshot. Disabled-Status wird korrekt angezeigt wenn kein Aufmaß ausgewählt."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Blueprint Service — generate_dxf with K2-Base layers"
    - "Blueprint PDF (Vektor-Blueprint im Solar-Mitte-Branding)"
    - "Blueprint OBJ (3D Mesh Export)"
    - "Blueprint PNG (Top-Down High-Res Render)"
    - "Blueprint HERO Push (PDF + DXF an HERO-Akte)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Blueprint Multi-Format Engine wurde implementiert:
          • POST /api/blueprint/dxf  → ezdxf R2018, 8 K2-Base Layer, Hatch für KEEPOUT
          • POST /api/blueprint/pdf  → ReportLab A3 Landscape Vektor-Blueprint
          • POST /api/blueprint/obj  → JSON {obj, mtl} für Walm/Sattel-Dach
          • POST /api/blueprint/png  → PIL Top-Down Render 2400×1700
          • POST /api/blueprint/push-hero  → PDF + DXF → HERO (mock)
          • GET  /api/blueprint/dxf-layers → Layer-Doku
        
        Smoke-Tests via curl bestätigen 200 OK + sinnvolle Datei-Größen.
        Bitte folgende Szenarien durchtesten:
        1. DXF generieren mit audit_id (existierendes RoofAudit) UND mit inline-Daten
        2. Mit/ohne Walm (verschiedene Roof-Topologien)
        3. Mit 0/1/N Sperrflächen (Edge-Cases)
        4. PDF-Bytes valide (PDF Header magic numbers prüfen)
        5. OBJ enthält valides Mesh (Header, Vertices, Faces)
        6. PNG ist gültiges Format
        7. HERO-Push schreibt sync-log Entry
        8. 401-Schutz für alle Endpoints
        
        Test-Credentials: admin@solar-mitte.de / admin123
