"""
Universal Physical Shelf Object & Take/Replace State Engine for MetaRetail AI
Detects ANY physical object taken from a shelf/table place, tracks when it is lifted,
and generates structured notes when it is REPLACED (left unbought) vs TAKEN AWAY (purchased).
"""
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional, Set
import time
import logging
import cv2
import numpy as np
from datetime import datetime

logger = logging.getLogger("metaretail.ai.shelf_tracker")

@dataclass
class ShelfItem:
    item_id: int
    name: str
    category: str
    shelf_bbox: Tuple[int, int, int, int]
    current_bbox: Tuple[int, int, int, int]
    original_pos: Tuple[float, float]
    position_history: List[Tuple[float, float]]
    state: str  # "ON_SHELF", "TAKEN_IN_HAND", "REPLACED", "TAKEN_AWAY"
    held_by_customer_id: Optional[int] = None
    lift_timestamp: Optional[float] = None
    replace_timestamp: Optional[float] = None
    total_inspections: int = 0
    total_replaces: int = 0
    total_purchases: int = 0

@dataclass
class ShelfAuditNote:
    note_id: int
    customer_id: int
    item_name: str
    action_type: str  # "TAKEN_FROM_SHELF", "REPLACED_ON_SHELF", "TAKEN_AWAY_PURCHASED"
    status_summary: str
    dwell_time_seconds: float
    timestamp_str: str
    note_text: str

