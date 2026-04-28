from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from emergentintegrations.llm.chat import LlmChat, UserMessage
from seed_inventory import build_seed_data, build_compatibilities
from seed_inventory_v2 import get_extension_data, build_extension_compatibilities
from photo_audit import measure_roof, detect_obstacles
from planning_engine import plan_full
from quotes import structure_quote_with_ai, generate_quote_pdf
from installer import bom_to_checklist_items, generate_protocol_pdf, PHASE_LABEL
from fastapi.responses import Response

# ------------------- DB -------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

app = FastAPI(title="Solar Mitte CRM API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("solar-crm")

# ------------------- Helpers -------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, token_type: str = "access") -> str:
    exp = datetime.now(timezone.utc) + (timedelta(minutes=60*24) if token_type == "access" else timedelta(days=7))
    return pyjwt.encode({"sub": user_id, "type": token_type, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request, creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Ungültiger Token-Typ")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ------------------- Models -------------------
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "vertrieb", "monteur"] = "vertrieb"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    notes: Optional[str] = ""
    stage: Literal["lead", "kontakt", "angebot", "vertrag", "installation", "abgeschlossen"] = "lead"
    estimated_kwp: Optional[float] = None
    estimated_value: Optional[float] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    notes: Optional[str] = None
    stage: Optional[str] = None
    estimated_kwp: Optional[float] = None
    estimated_value: Optional[float] = None

class RoofAuditCreate(BaseModel):
    customer_id: Optional[str] = None
    title: str
    laenge: float  # length m
    breite: float  # width m
    walm: float = 0.0  # hip m (0 = no hip)
    first: float  # ridge m
    sparrenabstand: float = 0.64  # rafter spacing m
    neigung: float = 35.0  # degrees
    ausrichtung: Literal["Süd","Ost","West","Nord","SO","SW","NO","NW"] = "Süd"
    module_watt: int = 420  # W per module
    module_length: float = 1.722  # m
    module_width: float = 1.134  # m
    notes: Optional[str] = ""

class ProjectCreate(BaseModel):
    customer_id: str
    title: str
    status: Literal["planung","genehmigung","installation","abnahme","abgeschlossen"] = "planung"
    kwp: Optional[float] = None
    value: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = ""

class AppointmentCreate(BaseModel):
    customer_id: Optional[str] = None
    project_id: Optional[str] = None
    title: str
    date: str  # ISO
    duration_minutes: int = 60
    assigned_to: Optional[str] = None
    type: Literal["installation","survey","service","internal"] = "installation"
    status: Literal["planned","in_progress","done","cancelled"] = "planned"
    location: Optional[str] = ""
    notes: Optional[str] = ""

class AppointmentUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    location: Optional[str] = None

class TaskCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = None
    status: Literal["todo","in_progress","done"] = "todo"
    priority: Literal["low","medium","high"] = "medium"
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None

class SiteLogCreate(BaseModel):
    project_id: str
    appointment_id: Optional[str] = None
    log_date: str  # ISO date
    weather: Optional[str] = ""
    work_done: str
    issues: Optional[str] = ""
    next_steps: Optional[str] = ""
    safety_notes: Optional[str] = ""
    workers_count: Optional[int] = None

class PhotoCreate(BaseModel):
    project_id: Optional[str] = None
    customer_id: Optional[str] = None
    site_log_id: Optional[str] = None
    title: Optional[str] = ""
    image_base64: str  # data:image/jpeg;base64,...
    caption: Optional[str] = ""

class AIChatMessage(BaseModel):
    session_id: str
    message: str

# ------------------- Auth Routes -------------------
@api.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id, "email": email, "name": data.name, "role": data.role,
        "password_hash": hash_password(data.password), "created_at": now_iso()
    }
    await db.users.insert_one(user_doc)
    access = create_token(user_id, "access")
    refresh = create_token(user_id, "refresh")
    response.set_cookie("access_token", access, httponly=True, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", max_age=604800, path="/")
    return {"access_token": access, "user": {"id": user_id, "email": email, "name": data.name, "role": data.role}}

@api.post("/auth/login")
async def login(data: UserLogin, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    access = create_token(user["id"], "access")
    refresh = create_token(user["id"], "refresh")
    response.set_cookie("access_token", access, httponly=True, samesite="lax", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", max_age=604800, path="/")
    return {"access_token": access, "user": {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ------------------- Dashboard -------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_customers = await db.customers.count_documents({})
    leads = await db.customers.count_documents({"stage": "lead"})
    angebote = await db.customers.count_documents({"stage": "angebot"})
    in_installation = await db.customers.count_documents({"stage": "installation"})
    abgeschlossen = await db.customers.count_documents({"stage": "abgeschlossen"})

    # Pipeline value
    pipeline_cursor = db.customers.find({"stage": {"$nin": ["abgeschlossen"]}}, {"_id": 0, "estimated_value": 1})
    pipeline_value = 0.0
    async for c in pipeline_cursor:
        pipeline_value += float(c.get("estimated_value") or 0)

    # Total kWp from projects
    total_kwp = 0.0
    async for p in db.projects.find({}, {"_id": 0, "kwp": 1}):
        total_kwp += float(p.get("kwp") or 0)

    # Recent customers
    recent = []
    async for c in db.customers.find({}, {"_id": 0}).sort("created_at", -1).limit(5):
        recent.append(c)

    # Appointments today/upcoming
    today = datetime.now(timezone.utc).date().isoformat()
    upcoming = []
    async for a in db.appointments.find({"date": {"$gte": today}}, {"_id": 0}).sort("date", 1).limit(5):
        upcoming.append(a)

    # Monthly trend (last 6 months)
    trend = []
    for i in range(5, -1, -1):
        month_start = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30*i)
        label = month_start.strftime("%b")
        count = await db.customers.count_documents({
            "created_at": {"$gte": month_start.isoformat()[:7]}
        })
        trend.append({"month": label, "value": count})

    return {
        "total_customers": total_customers,
        "leads": leads,
        "angebote": angebote,
        "in_installation": in_installation,
        "abgeschlossen": abgeschlossen,
        "pipeline_value": pipeline_value,
        "total_kwp": round(total_kwp, 2),
        "recent_customers": recent,
        "upcoming_appointments": upcoming,
        "trend": trend
    }

# ------------------- Customers -------------------
@api.post("/customers")
async def create_customer(data: CustomerCreate, user: dict = Depends(get_current_user)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **data.dict(), "created_at": now_iso(), "created_by": user["id"]}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/customers")
async def list_customers(stage: Optional[str] = None, search: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if stage:
        q["stage"] = stage
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
        ]
    items = []
    async for c in db.customers.find(q, {"_id": 0}).sort("created_at", -1):
        items.append(c)
    return items

@api.get("/customers/{cid}")
async def get_customer(cid: str, user: dict = Depends(get_current_user)):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Kunde nicht gefunden")
    audits = []
    async for a in db.roof_audits.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1):
        audits.append(a)
    projects = []
    async for p in db.projects.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1):
        projects.append(p)
    return {**c, "audits": audits, "projects": projects}

@api.patch("/customers/{cid}")
async def update_customer(cid: str, data: CustomerUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "Keine Änderungen")
    r = await db.customers.update_one({"id": cid}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Kunde nicht gefunden")
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    return c

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(get_current_user)):
    await db.customers.delete_one({"id": cid})
    await db.roof_audits.delete_many({"customer_id": cid})
    await db.projects.delete_many({"customer_id": cid})
    return {"ok": True}

# ------------------- Roof Audits -------------------
def compute_pv_layout(laenge: float, breite: float, walm: float, first: float,
                      module_l: float, module_w: float, gap: float = 0.02,
                      edge_margin: float = 0.3):
    """Compute module grid for half roof (one side of ridge).
    Half roof rectangle: width along roof = laenge (minus walm cut-outs if walm>0), depth along roof slope ≈ breite/2.
    For simplicity (top-down schematic), we use horizontal rectangle.
    """
    # effective usable width (x): first length (ridge portion). If walm>0, the rafters still cover full length but triangles cut corners.
    # We compute modules for the central rectangular area = first x (breite/2 - margin)
    usable_x = max(first - 2 * edge_margin, 0)
    usable_y = max((breite / 2) - 2 * edge_margin, 0)

    cols = int((usable_x + gap) // (module_l + gap))
    rows = int((usable_y + gap) // (module_w + gap))
    total_modules_per_side = max(cols, 0) * max(rows, 0)
    return {"cols": cols, "rows": rows, "per_side": total_modules_per_side}

def orientation_factor(orient: str) -> float:
    f = {"Süd": 1.0, "SO": 0.95, "SW": 0.95, "Ost": 0.85, "West": 0.85, "NO": 0.70, "NW": 0.70, "Nord": 0.60}
    return f.get(orient, 0.9)

@api.post("/roof-audits")
async def create_roof_audit(data: RoofAuditCreate, user: dict = Depends(get_current_user)):
    layout = compute_pv_layout(data.laenge, data.breite, data.walm, data.first,
                               data.module_length, data.module_width)
    modules_total = layout["per_side"] * 2  # both roof sides
    kwp = round(modules_total * data.module_watt / 1000, 2)

    # Annual yield ≈ kWp * specific yield (≈ 950 kWh/kWp Germany) * orientation factor
    specific_yield = 950
    annual_kwh = round(kwp * specific_yield * orientation_factor(data.ausrichtung), 0)
    # CO2 savings ≈ 0.4 kg/kWh
    co2_tonnes = round(annual_kwh * 0.4 / 1000, 2)
    # Savings ≈ 0.35 €/kWh
    eur_savings = round(annual_kwh * 0.35, 0)

    # Roof area (approx)
    roof_area = round(data.laenge * data.breite, 2)

    aid = str(uuid.uuid4())
    doc = {
        "id": aid, **data.dict(),
        "modules_total": modules_total,
        "modules_per_side": layout["per_side"],
        "layout_cols": layout["cols"],
        "layout_rows": layout["rows"],
        "kwp": kwp,
        "annual_kwh": annual_kwh,
        "co2_tonnes": co2_tonnes,
        "eur_savings": eur_savings,
        "roof_area": roof_area,
        "created_at": now_iso(),
        "created_by": user["id"]
    }
    await db.roof_audits.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/roof-audits")
async def list_audits(customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if customer_id:
        q["customer_id"] = customer_id
    items = []
    async for a in db.roof_audits.find(q, {"_id": 0}).sort("created_at", -1):
        items.append(a)
    return items

@api.get("/roof-audits/{aid}")
async def get_audit(aid: str, user: dict = Depends(get_current_user)):
    a = await db.roof_audits.find_one({"id": aid}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Aufmaß nicht gefunden")
    return a

@api.delete("/roof-audits/{aid}")
async def delete_audit(aid: str, user: dict = Depends(get_current_user)):
    await db.roof_audits.delete_one({"id": aid})
    return {"ok": True}

# ------------------- Projects -------------------
@api.post("/projects")
async def create_project(data: ProjectCreate, user: dict = Depends(get_current_user)):
    pid = str(uuid.uuid4())
    doc = {"id": pid, **data.dict(), "created_at": now_iso(), "created_by": user["id"]}
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    items = []
    async for p in db.projects.find({}, {"_id": 0}).sort("created_at", -1):
        # enrich with customer name
        if p.get("customer_id"):
            c = await db.customers.find_one({"id": p["customer_id"]}, {"_id": 0, "name": 1})
            p["customer_name"] = c["name"] if c else None
        items.append(p)
    return items

@api.patch("/projects/{pid}")
async def update_project(pid: str, data: dict, user: dict = Depends(get_current_user)):
    await db.projects.update_one({"id": pid}, {"$set": data})
    p = await db.projects.find_one({"id": pid}, {"_id": 0})
    return p

@api.delete("/projects/{pid}")
async def delete_project(pid: str, user: dict = Depends(get_current_user)):
    await db.projects.delete_one({"id": pid})
    return {"ok": True}

# ------------------- Appointments -------------------
@api.post("/appointments")
async def create_appointment(data: AppointmentCreate, user: dict = Depends(get_current_user)):
    aid = str(uuid.uuid4())
    doc = {"id": aid, **data.dict(), "created_at": now_iso(), "created_by": user["id"]}
    await db.appointments.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/appointments")
async def list_appointments(user: dict = Depends(get_current_user)):
    items = []
    async for a in db.appointments.find({}, {"_id": 0}).sort("date", 1):
        if a.get("customer_id"):
            c = await db.customers.find_one({"id": a["customer_id"]}, {"_id": 0, "name": 1})
            a["customer_name"] = c["name"] if c else None
        items.append(a)
    return items

@api.patch("/appointments/{aid}")
async def update_appointment(aid: str, data: AppointmentUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.dict().items() if v is not None}
    if upd:
        await db.appointments.update_one({"id": aid}, {"$set": upd})
    a = await db.appointments.find_one({"id": aid}, {"_id": 0})
    return a

@api.delete("/appointments/{aid}")
async def delete_appointment(aid: str, user: dict = Depends(get_current_user)):
    await db.appointments.delete_one({"id": aid})
    return {"ok": True}

# ------------------- Tasks -------------------
@api.post("/tasks")
async def create_task(data: TaskCreate, user: dict = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    doc = {"id": tid, **data.dict(), "created_at": now_iso(), "created_by": user["id"]}
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/tasks")
async def list_tasks(project_id: Optional[str] = None, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id: q["project_id"] = project_id
    if status: q["status"] = status
    return [t async for t in db.tasks.find(q, {"_id": 0}).sort("created_at", -1)]

@api.patch("/tasks/{tid}")
async def update_task(tid: str, data: TaskUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.dict().items() if v is not None}
    if upd: await db.tasks.update_one({"id": tid}, {"$set": upd})
    t = await db.tasks.find_one({"id": tid}, {"_id": 0})
    return t

@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    await db.tasks.delete_one({"id": tid})
    return {"ok": True}

# ------------------- Site Logs (Bautagebuch) -------------------
@api.post("/site-logs")
async def create_site_log(data: SiteLogCreate, user: dict = Depends(get_current_user)):
    sid = str(uuid.uuid4())
    doc = {"id": sid, **data.dict(), "created_at": now_iso(), "created_by": user["id"], "created_by_name": user["name"]}
    await db.site_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/site-logs")
async def list_site_logs(project_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id: q["project_id"] = project_id
    return [s async for s in db.site_logs.find(q, {"_id": 0}).sort("log_date", -1)]

@api.delete("/site-logs/{sid}")
async def delete_site_log(sid: str, user: dict = Depends(get_current_user)):
    await db.site_logs.delete_one({"id": sid})
    return {"ok": True}

# ------------------- Photos -------------------
@api.post("/photos")
async def create_photo(data: PhotoCreate, user: dict = Depends(get_current_user)):
    pid = str(uuid.uuid4())
    doc = {"id": pid, **data.dict(), "created_at": now_iso(), "created_by": user["id"]}
    await db.photos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/photos")
async def list_photos(project_id: Optional[str] = None, customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if project_id: q["project_id"] = project_id
    if customer_id: q["customer_id"] = customer_id
    return [p async for p in db.photos.find(q, {"_id": 0}).sort("created_at", -1)]

@api.delete("/photos/{pid}")
async def delete_photo(pid: str, user: dict = Depends(get_current_user)):
    await db.photos.delete_one({"id": pid})
    return {"ok": True}

# ------------------- AI Assistant -------------------
SYSTEM_PROMPT = (
    "Du bist der KI-Assistent für 'Solar Mitte', ein deutsches Solarinstallationsunternehmen. "
    "Du hilfst dem Vertriebsteam beim Verfassen professioneller Kunden-E-Mails, Angebotstexte, "
    "technischer Erläuterungen zu Photovoltaik-Anlagen, Speichersystemen, Wallboxen und "
    "staatlicher Förderung (KfW, BAFA). Antworte immer auf Deutsch. Sei professionell, "
    "höflich, präzise und kundenorientiert. Rechne bei Bedarf Amortisation, kWh-Ertrag "
    "(≈ 950 kWh/kWp Deutschland) und CO₂-Einsparung (0,4 kg/kWh)."
)

@api.post("/ai/chat")
async def ai_chat(data: AIChatMessage, user: dict = Depends(get_current_user)):
    session_id = f"{user['id']}_{data.session_id}"
    # Store user message
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": data.session_id, "user_id": user["id"],
        "role": "user", "content": data.message, "created_at": now_iso()
    })
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=SYSTEM_PROMPT
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=data.message))
    except Exception as e:
        logger.exception("AI chat error")
        raise HTTPException(500, f"KI-Fehler: {str(e)}")

    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": data.session_id, "user_id": user["id"],
        "role": "assistant", "content": response, "created_at": now_iso()
    })
    return {"response": response}

@api.get("/export/all")
async def export_all(user: dict = Depends(get_current_user)):
    """Export all CRM data as JSON"""
    customers = [c async for c in db.customers.find({}, {"_id": 0})]
    audits = [a async for a in db.roof_audits.find({}, {"_id": 0})]
    projects = [p async for p in db.projects.find({}, {"_id": 0})]
    appointments = [a async for a in db.appointments.find({}, {"_id": 0})]
    return {
        "exported_at": now_iso(),
        "exported_by": user["email"],
        "company": "Solar Mitte GmbH",
        "counts": {
            "customers": len(customers), "roof_audits": len(audits),
            "projects": len(projects), "appointments": len(appointments)
        },
        "customers": customers,
        "roof_audits": audits,
        "projects": projects,
        "appointments": appointments,
    }

@api.get("/ai/history/{session_id}")
async def ai_history(session_id: str, user: dict = Depends(get_current_user)):
    items = []
    async for m in db.ai_messages.find({"session_id": session_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", 1):
        items.append(m)
    return items

# ------------------- Monteur (Field-Service) -------------------
class ChecklistGenerateRequest(BaseModel):
    project_id: str
    bom: dict
    layout: Optional[dict] = None

@api.post("/monteur/checklists/generate")
async def gen_checklist(req: ChecklistGenerateRequest, user: dict = Depends(get_current_user)):
    items = bom_to_checklist_items(req.bom)
    cid = str(uuid.uuid4())
    doc = {
        "id": cid, "project_id": req.project_id,
        "items": items, "bom_snapshot": req.bom, "layout_snapshot": req.layout,
        "created_at": now_iso(), "created_by": user["id"],
    }
    # one checklist per project — overwrite if exists
    await db.checklists.delete_many({"project_id": req.project_id})
    await db.checklists.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/monteur/checklists/{project_id}")
async def get_checklist(project_id: str, user: dict = Depends(get_current_user)):
    doc = await db.checklists.find_one({"project_id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Keine Checkliste — bitte aus Planung generieren")
    return doc

class ChecklistItemUpdate(BaseModel):
    seq: int
    status: Literal["todo", "done"]

@api.patch("/monteur/checklists/{project_id}/item")
async def patch_item(project_id: str, data: ChecklistItemUpdate, user: dict = Depends(get_current_user)):
    cl = await db.checklists.find_one({"project_id": project_id})
    if not cl: raise HTTPException(404, "Checkliste nicht gefunden")
    items = cl["items"]
    for it in items:
        if it["seq"] == data.seq:
            it["status"] = data.status
            it["checked_at"] = now_iso() if data.status == "done" else None
            it["checked_by"] = user["name"] if data.status == "done" else None
            break
    await db.checklists.update_one({"project_id": project_id}, {"$set": {"items": items}})
    return {"ok": True}

# Site-Photos with GPS + phase
class SitePhotoCreate(BaseModel):
    project_id: str
    image_base64: str
    title: Optional[str] = ""
    phase: str = "doku"  # ladung|uk|module|elektrik|netz|doku
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    gps_accuracy: Optional[float] = None

@api.post("/monteur/site-photos")
async def create_site_photo(data: SitePhotoCreate, user: dict = Depends(get_current_user)):
    pid = str(uuid.uuid4())
    doc = {
        "id": pid,
        "project_id": data.project_id,
        "image_base64": data.image_base64,
        "title": data.title or f"Foto {datetime.now(timezone.utc).strftime('%d.%m. %H:%M')}",
        "phase": data.phase,
        "gps": {"lat": data.gps_lat, "lng": data.gps_lng, "accuracy": data.gps_accuracy} if data.gps_lat else None,
        "created_at": now_iso(),
        "created_by": user["id"],
        "created_by_name": user["name"],
        "ai_check": None,
    }
    await db.site_photos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/monteur/site-photos")
async def list_site_photos(project_id: str, user: dict = Depends(get_current_user)):
    items = []
    async for p in db.site_photos.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1):
        items.append(p)
    return items

@api.delete("/monteur/site-photos/{pid}")
async def del_site_photo(pid: str, user: dict = Depends(get_current_user)):
    await db.site_photos.delete_one({"id": pid})
    return {"ok": True}

@api.post("/monteur/site-photos/{pid}/ai-check")
async def site_photo_ai_check(pid: str, user: dict = Depends(get_current_user)):
    """MOCKED: Plausibilitäts-Check für Foto-Inhalt.
    Eine echte Vision-Verifizierung würde Claude Vision oder ein YOLO-Modell brauchen.
    Wir liefern hier einen heuristischen Mock-Score basierend auf Phase + Bildgröße.
    """
    p = await db.site_photos.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Foto nicht gefunden")
    img_size = len(p.get("image_base64", "")) // 1000  # KB
    phase = p.get("phase", "doku")
    # Mock: Confidence basierend auf Größe (große Bilder = mehr Detail)
    conf = min(0.95, 0.5 + img_size / 1000)
    expected = {
        "module": "Modulreihen mit Klemmen sichtbar",
        "elektrik": "Wechselrichter / Schaltanlage erwartet",
        "netz": "Zählerschrank / Anschlussdose erwartet",
        "uk": "Schienen und Dachhaken erwartet",
        "doku": "Übersichtsbild oder Typenschild erwartet",
        "ladung": "Materialladung auf LKW erwartet",
    }.get(phase, "—")
    result = {
        "checked_at": now_iso(),
        "confidence": round(conf, 2),
        "expected": expected,
        "verdict": "plausibel" if conf > 0.6 else "unklar",
        "note": "Heuristischer Plausibilitäts-Check (MOCK — kein echtes Vision-Modell)",
    }
    await db.site_photos.update_one({"id": pid}, {"$set": {"ai_check": result}})
    return result

# Signatures
class SignatureSave(BaseModel):
    project_id: str
    role: Literal["customer", "installer"]
    name: str
    strokes: Optional[List[List[List[float]]]] = None  # JSON Polylines
    canvas_width: Optional[int] = 320
    canvas_height: Optional[int] = 180
    image_base64: Optional[str] = None  # Fallback

@api.post("/monteur/signatures")
async def save_signature(data: SignatureSave, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": data.project_id,
        "role": data.role,
        "name": data.name,
        "strokes": data.strokes,
        "canvas_width": data.canvas_width,
        "canvas_height": data.canvas_height,
        "image_base64": data.image_base64,
        "signed_at": now_iso(),
        "user_id": user["id"],
    }
    await db.signatures.delete_many({"project_id": data.project_id, "role": data.role})
    await db.signatures.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/monteur/signatures/{project_id}")
async def get_signatures(project_id: str, user: dict = Depends(get_current_user)):
    sigs = {}
    async for s in db.signatures.find({"project_id": project_id}, {"_id": 0}):
        sigs[s["role"]] = s
    return sigs

# Acceptance Protocol PDF
@api.get("/monteur/protocols/{project_id}/pdf")
async def protocol_pdf(project_id: str, request: Request, _t: Optional[str] = None,
                       creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    # Same flexible auth as quote PDF
    token = (creds.credentials if creds and creds.credentials else None) or request.cookies.get("access_token") or _t
    if not token: raise HTTPException(401, "Nicht authentifiziert")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not u: raise HTTPException(401, "User nicht gefunden")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Ungültiger Token")

    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project: raise HTTPException(404, "Projekt nicht gefunden")
    customer = await db.customers.find_one({"id": project.get("customer_id")}, {"_id": 0}) or {}
    company = await db.companies.find_one({"id": "default"}, {"_id": 0})
    if not company:
        company = {"id": "default", **CompanyUpsert().dict()}
        await db.companies.insert_one(company)
        company.pop("_id", None)
    cl = await db.checklists.find_one({"project_id": project_id}, {"_id": 0})
    photos = [p async for p in db.site_photos.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1)]
    sigs = {}
    async for s in db.signatures.find({"project_id": project_id}, {"_id": 0}):
        sigs[s["role"]] = s

    pdf = generate_protocol_pdf(
        project=project, customer=customer, company=company, user=u,
        checklist=(cl or {}).get("items", []),
        photos=photos,
        layout=(cl or {}).get("layout_snapshot"),
        bom=(cl or {}).get("bom_snapshot"),
        signatures=sigs,
    )
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="Abnahmeprotokoll_{project.get("title","Projekt")}.pdf"'})

# Monteur Project Dashboard — listet alle Projekte mit Checklisten-Fortschritt
@api.get("/monteur/projects")
async def monteur_projects(user: dict = Depends(get_current_user)):
    items = []
    async for p in db.projects.find({}, {"_id": 0}).sort("created_at", -1):
        if p.get("customer_id"):
            c = await db.customers.find_one({"id": p["customer_id"]}, {"_id": 0, "name": 1, "city": 1})
            p["customer_name"] = c["name"] if c else None
            p["customer_city"] = c.get("city") if c else None
        cl = await db.checklists.find_one({"project_id": p["id"]}, {"_id": 0, "items": 1})
        if cl:
            its = cl.get("items", [])
            done = sum(1 for x in its if x.get("status") == "done")
            p["progress_done"] = done
            p["progress_total"] = len(its)
            p["progress_pct"] = round(done / max(len(its), 1) * 100)
        else:
            p["progress_done"] = 0; p["progress_total"] = 0; p["progress_pct"] = 0
        # Signatures
        sigs = {}
        async for s in db.signatures.find({"project_id": p["id"]}, {"_id": 0, "role": 1}):
            sigs[s["role"]] = True
        p["has_customer_sig"] = bool(sigs.get("customer"))
        p["has_installer_sig"] = bool(sigs.get("installer"))
        items.append(p)
    return items

# ------------------- Companies -------------------
class CompanyUpsert(BaseModel):
    name: str = "Solar Mitte GmbH"
    legal_name: Optional[str] = "Solar Mitte GmbH"
    tagline: Optional[str] = "Photovoltaik · Speicher · Wallbox"
    street: Optional[str] = "Energieplatz 1"
    zip_code: Optional[str] = "10115"
    city: Optional[str] = "Berlin"
    phone: Optional[str] = "+49 30 1234567"
    email: Optional[str] = "info@solar-mitte.de"
    website: Optional[str] = "www.solar-mitte.de"
    tax_id: Optional[str] = "11/123/45678"
    vat_id: Optional[str] = "DE123456789"
    trade_register: Optional[str] = "HRB 12345 B"
    bank_name: Optional[str] = "Deutsche Bank Berlin"
    iban: Optional[str] = "DE12 1007 0024 0123 4567 89"
    bic: Optional[str] = "DEUTDEDBBER"

@api.get("/company")
async def get_company(user: dict = Depends(get_current_user)):
    c = await db.companies.find_one({"id": "default"}, {"_id": 0})
    if not c:
        # Lazy seed
        c = {"id": "default", **CompanyUpsert().dict(), "created_at": now_iso()}
        await db.companies.insert_one(c)
        c.pop("_id", None)
    return c

@api.put("/company")
async def update_company(data: CompanyUpsert, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admin darf Firmendaten ändern")
    upd = data.dict()
    await db.companies.update_one({"id": "default"}, {"$set": upd}, upsert=True)
    return await db.companies.find_one({"id": "default"}, {"_id": 0})

# ------------------- Quotes (KI + PDF) -------------------
class QuoteGenerateRequest(BaseModel):
    customer_id: str
    layout: dict
    bom: dict
    extras: Optional[str] = ""               # "Wallbox 11 kW hinzufügen"
    discount_request: Optional[str] = ""     # "5% auf Montage"

@api.post("/quotes/generate")
async def quote_generate(req: QuoteGenerateRequest, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": req.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")
    try:
        structured = await structure_quote_with_ai(
            bom=req.bom, layout=req.layout, customer=customer, user=user,
            extras=req.extras, discount_request=req.discount_request,
            api_key=EMERGENT_LLM_KEY, session_id=f"quote-{user['id']}-{req.customer_id}"
        )
    except Exception as e:
        logger.exception("AI structuring failed")
        raise HTTPException(500, f"KI-Strukturierung fehlgeschlagen: {e}")

    # kwp_label für Header
    structured["kwp_label"] = f"{req.layout.get('kwp', 0):.2f} kWp"

    # Quote-Nummer
    seq = await db.quotes.count_documents({})
    year = datetime.now(timezone.utc).year
    quote_number = f"AB-{year}-{seq + 1:04d}"

    doc = {
        "id": str(uuid.uuid4()),
        "quote_number": quote_number,
        "customer_id": req.customer_id,
        "customer_snapshot": customer,
        "user_id": user["id"],
        "user_snapshot": {"name": user["name"], "email": user["email"], "role": user["role"], "phone": user.get("phone")},
        "structured": structured,
        "layout": req.layout,
        "bom": req.bom,
        "extras": req.extras,
        "discount_request": req.discount_request,
        "total_net": structured.get("total_net"),
        "total_gross": structured.get("total_gross"),
        "created_at": now_iso(),
    }
    await db.quotes.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.get("/quotes")
async def list_quotes(customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"customer_id": customer_id} if customer_id else {}
    return [d async for d in db.quotes.find(q, {"_id": 0}).sort("created_at", -1)]

@api.get("/quotes/{qid}")
async def get_quote(qid: str, user: dict = Depends(get_current_user)):
    d = await db.quotes.find_one({"id": qid}, {"_id": 0})
    if not d: raise HTTPException(404, "Angebot nicht gefunden")
    return d

@api.get("/quotes/{qid}/pdf")
async def quote_pdf(qid: str, request: Request, _t: Optional[str] = None,
                    creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    # Fallback-Auth: ?_t=<token> als Query, damit Linking.openURL auf Native funktioniert
    user = None
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token and _t:
        token = _t
    if not token:
        raise HTTPException(401, "Nicht authentifiziert")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user: raise HTTPException(401, "Benutzer nicht gefunden")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Ungültiger Token")

    d = await db.quotes.find_one({"id": qid}, {"_id": 0})
    if not d: raise HTTPException(404, "Angebot nicht gefunden")
    company = await db.companies.find_one({"id": "default"}, {"_id": 0})
    if not company:
        company = {"id": "default", **CompanyUpsert().dict()}
        await db.companies.insert_one(company)
        company.pop("_id", None)
    pdf_bytes = generate_quote_pdf(
        quote=d["structured"],
        customer=d["customer_snapshot"],
        user=d["user_snapshot"],
        company=company,
        quote_number=d["quote_number"],
    )
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="Angebot_{d["quote_number"]}.pdf"'}
    )

# ------------------- PV Planning Engine -------------------
class PlanningRequest(BaseModel):
    roof_width_m: float
    roof_height_m: float
    obstacles_m: List[List[List[float]]] = Field(default_factory=list)
    module_length_m: float = 1.722
    module_width_m: float = 1.134
    module_power_w: int = 440
    inverter_system: Literal["string", "hybrid", "micro_hoymiles", "optimized_solaredge"] = "string"
    orientation: Literal["portrait", "landscape"] = "portrait"
    edge_margin_m: float = 0.3
    sigenergy_battery_kwh: Optional[float] = None

@api.post("/planning/generate")
async def api_plan(req: PlanningRequest, user: dict = Depends(get_current_user)):
    try:
        result = plan_full(
            roof_width_m=req.roof_width_m,
            roof_height_m=req.roof_height_m,
            obstacles_m=req.obstacles_m,
            module={"length_m": req.module_length_m, "width_m": req.module_width_m, "power_w": req.module_power_w},
            inverter_system=req.inverter_system,
            orientation=req.orientation,
            edge_margin_m=req.edge_margin_m,
            sigenergy_battery_kwh=req.sigenergy_battery_kwh,
        )
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("planning failed")
        raise HTTPException(500, f"Planungs-Fehler: {e}")

# ------------------- Photo-Aufmaß (Computer Vision) -------------------
class PhotoMeasureRequest(BaseModel):
    image_base64: str
    quad_points: List[List[float]]            # 4 Punkte [x,y]
    reference_pair: List[int]                  # [a_idx, b_idx]
    reference_meters: float
    obstacles: Optional[List[List[List[float]]]] = None
    snap: bool = True
    save_for_customer_id: Optional[str] = None
    title: Optional[str] = "Foto-Aufmaß"

class PhotoDetectRequest(BaseModel):
    image_base64: str

@api.post("/photo-audit/detect-obstacles")
async def api_detect_obstacles(req: PhotoDetectRequest, user: dict = Depends(get_current_user)):
    try:
        candidates = detect_obstacles(req.image_base64)
        return {"candidates": candidates, "count": len(candidates)}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("detect_obstacles failed")
        raise HTTPException(500, f"Erkennung fehlgeschlagen: {e}")

@api.post("/photo-audit/measure")
async def api_measure_roof(req: PhotoMeasureRequest, user: dict = Depends(get_current_user)):
    try:
        result = measure_roof(
            req.image_base64,
            req.quad_points,
            (req.reference_pair[0], req.reference_pair[1]),
            req.reference_meters,
            req.obstacles,
            req.snap,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.exception("measure_roof failed")
        raise HTTPException(500, f"Berechnung fehlgeschlagen: {e}")

    # optional speichern als Photo-Audit-Datensatz (separat von normalen roof_audits)
    if req.save_for_customer_id:
        doc = {
            "id": str(uuid.uuid4()),
            "customer_id": req.save_for_customer_id,
            "title": req.title or "Foto-Aufmaß",
            "type": "photo",
            "dimensions": result["dimensions"],
            "obstacle_area_m2": result["obstacle_area_m2"],
            "usable_area_m2": result["usable_area_m2"],
            "reference_meters": req.reference_meters,
            "created_at": now_iso(),
            "created_by": user["id"],
        }
        await db.photo_audits.insert_one(doc)
        result["saved_id"] = doc["id"]

    return result

# ------------------- Inventory -------------------
INV_TYPE_TO_COLL = {
    "modules": "inv_solar_modules",
    "inverters": "inv_inverters",
    "batteries": "inv_batteries",
    "rails": "inv_mounting_rails",
    "hooks": "inv_roof_hooks",
    "screws": "inv_screws",
}
INV_TYPE_SINGULAR = {
    "modules": "solar_module", "inverters": "inverter", "batteries": "battery",
    "rails": "mounting_rail", "hooks": "roof_hook", "screws": "screw",
}
SINGULAR_TO_PLURAL = {v: k for k, v in INV_TYPE_SINGULAR.items()}

@api.get("/inventory/{cat}")
async def list_inventory(cat: str, search: Optional[str] = None, manufacturer: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    coll = INV_TYPE_TO_COLL.get(cat)
    if not coll: raise HTTPException(404, "Unbekannte Kategorie")
    q: dict = {}
    if manufacturer: q["manufacturer"] = manufacturer
    if search:
        q["$or"] = [
            {"manufacturer": {"$regex": search, "$options": "i"}},
            {"model": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
        ]
    return [d async for d in db[coll].find(q, {"_id": 0}).sort("manufacturer", 1)]

@api.get("/inventory/{cat}/{item_id}")
async def get_inventory_item(cat: str, item_id: str, user: dict = Depends(get_current_user)):
    coll = INV_TYPE_TO_COLL.get(cat)
    if not coll: raise HTTPException(404, "Unbekannte Kategorie")
    d = await db[coll].find_one({"id": item_id}, {"_id": 0})
    if not d: raise HTTPException(404, "Artikel nicht gefunden")
    # Kompatibilitäten anhängen (beide Richtungen)
    sing = INV_TYPE_SINGULAR[cat]
    edges = []
    async for e in db.inv_compatibilities.find(
        {"$or": [{"source_id": item_id}, {"target_id": item_id}]}, {"_id": 0}):
        edges.append(e)
    # Anreichern mit Partner-Datensatz
    enriched: list = []
    for e in edges:
        is_src = e.get("source_id") == item_id
        partner_type = e["target_type"] if is_src else e["source_type"]
        partner_id = e.get("target_id") if is_src else e.get("source_id")
        partner_key = e.get("target_key") if is_src else e.get("source_key")
        partner = None
        if partner_id and partner_type in SINGULAR_TO_PLURAL:
            pcoll = INV_TYPE_TO_COLL[SINGULAR_TO_PLURAL[partner_type]]
            partner = await db[pcoll].find_one({"id": partner_id}, {"_id": 0})
        enriched.append({
            "edge_id": e["id"], "relation": e["relation"],
            "rule_context": e.get("rule_context"), "certified_by": e.get("certified_by"),
            "direction": "outgoing" if is_src else "incoming",
            "partner_type": partner_type, "partner_id": partner_id,
            "partner_key": partner_key, "partner": partner,
        })
    return {**d, "compatibilities": enriched}

@api.post("/inventory/{cat}")
async def create_inventory(cat: str, payload: dict, user: dict = Depends(get_current_user)):
    coll = INV_TYPE_TO_COLL.get(cat)
    if not coll: raise HTTPException(404, "Unbekannte Kategorie")
    payload["id"] = payload.get("id") or str(uuid.uuid4())
    payload["created_at"] = now_iso()
    payload["updated_at"] = now_iso()
    await db[coll].insert_one(payload)
    payload.pop("_id", None)
    return payload

@api.patch("/inventory/{cat}/{item_id}")
async def update_inventory(cat: str, item_id: str, payload: dict, user: dict = Depends(get_current_user)):
    coll = INV_TYPE_TO_COLL.get(cat)
    if not coll: raise HTTPException(404, "Unbekannte Kategorie")
    payload["updated_at"] = now_iso()
    await db[coll].update_one({"id": item_id}, {"$set": payload})
    d = await db[coll].find_one({"id": item_id}, {"_id": 0})
    return d

@api.delete("/inventory/{cat}/{item_id}")
async def delete_inventory(cat: str, item_id: str, user: dict = Depends(get_current_user)):
    coll = INV_TYPE_TO_COLL.get(cat)
    if not coll: raise HTTPException(404, "Unbekannte Kategorie")
    await db[coll].delete_one({"id": item_id})
    # Verwaiste Edges entfernen
    await db.inv_compatibilities.delete_many({"$or": [{"source_id": item_id}, {"target_id": item_id}]})
    return {"ok": True}

@api.get("/inventory")
async def inventory_summary(user: dict = Depends(get_current_user)):
    out = {}
    for cat, coll in INV_TYPE_TO_COLL.items():
        out[cat] = await db[coll].count_documents({})
    out["compatibilities"] = await db.inv_compatibilities.count_documents({})
    return out

# ------------------- Compatibility -------------------
@api.get("/compatibilities")
async def list_compat(user: dict = Depends(get_current_user)):
    return [e async for e in db.inv_compatibilities.find({}, {"_id": 0}).sort("created_at", -1)]

@api.post("/compatibilities")
async def create_compat(payload: dict, user: dict = Depends(get_current_user)):
    payload["id"] = payload.get("id") or str(uuid.uuid4())
    payload["created_at"] = now_iso()
    await db.inv_compatibilities.insert_one(payload)
    payload.pop("_id", None)
    return payload

@api.delete("/compatibilities/{eid}")
async def delete_compat(eid: str, user: dict = Depends(get_current_user)):
    await db.inv_compatibilities.delete_one({"id": eid})
    return {"ok": True}

# ------------------- Startup -------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("stage")
    await db.roof_audits.create_index("customer_id")
    await db.projects.create_index("customer_id")
    await db.appointments.create_index("date")

    # Inventory-Indizes
    for coll in ["inv_solar_modules","inv_inverters","inv_batteries","inv_mounting_rails","inv_roof_hooks","inv_screws"]:
        await db[coll].create_index("sku", unique=True)
        await db[coll].create_index("manufacturer")
    await db.inv_compatibilities.create_index([("source_type", 1), ("source_id", 1)])
    await db.inv_compatibilities.create_index([("target_type", 1), ("target_id", 1)])

    # Inventar seeden, falls leer
    if await db.inv_solar_modules.count_documents({}) == 0:
        seed = build_seed_data()
        if seed["modules"]: await db.inv_solar_modules.insert_many(seed["modules"])
        if seed["inverters"]: await db.inv_inverters.insert_many(seed["inverters"])
        if seed["batteries"]: await db.inv_batteries.insert_many(seed["batteries"])
        if seed["rails"]: await db.inv_mounting_rails.insert_many(seed["rails"])
        if seed["hooks"]: await db.inv_roof_hooks.insert_many(seed["hooks"])
        if seed["screws"]: await db.inv_screws.insert_many(seed["screws"])
        edges = build_compatibilities(seed)
        if edges: await db.inv_compatibilities.insert_many(edges)
        logger.info(f"Seeded inventory: {sum(len(v) for v in seed.values())} Artikel + {len(edges)} Kompatibilitäten")

    # V2 Erweiterung idempotent (nur neue SKUs)
    seed_v1 = build_seed_data()  # für Compat-Verknüpfung
    ext = get_extension_data()
    added = 0
    for cat_key, coll_name in [("modules","inv_solar_modules"),("inverters","inv_inverters"),("screws","inv_screws")]:
        for item in ext.get(cat_key, []):
            if not await db[coll_name].find_one({"sku": item["sku"]}):
                await db[coll_name].insert_one(item)
                added += 1
    if added > 0:
        # Compat-Edges nur einfügen wenn neue Artikel hinzugekommen sind
        ext_edges = build_extension_compatibilities(seed_v1, ext)
        if ext_edges:
            await db.inv_compatibilities.insert_many(ext_edges)
        logger.info(f"V2 Erweiterung: {added} neue Artikel, {len(ext_edges)} neue Kompatibilitäten")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@solar-mitte.de").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin", "role": "admin", "created_at": now_iso()
        })
        logger.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed a demo vertrieb user
    vertrieb_email = "vertrieb@solar-mitte.de"
    if not await db.users.find_one({"email": vertrieb_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": vertrieb_email,
            "password_hash": hash_password("vertrieb123"),
            "name": "Max Mustermann", "role": "vertrieb", "created_at": now_iso()
        })

    # Seed monteur user
    monteur_email = "monteur@solar-mitte.de"
    if not await db.users.find_one({"email": monteur_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": monteur_email,
            "password_hash": hash_password("monteur123"),
            "name": "Tom Bauer", "role": "monteur", "phone": "+49 151 23456789", "created_at": now_iso()
        })

    # Seed demo customers if empty
    if await db.customers.count_documents({}) == 0:
        demo_customers = [
            {"id": str(uuid.uuid4()), "name": "Familie Schmidt", "email": "schmidt@example.de", "phone": "+49 30 12345678",
             "address": "Hauptstraße 12", "city": "Berlin", "zip_code": "10115", "stage": "angebot",
             "estimated_kwp": 9.8, "estimated_value": 24500, "notes": "Einfamilienhaus mit Walmdach",
             "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "name": "Bauer GmbH", "email": "info@bauer-gmbh.de", "phone": "+49 89 9876543",
             "address": "Industriestr. 5", "city": "München", "zip_code": "80331", "stage": "installation",
             "estimated_kwp": 45.5, "estimated_value": 89000, "notes": "Gewerbehalle, Ausrichtung Süd",
             "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "name": "Müller Familie", "email": "mueller@example.de", "phone": "+49 40 111222",
             "address": "Am See 7", "city": "Hamburg", "zip_code": "20095", "stage": "lead",
             "estimated_kwp": 7.2, "estimated_value": 18500, "notes": "Erstkontakt, Satteldach",
             "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "name": "Fischer KG", "email": "fischer@kg.de", "phone": "+49 221 333444",
             "address": "Domstr. 3", "city": "Köln", "zip_code": "50667", "stage": "vertrag",
             "estimated_kwp": 15.4, "estimated_value": 38000, "notes": "Mit Speicher 10 kWh",
             "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "name": "Weber Hausverwaltung", "email": "weber@hv.de", "phone": "+49 69 555666",
             "address": "Bankstr. 99", "city": "Frankfurt", "zip_code": "60311", "stage": "abgeschlossen",
             "estimated_kwp": 22.0, "estimated_value": 52000, "notes": "Projekt erfolgreich abgeschlossen",
             "created_at": now_iso()},
        ]
        await db.customers.insert_many(demo_customers)
        logger.info("Seeded demo customers")

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
