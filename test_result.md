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
  Solar Mitte CRM — Easy-Mode Sprint:
  Solar Halo Header, Admin-Modul-DB, Customer 3D-Twin+Downloads,
  Universal Roof Engine + Gerüst, K2-Blueprint, Auto-Snap, 3-Werte-Wizard.

frontend:
  - task: "Solar Halo Header (Hub + Customer)"
    implemented: true
    working: true
    file: "frontend/src/SolarHaloHeader.tsx"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: |
            Animated Halo mit SVG-Sonnenstrahlen (20 Strahlen, alternierend lang/kurz),
            pulsierender RadialGradient-Glow via Reanimated, Circuit-Pattern SVG-Hintergrund,
            Avatar-Border mit Shadow-Glow, Brand-Text SOLAR/MITTE (ausgeblendet bei IS_SMALL<380px).
            Full-Mode für Hub + Customer. Compact-Mode verfügbar. 1:1 Mockup-Match.

  - task: "Hub-Screen mit 3×4 Tile-Grid"
    implemented: true
    working: true
    file: "frontend/app/hub.tsx"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: |
            12 Tiles (Dashboard, Kunden, Projekte, Aufmaß, KI-Foto, Blueprint PRO,
            PV-Layout BOM, Inventar, Kalender, Monteur, KI-Assist AI, Module DB, HERO).
            Module + HERO nur für Admin sichtbar. Solar Halo Header integriert.
            logoutFloating Button oben rechts.

  - task: "Customer Portal — Familie Schmidt 3D-Twin + Download-Center"
    implemented: true
    working: true
    file: "frontend/app/kunde/index.tsx + frontend/src/RoofViewer3D.tsx"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: |
            Login: kunde@solar-mitte.de / kunde123
            - Solar Halo Header (FS initials)
            - Mein digitales Dach: Three.js Viewer mit Walmdach-Mesh + Auto-Rotation + Grid
            - Download-Center: 3 Buttons (Blueprint PDF, CAD DXF, 3D-Modell OBJ)
            - Web: Blob-Anchor-Download, Native: Linking

  - task: "Admin Modul-Stammdaten (CRUD-UI)"
    implemented: true
    working: true
    file: "frontend/app/admin/modules.tsx"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: |
            Unter /admin/modules — Admin-only (403 für customer).
            Liste aller 6 geseedeten Module (Trina, JA, Meyer Burger, Q Cells, Jinko + Astronergy-NeoStar).
            Add/Edit/Delete Modal mit allen Feldern (Brand, Name, Wp, L/B/D, Gewicht, Tech-Chip-Auswahl, GG-Switch, Aktiv-Switch).
            Seed-Button für Standard-Module.

  - task: "Blueprint Screen — 4-Format Export + Roof Engine + Module-Selector"
    implemented: true
    working: "NA"
    file: "frontend/app/blueprint.tsx"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: |
            - "Universal Roof Engine" Sektion (3 Eingaben → Geometrie + Gerüst + HERO-Push)
            - "AKTIVE MODUL-DB" Sektion (horizontal scrollbare Chips der aktiven Module aus /admin/modules)
            - Magic-Workflow: "Foto-Audit übernehmen" wenn Photo-Audits vorhanden
            - Sperrflächen-Editor (ST-01, DF-01, LF-01 Auto-IDs)
            - Guardian Validation-Banner (11 Error-Codes)
            - 4 Format-Karten (PDF rot, DXF grün, OBJ blau, PNG gelb)
            - HERO-Push Button (Apple Green)
            - K2-Layer-Doku am Ende
        - working: "NA"
          agent: "main"
          comment: |
            FIX Sprint (heute): Module-Selector UX-Visibility-Fix.
            Problem: Auf Mobile (390px) waren von 6 Modulen nur 2 sichtbar, ohne Hinweis auf horizontalen Scroll.
            Lösung:
              1. "WISCHEN ← →" Badge (gelb) im Section-Header eingebaut → signalisiert klar, dass horizontal gescrollt werden kann.
              2. Rechts-Fade-Gradient am ScrollView-Rand (Web: linear-gradient; Native: semi-transparente Kante).
              3. z-index: 10 + elevation: 3 (Android) + overflow: visible am modSelectorBox → Sektion kann nicht mehr von nachfolgenden Cards verdeckt werden.
              4. paddingRight: 28 im Scroll-Content → letzte Card nicht mehr geclippt.
              5. Active-Chip zeigt jetzt ein ✓-Checkmark-Icon + Subtext mit ausgewähltem Modul.
              6. TestIDs hinzugefügt: module-selector-box, module-swipe-hint, module-scroll, module-chip-{id}.
            Screenshots bestätigen: WISCHEN-Hint sichtbar, Scroll funktioniert, Ausgewähltes Modul wird hervorgehoben.

  - task: "Photo-Audit Easy-Mode: Auto-Snap + 3-Werte-Wizard + Onboarding"
    implemented: true
    working: "NA"
    file: "frontend/app/photo-audit.tsx"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            NEU in diesem Sprint:
            - "KI-AUTO-SNAP" Hero-Button (Apple Green Glow): POST /api/photo-audit/auto-snap
              erkennt 4 Eckpunkte automatisch (OpenCV Canny+Contours), setzt points[] im State
            - "3-WERTE-WIZARD" Modal (öffnet automatisch nach Foto-Pick): α, h_T, h_F Inputs
              → POST /api/roof-engine/compute → Vorschau-Box automatisch als 60% zentrale Box
            - Onboarding-Overlay mit 3 Steps (AsyncStorage "photo_audit_onboarded_v1")
              Step 1: Foto wählen · Step 2: Eckpunkte (KI hilft) · Step 3: Maße & Blueprint

