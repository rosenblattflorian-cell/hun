"""Seed-Daten für Inventar + Kompatibilitäten.
Wird beim Backend-Startup ausgeführt, wenn die Inventar-Collections leer sind.
"""
from datetime import datetime, timezone
import uuid


def _id(): return str(uuid.uuid4())
def _now(): return datetime.now(timezone.utc).isoformat()


# ============ SOLAR MODULE ============
TRINA_VERTEX_S_PLUS = {
    "id": _id(), "sku": "TSM-NEG9R.28-440",
    "manufacturer": "Trina Solar", "model": "Vertex S+ NEG9R.28 440W",
    "description": "N-Type TOPCon Mono Glas-Glas, Doppelglas, Halbzellen",
    "cell_type": "monokristallin", "power_wp": 440, "efficiency_percent": 22.3,
    "length_mm": 1762, "width_mm": 1134, "thickness_mm": 30, "weight_kg": 22.5,
    "voc_v": 38.7, "isc_a": 14.3, "vmpp_v": 32.4, "impp_a": 13.6,
    "frame_color": "schwarz", "backsheet_color": "schwarz", "glass_type": "glas_glas",
    "bifacial": True,
    "price_net": 119.0, "stock_quantity": 240, "stock_status": "available",
    "warranty_years": 25, "certifications": ["IEC 61215", "IEC 61730", "VDE"],
    "created_at": _now(), "updated_at": _now(),
}

JA_SOLAR_JAM54 = {
    "id": _id(), "sku": "JAM54S30-420/MR",
    "manufacturer": "JA Solar", "model": "JAM54S30 420 MR",
    "description": "PERC Mono Halbzellen, 54 Zellen, Mono-Facial",
    "cell_type": "monokristallin", "power_wp": 420, "efficiency_percent": 21.5,
    "length_mm": 1722, "width_mm": 1134, "thickness_mm": 30, "weight_kg": 21.5,
    "voc_v": 37.6, "isc_a": 13.9, "vmpp_v": 31.6, "impp_a": 13.3,
    "frame_color": "schwarz", "backsheet_color": "schwarz", "glass_type": "einglas",
    "bifacial": False,
    "price_net": 99.0, "stock_quantity": 180, "stock_status": "available",
    "warranty_years": 25, "certifications": ["IEC 61215", "IEC 61730"],
    "created_at": _now(), "updated_at": _now(),
}

# ============ INVERTER (Sigenergy SigenStor) ============
SIGEN_INVERTER_8 = {
    "id": _id(), "sku": "SIGEN-EC-8.0-DE",
    "manufacturer": "Sigenergy", "model": "SigenStor EC 8.0 (Hybrid)",
    "description": "Modularer Hybrid-Wechselrichter, AI-optimiert, Notstromfähig, mit integrierter Batterie-Schnittstelle",
    "type": "hybrid", "ac_power_kw": 8.0, "dc_max_power_kw": 12.0,
    "mppt_count": 3, "max_input_voltage_v": 1000, "phase": "3-phasig",
    "protection_class": "IP66", "with_battery_interface": True,
    "monitoring": ["WLAN", "LAN", "4G", "RS485"],
    "price_net": 2890.0, "stock_quantity": 12, "stock_status": "available",
    "warranty_years": 10, "certifications": ["VDE-AR-N 4105", "EN 50549", "CE"],
    "created_at": _now(), "updated_at": _now(),
}

SIGEN_INVERTER_10 = {
    "id": _id(), "sku": "SIGEN-EC-10.0-DE",
    "manufacturer": "Sigenergy", "model": "SigenStor EC 10.0 (Hybrid)",
    "description": "10 kW Hybrid-Wechselrichter mit AI-Energie-Management",
    "type": "hybrid", "ac_power_kw": 10.0, "dc_max_power_kw": 15.0,
    "mppt_count": 3, "max_input_voltage_v": 1000, "phase": "3-phasig",
    "protection_class": "IP66", "with_battery_interface": True,
    "monitoring": ["WLAN", "LAN", "4G", "RS485"],
    "price_net": 3290.0, "stock_quantity": 8, "stock_status": "available",
    "warranty_years": 10, "certifications": ["VDE-AR-N 4105", "EN 50549", "CE"],
    "created_at": _now(), "updated_at": _now(),
}

