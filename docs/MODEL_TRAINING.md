# MetaRetail AI — Model Training Architecture

## 1. YOLOv8 Object Detector Training Pipeline
- **Base Checkpoint**: `yolov8n.pt` / `yolov8s.pt`
- **Classes**: `0: person`, `1: product_item`
- **Training Command**:
  ```bash
  yolo task=detect mode=train model=yolov8n.pt data=datasets/yolo_config.yaml epochs=50 imgsz=640 batch=16
  ```
- **Evaluation Metrics**: Precision, Recall, mAP@50, mAP@50-95.

## 2. Vision Transformer (ViT) Fine-Tuning Pipeline
- **Base Architecture**: `google/vit-base-patch16-224` (ImageNet pre-trained).
- **Cropping Logic**: Crop detected product bounding box with 5% spatial margin.
- **Head**: Replace top classification layer with linear head mapped to custom product catalog (`Coke`, `Pepsi`, `Lays`, `Oreo`, `Juice`).
- **Optimization**: AdamW, `lr=1e-4`, Cosine Annealing learning rate schedule.
- **Evaluation Metrics**: Classification Accuracy, Top-1/Top-5 Precision, Recall, F1 Score.
