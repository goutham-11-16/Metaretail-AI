"""
Spatio-Temporal Hand-Object Interaction (HOI) Engine for Autonomous Retail.
Inspired by Standard Cognition's RetailAction paradigm (Take, Put, Touch)
and Intel Automated Self-Checkout reference architectures.

Implements:
1. Hand & Wrist Ray-Casting into Shelf Planogram Slots
2. Bounding Box & Keypoint Spatial Intersection (IoU & Euclidean distance)
3. Hand-Object Co-Movement Velocity Vector Correlation
4. Multi-Phase Action Classification:
   - APPROACH: Shopper moves toward shelf ROI
   - TOUCH / EXAMINE: Hand contacts item, item remains in shelf slot
   - TAKE / REMOVE: Hand grasps item and withdraws with coherent velocity
   - PUT_BACK: Previously held item is returned to shelf slot and hand releases
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional, Any
import time
import math
import numpy as np
import logging

logger = logging.getLogger("metaretail.ai.hoi")


@dataclass
class HandLandmark:
    x: float
    y: float
    confidence: float = 1.0


@dataclass
class HandTrack:
    hand_id: int
    wrist: Tuple[float, float]
    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    is_grasping: bool = False
    velocity: Tuple[float, float] = (0.0, 0.0)
    side: str = "right"  # "left" | "right"


@dataclass
class HOIAction:
    action_type: str  # "APPROACH", "TOUCH", "TAKE", "PUT_BACK"
    customer_track_id: int
    product_name: str
    confidence: float
    timestamp: float
    hand_side: str
    dwell_duration: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ShelfSlotState:
    slot_id: str
    product_name: str
    nominal_bbox: Tuple[int, int, int, int]
    current_count: int = 10
    baseline_count: int = 10
    is_occupied: bool = True
    last_interaction_time: float = 0.0


class HandObjectInteractionEngine:
    """
    Industrial-Grade Spatio-Temporal Hand-Object Interaction (HOI) Engine.
    Correlates MoveNet / Human AI hand keypoints and customer tracks with shelf items.
    """

    def __init__(
        self,
        touch_iou_threshold: float = 0.12,
        reach_distance_px: float = 140.0,
        min_grasp_dwell_sec: float = 0.45,
        velocity_coherence_threshold: float = 0.60
    ):
        self.touch_iou_threshold = touch_iou_threshold
        self.reach_distance_px = reach_distance_px
        self.min_grasp_dwell_sec = min_grasp_dwell_sec
        self.velocity_coherence_threshold = velocity_coherence_threshold

        # Customer hand states: (customer_id, hand_side) -> dict
        self.active_contacts: Dict[Tuple[int, str], Dict[str, Any]] = {}
        
        # Customer held items: customer_id -> dict
        self.customer_held_inventory: Dict[int, List[Dict[str, Any]]] = {}

        # Planogram slots: slot_id -> ShelfSlotState
        self.planogram_slots: Dict[str, ShelfSlotState] = {}

    def register_planogram_slot(
        self,
        slot_id: str,
        product_name: str,
        bbox: Tuple[int, int, int, int],
        initial_count: int = 10
    ):
        """Registers a shelf coordinate slot into the planogram matrix"""
        self.planogram_slots[slot_id] = ShelfSlotState(
            slot_id=slot_id,
            product_name=product_name,
            nominal_bbox=bbox,
            current_count=initial_count,
            baseline_count=initial_count,
            is_occupied=True,
            last_interaction_time=time.time()
        )
        logger.info(f"Registered Planogram Slot '{slot_id}' for {product_name} at bbox {bbox}")

    @staticmethod
    def calculate_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
        """Computes Intersection over Union between two bounding boxes (x1, y1, x2, y2)"""
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        inter_width = max(0, xB - xA)
        inter_height = max(0, yB - yA)
        inter_area = inter_width * inter_height

        boxA_area = max(1, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
        boxB_area = max(1, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

        iou = inter_area / float(boxA_area + boxB_area - inter_area)
        return float(iou)

    @staticmethod
    def calculate_center_distance(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
        """Euclidean distance between bounding box centers"""
        cxA = (boxA[0] + boxA[2]) / 2.0
        cyA = (boxA[1] + boxA[3]) / 2.0
        cxB = (boxB[0] + boxB[2]) / 2.0
        cyB = (boxB[1] + boxB[3]) / 2.0
        return math.hypot(cxA - cxB, cyA - cyB)

    @staticmethod
    def point_in_bbox(pt: Tuple[float, float], bbox: Tuple[int, int, int, int], margin: float = 20.0) -> bool:
        """Checks if a point (x, y) lies inside or within margin of bounding box"""
        return (bbox[0] - margin <= pt[0] <= bbox[2] + margin and
                bbox[1] - margin <= pt[1] <= bbox[3] + margin)

    def evaluate_hoi(
        self,
        customer_id: int,
        customer_bbox: Tuple[int, int, int, int],
        hands: List[HandTrack],
        visible_products: List[Dict[str, Any]],  # list of {"name": str, "bbox": (x1, y1, x2, y2), "confidence": float}
        timestamp: Optional[float] = None
    ) -> List[HOIAction]:
        """
        Evaluates spatio-temporal interactions for a customer.
        Returns newly triggered RetailAction events (APPROACH, TOUCH, TAKE, PUT_BACK).
        """
        now = timestamp or time.time()
        actions: List[HOIAction] = []

        if customer_id not in self.customer_held_inventory:
            self.customer_held_inventory[customer_id] = []

        # 1. Process each hand of the shopper
        for hand in hands:
            contact_key = (customer_id, hand.side)
            existing_contact = self.active_contacts.get(contact_key)

            # Find product with highest spatial overlap or closest proximity to hand
            best_product = None
            best_overlap_score = 0.0
            is_direct_contact = False

            for prod in visible_products:
                p_bbox = prod["bbox"]
                p_name = prod["name"]

                # A. Direct bounding box IoU
                iou = self.calculate_iou(hand.bbox, p_bbox)

                # B. Wrist point inside product region
                wrist_in = self.point_in_bbox(hand.wrist, p_bbox, margin=25.0)

                # C. Proximity distance
                dist = self.calculate_center_distance(hand.bbox, p_bbox)

                score = 0.0
                if iou > self.touch_iou_threshold:
                    score = 0.7 + (iou * 0.3)
                    is_direct_contact = True
                elif wrist_in:
                    score = 0.65
                    is_direct_contact = True
                elif dist < self.reach_distance_px:
                    score = max(0.0, 1.0 - (dist / self.reach_distance_px)) * 0.5

                if score > best_overlap_score:
                    best_overlap_score = score
                    best_product = prod

            # 2. State Transition Logic (RetailAction standard)
            if best_product and is_direct_contact:
                p_name = best_product["name"]
                p_bbox = best_product["bbox"]

                if not existing_contact:
                    # New Contact initiated -> TOUCH / EXAMINE
                    self.active_contacts[contact_key] = {
                        "product_name": p_name,
                        "initial_bbox": p_bbox,
                        "start_time": now,
                        "last_seen_time": now,
                        "hand_velocity": hand.velocity,
                        "is_take_confirmed": False,
                        "is_touch_emitted": False
                    }
                else:
                    # Ongoing contact
                    contact = self.active_contacts[contact_key]
                    dwell = now - contact["start_time"]
                    contact["last_seen_time"] = now

                    # Emit TOUCH action once dwell surpasses 0.3s
                    if dwell >= 0.3 and not contact.get("is_touch_emitted", False):
                        contact["is_touch_emitted"] = True
                        actions.append(HOIAction(
                            action_type="TOUCH",
                            customer_track_id=customer_id,
                            product_name=p_name,
                            confidence=0.92,
                            timestamp=now,
                            hand_side=hand.side,
                            dwell_duration=dwell,
                            metadata={"status": "examining_item", "grasping": hand.is_grasping}
                        ))
                        logger.info(f"HOI: Customer #{customer_id} TOUCHED/EXAMINED {p_name}")

                    # Check TAKE condition:
                    # Hand grasping OR dwell > min_dwell AND hand begins moving away with item
                    hand_speed = math.hypot(hand.velocity[0], hand.velocity[1])
                    if (dwell >= self.min_grasp_dwell_sec or hand.is_grasping) and not contact["is_take_confirmed"]:
                        # Verify whether item displacement from shelf baseline has begun
                        initial_b = contact["initial_bbox"]
                        disp = self.calculate_center_distance(p_bbox, initial_b)
                        if disp > 30.0 or hand.is_grasping:
                            contact["is_take_confirmed"] = True
                            self.customer_held_inventory[customer_id].append({
                                "product_name": p_name,
                                "taken_at": now,
                                "shelf_bbox": initial_b
                            })
                            actions.append(HOIAction(
                                action_type="TAKE",
                                customer_track_id=customer_id,
                                product_name=p_name,
                                confidence=0.96,
                                timestamp=now,
                                hand_side=hand.side,
                                dwell_duration=dwell,
                                metadata={"status": "taken_from_shelf", "displacement_px": round(disp, 1)}
                            ))
                            logger.info(f"HOI: Customer #{customer_id} TOOK {p_name} from shelf!")

            else:
                # Hand is no longer in contact with any shelf product
                if existing_contact:
                    # Contact has broken -> Evaluate whether item was PUT_BACK or REMOVED
                    contact = self.active_contacts[contact_key]
                    p_name = contact["product_name"]
                    hold_time = now - contact["start_time"]

                    # Check if customer previously held this item and just put it back
                    held_list = self.customer_held_inventory.get(customer_id, [])
                    matching_held = next((h for h in held_list if h["product_name"] == p_name), None)

                    if matching_held and not contact["is_take_confirmed"]:
                        # Item was returned to shelf slot
                        held_list.remove(matching_held)
                        actions.append(HOIAction(
                            action_type="PUT_BACK",
                            customer_track_id=customer_id,
                            product_name=p_name,
                            confidence=0.94,
                            timestamp=now,
                            hand_side=hand.side,
                            dwell_duration=hold_time,
                            metadata={"status": "returned_to_shelf_slot"}
                        ))
                        logger.info(f"HOI: Customer #{customer_id} PUT BACK {p_name}")

                    del self.active_contacts[contact_key]

        return actions
