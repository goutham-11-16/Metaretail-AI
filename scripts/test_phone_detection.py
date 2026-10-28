import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
import numpy as np
from ai.detection.yolo_detector import YOLODetector
from ai.classification.vit_classifier import ViTClassifier

detector = YOLODetector()
classifier = ViTClassifier()

# Create a realistic test image with a phone-like shape
img = np.full((480, 640, 3), 200, dtype=np.uint8)
# Draw a phone: black rounded rectangle with screen and camera notch
cv2.rectangle(img, (240, 120), (400, 400), (20, 20, 20), -1)
cv2.rectangle(img, (250, 140), (390, 380), (120, 180, 240), -1)
cv2.circle(img, (320, 130), 4, (100, 100, 100), -1)

dets = detector.detect(img)
print(f"Detections found: {len(dets)}")
for d in dets:
    print(f"Detected: {d.class_name} | Confidence: {d.confidence} | BBox: {d.bbox}")
    crop = img[d.bbox[1]:d.bbox[3], d.bbox[0]:d.bbox[2]]
    res = classifier.classify_crop(crop, d.bbox, fallback_label=d.class_name)
    print(f"-> ViT Classification: {res.product_name} ({res.category}) - Confidence: {res.confidence}")
