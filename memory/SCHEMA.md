# Solar Mitte — Datenmodell-Architektur

## Technologie-Stack (real, nicht Template)
- **Backend:** FastAPI (Python 3.11) + motor (async MongoDB)
- **Datenbank:** MongoDB (document-store, UUID-IDs, keine ObjectIds in API-Responses)
- **Frontend:** Expo React Native (SDK 54)
- **Auth:** JWT (bcrypt hashing, HttpOnly cookies + Bearer token)
- **KI:** Claude Sonnet 4.5 via Emergent LLM Key

## Warum MongoDB (und nicht PostgreSQL)?
Die Solar-CRM-Domäne ist **hochgradig dokumentarisch**: Kunden mit beliebigen Notizen, Aufmaße mit ad-hoc Feldern, Fotos als Blobs, Inventar-Artikel mit herstellerspezifischen Attributen. MongoDB hat hier klare Vorteile:

1. **Schemaflexibilität:** Jeder Hersteller hat andere Datenblatt-Felder. Wir müssen nicht bei jeder neuen Modulmarke ALTER TABLE fahren.
2. **Embedded documents:** Ein Projekt kann Audits, Fotos, Notizen inline halten — weniger Joins, schneller.
3. **Already deployed:** Die App läuft produktiv mit 5 Kunden, Aufmaßen, Terminen, Bautagebuch, Fotos.

Für **streng transaktionale Workflows** (Rechnungsläufe, Buchhaltung) würde man später einen PG-Adapter anbauen. Aktuell overkill.

## Collections-Übersicht

### Auth & Firma
| Collection | Zweck |
|-----------|-------|
| `users` | Admin / Planer / Verkäufer / Monteur mit JWT-Login |
| `companies` | Firmenprofile: Briefkopf, Logo, USt-IdNr, IBAN, HRB |

### CRM
| Collection | Zweck |
|-----------|-------|
| `customers` | Leads → Kontakt → Angebot → Vertrag → Installation → Abgeschlossen |
| `projects` | PV-Projekte mit Status-Timeline |
| `appointments` | Termine (installation/survey/service/internal) |
| `tasks` | Projekt-Aufgaben (todo/in_progress/done) |
| `site_logs` | Bautagebuch |
| `photos` | Foto-Doku (Base64) |
| `roof_audits` | Dachaufmaße mit PV-Layout |

### Inventory-Domäne (neu)
| Collection | Typ | Beispiele |
|-----------|-----|-----------|
| `inv_solar_modules` | SolarModule | JA Solar 440W, Jinko 420W |
| `inv_inverters` | Inverter | Sigenergy SigenStor, SMA Sunny Boy |
| `inv_batteries` | Battery | Sigenergy 8 kWh, BYD HVS |
| `inv_mounting_rails` | MountingRail | Schletter Solo, K2 MiniRail |
| `inv_roof_hooks` | RoofHook | K2 SingleHook, Schletter FixZ |
| `inv_screws` | Screw | Edelstahl M8×100, Stockschraube M12 |
| `inv_compatibilities` | **Graph-Kante** | siehe unten |

## Der Kompatibilitäts-Graph

Das Kern-Design-Pattern: **Eine einzige Collection** `inv_compatibilities` modelliert ALLE "passt-zu"-Beziehungen. Statt 15 Join-Tabellen (modul↔schiene, haken↔ziegel, wechselrichter↔speicher, ...) haben wir eine polymorphe Kante:

```json
{
  "id": "uuid",
  "source_type": "roof_hook",
  "source_id": "hook-k2-singlehook-uuid",
  "target_type": "roof_type",
  "target_key": "biberschwanz",
  "relation": "passt_zu",
  "rule_context": "max 2 Lagen bei Biberschwanz",
  "certified_by": "K2 Planungstool"
}
```

### Beispiele
```json
// Modul passt auf Schiene
{ "source_type":"solar_module", "source_id":"jasolar-440", "target_type":"mounting_rail", "target_id":"schletter-solo40", "relation":"passt_zu" }

// Dachhaken für Ziegeltyp
{ "source_type":"roof_hook", "source_id":"k2-singlehook", "target_type":"roof_type", "target_key":"biberschwanz", "relation":"empfohlen" }

// Wechselrichter zwingend für Batterie
{ "source_type":"battery", "source_id":"sigen-8kwh", "target_type":"inverter", "target_id":"sigen-hybrid-10kw", "relation":"erforderlich" }

// Modul eines Herstellers inkompatibel
{ "source_type":"solar_module", "source_id":"modul-x", "target_type":"inverter", "target_id":"inverter-y", "relation":"nicht_empfohlen", "rule_context":"MPPT-Spannung zu niedrig" }
```

### Vorteile
- **Neue Kompatibilitätstypen ohne Schemaänderung:** z.B. `tile_manufacturer` als virtueller Typ (nur `target_key` gesetzt)
- **Bidirektional abfragbar:** `$or: [{source_id: X}, {target_id: X}]` findet alle Partner
- **Regel-Metadaten:** `rule_context`, `certified_by` erlauben Auditierung ("Warum passt das?")
- **Rollen-Semantik über `relation`:** passt_zu / empfohlen / erforderlich / nicht_empfohlen

## Indizes
Werden beim FastAPI-Startup angelegt:
```python
await db.users.create_index("email", unique=True)
await db.inv_solar_modules.create_index("sku", unique=True)
await db.inv_inverters.create_index("sku", unique=True)
# ... usw. pro Inventory-Collection
await db.inv_compatibilities.create_index([("source_type", 1), ("source_id", 1)])
await db.inv_compatibilities.create_index([("target_type", 1), ("target_id", 1)])
await db.inv_compatibilities.create_index([("source_type", 1), ("target_type", 1)])
```

## Rollen & Permissions

| Rolle | Default-Permissions |
|-------|---------------------|
| **admin** | `*` (alles) |
| **planer** | `projects.*`, `audits.*`, `tasks.*`, `site_logs.*`, `inventory.read` |
| **verkaeufer** | `customers.*`, `quotes.*`, `ai.chat`, `projects.read` |
| **monteur** | `tasks.read/update`, `site_logs.create`, `photos.create`, `appointments.read` |

Feingranulare Override via `user.permissions: string[]` (hat Vorrang).

## Migration zu PostgreSQL (falls später nötig)
Das Pydantic-Schema in `/app/backend/models.py` ist 1:1 in SQLAlchemy/Prisma übersetzbar:
- `BaseInventoryItem` → abstrakte Basisklasse / Composition
- `Compatibility` → eine Tabelle mit polymorphen FKs ODER pro (src_type, tgt_type) eine View
- `List[str]` Felder → `JSONB` Spalte oder separate `_tags` Tabelle
- UUID-IDs bleiben gleich (PG `uuid` Typ)
