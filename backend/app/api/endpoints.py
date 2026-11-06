"""
REST API Endpoint Routers for MetaRetail AI Backend
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import os
import uuid
import logging

logger = logging.getLogger("metaretail.api")

from backend.app.database.session import get_db
from backend.app.models.domain import (
    Product, Customer, Interaction, Event, Alert,
    CartItem, Invoice, SecurityIncident, Camera, Zone, ZoneProduct, InteractionDetail
)
from backend.app.schemas.schemas import (
    ProductCreate, ProductOut, ProductUpdate,
    CustomerOut, InteractionOut, EventOut, AlertOut,
    AnalyticsOut, CameraStatusOut
)
from backend.app.services.pipeline_instance import shared_pipeline_service
from backend.app.services.cart_service import shared_cart_service
from backend.app.services.tunnel_service import shared_tunnel_manager
from backend.app.services.topology_service import shared_topology_service
from ai.security.loss_prevention_engine import shared_loss_prevention
import json
import io
import csv

router = APIRouter()

# --- Health Check ---
@router.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "MetaRetail AI Backend",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

# --- Products & Inventory ---
@router.get("/products", response_model=List[ProductOut], tags=["Products"])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED, tags=["Products"])
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    data = product_in.model_dump()
    zone_id = data.pop("zone_id", None)
    data.pop("price", None)
    data.pop("stock", None)
    data.pop("min_stock", None)
    if not data.get("sku"):
        data["sku"] = f"SKU-{uuid.uuid4().hex[:8].upper()}"
    if not data.get("category"):
        data["category"] = "General"
    if not data.get("barcode"):
        data["barcode"] = None

    valid_cols = {"sku", "name", "category", "current_stock", "min_stock_threshold", "unit_price", "image_url", "barcode", "description"}
    filtered_data = {k: v for k, v in data.items() if k in valid_cols}

    db_product = Product(**filtered_data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    if zone_id:
        try:
            zp = ZoneProduct(zone_id=int(zone_id), product_id=db_product.id)
            db.add(zp)
            db.commit()
        except Exception as ze:
            logger.warning(f"Could not assign product {db_product.id} to zone {zone_id}: {ze}")

    try:
        from backend.app.services.pipeline_instance import shared_pipeline_service
        shared_pipeline_service._zone_cache.clear()
        if db_product.image_url:
            shared_pipeline_service.classifier.register_product_image(
                product_id=db_product.id,
                product_name=db_product.name,
                image_path=db_product.image_url,
                category=db_product.category or "General",
                angle="front"
            )
    except Exception as pe:
        logger.warning(f"Could not sync new product to vision pipeline: {pe}")

    return db_product

@router.post("/products/{product_id}/images", tags=["Products"])
async def upload_product_image(
    product_id: int, 
    file: UploadFile = File(...), 
    angle: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    from backend.app.models.domain import ProductImage
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    os.makedirs("uploads/products", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"prod_{product_id}_{angle or 'default'}_{int(datetime.utcnow().timestamp())}{ext}"
    filepath = os.path.join("uploads/products", filename)
    
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)
        
    rel_url = f"/uploads/products/{filename}"
    if not product.image_url:
        product.image_url = rel_url
        
    prod_img = ProductImage(
        product_id=product_id,
        image_path=rel_url,
        angle=angle or "front",
        is_reference=True
    )
    db.add(prod_img)
    db.commit()
    db.refresh(product)

    try:
        from backend.app.services.pipeline_instance import shared_pipeline_service
        shared_pipeline_service.classifier.register_product_image(
            product_id=product.id,
            product_name=product.name,
            image_path=filepath,
            category=product.category or "General",
            angle=angle or "front"
        )
        shared_pipeline_service._zone_cache.clear()
    except Exception as e:
        logger.warning(f"Could not update classifier with new product image: {e}")
        
    return {"status": "success", "image_url": rel_url}

@router.get("/inventory", tags=["Inventory"])
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "current_stock": p.current_stock,
            "min_stock_threshold": p.min_stock_threshold,
            "is_low_stock": p.current_stock <= p.min_stock_threshold
        }
        for p in products
    ]

# --- Customers ---
@router.get("/customers", response_model=List[CustomerOut], tags=["Customers"])
def get_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.entry_time.desc()).limit(50).all()

# --- Interactions ---
@router.get("/interactions", response_model=List[InteractionOut], tags=["Interactions"])
def get_interactions(db: Session = Depends(get_db)):
    return db.query(Interaction).order_by(Interaction.timestamp.desc()).limit(100).all()

# --- Events ---
@router.get("/events", response_model=List[EventOut], tags=["Events"])
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).order_by(Event.timestamp.desc()).limit(100).all()

# --- Alerts ---
@router.get("/alerts", response_model=List[AlertOut], tags=["Alerts"])
def get_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).filter(Alert.is_resolved == False).all()

@router.post("/alerts/{alert_id}/resolve", tags=["Alerts"])
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    alert.resolved_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": f"Alert {alert_id} resolved"}

# --- Store Owner Abandonment & Purchase Analytics ---
@router.get("/analytics", response_model=AnalyticsOut, tags=["Analytics"])
def get_analytics(db: Session = Depends(get_db)):
    summary = shared_pipeline_service.analytics_engine.get_summary()

    # Query persistent ground-truth data from database
    db_customers_count = db.query(Customer).count()
    active_now = db.query(Customer).filter(Customer.exit_time.is_(None)).count()
    if active_now == 0:
        active_now = len(shared_cart_service.get_all_active_carts(db))

    dwell_records = db.query(Customer.dwell_time).filter(Customer.dwell_time > 0).all()
    db_avg_dwell = round(sum(d[0] for d in dwell_records) / max(1, len(dwell_records)), 1) if dwell_records else 0.0

    db_pickups = db.query(Interaction).filter(Interaction.action.ilike("%PICK%")).count()
    db_replaces = db.query(InteractionDetail).filter(InteractionDetail.was_replaced == True).count()
    db_purchases = db.query(Invoice).count()

    total_customers_today = max(summary.total_customers_today, db_customers_count)
    active_customers_now = max(summary.active_customers_now, active_now)
    avg_dwell = summary.avg_dwell_time_seconds if summary.avg_dwell_time_seconds > 0 else db_avg_dwell
    total_pickups = max(summary.total_pickups or 0, db_pickups)
    total_replaced_left = max(summary.total_replaced_left or 0, db_replaces)
    total_purchases = max(summary.total_purchases or 0, db_purchases)

    if total_pickups > 0:
        base_denom = max(total_pickups, total_replaced_left)
        abandonment_pct = round(min(100.0, max(0.0, (total_replaced_left / base_denom) * 100)), 1)
        if total_purchases > 0:
            conversion_pct = round(min(100.0, max(0.0, (total_purchases / total_pickups) * 100)), 1)
        else:
            conversion_pct = round(max(0.0, 100.0 - abandonment_pct), 1)
    else:
        abandonment_pct = min(100.0, max(0.0, summary.store_abandonment_rate_pct or 0.0))
        conversion_pct = round(max(0.0, 100.0 - abandonment_pct), 1)

    product_stats = summary.product_stats
    if (not product_stats or len(product_stats) == 0) and total_pickups > 0:
        prods = db.query(Product).all()
        prod_stats_list = []
        for p in prods:
            p_picks = db.query(Interaction).filter(Interaction.product_id == p.id, Interaction.action.ilike("%PICK%")).count()
            if p_picks > 0:
                p_replaces = db.query(InteractionDetail).join(Interaction, InteractionDetail.interaction_id == Interaction.id).filter(
                    Interaction.product_id == p.id,
                    InteractionDetail.was_replaced == True
                ).count()
                p_purchases = max(0, p_picks - p_replaces)
                p_ab_pct = round((p_replaces / p_picks) * 100, 1)
                p_cv_pct = round((p_purchases / p_picks) * 100, 1)
                
                if p_replaces > 0 and p_purchases == 0:
                    insight = f"⚠️ High Abandonment: Picked up {p_picks}x but always replaced on shelf. Review price or shelf placement."
                elif p_replaces > p_purchases:
                    insight = f"⚠️ Moderate Drop-off ({p_ab_pct}%): Customers inspect but frequently leave on shelf."
                elif p_purchases > 0 and p_replaces == 0:
                    insight = f"✅ High Conversion (100%): Every customer who picked this item purchased it."
                else:
                    insight = f"Active browsing: {p_purchases} bought vs {p_replaces} left on shelf."

                prod_stats_list.append({
                    "product_name": p.name,
                    "category": p.category or "General",
                    "pickups": p_picks,
                    "replaced_left": p_replaces,
                    "purchases": p_purchases,
                    "abandonment_rate_pct": p_ab_pct,
                    "conversion_rate_pct": p_cv_pct,
                    "owner_insight": insight,
                    "last_time": datetime.now().strftime("%I:%M:%S %p")
                })
        product_stats = prod_stats_list

    recent_actions = summary.recent_actions
    if (not recent_actions or len(recent_actions) == 0):
        recent_details = db.query(InteractionDetail).order_by(InteractionDetail.pickup_timestamp.desc()).limit(15).all()
        act_list = []
        for rd in recent_details:
            intr = db.query(Interaction).filter(Interaction.id == rd.interaction_id).first()
            prod_name = "Product"
            cust_id = 1
            if intr:
                prod = db.query(Product).filter(Product.id == intr.product_id).first()
                if prod:
                    prod_name = prod.name
                cust_id = intr.customer_id or 1
            act_list.append({
                "customer_id": cust_id,
                "product_name": prod_name,
                "action": "REPLACED ON SHELF" if rd.was_replaced else "PICKED UP",
                "status": "LEFT ON SHELF (NOT BOUGHT)" if rd.was_replaced else "INSPECTING ITEM",
                "dwell_time_sec": rd.hold_duration_seconds or 2.0,
                "timestamp": rd.pickup_timestamp.strftime("%I:%M:%S %p") if rd.pickup_timestamp else datetime.now().strftime("%I:%M:%S %p")
            })
        recent_actions = act_list

    most_product = summary.most_abandoned_product or "None"
    if most_product == "None" and product_stats:
        worst = max(product_stats, key=lambda x: x.get("replaced_left", 0), default=None)
        if worst and worst.get("replaced_left", 0) > 0:
            most_product = f"{worst['product_name']} ({worst['replaced_left']}x left)"

    most_interacted = "None"
    if product_stats:
        top_interacted = max(product_stats, key=lambda x: x.get("pickups", 0), default=None)
        if top_interacted:
            most_interacted = str(top_interacted.get("product_name", "None")).split(" ")[0]

    return AnalyticsOut(
        total_customers_today=total_customers_today,
        active_customers_now=active_customers_now,
        avg_dwell_time_seconds=avg_dwell,
        total_interactions=total_pickups,
        most_interacted_product=most_interacted,
        conversion_rate_pct=conversion_pct,
        total_pickups=total_pickups,
        total_replaced_left=total_replaced_left,
        total_purchases=total_purchases,
        store_abandonment_rate_pct=abandonment_pct,
        most_abandoned_product=most_product,
        product_stats=product_stats,
        recent_actions=recent_actions
    )

# --- Camera ---
@router.get("/camera/status", response_model=CameraStatusOut, tags=["Camera"])
def get_camera_status():
    return CameraStatusOut(
        is_active=True,
        source="Webcam (Source 0)",
        fps=30.0,
        resolution="1280x720"
    )

# --- Extended Product CRUD ---
from backend.app.services.product_service import ProductService
product_service = ProductService()

@router.put("/products/{product_id}", tags=["Products"])
def update_product(product_id: int, product_in: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    update_data = product_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    try:
        from backend.app.services.pipeline_instance import shared_pipeline_service
        shared_pipeline_service.classifier.update_product_name(
            product_id=db_product.id,
            new_name=db_product.name,
            new_category=db_product.category
        )
        shared_pipeline_service._zone_cache.clear()
    except Exception:
        pass
    return db_product

@router.delete("/products/{product_id}", tags=["Products"])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product_service.delete_product(db, product_id)
    try:
        from backend.app.services.pipeline_instance import shared_pipeline_service
        shared_pipeline_service.classifier.remove_product(product_id)
        shared_pipeline_service._zone_cache.clear()
    except Exception:
        pass
    return {"status": "success", "message": f"Product {product_id} deleted"}

@router.get("/products/barcode/{barcode}", tags=["Products"])
async def lookup_barcode(barcode: str, db: Session = Depends(get_db)):
    # 1. Check local catalog first
    local_p = db.query(Product).filter(Product.barcode == barcode).first()
    if local_p:
        prod_data = {
            "name": local_p.name,
            "category": local_p.category,
            "price": local_p.unit_price,
            "brand": None,
            "image_url": local_p.image_url
        }
        return {
            "found": True,
            "name": local_p.name,
            "category": local_p.category,
            "price": local_p.unit_price,
            "product": prod_data
        }

    # 2. Query Open Food Facts via product_service
    res = await product_service.lookup_barcode(barcode)
    if res:
        return {
            "found": True,
            "name": res.get("name"),
            "category": res.get("category"),
            "price": 0.0,
            "brand": res.get("brand"),
            "product": res
        }

    return {"found": False, "product": None}

from backend.app.schemas.schemas import CameraCreate, CameraSchema, CameraUpdate
from backend.app.services.camera_manager import shared_camera_manager as camera_manager, get_local_ip
from backend.app.models.domain import Camera

@router.post("/cameras", response_model=CameraSchema, tags=["Cameras"])
def create_camera(camera_in: CameraCreate, db: Session = Depends(get_db)):
    cam = camera_manager.register_camera(db, camera_in.name, camera_in.camera_type, camera_in.connection_url, camera_in.assigned_zone_id)
    return cam

@router.get("/cameras", tags=["Cameras"])
def list_cameras(db: Session = Depends(get_db)):
    return camera_manager.get_all_cameras(db)

@router.get("/cameras/{camera_id}", response_model=CameraSchema, tags=["Cameras"])
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    from backend.app.models.domain import Zone
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    stat = camera_manager.get_camera_status(camera_id)
    if not cam:
        if stat:
            cam = Camera(id=camera_id, name=f"Phone Camera {camera_id}", camera_type="PHONE", status=stat["status"])
            db.add(cam)
            db.commit()
            db.refresh(cam)
        else:
            raise HTTPException(status_code=404, detail="Camera not found")
    else:
        cam.status = stat["status"] if stat else "OFFLINE"

    if stat:
        if stat.get("resolution"):
            cam.resolution = stat["resolution"]
        if stat.get("fps") is not None:
            cam.fps = int(stat["fps"])
        setattr(cam, "quality", stat.get("quality"))
        setattr(cam, "quality_preset", stat.get("quality_preset"))
        setattr(cam, "lens", stat.get("lens"))
        setattr(cam, "width", stat.get("width"))
        setattr(cam, "height", stat.get("height"))

    zone_name = "Unassigned"
    if cam.assigned_zone_id:
        zone = db.query(Zone).filter(Zone.id == cam.assigned_zone_id).first()
        if zone:
            zone_name = zone.name
    setattr(cam, "zone_name", zone_name)
    return cam

@router.patch("/cameras/{camera_id}", response_model=CameraSchema, tags=["Cameras"])
def update_camera(camera_id: int, camera_update: CameraUpdate, db: Session = Depends(get_db)):
    from backend.app.models.domain import Zone
    cam = db.query(Camera).filter(Camera.id == camera_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    if camera_update.name is not None and camera_update.name.strip():
        cam.name = camera_update.name.strip()
        if camera_id in camera_manager.cameras:
            camera_manager.cameras[camera_id].name = cam.name
    if camera_update.assigned_zone_id is not None:
        cam.assigned_zone_id = camera_update.assigned_zone_id if camera_update.assigned_zone_id > 0 else None
        if camera_id in camera_manager.cameras:
            camera_manager.cameras[camera_id].zone_id = cam.assigned_zone_id
    if camera_update.status is not None:
        cam.status = camera_update.status
        if camera_id in camera_manager.cameras:
            camera_manager.cameras[camera_id].status = camera_update.status
    db.commit()
    db.refresh(cam)
    
    zone_name = "Unassigned"
    if cam.assigned_zone_id:
        zone = db.query(Zone).filter(Zone.id == cam.assigned_zone_id).first()
        if zone:
            zone_name = zone.name
    setattr(cam, "zone_name", zone_name)
    return cam

@router.delete("/cameras/{camera_id}", tags=["Cameras"])
def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    camera_manager.unregister_camera(db, camera_id)
    return {"status": "success"}

@router.get("/cameras/{camera_id}/qr-data", tags=["Cameras"])
def get_qr_data(camera_id: int, host: str = None, https_port: int = 8443, http_port: int = 8000):
    token = camera_manager.generate_phone_token(camera_id)
    lan_ip = get_local_ip()
    is_tunnel = bool(host and ("trycloudflare.com" in host or "loca.lt" in host or "ngrok" in host))
    tunnel_url = f"https://{host}/phone-camera/{camera_id}?token={token}" if is_tunnel else None
    
    lan_https = f"https://{lan_ip}:{https_port}/phone-camera/{camera_id}?token={token}"
    lan_http = f"http://{lan_ip}:{http_port}/phone-camera/{camera_id}?token={token}"
    
    # Primary URL: Use tunnel URL if accessing through tunnel, otherwise LAN HTTPS
    primary_url = tunnel_url if tunnel_url else lan_https
    
    return {
        "url": primary_url,
        "tunnel_url": tunnel_url,
        "https_url": lan_https,
        "http_url": lan_http,
        "token": token,
        "lan_ip": lan_ip,
        "camera_id": camera_id
    }

@router.get("/cameras/{camera_id}/feed", tags=["Cameras"])
async def get_camera_feed(camera_id: int, annotated: bool = True):
    """
    Live Motion-JPEG (MJPEG) streaming feed for the camera.
    Streams frames dynamically at the camera's native capture rate (up to 30 FPS)
    without dropping or sending redundant duplicate frames.
    Directly viewable in browser / React: <img src="/api/cameras/{id}/feed" />
    """
    async def frame_stream():
        last_sent_frame_id = -1
        viewer_event = asyncio.Event()

        # Register event listener to awaken instantly (<0.05ms) when frame arrives
        conn = camera_manager.cameras.get(camera_id)
        if conn:
            conn.add_listener(viewer_event)

        try:
            while True:
                conn = camera_manager.cameras.get(camera_id)
                if not conn or conn.status == "OFFLINE" or not conn.last_jpeg:
                    placeholder = camera_manager.get_placeholder_jpeg(camera_id, "Waiting for phone stream...")
                    yield (b"--frame\r\n"
                           b"Content-Type: image/jpeg\r\n\r\n" + placeholder + b"\r\n")
                    await asyncio.sleep(0.5)
                    conn = camera_manager.cameras.get(camera_id)
                    if conn and viewer_event not in conn.listeners:
                        conn.add_listener(viewer_event)
                    continue

                if viewer_event not in conn.listeners:
                    conn.add_listener(viewer_event)

                # Wait for instantaneous frame arrival event (no busy polling!)
                try:
                    viewer_event.clear()
                    await asyncio.wait_for(viewer_event.wait(), timeout=0.25)
                except asyncio.TimeoutError:
                    pass

                # Only yield when a brand-new frame has arrived from the client!
                if conn.frame_count != last_sent_frame_id:
                    last_sent_frame_id = conn.frame_count
                    frame = await camera_manager.get_rendered_frame_async(camera_id, annotate=annotated)
                    if frame:
                        yield (b"--frame\r\n"
                               b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")

        finally:
            conn = camera_manager.cameras.get(camera_id)
            if conn:
                conn.remove_listener(viewer_event)

    return StreamingResponse(
        frame_stream(), 
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )

@router.get("/cameras/{camera_id}/snapshot", tags=["Cameras"])
def get_camera_snapshot(camera_id: int, raw: bool = False):
    """
    Returns single snapshot image of the latest camera frame.
    If raw=True, returns pristine unannotated frame ideal for product training datasets.
    """
    frame = camera_manager.get_latest_jpeg(camera_id, prefer_annotated=not raw)
    if not frame:
        frame = camera_manager.get_placeholder_jpeg(camera_id, "Camera Offline")
    return Response(
        content=frame, 
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*"
        }
    )

# --- Zones CRUD ---
from backend.app.schemas.schemas import ZoneCreate, ZoneSchema, ZoneUpdate
from backend.app.models.domain import Zone, ZoneProduct

@router.post("/zones", response_model=ZoneSchema, tags=["Zones"])
def create_zone(zone_in: ZoneCreate, db: Session = Depends(get_db)):
    zone = Zone(**zone_in.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone

@router.get("/zones", tags=["Zones"])
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    result = []
    for z in zones:
        cams = db.query(Camera).filter(Camera.assigned_zone_id == z.id).all()
        zp_list = db.query(ZoneProduct).filter(ZoneProduct.zone_id == z.id).all()
        prod_ids = [zp.product_id for zp in zp_list]
        prods = db.query(Product).filter(Product.id.in_(prod_ids)).all() if prod_ids else []
        result.append({
            "id": z.id,
            "name": z.name,
            "description": z.description,
            "location": z.location,
            "cameras": [
                {
                    "id": c.id, 
                    "name": c.name, 
                    "status": camera_manager.get_camera_status(c.id)["status"] if camera_manager.get_camera_status(c.id) else c.status
                } 
                for c in cams
            ],
            "products": [
                {
                    "id": p.id, 
                    "name": p.name, 
                    "stock": p.current_stock, 
                    "sku": p.sku
                } 
                for p in prods
            ]
        })
    return result

@router.delete("/zones/{zone_id}", tags=["Zones"])
def delete_zone(zone_id: int, db: Session = Depends(get_db)):
    db.query(ZoneProduct).filter(ZoneProduct.zone_id == zone_id).delete()
    db.query(Camera).filter(Camera.assigned_zone_id == zone_id).update({"assigned_zone_id": None})
    db.query(Zone).filter(Zone.id == zone_id).delete()
    db.commit()
    return {"status": "success"}

@router.post("/zones/{zone_id}/cameras", tags=["Zones"])
def assign_camera_to_zone(zone_id: int, body: dict, db: Session = Depends(get_db)):
    camera_id = body.get("camera_id")
    if not camera_id:
        raise HTTPException(400, "camera_id required")
    cam = db.query(Camera).filter(Camera.id == int(camera_id)).first()
    if not cam:
        raise HTTPException(404, "Camera not found")
    cam.assigned_zone_id = zone_id
    db.commit()
    return {"status": "success"}

@router.post("/zones/{zone_id}/products", tags=["Zones"])
def assign_product_to_zone(zone_id: int, body: dict, db: Session = Depends(get_db)):
    product_id = body.get("product_id")
    if not product_id:
        raise HTTPException(400, "product_id required")
    # Avoid duplicate
    existing = db.query(ZoneProduct).filter(ZoneProduct.zone_id == zone_id, ZoneProduct.product_id == int(product_id)).first()
    if not existing:
        zp = ZoneProduct(zone_id=zone_id, product_id=int(product_id))
        db.add(zp)
        db.commit()
    return {"status": "success"}

# --- Interaction Details & Analytics ---
from backend.app.models.domain import InteractionDetail

@router.get("/interactions/detailed", tags=["Analytics"])
def get_detailed_interactions(db: Session = Depends(get_db)):
    return db.query(InteractionDetail).order_by(InteractionDetail.pickup_timestamp.desc()).limit(100).all()

@router.get("/interactions/timeline", tags=["Interactions"])
def get_interactions_timeline(db: Session = Depends(get_db)):
    details = db.query(InteractionDetail).order_by(InteractionDetail.pickup_timestamp.desc()).limit(100).all()
    timeline = []
    for d in details:
        interaction = db.query(Interaction).filter(Interaction.id == d.interaction_id).first()
        prod = db.query(Product).filter(Product.id == interaction.product_id).first() if interaction else None
        cam = db.query(Camera).filter(Camera.id == d.camera_id).first() if d.camera_id else None
        zone = db.query(Zone).filter(Zone.id == d.zone_id).first() if d.zone_id else None
        
        action = "REPLACED" if d.was_replaced else "TAKEN"
        timeline.append({
            "id": d.id,
            "timestamp": d.pickup_timestamp.isoformat() if d.pickup_timestamp else datetime.utcnow().isoformat(),
            "product_name": prod.name if prod else "Unknown Product",
            "product_id": prod.id if prod else None,
            "action": action,
            "camera_name": cam.name if cam else "Camera",
            "zone_name": zone.name if zone else "General Shelf",
            "hold_duration": d.hold_duration_seconds,
            "inferred_reason": d.inferred_reason,
            "product_image": prod.image_url if prod else None
        })
    return timeline

@router.get("/analytics/dwell-patterns", tags=["Analytics"])
def get_dwell_patterns(db: Session = Depends(get_db)):
    details = db.query(InteractionDetail).all()
    if not details:
        return []
    product_map = {}
    for d in details:
        interaction = db.query(Interaction).filter(Interaction.id == d.interaction_id).first()
        prod = db.query(Product).filter(Product.id == interaction.product_id).first() if interaction else None
        name = prod.name if prod else "Product"
        if name not in product_map:
            product_map[name] = {"durations": [], "replaces": 0, "total": 0}
        product_map[name]["total"] += 1
        if d.hold_duration_seconds:
            product_map[name]["durations"].append(d.hold_duration_seconds)
        if d.was_replaced:
            product_map[name]["replaces"] += 1

    return [
        {
            "product_name": name,
            "avg_hold_duration": round(sum(data["durations"]) / len(data["durations"]), 1) if data["durations"] else 0.0,
            "total_pickups": data["total"],
            "replacement_rate": round(data["replaces"] / data["total"], 2) if data["total"] > 0 else 0.0
        }
        for name, data in product_map.items()
    ]

@router.get("/analytics/replacement-reasons", tags=["Analytics"])
def get_replacement_reasons(db: Session = Depends(get_db)):
    details = db.query(InteractionDetail).filter(InteractionDetail.was_replaced == True).all()
    if not details:
        return []
    reasons = {}
    for d in details:
        r = d.inferred_reason or "Unspecified"
        reasons[r] = reasons.get(r, 0) + 1
    total = len(details)
    return [
        {"reason": r, "count": cnt, "percentage": round((cnt / total) * 100, 1)}
        for r, cnt in reasons.items()
    ]

# --- Stock Quick Adjust ---
@router.patch("/products/{product_id}/stock", tags=["Products"])
def adjust_product_stock(product_id: int, body: dict, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if "delta" in body:
        delta = int(body["delta"])
        prod.current_stock = max(0, (prod.current_stock or 0) + delta)
    elif "stock" in body:
        prod.current_stock = max(0, int(body["stock"]))
        
    db.commit()
    db.refresh(prod)
    return {
        "status": "success",
        "id": prod.id,
        "name": prod.name,
        "current_stock": prod.current_stock
    }

# --- Zone Unassignment ---
@router.delete("/zones/{zone_id}/cameras/{camera_id}", tags=["Zones"])
def unassign_camera_from_zone(zone_id: int, camera_id: int, db: Session = Depends(get_db)):
    cam = db.query(Camera).filter(Camera.id == camera_id, Camera.assigned_zone_id == zone_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Camera assignment not found")
    cam.assigned_zone_id = None
    db.commit()
    return {"status": "success", "message": f"Camera {camera_id} unassigned from zone {zone_id}"}

@router.delete("/zones/{zone_id}/products/{product_id}", tags=["Zones"])
def unassign_product_from_zone(zone_id: int, product_id: int, db: Session = Depends(get_db)):
    zp = db.query(ZoneProduct).filter(ZoneProduct.zone_id == zone_id, ZoneProduct.product_id == product_id).first()
    if not zp:
        raise HTTPException(status_code=404, detail="Product assignment not found")
    db.delete(zp)
    db.commit()
    return {"status": "success", "message": f"Product {product_id} unassigned from zone {zone_id}"}

# --- Maintenance & Cleanliness ---
@router.post("/maintenance/cleanup-cameras", tags=["Maintenance"])
def cleanup_offline_cameras(db: Session = Depends(get_db)):
    """
    Cleans up duplicate/offline test cameras that have no active live stream.
    """
    all_cams = db.query(Camera).all()
    deleted_count = 0
    for cam in all_cams:
        stat = camera_manager.get_camera_status(cam.id)
        is_live = stat and stat.get("status") in ["ONLINE", "LIVE"]
        if not is_live:
            camera_manager.unregister_camera(db, cam.id)
            deleted_count += 1
    return {"status": "success", "deleted_cameras": deleted_count}

@router.post("/maintenance/reset-demo-data", tags=["Maintenance"])
def reset_demo_data(db: Session = Depends(get_db)):
    """
    Optionally resets events, alerts, and offline test cameras for a fresh store run.
    """
    db.query(Alert).delete()
    db.query(Event).delete()
    db.query(InteractionDetail).delete()
    db.query(Interaction).delete()
    # Remove offline cameras
    all_cams = db.query(Camera).all()
    for cam in all_cams:
        stat = camera_manager.get_camera_status(cam.id)
        if not stat or stat.get("status") != "ONLINE":
            camera_manager.unregister_camera(db, cam.id)
    db.commit()
    return {"status": "success", "message": "Demo data reset successfully"}


# =========================================================================
# Enterprise Upgrades (D-Mart / Reliance Retail Scale & Executive Modules)
# =========================================================================

# --- Autonomous Virtual Cart & POS Checkout ---
@router.get("/cart/active", tags=["Checkout & POS"])
def get_all_active_carts(db: Session = Depends(get_db)):
    """
    Returns all shoppers currently holding active virtual baskets with live items and running subtotals.
    """
    return shared_cart_service.get_all_active_carts(db)

@router.get("/cart/{customer_track_id}", tags=["Checkout & POS"])
def get_customer_cart(customer_track_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the virtual basket for a specific shopper.
    """
    return shared_cart_service.get_customer_cart(db, customer_track_id)