# ============ BATTERY (Sigenergy SigenBat) ============
SIGEN_BAT_5 = {
    "id": _id(), "sku": "SIGEN-BAT-5.0",
    "manufacturer": "Sigenergy", "model": "SigenBat 5.0 (LFP-Modul)",
    "description": "Stapelbares LFP-Batteriemodul, kombinierbar bis 48 kWh",
    "chemistry": "LFP", "capacity_kwh": 5.0, "usable_capacity_kwh": 4.8,
    "max_discharge_kw": 5.0, "max_charge_kw": 5.0, "cycles": 6000,
    "stackable": True, "min_modules": 1, "max_modules": 8,
    "emergency_power": True, "operating_temp_range_c": "-10 bis +50",
    "price_net": 1990.0, "stock_quantity": 20, "stock_status": "available",
    "warranty_years": 10, "certifications": ["IEC 62619", "UN 38.3", "VDE-AR-E 2510-50"],
    "created_at": _now(), "updated_at": _now(),
}

SIGEN_BAT_8 = {
    "id": _id(), "sku": "SIGEN-BAT-8.0",
    "manufacturer": "Sigenergy", "model": "SigenBat 8.0 (LFP-Modul)",
    "description": "Hochkapazitäts-LFP-Modul mit BMS, IP66",
    "chemistry": "LFP", "capacity_kwh": 8.0, "usable_capacity_kwh": 7.7,
    "max_discharge_kw": 6.0, "max_charge_kw": 6.0, "cycles": 6000,
    "stackable": True, "min_modules": 1, "max_modules": 6,
    "emergency_power": True, "operating_temp_range_c": "-10 bis +50",
    "price_net": 2890.0, "stock_quantity": 15, "stock_status": "available",
    "warranty_years": 10, "certifications": ["IEC 62619", "UN 38.3", "VDE-AR-E 2510-50"],
    "created_at": _now(), "updated_at": _now(),
}

# ============ MOUNTING RAILS (K2 Systems) ============
K2_SINGLERAIL_36 = {
    "id": _id(), "sku": "K2-SR-36-3300",
    "manufacturer": "K2 Systems", "model": "SingleRail 36 (3300mm)",
    "description": "Einzelschiene Aluminium für PV-Module, 3300mm",
    "material": "aluminium", "length_mm": 3300, "profile": "SingleRail 36 X 40",
    "load_capacity_kg_m": 25.0, "suitable_for": ["satteldach", "walmdach", "pultdach"],
    "price_net": 28.5, "stock_quantity": 320, "stock_status": "available",
    "warranty_years": 12, "certifications": ["DIN EN 1090", "Eurocode"],
    "created_at": _now(), "updated_at": _now(),
}

K2_SOLIDRAIL_40 = {
    "id": _id(), "sku": "K2-SOL-40-4400",
    "manufacturer": "K2 Systems", "model": "SolidRail 40 (4400mm)",
    "description": "Hochlast-Doppelschiene, 4400mm — für hohe Schneelasten",
    "material": "aluminium", "length_mm": 4400, "profile": "SolidRail 40",
    "load_capacity_kg_m": 38.0, "suitable_for": ["satteldach", "flachdach"],
    "price_net": 42.9, "stock_quantity": 180, "stock_status": "available",
    "warranty_years": 12, "certifications": ["DIN EN 1090", "Eurocode"],
    "created_at": _now(), "updated_at": _now(),
}

