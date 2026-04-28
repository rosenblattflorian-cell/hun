"""HERO Software API Bridge (Solar Mitte ↔ HERO).

WICHTIG: Die HERO-API-Spezifikation liegt derzeit nicht vor. Dieser Service
implementiert die korrekte STRUKTUR (Pull-Customer, Push-PDF, Sync-Log) mit
realistischen Mock-Antworten. Sobald API-Docs + Credentials vorhanden sind,
müssen nur die markierten `# TODO HERO API` Stellen gegen echte HTTP-Calls
ausgetauscht werden.

Umgebungsvariablen (optional, fallen auf MOCK zurück wenn leer):
  HERO_API_URL     — z.B. https://api.herosoftware.de/v1
  HERO_API_KEY     — Bearer-Token
  HERO_COMPANY_ID  — Mandanten-ID
"""
from __future__ import annotations
import os
import uuid
import base64
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import logging
import httpx

logger = logging.getLogger("hero")

HERO_API_URL = os.environ.get("HERO_API_URL", "").rstrip("/")
HERO_API_KEY = os.environ.get("HERO_API_KEY", "")
HERO_COMPANY_ID = os.environ.get("HERO_COMPANY_ID", "")

IS_MOCK = not (HERO_API_URL and HERO_API_KEY)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {HERO_API_KEY}",
        "Content-Type": "application/json",
        "X-Company-Id": HERO_COMPANY_ID,
    }


# ============== PULL: Project → Customer ==============

async def hero_pull_project(hero_project_id: str) -> Dict[str, Any]:
    """Zieht Projekt- und Kundendaten aus HERO.
    Mapped auf unser internes Customer+Project-Modell.
    """
    if IS_MOCK:
        logger.warning(f"HERO MOCK: pulling project {hero_project_id}")
        # Realistischer Mock — ersetzt echte API-Antwort
        return {
            "hero_project_id": hero_project_id,
            "project_name": f"BV Musterweg 42 — {hero_project_id}",
            "customer": {
                "name": "Maria & Thomas Beispiel",
                "company": None,
                "email": "beispiel@hero-demo.de",
                "phone": "+49 30 98765432",
                "street": "Musterweg 42",
                "zip_code": "10243",
                "city": "Berlin",
            },
            "project": {
                "status": "Angebotsphase",
                "type": "PV-Anlage",
                "assigned_to": "Katharina Lenz",
                "estimated_kwp": 11.2,
                "estimated_value": 28500,
                "notes": "Objekt-Besichtigung erfolgt am 15.02.2026",
            },
            "_mock": True,
        }

    # TODO HERO API: echte Projekt-Pull
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{HERO_API_URL}/projects/{hero_project_id}", headers=_headers())
        r.raise_for_status()
        data = r.json()
        # TODO: Mapping von HERO-Feldern auf unser Schema nach API-Spec
        return data


def map_hero_to_local(hero_data: Dict[str, Any]) -> Dict[str, Any]:
    """Mappt HERO-Response auf Customer + Project Objekte."""
    c = hero_data.get("customer", {})
    p = hero_data.get("project", {})

    # Stage-Mapping HERO → intern
    hero_status = (p.get("status") or "").lower()
    stage_map = {
        "interessent": "lead",
        "kontakt": "kontakt",
        "angebotsphase": "angebot",
        "angebot": "angebot",
        "auftrag": "vertrag",
        "in bearbeitung": "installation",
        "installation": "installation",
        "abgeschlossen": "abgeschlossen",
    }
    stage = stage_map.get(hero_status, "lead")

    customer_doc = {
        "name": c.get("name") or c.get("company") or "Unbekannt",
        "email": c.get("email"),
        "phone": c.get("phone"),
        "address": c.get("street"),
        "zip_code": c.get("zip_code"),
        "city": c.get("city"),
        "stage": stage,
        "estimated_kwp": p.get("estimated_kwp"),
        "estimated_value": p.get("estimated_value"),
        "notes": p.get("notes"),
        "hero_project_id": hero_data.get("hero_project_id"),
    }
    project_doc = {
        "title": hero_data.get("project_name") or f"PV-Projekt {hero_data.get('hero_project_id')}",
        "status": "planung" if stage == "angebot" else "installation" if stage == "installation" else "abgeschlossen" if stage == "abgeschlossen" else "planung",
        "kwp": p.get("estimated_kwp"),
        "value": p.get("estimated_value"),
        "notes": p.get("notes") or "",
        "hero_project_id": hero_data.get("hero_project_id"),
    }
    return {"customer": customer_doc, "project": project_doc}