@router.post("/cart/{customer_track_id}/checkout", tags=["Checkout & POS"])
def autonomous_checkout(customer_track_id: int, body: dict = None, db: Session = Depends(get_db)):
    """
    Executes autonomous 'Just Walk Out' checkout, marks basket checked out, deducts inventory,
    and generates an official GST Tax Invoice.
    """
    payment_method = (body or {}).get("payment_method", "AUTONOMOUS_JUST_WALK_OUT")
    try:
        invoice = shared_cart_service.checkout_customer(db, customer_track_id, payment_method=payment_method)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/invoices", tags=["Invoices"])
def list_invoices(db: Session = Depends(get_db)):
    """
    Returns all completed tax invoices.
    """
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).limit(100).all()
    results = []
    for inv in invoices:
        items = []
        try:
            items = json.loads(inv.items_json) if inv.items_json else []
        except Exception:
            pass
        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_track_id": inv.customer_track_id,
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "total_amount": inv.total_amount,
            "payment_status": inv.payment_status,
            "payment_method": inv.payment_method,
            "items_count": len(items),
            "items": items,
            "created_at": inv.created_at.isoformat()
        })
    return results

@router.get("/invoices/{invoice_id}", tags=["Invoices"])
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    items = []
    try:
        items = json.loads(inv.items_json) if inv.items_json else []
    except Exception:
        pass
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "customer_track_id": inv.customer_track_id,
        "subtotal": inv.subtotal,
        "tax_amount": inv.tax_amount,
        "total_amount": inv.total_amount,
        "payment_status": inv.payment_status,
        "payment_method": inv.payment_method,
        "items": items,
        "created_at": inv.created_at.isoformat(),
        "store_info": {
            "name": "MetaRetail Autonomous Store (Smart Express)",
            "location": "Aisle 4, Tech Plaza, Bengaluru",
            "gstin": "29AABCU9603R1ZM",
            "fssai": "11223344556677"
        }
    }


