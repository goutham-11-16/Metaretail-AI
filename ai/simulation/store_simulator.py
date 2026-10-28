"""
Autonomous Retail Store Live Simulation Engine for MetaRetail AI
Generates realistic multi-shopper footfall, shelf interactions, virtual cart additions,
autonomous checkouts, and security events in real-time.
"""
import time
import random
import threading
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from backend.app.database.session import SessionLocal
from backend.app.models.domain import Product, Customer, Interaction, InteractionDetail, CartItem, SecurityIncident
from ai.tracking.global_shopper_tracker import shared_global_tracker, ShopperProfile
from backend.app.services.cart_service import shared_cart_service
from ai.security.loss_prevention_engine import shared_loss_prevention

logger = logging.getLogger("metaretail.simulation")


class StoreSimulator:
    def __init__(self):
        self._running = False
        self._thread: threading.Thread = None
        self._stop_event = threading.Event()
        self._active_sim_shoppers: Dict[int, Dict[str, Any]] = {}
        self._next_track_id = 201
        self._total_simulated_orders = 0
        self._total_simulated_pickups = 0
        self._simulation_speed = 1.0

    @property
    def is_running(self) -> bool:
        return self._running

    def start(self, speed: float = 1.0) -> bool:
        if self._running:
            return True
        self._simulation_speed = max(0.5, min(5.0, speed))
        self._stop_event.clear()
        self._running = True
        self._thread = threading.Thread(target=self._simulation_loop, daemon=True)
        self._thread.start()
        logger.info(f"Store Simulation Engine STARTED (speed={self._simulation_speed}x)")
        return True

    def stop(self) -> bool:
        if not self._running:
            return True
        self._running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        logger.info("Store Simulation Engine STOPPED")
        return True

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self._running,
            "active_simulated_shoppers": len(self._active_sim_shoppers),
            "total_simulated_orders": self._total_simulated_orders,
            "total_simulated_pickups": self._total_simulated_pickups,
            "simulation_speed": self._simulation_speed,
            "active_shoppers": [
                {
                    "track_id": s["track_id"],
                    "current_zone_id": s["zone_id"],
                    "items_in_cart": s["items_count"],
                    "dwell_seconds": round(time.time() - s["start_time"], 1)
                }
                for s in self._active_sim_shoppers.values()
            ]
        }

    def _simulation_loop(self):
        zone_sequence = [1, 2, 3, 4, 5, 6]  # Entrance -> Beverages -> Snacks -> Bakery -> Electronics -> Turnstiles
        zone_names = {
            1: "Entrance Gate",
            2: "Beverages & Drinks",
            3: "Snacks & Confectionery",
            4: "Fresh Bakery & Dairy",
            5: "Personal Care & Electronics",
            6: "Autonomous Exit Turnstiles"
        }
        reasons = [
            "Checking Expiry Date", "Price Consideration",
            "Nutritional Info Review", "Comparison with Alternate Brand"
        ]

        while not self._stop_event.is_set():
            db = SessionLocal()
            try:
                products = db.query(Product).all()
                if not products:
                    time.sleep(2.0)
                    continue

                # 1. Spawn new shopper if active pool is < 4
                if len(self._active_sim_shoppers) < 4 and random.random() < 0.45:
                    tid = self._next_track_id
                    self._next_track_id += 1
                    if self._next_track_id > 999:
                        self._next_track_id = 201

                    self._active_sim_shoppers[tid] = {
                        "track_id": tid,
                        "zone_idx": 0,
                        "zone_id": 1,
                        "items_count": 0,
                        "start_time": time.time(),
                        "steps": 0
                    }

                    # Register in global shopper tracker
                    shared_global_tracker.update_shopper(
                        camera_id=1,
                        local_track_id=tid,
                        global_id=tid,
                        embedding=None,
                        zone_id=1,
                        zone_name="Entrance Gate"
                    )

                    # Create DB Customer record
                    new_cust = Customer(
                        track_id=tid,
                        entry_time=datetime.utcnow(),
                        dwell_time=0.0
                    )
                    db.add(new_cust)
                    db.commit()
                    logger.info(f"Simulator: Shopper #{tid} entered store (Entrance Gate)")

                # 2. Advance existing shoppers through aisles
                completed_tids = []
                for tid, shopper in list(self._active_sim_shoppers.items()):
                    shopper["steps"] += 1
                    current_idx = shopper["zone_idx"]

                    # Move to next aisle with 60% probability
                    if random.random() < 0.60 and current_idx < len(zone_sequence) - 1:
                        shopper["zone_idx"] += 1
                        shopper["zone_id"] = zone_sequence[shopper["zone_idx"]]

                        shared_global_tracker.update_shopper(
                            camera_id=1,
                            local_track_id=tid,
                            global_id=tid,
                            embedding=None,
                            zone_id=shopper["zone_id"],
                            zone_name=zone_names.get(shopper["zone_id"], "Shopping Aisle")
                        )

                    current_zone = shopper["zone_id"]

                    # 3. Simulate Shelf Interaction in Shopping Aisles (Zones 2, 3, 4, 5)
                    if current_zone in [2, 3, 4, 5] and random.random() < 0.50:
                        chosen_prod = random.choice(products)
                        is_put_back = (random.random() < 0.30) # 30% abandonment
                        action_name = "APPROACH" if is_put_back else "PICKUP"
                        confidence = round(random.uniform(0.91, 0.99), 2)
                        now_dt = datetime.utcnow()

                        intr = Interaction(
                            customer_id=tid,
                            product_id=chosen_prod.id,
                            action=action_name,
                            confidence=confidence,
                            timestamp=now_dt
                        )
                        db.add(intr)
                        db.commit()
                        db.refresh(intr)
                        self._total_simulated_pickups += 1

                        hold_dur = round(random.uniform(4.0, 18.0), 1)
                        detail = InteractionDetail(
                            interaction_id=intr.id,
                            pickup_timestamp=now_dt,
                            replace_timestamp=now_dt + timedelta(seconds=hold_dur) if is_put_back else None,
                            hold_duration_seconds=hold_dur,
                            was_replaced=is_put_back,
                            inferred_reason=random.choice(reasons) if is_put_back else None,
                            zone_id=current_zone,
                            camera_id=1
                        )
                        db.add(detail)
                        db.commit()

                        if not is_put_back:
                            # Add to virtual cart
                            shared_cart_service.add_to_cart(db, customer_track_id=tid, product_name=chosen_prod.name, quantity=1)
                            shopper["items_count"] += 1
                            logger.info(f"Simulator: Shopper #{tid} picked {chosen_prod.name} -> Cart #{tid}")

                    # 4. Check for Autonomous Checkout at Exit Turnstiles (Zone 6)
                    if current_zone == 6 and shopper["steps"] >= 4:
                        cart = shared_cart_service.get_customer_cart(db, tid)
                        dwell = round(time.time() - shopper["start_time"], 1)

                        if cart.get("total_items", 0) > 0:
                            try:
                                inv = shared_cart_service.checkout_customer(db, tid)
                                self._total_simulated_orders += 1
                                logger.info(f"Simulator: Shopper #{tid} Just-Walk-Out checkout completed! (Invoice: {inv.get('invoice_number')}, Total: ₹{inv.get('total_amount')})")
                            except Exception as e:
                                logger.warning(f"Simulator checkout warning: {e}")

                        # Update customer exit time and dwell
                        db_cust = db.query(Customer).filter(Customer.track_id == tid).first()
                        if db_cust:
                            db_cust.exit_time = datetime.utcnow()
                            db_cust.dwell_time = dwell
                            db.commit()

                        completed_tids.append(tid)

                # Clean up checked-out shoppers
                for tid in completed_tids:
                    self._active_sim_shoppers.pop(tid, None)

            except Exception as e:
                logger.error(f"Simulator loop error: {e}", exc_info=True)
                db.rollback()
            finally:
                db.close()

            sleep_time = max(0.8, 3.5 / self._simulation_speed)
            self._stop_event.wait(timeout=sleep_time)


shared_store_simulator = StoreSimulator()
