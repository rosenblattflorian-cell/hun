"""
Solar Mitte — Universal Roof Engine
====================================

Trigonometrie-basierte Berechnung der echten Dach-Geometrie aus 3 Eingaben:
  α  = Dachneigung (°)
  h_T = Traufhöhe (m)         [Boden bis Traufkante]
  h_F = Firsthöhe (m)         [Boden bis Firstpunkt]

Formel (Hypotenuse):
  L = (h_F - h_T) / sin(α)         # Sparrenlänge (m)
  Tiefe_horizontal = L · cos(α)    # Grundriss-Tiefe (m)

Damit kann man:
  - das verzerrte Top-Down-Foto in einen maßstabsgetreuen Plan W × L rektifizieren
  - die KI-erkannten Hindernisse (in % der Bildfläche) auf reale Meter mappen
  - die Gerüst-Kalkulation deterministisch ableiten

Außerdem:
  - Vorschlag des Dachtyps (Sattel/Pult/Walm/Flach) basierend auf Geometrie
  - Gerüst-Kalkulation gemäß DIN/ArbSchG (h_T + 0.7m Sicherheitsüberstand,
    W + 2m seitliche Erweiterung)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
import math


# ======================== UNIVERSAL ROOF ENGINE ========================

@dataclass
class RoofGeometry:
    """Komplette Dach-Geometrie aus den 3 Eingaben."""
    alpha_deg: float        # Dachneigung in °
    h_traufe: float         # Traufhöhe (Bodenniveau → Traufkante) in m
    h_first: float          # Firsthöhe (Bodenniveau → Firstpunkt) in m
    breite_traufe: float    # Trauf-Breite W (m)
    sparrenlaenge: float    # L = (h_F - h_T) / sin(α)  — reale Sparre
    tiefe_horizontal: float # L · cos(α)               — Grundriss-Tiefe
    hoehe_dach: float       # h_F - h_T                — Dachhöhe (Δh)
    flaeche_geneigt: float  # W · L · 2 (Doppelpult)   — geneigte Flächen
    flaeche_grundriss: float# W · Tiefe_horizontal     — Grundriss
    suggested_type: str     # "satteldach"|"pultdach"|"walmdach"|"flachdach"


def compute_roof_geometry(
    alpha_deg: float,
    h_traufe: float,
    h_first: float,
    breite_traufe: float,
    walm_offset: float = 0.0,
) -> RoofGeometry:
    """
    Berechnet die echte Dach-Geometrie. Validiert Inputs.

    Args:
      alpha_deg: 0..90° (0 = flach, 35-50° typisch)
      h_traufe:  Traufhöhe (m) — Boden bis Traufkante
      h_first:   Firsthöhe (m) — Boden bis Firstpunkt (h_first > h_traufe!)
      breite_traufe: W (m) — Trauf-Breite
      walm_offset: Walm-Verkürzung (m, 0 wenn Sattel)

    Raises:
      ValueError bei unplausiblen Werten.
    """
    if alpha_deg < 0 or alpha_deg > 89:
        raise ValueError(f"Dachneigung α={alpha_deg}° unplausibel (0–89°).")
    if h_traufe < 0 or h_first < 0:
        raise ValueError("Höhen dürfen nicht negativ sein.")
    if h_first < h_traufe and alpha_deg > 1:
        raise ValueError(f"Firsthöhe ({h_first}m) muss größer Traufhöhe ({h_traufe}m) sein.")
    if breite_traufe <= 0:
        raise ValueError("Trauf-Breite muss > 0 sein.")

    delta_h = max(h_first - h_traufe, 0.0)
    alpha_rad = math.radians(alpha_deg)

    if alpha_deg < 1.0:
        # Flachdach
        L = 0.0
        tiefe_h_pult = breite_traufe * 0.5
        type_ = "flachdach"
    else:
        # Steildach: L = Δh / sin(α) → eine Pultseite (halbe Sparrenlänge bei Sattel)
        L = delta_h / math.sin(alpha_rad) if delta_h > 0.01 else 0.0
        tiefe_h_pult = L * math.cos(alpha_rad)
        # Heuristik: Pultdach hat nur EINE Pultseite (typisch tief schmal)
        # Sattel/Walm: zwei Pultseiten → doppelte Grundriss-Tiefe
        if walm_offset > 0.01:
            type_ = "walmdach"
        else:
            # Wenn Trauf-Breite >> Tiefe (lang & schmal) → Pultdach plausibel.
            # Bei "normalen" Häusern (W ≈ 2*tiefe_pult) ist es ein Satteldach.
            type_ = "pultdach" if breite_traufe > tiefe_h_pult * 4.0 else "satteldach"

    # Grundriss: Pult = 1 Seite, Sattel/Walm = 2 Seiten
    factor = 1.0 if type_ in ("pultdach", "flachdach") else 2.0
    tiefe_h = tiefe_h_pult * factor
    flaeche_g = breite_traufe * L * factor  # Geneigte Dachfläche
    flaeche_grundriss = breite_traufe * tiefe_h

    return RoofGeometry(
        alpha_deg=alpha_deg, h_traufe=h_traufe, h_first=h_first,
        breite_traufe=breite_traufe, sparrenlaenge=round(L, 3),
        tiefe_horizontal=round(tiefe_h, 3), hoehe_dach=round(delta_h, 3),
        flaeche_geneigt=round(flaeche_g, 2),
        flaeche_grundriss=round(flaeche_grundriss, 2),
        suggested_type=type_,
    )


def rectify_obstacles(
    geometry: RoofGeometry,
    obstacles_pct: List[Dict],
) -> List[Dict]:
    """
    Mappt erkannte Hindernisse (in % des Top-Down-Bildes) auf reale m.
    obstacles_pct: [{"x":0..1, "y":0..1, "w":0..1, "h":0..1, "type":...}]
    Returns: [{"x_m":..., "y_m":..., "w_m":..., "h_m":..., "type":..., "label":...}]

    Konvention: x = entlang Trauflänge (W), y = entlang Sparrenlänge (L).
    """
    W = geometry.breite_traufe
    L = geometry.sparrenlaenge if geometry.sparrenlaenge > 0 else geometry.tiefe_horizontal
    if L <= 0: L = 5.0  # Fallback
    out = []
    for o in obstacles_pct:
        out.append({
            "type": o.get("type", "obstacle"),
            "label": o.get("label"),
            "x_m": float(o.get("x", 0)) * W,
            "y_m": float(o.get("y", 0)) * L,
            "width_m":  float(o.get("w", 0)) * W,
            "height_m": float(o.get("h", 0)) * L,
        })
    return out


# ======================== SCAFFOLDING ENGINE ========================

@dataclass
class ScaffoldingCalc:
    """
    Gerüst-Kalkulation gemäß deutschen Arbeitsschutz-Standards (DIN/ArbSchG).

    Konvention:
      - Gerüsthöhe = h_traufe + 0.70m Sicherheits-Überstand (Stop-Holm)
      - Seitlicher Überstand = 1.0m je Seite (insgesamt +2m auf Trauflänge W)
      - Lastklasse: 3 (Standard für PV — bis 200 kg/m²)
      - Standard-Aufbau: 0.73m breite Arbeitsbühne
    """
    hoehe_geruest_m: float        # h_T + 0.7
    laenge_geruest_m: float       # W + 2.0 (1m je Seite)
    flaeche_m2: float             # h_geruest × l_geruest
    sicherheitsueberstand_m: float = 0.70
    seitlicher_ueberstand_m: float = 1.00
    lastklasse: str = "3 (PV-Standard, ≤ 200 kg/m²)"
    breite_arbeitsbuehne_m: float = 0.73
    norm: str = "DIN EN 12811 / ArbSchG / TRBS 2121-1"
    estimate_eur_min: float = 0.0
    estimate_eur_max: float = 0.0
    aufbau_dauer_tage: float = 0.0


def calculate_scaffolding(
    h_traufe: float,
    breite_traufe: float,
    eur_per_m2_min: float = 6.0,
    eur_per_m2_max: float = 9.0,
    aufbau_per_50m2_tage: float = 0.5,
) -> ScaffoldingCalc:
    """
    Berechnet Gerüst-Bedarf + Kostenrahmen.

    Args:
      h_traufe: Traufhöhe in m
      breite_traufe: Trauf-Breite W in m
      eur_per_m2_*: Preisrahmen (€/m² inkl. Auf-/Abbau, 1 Woche)
      aufbau_per_50m2_tage: 0.5 Tage pro 50 m² (Erfahrungswert)
    """
    if h_traufe <= 0:
        raise ValueError("h_traufe muss > 0 sein.")
    if breite_traufe <= 0:
        raise ValueError("breite_traufe muss > 0 sein.")

    h_geruest = round(h_traufe + 0.70, 2)
    l_geruest = round(breite_traufe + 2.0, 2)
    flaeche = round(h_geruest * l_geruest, 2)

    return ScaffoldingCalc(
        hoehe_geruest_m=h_geruest,
        laenge_geruest_m=l_geruest,
        flaeche_m2=flaeche,
        estimate_eur_min=round(flaeche * eur_per_m2_min, 2),
        estimate_eur_max=round(flaeche * eur_per_m2_max, 2),
        aufbau_dauer_tage=round((flaeche / 50.0) * aufbau_per_50m2_tage, 2),
    )


# ======================== HERO BOM-ITEM für Angebot ========================

def scaffolding_to_bom_item(calc: ScaffoldingCalc) -> Dict:
    """
    Wandelt die Gerüst-Kalkulation in eine Angebotsposition für HERO um.
    Direkt einfügbar in das HERO-BOM-Schema.
    """
    return {
        "category": "Gerüststellung",
        "position": "Standgerüst inkl. Auf-/Abbau (PV-Montage)",
        "menge": calc.flaeche_m2,
        "einheit": "m²",
        "preis_min_eur": calc.estimate_eur_min,
        "preis_max_eur": calc.estimate_eur_max,
        "spec": {
            "hoehe": f"{calc.hoehe_geruest_m} m",
            "laenge": f"{calc.laenge_geruest_m} m",
            "lastklasse": calc.lastklasse,
            "breite_arbeitsbuehne": f"{calc.breite_arbeitsbuehne_m} m",
            "sicherheitsueberstand": f"{calc.sicherheitsueberstand_m} m",
            "norm": calc.norm,
            "aufbau_dauer_tage": calc.aufbau_dauer_tage,
        },
    }
