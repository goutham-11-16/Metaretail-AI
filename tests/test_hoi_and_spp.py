"""
Unit Tests for Hand-Object Interaction (HOI) Engine and Multi-Angle ViT Classifier Consensus.
"""
import pytest
import numpy as np
import time
from ai.interaction.hoi_engine import HandObjectInteractionEngine, HandTrack, HOIAction
from ai.interaction.interaction_engine import InteractionEngine
from ai.tracking.bytetrack_tracker import TrackedCustomer
from ai.classification.vit_classifier import ViTClassifier, ClassificationResult


def test_hoi_engine_touch_and_take():
    hoi = HandObjectInteractionEngine(
        touch_iou_threshold=0.10,
        reach_distance_px=100.0,
        min_grasp_dwell_sec=0.4
    )

    t0 = time.time()
    products = [
        {"name": "Coca-Cola 500ml", "bbox": (100, 100, 180, 220), "confidence": 0.95}
    ]

    # Hand reaches and touches the bottle
    hand_touching = HandTrack(
        hand_id=1,
        wrist=(130.0, 180.0),
        bbox=(110, 130, 170, 200),
        is_grasping=False,
        velocity=(0.0, 0.0),
        side="right"
    )

    # First frame: Contact registered
    actions1 = hoi.evaluate_hoi(
        customer_id=42,
        customer_bbox=(50, 50, 250, 400),
        hands=[hand_touching],
        visible_products=products,
        timestamp=t0
    )
    assert len(actions1) == 0  # Dwell not yet met (<0.3s)

    # Second frame after 0.35s: TOUCH action emitted
    actions2 = hoi.evaluate_hoi(
        customer_id=42,
        customer_bbox=(50, 50, 250, 400),
        hands=[hand_touching],
        visible_products=products,
        timestamp=t0 + 0.35
    )
    assert len(actions2) == 1
    assert actions2[0].action_type == "TOUCH"
    assert actions2[0].product_name == "Coca-Cola 500ml"

    # Third frame after 0.5s with grasp active: TAKE action emitted
    hand_grasping = HandTrack(
        hand_id=1,
        wrist=(130.0, 180.0),
        bbox=(110, 130, 170, 200),
        is_grasping=True,
        velocity=(5.0, 2.0),
        side="right"
    )
    actions3 = hoi.evaluate_hoi(
        customer_id=42,
        customer_bbox=(50, 50, 250, 400),
        hands=[hand_grasping],
        visible_products=products,
        timestamp=t0 + 0.50
    )
    assert len(actions3) == 1
    assert actions3[0].action_type == "TAKE"
    assert actions3[0].product_name == "Coca-Cola 500ml"
    assert len(hoi.customer_held_inventory[42]) == 1


def test_interaction_engine_evaluate_with_hoi():
    engine = InteractionEngine()

    now = time.time()
    customer = TrackedCustomer(
        track_id=7,
        bbox=(100, 80, 220, 360),
        confidence=0.92,
        first_seen=now - 2.0,
        last_seen=now
    )

    product = ClassificationResult(
        product_name="Doritos Nacho",
        category="Snacks",
        confidence=0.90,
        bbox=(140, 120, 200, 190),
        timestamp=time.time(),
        is_catalog_match=True
    )

    hand = HandTrack(
        hand_id=1,
        wrist=(160.0, 150.0),
        bbox=(145, 125, 195, 185),
        is_grasping=True,
        velocity=(1.0, 0.0),
        side="right"
    )

    events = engine.evaluate_with_hoi(
        customers=[customer],
        products=[product],
        customer_hands={7: [hand]}
    )

    assert isinstance(events, list)
    assert len(events) >= 1
    actions = [e.action for e in events]
    assert "PICKUP" in actions or "APPROACH" in actions
