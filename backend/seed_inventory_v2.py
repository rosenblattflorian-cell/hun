"""Erweiterungen zum Seed-Inventar: Solar Fabrik, Hoymiles, SolarEdge.
Wird beim Backend-Startup ausgeführt — fügt nur neue SKUs hinzu (idempotent).
"""
from datetime import datetime, timezone
import uuid

def _id(): return str(uuid.uuid4())
def _now(): return datetime.now(timezone.utc).isoformat()


# ============ MODUL: Solar Fabrik S4 BC 475W ============
SOLAR_FABRIK_S4 = {
    "id": _id(), "sku": "SF-S4-BC-475-FB",
    "manufacturer": "Solar Fabrik", "model": "Mono S4 Halfcut 475W BC (Full Black)",
    "description": "N-Type TOPCon Back-Contact, Full Black, Glas-Glas, Made in Germany",
    "cell_type": "monokristallin", "power_wp": 475, "efficiency_percent": 22.0,
    "length_mm": 1722, "width_mm": 1134, "thickness_mm": 30, "weight_kg": 22.0,
    "voc_v": 39.6, "isc_a": 14.6, "vmpp_v": 33.5, "impp_a": 14.18,
    "frame_color": "schwarz", "backsheet_color": "schwarz", "glass_type": "glas_glas",
    "bifacial": False,
    "price_net": 142.0, "stock_quantity": 320, "stock_status": "available",
    "warranty_years": 30, "certifications": ["IEC 61215", "IEC 61730", "VDE", "Made in Germany"],
    "created_at": _now(), "updated_at": _now(),
}

# ============ HOYMILES Microinverter (4 Module pro HMS-1600) ============
HOY_HMS_1600 = {
    "id": _id(), "sku": "HOY-HMS-1600-4T",
    "manufacturer": "Hoymiles", "model": "HMS-1600-4T (4-Modul-Microinverter)",
    "description": "4-Eingang Microinverter, 4×400W DC, integriertes WiFi, AC-seitig 1-phasig",
    "type": "micro", "ac_power_kw": 1.6, "dc_max_power_kw": 1.7,
    "mppt_count": 4, "max_input_voltage_v": 60, "phase": "1-phasig",
    "protection_class": "IP67", "with_battery_interface": False,
    "monitoring": ["WLAN integriert"],
    "price_net": 269.0, "stock_quantity": 40, "stock_status": "available",
    "warranty_years": 12, "certifications": ["VDE-AR-N 4105", "EN 50549", "CE"],
    "modules_per_unit": 4,  # Spezifisch für Microinverter
    "created_at": _now(), "updated_at": _now(),
}

HOY_DTU_PRO = {
    "id": _id(), "sku": "HOY-DTU-PRO-S",
    "manufacturer": "Hoymiles", "model": "DTU-Pro-S (Daten-Gateway)",
    "description": "Zentrale Daten-Übertragungseinheit (DTU) für bis zu 99 Microinverter — Pflichtkomponente bei Hoymiles-Anlagen",
    "type": "micro", "ac_power_kw": 0.0, "dc_max_power_kw": 0.0,
    "mppt_count": 0, "phase": "1-phasig",
    "protection_class": "IP20", "with_battery_interface": False,
    "monitoring": ["WLAN", "LAN", "RS485", "Sub-1G Funk"],
    "price_net": 199.0, "stock_quantity": 25, "stock_status": "available",
    "warranty_years": 5, "certifications": ["CE", "EN 55032"],
    "is_gateway": True,
    "created_at": _now(), "updated_at": _now(),
}

# ============ SOLAREDGE Home Hub + Optimierer ============
SE_HOMEHUB_10 = {
    "id": _id(), "sku": "SE-SE10K-RWS",
    "manufacturer": "SolarEdge", "model": "SE10K-RWS Home Hub (3-phasig, Hybrid)",
    "description": "Home Hub Hybrid-Wechselrichter mit Backup-Funktion und integrierter Optimierer-Logik. ZWINGEND mit Power Optimizern pro Modul.",
    "type": "hybrid", "ac_power_kw": 10.0, "dc_max_power_kw": 13.5,
    "mppt_count": 2, "max_input_voltage_v": 1000, "phase": "3-phasig",
    "protection_class": "IP65", "with_battery_interface": True,
    "monitoring": ["WLAN", "LAN", "Cellular optional"],
    "price_net": 2790.0, "stock_quantity": 10, "stock_status": "available",
    "warranty_years": 12, "certifications": ["VDE-AR-N 4105", "EN 50549", "CE"],
    # SolarEdge-spezifisch:
    "requires_optimizers": True,
    "min_string_modules": 8,        # Voltage-Blocking: zu wenige Module → keine Aktivierung
    "max_string_modules": 25,
    "max_string_power_w": 11250,
    "created_at": _now(), "updated_at": _now(),
}