# ============== PUSH: PDFs + BOM → HERO Dokumente ==============

async def hero_push_document(
    hero_project_id: str,
    doc_type: str,                  # "quote" | "protocol"
    filename: str,
    pdf_bytes: bytes,
    note: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Hängt PDF + Notiz/Metadaten an ein HERO-Projekt."""
    if IS_MOCK:
        logger.warning(f"HERO MOCK: push {doc_type} '{filename}' ({len(pdf_bytes)} bytes) → hero_project={hero_project_id}")
        return {
            "ok": True,
            "hero_document_id": f"mock-doc-{uuid.uuid4().hex[:8]}",
            "uploaded_at": now_iso(),
            "filename": filename,
            "size_bytes": len(pdf_bytes),
            "_mock": True,
        }

    # TODO HERO API: echter Upload (multipart oder Base64)
    b64 = base64.b64encode(pdf_bytes).decode()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{HERO_API_URL}/projects/{hero_project_id}/documents",
            headers=_headers(),
            json={
                "type": doc_type,
                "filename": filename,
                "file_base64": b64,
                "note": note,
                "metadata": metadata or {},
            },
        )
        r.raise_for_status()
        return r.json()


async def hero_push_bom_note(hero_project_id: str, bom: Dict[str, Any], layout: Dict[str, Any]) -> Dict[str, Any]:
    """Schickt die BOM als strukturierte Notiz/JSON an HERO."""
    if IS_MOCK:
        logger.warning(f"HERO MOCK: push BOM ({len(bom.get('items',[]))} items) → {hero_project_id}")
        return {"ok": True, "note_id": f"mock-note-{uuid.uuid4().hex[:8]}", "_mock": True}

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{HERO_API_URL}/projects/{hero_project_id}/notes",
            headers=_headers(),
            json={
                "title": f"Stückliste · {layout.get('modules_count')} Module · {layout.get('kwp')} kWp",
                "content_markdown": _format_bom_markdown(bom, layout),
                "tags": ["solar-mitte-ki", "bom", "auto-generiert"],
            },
        )
        r.raise_for_status()
        return r.json()


def _format_bom_markdown(bom: Dict[str, Any], layout: Dict[str, Any]) -> str:
    lines = [
        f"## Automatische Stückliste aus Solar Mitte Planner",
        f"- Module: {layout.get('modules_count')}",
        f"- Leistung: {layout.get('kwp')} kWp",
        f"- System: {bom.get('system')}",
        f"- Total Netto: € {bom.get('total_net', 0):,.2f}",
        "",
        "### Positionen",
    ]
    for it in bom.get("items", []):
        lines.append(f"- **{it['name']}** — {it['qty']} {it.get('unit','')} @ € {it.get('unit_price_net',0):.2f} = € {it.get('total_net',0):.2f}")
    if bom.get("warnings"):
        lines.append("\n### ⚠ Elektrische Validierung")
        for w in bom["warnings"]:
            lines.append(f"- {w}")
    return "\n".join(lines)


# ============== Health / Status ==============

async def hero_health() -> Dict[str, Any]:
    if IS_MOCK:
        return {
            "connected": False,
            "mode": "MOCK",
            "message": "HERO_API_URL und HERO_API_KEY nicht konfiguriert — alle Aufrufe werden gemockt.",
            "config_required": ["HERO_API_URL", "HERO_API_KEY", "HERO_COMPANY_ID"],
        }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{HERO_API_URL}/health", headers=_headers())
            return {"connected": r.status_code == 200, "mode": "LIVE", "status": r.status_code}
    except Exception as e:
        return {"connected": False, "mode": "LIVE", "error": str(e)}