# --- 2D Store Topology & Spatial Heatmap ---
@router.get("/store/topology", tags=["Store Topology"])
def get_store_topology(db: Session = Depends(get_db)):
    """
    Returns 2D vector coordinate mapping of aisles, cameras with FOV cones,
    real-time customer dots, and dwell density heatmaps.
    """
    active_carts = shared_cart_service.get_all_active_carts(db)
    active_customers = [
        {"track_id": c["customer_track_id"], "dwell_seconds": 12.0}
        for c in active_carts
    ]
    # Query genuinely active customers in store from Customer table (active shoppers who have not exited)
    if not active_customers:
        active_db_customers = db.query(Customer).filter(Customer.exit_time.is_(None)).order_by(Customer.entry_time.desc()).limit(10).all()
        if active_db_customers:
            active_customers = [
                {"track_id": c.track_id or c.id, "dwell_seconds": max(5.0, c.dwell_time or 12.0)}
                for c in active_db_customers
            ]
    return shared_topology_service.get_topology(db, active_customers=active_customers)


# --- Cloudflare Public Tunnel Service ---
@router.get("/tunnel/status", tags=["Cloudflare Tunnel"])
def get_tunnel_status():
    """
    Returns whether the zero-config Cloudflare public tunnel is running and its public HTTPS URL.
    """
    return shared_tunnel_manager.get_status()