class UniversalShelfTracker:
    """
    Tracks any physical item resting in a place (shelf/table), detects when a customer
    takes it from the place, and creates explicit notes when it is replaced vs taken away.
    """
    def __init__(self):
        self.next_item_id = 1
        self.next_note_id = 1
        self.shelf_items: Dict[int, ShelfItem] = {}
        self.audit_notes: List[ShelfAuditNote] = []
        self.customer_hand_history: Dict[int, Tuple[int, int]] = {}

    def _calc_iou_or_dist(self, bbox1: Tuple[int, int, int, int], bbox2: Tuple[int, int, int, int]) -> float:
        cx1, cy1 = (bbox1[0] + bbox1[2]) / 2, (bbox1[1] + bbox1[3]) / 2
        cx2, cy2 = (bbox2[0] + bbox2[2]) / 2, (bbox2[1] + bbox2[3]) / 2
        return ((cx1 - cx2)**2 + (cy1 - cy2)**2) ** 0.5
        
    def _get_center(self, bbox: Tuple[int, int, int, int]) -> Tuple[float, float]:
        return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)

    def update_and_audit(self, frame: np.ndarray, detections: list, customers: list) -> List[ShelfAuditNote]:
        """
        Processes current frame detections and tracks physical items being taken from shelf and replaced.
        """
        current_time = time.time()
        time_str = datetime.now().strftime("%I:%M:%S %p")
        new_notes: List[ShelfAuditNote] = []

        # 1. Extract all physical object bounding boxes in this frame (excluding people)
        object_dets = [d for d in detections if getattr(d, "class_name", "").lower() != "person"]

        # 2. Register or match physical items on shelf
        matched_item_ids = set()

        for obj in object_dets:
            obj_bbox = obj.bbox
            obj_name = obj.class_name if obj.class_name not in ["person", ""] else "Shelf Product"
            obj_center = self._get_center(obj_bbox)

            # Find closest known shelf item
            best_id = None
            min_dist = float("inf")

            for item_id, item in self.shelf_items.items():
                if item_id in matched_item_ids:
                    continue
                dist = self._calc_iou_or_dist(item.current_bbox, obj_bbox)
                if dist < 120 and dist < min_dist:
                    min_dist = dist
                    best_id = item_id

            if best_id is not None:
                item = self.shelf_items[best_id]
                item.current_bbox = obj_bbox
                item.position_history.append(obj_center)
                if len(item.position_history) > 50:
                    item.position_history.pop(0)
                matched_item_ids.add(best_id)
            else:
                # New item placed in view / on shelf
                new_id = self.next_item_id
                self.next_item_id += 1
                self.shelf_items[new_id] = ShelfItem(
                    item_id=new_id,
                    name=obj_name,
                    category="Supermarket Item",
                    shelf_bbox=obj_bbox,
                    current_bbox=obj_bbox,
                    original_pos=obj_center,
                    position_history=[obj_center],
                    state="ON_SHELF"
                )
                matched_item_ids.add(new_id)

        # 3. Track interaction with customers
        for cust in customers:
            cust_id = cust.track_id
            cust_bbox = cust.bbox

            for item_id, item in self.shelf_items.items():
                dist_to_cust = self._calc_iou_or_dist(cust_bbox, item.current_bbox)

                # Customer is touching/holding the item
                if dist_to_cust < 160:
                    if item.state == "ON_SHELF":
                        item.state = "TAKEN_IN_HAND"
                        item.held_by_customer_id = cust_id
                        item.lift_timestamp = current_time
                        item.total_inspections += 1

                        note = ShelfAuditNote(
                            note_id=self.next_note_id,
                            customer_id=cust_id,
                            item_name=item.name,
                            action_type="TAKEN_FROM_SHELF",
                            status_summary="TAKEN FROM PLACE (INSPECTING)",
                            dwell_time_seconds=0.0,
                            timestamp_str=time_str,
                            note_text=f"Customer #{cust_id} TOOK {item.name} from shelf for inspection."
                        )
                        self.next_note_id += 1
                        new_notes.append(note)
                        self.audit_notes.insert(0, note)
                        logger.info(note.note_text)

                    elif item.state == "TAKEN_IN_HAND" and item.held_by_customer_id == cust_id:
                        # Check if customer put the item back on shelf and released it
                        hold_duration = current_time - (item.lift_timestamp or current_time)
                        dist_to_original_shelf = self._calc_iou_or_dist(item.current_bbox, item.shelf_bbox)

                        # If item is close to original shelf spot and customer is holding it > 1.5s
                        if dist_to_original_shelf < 140 and hold_duration > 1.8:
                            item.state = "ON_SHELF"
                            item.held_by_customer_id = None
                            item.replace_timestamp = current_time
                            item.total_replaces += 1
                            
                            current_center = self._get_center(item.current_bbox)
                            dist_misplaced = ((current_center[0] - item.original_pos[0])**2 + (current_center[1] - item.original_pos[1])**2)**0.5
                            
                            misplaced_str = ""
                            if dist_misplaced > 50:
                                misplaced_str = " (Replaced in wrong position)"

                            note = ShelfAuditNote(
                                note_id=self.next_note_id,
                                customer_id=cust_id,
                                item_name=item.name,
                                action_type="REPLACED_ON_SHELF",
                                status_summary="REPLACED (LEFT ON SHELF - NOT BOUGHT)",
                                dwell_time_seconds=round(hold_duration, 1),
                                timestamp_str=time_str,
                                note_text=f"Customer #{cust_id} REPLACED {item.name} on shelf after {round(hold_duration, 1)}s inspection.{misplaced_str}"
                            )
                            self.next_note_id += 1
                            new_notes.append(note)
                            self.audit_notes.insert(0, note)
                            logger.info(note.note_text)

        # 4. Check if an item taken in hand is no longer visible (Customer walked away with it)
        for item_id, item in list(self.shelf_items.items()):
            if item.state == "TAKEN_IN_HAND" and item_id not in matched_item_ids:
                hold_duration = current_time - (item.lift_timestamp or current_time)
                cust_id = item.held_by_customer_id or 1
                item.state = "TAKEN_AWAY"
                item.total_purchases += 1

                note = ShelfAuditNote(
                    note_id=self.next_note_id,
                    customer_id=cust_id,
                    item_name=item.name,
                    action_type="TAKEN_AWAY_PURCHASED",
                    status_summary="TAKEN AWAY (PURCHASED)",
                    dwell_time_seconds=round(hold_duration, 1),
                    timestamp_str=time_str,
                    note_text=f"Customer #{cust_id} TOOK {item.name} away from shelf. (Item Purchased / Removed)"
                )
                self.next_note_id += 1
                new_notes.append(note)
                self.audit_notes.insert(0, note)
                logger.info(note.note_text)

        # Keep latest 40 notes
        if len(self.audit_notes) > 40:
            self.audit_notes = self.audit_notes[:40]

        return new_notes

    def get_notes_summary(self) -> List[Dict[str, Any]]:
        return [
            {
                "note_id": n.note_id,
                "customer_id": n.customer_id,
                "item_name": n.item_name,
                "action_type": n.action_type,
                "status_summary": n.status_summary,
                "dwell_time_seconds": n.dwell_time_seconds,
                "timestamp_str": n.timestamp_str,
                "note_text": n.note_text
            }
            for n in self.audit_notes
        ]