# ============ ROOF HOOKS (K2 Systems) ============
K2_SINGLEHOOK = {
    "id": _id(), "sku": "K2-SH-2S",
    "manufacturer": "K2 Systems", "model": "SingleHook 2S (verstellbar)",
    "description": "Höhenverstellbarer Edelstahl-Dachhaken für Pfannen-/Frankfurter Ziegel",
    "material": "edelstahl", "height_adjustable": True, "max_load_n": 4500,
    "suitable_roof_types": ["ziegel", "flachziegel"],
    "thread_size": "M10",
    "price_net": 8.9, "stock_quantity": 1500, "stock_status": "available",
    "warranty_years": 12, "certifications": ["DIN EN 1090", "TÜV"],
    "created_at": _now(), "updated_at": _now(),
}

K2_BIBERHOOK = {
    "id": _id(), "sku": "K2-BIBER-3S",
    "manufacturer": "K2 Systems", "model": "BiberHook 3S",
    "description": "Spezial-Dachhaken für Biberschwanz-Ziegel mit Tragblech",
    "material": "edelstahl", "height_adjustable": True, "max_load_n": 3800,
    "suitable_roof_types": ["biberschwanz"],
    "thread_size": "M10",
    "price_net": 11.5, "stock_quantity": 600, "stock_status": "available",
    "warranty_years": 12, "certifications": ["DIN EN 1090"],
    "created_at": _now(), "updated_at": _now(),
}

K2_TRAPEZHOOK = {
    "id": _id(), "sku": "K2-TPZ-MK2",
    "manufacturer": "K2 Systems", "model": "MiniFive Trapezblech-Adapter",
    "description": "Aluminium-Adapter für Trapezblechdächer mit Dichtband",
    "material": "aluminium", "height_adjustable": False, "max_load_n": 2800,
    "suitable_roof_types": ["trapezblech", "blechfalz"],
    "thread_size": "M8",
    "price_net": 6.9, "stock_quantity": 800, "stock_status": "available",
    "warranty_years": 10, "certifications": ["DIN EN 1090"],
    "created_at": _now(), "updated_at": _now(),
}

# ============ SCREWS ============
STOCK_M10_200 = {
    "id": _id(), "sku": "STOCK-M10-200-A2",
    "manufacturer": "Würth", "model": "Stockschraube M10 × 200 (A2)",
    "description": "Stockschraube mit Holzgewinde für Sparrenbefestigung",
    "type": "stockschraube", "material": "edelstahl_a2",
    "diameter_mm": 10.0, "length_mm": 200, "head_type": "Doppelgewinde", "package_size": 50,
    "price_net": 1.85, "stock_quantity": 5000, "stock_status": "available",
    "certifications": ["DIN 7998"],
    "created_at": _now(), "updated_at": _now(),
}

HEX_M8_25 = {
    "id": _id(), "sku": "HEX-M8-25-A2",
    "manufacturer": "Würth", "model": "Sechskantschraube M8 × 25 (A2)",
    "description": "Sechskantschraube für Schienenverbindungen",
    "type": "sechskant", "material": "edelstahl_a2",
    "diameter_mm": 8.0, "length_mm": 25, "head_type": "SK", "package_size": 100,
    "price_net": 0.45, "stock_quantity": 12000, "stock_status": "available",
    "certifications": ["DIN 933"],
    "created_at": _now(), "updated_at": _now(),
}


def build_seed_data():
    return {
        "modules": [TRINA_VERTEX_S_PLUS, JA_SOLAR_JAM54],
        "inverters": [SIGEN_INVERTER_8, SIGEN_INVERTER_10],
        "batteries": [SIGEN_BAT_5, SIGEN_BAT_8],
        "rails": [K2_SINGLERAIL_36, K2_SOLIDRAIL_40],
        "hooks": [K2_SINGLEHOOK, K2_BIBERHOOK, K2_TRAPEZHOOK],
        "screws": [STOCK_M10_200, HEX_M8_25],
    }


