import numpy as np
import cv2
import torch
import timm
from ultralytics import YOLO

print("=== Testing Real Deep Learning Models ===")

# 1. Test YOLOv8
print("\n1. Testing YOLOv8 Object Detector...")
yolo_model = YOLO("yolov8n.pt")
dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
cv2.circle(dummy_frame, (320, 240), 50, (255, 255, 255), -1)

yolo_res = yolo_model(dummy_frame, verbose=False)
print("✓ YOLOv8 Model Loaded and Inferred successfully! Number of classes:", len(yolo_model.names))

# 2. Test ViT Model
print("\n2. Testing Vision Transformer (ViT) via timm...")
vit_model = timm.create_model("vit_base_patch16_224", pretrained=True)
vit_model.eval()

dummy_crop = torch.randn(1, 3, 224, 224)
with torch.no_grad():
    vit_output = vit_model(dummy_crop)

print(f"✓ ViT Model Loaded! Output shape: {vit_output.shape}, Top logit: {vit_output.max().item():.3f}")
print("\nALL PRODUCTION DEEP LEARNING MODELS ARE WORKING!")
