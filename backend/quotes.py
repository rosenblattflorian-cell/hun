"""KI-Vertriebs-Agent + PDF-Angebotsgenerator.

Pipeline:
1. structure_quote_with_ai()  — Claude Sonnet 4.5 strukturiert die BOM in 4 Solar-Mitte-Sektionen
2. generate_quote_pdf()       — ReportLab erzeugt das fertige PDF im AB-382-Stil
"""
from __future__ import annotations
import io
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image,
)
from reportlab.pdfgen import canvas as pdf_canvas


# ============== AI STRUCTURING ==============

QUOTE_SYSTEM = """Du bist der KI-Angebots-Assistent von Solar Mitte GmbH. Deine Aufgabe ist es,
aus einer technischen Stückliste (BOM) und Kundeninformationen ein professionelles
Angebot in DEUTSCHER Geschäftssprache zu strukturieren.

WICHTIG — du musst AUSSCHLIESSLICH valides JSON zurückgeben, keine Erklärtexte davor oder danach.

Format:
{
  "intro_text": "Sehr geehrte/r ... Anrede + 2-3 Sätze passend zum Projekt (kWp, System, Speicher).",
  "sections": [
    {
      "code": "1", "title": "Anlagenkomponenten",
      "items": [
        {"name":"...", "description":"... mit techn. Details", "qty": 18, "unit":"Stk.", "unit_price_net": 142.0, "total_net": 2556.0}
      ]
    },
    {"code":"2","title":"Sonderpositionen","items":[]},
    {"code":"3","title":"Handwerkerleistung","items":[]},
    {"code":"4","title":"Planungskosten","items":[]}
  ],
  "subtotal_net": 12345.67,
  "discount_label": null,
  "discount_amount": 0,
  "total_net": 12345.67,
  "total_vat": 2345.67,
  "total_gross": 14691.34,
  "delivery_time_weeks": "8-12",
  "validity_days": 30,
  "closing_text": "Wir freuen uns auf Ihre Rückmeldung."
}

REGELN für die Strukturierung:
- Pos. 1 "Anlagenkomponenten": Module, Wechselrichter, Speicher, Optimierer, Microinverter, Unterkonstruktion (Schienen, Haken, Klemmen, Schrauben)
- Pos. 2 "Sonderpositionen": Wallbox, Zählerschrank-Umbau, Notstrom-Box (NUR wenn vom User explizit erwähnt)
- Pos. 3 "Handwerkerleistung": Montage Module + Unterkonstruktion (kalkuliere pauschal pro kWp 280€), Elektro-Anschluss & DC-Verkabelung (pauschal 850€ + 35€ pro Modul)
- Pos. 4 "Planungskosten": Netzanmeldung & Anmeldung Marktstammdatenregister (pauschal 290€), Anlagendokumentation (pauschal 180€)
- Bei Modul-Beschreibung: Hersteller + Modellname + technische Highlights (z.B. "Solar Fabrik Mono S4 Halfcut 475W BC — Full Black, Glas-Glas, Bifazial, 30J Garantie")
- Bei Wechselrichter: Hersteller + Modell + Topologie + Leistung
- Subtotal_net = Summe aller items.total_net
- discount_amount nur setzen wenn User Rabatt erwähnt
- total_net = subtotal_net - discount_amount
- total_vat = round(total_net * 0.19, 2)
- total_gross = total_net + total_vat
- intro_text: Kontextbezug zu kWp und System nehmen (z.B. "Ihre 8.55 kWp SolarEdge-Anlage mit Optimierer-Technologie")
- Wenn der User explizit Rabatt fordert ("5% auf Montage", "10% Rabatt"), wende es korrekt an
- Wenn User Sonderpositionen wünscht, integriere sie in Pos. 2 mit realistischen Preisen (Wallbox 11kW: 850€, 22kW: 1290€, Zählerschrank: 1450€)
"""