def build_compatibilities(seed: dict):
    """Erstellt das Kompatibilitäts-Netzwerk."""
    M = {x["sku"]: x for x in seed["modules"]}
    I = {x["sku"]: x for x in seed["inverters"]}
    B = {x["sku"]: x for x in seed["batteries"]}
    R = {x["sku"]: x for x in seed["rails"]}
    H = {x["sku"]: x for x in seed["hooks"]}
    S = {x["sku"]: x for x in seed["screws"]}

    edges = []

    def edge(st, sid, tt, tid=None, tk=None, rel="passt_zu", ctx=None, cert=None):
        edges.append({
            "id": _id(),
            "source_type": st, "source_id": sid,
            "target_type": tt, "target_id": tid, "target_key": tk,
            "relation": rel, "rule_context": ctx, "certified_by": cert,
            "created_at": _now()
        })

    # 1) Sigenergy Inverter ↔ Sigenergy Battery (zwingend nötig)
    for inv in I.values():
        for bat in B.values():
            edge("inverter", inv["id"], "battery", bat["id"],
                 rel="erforderlich",
                 ctx="SigenStor benötigt SigenBat-Module für Hybrid-Betrieb",
                 cert="Sigenergy Hersteller-Spezifikation")

    # 2) Module ↔ Wechselrichter (passt_zu)
    for mod in M.values():
        for inv in I.values():
            edge("solar_module", mod["id"], "inverter", inv["id"],
                 rel="passt_zu",
                 ctx=f"MPPT-Bereich {inv['model']} kompatibel mit {mod['power_wp']} Wp Modul")

    # 3) Module ↔ Schienen (auf welchen Schienen sitzen die Module)
    for mod in M.values():
        for rail in R.values():
            edge("solar_module", mod["id"], "mounting_rail", rail["id"],
                 rel="passt_zu",
                 ctx=f"Modul {mod['width_mm']}mm Breite passt auf {rail['model']}",
                 cert="K2 Base Planungstool")

    # 4) Schienen ↔ Dachhaken (welche Haken tragen welche Schiene)
    for rail in R.values():
        for hook in H.values():
            # Trapez-Adapter geht eher mit SingleRail, BiberHook nicht mit SolidRail
            if hook["sku"] == "K2-TPZ-MK2" and rail["sku"] == "K2-SOL-40-4400":
                continue
            edge("mounting_rail", rail["id"], "roof_hook", hook["id"],
                 rel="passt_zu",
                 ctx="K2-Systemkomponenten — direkt verschraubbar",
                 cert="K2 Systems")

    # 5) Dachhaken ↔ Dachtypen (virtuelle Targets)
    for hook in H.values():
        for rt in hook.get("suitable_roof_types", []):
            edge("roof_hook", hook["id"], "roof_type", tk=rt,
                 rel="empfohlen",
                 ctx=f"{hook['model']} ist für {rt}-Dächer zertifiziert",
                 cert="DIN EN 1090")

    # 6) Stockschraube ↔ Dachhaken K2-SH (M10)
    edge("roof_hook", H["K2-SH-2S"]["id"], "screw", S["STOCK-M10-200-A2"]["id"],
         rel="erforderlich", ctx="M10 Stockschraube für SingleHook-Befestigung",
         cert="K2 Montageanleitung")
    edge("roof_hook", H["K2-BIBER-3S"]["id"], "screw", S["STOCK-M10-200-A2"]["id"],
         rel="erforderlich", ctx="M10 Stockschraube für BiberHook",
         cert="K2 Montageanleitung")

    # 7) Sechskantschraube ↔ Schienen-Verbindung
    for rail in R.values():
        edge("mounting_rail", rail["id"], "screw", S["HEX-M8-25-A2"]["id"],
             rel="empfohlen", ctx="Schienenstoß-Verbindung M8")

    # 8) Trapez-Adapter explizit nicht für Ziegel (negative Kompatibilität)
    edge("roof_hook", H["K2-TPZ-MK2"]["id"], "roof_type", tk="ziegel",
         rel="nicht_empfohlen",
         ctx="Trapez-Adapter ist nur für Blechdächer — nicht für Ziegel")

    return edges
