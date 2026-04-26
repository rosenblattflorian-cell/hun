# Solar Mitte CRM — Datenexport

**Export-Datum:** 2026-04-26 07:08 UTC
**Exportiert von:** admin@solar-mitte.de
**Firma:** Solar Mitte GmbH

## Übersicht
| Datentyp | Anzahl |
|----------|--------|
| Kunden | 5 |
| Dachaufmaße | 0 |
| Projekte | 0 |
| Termine | 0 |

## Kunden (5)

### 1. Familie Schmidt — `angebot`
- 📧 schmidt@example.de · 📞 +49 30 12345678
- 📍 Hauptstraße 12, 10115 Berlin
- ⚡ 9,8 kWp · 💶 24.500 €
- 📝 Einfamilienhaus mit Walmdach

### 2. Bauer GmbH — `installation`
- 📧 info@bauer-gmbh.de · 📞 +49 89 9876543
- 📍 Industriestr. 5, 80331 München
- ⚡ 45,5 kWp · 💶 89.000 €
- 📝 Gewerbehalle, Ausrichtung Süd

### 3. Müller Familie — `lead`
- 📧 mueller@example.de · 📞 +49 40 111222
- 📍 Am See 7, 20095 Hamburg
- ⚡ 7,2 kWp · 💶 18.500 €
- 📝 Erstkontakt, Satteldach

### 4. Fischer KG — `vertrag`
- 📧 fischer@kg.de · 📞 +49 221 333444
- 📍 Domstr. 3, 50667 Köln
- ⚡ 15,4 kWp · 💶 38.000 €
- 📝 Mit Speicher 10 kWh

### 5. Weber Hausverwaltung — `abgeschlossen`
- 📧 weber@hv.de · 📞 +49 69 555666
- 📍 Bankstr. 99, 60311 Frankfurt
- ⚡ 22,0 kWp · 💶 52.000 €
- 📝 Projekt erfolgreich abgeschlossen

**Pipeline-Wert (offen): 170.000 €** · **Gesamt 99,9 kWp geplant**

## Vollständiger JSON-Export
Datei: `/app/export_solar_mitte.json` (1.9 KB)

Live-API-Endpunkt:
```
GET /api/export/all
Authorization: Bearer <token>
```

## In-App Export
In der App: **Mehr → Daten exportieren** kopiert das komplette JSON in die Zwischenablage.