SE_HOMEHUB_5 = {
    "id": _id(), "sku": "SE-SE5K-RWS",
    "manufacturer": "SolarEdge", "model": "SE5K-RWS Home Hub (1-phasig, Hybrid)",
    "description": "1-phasige Variante für kleinere Anlagen. Mit Optimierer-Pflicht.",
    "type": "hybrid", "ac_power_kw": 5.0, "dc_max_power_kw": 7.75,
    "mppt_count": 2, "max_input_voltage_v": 480, "phase": "1-phasig",
    "protection_class": "IP65", "with_battery_interface": True,
    "monitoring": ["WLAN", "LAN"],
    "price_net": 1990.0, "stock_quantity": 8, "stock_status": "available",
    "warranty_years": 12, "certifications": ["VDE-AR-N 4105", "EN 50549", "CE"],
    "requires_optimizers": True,
    "min_string_modules": 8,
    "max_string_modules": 20,
    "max_string_power_w": 8250,
    "created_at": _now(), "updated_at": _now(),
}

SE_OPTIMIZER_S440 = {
    "id": _id(), "sku": "SE-S440",
    "manufacturer": "SolarEdge", "model": "Power Optimizer S440",
    "description": "Modul-Leistungsoptimierer für 60/72-Zellen-Module bis 440W — pro Modul ein Stück",
    "type": "battery", "ac_power_kw": 0.0, "dc_max_power_kw": 0.44,
    "mppt_count": 1, "phase": "1-phasig",
    "protection_class": "IP68", "with_battery_interface": False,
    "monitoring": [],
    "price_net": 65.0, "stock_quantity": 500, "stock_status": "available",
    "warranty_years": 25, "certifications": ["CE"],
    "max_module_power_w": 440,
    "is_optimizer": True,
    "created_at": _now(), "updated_at": _now(),
}

SE_OPTIMIZER_S500 = {
    "id": _id(), "sku": "SE-S500",
    "manufacturer": "SolarEdge", "model": "Power Optimizer S500",
    "description": "Modul-Leistungsoptimierer für High-Power-Module bis 500W — empfohlen für Solar Fabrik 475W & Trina Vertex 440W+",
    "type": "battery", "ac_power_kw": 0.0, "dc_max_power_kw": 0.5,
    "mppt_count": 1, "phase": "1-phasig",
    "protection_class": "IP68", "with_battery_interface": False,
    "monitoring": [],
    "price_net": 79.0, "stock_quantity": 350, "stock_status": "available",
    "warranty_years": 25, "certifications": ["CE"],
    "max_module_power_w": 500,
    "is_optimizer": True,
    "created_at": _now(), "updated_at": _now(),
}

# ============ Modul-Klemmen (zusätzlich) ============
K2_MIDCLAMP = {
    "id": _id(), "sku": "K2-MID-30-40",
    "manufacturer": "K2 Systems", "model": "MidClamp XS für Rahmenhöhe 30-40mm",
    "description": "Mittelklemme für Modulrahmen 30-40mm — schwarz eloxiert",
    "type": "sechskant", "material": "edelstahl_a2",
    "diameter_mm": 8.0, "length_mm": 35, "head_type": "Hexagon", "package_size": 1,
    "price_net": 2.10, "stock_quantity": 6000, "stock_status": "available",
    "certifications": ["DIN EN 1090"],
    "created_at": _now(), "updated_at": _now(),
}

K2_ENDCLAMP = {
    "id": _id(), "sku": "K2-END-30-40",
    "manufacturer": "K2 Systems", "model": "EndClamp XS für Rahmenhöhe 30-40mm",
    "description": "Endklemme für Modulrahmen 30-40mm — schwarz eloxiert",
    "type": "sechskant", "material": "edelstahl_a2",
    "diameter_mm": 8.0, "length_mm": 35, "head_type": "Hexagon", "package_size": 1,
    "price_net": 2.40, "stock_quantity": 4000, "stock_status": "available",
    "certifications": ["DIN EN 1090"],
    "created_at": _now(), "updated_at": _now(),
}


