"""
Store Topology & Spatial Heatmap Service for MetaRetail AI
Provides 2D vector coordinate mapping of retail aisles, camera FOV cones, shopper trajectories, and dwell density heatmaps.
"""
import random
import time
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models.domain import Zone, Camera, Product, InteractionDetail, ZoneProduct
from ai.tracking.global_shopper_tracker import shared_global_tracker
from backend.app.services.cart_service import shared_cart_service

logger = logging.getLogger("metaretail.topology")



class StoreTopologyService:
    def __init__(self):
        # Baseline store blueprint coordinate map (1000 x 500 px canvas)
        self.default_zones = [
            {
                "zone_id": 1,
                "name": "Entrance & Welcome Gate",
                "code": "ENTRANCE",
                "x": 30, "y": 40, "width": 140, "height": 180,
                "color": "#3b82f6",
                "category": "Access",
                "base_dwell_factor": 0.35
            },
            {
                "zone_id": 2,
                "name": "Aisle 1 - Chilled Beverages",
                "code": "AISLE-1",
                "x": 220, "y": 40, "width": 260, "height": 170,
                "color": "#06b6d4",
                "category": "Beverages",
                "base_dwell_factor": 0.85
            },
            {
                "zone_id": 3,
                "name": "Aisle 2 - Snacks & Chips",
                "code": "AISLE-2",
                "x": 520, "y": 40, "width": 260, "height": 170,
                "color": "#f59e0b",
                "category": "Snacks",
                "base_dwell_factor": 0.92
            },
            {
                "zone_id": 4,
                "name": "Aisle 3 - Fresh & Bakery",
                "code": "AISLE-3",
                "x": 220, "y": 260, "width": 260, "height": 180,
                "color": "#10b981",
                "category": "Fresh",
                "base_dwell_factor": 0.65
            },
            {
                "zone_id": 5,
                "name": "High-Value Electronics Bay",
                "code": "TECH-BAY",
                "x": 520, "y": 260, "width": 260, "height": 180,
                "color": "#8b5cf6",
                "category": "Electronics",
                "base_dwell_factor": 0.78
            },
            {
                "zone_id": 6,
                "name": "Autonomous Exit Turnstiles",
                "code": "CHECKOUT-EXIT",
                "x": 820, "y": 40, "width": 140, "height": 400,
                "color": "#ec4899",
                "category": "Checkout",
                "base_dwell_factor": 0.40
            }
        ]

    def get_topology(self, db: Session, active_customers: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Compiles real-time 2D spatial layout with active cameras, FOV cones, customer dots, and heatmap values.
        """
        active_customers = active_customers or []
        db_cameras = db.query(Camera).all()
        db_zones = db.query(Zone).all()

        # Build zone map
        zones_output = []
        for default_z in self.default_zones:
            zid = default_z["zone_id"]
            # Look up assigned products and count
            assigned_prods = db.query(Product).join(ZoneProduct, ZoneProduct.product_id == Product.id).filter(
                ZoneProduct.zone_id == zid
            ).all()

            # Calculate dwell score from interaction details
            details = db.query(InteractionDetail).filter(InteractionDetail.zone_id == zid).all()
            total_dwell = sum(d.hold_duration_seconds or 2.0 for d in details)
            heat_index = min(1.0, round(default_z["base_dwell_factor"] + (len(details) * 0.05), 2))

            zones_output.append({
                **default_z,
                "products_count": len(assigned_prods),
                "total_stock": sum(p.current_stock or 0 for p in assigned_prods),
                "dwell_heat_index": heat_index,
                "activity_level": "HIGH" if heat_index > 0.75 else ("MEDIUM" if heat_index > 0.4 else "LOW")
            })

        # Map cameras with FOV coordinates
        camera_nodes = []
        for idx, cam in enumerate(db_cameras):
            # Anchor cameras along the ceiling grid
            x_pos = 180 + (idx * 210) % 700
            y_pos = 30 if idx % 2 == 0 else 240
            camera_nodes.append({
                "camera_id": cam.id,
                "name": cam.name,
                "camera_type": cam.camera_type,
                "status": cam.status,
                "x": x_pos,
                "y": y_pos,
                "fov_angle": 65,
                "direction_degrees": 135 if idx % 2 == 0 else 45,
                "range": 160,
                "assigned_zone_id": cam.assigned_zone_id
            })

        # Map real-time customer positions onto floorplan
        customer_dots = []
        now_ts = time.time()

        recent_shoppers = [
            prof for prof in shared_global_tracker.global_shoppers.values()
            if (now_ts - prof.last_seen) < 45.0
        ]

        if recent_shoppers:
            for prof in recent_shoppers:
                target_zone = next((z for z in self.default_zones if z["zone_id"] == prof.current_zone_id), None)
                if not target_zone:
                    target_zone = self.default_zones[(prof.global_id) % len(self.default_zones)]

                cx = target_zone["x"] + 35 + ((prof.global_id * 43) % max(20, target_zone["width"] - 70))
                cy = target_zone["y"] + 35 + ((prof.global_id * 29) % max(20, target_zone["height"] - 70))

                # Check active cart size
                cart = shared_cart_service.get_customer_cart(db, prof.global_id)
                basket_count = cart.get("total_items", 0)

                traj = [
                    {"x": 65, "y": 120},
                    {"x": 190, "y": 120 if cy < 250 else 320},
                    {"x": int(cx - 35), "y": int(cy - 15)},
                    {"x": int(cx), "y": int(cy)}
                ]

                customer_dots.append({
                    "track_id": prof.global_id,
                    "global_id": prof.global_id,
                    "camera_id": prof.current_camera_id,
                    "x": cx,
                    "y": cy,
                    "trajectory": traj,
                    "dwell_seconds": prof.dwell_seconds,
                    "current_zone": target_zone["name"],
                    "basket_size": basket_count,
                    "is_checked_out": prof.cart_checked_out
                })
        else:
            for idx, cust in enumerate(active_customers):
                cid = cust.get("global_track_id", cust.get("track_id", idx + 1))
                dwell = cust.get("dwell_seconds", 5.0)
                target_zone = self.default_zones[(cid) % len(self.default_zones)]
                cx = target_zone["x"] + 30 + ((cid * 47) % max(20, target_zone["width"] - 60))
                cy = target_zone["y"] + 30 + ((cid * 31) % max(20, target_zone["height"] - 60))
                traj = [
                    {"x": 65, "y": 120},
                    {"x": 190, "y": 120 if cy < 250 else 320},
                    {"x": int(cx - 30), "y": int(cy - 10)},
                    {"x": int(cx), "y": int(cy)}
                ]
                customer_dots.append({
                    "track_id": cid,
                    "global_id": cid,
                    "x": cx,
                    "y": cy,
                    "trajectory": traj,
                    "dwell_seconds": dwell,
                    "current_zone": target_zone["name"],
                    "basket_size": 1 if dwell > 10 else 0,
                    "is_checked_out": cust.get("is_checked_out", False)
                })

        return {
            "canvas": {"width": 1000, "height": 500},
            "store_name": "MetaRetail Smart Flagship 01",
            "zones": zones_output,
            "cameras": camera_nodes,
            "customers": customer_dots,
            "total_shoppers_in_store": len(customer_dots)
        }



shared_topology_service = StoreTopologyService()
