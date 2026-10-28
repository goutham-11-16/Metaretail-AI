"""
Standard unittest runner for MetaRetail AI Backend & Core Modules
"""
import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from ai.detection.yolo_detector import YOLODetector
from ai.tracking.bytetrack_tracker import ByteTrackTracker
from ai.classification.vit_classifier import ViTClassifier
from ai.interaction.interaction_engine import InteractionEngine
from ai.inventory.inventory_engine import InventoryEngine
from ai.analytics.analytics_engine import AnalyticsEngine

class TestMetaRetailBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_02_get_products(self):
        response = self.client.get("/api/products")
        self.assertEqual(response.status_code, 200)
        products = response.json()
        self.assertIsInstance(products, list)
        self.assertGreaterEqual(len(products), 1)

    def test_03_get_inventory(self):
        response = self.client.get("/api/inventory")
        self.assertEqual(response.status_code, 200)
        inventory = response.json()
        self.assertIsInstance(inventory, list)

    def test_04_get_alerts(self):
        response = self.client.get("/api/alerts")
        self.assertEqual(response.status_code, 200)
        alerts = response.json()
        self.assertIsInstance(alerts, list)

    def test_05_ai_modules_instantiation(self):
        detector = YOLODetector()
        tracker = ByteTrackTracker()
        classifier = ViTClassifier()
        interaction = InteractionEngine()
        inventory = InventoryEngine()
        analytics = AnalyticsEngine()

        self.assertIsNotNone(detector)
        self.assertIsNotNone(tracker)
        self.assertIsNotNone(classifier)
        self.assertIsNotNone(interaction)
        self.assertIsNotNone(inventory)
        self.assertIsNotNone(analytics)

if __name__ == "__main__":
    unittest.main()