def get_extension_data():
    return {
        "modules": [SOLAR_FABRIK_S4],
        "inverters": [HOY_HMS_1600, HOY_DTU_PRO, SE_HOMEHUB_10, SE_HOMEHUB_5, SE_OPTIMIZER_S440, SE_OPTIMIZER_S500],
        "screws": [K2_MIDCLAMP, K2_ENDCLAMP],
    }


def build_extension_compatibilities(seed_v1: dict, seed_v2: dict):
    """Verknüpft die neuen Komponenten mit dem bestehenden Inventar."""
    edges = []
    def edge(st, sid, tt, tid=None, tk=None, rel="passt_zu", ctx=None, cert=None):
        edges.append({
            "id": _id(),
            "source_type": st, "source_id": sid,
            "target_type": tt, "target_id": tid, "target_key": tk,
            "relation": rel, "rule_context": ctx, "certified_by": cert,
            "created_at": _now()
        })

    SF = SOLAR_FABRIK_S4
    HMS = HOY_HMS_1600
    DTU = HOY_DTU_PRO
    SE10 = SE_HOMEHUB_10
    SE5 = SE_HOMEHUB_5
    OPT440 = SE_OPTIMIZER_S440
    OPT500 = SE_OPTIMIZER_S500

    # 1) Solar Fabrik S4 ↔ K2 Schienen + Klemmen + alle Wechselrichter
    for r in seed_v1.get("rails", []):
        edge("solar_module", SF["id"], "mounting_rail", r["id"],
             rel="passt_zu", ctx=f"S4 BC (1722×1134mm) passt auf {r['model']}",
             cert="K2 Base Planungstool")
    for inv in seed_v1.get("inverters", []) + [SE10, SE5]:
        edge("solar_module", SF["id"], "inverter", inv["id"],
             rel="passt_zu", ctx="MPPT-Bereich kompatibel mit 475 Wp Modul")

    # 2) Hoymiles HMS-1600 ↔ DTU (PFLICHT-Gateway)
    edge("inverter", HMS["id"], "inverter", DTU["id"],
         rel="erforderlich",
         ctx="Hoymiles-Microinverter benötigen eine DTU für Monitoring & Netz-Konformität",
         cert="Hoymiles Installationshandbuch")
    # HMS ↔ alle Module
    for m in seed_v1.get("modules", []) + [SF]:
        edge("inverter", HMS["id"], "solar_module", m["id"],
             rel="passt_zu",
             ctx=f"4× {m['model']} pro HMS-1600 (max {HMS['ac_power_kw']*1000}W)")

    # 3) SolarEdge Home Hub ↔ Optimierer (PFLICHT pro Modul)
    for se in [SE10, SE5]:
        for opt in [OPT440, OPT500]:
            edge("inverter", se["id"], "inverter", opt["id"],
                 rel="erforderlich",
                 ctx=f"SolarEdge {se['model']} benötigt 1 Optimierer PRO MODUL — Voltage-Blocking ohne Optimierer",
                 cert="SolarEdge System Design Guide")

    # 4) Optimierer ↔ Module (Leistungs-Matching)
    # S440 nur bis 440W
    for m in seed_v1.get("modules", []):
        if m.get("power_wp", 0) <= 440:
            edge("inverter", OPT440["id"], "solar_module", m["id"],
                 rel="passt_zu", ctx=f"{m['power_wp']}W ≤ 440W Optimierer-Limit")
    # S500 für alles bis 500W (inkl. Solar Fabrik 475W)
    for m in seed_v1.get("modules", []) + [SF]:
        edge("inverter", OPT500["id"], "solar_module", m["id"],
             rel="passt_zu", ctx=f"{m['power_wp']}W ≤ 500W — empfohlen für High-Power")
    # S440 ist NICHT für Solar Fabrik 475W geeignet
    edge("inverter", OPT440["id"], "solar_module", SF["id"],
         rel="nicht_empfohlen",
         ctx="475W überschreitet S440 Optimierer-Limit (440W) — S500 nutzen")

    # 5) Mid-/EndClamps ↔ Schienen
    for r in seed_v1.get("rails", []):
        for cl in [K2_MIDCLAMP, K2_ENDCLAMP]:
            edge("mounting_rail", r["id"], "screw", cl["id"],
                 rel="erforderlich",
                 ctx="K2 Klemmen für Modul-Befestigung auf der Schiene",
                 cert="K2 Systems")

    return edges