@router.post("/tunnel/start", tags=["Cloudflare Tunnel"])
def start_public_tunnel():
    """
    Starts cloudflared public tunnel, provisioning a globally valid trycloudflare.com URL.
    """
    return shared_tunnel_manager.start_tunnel()

@router.post("/tunnel/stop", tags=["Cloudflare Tunnel"])
def stop_public_tunnel():
    """
    Stops the cloudflared public tunnel.
    """
    return shared_tunnel_manager.stop_tunnel()


# --- Security & Loss Prevention ---
@router.get("/security/incidents", tags=["Loss Prevention"])
def get_security_incidents(db: Session = Depends(get_db)):
    """
    Returns all detected loss prevention and shrinkage anomalies.
    """
    incidents = db.query(SecurityIncident).order_by(SecurityIncident.created_at.desc()).limit(50).all()
    return [
        {
            "id": inc.id,
            "incident_type": inc.incident_type,
            "risk_score": inc.risk_score,
            "customer_track_id": inc.customer_track_id,
            "camera_id": inc.camera_id,
            "zone_id": inc.zone_id,
            "description": inc.description,
            "recommended_action": inc.recommended_action,
            "status": inc.status,
            "created_at": inc.created_at.isoformat(),
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None
        }
        for inc in incidents
    ]

