"""
Solar Mitte — Scan-to-Blueprint Engine
=======================================

Generiert aus Roof-Audit-Daten (manuell + KI-Foto-Aufmaß) maßstabsgetreue
Multi-Format-Pläne für die professionelle Weiterverarbeitung:

  • DXF  — CAD-Format mit K2-Base-konformen Layern (KEEPOUT für Sperrflächen)
  • PDF  — Vektor-Blueprint im Solar-Mitte-Branding
  • OBJ  — 3D-Mesh des parametrischen Dachmodells (+ MTL-Material)
  • PNG  — Hochauflösendes Top-Down-Rendering

Datenquelle:
  - laenge   : Trauflänge (m)
  - breite   : Sparrenlänge insgesamt (m)
  - first    : First-Länge (m)
  - walm     : Walmlänge (m, 0 wenn kein Walm)
  - neigung  : Dachneigung (°)
  - ausrichtung: "Süd" | "SW" | ...
  - obstacles: List[{type, x_m, y_m, w_m, h_m, label?}] — Sperrflächen
  - modules  : List[{x_m, y_m, w_m, h_m, label?}]      — geplante PV-Module

Alle Längen in Metern. Koordinatensystem: Top-Down (Vogelperspektive),
Ursprung links-unten am Dach (Traufe), x=Trauflänge, y=Tiefe.

K2-Base-Layer-Konvention (DXF):
  K2_OUTLINE       (1, red)    — Außenkontur Dach
  K2_RIDGE         (5, blue)   — First
  K2_EAVE          (3, green)  — Traufe
  K2_HIP           (6, mag)    — Walm
  K2_DIM           (2, yellow) — Bemaßungspfeile + Texte
  K2_OBSTACLE      (1, red)    — VERBOTSZONEN (Solid Hatch)
  K2_LABEL         (7, white)  — Labels
  K2_MODULE        (4, cyan)   — geplante Module
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from io import BytesIO
import math
import logging

import ezdxf
from ezdxf.enums import TextEntityAlignment
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, black, white, HexColor

logger = logging.getLogger("blueprint")

# ====================== PLAUSIBILITÄTS-VALIDATOR ======================
# Prüft Geometrie-Konsistenz vor dem Export — verhindert "kaputte" DXFs.

class BlueprintValidationError(Exception):
    pass

@dataclass
class ValidationIssue:
    severity: str       # "error" | "warning" | "info"
    code: str
    message: str
    field: Optional[str] = None

def validate_blueprint(data: "RoofBlueprintData") -> List[ValidationIssue]:
    """
    Plausibilitäts-Check für Roof-Daten und Sperrflächen.
    Gibt eine Liste von Issues zurück (errors blocken, warnings nur informativ).
    """
    issues: List[ValidationIssue] = []

    L, B, F, W = data.laenge, data.breite, data.first, data.walm

    # --- Maße im realistischen Rahmen ---
    if L <= 0 or B <= 0 or F <= 0:
        issues.append(ValidationIssue("error", "DIM_NEGATIVE",
            "Trauflänge, Tiefe und First müssen > 0 sein.", "laenge"))
    if L < 1 or L > 100:
        issues.append(ValidationIssue("warning", "DIM_OUT_OF_RANGE",
            f"Trauflänge {L}m liegt außerhalb des plausiblen Bereichs (1–100m).", "laenge"))
    if B < 1 or B > 50:
        issues.append(ValidationIssue("warning", "DIM_OUT_OF_RANGE",
            f"Tiefe {B}m liegt außerhalb des plausiblen Bereichs (1–50m).", "breite"))

    # --- First darf nicht länger als Trauflänge sein (außer bei Pultdach) ---
    if F > L + 0.05:
        issues.append(ValidationIssue("error", "RIDGE_LONGER_THAN_EAVE",
            f"First ({F}m) ist länger als Trauflänge ({L}m). Geometrisch unmöglich.", "first"))

    # --- Walm-Konsistenz ---
    if W > 0 and F >= L - 0.01:
        issues.append(ValidationIssue("warning", "WALM_BUT_NO_OFFSET",
            "Walmdach angegeben, aber First gleich Trauflänge — keine Walm-Verkürzung.", "walm"))
    if W < 0:
        issues.append(ValidationIssue("error", "WALM_NEGATIVE",
            f"Walm darf nicht negativ sein ({W}m).", "walm"))
    if W > B / 2:
        issues.append(ValidationIssue("warning", "WALM_TOO_DEEP",
            f"Walm ({W}m) ist tiefer als die halbe Dach-Tiefe ({B/2}m).", "walm"))

    # --- Pitch-Plausibilität ---
    if data.neigung < 0 or data.neigung > 75:
        issues.append(ValidationIssue("error", "PITCH_OUT_OF_RANGE",
            f"Pitch {data.neigung}° unrealistisch (gültig: 0–75°).", "neigung"))
    elif data.neigung < 5:
        issues.append(ValidationIssue("info", "PITCH_FLAT",
            f"Pitch {data.neigung}° ist quasi-flach — Sonderkonstruktion?", "neigung"))

    # --- Sperrflächen müssen INNERHALB der Dachfläche liegen ---
    for i, obs in enumerate(data.obstacles):
        if obs.x_m < -0.01 or obs.y_m < -0.01:
            issues.append(ValidationIssue("error", "OBSTACLE_OUTSIDE_NEG",
                f"Sperrfläche #{i+1} ({obs.label or obs.type}) liegt außerhalb (x={obs.x_m:.2f}, y={obs.y_m:.2f}).",
                f"obstacle[{i}]"))
        if obs.x_m + obs.w_m > L + 0.01:
            issues.append(ValidationIssue("error", "OBSTACLE_OVERFLOW_X",
                f"Sperrfläche #{i+1} ({obs.label or obs.type}) ragt rechts aus dem Dach heraus "
                f"({obs.x_m + obs.w_m:.2f}m > Trauflänge {L}m).",
                f"obstacle[{i}]"))
        if obs.y_m + obs.h_m > B + 0.01:
            issues.append(ValidationIssue("error", "OBSTACLE_OVERFLOW_Y",
                f"Sperrfläche #{i+1} ({obs.label or obs.type}) ragt nach hinten aus dem Dach "
                f"({obs.y_m + obs.h_m:.2f}m > Tiefe {B}m).",
                f"obstacle[{i}]"))
        if obs.w_m <= 0 or obs.h_m <= 0:
            issues.append(ValidationIssue("error", "OBSTACLE_ZERO_SIZE",
                f"Sperrfläche #{i+1} hat Größe 0 (w={obs.w_m}, h={obs.h_m}).",
                f"obstacle[{i}]"))
        # Sperrfläche darf nicht > 60% der Dachfläche sein
        ratio = (obs.w_m * obs.h_m) / max(L * B, 0.01)
        if ratio > 0.6:
            issues.append(ValidationIssue("warning", "OBSTACLE_HUGE",
                f"Sperrfläche #{i+1} belegt {ratio*100:.0f}% des Daches — wirkt unrealistisch.",
                f"obstacle[{i}]"))

    # --- Sperrflächen-Überschneidungen ---
    for i in range(len(data.obstacles)):
        for j in range(i + 1, len(data.obstacles)):
            a, b = data.obstacles[i], data.obstacles[j]
            if (a.x_m < b.x_m + b.w_m and a.x_m + a.w_m > b.x_m and
                a.y_m < b.y_m + b.h_m and a.y_m + a.h_m > b.y_m):
                issues.append(ValidationIssue("warning", "OBSTACLE_OVERLAP",
                    f"Sperrflächen #{i+1} ({a.label or a.type}) und #{j+1} ({b.label or b.type}) überlappen sich.",
                    None))

    # --- PV-Module dürfen nicht IN Sperrflächen liegen ---
    for k, m in enumerate(data.modules):
        for i, obs in enumerate(data.obstacles):
            if (m.x_m < obs.x_m + obs.w_m and m.x_m + m.w_m > obs.x_m and
                m.y_m < obs.y_m + obs.h_m and m.y_m + m.h_m > obs.y_m):
                issues.append(ValidationIssue("error", "MODULE_IN_KEEPOUT",
                    f"Modul #{k+1} liegt in Sperrfläche #{i+1} ({obs.label or obs.type}).",
                    f"module[{k}]"))

    return issues

def has_blocking_errors(issues: List[ValidationIssue]) -> bool:
    return any(i.severity == "error" for i in issues)


# ====================== DOMAIN MODEL ======================

@dataclass
class Obstacle:
    type: str            # "chimney" | "skylight" | "vent" | "dormer"
    x_m: float           # links-unten x (m)
    y_m: float           # links-unten y (m)
    w_m: float
    h_m: float
    label: Optional[str] = None

@dataclass
class PvModule:
    x_m: float
    y_m: float
    w_m: float = 1.722
    h_m: float = 1.134
    label: Optional[str] = None

@dataclass
class ScaffoldingOverlay:
    """Optionale Gerüst-Annotation für Blueprint-Export."""
    flaeche_m2: float
    hoehe_traufe: float
    hoehe_geruest: float
    laenge_geruest: float
    lastklasse: str = "3"


@dataclass
class RoofBlueprintData:
    project_title: str
    customer_name: str
    address: str
    laenge: float                   # Trauflänge (Roof X-Length)
    breite: float                   # Sparrenlänge (Roof Y-Depth, gesamt — Doppelpult oder Pult)
    first: float                    # First-Länge (oben)
    walm: float = 0.0
    neigung: float = 35.0           # ° Pitch
    ausrichtung: str = "Süd"
    obstacles: List[Obstacle] = field(default_factory=list)
    modules: List[PvModule] = field(default_factory=list)
    company_name: str = "Solar Mitte GmbH"
    scaffolding: Optional[ScaffoldingOverlay] = None    # Optional: Gerüst-Overlay

    @property
    def is_hipped(self) -> bool:
        return self.walm > 0.01

    @property
    def is_gable(self) -> bool:
        return abs(self.first - self.laenge) < 0.05 and not self.is_hipped


# ====================== DXF (CAD) EXPORT ======================
# K2-Base-konformer Layer-Aufbau (Goldstandard für K2-Importe)
# Diese Layer-Namen werden von K2 Base ohne Umbenennen direkt erkannt.

DXF_LAYERS = {
    "K2_OUTLINE":     {"color": 1,  "lineweight": 50},   # red, dick — Außenkontur Dach
    "K2_RIDGE":       {"color": 5,  "lineweight": 35},   # blue       — First
    "K2_EAVE":        {"color": 3,  "lineweight": 35},   # green      — Traufe
    "K2_HIP":         {"color": 6,  "lineweight": 35},   # magenta    — Walm
    "K2_DIM":         {"color": 2,  "lineweight": 18},   # yellow     — Bemaßungen
    "K2_OBSTACLE":    {"color": 1,  "lineweight": 50},   # red        — VERBOTSZONE (KEEP-OUT)
    "K2_LABEL":       {"color": 7,  "lineweight": 18},   # white      — Beschriftungen
    "K2_MODULE":      {"color": 4,  "lineweight": 25},   # cyan       — geplante Module
    "K2_SCAFFOLDING": {"color": 8,  "lineweight": 25},   # darkgrey   — Gerüst-Verlauf (DASHED)
}


def _polyline_rect(msp, x0, y0, w, h, layer):
    msp.add_lwpolyline(
        [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h), (x0, y0)],
        dxfattribs={"layer": layer, "closed": True},
    )


def generate_dxf(data: RoofBlueprintData) -> bytes:
    """
    Generiert DXF (R2018) mit K2-Base-konformer Layerstruktur.
    Maßeinheit Meter (INSUNITS=6).
    """
    doc = ezdxf.new(dxfversion="R2018", setup=True)
    doc.units = ezdxf.units.M  # Meter
    doc.header["$INSUNITS"] = 6  # Meter
    doc.header["$MEASUREMENT"] = 1  # metric

    # Layer setup
    for name, attrs in DXF_LAYERS.items():
        layer = doc.layers.add(name)
        layer.color = attrs["color"]
        layer.lineweight = attrs["lineweight"]

    msp = doc.modelspace()

    L = data.laenge
    B = data.breite
    F = data.first
    W = data.walm

    # ---- 1) ROOF_OUTLINE (Top-Down Polygon) ----
    # Bei Walmdach: Trapezform mit eingeschnittenen Walmen.
    # Bei Satteldach: Rechteck.
    if data.is_hipped and W > 0:
        # Trapez Walmdach: First ist kürzer als Trauflänge
        offset = (L - F) / 2 if F < L else 0
        outline = [
            (0, 0), (L, 0),                  # Traufe unten
            (L - offset, B), (offset, B),    # First oben (verkürzt durch Walm)
            (0, 0),
        ]
    else:
        outline = [(0, 0), (L, 0), (L, B), (0, B), (0, 0)]
    msp.add_lwpolyline(outline, dxfattribs={"layer": "K2_OUTLINE", "closed": True})

    # ---- 2) Eaves / Ridge / Hips als separate Linien ----
    msp.add_line((0, 0), (L, 0), dxfattribs={"layer": "K2_EAVE"})
    if data.is_hipped and W > 0:
        offset = (L - F) / 2 if F < L else 0
        msp.add_line((offset, B), (L - offset, B), dxfattribs={"layer": "K2_RIDGE"})
        msp.add_line((0, 0), (offset, B), dxfattribs={"layer": "K2_HIP"})
        msp.add_line((L, 0), (L - offset, B), dxfattribs={"layer": "K2_HIP"})
    else:
        msp.add_line((0, B), (L, B), dxfattribs={"layer": "K2_RIDGE"})

    # ---- 3) K2_MODULE (geplante Belegung) ----
    for m in data.modules:
        _polyline_rect(msp, m.x_m, m.y_m, m.w_m, m.h_m, "K2_MODULE")

    # ---- 4) K2_OBSTACLE — KEEP-OUT ZONEN (Killer-Feature) ----
    # K2 Base liest diesen Layer und exkludiert die Bereiche aus der Modul-Belegung.
    for obs in data.obstacles:
        _polyline_rect(msp, obs.x_m, obs.y_m, obs.w_m, obs.h_m, "K2_OBSTACLE")
        hatch = msp.add_hatch(color=1, dxfattribs={"layer": "K2_OBSTACLE"})
        hatch.set_pattern_fill("ANSI31", scale=0.05)
        hatch.paths.add_polyline_path(
            [(obs.x_m, obs.y_m),
             (obs.x_m + obs.w_m, obs.y_m),
             (obs.x_m + obs.w_m, obs.y_m + obs.h_m),
             (obs.x_m, obs.y_m + obs.h_m)],
            is_closed=True,
        )
        label = obs.label or obs.type.upper()
        msp.add_text(
            f"KEEP-OUT: {label}",
            dxfattribs={"layer": "K2_LABEL", "height": 0.15, "color": 7},
        ).set_placement(
            (obs.x_m + obs.w_m / 2, obs.y_m + obs.h_m / 2),
            align=TextEntityAlignment.MIDDLE_CENTER,
        )

    # ---- 5) K2_DIM — Maßketten ----
    dim1 = msp.add_aligned_dim(
        p1=(0, -1.0), p2=(L, -1.0), distance=0.4,
        dxfattribs={"layer": "K2_DIM"},
    )
    dim1.render()
    if data.is_hipped:
        offset = (L - F) / 2 if F < L else 0
        dim_first = msp.add_aligned_dim(
            p1=(offset, B + 1.0), p2=(L - offset, B + 1.0), distance=0.4,
            dxfattribs={"layer": "K2_DIM"},
        )
        dim_first.render()
    dim2 = msp.add_aligned_dim(
        p1=(-1.0, 0), p2=(-1.0, B), distance=0.4,
        dxfattribs={"layer": "K2_DIM"},
    )
    dim2.render()

    # ---- 6) K2_LABEL — Pitch, Ausrichtung, Norden ----
    msp.add_text(
        f"PITCH: {data.neigung}°  |  AUSRICHTUNG: {data.ausrichtung}",
        dxfattribs={"layer": "K2_LABEL", "height": 0.25, "color": 7},
    ).set_placement((L / 2, B + 2.5), align=TextEntityAlignment.MIDDLE_CENTER)

    nx, ny = L + 2.5, B / 2
    msp.add_line((nx, ny - 1), (nx, ny + 1), dxfattribs={"layer": "K2_LABEL"})
    msp.add_line((nx, ny + 1), (nx - 0.3, ny + 0.5), dxfattribs={"layer": "K2_LABEL"})
    msp.add_line((nx, ny + 1), (nx + 0.3, ny + 0.5), dxfattribs={"layer": "K2_LABEL"})
    msp.add_text(
        "N",
        dxfattribs={"layer": "K2_LABEL", "height": 0.4, "color": 7},
    ).set_placement((nx, ny + 1.4), align=TextEntityAlignment.MIDDLE_CENTER)

    msp.add_text(
        f"SOLAR MITTE  |  {data.project_title}",
        dxfattribs={"layer": "K2_LABEL", "height": 0.3, "color": 7},
    ).set_placement((0, -3), align=TextEntityAlignment.LEFT)
    msp.add_text(
        f"Kunde: {data.customer_name}   |   {data.address}",
        dxfattribs={"layer": "K2_LABEL", "height": 0.2, "color": 7},
    ).set_placement((0, -3.6), align=TextEntityAlignment.LEFT)

    # ---- 7) K2_SCAFFOLDING — Gerüst-Verlauf um den Dachumriss ----
    # Gestrichelte Polyline (Linetype DASHED2) mit 1.0m seitlichem Offset
    # gemäß Gerüst-Kalkulation. Annotiert mit "GERÜST: m² (Lastklasse, h_T)".
    if data.scaffolding:
        # DASHED2-Linetype sicherstellen
        if "DASHED2" not in doc.linetypes:
            doc.linetypes.add("DASHED2", pattern="A,0.5,-0.25,0.5,-0.25", description="Dashed double")
        SC_OFFSET = 1.0  # m seitlicher Überstand
        # Polygon um Dach: Sattel/Walm vs. Pult anders, vereinfachen wir hier auf Rechteck-Hülle
        scaff_outline = [
            (-SC_OFFSET, -SC_OFFSET),
            (L + SC_OFFSET, -SC_OFFSET),
            (L + SC_OFFSET, B + SC_OFFSET),
            (-SC_OFFSET, B + SC_OFFSET),
            (-SC_OFFSET, -SC_OFFSET),
        ]
        msp.add_lwpolyline(scaff_outline, dxfattribs={
            "layer": "K2_SCAFFOLDING",
            "linetype": "DASHED2",
            "closed": True,
        })
        # Annotation oben links
        sc = data.scaffolding
        msp.add_text(
            f"GERÜST: {sc.flaeche_m2:.1f} m²  |  Lastklasse {sc.lastklasse}  |  h_T={sc.hoehe_traufe:.2f}m",
            dxfattribs={"layer": "K2_SCAFFOLDING", "height": 0.22, "color": 8},
        ).set_placement((-SC_OFFSET, B + SC_OFFSET + 0.5),
                         align=TextEntityAlignment.LEFT)

    # Output to bytes
    buf = BytesIO()
    text_buf = BytesIO()
    # ezdxf.write requires a text stream
    import io as _io
    text_stream = _io.StringIO()
    doc.write(text_stream)
    return text_stream.getvalue().encode("utf-8")


# ====================== PDF (Vektor-Blueprint) ======================
# Polycam-Style: weißer BG, schwarze Linien, Bemaßung, Solar-Mitte-Header

def generate_pdf_blueprint(data: RoofBlueprintData, project_number: Optional[str] = None,
                            author: Optional[str] = None, confidence: Optional[float] = None) -> bytes:
    """
    A3 Vektor-Blueprint im Solar-Mitte-Branding.
    project_number: optionale HERO/Projekt-Nummer im Titelblock.
    author: Ersteller des Plans (für Titelblock).
    confidence: Wenn < 0.8, wird oben ein gelbes "Bitte verifizieren"-Banner gezeichnet.
    """
    buf = BytesIO()
    pw, ph = landscape(A3)  # 420 x 297 mm
    c = canvas.Canvas(buf, pagesize=landscape(A3))

    # ---- Header ----
    GREEN = HexColor("#00C853")
    YELLOW = HexColor("#FFD600")
    NAVY = HexColor("#0A1628")

    # Header-Balken
    c.setFillColor(NAVY)
    c.rect(0, ph - 22 * mm, pw, 22 * mm, fill=1, stroke=0)
    # Brand-Streifen
    c.setFillColor(GREEN)
    c.rect(0, ph - 24 * mm, pw * 0.6, 2 * mm, fill=1, stroke=0)
    c.setFillColor(YELLOW)
    c.rect(pw * 0.6, ph - 24 * mm, pw * 0.4, 2 * mm, fill=1, stroke=0)

    # Logo-Text (vereinfacht — der Logo-SVG steckt im Frontend)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(15 * mm, ph - 14 * mm, "SOLAR")
    c.setFillColor(YELLOW)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(48 * mm, ph - 14 * mm, "MITTE")

    # Title
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(85 * mm, ph - 12 * mm, "DACH-BLUEPRINT")
    c.setFont("Helvetica", 10)
    c.drawString(85 * mm, ph - 18 * mm,
                 f"Projekt: {data.project_title}   |   Kunde: {data.customer_name}")

    # Datum + Projektnummer + Author oben rechts (Titelblock)
    from datetime import datetime
    c.setFont("Helvetica", 9)
    c.drawRightString(pw - 15 * mm, ph - 8 * mm, datetime.now().strftime("%d.%m.%Y · %H:%M"))
    if project_number:
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(YELLOW)
        c.drawRightString(pw - 15 * mm, ph - 14 * mm, f"PROJEKT: {project_number}")
        c.setFillColor(white)
    if author:
        c.setFont("Helvetica", 8)
        c.drawRightString(pw - 15 * mm, ph - 19 * mm, f"Erstellt: {author}")
    c.setFont("Helvetica", 8)
    c.drawRightString(pw - 15 * mm, ph - 23 * mm, data.address)

    # Confidence-Banner (gelb), wenn KI < 80% sicher
    if confidence is not None and confidence < 0.8:
        c.setFillColor(HexColor("#FFF3C4"))
        c.setStrokeColor(HexColor("#E6C200"))
        c.setLineWidth(1.5)
        c.rect(15 * mm, ph - 35 * mm, pw - 30 * mm, 8 * mm, fill=1, stroke=1)
        c.setFillColor(HexColor("#E65100"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(20 * mm, ph - 30.5 * mm,
                     f"⚠ KI-CONFIDENCE NIEDRIG ({confidence*100:.0f}%) — Bitte Maße manuell verifizieren, "
                     f"Hindernis-Erkennung unsicher.")

    # ---- Drawing area ----
    L = data.laenge
    B = data.breite
    F = data.first
    W = data.walm

    # Available canvas (mm), reserve left/right for labels
    margin_left = 30 * mm
    margin_top = 35 * mm
    margin_right = 50 * mm
    margin_bottom = 40 * mm
    avail_w = pw - margin_left - margin_right
    avail_h = ph - margin_top - margin_bottom
    scale = min(avail_w / (L + 4), avail_h / (B + 4))  # mm per meter, with 2m padding each side
    # origin (paper coords) — bottom-left of drawing
    ox = margin_left + 2 * scale  # 2m padding
    oy = margin_bottom + 2 * scale

    def mx(x_m): return ox + x_m * scale
    def my(y_m): return oy + y_m * scale

    # ---- Roof Outline (black, thick) ----
    c.setStrokeColor(black)
    c.setLineWidth(2.5)
    if data.is_hipped and W > 0:
        offset = (L - F) / 2 if F < L else 0
        path = c.beginPath()
        path.moveTo(mx(0), my(0))
        path.lineTo(mx(L), my(0))
        path.lineTo(mx(L - offset), my(B))
        path.lineTo(mx(offset), my(B))
        path.close()
        c.drawPath(path, stroke=1, fill=0)
        # Walm-Diagonalen subtil
        c.setStrokeColor(HexColor("#888"))
        c.setLineWidth(0.7)
        c.setDash(2, 3)
        c.line(mx(0), my(0), mx(offset), my(B))
        c.line(mx(L), my(0), mx(L - offset), my(B))
        c.setDash()
        c.setStrokeColor(black)
        c.setLineWidth(2.5)
    else:
        c.rect(mx(0), my(0), L * scale, B * scale, stroke=1, fill=0)

    # ---- KEEPOUT zones (red hatched) — mit Auto-ID-Codes ST-01, DF-01, LF-01 ----
    type_prefixes = {
        "chimney": "ST", "skylight": "DF", "vent": "LF",
        "dormer": "GA", "antenna": "AN",
    }
    type_counter: Dict[str, int] = {}
    obstacle_legend = []  # für Legende: [(id, type_label, label), ...]

    # ---- SCAFFOLDING-Linie (gestrichelt, dezentes Blaugrau) ----
    # Vor den KEEPOUTs gezeichnet, damit sie ggf. unten liegt.
    if data.scaffolding:
        SC_OFFSET = 1.0  # m
        c.setStrokeColor(HexColor("#5A6E85"))   # dezentes Blaugrau
        c.setLineWidth(1.0)
        c.setDash(4, 3)
        # Hülle = Bounding-Rect mit Offset
        c.rect(mx(-SC_OFFSET), my(-SC_OFFSET),
               (L + 2 * SC_OFFSET) * scale, (B + 2 * SC_OFFSET) * scale,
               stroke=1, fill=0)
        c.setDash()
        # Annotation oben rechts der Gerüst-Hülle
        sc = data.scaffolding
        c.setFillColor(HexColor("#5A6E85"))
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(mx(-SC_OFFSET) + 4,
                     my(B + SC_OFFSET) + 2,
                     f"GERÜST: {sc.flaeche_m2:.1f} m²  ·  Lastklasse {sc.lastklasse}  ·  h_T = {sc.hoehe_traufe:.2f} m")
        c.setLineWidth(1.4)

    c.setFillColor(HexColor("#FFE5E5"))
    c.setStrokeColor(HexColor("#D32F2F"))
    c.setLineWidth(1.4)
    for obs in data.obstacles:
        prefix = type_prefixes.get(obs.type, "OB")
        type_counter[prefix] = type_counter.get(prefix, 0) + 1
        oid = f"{prefix}-{type_counter[prefix]:02d}"
        obstacle_legend.append((oid, obs.type, obs.label or obs.type))

        c.rect(mx(obs.x_m), my(obs.y_m), obs.w_m * scale, obs.h_m * scale, stroke=1, fill=1)
        # Hatching: kurze 45°-Linien
        c.setStrokeColor(HexColor("#D32F2F"))
        c.setLineWidth(0.4)
        steps = max(int(min(obs.w_m, obs.h_m) * 8), 4)
        for i in range(steps):
            t = i / steps
            c.line(mx(obs.x_m + t * obs.w_m), my(obs.y_m),
                   mx(obs.x_m), my(obs.y_m + t * obs.h_m))
        c.setLineWidth(1.4)
        # ID-Tag (statt nur Label)
        c.setFillColor(HexColor("#D32F2F"))
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(mx(obs.x_m + obs.w_m / 2),
                            my(obs.y_m + obs.h_m / 2) - 2, oid)
        c.setFillColor(HexColor("#FFE5E5"))
        c.setStrokeColor(HexColor("#D32F2F"))

    # ---- PV Modules (cyan) ----
    c.setStrokeColor(HexColor("#0288D1"))
    c.setFillColor(HexColor("#E1F5FE"))
    c.setLineWidth(0.6)
    for m in data.modules:
        c.rect(mx(m.x_m), my(m.y_m), m.w_m * scale, m.h_m * scale, stroke=1, fill=1)

    # ---- DIMENSIONS ----
    c.setStrokeColor(black)
    c.setFillColor(black)
    c.setLineWidth(0.5)
    c.setFont("Helvetica-Bold", 8)

    def dim_h(x1_m, x2_m, y_m, label, side="bottom"):
        y_off = (y_m - 0.7) if side == "bottom" else (y_m + 0.7)
        # Hauptlinie
        c.line(mx(x1_m), my(y_off), mx(x2_m), my(y_off))
        # Pfeile
        for x_m in (x1_m, x2_m):
            c.line(mx(x_m), my(y_off) - 1.5 * mm, mx(x_m), my(y_off) + 1.5 * mm)
        # Label
        mid = (x1_m + x2_m) / 2
        c.drawCentredString(mx(mid), my(y_off) + 1.5 * mm, label)

    def dim_v(x_m, y1_m, y2_m, label, side="left"):
        x_off = (x_m - 0.7) if side == "left" else (x_m + 0.7)
        c.line(mx(x_off), my(y1_m), mx(x_off), my(y2_m))
        for y_m in (y1_m, y2_m):
            c.line(mx(x_off) - 1.5 * mm, my(y_m), mx(x_off) + 1.5 * mm, my(y_m))
        mid = (y1_m + y2_m) / 2
        c.saveState()
        c.translate(mx(x_off) - 3 * mm, my(mid))
        c.rotate(90)
        c.drawCentredString(0, 0, label)
        c.restoreState()

    dim_h(0, L, 0, f"{L:.2f} m", side="bottom")  # Trauflänge
    if data.is_hipped:
        offset = (L - F) / 2 if F < L else 0
        dim_h(offset, L - offset, B, f"First {F:.2f} m", side="top")
    dim_v(0, 0, B, f"{B:.2f} m", side="left")
    if data.is_hipped:
        dim_v(L, 0, B, f"Walm {W:.2f} m", side="right")

    # ---- Pitch + Norden + Ausrichtung ----
    info_x = pw - 45 * mm
    info_y = ph - 50 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(NAVY)
    c.drawString(info_x, info_y, "DACHEIGENSCHAFTEN")
    c.setLineWidth(0.5)
    c.line(info_x, info_y - 2, info_x + 35 * mm, info_y - 2)
    c.setFont("Helvetica", 9)
    c.setFillColor(black)
    rows = [
        ("Trauflänge", f"{L:.2f} m"),
        ("First", f"{F:.2f} m"),
        ("Walm", f"{W:.2f} m" if W > 0 else "—"),
        ("Tiefe", f"{B:.2f} m"),
        ("Pitch", f"{data.neigung}°"),
        ("Ausrichtung", data.ausrichtung),
        ("Fläche", f"{L * B:.1f} m²"),
        ("Sperrflächen", f"{len(data.obstacles)}"),
        ("Module geplant", f"{len(data.modules)}"),
    ]
    for i, (k, v) in enumerate(rows):
        y = info_y - 8 - i * 5 * mm
        c.drawString(info_x, y, k)
        c.drawRightString(info_x + 35 * mm, y, v)

    # ---- Norden ----
    nx = pw - 25 * mm
    ny = 50 * mm
    c.setLineWidth(1.2)
    c.line(nx, ny - 8 * mm, nx, ny + 8 * mm)
    c.line(nx, ny + 8 * mm, nx - 3 * mm, ny + 4 * mm)
    c.line(nx, ny + 8 * mm, nx + 3 * mm, ny + 4 * mm)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(nx, ny + 10 * mm, "N")

    # ---- Legende — automatische Bauteile-Liste mit ID-Codes ----
    leg_x = 15 * mm
    leg_y = 60 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(NAVY)
    c.drawString(leg_x, leg_y, "LEGENDE")
    c.setLineWidth(0.5)
    c.line(leg_x, leg_y - 2, leg_x + 50 * mm, leg_y - 2)

    c.setFont("Helvetica", 7)
    legend_items = [
        ("Dachumriss", black, False, ""),
        ("Sperrfläche (Keep-out)", HexColor("#D32F2F"), True, ""),
        ("PV-Modul (geplant)", HexColor("#0288D1"), True, ""),
        ("Maßlinie", black, False, ""),
    ]
    for i, (label, color, fill, _) in enumerate(legend_items):
        y = leg_y - 6 - i * 4 * mm
        c.setFillColor(color if fill else black)
        c.setStrokeColor(color)
        c.rect(leg_x, y - 1 * mm, 4 * mm, 2 * mm, fill=fill, stroke=1)
        c.setFillColor(black)
        c.drawString(leg_x + 6 * mm, y, label)

    # Bauteile-Liste mit Auto-IDs (ST-01: Schornstein, DF-01: Dachfenster, ...)
    if obstacle_legend:
        bl_y = leg_y - 6 - len(legend_items) * 4 * mm - 5
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(HexColor("#D32F2F"))
        c.drawString(leg_x, bl_y, "ERKANNTE BAUTEILE")
        c.setLineWidth(0.5)
        c.line(leg_x, bl_y - 2, leg_x + 50 * mm, bl_y - 2)
        c.setFont("Helvetica", 7)
        c.setFillColor(black)
        for i, (oid, otype, olabel) in enumerate(obstacle_legend):
            y = bl_y - 6 - i * 3.5 * mm
            c.setFont("Courier-Bold", 7)
            c.setFillColor(HexColor("#D32F2F"))
            c.drawString(leg_x, y, oid)
            c.setFont("Helvetica", 7)
            c.setFillColor(black)
            c.drawString(leg_x + 14 * mm, y, str(olabel))

    # ---- Footer ----
    c.setFillColor(NAVY)
    c.rect(0, 0, pw, 8 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica", 7)
    c.drawString(15 * mm, 3 * mm,
                 f"{data.company_name}  ·  CRM & Field-Service-Plattform  ·  Generiert mit Solar Mitte Blueprint Engine")
    c.drawRightString(pw - 15 * mm, 3 * mm, "Maßstab passend skaliert · Alle Maße in Meter")

    c.showPage()
    c.save()
    return buf.getvalue()


# ====================== OBJ (3D Mesh) ======================
# Parametrisches Dachmodell als 3D-Mesh, geeignet für Blender/SketchUp

def generate_obj(data: RoofBlueprintData) -> Tuple[bytes, bytes]:
    """
    Generiert OBJ + MTL aus Parametern.
    Doppelpult-Dach: 2 Flächen geneigt von Traufe zu First.
    Walmdach: zusätzlich 2 Walm-Dreiecke.
    """
    L = data.laenge
    B = data.breite
    F = data.first
    W = data.walm
    pitch_rad = math.radians(data.neigung)

    # Höhe des Firsts über Traufe (Y-axis = Tiefe, Z-axis = Höhe)
    # B/2 horizontal Tiefe pro Pultseite, Höhe = (B/2) * tan(pitch)
    half_depth = B / 2
    ridge_z = half_depth * math.tan(pitch_rad)

    vertices = []
    faces = []  # 1-indexed for OBJ format

    if data.is_hipped and W > 0:
        offset_x = (L - F) / 2 if F < L else 0
        # 8 Eckpunkte: 4 Traufe, 4 First (verkürzt)
        # Traufe (z=0)
        vertices.extend([
            (0, 0, 0),         # 1: Traufe vorn-links
            (L, 0, 0),         # 2: Traufe vorn-rechts
            (L, B, 0),         # 3: Traufe hinten-rechts
            (0, B, 0),         # 4: Traufe hinten-links
        ])
        # First-Linie (z=ridge_z)
        vertices.extend([
            (offset_x, half_depth, ridge_z),     # 5: First-links
            (L - offset_x, half_depth, ridge_z), # 6: First-rechts
        ])
        # Front Pultseite (Quad)
        faces.append((1, 2, 6, 5))
        # Back Pultseite
        faces.append((3, 4, 5, 6))
        # Walm links (Triangle)
        faces.append((4, 1, 5))
        # Walm rechts
        faces.append((2, 3, 6))
    else:
        # Satteldach (Doppelpult)
        # First läuft längs der x-Achse in der Mitte (y=half_depth)
        vertices.extend([
            (0, 0, 0),                    # 1
            (L, 0, 0),                    # 2
            (L, B, 0),                    # 3
            (0, B, 0),                    # 4
            (0, half_depth, ridge_z),     # 5: First-links
            (L, half_depth, ridge_z),     # 6: First-rechts
        ])
        # Vorderpult (Quad)
        faces.append((1, 2, 6, 5))
        # Rückpult (Quad)
        faces.append((3, 4, 5, 6))
        # Front-Giebel (Dreieck)
        faces.append((1, 5, 4))   # links
        # Right-Giebel
        faces.append((2, 3, 6))   # rechts

    # ---- OBJ schreiben ----
    obj_lines = [
        f"# Solar Mitte Blueprint OBJ Export",
        f"# Project: {data.project_title}",
        f"# Generated: {data.company_name}",
        f"mtllib {data.project_title.replace(' ', '_')}.mtl",
        "o RoofMesh",
    ]
    for v in vertices:
        obj_lines.append(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}")
    obj_lines.append("usemtl SolarMitteRoof")
    obj_lines.append("s off")
    for f in faces:
        if len(f) == 4:
            obj_lines.append(f"f {f[0]} {f[1]} {f[2]} {f[3]}")
        else:
            obj_lines.append(f"f {f[0]} {f[1]} {f[2]}")
    obj_data = "\n".join(obj_lines).encode("utf-8")

    # ---- MTL ----
    mtl_lines = [
        "# Solar Mitte Roof Material",
        "newmtl SolarMitteRoof",
        "Ka 0.1 0.1 0.1",
        "Kd 0.6 0.3 0.2",   # roof-tile-brown
        "Ks 0.2 0.2 0.2",
        "Ns 50",
        "d 1.0",
    ]
    mtl_data = "\n".join(mtl_lines).encode("utf-8")

    return obj_data, mtl_data


# ====================== PNG (Top-Down Render) ======================

def generate_png_topdown(data: RoofBlueprintData, width: int = 2400, height: int = 1700) -> bytes:
    """High-Res PNG-Render des Top-Down-Plans."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    L = data.laenge
    B = data.breite
    F = data.first
    W = data.walm

    margin = 200
    avail_w = width - 2 * margin
    avail_h = height - 2 * margin - 200  # extra space for header
    scale = min(avail_w / (L + 4), avail_h / (B + 4))
    ox = margin + 2 * scale
    oy = height - margin - 2 * scale

    def mx(x_m): return int(ox + x_m * scale)
    def my(y_m): return int(oy - y_m * scale)  # flip Y for image coords

    # Header bar
    draw.rectangle([0, 0, width, 80], fill=(10, 22, 40))
    try:
        # Use default font
        font_big = ImageFont.load_default()
        font_med = ImageFont.load_default()
    except Exception:
        font_big = None
        font_med = None
    draw.text((30, 20), "SOLAR MITTE — DACH-BLUEPRINT", fill=(0, 200, 83), font=font_big)
    draw.text((30, 50), f"{data.project_title}  |  {data.customer_name}", fill=(255, 255, 255), font=font_med)

    # Roof outline
    if data.is_hipped and W > 0:
        offset = (L - F) / 2 if F < L else 0
        poly = [(mx(0), my(0)), (mx(L), my(0)),
                (mx(L - offset), my(B)), (mx(offset), my(B))]
    else:
        poly = [(mx(0), my(0)), (mx(L), my(0)), (mx(L), my(B)), (mx(0), my(B))]
    draw.polygon(poly, outline=(0, 0, 0), width=4)

    # KEEPOUT (rot)
    for obs in data.obstacles:
        x1, y1 = mx(obs.x_m), my(obs.y_m + obs.h_m)
        x2, y2 = mx(obs.x_m + obs.w_m), my(obs.y_m)
        draw.rectangle([x1, y1, x2, y2], fill=(255, 229, 229), outline=(211, 47, 47), width=3)
        # Hatching
        for i in range(0, int((x2 - x1) + (y2 - y1)), 12):
            draw.line([(x1 + i, y1), (x1, y1 + i)], fill=(211, 47, 47), width=1)
        # Label
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        draw.text((cx - 30, cy - 8),
                  (obs.label or obs.type).upper(),
                  fill=(211, 47, 47), font=font_med)

    # PV modules
    for m in data.modules:
        x1, y1 = mx(m.x_m), my(m.y_m + m.h_m)
        x2, y2 = mx(m.x_m + m.w_m), my(m.y_m)
        draw.rectangle([x1, y1, x2, y2], fill=(225, 245, 254), outline=(2, 136, 209), width=2)

    # Dimensions (simple text labels)
    draw.text((mx(L / 2) - 30, my(0) + 15), f"{L:.2f} m", fill=(0, 0, 0), font=font_med)
    draw.text((mx(0) - 80, my(B / 2)), f"{B:.2f} m", fill=(0, 0, 0), font=font_med)

    # Info-Block rechts unten
    info_x, info_y = width - 380, 120
    draw.rectangle([info_x, info_y, width - 30, info_y + 220], outline=(10, 22, 40), width=2)
    rows = [
        f"Trauflänge: {L:.2f} m",
        f"First: {F:.2f} m",
        f"Pitch: {data.neigung}°",
        f"Ausrichtung: {data.ausrichtung}",
        f"Fläche: {L * B:.1f} m²",
        f"Sperrflächen: {len(data.obstacles)}",
        f"Module: {len(data.modules)}",
    ]
    for i, r in enumerate(rows):
        draw.text((info_x + 14, info_y + 14 + i * 28), r, fill=(0, 0, 0), font=font_med)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ====================== HELPER: AUDIT → BLUEPRINT DATA ======================

