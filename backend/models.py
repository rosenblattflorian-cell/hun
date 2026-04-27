"""
Solar Mitte CRM — Domain Models
================================
Separiert von server.py für bessere Wartbarkeit. Alle Modelle nutzen UUID-Strings
(keine Mongo ObjectIds), ISO-Datumsstrings und strikte Enums/Literals.

ARCHITEKTUR
-----------
Wir arbeiten mit dokumentbasiertem MongoDB (motor async).

Collections:
- users              : Auth-Subjekte
- companies          : Firmenprofile (Briefköpfe, Logos, Bankdaten)
- customers          : Endkunden (CRM-Pipeline)
- projects           : PV-Projekte
- appointments       : Termine
- tasks              : Projekt-Aufgaben
- site_logs          : Bautagebuch
- photos             : Foto-Dokumentation
- roof_audits        : Dachaufmaße

Inventory-Domäne:
- inv_solar_modules
- inv_inverters
- inv_batteries
- inv_mounting_rails
- inv_roof_hooks
- inv_screws
- inv_compatibilities : Poly-Edge "Komponente A passt zu Komponente B" (+ Kontext)

Kompatibilitäts-Graph:
Statt N rigide Join-Tabellen pflegen wir eine generische "compatibility" Collection
mit (source_type, source_id) ↔ (target_type, target_id) + optional rule_context.
Das erlaubt:
  - Dachhaken X passt zu Ziegeltyp Y (source=hook, target=tile_type_string)
  - Modul Z passt auf Schiene A (source=module, target=rail)
  - Wechselrichter W kompatibel mit Speicher B
Neue Kompatibilitätstypen erfordern keine Schema-Änderung.
"""

from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, EmailStr, Field
import uuid


def _id() -> str: return str(uuid.uuid4())
def _now() -> str: return datetime.now(timezone.utc).isoformat()


# ==================== COMPANY & USERS ====================

class CompanyProfile(BaseModel):
    """Firmenprofil für Briefköpfe, Angebote, Rechnungen."""
    id: str = Field(default_factory=_id)
    name: str
    legal_name: Optional[str] = None          # GmbH, KG, etc.
    logo_base64: Optional[str] = None
    # Adresse
    street: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    country: str = "DE"
    # Kontakt
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    # Rechtliches / Steuer
    tax_id: Optional[str] = None              # Steuernummer
    vat_id: Optional[str] = None              # USt-IdNr DEXXXXXXXXX
    trade_register: Optional[str] = None      # HRB Nummer
    # Bank
    bank_name: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    # Zertifizierungen
    certifications: List[str] = Field(default_factory=list)  # z.B. ["Meisterbetrieb", "VDE"]
    created_at: str = Field(default_factory=_now)


UserRole = Literal["admin", "planer", "verkaeufer", "monteur"]

class User(BaseModel):
    id: str = Field(default_factory=_id)
    email: EmailStr
    name: str
    password_hash: str
    role: UserRole = "verkaeufer"
    company_id: Optional[str] = None
    phone: Optional[str] = None
    avatar_base64: Optional[str] = None
    # Feingranulare Permissions (optional, überschreiben Rollen-Defaults)
    permissions: List[str] = Field(default_factory=list)
    active: bool = True
    created_at: str = Field(default_factory=_now)
    last_login: Optional[str] = None


# Rollen-Default-Permissions (in der App ausgewertet)
ROLE_PERMISSIONS = {
    "admin":       ["*"],
    "planer":      ["projects.*", "audits.*", "inventory.read", "tasks.*", "site_logs.*"],
    "verkaeufer":  ["customers.*", "quotes.*", "ai.chat", "projects.read"],
    "monteur":     ["tasks.read", "tasks.update", "site_logs.create", "photos.create", "appointments.read"],
}


# ==================== INVENTORY ====================

StockStatus = Literal["available", "low", "out_of_stock", "discontinued"]

class BaseInventoryItem(BaseModel):
    """Gemeinsame Felder aller Inventar-Artikel."""
    id: str = Field(default_factory=_id)
    sku: str                                   # eindeutige Artikelnummer
    manufacturer: str
    model: str                                 # Modellbezeichnung
    description: Optional[str] = None
    image_base64: Optional[str] = None
    datasheet_url: Optional[str] = None
    price_net: Optional[float] = None          # Nettopreis € pro Stück
    stock_quantity: int = 0
    stock_status: StockStatus = "available"
    warranty_years: Optional[int] = None
    certifications: List[str] = Field(default_factory=list)  # TÜV, IEC, VDE
    notes: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class SolarModule(BaseInventoryItem):
    """PV-Module."""
    cell_type: Literal["monokristallin", "polykristallin", "dünnschicht"] = "monokristallin"
    power_wp: int                              # Nennleistung Watt peak
    efficiency_percent: float                  # Wirkungsgrad %
    # Physikalisch
    length_mm: int
    width_mm: int
    thickness_mm: int
    weight_kg: float
    # Elektrisch
    voc_v: Optional[float] = None              # Leerlaufspannung
    isc_a: Optional[float] = None              # Kurzschlussstrom
    vmpp_v: Optional[float] = None
    impp_a: Optional[float] = None
    # Farbe / Optik
    frame_color: Literal["schwarz", "silber"] = "schwarz"
    backsheet_color: Literal["schwarz", "weiss"] = "schwarz"
    glass_type: Literal["einglas", "glas_glas"] = "einglas"
    bifacial: bool = False


