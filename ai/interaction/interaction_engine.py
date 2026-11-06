"""
Production Warehouse Customer Action State Machine
Accurately detects: APPROACH, PICKUP, EXAMINING, PUT_BACK (Leaved/Returned), and REMOVAL (Taken/Purchased).
"""
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional, Set, Any
import time
import logging
from ai.tracking.bytetrack_tracker import TrackedCustomer
from ai.classification.vit_classifier import ClassificationResult
from ai.interaction.hoi_engine import HandObjectInteractionEngine, HandTrack, HOIAction

logger = logging.getLogger("metaretail.ai.interaction")

@dataclass
class InteractionDetailEvent:
    customer_track_id: int
    product_name: str
    pickup_timestamp: float
    replace_timestamp: Optional[float]
    hold_duration_seconds: float
    was_replaced: bool
    inferred_reason: Optional[str]

    def get_inferred_reason(self) -> str:
        if not self.was_replaced:
            return "Purchased"
        if self.hold_duration_seconds < 3:
            return "Quick glance — not interested"
        elif self.hold_duration_seconds < 10:
            return "Reading label / checking price"
        elif self.hold_duration_seconds < 30:
            return "Comparing with alternatives"
        else:
            return "Strong interest but decided against"

@dataclass
class CustomerInteractionEvent:
    customer_track_id: int
    product_name: str
    action: str  # APPROACH, PICKUP, EXAMINING, PUT_BACK, REMOVE
    confidence: float
    timestamp: float
    metadata: dict
    detail_event: Optional[InteractionDetailEvent] = None

@dataclass
class HeldItemState:
    product_name: str
    pickup_time: float
    last_seen_time: float
    initial_bbox: Tuple[int, int, int, int]
    is_confirmed_taken: bool = False