def from_roof_audit(audit: Dict, customer: Optional[Dict] = None,
                     obstacles_pct: Optional[List[Dict]] = None,
                     modules_pct: Optional[List[Dict]] = None,
                     ) -> RoofBlueprintData:
    """
    Konvertiert ein roof_audits-Dokument (+ optional erkannte Sperrflächen
    aus dem KI-Foto-Aufmaß) in das normalisierte BlueprintData-Modell.

    obstacles_pct: List[{"x":0..1, "y":0..1, "w":0..1, "h":0..1, "type":"chimney"}]
                   (Prozentwerte relativ zur Dachfläche, vom Foto-Audit erkannt)
    """
    L = float(audit.get("laenge", 10))
    B = float(audit.get("breite", 8))

    # Obstacles aus % konvertieren
    obs_list: List[Obstacle] = []
    for o in (obstacles_pct or []):
        obs_list.append(Obstacle(
            type=o.get("type", "obstacle"),
            x_m=float(o.get("x", 0)) * L,
            y_m=float(o.get("y", 0)) * B,
            w_m=float(o.get("w", 0)) * L,
            h_m=float(o.get("h", 0)) * B,
            label=o.get("label"),
        ))

    mod_list: List[PvModule] = []
    for m in (modules_pct or []):
        mod_list.append(PvModule(
            x_m=float(m.get("x", 0)) * L,
            y_m=float(m.get("y", 0)) * B,
            w_m=float(m.get("w_m", audit.get("module_length", 1.722))),
            h_m=float(m.get("h_m", audit.get("module_width", 1.134))),
        ))

    cust_name = (customer or {}).get("name", audit.get("customer_name", "—"))
    cust_addr = ", ".join(
        filter(None, [
            (customer or {}).get("address"),
            (customer or {}).get("city"),
        ])
    ) or "—"

    return RoofBlueprintData(
        project_title=audit.get("title", "Dachaufmaß"),
        customer_name=cust_name,
        address=cust_addr,
        laenge=L,
        breite=B,
        first=float(audit.get("first", L * 0.9)),
        walm=float(audit.get("walm", 0)),
        neigung=float(audit.get("neigung", 35)),
        ausrichtung=audit.get("ausrichtung", "Süd"),
        obstacles=obs_list,
        modules=mod_list,
    )
