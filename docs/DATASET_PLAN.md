# MetaRetail AI — Dataset Strategy & Plan

## 1. Data Strategy Overview
To achieve reliable retail analytics without massive computational overhead, MetaRetail AI combines public retail benchmark datasets with custom-collected retail items.

## 2. Public Datasets
- **SKU-110K Dataset**:
  - **Purpose**: Training robust retail product bounding box detection in dense shelf environments.
  - **Size**: ~11,000 images containing over 1.7 million annotated bounding boxes.
  - **License**: Research / Non-commercial.
- **Retail Product Checkout (RPC) Dataset**:
  - **Purpose**: Fine-tuning Vision Transformer (ViT) on 200+ distinct retail product categories in structured packaging.
  - **Size**: ~83,000 checkout images with ground truth product labels.

## 3. Custom Mock-Shelf Dataset (`datasets/custom/`)
- **Target Products**:
  - Beverage: Coke (330ml Can / Bottle)
  - Beverage: Pepsi (330ml Can / Bottle)
  - Snack: Lays Potato Chips (Classic / Cream & Onion)
  - Snack: Oreo Biscuits
  - Beverage: Tropicana Juice Box
- **Data Collection Guidelines**:
  - 100+ images per product under varying ambient retail lighting.
  - Video recordings of customer approaches, item removal, and item replacement from mobile camera angles.

## 4. Preprocessing & Augmentation Pipeline
- Resizing product crops to `224x224` for ViT input.
- Random rotation (+/- 15 deg), color jittering (brightness, contrast), random horizontal flip.
- Conversion to YOLO annotation format (`class cx cy w h`).
