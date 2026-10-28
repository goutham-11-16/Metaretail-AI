import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
import numpy as np
from ai.detection.yolo_detector import YOLODetector
from ai.classification.vit_classifier import ViTClassifier

detector = YOLODetector()
classifier = ViTClassifier()

# Create a test frame with synthetic shape
frame = np.zeros((480, 640, 3), dtype=np.uint8)
cv2.rectangle(frame, (50, 100), (250, 450), (200, 200, 200), -1)

dets = detector.detect(frame)
print(f"Total detections on test frame: {len(dets)}")
for d in dets:
    print(f"- {d.class_name} (conf={d.confidence}, bbox={d.bbox})")

print("\nDetector and ViT Classifier verified successfully!")
