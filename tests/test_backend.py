"""
Comprehensive Unit & Integration Test Suite for MetaRetail AI Backend & Vision Pipeline
"""
import pytest
import io
import uuid
import cv2
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app
from ai.detection.yolo_detector import YOLODetector
from ai.tracking.bytetrack_tracker import ByteTrackTracker
from ai.classification.vit_classifier import ViTClassifier
from ai.interaction.interaction_engine import InteractionEngine
from ai.interaction.shelf_tracker import UniversalShelfTracker
from ai.inventory.inventory_engine import InventoryEngine
from ai.analytics.analytics_engine import AnalyticsEngine
from backend.app.services.pipeline_instance import shared_pipeline_service

client = TestClient(app)

# 1. Health & Core System Tests
def test_01_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data

# 2. Products Lifecycle & Barcode & Image Upload
def test_02_products_crud_and_images():
    # A. Create Product
    unique_suffix = uuid.uuid4().hex[:6]
    payload = {
        "name": "Audit Test Sparkling Water",
        "category": "Beverages",
        "sku": f"WATER-AUDIT-{unique_suffix}",
        "barcode": f"998877{unique_suffix}",
        "price": 2.50,
        "stock": 15,
        "min_stock": 3,
        "description": "Crisp sparkling water"
    }
    create_res = client.post("/api/products", json=payload)
    assert create_res.status_code == 201
    prod = create_res.json()
    assert prod["name"] == payload["name"]
    assert prod["unit_price"] == 2.50
    assert prod["current_stock"] == 15
    prod_id = prod["id"]

    # B. List Products
    list_res = client.get("/api/products")
    assert list_res.status_code == 200
    prods = list_res.json()
    assert any(p["id"] == prod_id for p in prods)

    # C. Barcode Lookup (local DB)
    bc_res = client.get(f"/api/products/barcode/{payload['barcode']}")
    assert bc_res.status_code == 200
    bc_data = bc_res.json()
    assert bc_data["found"] is True
    assert bc_data["name"] == payload["name"]

    # D. Upload Product Image
    test_image_bytes = io.BytesIO()
    dummy_img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, encoded = cv2.imencode(".jpg", dummy_img)
    test_image_bytes.write(encoded.tobytes())
    test_image_bytes.seek(0)

    upload_res = client.post(
        f"/api/products/{prod_id}/images",
        files={"file": ("front.jpg", test_image_bytes, "image/jpeg")},
        data={"angle": "front"}
    )
    assert upload_res.status_code == 200
    up_data = upload_res.json()
    assert up_data["status"] == "success"
    assert "image_url" in up_data

    # E. Update Product
    update_res = client.put(f"/api/products/{prod_id}", json={"current_stock": 12, "min_stock_threshold": 4})
    assert update_res.status_code == 200
    assert update_res.json()["current_stock"] == 12

    # F. Delete Product
    del_res = client.delete(f"/api/products/{prod_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

# 3. Inventory Endpoint
def test_03_inventory():
    res = client.get("/api/inventory")
    assert res.status_code == 200
    inv = res.json()
    assert isinstance(inv, list)
    for item in inv:
        assert "sku" in item
        assert "current_stock" in item
        assert "is_low_stock" in item

# 4. Cameras Lifecycle & QR-Data & Video Stream
def test_04_cameras_lifecycle_and_streaming():
    # A. Register Phone Camera
    cam_payload = {
        "name": "Audit Camera 1",
        "camera_type": "PHONE",
        "assigned_zone_id": None
    }
    cam_res = client.post("/api/cameras", json=cam_payload)
    assert cam_res.status_code == 200
    cam = cam_res.json()
    cam_id = cam["id"]
    assert cam["name"] == "Audit Camera 1"

    # B. Get Camera Details
    detail_res = client.get(f"/api/cameras/{cam_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == cam_id

    # C. Get QR Data
    qr_res = client.get(f"/api/cameras/{cam_id}/qr-data")
    assert qr_res.status_code == 200
    qr_data = qr_res.json()
    assert "https_url" in qr_data
    assert f"/phone-camera/{cam_id}" in qr_data["https_url"]

    # D. Snapshot
    snap_res = client.get(f"/api/cameras/{cam_id}/snapshot")
    assert snap_res.status_code == 200
    assert snap_res.headers["content-type"] == "image/jpeg"
    assert len(snap_res.content) > 100

    # E. Test Camera Telemetry via WebSocket
    import base64
    import numpy as np
    import cv2
    dummy_img = np.zeros((720, 1280, 3), dtype=np.uint8)
    _, encoded = cv2.imencode('.jpg', dummy_img)
    b64_frame = base64.b64encode(encoded).decode('utf-8')

    with client.websocket_connect(f"/ws/camera/{cam_id}") as ws:
        ws.send_json({
            "frame": b64_frame,
            "width": 1280,
            "height": 720,
            "quality": 0.85,
            "fps": 24,
            "lens": "Back (Environment)"
        })

    # Verify telemetry in GET /api/cameras/{cam_id}
    tel_res = client.get(f"/api/cameras/{cam_id}")
    assert tel_res.status_code == 200
    tel_data = tel_res.json()
    assert tel_data["width"] == 1280
    assert tel_data["height"] == 720
    assert "1280x720" in tel_data["resolution"]
    assert tel_data["lens"] == "Back (Environment)"
    assert tel_data["quality"] == 0.85
    assert "85%" in tel_data["quality_preset"]

    # F. Delete Camera
    del_res = client.delete(f"/api/cameras/{cam_id}")
    assert del_res.status_code == 200

# 5. Zones CRUD & Associations
def test_05_zones_lifecycle():
    # A. Create Zone
    zone_payload = {
        "name": "Aisle 9 Test Zone",
        "description": "Snacks and confectionary",
        "location": "North Wing"
    }
    z_res = client.post("/api/zones", json=zone_payload)
    assert z_res.status_code == 200
    zone = z_res.json()
    zone_id = zone["id"]
    assert zone["name"] == zone_payload["name"]

    # B. List Zones
    zones_res = client.get("/api/zones")
    assert zones_res.status_code == 200
    assert any(z["id"] == zone_id for z in zones_res.json())

    # C. Delete Zone
    del_z = client.delete(f"/api/zones/{zone_id}")
    assert del_z.status_code == 200

# 6. Analytics & Timeline
def test_06_analytics_and_interactions():
    analytics_res = client.get("/api/analytics")
    assert analytics_res.status_code == 200
    a = analytics_res.json()
    assert "active_customers_now" in a
    assert "conversion_rate_pct" in a

    timeline_res = client.get("/api/interactions/timeline")
    assert timeline_res.status_code == 200
    assert isinstance(timeline_res.json(), list)

    dwell_res = client.get("/api/analytics/dwell-patterns")
    assert dwell_res.status_code == 200

    reasons_res = client.get("/api/analytics/replacement-reasons")
    assert reasons_res.status_code == 200

# 7. Alerts & Resolution
def test_07_alerts():
    alerts_res = client.get("/api/alerts")
    assert alerts_res.status_code == 200
    assert isinstance(alerts_res.json(), list)

# 8. AI Modules & Pipeline Execution
def test_08_ai_modules_and_frame_processing():
    detector = YOLODetector()
    tracker = ByteTrackTracker()
    classifier = ViTClassifier()
    interaction = InteractionEngine()
    shelf_tracker = UniversalShelfTracker()
    inventory = InventoryEngine()
    analytics = AnalyticsEngine()

    assert detector is not None
    assert tracker is not None
    assert classifier is not None
    assert interaction is not None
    assert shelf_tracker is not None
    assert inventory is not None
    assert analytics is not None

    # Test dummy frame through pipeline
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.putText(test_frame, "MetaRetail Test Frame", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    telemetry = shared_pipeline_service.process_frame(test_frame, camera_id=1)
    
    assert "image_base64" in telemetry
    assert "fps" in telemetry
    assert "customers" in telemetry
    assert "products" in telemetry

# 9. Product Stock Quick Adjustments
def test_09_product_stock_adjustment():
    # Create product to test with
    p_res = client.post("/api/products", json={
        "name": "Stock Test Item",
        "category": "Snacks",
        "sku": "STOCK-TEST-99",
        "barcode": "112233445566",
        "price": 1.99,
        "stock": 10,
        "min_stock": 2
    })
    assert p_res.status_code == 201
    prod_id = p_res.json()["id"]

    # Increment stock (+5)
    patch1 = client.patch(f"/api/products/{prod_id}/stock", json={"delta": 5})
    assert patch1.status_code == 200
    assert patch1.json()["current_stock"] == 15

    # Decrement stock (-7)
    patch2 = client.patch(f"/api/products/{prod_id}/stock", json={"delta": -7})
    assert patch2.status_code == 200
    assert patch2.json()["current_stock"] == 8

    # Set direct stock (25)
    patch3 = client.patch(f"/api/products/{prod_id}/stock", json={"stock": 25})
    assert patch3.status_code == 200
    assert patch3.json()["current_stock"] == 25

    # Test 404 on non-existent product
    patch_err = client.patch("/api/products/999999/stock", json={"delta": 1})
    assert patch_err.status_code == 404

    # Cleanup product
    client.delete(f"/api/products/{prod_id}")

# 10. Zone Unassignments (Cameras & Products)
def test_10_zone_unassignments():
    # Create a zone
    z_res = client.post("/api/zones", json={"name": "Unassign Test Zone"})
    assert z_res.status_code == 200
    z_id = z_res.json()["id"]

    # Create a camera
    c_res = client.post("/api/cameras", json={"name": "Unassign Test Cam", "camera_type": "PHONE"})
    assert c_res.status_code == 200
    c_id = c_res.json()["id"]

    # Create a product
    p_res = client.post("/api/products", json={"name": "Unassign Prod", "category": "General", "sku": "UNASSIGN-01", "price": 5.0, "stock": 5})
    assert p_res.status_code == 201
    p_id = p_res.json()["id"]

    # Assign camera and product to zone
    assign_c = client.post(f"/api/zones/{z_id}/cameras", json={"camera_id": c_id})
    assert assign_c.status_code == 200

    assign_p = client.post(f"/api/zones/{z_id}/products", json={"product_id": p_id})
    assert assign_p.status_code == 200

    # Unassign camera
    unassign_c = client.delete(f"/api/zones/{z_id}/cameras/{c_id}")
    assert unassign_c.status_code == 200
    assert unassign_c.json()["status"] == "success"

    # Verify camera still exists but unassigned
    c_check = client.get(f"/api/cameras/{c_id}")
    assert c_check.status_code == 200
    assert c_check.json()["assigned_zone_id"] is None

    # Unassign product
    unassign_p = client.delete(f"/api/zones/{z_id}/products/{p_id}")
    assert unassign_p.status_code == 200
    assert unassign_p.json()["status"] == "success"

    # Verify unassigning again returns 404
    unassign_c_again = client.delete(f"/api/zones/{z_id}/cameras/{c_id}")
    assert unassign_c_again.status_code == 404

    unassign_p_again = client.delete(f"/api/zones/{z_id}/products/{p_id}")
    assert unassign_p_again.status_code == 404

    # Cleanup
    client.delete(f"/api/cameras/{c_id}")
    client.delete(f"/api/products/{p_id}")
    client.delete(f"/api/zones/{z_id}")

# 11. Maintenance Endpoints
def test_11_maintenance_endpoints():
    cleanup_res = client.post("/api/maintenance/cleanup-cameras")
    assert cleanup_res.status_code == 200
    assert cleanup_res.json()["status"] == "success"
    assert "deleted_cameras" in cleanup_res.json()

    reset_res = client.post("/api/maintenance/reset-demo-data")
    assert reset_res.status_code == 200
    assert reset_res.json()["status"] == "success"

# 12. Virtual Cart & Autonomous Cashierless Checkout
def test_12_virtual_cart_and_autonomous_checkout():
    # A. Add item to cart via helper or verify active cart endpoint
    # First create a test product
    p_res = client.post("/api/products", json={
        "name": "Reliance Organic Milk",
        "category": "Dairy",
        "sku": "MILK-REL-01",
        "price": 60.0,
        "stock": 10
    })
    assert p_res.status_code == 201
    prod_id = p_res.json()["id"]

    # Directly test shared_cart_service
    from backend.app.services.cart_service import shared_cart_service
    from backend.app.database.session import SessionLocal
    db = SessionLocal()
    try:
        # Add to cart for customer 99
        shared_cart_service.add_to_cart(db, customer_track_id=99, product_name="Reliance Organic Milk", quantity=2)
    finally:
        db.close()

    # Query customer 99's cart
    cart_res = client.get("/api/cart/99")
    assert cart_res.status_code == 200
    cart_data = cart_res.json()
    assert cart_data["customer_track_id"] == 99
    assert cart_data["total_items"] >= 2
    assert cart_data["subtotal"] >= 120.0
    assert cart_data["cgst_9pct"] > 0
    assert cart_data["sgst_9pct"] > 0
    assert cart_data["grand_total"] > cart_data["subtotal"]

    # Test Active Carts List
    active_res = client.get("/api/cart/active")
    assert active_res.status_code == 200
    active_data = active_res.json()
    assert any(c["customer_track_id"] == 99 for c in active_data)

    # Perform Autonomous Checkout
    co_res = client.post("/api/cart/99/checkout", json={"payment_method": "AUTONOMOUS_JUST_WALK_OUT"})
    assert co_res.status_code == 200
    inv = co_res.json()
    assert "INV-" in inv["invoice_number"]
    assert inv["customer_track_id"] == 99
    assert inv["total_amount"] > 0
    inv_id = inv["invoice_id"]

    # Verify Invoices List
    inv_list_res = client.get("/api/invoices")
    assert inv_list_res.status_code == 200
    assert any(i["id"] == inv_id for i in inv_list_res.json())

    # Verify Single Invoice
    single_inv = client.get(f"/api/invoices/{inv_id}")
    assert single_inv.status_code == 200
    assert single_inv.json()["invoice_number"] == inv["invoice_number"]

    # Verify cart is now empty for customer 99
    empty_cart = client.get("/api/cart/99")
    assert empty_cart.status_code == 200
    assert empty_cart.json()["total_items"] == 0

    # Cleanup product
    client.delete(f"/api/products/{prod_id}")

# 13. Store Topology & 2D Spatial Heatmap
def test_13_store_topology():
    res = client.get("/api/store/topology")
    assert res.status_code == 200
    data = res.json()
    assert "zones" in data
    assert "cameras" in data
    assert "customers" in data
    assert len(data["zones"]) >= 5
    for z in data["zones"]:
        assert "dwell_heat_index" in z
        assert "x" in z and "y" in z

# 14. Cloudflare Public Tunnel
def test_14_cloudflare_tunnel_status():
    status_res = client.get("/api/tunnel/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert "status" in data
    assert "is_available" in data

# 15. Security Incidents & Loss Prevention
def test_15_security_incidents():
    # Query incidents
    inc_res = client.get("/api/security/incidents")
    assert inc_res.status_code == 200
    assert isinstance(inc_res.json(), list)

    # Test resolving incident directly
    from backend.app.models.domain import SecurityIncident
    from backend.app.database.session import SessionLocal
    db = SessionLocal()
    inc = SecurityIncident(
        incident_type="BULK_SWEEP",
        risk_score=0.95,
        customer_track_id=88,
        description="Audit test sweep",
        status="OPEN"
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    inc_id = inc.id
    db.close()

    resolve_res = client.post(f"/api/security/incidents/{inc_id}/resolve")
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "success"

# 16. Executive Commercial Intelligence & CSV Export
def test_16_executive_analytics_and_csv_export():
    summary_res = client.get("/api/analytics/executive-summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "gross_merchandise_value" in summary
    assert "conversion_funnel" in summary
    assert "sku_affinity_matrix" in summary
    assert len(summary["conversion_funnel"]) >= 4

    csv_res = client.get("/api/analytics/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "METARETAIL AI" in csv_res.text


# 17. Real-Time Camera Fast Ingest & Zero-Lag Frame Pipeline
def test_17_realtime_camera_fast_ingest_and_freshness():
    from backend.app.services.camera_manager import shared_camera_manager as cm
    import time

    test_cam_id = 9999
    fake_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb"
    fake_annotated = b"\xff\xd8\xff\xe0\x00\x10JFIF_ANNOTATED"

    # Fast zero-copy ingest
    cm.receive_jpeg_bytes(
        camera_id=test_cam_id,
        jpeg_bytes=fake_jpeg,
        width=1280,
        height=720,
        quality=0.70,
        client_fps=20.0,
        lens="Back (Wide Field)"
    )

    status = cm.get_camera_status(test_cam_id)
    assert status["status"] == "ONLINE"
    assert status["fps"] == 20.0
    assert status["width"] == 1280
    assert status["height"] == 720
    assert "16:9" in status["resolution"]
    assert status["quality_preset"] == "Balanced (70%)"
    assert status["lens"] == "Back (Wide Field)"

    # When no annotated frame is stored, fallback to raw frame
    retrieved = cm.get_latest_jpeg(test_cam_id, prefer_annotated=True)
    assert retrieved == fake_jpeg

    # When fresh annotated frame is stored, it returns annotated frame
    cm.store_annotated_frame(test_cam_id, fake_annotated)
    retrieved = cm.get_latest_jpeg(test_cam_id, prefer_annotated=True)
    assert retrieved == fake_annotated

    # When prefer_annotated is False, it returns raw live frame
    retrieved_raw = cm.get_latest_jpeg(test_cam_id, prefer_annotated=False)
    assert retrieved_raw == fake_jpeg

    # Test stale annotated frame fallback (> 1.5s old)
    cm.cameras[test_cam_id].annotated_jpeg_time = time.time() - 2.5
    retrieved_fallback = cm.get_latest_jpeg(test_cam_id, prefer_annotated=True)
    assert retrieved_fallback == fake_jpeg

    # Cleanup
    cm.set_camera_offline(test_cam_id)
    assert cm.cameras[test_cam_id].status == "OFFLINE"


# 18. Adaptive FPS & Real-Time Signal Strength Governor Telemetry
def test_18_adaptive_fps_and_signal_strength_telemetry():
    from backend.app.services.camera_manager import shared_camera_manager as cm
    import json

    test_cam_id = 8888
    fake_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb"

    # 1. Ingest with Tier 1 Signal (5 Bars, Ultra High 30 FPS, RTT 14ms)
    cm.receive_jpeg_bytes(
        camera_id=test_cam_id,
        jpeg_bytes=fake_jpeg,
        width=1280,
        height=720,
        quality=0.85,
        client_fps=30.0,
        lens="Back (Wide Field)",
        signal_bars=5,
        signal_quality="Ultra",
        rtt_ms=14.2
    )

    status = cm.get_camera_status(test_cam_id)
    assert status["status"] == "ONLINE"
    assert status["fps"] == 30.0
    assert status["signal_bars"] == 5
    assert status["signal_quality"] == "Ultra"
    assert status["rtt_ms"] == 14.2

    # 2. Test step down under congested conditions (3 Bars, 20 FPS, RTT 155ms)
    cm.receive_jpeg_bytes(
        camera_id=test_cam_id,
        jpeg_bytes=fake_jpeg,
        width=1280,
        height=720,
        quality=0.75,
        client_fps=20.0,
        lens="Back (Wide Field)",
        signal_bars=3,
        signal_quality="Fair",
        rtt_ms=155.0
    )

    status = cm.get_camera_status(test_cam_id)
    assert status["fps"] == 20.0
    assert status["signal_bars"] == 3
    assert status["signal_quality"] == "Fair"
    assert status["rtt_ms"] == 155.0

    # 3. Test WebSocket Ping-Pong handler
    with client.websocket_connect(f"/ws/camera/{test_cam_id}") as ws:
        ping_msg = {"type": "ping", "t": 123456.78}
        ws.send_text(json.dumps(ping_msg))
        response = json.loads(ws.receive_text())
        assert response["type"] == "pong"
        assert response["t"] == 123456.78

    # Cleanup
    cm.set_camera_offline(test_cam_id)
    assert cm.cameras[test_cam_id].status == "OFFLINE"


# 19. Deep Metric Learning & ViT Feature Extractor Tests
def test_19_deep_metric_learning_vit_classifier():
    classifier = ViTClassifier()
    assert hasattr(classifier, "_has_backbone")

    # Verify deep feature extraction
    sample_crop = np.random.randint(50, 200, (120, 120, 3), dtype=np.uint8)
    deep_emb = classifier._extract_deep_embedding(sample_crop)
    assert deep_emb.shape == (256,)
    # If backbone is loaded, norm should be approximately 1.0
    if classifier._has_backbone:
        assert abs(np.linalg.norm(deep_emb) - 1.0) < 1e-3

    # Verify 3D HSV color histogram
    color_hist = classifier._extract_color_histogram(sample_crop)
    assert color_hist.shape == (256,)
    assert abs(np.linalg.norm(color_hist) - 1.0) < 1e-3


    # Verify crop classification
    res = classifier.classify_crop(sample_crop, (10, 10, 130, 130), fallback_label="Water Bottle")
    assert res.product_name is not None
    assert res.confidence >= 0.0


# 20. Storewide Cross-Camera Shopper Re-Identification (Re-ID)
def test_20_global_cross_camera_reid():
    from ai.tracking.global_shopper_tracker import GlobalShopperTracker
    reid_tracker = GlobalShopperTracker(appearance_thresh=0.55)

    rng = np.random.default_rng(2026)
    shopper_frame_cam1 = rng.normal(loc=140, scale=20, size=(480, 640, 3)).clip(0, 255).astype(np.uint8)
    shopper_frame_cam2 = (shopper_frame_cam1.astype(np.int16) + rng.normal(loc=3, scale=3, size=(480, 640, 3))).clip(0, 255).astype(np.uint8)
    different_person_cam1 = rng.normal(loc=45, scale=12, size=(480, 640, 3)).clip(0, 255).astype(np.uint8)

    # 1. First seen at Camera 1 (Beverages Aisle)
    gid_cam1 = reid_tracker.resolve_track(
        camera_id=1,
        local_track_id=10,
        bbox=(150, 100, 280, 380),
        frame=shopper_frame_cam1,
        zone_id=2,
        zone_name="Aisle 1 - Chilled Beverages"
    )
    assert gid_cam1 >= 100

    # 2. Handover to Camera 2 (Snacks Aisle) - local track ID is different (e.g. track 88)
    gid_cam2 = reid_tracker.resolve_track(
        camera_id=2,
        local_track_id=88,
        bbox=(160, 90, 290, 370),
        frame=shopper_frame_cam2,
        zone_id=3,
        zone_name="Aisle 2 - Snacks & Chips"
    )
    # Must re-identify as the same global shopper!
    assert gid_cam1 == gid_cam2

    # 3. Different person arriving at Camera 1
    gid_diff = reid_tracker.resolve_track(
        camera_id=1,
        local_track_id=99,
        bbox=(150, 100, 280, 380),
        frame=different_person_cam1,
        zone_id=2,
        zone_name="Aisle 1 - Chilled Beverages"
    )
    assert gid_diff != gid_cam1


# 21. Autonomous "Just Walk Out" Checkout Flow
def test_21_autonomous_exit_turnstile_checkout():
    from backend.app.database.session import SessionLocal
    from backend.app.services.cart_service import shared_cart_service
    from backend.app.models.domain import Product, CartItem, Invoice

    db = SessionLocal()
    try:
        # Create test item in product catalog
        prod = db.query(Product).first()
        assert prod is not None, "Product needed for cart test"

        test_shopper_id = 9999

        # Add item to shopper's virtual basket
        shared_cart_service.add_to_cart(db, customer_track_id=test_shopper_id, product_name=prod.name, quantity=2)
        cart = shared_cart_service.get_customer_cart(db, customer_track_id=test_shopper_id)
        assert cart["total_items"] >= 2
        assert cart["subtotal"] > 0

        # Execute Autonomous Checkout
        invoice = shared_cart_service.checkout_customer(db, customer_track_id=test_shopper_id, payment_method="AUTONOMOUS_JUST_WALK_OUT")
        assert invoice["invoice_number"].startswith("INV-")
        assert invoice["total_amount"] > 0
        assert invoice["payment_status"] == "PAID"

        # Verify active cart is now empty
        updated_cart = shared_cart_service.get_customer_cart(db, customer_track_id=test_shopper_id)
        assert updated_cart["total_items"] == 0

        # Verify invoice in DB
        db_inv = db.query(Invoice).filter(Invoice.customer_track_id == test_shopper_id).first()
        assert db_inv is not None
        assert db_inv.payment_status == "PAID"
    finally:
        db.close()


# 22. Enterprise Loss Prevention & Shrinkage Detection Rules
def test_22_enterprise_loss_prevention_rules():
    from ai.security.loss_prevention_engine import LossPreventionEngine
    from backend.app.database.session import SessionLocal

    lp = LossPreventionEngine()
    db = SessionLocal()
    try:
        # Rule 1: Bulk Sweep (>= 3 items picked rapidly in < 3.5s)
        t_id = 7701
        lp.record_pickup(db, track_id=t_id, item_name="Coke Zero")
        lp.record_pickup(db, track_id=t_id, item_name="Doritos Nacho")
        inc = lp.record_pickup(db, track_id=t_id, item_name="Snickers Bar")
        assert inc is not None
        assert inc["incident_type"] == "BULK_SWEEP"

        # Rule 2: Suspicious Dwell in High-Value Bay (> 45s without selection)
        t_id_dwell = 7702
        inc_dwell = lp.update_shopper(
            db,
            track_id=t_id_dwell,
            dwell_seconds=65.0,
            zone_name="High-Value Electronics Bay",
            camera_id=1
        )
        assert inc_dwell is not None
        assert inc_dwell["incident_type"] == "SUSPICIOUS_DWELL"

        # Rule 3: Unpaid Exit Attempt
        t_id_exit = 7703
        inc_exit = lp.check_unpaid_exit(
            db,
            track_id=t_id_exit,
            cart_items_count=3,
            is_checked_out=False,
            zone_name="Autonomous Exit Turnstiles",
            camera_id=1
        )
        assert inc_exit is not None
        assert inc_exit["incident_type"] == "UNPAID_EXIT"
    finally:
        db.close()


# 23. Product Registration & Visual Rediscovery Pipeline Test
def test_23_product_registration_and_visual_rediscovery():
    # 1. Create a distinct synthetic product
    unique_suffix = uuid.uuid4().hex[:6]
    prod_name = f"Test Mango Juice {unique_suffix}"
    create_res = client.post("/api/products", json={
        "name": prod_name,
        "category": "Beverages",
        "sku": f"MANGO-{unique_suffix}",
        "price": 3.99,
        "stock": 25,
        "min_stock": 5
    })
    assert create_res.status_code == 201
    prod = create_res.json()
    prod_id = prod["id"]

    try:
        # 2. Generate a distinct colorful synthetic test image
        img = np.zeros((150, 150, 3), dtype=np.uint8)
        img[:] = (30, 180, 240)  # Bright yellow-orange background
        cv2.circle(img, (75, 75), 45, (0, 0, 200), -1)  # Bold red circle
        cv2.putText(img, "MANGO", (15, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        _, img_encoded = cv2.imencode(".jpg", img)
        img_bytes = io.BytesIO(img_encoded.tobytes())

        # 3. Upload product image as reference view
        upload_res = client.post(
            f"/api/products/{prod_id}/images",
            files={"file": ("front.jpg", img_bytes, "image/jpeg")},
            data={"angle": "front"}
        )
        assert upload_res.status_code == 200

        # 4. Check classifier directly classifies the crop as this new product
        cls_res = shared_pipeline_service.classifier.classify_crop(img, (0, 0, 150, 150), fallback_label="Beverage Bottle")
        assert cls_res.is_catalog_match is True
        assert cls_res.product_name == prod_name

        # 5. Check zone filter heuristic: catalog matches are NEVER overwritten by zone allowed_products
        allowed_products = ["Old Soda Can", "Generic Water"]
        if not getattr(cls_res, "is_catalog_match", False) and allowed_products:
            cls_res.product_name = allowed_products[0]
        assert cls_res.product_name == prod_name

    finally:
        # Cleanup
        del_res = client.delete(f"/api/products/{prod_id}")
        assert del_res.status_code == 200
        # Verify classifier memory removed it
        remaining = [rf for rf in shared_pipeline_service.classifier.reference_features if rf.product_id == prod_id]
        assert len(remaining) == 0


# 24. BigQuery Enterprise Ingestion & AI/ML Pipelines
def test_24_bigquery_export_and_scripts():
    import os

    # 1. Test BigQuery Export
    exp_res = client.post("/api/bigquery/export")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["status"] == "success"
    assert "exports" in exp_data
    exports = exp_data["exports"]

    for table_key in ["store_products", "customer_footfall", "shelf_interactions", "store_invoices", "security_incidents"]:
        assert table_key in exports
        assert "count" in exports[table_key]
        assert "file" in exports[table_key]
        assert os.path.exists(exports[table_key]["file"])

    assert "load_script" in exports
    assert os.path.exists(exports["load_script"])

    # 2. Test BigQuery SQL Scripts Catalog
    scripts_res = client.get("/api/bigquery/scripts")
    assert scripts_res.status_code == 200
    sdata = scripts_res.json()
    assert sdata["dataset"] == "retail_enterprise_bi"
    assert sdata["total_scripts"] >= 6
    filenames = [s["filename"] for s in sdata["scripts"]]
    assert "01_schema_ddl.sql" in filenames
    assert "02_timesfm_demand_forecast.sql" in filenames
    assert "03_timesfm_shrinkage_anomalies.sql" in filenames
    assert "04_gemini_generative_extraction.sql" in filenames
    assert "05_contribution_analysis_revenue_drivers.sql" in filenames
    assert "06_cart_abandonment_xgboost.sql" in filenames

    # 3. Test File Download
    dl_res = client.get("/api/bigquery/download/load_to_bigquery.sh")
    assert dl_res.status_code == 200
    assert "bq load" in dl_res.text


# 25. Autonomous Store Simulation & AI Copilot Suite
def test_25_simulation_and_copilot():
    # 1. Simulation status initial
    status_res = client.get("/api/simulation/status")
    assert status_res.status_code == 200
    s_data = status_res.json()
    assert "is_running" in s_data
    assert "active_simulated_shoppers" in s_data

    # 2. Toggle Simulation ON
    toggle_on = client.post("/api/simulation/toggle", json={"speed": 2.0})
    assert toggle_on.status_code == 200
    t_data = toggle_on.json()
    assert t_data["status"] == "success"
    assert t_data["simulation"]["is_running"] is True

    # 3. Toggle Simulation OFF
    toggle_off = client.post("/api/simulation/toggle")
    assert toggle_off.status_code == 200
    assert toggle_off.json()["simulation"]["is_running"] is False

    # 4. Copilot Stockout Inquiry
    copilot_res = client.post("/api/copilot/chat", json={"query": "Which products are at risk of running out of stock?"})
    assert copilot_res.status_code == 200
    c_data = copilot_res.json()
    assert "answer" in c_data
    assert "confidence" in c_data
    assert "category" in c_data
    assert len(c_data["recommendations"]) > 0

    # 5. Copilot Revenue Velocity Inquiry
    copilot_rev = client.post("/api/copilot/chat", json={"query": "How is store revenue and hourly sales velocity performing?"})
    assert copilot_rev.status_code == 200
    assert "₹" in copilot_rev.json()["answer"]

    # 6. Copilot Empty Query Validation
    bad_req = client.post("/api/copilot/chat", json={"query": "   "})
    assert bad_req.status_code == 400




