"""
ByteTrack Multi-Object Customer Tracking Module
"""
from dataclasses import dataclass, field
from typing import List, Tuple, Dict
import time
import logging
from ai.detection.yolo_detector import DetectionResult

logger = logging.getLogger("metaretail.ai.tracking")

def calculate_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-5)
    return iou

@dataclass
class TrackedCustomer:
    track_id: int
    bbox: Tuple[int, int, int, int]
    confidence: float
    first_seen: float
    last_seen: float
    trajectory: List[Tuple[int, int]] = field(default_factory=list)
    vx: float = 0.0
    vy: float = 0.0
    age: int = 0
    consecutive_misses: int = 0

    @property
    def dwell_time_seconds(self) -> float:
        return round(self.last_seen - self.first_seen, 1)

    def predict(self):
        # Simple velocity-based prediction
        x1, y1, x2, y2 = self.bbox
        self.bbox = (
            int(x1 + self.vx),
            int(y1 + self.vy),
            int(x2 + self.vx),
            int(y2 + self.vy)
        )
        self.age += 1
        self.consecutive_misses += 1


class ByteTrackTracker:
    """
    ByteTrack customer tracking interface.
    Preserves customer identity across video frames using IoU and velocity prediction.
    """
    def __init__(self, max_misses: int = 30):
        self.max_misses = max_misses
        self.active_tracks: Dict[int, TrackedCustomer] = {}
        self.next_track_id = 1

    def update(self, detections: List[DetectionResult]) -> List[TrackedCustomer]:
        """
        Consumes person detections and updates customer trajectories.
        """
        current_time = time.time()
        person_dets = [d for d in detections if d.class_name.lower() in ["person", "customer"]]

        for track in self.active_tracks.values():
            track.predict()

        updated_track_ids = set()

        for det in person_dets:
            det_bbox = det.bbox
            
            matched_id = None
            max_iou = 0.0

            for track_id, track in self.active_tracks.items():
                if track_id in updated_track_ids:
                    continue
                iou = calculate_iou(det_bbox, track.bbox)
                if iou > 0.3 and iou > max_iou:
                    max_iou = iou
                    matched_id = track_id

            cx, cy = (det_bbox[0] + det_bbox[2]) // 2, (det_bbox[1] + det_bbox[3]) // 2

            if matched_id is not None:
                track = self.active_tracks[matched_id]
                
                # Update velocity (alpha-beta filter style)
                old_cx, old_cy = (track.bbox[0] + track.bbox[2]) // 2, (track.bbox[1] + track.bbox[3]) // 2
                track.vx = 0.8 * track.vx + 0.2 * (cx - old_cx)
                track.vy = 0.8 * track.vy + 0.2 * (cy - old_cy)
                
                track.bbox = det_bbox
                track.confidence = det.confidence
                track.last_seen = current_time
                track.consecutive_misses = 0
                track.trajectory.append((cx, cy))
                if len(track.trajectory) > 50:
                    track.trajectory.pop(0)
                updated_track_ids.add(matched_id)
            else:
                new_id = self.next_track_id
                self.next_track_id += 1
                new_track = TrackedCustomer(
                    track_id=new_id,
                    bbox=det_bbox,
                    confidence=det.confidence,
                    first_seen=current_time,
                    last_seen=current_time,
                    trajectory=[(cx, cy)]
                )
                self.active_tracks[new_id] = new_track
                updated_track_ids.add(new_id)

        # Cleanup lost tracks quickly
        expired = [tid for tid, t in self.active_tracks.items() if t.consecutive_misses > self.max_misses]
        for tid in expired:
            del self.active_tracks[tid]

        # Only return tracks that are actively updated in the current frame or within recent threshold
        visible_tracks = [t for t in self.active_tracks.values() if t.consecutive_misses <= 5]
        return visible_tracks