async def structure_quote_with_ai(
    bom: Dict[str, Any],
    layout: Dict[str, Any],
    customer: Dict[str, Any],
    user: Dict[str, Any],
    extras: Optional[str] = None,
    discount_request: Optional[str] = None,
    api_key: str = "",
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Sendet BOM+Kontext an Claude und erhält strukturiertes Angebot."""
    payload = {
        "kunde": {
            "anrede": "Sehr geehrte Damen und Herren" if not customer.get("name") else
                      f"Sehr geehrte/r {customer.get('name')}",
            "name": customer.get("name"),
            "adresse": f"{customer.get('address','')}, {customer.get('zip_code','')} {customer.get('city','')}".strip(", "),
        },
        "anlage": {
            "module_count": layout.get("modules_count"),
            "kwp": layout.get("kwp"),
            "rows_cols": f"{layout.get('rows')}×{layout.get('cols_max')}",
            "system": bom.get("system"),
            "modul_leistung_w": bom.get("module_power_w"),
        },
        "stueckliste": [
            {"name": it["name"], "qty": it["qty"], "unit": it["unit"],
             "unit_price_net": it.get("unit_price_net", 0), "total_net": it.get("total_net", 0),
             "category": it.get("category"), "note": it.get("note")}
            for it in bom.get("items", [])
        ],
        "warnungen_validierung": bom.get("warnings", []),
        "user_prompt_extras": extras or "",
        "user_prompt_discount": discount_request or "",
    }

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id or f"quote-{datetime.now().timestamp()}",
        system_message=QUOTE_SYSTEM
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_msg = (
        "Strukturiere das folgende Projekt zu einem Angebot. Antworte NUR mit JSON.\n\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )
    response = await chat.send_message(UserMessage(text=user_msg))

    # JSON-Block extrahieren (falls Claude trotzdem Prosa drumherum schreibt)
    m = re.search(r"\{[\s\S]*\}", response)
    if not m:
        raise ValueError(f"Keine JSON-Antwort vom Modell: {response[:200]}")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON-Parse-Fehler: {e}. Antwort-Anfang: {response[:300]}")


# ============== PDF GENERATOR ==============

def _fmt_eur(n: float) -> str:
    return f"{n:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_qty(n: float) -> str:
    if n == int(n):
        return f"{int(n):,}".replace(",", ".")
    return f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# Solar Mitte Brand Colors (an deine Vorlage angelehnt)
BRAND_GREEN = rl_colors.HexColor("#00C853")
BRAND_DARK = rl_colors.HexColor("#0A1628")
BRAND_TEXT = rl_colors.HexColor("#1F2937")
BRAND_MUTED = rl_colors.HexColor("#6B7280")
BRAND_LIGHT_BG = rl_colors.HexColor("#F8FAFC")
BRAND_BORDER = rl_colors.HexColor("#E5E7EB")


def _header_footer(canvas: pdf_canvas.Canvas, doc, company: Dict[str, Any], user: Dict[str, Any]):
    """Briefkopf oben, Footer mit Firmendaten unten — auf JEDER Seite."""
    canvas.saveState()
    page_width, page_height = A4

    # === Header ===
    canvas.setFillColor(BRAND_DARK)
    canvas.rect(0, page_height - 30 * mm, page_width, 30 * mm, fill=1, stroke=0)
    canvas.setFillColor(BRAND_GREEN)
    canvas.setFont("Helvetica-Bold", 18)
    canvas.drawString(20 * mm, page_height - 15 * mm, str(company.get("name") or "Solar Mitte GmbH").upper())
    canvas.setFillColor(rl_colors.white)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(20 * mm, page_height - 22 * mm, str(company.get("tagline") or "Photovoltaik · Speicher · Wallbox"))
    canvas.drawString(20 * mm, page_height - 26 * mm, str(company.get("website") or "www.solar-mitte.de"))
    # Rechts: Ansprechpartner
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawRightString(page_width - 20 * mm, page_height - 15 * mm, f"Ihr Ansprechpartner")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(page_width - 20 * mm, page_height - 19 * mm, str(user.get("name") or ""))
    canvas.drawRightString(page_width - 20 * mm, page_height - 23 * mm, str(user.get("email") or ""))
    canvas.drawRightString(page_width - 20 * mm, page_height - 27 * mm, str(user.get("phone") or ""))

    # === Footer ===
    footer_top = 25 * mm
    canvas.setStrokeColor(BRAND_GREEN)
    canvas.setLineWidth(1.5)
    canvas.line(20 * mm, footer_top, page_width - 20 * mm, footer_top)

    canvas.setFillColor(BRAND_MUTED)
    canvas.setFont("Helvetica", 7.5)
    col_w = (page_width - 40 * mm) / 4
    cy = footer_top - 4 * mm

    # Spalte 1: Firma
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawString(20 * mm, cy, str(company.get("legal_name") or company.get("name") or "Solar Mitte GmbH"))
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(20 * mm, cy - 3 * mm, str(company.get("street") or ""))
    canvas.drawString(20 * mm, cy - 6 * mm, f"{company.get('zip_code') or ''} {company.get('city') or ''}".strip())
    canvas.drawString(20 * mm, cy - 9 * mm, f"Tel.: {company.get('phone') or ''}")

    # Spalte 2: Steuer & Register
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawString(20 * mm + col_w, cy, "Steuer & Register")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(20 * mm + col_w, cy - 3 * mm, f"USt-IdNr: {company.get('vat_id') or '—'}")
    canvas.drawString(20 * mm + col_w, cy - 6 * mm, f"Steuernr: {company.get('tax_id') or '—'}")
    canvas.drawString(20 * mm + col_w, cy - 9 * mm, f"HRB: {company.get('trade_register') or '—'}")

    # Spalte 3: Bank
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawString(20 * mm + 2 * col_w, cy, "Bankverbindung")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(20 * mm + 2 * col_w, cy - 3 * mm, str(company.get("bank_name") or "—"))
    canvas.drawString(20 * mm + 2 * col_w, cy - 6 * mm, f"IBAN: {company.get('iban') or '—'}")
    canvas.drawString(20 * mm + 2 * col_w, cy - 9 * mm, f"BIC: {company.get('bic') or '—'}")

    # Spalte 4: Seitenzahl
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(page_width - 20 * mm, cy - 9 * mm, f"Seite {doc.page}")

    canvas.restoreState()


def generate_quote_pdf(
    quote: Dict[str, Any],
    customer: Dict[str, Any],
    user: Dict[str, Any],
    company: Dict[str, Any],
    quote_number: str,
) -> bytes:
    """Erzeugt das fertige PDF und gibt es als Bytes zurück."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=38 * mm, bottomMargin=32 * mm,
        title=f"Angebot {quote_number}",
        author=user.get("name", "Solar Mitte"),
    )

    styles = getSampleStyleSheet()
    h_style = ParagraphStyle("h", parent=styles["Heading1"], fontSize=14, textColor=BRAND_DARK, spaceAfter=4 * mm)
    sub_style = ParagraphStyle("sub", parent=styles["Heading3"], fontSize=11, textColor=BRAND_GREEN, spaceBefore=4 * mm, spaceAfter=2 * mm)
    body_style = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9.5, leading=13, textColor=BRAND_TEXT, alignment=TA_JUSTIFY)
    small_style = ParagraphStyle("sm", parent=styles["BodyText"], fontSize=8, textColor=BRAND_MUTED, leading=11)
    addr_style = ParagraphStyle("addr", parent=styles["BodyText"], fontSize=10, leading=14, textColor=BRAND_TEXT)

    story: List[Any] = []

    # === Anschrift Block ===
    cust_block = (
        f"<b>{customer.get('name','')}</b><br/>"
        f"{customer.get('address','') or ''}<br/>"
        f"{customer.get('zip_code','') or ''} {customer.get('city','') or ''}"
    )
    story.append(Paragraph(cust_block, addr_style))
    story.append(Spacer(1, 8 * mm))

    # === Header (Angebot-Nr / Datum) ===
    today = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    meta_data = [
        [Paragraph(f"<b>Angebots-Nr.</b>", small_style), Paragraph(quote_number, addr_style),
         Paragraph(f"<b>Datum</b>", small_style), Paragraph(today, addr_style)],
    ]
    meta_t = Table(meta_data, colWidths=[28 * mm, 60 * mm, 22 * mm, 60 * mm])
    meta_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_t)
    story.append(Spacer(1, 6 * mm))

    # === Titel ===
    story.append(Paragraph(f"Angebot — Photovoltaik-Anlage {quote.get('kwp_label','')}", h_style))
    # Intro
    intro = quote.get("intro_text") or "Vielen Dank für Ihre Anfrage. Anbei unser Angebot."
    story.append(Paragraph(intro, body_style))
    story.append(Spacer(1, 4 * mm))

    # === Positions-Tabelle (4 Sektionen) ===
    sections = quote.get("sections", [])
    for sec in sections:
        if not sec.get("items"):
            continue
        story.append(Paragraph(f"Pos. {sec['code']} — {sec['title']}", sub_style))

        rows = [["Nr.", "Beschreibung", "Menge", "Einzel-€", "Gesamt-€"]]
        for i, it in enumerate(sec["items"], 1):
            name = it.get("name", "")
            desc = it.get("description", "")
            full = f"<b>{name}</b><br/>{desc}" if desc else f"<b>{name}</b>"
            rows.append([
                f"{sec['code']}.{i}",
                Paragraph(full, ParagraphStyle("p", fontSize=8.5, leading=11, textColor=BRAND_TEXT)),
                f"{_fmt_qty(it.get('qty', 0))} {it.get('unit', '')}",
                _fmt_eur(it.get('unit_price_net', 0)),
                _fmt_eur(it.get('total_net', 0)),
            ])

        t = Table(rows, colWidths=[12 * mm, 95 * mm, 22 * mm, 20 * mm, 21 * mm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
            ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8.5),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, BRAND_LIGHT_BG]),
            ("LINEABOVE", (0, 0), (-1, 0), 1, BRAND_GREEN),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 3 * mm))

    # === Summen-Block ===
    sub_net = quote.get("subtotal_net", 0)
    disc = quote.get("discount_amount", 0) or 0
    disc_label = quote.get("discount_label")
    total_net = quote.get("total_net", sub_net - disc)
    vat = quote.get("total_vat", round(total_net * 0.19, 2))
    gross = quote.get("total_gross", round(total_net + vat, 2))

    sum_rows = [["", "Zwischensumme netto", _fmt_eur(sub_net)]]
    if disc > 0:
        sum_rows.append(["", f"Rabatt — {disc_label or ''}", f"− {_fmt_eur(disc)}"])
    sum_rows.append(["", "Gesamt netto", _fmt_eur(total_net)])
    sum_rows.append(["", "zzgl. 19% USt.", _fmt_eur(vat)])
    sum_rows.append(["", "Gesamtbetrag brutto", _fmt_eur(gross)])

    sum_t = Table(sum_rows, colWidths=[97 * mm, 52 * mm, 21 * mm])
    sum_t.setStyle(TableStyle([
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (1, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (1, -1), (-1, -1), 11),
        ("TEXTCOLOR", (1, -1), (-1, -1), BRAND_GREEN),
        ("LINEABOVE", (1, -1), (-1, -1), 1.5, BRAND_GREEN),
        ("LINEABOVE", (1, -3), (-1, -3), 0.5, BRAND_BORDER),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(sum_t)
    story.append(Spacer(1, 6 * mm))

    # === Konditionen ===
    delivery = quote.get("delivery_time_weeks") or "8-12"
    validity = quote.get("validity_days") or 30
    cond_text = (
        f"<b>Lieferzeit:</b> ca. {delivery} Wochen nach Auftragserteilung &nbsp;·&nbsp; "
        f"<b>Gültigkeit:</b> {validity} Tage &nbsp;·&nbsp; "
        f"<b>Zahlungsbedingungen:</b> 30 % bei Auftrag, 60 % bei Lieferung, 10 % nach Inbetriebnahme"
    )
    story.append(Paragraph(cond_text, small_style))
    story.append(Spacer(1, 4 * mm))

    closing = quote.get("closing_text") or "Wir freuen uns auf Ihre Rückmeldung und stehen für Rückfragen jederzeit zur Verfügung."
    story.append(Paragraph(closing, body_style))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"Mit sonnigen Grüßen<br/><br/><b>{user.get('name','')}</b><br/>{company.get('name','Solar Mitte GmbH')}", body_style))

    # === Build PDF mit Header/Footer auf jeder Seite ===
    def _draw_hf(c, d): _header_footer(c, d, company, user)
    doc.build(story, onFirstPage=_draw_hf, onLaterPages=_draw_hf)
    return buf.getvalue()