backend:
  - task: "Universal Roof Engine Endpoints"
    implemented: true
    working: true
    file: "backend/roof_engine.py + backend/server.py"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "37/38 PASS earlier. Alle Endpoints grün."

  - task: "Blueprint PDF/DXF/OBJ/PNG + Gerüst-Linie"
    implemented: true
    working: true
    file: "backend/blueprint_service.py"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "Alle Formate + K2_SCAFFOLDING Layer validated"

  - task: "Auto-Snap Endpoint (Easy-Mode)"
    implemented: true
    working: true
    file: "backend/photo_audit.py + backend/server.py"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: |
            POST /api/photo-audit/auto-snap — OpenCV Canny + Contours + 4-Eck-Polygon.
            Smoke-Test: Trapez 800×600 → 4 Corners exakt erkannt, Confidence 76%, method="contour".
            Heuristik-Fallback wenn keine Kanten gefunden.

  - task: "Latin-1 Em-dash Bugfix (protocol_pdf)"
    implemented: true
    working: true
    file: "backend/server.py"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Title wird mit .encode('ascii','ignore') für Content-Disposition filename sanitiert."

metadata:
  created_by: "main_agent"
  version: "2.0-easymode"
  test_sequence: 3
  run_ui: true

test_plan:
  current_focus:
    - "Solar Halo Header (Hub + Customer)"
    - "Hub-Screen mit 3×4 Tile-Grid"
    - "Customer Portal — Familie Schmidt 3D-Twin + Download-Center"
    - "Admin Modul-Stammdaten (CRUD-UI)"
    - "Blueprint Screen — 4-Format Export + Roof Engine + Module-Selector"
    - "Photo-Audit Easy-Mode: Auto-Snap + 3-Werte-Wizard + Onboarding"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Easy-Mode-Sprint fertig. Bitte teste das Frontend in mobilen Dimensionen (iPhone 14/SE/Galaxy):

        TEST-CREDENTIALS:
          Admin:     admin@solar-mitte.de / admin123
          Customer:  kunde@solar-mitte.de / kunde123
          Monteur:   monteur@solar-mitte.de / monteur123

        TESTS:

        1) HUB (Admin Login)
           - Solar Halo Header sichtbar (pulsierender Glow, Profile-Initials "A")
           - SOLAR MITTE Schriftzug unter Halo (auf ≥380px)
           - Begrüßung "Guten Morgen, Admin" (oder je nach Uhrzeit)
           - Logout-Button schwebt rechts oben
           - 12 Tile-Grid (3 Spalten × 4 Reihen, alle ohne Scroll sichtbar)
           - Module-Tile (DB-Badge) UND HERO-Tile nur bei Admin sichtbar

        2) MOBILE — iPhone SE (320×568)
           - SOLAR MITTE Schriftzug ausgeblendet (IS_SMALL Breakpoint)
           - Halo etwas kleiner (~45% statt 55%)
           - Tile-Grid weiterhin nutzbar

        3) CUSTOMER PORTAL (kunde@ Login)
           - Solar Halo mit "FS" Initials (Familie Schmidt)
           - Status-Pill "10.5 kWp · 24 Module"
           - "Mein digitales Dach" Sektion mit 3D-TWIN-Badge
           - Three.js Canvas rendert Walmdach (orange Mesh, Grid, AxesHelper)
           - Download-Row: 3 Buttons (PDF rot, DXF grün, OBJ gelb)
           - Click auf PDF/DXF/OBJ → Datei-Download im Web

        4) ADMIN MODULE DB (über Hub → Module-Tile)
           - Titel "Modul-Stammdaten" + ADMIN-Badge
           - Liste: 6 Module sichtbar (Astronergy, JA Solar, Jinko, Meyer Burger, Q CELLS, Trina)
           - GG-Badges für Glas-Glas-Module
           - Edit-Button öffnet Modal mit allen Feldern
           - Add-Button (+) öffnet leeres Modal
           - Delete zeigt Confirmation
           - Seed-Button (Standard-Module)
           - "Nur aktive" Filter

        5) CUSTOMER AS ADMIN-MODUL (Zugriff-Test)
           - Als kunde@ → /admin/modules URL → muss "Zugriff verweigert" zeigen

        6) BLUEPRINT SCREEN
           - Universal Roof Engine toggleable
           - 3 Eingaben (Neigung α, Traufhöhe, Firsthöhe, Trauf-Breite) → Compute
           - Ergebnis: Sparrenlänge, Tiefe, Fläche, Dachtyp
           - Gerüst-Kalk: 75.4 m², €452-679, Lastklasse 3
           - AKTIVE MODUL-DB Sektion sichtbar mit 6 Chips
           - Audit-Auswahl (Chips mit Aufmaß-Daten)
           - Sperrflächen-Editor (5 Types: Schornstein, Dachfenster, Lüfter, Gaube, Antenne)
           - Guardian-Banner (grün bei OK, rot bei Error)
           - 4 Format-Buttons (PDF/DXF/OBJ/PNG)

        7) PHOTO-AUDIT EASY-MODE (via Hub → KI-Foto)
           - Header "Foto-Aufmaß · KI-gestützte Perspektivkorrektur"
           - Beim ersten Besuch: Onboarding-Overlay mit 3 Steps (Weiter-Button)
           - Nach Onboarding-Skip oder Done: AsyncStorage setzt Flag
           - Foto-Upload: Galerie / Aufnehmen Buttons
           - Nach Foto-Pick: 3-Werte-Wizard Modal öffnet automatisch (nach 400ms)
           - Wizard: 3 Inputs (α, h_T, h_F) + Submit-Button "Übernehmen & Vorschau-Box"
           - Nach Submit: 4 Eckpunkte als zentrale Box auf Bild gesetzt
           - "KI-AUTO-SNAP" Hero-Button unter Canvas (Apple Green)

        BACKEND-ENDPOINTS NICHT TESTEN (bereits grün):
          - /api/roof-engine/*, /api/blueprint/*, /api/auth/*
          Nur UI-Flow validieren.

        WICHTIG:
          - Test in iPhone-Dimensionen (390×844 UND 320×568 für SE)
          - Mobile-Responsive UI sicherstellen
          - Console-Errors loggen
