"""Monteur-Modul: Checklisten + Site-Photos + Signatur + Abnahmeprotokoll PDF."""
from __future__ import annotations
import io
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import base64

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
)
from reportlab.pdfgen import canvas as pdf_canvas

BRAND_GREEN = rl_colors.HexColor("#00C853")
BRAND_DARK = rl_colors.HexColor("#0A1628")


def bom_to_checklist_items(bom: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Wandelt BOM in Installations-Checkliste.
    Phasen orientiert an typischem PV-Workflow:
      1) LADUNG       — Material auf LKW laden (alle Items aus BOM)
      2) UNTERKONSTRUKTION — Schienen, Haken montieren
      3) MODULE       — Module setzen + klemmen
      4) ELEKTRIK     — WR/Optimierer/Speicher anschließen
      5) NETZSEITIG   — Zähleranschluss + Inbetriebnahme
      6) DOKUMENTATION — Fotos + Anmeldung
    """
    items: List[Dict[str, Any]] = []
    seq = 1

    def add(phase: str, title: str, qty: Optional[int] = None, unit: Optional[str] = None, note: Optional[str] = None):
        nonlocal seq
        items.append({
            "seq": seq, "phase": phase, "title": title,
            "qty": qty, "unit": unit, "note": note,
            "status": "todo", "checked_at": None, "checked_by": None,
        })
        seq += 1

    # 1) LADUNG — alle BOM-Positionen einzeln zum Abhaken
    by_cat: Dict[str, List[Dict[str, Any]]] = {}
    for it in bom.get("items", []):
        by_cat.setdefault(it.get("category", "Sonstiges"), []).append(it)

    for cat, its in by_cat.items():
        for it in its:
            add("ladung", f"{it['name']} — {cat}", it.get("qty"), it.get("unit"))

    # 2) UNTERKONSTRUKTION
    add("uk", "Dachhaken anbringen (Sparrenmessung prüfen)")
    add("uk", "Schienen montieren & ausrichten")
    add("uk", "Schienenstöße verschrauben")
    add("uk", "Endkappen aufstecken")

    # 3) MODULE
    n_mod = next((it["qty"] for it in bom.get("items", []) if it.get("name") == "PV-Modul"), 0)
    add("module", f"{n_mod} Module setzen", qty=n_mod, unit="Stk.")
    add("module", "Module mit Mid-/EndClamps fixieren")
    add("module", "DC-Verkabelung Modul-zu-Modul")
    add("module", "Polaritäts-Check pro String")

    # 4) ELEKTRIK
    sys = bom.get("system", "string")
    if sys == "optimized_solaredge":
        add("elektrik", "Power Optimizer pro Modul anschließen", note="1 pro Modul (Voltage-Blocking-Pflicht)")
        add("elektrik", "SolarEdge Home Hub installieren & MPPT-Strings anklemmen")
        add("elektrik", "Pairing & Kommunikation testen (mySolarEdge)")
    elif sys == "micro_hoymiles":
        add("elektrik", "Hoymiles HMS-1600 Microinverter pro 4 Module installieren")
        add("elektrik", "AC-Trunk-Kabel verlegen")
        add("elektrik", "DTU-Pro-S Gateway montieren & ans WLAN anbinden")
    elif sys == "hybrid":
        add("elektrik", "Sigenergy SigenStor Hybrid-Wechselrichter montieren")
        add("elektrik", "SigenBat-Module stapeln & verbinden")
        add("elektrik", "Notstrom-Box & Backup-Lasten anschließen")
    else:
        add("elektrik", "String-Wechselrichter installieren & DC anklemmen")

    add("elektrik", "DC-Freischalter & AC-LS einbauen")
    add("elektrik", "FI/RCD geprüft (Auslösestrom)")
    add("elektrik", "Isolationsmessung Strings (R_iso > 1 MΩ)")

    # 5) NETZSEITIG
    add("netz", "Zählerschrank vorbereiten / Zähler tauschen")
    add("netz", "Wechselrichter ans Netz schalten")
    add("netz", "Erste Erträge prüfen (Inbetriebnahme-Logfile)")

    # 6) DOKUMENTATION
    add("doku", "Foto: Komplettansicht Modulfeld (As-Built)")
    add("doku", "Foto: Wechselrichter-Display mit Erträgen")
    add("doku", "Foto: Zählerschrank")
    add("doku", "Foto: Typenschilder Module / WR / Speicher")
    add("doku", "Marktstammdatenregister-Anmeldung")
    add("doku", "Inbetriebnahmeprotokoll vom Kunden gegenzeichnen")

    return items


PHASE_LABEL = {
    "ladung": "Ladung",
    "uk": "Unterkonstruktion",
    "module": "Module",
    "elektrik": "Elektrik",
    "netz": "Netz & Inbetriebnahme",
    "doku": "Dokumentation",
}


# ============== ABNAHMEPROTOKOLL PDF ==============

def _hf(canvas: pdf_canvas.Canvas, doc, company: dict, project: dict):
    canvas.saveState()
    pw, ph = A4
    canvas.setFillColor(BRAND_DARK)
    canvas.rect(0, ph - 25 * mm, pw, 25 * mm, fill=1, stroke=0)
    canvas.setFillColor(BRAND_GREEN)
    canvas.setFont("Helvetica-Bold", 16)
    canvas.drawString(20 * mm, ph - 12 * mm, "ABNAHMEPROTOKOLL")
    canvas.setFillColor(rl_colors.white)
    canvas.setFont("Helvetica", 9)
    canvas.drawString(20 * mm, ph - 18 * mm, f"Projekt: {project.get('title','')}")
    canvas.drawRightString(pw - 20 * mm, ph - 12 * mm, str(company.get("name") or "Solar Mitte GmbH"))
    canvas.drawRightString(pw - 20 * mm, ph - 18 * mm, datetime.now(timezone.utc).strftime("%d.%m.%Y"))

    # Footer
    canvas.setFillColor(rl_colors.HexColor("#6B7280"))
    canvas.setFont("Helvetica", 7)
    canvas.drawString(20 * mm, 12 * mm, f"{company.get('legal_name') or company.get('name','')} · {company.get('vat_id','')} · IBAN {company.get('iban','')}")
    canvas.drawRightString(pw - 20 * mm, 12 * mm, f"Seite {doc.page}")
    canvas.restoreState()


def generate_protocol_pdf(
    project: Dict[str, Any],
    customer: Dict[str, Any],
    company: Dict[str, Any],
    user: Dict[str, Any],
    checklist: List[Dict[str, Any]],
    photos: List[Dict[str, Any]],
    layout: Optional[Dict[str, Any]],
    bom: Optional[Dict[str, Any]],
    signatures: Dict[str, Any],   # {"customer": {name, image_base64, signed_at}, "installer": {...}}
    location: Optional[Dict[str, float]] = None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=32 * mm, bottomMargin=20 * mm,
        title=f"Abnahmeprotokoll {project.get('title','')}",
    )

    styles = getSampleStyleSheet()
    h_style = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=12, textColor=BRAND_DARK, spaceAfter=3 * mm, spaceBefore=4 * mm)
    body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13, textColor=rl_colors.HexColor("#1F2937"))
    small = ParagraphStyle("sm", fontName="Helvetica", fontSize=8, textColor=rl_colors.HexColor("#6B7280"), leading=11)

    story = []

    # === Eckdaten Tabelle ===
    addr = f"{customer.get('address','') or ''}, {customer.get('zip_code','') or ''} {customer.get('city','') or ''}".strip(", ")
    eck_data = [
        ["Auftraggeber", str(customer.get("name") or "—")],
        ["Anschrift", addr or "—"],
        ["Anlage", f"{(layout or {}).get('kwp', '?')} kWp · {(layout or {}).get('modules_count', '?')} Module"],
        ["System", str((bom or {}).get("system", "—"))],
        ["Monteur", str(user.get("name") or "—")],
        ["Abnahme-Datum", datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M Uhr")],
    ]
    if location:
        eck_data.append(["GPS Standort", f"{location.get('lat'):.5f}, {location.get('lng'):.5f} (±{location.get('accuracy',0):.0f}m)"])
    eck_t = Table(eck_data, colWidths=[42 * mm, 128 * mm])
    eck_t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), rl_colors.HexColor("#374151")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [rl_colors.white, rl_colors.HexColor("#F8FAFC")]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, rl_colors.HexColor("#E5E7EB")),
    ]))
    story.append(eck_t)

    # === Checkliste ===
    story.append(Paragraph("Installations-Checkliste (As-Built)", h_style))
    by_phase: Dict[str, List[dict]] = {}
    for it in checklist:
        by_phase.setdefault(it.get("phase", "—"), []).append(it)

    for phase, its in by_phase.items():
        done = sum(1 for x in its if x.get("status") == "done")
        story.append(Paragraph(f"<b>{PHASE_LABEL.get(phase, phase)}</b> &nbsp;·&nbsp; <font color='#00C853'>{done}/{len(its)} erledigt</font>", body))
        rows = [["", "Position", "Status"]]
        for it in its:
            mark = "✓" if it.get("status") == "done" else "○"
            ts = ""
            if it.get("checked_at"):
                try: ts = datetime.fromisoformat(it["checked_at"].replace("Z", "+00:00")).strftime(" (%d.%m. %H:%M)")
                except Exception: ts = ""
            rows.append([mark, str(it.get("title", "")), str(it.get("status", "")) + ts])
        t = Table(rows, colWidths=[8 * mm, 130 * mm, 32 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), rl_colors.HexColor("#F1F5F9")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("TEXTCOLOR", (0, 1), (0, -1), BRAND_GREEN),
            ("FONTSIZE", (0, 1), (0, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, rl_colors.HexColor("#E5E7EB")),
        ]))
        story.append(t)
        story.append(Spacer(1, 2 * mm))

    # === Fotos (Thumbnails 4 pro Reihe) ===
    if photos:
        story.append(Paragraph("Foto-Dokumentation", h_style))
        story.append(Paragraph(f"{len(photos)} As-Built-Fotos mit GPS und Zeitstempel", small))
        # 2x2 Grid für bessere Auflösung
        chunked = [photos[i:i + 2] for i in range(0, len(photos), 2)]
        for chunk in chunked:
            row = []
            for p in chunk:
                try:
                    b64 = p.get("image_base64", "")
                    if "," in b64: b64 = b64.split(",", 1)[1]
                    raw = base64.b64decode(b64)
                    img = Image(io.BytesIO(raw), width=80 * mm, height=60 * mm, kind="proportional")
                    phase = p.get("phase", "—")
                    label = f"<b>{p.get('title','Foto')}</b><br/>Phase: {PHASE_LABEL.get(phase, phase)}"
                    if p.get("created_at"):
                        try:
                            t = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
                            label += f"<br/>{t.strftime('%d.%m.%Y %H:%M')}"
                        except Exception: pass
                    if p.get("gps"):
                        label += f"<br/>GPS: {p['gps'].get('lat',0):.4f}, {p['gps'].get('lng',0):.4f}"
                    row.append([img, Paragraph(label, small)])
                except Exception:
                    row.append(["", Paragraph("(Bild konnte nicht geladen werden)", small)])
            # Pad to 2 columns
            while len(row) < 2:
                row.append(["", ""])
            tbl = Table([[r[0] for r in row], [r[1] for r in row]],
                       colWidths=[85 * mm, 85 * mm])
            tbl.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(tbl)

    # === Bestätigung & Unterschriften ===
    story.append(Paragraph("Abnahme-Erklärung", h_style))
    story.append(Paragraph(
        "Der Auftraggeber bestätigt mit seiner Unterschrift, dass die Anlage vollständig "
        "und mängelfrei installiert wurde. Funktionsprüfung und Einweisung in den "
        "sicheren Betrieb sind erfolgt. Etwaige Restpunkte sind in der Mängelliste "
        "vermerkt. Mit der Unterschrift erkennt der Kunde die Inbetriebnahme der "
        "Photovoltaik-Anlage als ordnungsgemäß abgenommen an.",
        body
    ))
    story.append(Spacer(1, 6 * mm))

    # Signature blocks
    sig_cells = []
    for role_key, role_label in [("customer", "Auftraggeber"), ("installer", "Monteur Solar Mitte")]:
        sig = signatures.get(role_key) if isinstance(signatures, dict) else None
        cell = []
        # Stroke-basierte Signatur (JSON-Liste von Polylines) in ReportLab Drawing rendern
        if sig and sig.get("strokes"):
            try:
                from reportlab.graphics.shapes import Drawing, PolyLine
                w_pts, h_pts = 70 * mm, 22 * mm
                src_w = sig.get("canvas_width", 320) or 320
                src_h = sig.get("canvas_height", 180) or 180
                d = Drawing(w_pts, h_pts)
                sx = w_pts / src_w
                sy = h_pts / src_h
                for stroke in sig["strokes"]:
                    if len(stroke) < 2: continue
                    pts = []
                    for x, y in stroke:
                        pts.append(x * sx)
                        pts.append(h_pts - y * sy)  # Y flippen (PDF Origin unten)
                    d.add(PolyLine(pts, strokeColor=rl_colors.black, strokeWidth=1.2))
                cell.append(d)
            except Exception:
                cell.append(Spacer(1, 22 * mm))
        elif sig and sig.get("image_base64"):
            # Fallback für Image-basierte Signaturen (alter Pfad)
            try:
                b64 = sig["image_base64"]
                if "," in b64: b64 = b64.split(",", 1)[1]
                img = Image(io.BytesIO(base64.b64decode(b64)), width=70 * mm, height=22 * mm, kind="proportional")
                cell.append(img)
            except Exception:
                cell.append(Spacer(1, 22 * mm))
        else:
            cell.append(Spacer(1, 22 * mm))
        cell.append(Paragraph(f"<b>{role_label}</b>", body))
        cell.append(Paragraph(str((sig or {}).get("name", "—")), small))
        if sig and sig.get("signed_at"):
            try:
                t = datetime.fromisoformat(sig["signed_at"].replace("Z", "+00:00"))
                cell.append(Paragraph(f"unterschrieben am {t.strftime('%d.%m.%Y %H:%M')}", small))
            except Exception: pass
        sig_cells.append(cell)

    sig_t = Table([sig_cells], colWidths=[85 * mm, 85 * mm])
    sig_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, BRAND_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_t)

    def _draw(c, d): _hf(c, d, company, project)
    doc.build(story, onFirstPage=_draw, onLaterPages=_draw)
    return buf.getvalue()