@router.post("/security/incidents/{incident_id}/resolve", tags=["Loss Prevention"])
def resolve_security_incident(incident_id: int, db: Session = Depends(get_db)):
    inc = db.query(SecurityIncident).filter(SecurityIncident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    inc.status = "RESOLVED"
    inc.resolved_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": f"Incident #{incident_id} marked as RESOLVED"}


# --- Executive Commercial Intelligence & CSV Export ---
@router.get("/analytics/executive-summary", tags=["Executive Analytics"])
def get_executive_summary(db: Session = Depends(get_db)):
    """
    High-level commercial KPIs for retail executives (D-Mart / Reliance / C-Suite):
    GMV, Velocity, Average Basket Value, Funnel conversion, and SKU affinity.
    """
    invoices = db.query(Invoice).all()
    total_gmv = sum(inv.total_amount for inv in invoices)
    total_orders = len(invoices)
    abv = round(total_gmv / max(1, total_orders), 2)

    # Real Conversion Funnel from database
    total_customers = db.query(Customer).count()
    if total_customers < total_orders:
        total_customers = max(total_orders, 1)

    pickups = db.query(Interaction).filter(Interaction.action.ilike("%PICK%")).count()
    cart_items_count = db.query(CartItem).count()

    funnel = [
        {"stage": "Store Footfall", "count": total_customers, "conversion_pct": 100.0},
        {"stage": "Shelf Engagement", "count": pickups, "conversion_pct": round((pickups / max(1, total_customers)) * 100, 1)},
        {"stage": "Basket Additions", "count": cart_items_count, "conversion_pct": round((cart_items_count / max(1, total_customers)) * 100, 1)},
        {"stage": "Completed Autonomous Checkout", "count": total_orders, "conversion_pct": round((total_orders / max(1, total_customers)) * 100, 1)}
    ]

    # Dynamic Market Basket Analysis (SKU Affinity Matrix from real invoices)
    from collections import Counter
    pair_counts = Counter()
    for inv in invoices:
        try:
            items = json.loads(inv.items_json) if isinstance(inv.items_json, str) else (inv.items_json or [])
            item_names = sorted(list(set(it.get("product_name") for it in items if isinstance(it, dict) and it.get("product_name"))))
            for i in range(len(item_names)):
                for j in range(i + 1, len(item_names)):
                    pair_counts[(item_names[i], item_names[j])] += 1
        except Exception:
            pass

    affinity = []
    for (p1, p2), cnt in pair_counts.most_common(5):
        score = min(99, int((cnt / max(1, total_orders)) * 100) + 35)
        affinity.append({
            "pair": f"{p1} + {p2}",
            "affinity_score": score,
            "confidence": "High" if score > 70 else "Medium",
            "cross_sell_revenue": f"₹{cnt * 120}"
        })

    # Real Shrinkage Prevented metric from resolved incidents
    incidents_count = db.query(SecurityIncident).filter(SecurityIncident.status == "RESOLVED").count()
    est_shrinkage_saved = incidents_count * 450.0  # Estimated average shrinkage prevented per intervention

    # Dynamic Planogram Compliance Score
    prods = db.query(Product).all()
    healthy_slots = sum(1 for p in prods if (p.current_stock or 0) > (p.min_stock_threshold or 3))
    planogram_score = round((healthy_slots / max(1, len(prods))) * 100, 1)

    return {
        "gross_merchandise_value": round(total_gmv, 2),
        "total_completed_orders": total_orders,
        "average_basket_value": abv,
        "projected_daily_velocity": round(total_gmv * 3.5, 2) if total_gmv > 0 else 0.0,
        "conversion_funnel": funnel,
        "sku_affinity_matrix": affinity,
        "shrinkage_prevented_inr": round(est_shrinkage_saved, 2),
        "planogram_compliance_score_pct": planogram_score,
        "currency": "INR",
        "currency_symbol": "₹"
    }

@router.get("/analytics/export/csv", tags=["Executive Analytics"])
def export_store_csv(db: Session = Depends(get_db)):
    """
    Generates a live downloadable CSV audit report for commercial store operations.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header section
    writer.writerow(["=== METARETAIL AI - EXECUTIVE STORE AUDIT REPORT ==="])
    writer.writerow(["Generated At", datetime.utcnow().isoformat()])
    writer.writerow(["Store", "MetaRetail Smart Express Flagship"])
    writer.writerow([])

    # Invoices table
    writer.writerow(["--- COMPLETED TRANSACTIONS ---"])
    writer.writerow(["Invoice Number", "Customer Track ID", "Subtotal (INR)", "Tax 18% (INR)", "Total Amount (INR)", "Payment Method", "Timestamp"])
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    for inv in invoices:
        writer.writerow([inv.invoice_number, inv.customer_track_id, inv.subtotal, inv.tax_amount, inv.total_amount, inv.payment_method, inv.created_at.isoformat()])
    writer.writerow([])

    # Product stock table
    writer.writerow(["--- INVENTORY AUDIT ---"])
    writer.writerow(["SKU", "Product Name", "Category", "Current Stock", "Min Threshold", "Unit Price (INR)"])
    products = db.query(Product).all()
    for p in products:
        writer.writerow([p.sku, p.name, p.category, p.current_stock, p.min_stock_threshold, p.unit_price])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=metaretail_audit_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.get("/analytics/export/pdf", tags=["Executive Analytics"])
def export_warehouse_pdf(db: Session = Depends(get_db)):
    """
    Generates a beautifully formatted executive PDF report for warehouse operations,
    detailing sales breakdowns, itemized sold quantities, revenues, and inventory levels.
    """
    from backend.app.services.pdf_report_service import build_warehouse_pdf_report
    
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    products = db.query(Product).order_by(Product.name).all()
    customers = db.query(Customer).all()
    incidents = db.query(SecurityIncident).all()
    
    pdf_bytes = build_warehouse_pdf_report(
        invoices=invoices,
        products=products,
        customers=customers,
        incidents=incidents
    )
    
    timestamp_str = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=metaretail_warehouse_sales_audit_{timestamp_str}.pdf"
        }
    )


# --- BigQuery AI/ML Integration & Data Sync ---
from backend.app.services.bigquery_service import shared_bigquery_service
from fastapi.responses import FileResponse

@router.post("/bigquery/export", tags=["BigQuery AI/ML"])
def export_to_bigquery(db: Session = Depends(get_db)):
    """
    Exports local store transactions, footfall, shelf interactions, and incidents
    into BigQuery-compliant Newline-Delimited JSON (NDJSON) files and generates bq load script.
    """
    export_result = shared_bigquery_service.export_all_tables(db)
    return {
        "status": "success",
        "message": "Store data serialized into BigQuery NDJSON format.",
        "exports": export_result
    }

@router.get("/bigquery/scripts", tags=["BigQuery AI/ML"])
def get_bigquery_sql_scripts():
    """
    Returns pre-built BigQuery AI/ML SQL scripts (TimesFM 2.0 forecasting, anomaly detection, Gemini 2.5 Flash extraction).
    """
    scripts = shared_bigquery_service.get_bundled_sql_scripts()
    return {
        "dataset": "retail_enterprise_bi",
        "total_scripts": len(scripts),
        "scripts": scripts
    }

@router.get("/bigquery/download/{filename}", tags=["BigQuery AI/ML"])
def download_bigquery_file(filename: str):
    """
    Downloads an exported NDJSON file or ingestion script.
    """
    file_path = os.path.join(shared_bigquery_service.exports_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File {filename} not found.")
    media_type = "application/x-ndjson" if filename.endswith(".ndjson") else "application/x-sh"
    return FileResponse(file_path, media_type=media_type, filename=filename)


# --- Autonomous Store Simulation Engine ---
from ai.simulation.store_simulator import shared_store_simulator

@router.post("/simulation/toggle", tags=["Store Simulation"])
def toggle_store_simulation(body: Optional[dict] = Body(default=None)):
    """
    Starts or stops the autonomous background multi-shopper simulation engine.
    """
    speed = float((body or {}).get("speed", 1.0))
    if shared_store_simulator.is_running:
        shared_store_simulator.stop()
    else:
        shared_store_simulator.start(speed=speed)
    return {
        "status": "success",
        "simulation": shared_store_simulator.get_status()
    }

@router.get("/simulation/status", tags=["Store Simulation"])
def get_simulation_status():
    """
    Returns current simulation engine metrics, active simulated shoppers, and speed.
    """
    return shared_store_simulator.get_status()


# --- AI Retail Copilot Intelligence ---
from backend.app.services.copilot_service import shared_copilot_service

@router.post("/copilot/chat", tags=["AI Copilot"])
def copilot_chat(body: Optional[dict] = Body(default=None), db: Session = Depends(get_db)):
    """
    Processes natural language store management inquiries grounded in real-time retail telemetry.
    """
    query = (body or {}).get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    return shared_copilot_service.process_query(db, query)


# --- Real-Time Action Audit Logging ---
from fastapi.responses import FileResponse

@router.get("/logs/actions", tags=["Audit Logs"])
def get_action_audit_logs(limit: int = 150):
    """
    Returns recent action audit logs recorded during user testing.
    """
    log_path = "logs/action_audit.log"
    if not os.path.exists(log_path):
        return {"total_lines": 0, "recent_count": 0, "logs": []}
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        recent = [line.strip() for line in lines[-limit:]]
        return {
            "total_lines": len(lines),
            "recent_count": len(recent),
            "logs": recent
        }
    except Exception as e:
        return {"error": str(e), "logs": []}

@router.get("/logs/actions/download", tags=["Audit Logs"])
def download_action_audit_log():
    """
    Downloads the complete action_audit.log file.
    """
    log_path = "logs/action_audit.log"
    if not os.path.exists(log_path):
        raise HTTPException(status_code=404, detail="Action audit log file not found.")
    return FileResponse(
        path=log_path,
        media_type="text/plain",
        filename="metaretail_action_audit.log"
    )