class Inverter(BaseInventoryItem):
    """Wechselrichter."""
    type: Literal["string", "hybrid", "micro", "battery"] = "string"
    ac_power_kw: float                         # AC-Nennleistung
    dc_max_power_kw: Optional[float] = None
    mppt_count: int = 2
    max_input_voltage_v: Optional[int] = None
    phase: Literal["1-phasig", "3-phasig"] = "3-phasig"
    protection_class: Optional[str] = None     # IP65, IP66
    with_battery_interface: bool = False       # Hybrid/Batterie-ready
    monitoring: List[str] = Field(default_factory=list)  # WLAN, LAN, RS485


class Battery(BaseInventoryItem):
    """Stromspeicher (z.B. Sigenergy SigenStor, BYD HVS)."""
    chemistry: Literal["LFP", "NMC", "Sonstige"] = "LFP"
    capacity_kwh: float                        # Nutzkapazität
    usable_capacity_kwh: Optional[float] = None
    max_discharge_kw: Optional[float] = None
    max_charge_kw: Optional[float] = None
    cycles: Optional[int] = None               # Zyklen bis 80% SoH
    stackable: bool = False
    min_modules: Optional[int] = None
    max_modules: Optional[int] = None
    emergency_power: bool = False              # Ersatzstrom / Notstrom
    operating_temp_range_c: Optional[str] = None  # "-10 bis +50"


class MountingRail(BaseInventoryItem):
    """Montageschienen für Unterkonstruktion."""
    material: Literal["aluminium", "edelstahl"] = "aluminium"
    length_mm: int
    profile: Optional[str] = None              # z.B. "Schletter Solo 40"
    load_capacity_kg_m: Optional[float] = None
    suitable_for: List[str] = Field(default_factory=list)  # ["satteldach","flachdach"]


RoofType = Literal["ziegel", "biberschwanz", "flachziegel", "trapezblech", "schiefer",
                   "welleternit", "blechfalz", "flachdach", "sandwichpanel"]

class RoofHook(BaseInventoryItem):
    """Dachhaken / Stockschrauben-Halter."""
    material: Literal["edelstahl", "aluminium", "verzinkt"] = "edelstahl"
    height_adjustable: bool = False
    max_load_n: Optional[int] = None           # Traglast in Newton
    suitable_roof_types: List[RoofType] = Field(default_factory=list)
    thread_size: Optional[str] = None          # "M10", "M12"


class Screw(BaseInventoryItem):
    """Schrauben, Bolzen, Kleinteile."""
    type: Literal["holzschraube","stockschraube","hammerkopfschraube","sechskant","selbstbohrer"] = "holzschraube"
    material: Literal["edelstahl_a2","edelstahl_a4","verzinkt"] = "edelstahl_a2"
    diameter_mm: float
    length_mm: int
    head_type: Optional[str] = None            # "SK", "ZK", "Flachkopf"
    package_size: int = 100                    # Stück je Verpackung


# ==================== COMPATIBILITY GRAPH ====================

CompatType = Literal[
    "solar_module","inverter","battery","mounting_rail","roof_hook","screw",
    "roof_type",        # virtuell: nur target_key gesetzt, z.B. "biberschwanz"
    "tile_manufacturer" # virtuell: "Erlus", "Creaton"
]

class Compatibility(BaseModel):
    """Generische n:m Kompatibilität.
    Wenn source_type/target_type ein physisches Teil ist, referenziert *_id den Datensatz.
    Wenn es ein virtueller Typ ist (roof_type, tile_manufacturer), reicht *_key.
    """
    id: str = Field(default_factory=_id)
    source_type: CompatType
    source_id: Optional[str] = None
    source_key: Optional[str] = None
    target_type: CompatType
    target_id: Optional[str] = None
    target_key: Optional[str] = None
    relation: Literal["passt_zu","empfohlen","erforderlich","nicht_empfohlen"] = "passt_zu"
    rule_context: Optional[str] = None         # z.B. "max 2 Modulreihen hochkant"
    certified_by: Optional[str] = None         # "Hersteller", "Statik XY"
    created_at: str = Field(default_factory=_now)


# ==================== CREATE-/UPDATE-DTO HELPERS ====================

class CompanyCreate(BaseModel):
    name: str
    legal_name: Optional[str] = None
    street: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    vat_id: Optional[str] = None
    iban: Optional[str] = None
    logo_base64: Optional[str] = None

class InventoryUpdate(BaseModel):
    price_net: Optional[float] = None
    stock_quantity: Optional[int] = None
    stock_status: Optional[StockStatus] = None
    notes: Optional[str] = None

class CompatibilityCreate(BaseModel):
    source_type: CompatType
    source_id: Optional[str] = None
    source_key: Optional[str] = None
    target_type: CompatType
    target_id: Optional[str] = None
    target_key: Optional[str] = None
    relation: Literal["passt_zu","empfohlen","erforderlich","nicht_empfohlen"] = "passt_zu"
    rule_context: Optional[str] = None
    certified_by: Optional[str] = None


# ==================== COLLECTION NAMES ====================

COLL = {
    "users": "users",
    "companies": "companies",
    "customers": "customers",
    "projects": "projects",
    "appointments": "appointments",
    "tasks": "tasks",
    "site_logs": "site_logs",
    "photos": "photos",
    "roof_audits": "roof_audits",
    # Inventory
    "inv_modules": "inv_solar_modules",
    "inv_inverters": "inv_inverters",
    "inv_batteries": "inv_batteries",
    "inv_rails": "inv_mounting_rails",
    "inv_hooks": "inv_roof_hooks",
    "inv_screws": "inv_screws",
    "inv_compat": "inv_compatibilities",
}

INVENTORY_TYPE_TO_COLL = {
    "solar_module": "inv_solar_modules",
    "inverter": "inv_inverters",
    "battery": "inv_batteries",
    "mounting_rail": "inv_mounting_rails",
    "roof_hook": "inv_roof_hooks",
    "screw": "inv_screws",
}