class InteractionEngine:
    """
    Advanced Warehouse Action State Machine.
    Tracks whether a customer picked up an item, examined it, put it back (leaved it on shelf),
    or walked away with it (purchase/removal).
    Integrates Spatio-Temporal Hand-Object Interaction (HOI) verification.
    """
    def __init__(self, proximity_threshold_pixels: float = 160.0):
        self.proximity_threshold = proximity_threshold_pixels
        
        # State tracking
        self.customer_states: Dict[int, str] = {}  # track_id -> IDLE, APPROACH, HOLDING, PUT_BACK, REMOVED
        self.customer_held_items: Dict[int, HeldItemState] = {}  # track_id -> HeldItemState
        self.shelf_products: Dict[str, Tuple[int, int, int, int]] = {}  # product_name -> original shelf bbox
        self.recent_events: List[CustomerInteractionEvent] = []
        self.hoi_engine = HandObjectInteractionEngine()

    def calculate_distance(self, bbox1: Tuple[int, int, int, int], bbox2: Tuple[int, int, int, int]) -> float:
        """
        Calculates center-to-center Euclidean distance between two bounding boxes.
        """
        cx1 = (bbox1[0] + bbox1[2]) / 2
        cy1 = (bbox1[1] + bbox1[3]) / 2
        cx2 = (bbox2[0] + bbox2[2]) / 2
        cy2 = (bbox2[1] + bbox2[3]) / 2
        return ((cx1 - cx2)**2 + (cy1 - cy2)**2) ** 0.5

    def evaluate(self, customers: List[TrackedCustomer], products: List[ClassificationResult]) -> List[CustomerInteractionEvent]:
        current_time = time.time()
        new_events: List[CustomerInteractionEvent] = []

        # Current visible products in this frame
        visible_product_map = {p.product_name: p.bbox for p in products}

        # 1. Update shelf product baseline positions
        for p in products:
            if p.product_name not in self.shelf_products:
                self.shelf_products[p.product_name] = p.bbox

        # 2. Process interactions for each tracked customer
        for customer in customers:
            track_id = customer.track_id
            cust_state = self.customer_states.get(track_id, "IDLE")

            # Check proximity to all visible products
            for product in products:
                dist = self.calculate_distance(customer.bbox, product.bbox)

                if dist < self.proximity_threshold:
                    if cust_state == "IDLE":
                        self.customer_states[track_id] = "APPROACH"
                        evt = CustomerInteractionEvent(
                            customer_track_id=track_id,
                            product_name=product.product_name,
                            action="APPROACH",
                            confidence=0.91,
                            timestamp=current_time,
                            metadata={"distance_px": round(dist, 1)}
                        )
                        new_events.append(evt)
                        logger.info(f"Event: Customer #{track_id} APPROACHED {product.product_name}")

                    elif cust_state == "APPROACH" and customer.dwell_time_seconds > 0.8:
                        # Customer picked up the item
                        self.customer_states[track_id] = "HOLDING"
                        self.customer_held_items[track_id] = HeldItemState(
                            product_name=product.product_name,
                            pickup_time=current_time,
                            last_seen_time=current_time,
                            initial_bbox=product.bbox
                        )
                        evt = CustomerInteractionEvent(
                            customer_track_id=track_id,
                            product_name=product.product_name,
                            action="PICKUP",
                            confidence=0.95,
                            timestamp=current_time,
                            metadata={"held_by": track_id, "dwell_seconds": customer.dwell_time_seconds}
                        )
                        new_events.append(evt)
                        logger.info(f"Event: Customer #{track_id} PICKED UP {product.product_name}")

            # 3. Check HOLDING state -> Did customer Put Back (Leave) or Remove (Take)?
            if cust_state == "HOLDING" and track_id in self.customer_held_items:
                held = self.customer_held_items[track_id]
                prod_name = held.product_name
                hold_duration = current_time - held.pickup_time

                # Case A: Customer puts the item back onto the shelf (item is visible & customer moves away/releases)
                if prod_name in visible_product_map:
                    current_prod_bbox = visible_product_map[prod_name]
                    dist_to_shelf = self.calculate_distance(current_prod_bbox, held.initial_bbox)
                    dist_to_cust = self.calculate_distance(customer.bbox, current_prod_bbox)

                    # If customer moved slightly away from item or put it down after holding for > 1.5s
                    if hold_duration > 1.5 and dist_to_cust > (self.proximity_threshold * 0.8):
                        self.customer_states[track_id] = "PUT_BACK"
                        detail = InteractionDetailEvent(track_id, prod_name, held.pickup_time, current_time, hold_duration, True, None)
                        detail.inferred_reason = detail.get_inferred_reason()
                        evt = CustomerInteractionEvent(
                            customer_track_id=track_id,
                            product_name=prod_name,
                            action="PUT_BACK",
                            confidence=0.94,
                            timestamp=current_time,
                            metadata={"hold_duration_sec": round(hold_duration, 1), "status": "returned_to_shelf", "reason": detail.inferred_reason},
                            detail_event=detail
                        )
                        new_events.append(evt)
                        logger.info(f"Event: Customer #{track_id} PUT BACK (LEAVED) {prod_name} on shelf. Reason: {detail.inferred_reason}")
                        del self.customer_held_items[track_id]

                # Case B: Customer walked away with the product (item disappeared or customer moves out)
                elif prod_name not in visible_product_map:
                    if hold_duration > 1.0 and not held.is_confirmed_taken:
                        held.is_confirmed_taken = True
                        self.customer_states[track_id] = "REMOVED"
                        detail = InteractionDetailEvent(track_id, prod_name, held.pickup_time, current_time, hold_duration, False, None)
                        detail.inferred_reason = detail.get_inferred_reason()
                        evt = CustomerInteractionEvent(
                            customer_track_id=track_id,
                            product_name=prod_name,
                            action="REMOVE",
                            confidence=0.96,
                            timestamp=current_time,
                            metadata={"hold_duration_sec": round(hold_duration, 1), "status": "taken_away"},
                            detail_event=detail
                        )
                        new_events.append(evt)
                        logger.info(f"Event: Customer #{track_id} REMOVED (TOOK) {prod_name}")

        return new_events

    def evaluate_with_hoi(
        self,
        customers: List[TrackedCustomer],
        products: List[ClassificationResult],
        customer_hands: Optional[Dict[int, List[HandTrack]]] = None
    ) -> List[CustomerInteractionEvent]:
        """
        High-precision evaluation using Spatio-Temporal Hand-Object Interaction (HOI).
        If customer_hands are provided, performs keypoint ray-casting and grasp validation.
        Otherwise falls back cleanly to the baseline Euclidean proximity state machine.
        """
        if not customer_hands:
            return self.evaluate(customers, products)

        prod_dicts = [
            {"name": p.product_name, "bbox": p.bbox, "confidence": p.confidence}
            for p in products
        ]

        hoi_events: List[CustomerInteractionEvent] = []
        for customer in customers:
            hands = customer_hands.get(customer.track_id, [])
            if not hands:
                continue

            actions = self.hoi_engine.evaluate_hoi(
                customer_id=customer.track_id,
                customer_bbox=customer.bbox,
                hands=hands,
                visible_products=prod_dicts
            )

            for act in actions:
                mapped_action = "PICKUP" if act.action_type == "TAKE" else act.action_type
                evt = CustomerInteractionEvent(
                    customer_track_id=act.customer_track_id,
                    product_name=act.product_name,
                    action=mapped_action,
                    confidence=act.confidence,
                    timestamp=act.timestamp,
                    metadata=act.metadata
                )
                hoi_events.append(evt)

        base_events = self.evaluate(customers, products)
        return hoi_events if hoi_events else base_events
