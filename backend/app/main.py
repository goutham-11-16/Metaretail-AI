"""
MetaRetail AI - FastAPI Main Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

import os
from backend.app.core.config import settings
from backend.app.database.session import engine
from backend.app.database.base import Base
import backend.app.models.domain  # Ensure models are registered
from backend.app.api.endpoints import router as api_router
from backend.app.api.websocket import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("metaretail.main")

# Initialize database tables
Base.metadata.create_all(bind=engine)

def init_store_defaults():
    from backend.app.database.session import SessionLocal
    from backend.app.models.domain import Zone, ZoneProduct, Camera, Product
    db = SessionLocal()
    try:
        # 1. Initialize default zones if empty
        if db.query(Zone).count() == 0:
            default_zones = [
                Zone(id=1, name="Entrance & Welcome Gate", description="Main store entrance turnstiles and foyer", location="Zone A"),
                Zone(id=2, name="Aisle 1 - Chilled Beverages", description="Refrigerated soft drinks, sodas, and juices", location="Aisle 1"),
                Zone(id=3, name="Aisle 2 - Snacks & Confectionery", description="Potato chips, pretzels, chocolates, and cookies", location="Aisle 2"),
                Zone(id=4, name="Aisle 3 - Fresh & Bakery", description="Breads, pastries, fruits, and bakery goods", location="Aisle 3"),
                Zone(id=5, name="High-Value Electronics Bay", description="Smartphones, tablets, and smart retail devices", location="Bay 5"),
                Zone(id=6, name="Autonomous Exit Turnstiles", description="Just Walk Out automated checkout and exit lanes", location="Exit Turnstiles")
            ]
            for z in default_zones:
                db.add(z)
            db.commit()
            logger.info("Initialized default retail store zones.")

        # 2. Map existing products to zones if zone_products is empty
        if db.query(ZoneProduct).count() == 0:
            prods = db.query(Product).all()
            for p in prods:
                cat_lower = (p.category or "").lower()
                name_lower = p.name.lower()
                z_id = 3
                if "bev" in cat_lower or "drink" in name_lower or "coke" in name_lower or "cola" in name_lower:
                    z_id = 2
                elif "snack" in cat_lower or "chip" in name_lower or "dorito" in name_lower:
                    z_id = 3
                elif "fresh" in cat_lower or "bake" in cat_lower or "bread" in name_lower:
                    z_id = 4
                elif "elect" in cat_lower or "phone" in name_lower:
                    z_id = 5
                elif "book" in name_lower:
                    z_id = 4
                db.add(ZoneProduct(zone_id=z_id, product_id=p.id))
            db.commit()
            logger.info("Mapped catalog products to store zones.")

        # 3. Initialize Camera #1 if cameras table is empty
        if db.query(Camera).count() == 0:
            cam1 = Camera(
                id=1,
                name="Main Store Overhead Camera",
                camera_type="LOCAL",
                connection_url="default",
                status="OFFLINE",
                assigned_zone_id=2,
                resolution="1280x720 (16:9)",
                fps=30
            )
            db.add(cam1)
            db.commit()
            logger.info("Initialized default Camera #1.")
    except Exception as e:
        logger.error(f"Error initializing store defaults: {e}")
        db.rollback()
    finally:
        db.close()

init_store_defaults()

# Create uploads directory structure
# Create logs directory and action audit file logger
os.makedirs("logs", exist_ok=True)
action_log_path = os.path.abspath("logs/action_audit.log")

action_logger = logging.getLogger("metaretail.audit")
action_logger.setLevel(logging.INFO)
if not any(isinstance(h, logging.FileHandler) for h in action_logger.handlers):
    file_handler = logging.FileHandler(action_log_path, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter(
        "[%(asctime)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))
    action_logger.addHandler(file_handler)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("[AUDIT] [%(asctime)s] %(message)s", datefmt="%H:%M:%S"))
    action_logger.addHandler(console_handler)

action_logger.info("⚡ MetaRetail Action Audit Logger initialized. Capturing all user testing actions.")

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
import time

class ActionAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Ignore noisy static assets and websockets ping from flooding audit
        if request.url.path.startswith("/static") or request.url.path.startswith("/uploads"):
            return await call_next(request)

        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        method = request.method
        url_path = request.url.path
        query = str(request.url.query) if request.url.query else ""
        query_str = f"?{query}" if query else ""

        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 1)
        status_code = response.status_code

        status_emoji = "✅" if status_code < 400 else "⚠️" if status_code < 500 else "❌"
        audit_entry = f"{status_emoji} {method:<6} {url_path}{query_str} -> {status_code} ({duration_ms}ms) [Client: {client_ip}]"
        action_logger.info(audit_entry)
        return response

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Vision Transformer-Based Autonomous Retail Analytics API Engine"
)

# Set up Action Audit middleware
app.add_middleware(ActionAuditMiddleware)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
from backend.app.api.camera_ws import router as camera_ws_router
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app.mount("/static", StaticFiles(directory="backend/app/static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)
app.include_router(camera_ws_router)

@app.get("/phone-camera/{camera_id}", response_class=HTMLResponse)
def serve_phone_camera_page(camera_id: int, token: str = None):
    static_path = os.path.join(os.path.dirname(__file__), "static", "phone-camera.html")
    if not os.path.exists(static_path):
        static_path = "backend/app/static/phone-camera.html"
    with open(static_path, "r") as f:
        html = f.read()
    return HTMLResponse(content=html)



@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} Engine API",
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health"
    }
