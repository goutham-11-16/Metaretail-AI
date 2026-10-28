"""
Production Vision Pipeline Service
Integrates: Frame Capture -> YOLOv8 -> ViT -> Universal Shelf Take/Replace Engine -> Abandonment Analytics -> DB Sync
"""
import time
import base64
import logging
import cv2
import numpy as np
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger("metaretail.pipeline")

from ai.detection.yolo_detector import YOLODetector
from ai.tracking.bytetrack_tracker import ByteTrackTracker
from ai.classification.vit_classifier import ViTClassifier
from ai.interaction.interaction_engine import InteractionEngine
from ai.interaction.shelf_tracker import UniversalShelfTracker
from ai.inventory.inventory_engine import InventoryEngine
from ai.analytics.analytics_engine import AnalyticsEngine

from backend.app.models.domain import Product, Alert, Event, Customer, Interaction, InteractionDetail, ZoneProduct, Camera
from backend.app.database.session import SessionLocal
from backend.app.services.camera_manager import shared_camera_manager as camera_manager
from backend.app.services.cart_service import shared_cart_service
from ai.security.loss_prevention_engine import shared_loss_prevention
from ai.tracking.global_shopper_tracker import shared_global_tracker


class VisionPipelineService:
    def __init__(self):
        self.detector = YOLODetector()
        self.classifier = ViTClassifier()
        # Per-camera trackers and state engines
        self.trackers = {}
        self.interaction_engines = {}
        self.shelf_trackers = {}
        self.inventory_engine = InventoryEngine()
        self.analytics_engine = AnalyticsEngine()
        self.frame_count = 0
        self.known_products_cache = set()

    def _get_camera_state(self, camera_id):
        if camera_id not in self.trackers:
            self.trackers[camera_id] = ByteTrackTracker()
            self.interaction_engines[camera_id] = InteractionEngine()
            self.shelf_trackers[camera_id] = UniversalShelfTracker()
        return self.trackers[camera_id], self.interaction_engines[camera_id], self.shelf_trackers[camera_id]

    def sync_database_event(self, event_type: str, desc: str, metadata: dict, product_name: Optional[str] = None, category: str = "General", detail_event=None, camera_id=None):
        """
        Synchronizes AI events, auto-registers new products, and updates stock directly in SQLite database.
        """
        db = SessionLocal()
        try:
            # 1. Auto-Register Product in Database Catalog if new
            prod_id = None
            if product_name:
                existing = db.query(Product).filter(Product.name == product_name).first()
                if not existing:
                    sku_slug = product_name.upper().replace(" ", "-")[:12]
                    new_prod = Product(
                        sku=sku_slug,
                        name=product_name,
                        category=category,
                        current_stock=5,
                        min_stock_threshold=1,
                        unit_price=4.99 if category != "Electronics" else 199.99
                    )
                    db.add(new_prod)
                    db.commit()
                    db.refresh(new_prod)
                    prod_id = new_prod.id
                    logger.info(f"Auto-Registered new product in DB catalog: {product_name} ({category})")
                else:
                    prod_id = existing.id
                self.known_products_cache.add(product_name)

            # 2. Add Event Record
            db_event = Event(
                event_type=event_type,
                description=desc,
                timestamp=datetime.utcnow(),
                metadata_json=str(metadata)
            )
            db.add(db_event)
            db.flush()

            # Optional detail logging
            if detail_event and prod_id:
                # Add basic interaction record
                inter_rec = Interaction(
                    product_id=prod_id,
                    action=event_type,
                    confidence=1.0,
                    timestamp=datetime.utcnow()
                )
                db.add(inter_rec)
                db.flush()
                
                # Add detailed record
                pickup_dt = datetime.fromtimestamp(detail_event.pickup_timestamp)
                replace_dt = datetime.fromtimestamp(detail_event.replace_timestamp) if detail_event.replace_timestamp else None
                
                # Look up zone from camera
                zone_id = None
                if camera_id:
                    cam = db.query(Camera).filter(Camera.id == camera_id).first()
                    if cam:
                        zone_id = cam.assigned_zone_id

                detail_rec = InteractionDetail(
                    interaction_id=inter_rec.id,
                    pickup_timestamp=pickup_dt,
                    replace_timestamp=replace_dt,
                    hold_duration_seconds=detail_event.hold_duration_seconds,
                    was_replaced=detail_event.was_replaced,
                    inferred_reason=detail_event.inferred_reason,
                    camera_id=camera_id,
                    zone_id=zone_id
                )
                db.add(detail_rec)

            # 3. Handle REMOVAL (Take) vs PUT_BACK (Leaved/Returned)
            if event_type == "PRODUCT_REMOVED" and product_name:
                prod = db.query(Product).filter(Product.name.like(f"%{product_name[:6]}%")).first()
                if prod and prod.current_stock > 0:
                    prod.current_stock -= 1
                    logger.info(f"DB Stock Decremented: {prod.name} -> {prod.current_stock}")
                    
                    if prod.current_stock <= prod.min_stock_threshold:
                        alert = Alert(
                            alert_type="LOW_STOCK",
                            product_id=prod.id,
                            severity="WARNING",
                            message=f"Low stock warning: {prod.name} has only {prod.current_stock} unit(s) remaining."
                        )
                        db.add(alert)

            elif event_type == "PRODUCT_PUT_BACK" and product_name:
                prod = db.query(Product).filter(Product.name.like(f"%{product_name[:6]}%")).first()
                if prod:
                    logger.info(f"DB Stock Maintained: {prod.name} returned/replaced on shelf by customer.")

            db.commit()
        except Exception as e:
            logger.error(f"Error syncing DB event: {e}")
            db.rollback()
        finally:
            db.close()

    def process_frame(self, frame: np.ndarray, camera_id: int = 1) -> Dict[str, Any]:
        self.frame_count += 1
        start_time = time.time()
        annotated_frame = frame.copy() if frame is not None else np.zeros((720, 1280, 3), dtype=np.uint8)

        # Get per-camera state
        tracker, interaction_engine, shelf_tracker = self._get_camera_state(camera_id)

        # Zone filtering logic (cached for 10 seconds to avoid SQLite thread locking)
        allowed_products = None
        assigned_zone_id = None
        now_ts = time.time()
        if not hasattr(self, "_zone_cache"):
            self._zone_cache = {}
        cached_entry = self._zone_cache.get(camera_id)
        if cached_entry and (now_ts - cached_entry["time"] < 10.0):
            allowed_products = cached_entry["products"]
            assigned_zone_id = cached_entry.get("assigned_zone_id")
        else:
            try:
                db = SessionLocal()
                cam = db.query(Camera).filter(Camera.id == camera_id).first()
                if cam and cam.assigned_zone_id:
                    assigned_zone_id = cam.assigned_zone_id
                    zone_prods = db.query(ZoneProduct).filter(ZoneProduct.zone_id == cam.assigned_zone_id).all()
                    if zone_prods:
                        allowed_pids = [zp.product_id for zp in zone_prods]
                        prods = db.query(Product).filter(Product.id.in_(allowed_pids)).all()
                        allowed_products = [p.name for p in prods]
                db.close()
                self._zone_cache[camera_id] = {
                    "products": allowed_products,
                    "assigned_zone_id": assigned_zone_id,
                    "time": now_ts
                }
            except Exception:
                pass

        # 1. Real YOLOv8 Object Detection
        detections = self.detector.detect(frame)

        # 2. Multi-Object Customer Tracking & Cross-Camera Re-ID
        tracked_customers = tracker.update(detections)
        zone_label = f"Zone #{assigned_zone_id}" if assigned_zone_id else "Main Aisle"

        # Resolve storewide global shopper identities across multi-camera network
        for c in tracked_customers:
            gid = shared_global_tracker.resolve_track(
                camera_id=camera_id,
                local_track_id=c.track_id,
                bbox=c.bbox,
                frame=frame,
                zone_id=assigned_zone_id,
                zone_name=zone_label
            )
            c.global_track_id = gid


        # 3. Vision Transformer Product Classification
        classified_products = []
        product_dets = [d for d in detections if d.class_name.lower() != "person"]

        for p_det in product_dets:
            xmin, ymin, xmax, ymax = p_det.bbox
            crop = frame[ymin:ymax, xmin:xmax] if hasattr(frame, "shape") else None
            cls_res = self.classifier.classify_crop(crop, p_det.bbox, fallback_label=p_det.class_name)
            
            # If the classifier matched a registered catalog product, ALWAYS preserve it!
            # Only use zone allowed_products if it was NOT a catalog match (i.e. generic YOLO detection)
            if not getattr(cls_res, "is_catalog_match", False) and allowed_products and len(allowed_products) > 0:
                cls_res.product_name = allowed_products[0]
            classified_products.append(cls_res)
            p_det.class_name = cls_res.product_name

        # Evaluate interactions directly
        interaction_events = interaction_engine.evaluate(tracked_customers, classified_products)
        for ie in interaction_events:
            if ie.action in ["PUT_BACK", "REMOVE"] and ie.detail_event:
                self.sync_database_event(f"PRODUCT_{ie.action}", f"Customer {ie.customer_track_id} {ie.action} {ie.product_name}", ie.metadata, ie.product_name, detail_event=ie.detail_event, camera_id=camera_id)

        # 4. Universal Physical Shelf Take & Replace State Tracking
        shelf_notes = shelf_tracker.update_and_audit(frame, product_dets, tracked_customers)

        db_cart = SessionLocal()
        try:
            for note in shelf_notes:
                # Map local track ID to global shopper ID so carts follow the person across cameras
                gid = shared_global_tracker.local_to_global.get((camera_id, note.customer_id), note.customer_id)

                if note.action_type == "REPLACED_ON_SHELF":
                    self.analytics_engine.record_replaced_left(gid, note.item_name, note.dwell_time_seconds)
                    shared_cart_service.remove_from_cart(db_cart, customer_track_id=gid, product_name=note.item_name)
                    shared_loss_prevention.record_replace(track_id=gid, item_name=note.item_name)
                elif note.action_type == "TAKEN_AWAY_PURCHASED":
                    self.inventory_engine.process_removal(note.item_name)
                    self.analytics_engine.record_purchase(gid, note.item_name, note.dwell_time_seconds)
                    shared_cart_service.add_to_cart(db_cart, customer_track_id=gid, product_name=note.item_name)
                    shared_loss_prevention.record_pickup(db_cart, track_id=gid, item_name=note.item_name, camera_id=camera_id)
                elif note.action_type == "TAKEN_FROM_SHELF":
                    self.analytics_engine.record_pickup(gid, note.item_name)
                    shared_cart_service.add_to_cart(db_cart, customer_track_id=gid, product_name=note.item_name)
                    shared_loss_prevention.record_pickup(db_cart, track_id=gid, item_name=note.item_name, camera_id=camera_id)

            # Security Shrinkage & Autonomous "Just Walk Out" Checkout Evaluation
            is_exit_zone = (assigned_zone_id == 6) or any(k in zone_label.lower() for k in ["exit", "checkout", "turnstile"])

            for c in tracked_customers:
                gid = getattr(c, "global_track_id", c.track_id)
                
                # Update dwell profile in loss prevention engine
                shared_loss_prevention.update_shopper(
                    db_cart,
                    track_id=gid,
                    dwell_seconds=c.dwell_time_seconds,
                    zone_name=zone_label,
                    camera_id=camera_id
                )

                # Autonomous Checkout Flow upon reaching Exit Zone / Turnstiles
                if is_exit_zone:
                    cust_cart = shared_cart_service.get_customer_cart(db_cart, customer_track_id=gid)
                    items_in_cart = cust_cart.get("total_items", 0)

                    if items_in_cart > 0:
                        if not shared_global_tracker.is_checked_out(gid):
                            try:
                                inv = shared_cart_service.checkout_customer(
                                    db_cart,
                                    customer_track_id=gid,
                                    payment_method="AUTONOMOUS_JUST_WALK_OUT"
                                )
                                shared_global_tracker.mark_checked_out(gid)
                                logger.info(f"AUTONOMOUS JUST-WALK-OUT: Customer #{gid} billed {inv['invoice_number']} for ₹{inv['total_amount']:.2f}")
                            except Exception as ce:
                                logger.error(f"Autonomous checkout failed for Customer #{gid}: {ce}")
                    else:
                        # Check for unpaid exit attempt if items were picked earlier
                        shared_loss_prevention.check_unpaid_exit(
                            db_cart,
                            track_id=gid,
                            cart_items_count=items_in_cart,
                            is_checked_out=shared_global_tracker.is_checked_out(gid),
                            zone_name=zone_label,
                            camera_id=camera_id
                        )
        except Exception as e:
            logger.error(f"Error in cart/security pipeline sync: {e}")
        finally:
            db_cart.close()

        # 5. Annotate OpenCV Frame for live video feed
        for c in tracked_customers:
            x1, y1, x2, y2 = c.bbox
            gid = getattr(c, "global_track_id", c.track_id)
            is_paid = shared_global_tracker.is_checked_out(gid)

            box_color = (0, 255, 128) if is_paid else (0, 191, 255)
            badge_text = f"Shopper #{gid} [Cam {c.track_id:02d}] | PAID" if is_paid else f"Shopper #{gid} [Cam {c.track_id:02d}] ({c.dwell_time_seconds}s)"
            badge_w = 210 if is_paid else 180

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2)
            cv2.rectangle(annotated_frame, (x1, y1 - 25), (x1 + badge_w, y1), box_color, -1)
            cv2.putText(annotated_frame, badge_text, (x1 + 4, y1 - 7),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (10, 10, 10), 1)

        for p in classified_products:
            x1, y1, x2, y2 = p.bbox
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 128), 2)
            lbl_text = f"{p.product_name} ({int(p.confidence*100)}%)"
            (text_w, text_h), _ = cv2.getTextSize(lbl_text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
            cv2.rectangle(annotated_frame, (x1, max(0, y1 - text_h - 10)), (x1 + text_w + 10, y1), (0, 255, 128), -1)
            cv2.putText(annotated_frame, lbl_text, (x1 + 4, max(12, y1 - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (10, 10, 10), 1)

        # HUD Header - Dynamically scales to frame resolution (e.g. 1280x720)
        h, w = annotated_frame.shape[:2]
        cv2.rectangle(annotated_frame, (0, 0), (w, 34), (15, 23, 42), -1)
        proc_ms = round((time.time() - start_time) * 1000, 1)
        fps = int(1000 / max(proc_ms, 1))
        cv2.putText(annotated_frame, f"MetaRetail AI | {w}x{h} HD | Shelf Take & Replace Tracker | FPS: {fps}", (10, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46, (0, 255, 255), 1)

        # 6. Encode Annotated Frame to High Quality JPEG Base64
        _, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        frame_base64 = base64.b64encode(buffer).decode('utf-8')

        analytics = self.analytics_engine.get_summary(active_customers_count=len(tracked_customers))

        # Fast detections list for high-FPS (<4ms) real-time overlay
        detections_overlay = []
        for c in tracked_customers:
            gid = getattr(c, "global_track_id", c.track_id)
            is_paid = shared_global_tracker.is_checked_out(gid)
            detections_overlay.append({
                "bbox": c.bbox,
                "label": f"Shopper #{gid} [Cam {c.track_id:02d}] | PAID" if is_paid else f"Shopper #{gid} [Cam {c.track_id:02d}] ({c.dwell_time_seconds}s)",
                "color": (0, 255, 128) if is_paid else (0, 191, 255)
            })
        for p in classified_products:
            detections_overlay.append({
                "bbox": p.bbox,
                "label": f"{p.product_name} ({int(p.confidence*100)}%)",
                "color": (0, 255, 128)  # Emerald green BGR
            })

        return {
            "frame_id": self.frame_count,
            "processing_ms": proc_ms,
            "fps": fps,
            "image_base64": f"data:image/jpeg;base64,{frame_base64}",
            "detections": detections_overlay,
            "customers": [
                {
                    "track_id": c.track_id,
                    "global_track_id": getattr(c, "global_track_id", c.track_id),
                    "bbox": c.bbox,
                    "dwell_seconds": c.dwell_time_seconds,
                    "is_checked_out": shared_global_tracker.is_checked_out(getattr(c, "global_track_id", c.track_id))
                }
                for c in tracked_customers
            ],
            "products": [
                {
                    "product_name": p.product_name,
                    "category": p.category,
                    "confidence": round(p.confidence, 2),
                    "bbox": p.bbox
                }
                for p in classified_products
            ],
            "shelf_notes": shelf_tracker.get_notes_summary(),
            "stock": self.inventory_engine.get_all_stock(),
            "analytics": {
                "active_customers": analytics.active_customers_now,
                "total_customers_today": analytics.total_customers_today,
                "avg_dwell_time": analytics.avg_dwell_time_seconds,
                "total_pickups": analytics.total_pickups,
                "total_replaced_left": analytics.total_replaced_left,
                "total_purchases": analytics.total_purchases,
                "store_abandonment_rate_pct": analytics.store_abandonment_rate_pct,
                "most_abandoned_product": analytics.most_abandoned_product,
                "product_stats": analytics.product_stats,
                "recent_actions": analytics.recent_actions
            }
        }
