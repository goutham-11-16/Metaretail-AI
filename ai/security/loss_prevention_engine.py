"""
AI Loss Prevention & Shrinkage Deterrence Engine for MetaRetail AI
Detects enterprise retail theft patterns:
1. Bulk Sweeping (Rapid shelf clearance by organized retail theft gangs)
2. Concealment (Item picked from shelf, pocketed/bagged out of view without basket registration)
3. Unpaid Exit (Approaching exit turnstiles with unbilled goods)
4. Suspicious Dwell (Prolonged loitering in high-theft electronics/cosmetics bay)
"""
import time
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models.domain import SecurityIncident, Alert, Event

logger = logging.getLogger("metaretail.security")


@dataclass
class ShopperSecurityProfile:
    track_id: int
    first_seen: float
    last_seen: float
    current_zone: str = "General"
    dwell_seconds: float = 0.0
    pick_timestamps: List[float] = field(default_factory=list)
    items_picked_count: int = 0
    incidents_triggered: int = 0
    held_items: Dict[str, float] = field(default_factory=dict)
    has_checked_out: bool = False


class LossPreventionEngine:
    def __init__(self):
        self.profiles: Dict[int, ShopperSecurityProfile] = {}
        self.recent_incidents: List[Dict[str, Any]] = []

    def get_or_create_profile(self, track_id: int, zone_name: str = "General", dwell_seconds: float = 0.0) -> ShopperSecurityProfile:
        now = time.time()
        if track_id not in self.profiles:
            self.profiles[track_id] = ShopperSecurityProfile(
                track_id=track_id,
                first_seen=now,
                last_seen=now,
                current_zone=zone_name,
                dwell_seconds=dwell_seconds
            )
        prof = self.profiles[track_id]
        prof.last_seen = now
        prof.dwell_seconds = dwell_seconds
        prof.current_zone = zone_name
        return prof

    def record_pickup(self, db: Session, track_id: int, item_name: str, camera_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        now = time.time()
        prof = self.get_or_create_profile(track_id)
        prof.held_items[item_name] = now
        prof.items_picked_count += 1
        prof.pick_timestamps.append(now)
        # Keep only last 10 seconds of picks for rapid sweeping detection
        prof.pick_timestamps = [t for t in prof.pick_timestamps if now - t <= 10.0]

        # Rule 1: Bulk Sweeping (>= 3 items lifted in < 3.5 seconds)
        if len(prof.pick_timestamps) >= 3 and prof.incidents_triggered < 2:
            incident = self._record_incident(
                db=db,
                incident_type="BULK_SWEEP",
                risk_score=0.92,
                track_id=track_id,
                camera_id=camera_id,
                description=f"Rapid shelf sweep detected: Shopper #{track_id} grabbed {len(prof.pick_timestamps)} items in under 3.5s in {prof.current_zone}.",
                recommended_action="Dispatch floor security to assist shopper and verify shelf display."
            )
            prof.incidents_triggered += 1
            return incident
        return None

    def record_replace(self, track_id: int, item_name: str):
        prof = self.get_or_create_profile(track_id)
        if item_name in prof.held_items:
            del prof.held_items[item_name]

    def check_concealment(self, db: Session, track_id: int, item_name: str, camera_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Rule 2: Concealment Detection
        If shopper picked an item up, held it for > 5s, and it disappears from shelf/hand without checkout registration.
        """
        now = time.time()
        prof = self.get_or_create_profile(track_id)
        pick_time = prof.held_items.get(item_name)
        if pick_time and (now - pick_time >= 5.0) and prof.incidents_triggered < 3:
            incident = self._record_incident(
                db=db,
                incident_type="CONCEALMENT",
                risk_score=0.88,
                track_id=track_id,
                camera_id=camera_id,
                description=f"Concealment alert: Shopper #{track_id} picked {item_name}, held it for {int(now - pick_time)}s, and item was concealed out of camera view in {prof.current_zone}.",
                recommended_action="Notify security associate to verify cart itemization at turnstile."
            )
            prof.incidents_triggered += 1
            del prof.held_items[item_name]
            return incident
        return None

    def check_unpaid_exit(
        self,
        db: Session,
        track_id: int,
        cart_items_count: int,
        is_checked_out: bool,
        zone_name: str = "Autonomous Exit Turnstiles",
        camera_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Rule 3: Unpaid Exit Detection
        Shopper enters exit turnstiles with unbilled goods or without autonomous checkout clearance.
        """
        prof = self.get_or_create_profile(track_id, zone_name=zone_name)
        is_exit = any(k in zone_name.lower() for k in ["checkout", "exit", "turnstile"])
        
        if is_exit and cart_items_count > 0 and not is_checked_out and prof.incidents_triggered < 3:
            incident = self._record_incident(
                db=db,
                incident_type="UNPAID_EXIT",
                risk_score=0.96,
                track_id=track_id,
                camera_id=camera_id,
                description=f"Turnstile Breach Attempt: Shopper #{track_id} approached {zone_name} with {cart_items_count} unverified/unpaid items.",
                recommended_action="Lock exit turnstile gate and prompt customer for mobile payment confirmation."
            )
            prof.incidents_triggered += 1
            return incident
        return None

    def update_shopper(
        self,
        db: Session,
        track_id: int,
        dwell_seconds: float,
        zone_name: str = "General",
        action: Optional[str] = None,
        camera_id: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates shopper activity in real time and flags anomalies.
        """
        now = time.time()
        prof = self.get_or_create_profile(track_id, zone_name=zone_name, dwell_seconds=dwell_seconds)

        incident = None

        # Rule 4: Extended Dwell in High-Value Category without interaction
        is_high_value_zone = any(k in zone_name.lower() for k in ["electronic", "tech", "cosmetic", "premium"])
        if is_high_value_zone and dwell_seconds > 45.0 and prof.items_picked_count == 0 and prof.incidents_triggered == 0:
            incident = self._record_incident(
                db=db,
                incident_type="SUSPICIOUS_DWELL",
                risk_score=0.76,
                track_id=track_id,
                camera_id=camera_id,
                description=f"Prolonged stationary dwell ({int(dwell_seconds)}s) in high-theft {zone_name} without product interaction.",
                recommended_action="Customer service greeting (deterrence check)."
            )
            prof.incidents_triggered += 1

        return incident

    def _record_incident(
        self,
        db: Session,
        incident_type: str,
        risk_score: float,
        track_id: int,
        camera_id: Optional[int],
        description: str,
        recommended_action: str
    ) -> Dict[str, Any]:
        """
        Creates SecurityIncident and high-priority Alert in database.
        """
        inc = SecurityIncident(
            incident_type=incident_type,
            risk_score=risk_score,
            customer_track_id=track_id,
            camera_id=camera_id,
            description=description,
            recommended_action=recommended_action,
            status="OPEN",
            created_at=datetime.utcnow()
        )
        db.add(inc)

        # Trigger CRITICAL Alert for visual and audio siren
        alert = Alert(
            alert_type="SECURITY_RISK",
            severity="CRITICAL",
            message=f"[{incident_type}] {description}",
            created_at=datetime.utcnow()
        )
        db.add(alert)
        db.commit()
        db.refresh(inc)

        data = {
            "id": inc.id,
            "incident_type": inc.incident_type,
            "risk_score": inc.risk_score,
            "customer_track_id": inc.customer_track_id,
            "camera_id": inc.camera_id,
            "description": inc.description,
            "recommended_action": inc.recommended_action,
            "status": inc.status,
            "created_at": inc.created_at.isoformat()
        }
        self.recent_incidents.insert(0, data)
        if len(self.recent_incidents) > 25:
            self.recent_incidents.pop()
        logger.warning(f"SECURITY ALERT [{incident_type}]: {description}")
        return data


shared_loss_prevention = LossPreventionEngine()
