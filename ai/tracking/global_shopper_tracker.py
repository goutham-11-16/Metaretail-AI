"""
Global Shopper Tracker & Multi-Camera Re-Identification (Re-ID) Engine
Enables seamless storewide shopper identity and virtual cart persistence across multiple camera angles.
"""
import time
import logging
from dataclasses import dataclass, field
from typing import Dict, Tuple, List, Optional, Any
import numpy as np
import cv2

logger = logging.getLogger("metaretail.ai.tracking.global")


@dataclass
class ShopperProfile:
    global_id: int
    first_seen: float
    last_seen: float
    current_camera_id: int
    current_zone_id: Optional[int]
    current_zone_name: str
    color_signature: np.ndarray
    aspect_ratio: float
    active_local_tracks: Dict[int, int] = field(default_factory=dict)
    dwell_seconds: float = 0.0
    cart_checked_out: bool = False


class GlobalShopperTracker:
    """
    Enterprise Multi-Camera Shopper Re-Identification.
    Fuses spatial zone topology, motion transit time, and torso HSV appearance signatures
    to link local camera tracks into a single unified global shopper entity across the warehouse.
    """
    def __init__(self, appearance_thresh: float = 0.60, max_transit_time: float = 60.0):
        self.appearance_thresh = appearance_thresh
        self.max_transit_time = max_transit_time
        self.next_global_id = 100
        self.global_shoppers: Dict[int, ShopperProfile] = {}
        # Mapping: (camera_id, local_track_id) -> global_id
        self.local_to_global: Dict[Tuple[int, int], int] = {}
        logger.info("GlobalShopperTracker initialized with multi-camera Re-ID.")

    def extract_appearance(self, frame: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
        """
        Extracts 128-bin normalized HSV color histogram from the shopper's torso (top 55% of bbox).
        Torso clothing is the most reliable appearance signature for cross-camera re-identification.
        """
        if frame is None or frame.size == 0:
            return np.zeros(128, dtype=np.float32)

        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        if x2 <= x1 or y2 <= y1:
            return np.zeros(128, dtype=np.float32)

        # Upper body / torso crop (from y1 to y1 + 0.55 * height)
        torso_y2 = y1 + int(0.55 * (y2 - y1))
        torso_crop = frame[y1:torso_y2, x1:x2]

        if torso_crop.size == 0 or torso_crop.shape[0] < 8 or torso_crop.shape[1] < 8:
            return np.zeros(128, dtype=np.float32)

        try:
            hsv = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2HSV)
            # 16 Hue bins x 8 Saturation bins = 128 bins
            hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            return hist
        except Exception:
            return np.zeros(128, dtype=np.float32)

    def resolve_track(
        self,
        camera_id: int,
        local_track_id: int,
        bbox: Tuple[int, int, int, int],
        frame: np.ndarray,
        zone_id: Optional[int] = None,
        zone_name: str = "General"
    ) -> int:
        """
        Resolves a local camera track ID to its storewide global_id.
        If the track was already mapped, returns the existing global_id.
        If newly seen, attempts appearance Re-ID matching against recently active shoppers.
        """
        now = time.time()
        key = (camera_id, local_track_id)

        # 1. Already mapped locally
        if key in self.local_to_global:
            gid = self.local_to_global[key]
            if gid in self.global_shoppers:
                prof = self.global_shoppers[gid]
                prof.last_seen = now
                prof.current_camera_id = camera_id
                prof.current_zone_id = zone_id
                prof.current_zone_name = zone_name
                prof.dwell_seconds = round(now - prof.first_seen, 1)
            return gid

        # 2. Extract appearance features for new candidate
        color_sig = self.extract_appearance(frame, bbox)
        w = max(1, bbox[2] - bbox[0])
        h = max(1, bbox[3] - bbox[1])
        aspect_ratio = round(h / float(w), 2)

        # 3. Search existing shoppers for Re-ID match across cameras
        best_gid = None
        best_score = 0.0

        for gid, prof in self.global_shoppers.items():
            # Only consider shoppers seen within transit window
            time_diff = now - prof.last_seen
            if time_diff > self.max_transit_time:
                continue

            # Don't match with another shopper simultaneously active in the same camera
            if prof.active_local_tracks.get(camera_id) is not None:
                # If seen in this exact camera within last 2 seconds under another track ID, skip
                if time_diff < 2.0:
                    continue

            # Appearance comparison via histogram correlation & Bhattacharyya distance
            if prof.color_signature is not None and color_sig is not None:
                sim_correl = max(0.0, float(cv2.compareHist(color_sig, prof.color_signature, cv2.HISTCMP_CORREL)))
                sim_bhat = max(0.0, 1.0 - float(cv2.compareHist(color_sig, prof.color_signature, cv2.HISTCMP_BHATTACHARYYA)))
                app_sim = 0.5 * sim_correl + 0.5 * sim_bhat

                # Aspect ratio penalty if vastly different
                ar_ratio = min(aspect_ratio, prof.aspect_ratio) / max(aspect_ratio, prof.aspect_ratio, 0.01)
                weighted_sim = (0.85 * app_sim) + (0.15 * ar_ratio)

                if weighted_sim > self.appearance_thresh and weighted_sim > best_score:
                    best_score = weighted_sim
                    best_gid = gid

        if best_gid is not None:
            # Successfully Re-Identified shopper moving across cameras!
            prof = self.global_shoppers[best_gid]
            prev_cam = prof.current_camera_id
            prof.last_seen = now
            prof.current_camera_id = camera_id
            prof.current_zone_id = zone_id
            prof.current_zone_name = zone_name
            prof.active_local_tracks[camera_id] = local_track_id
            prof.dwell_seconds = round(now - prof.first_seen, 1)
            
            # Smoothly update appearance signature (running average)
            prof.color_signature = 0.7 * prof.color_signature + 0.3 * color_sig

            self.local_to_global[key] = best_gid
            logger.info(
                f"[Cross-Camera Re-ID] Shopper #{best_gid} matched! Handover: Cam #{prev_cam} -> Cam #{camera_id} "
                f"(Score: {best_score:.2f}, Zone: {zone_name})"
            )
            return best_gid

        # 4. No match found -> Allocate new Global Shopper
        self.next_global_id += 1
        new_gid = self.next_global_id

        prof = ShopperProfile(
            global_id=new_gid,
            first_seen=now,
            last_seen=now,
            current_camera_id=camera_id,
            current_zone_id=zone_id,
            current_zone_name=zone_name,
            color_signature=color_sig,
            aspect_ratio=aspect_ratio,
            active_local_tracks={camera_id: local_track_id},
            dwell_seconds=0.0
        )
        self.global_shoppers[new_gid] = prof
        self.local_to_global[key] = new_gid
        logger.info(f"[Global Shopper] Registered new Storewide Shopper #{new_gid} on Cam #{camera_id} in {zone_name}.")
        return new_gid

    def get_shopper_profile(self, global_id: int) -> Optional[ShopperProfile]:
        return self.global_shoppers.get(global_id)

    def update_shopper(
        self,
        camera_id: int,
        local_track_id: int,
        global_id: int,
        embedding: Optional[np.ndarray] = None,
        zone_id: Optional[int] = None,
        zone_name: str = "General"
    ) -> ShopperProfile:
        now = time.time()
        key = (camera_id, local_track_id)
        self.local_to_global[key] = global_id

        if global_id in self.global_shoppers:
            prof = self.global_shoppers[global_id]
            prof.last_seen = now
            prof.current_camera_id = camera_id
            if zone_id is not None:
                prof.current_zone_id = zone_id
            if zone_name:
                prof.current_zone_name = zone_name
            prof.active_local_tracks[camera_id] = local_track_id
            prof.dwell_seconds = round(now - prof.first_seen, 1)
            if embedding is not None and embedding.size > 0:
                prof.color_signature = embedding
            return prof
        else:
            sig = embedding if (embedding is not None and embedding.size > 0) else np.zeros(128, dtype=np.float32)
            prof = ShopperProfile(
                global_id=global_id,
                first_seen=now,
                last_seen=now,
                current_camera_id=camera_id,
                current_zone_id=zone_id,
                current_zone_name=zone_name,
                color_signature=sig,
                aspect_ratio=2.2,
                active_local_tracks={camera_id: local_track_id},
                dwell_seconds=0.0
            )
            self.global_shoppers[global_id] = prof
            return prof

    def mark_checked_out(self, global_id: int):
        if global_id in self.global_shoppers:
            self.global_shoppers[global_id].cart_checked_out = True

    def is_checked_out(self, global_id: int) -> bool:
        if global_id in self.global_shoppers:
            return self.global_shoppers[global_id].cart_checked_out
        return False



shared_global_tracker = GlobalShopperTracker()
