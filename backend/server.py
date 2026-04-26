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
    title: str
    date: str  # ISO
    duration_minutes: int = 60
    assigned_to: Optional[str] = None  # user id
    type: Literal["besichtigung","installation","wartung","kundentermin"] = "kundentermin"
    notes: Optional[str] = ""

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

@api.delete("/appointments/{aid}")
async def delete_appointment(aid: str, user: dict = Depends(get_current_user)):
    await db.appointments.delete_one({"id": aid})
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

# ------------------- Startup -------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("stage")
    await db.roof_audits.create_index("customer_id")
    await db.projects.create_index("customer_id")
    await db.appointments.create_index("date")

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
