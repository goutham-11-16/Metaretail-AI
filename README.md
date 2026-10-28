# MetaRetail AI — Vision Transformer-Based Autonomous Retail Analytics

MetaRetail AI transforms ordinary smartphone cameras and PC webcams into intelligent, real-time retail analytics systems. By integrating state-of-the-art computer vision models—including YOLO object detection, ByteTrack customer tracking, and Vision Transformers (ViT) for fine-grained product classification—MetaRetail AI provides automated shelf-stock estimation, low-stock alert generation, customer interaction tracking, and an interactive real-time dashboard.

---

## Architecture Overview

```
Camera / Webcam
   ↓ (Frames via OpenCV)
YOLO Object Detection (People & Products)
   ↓
ByteTrack Customer Tracking (Track ID & Trajectory)
   ↓
Vision Transformer (ViT) Product Classification (Cropped Product Classification)
   ↓
Interaction Engine (Temporal Event Deduction: Approach, Pickup, Return)
   ↓
Inventory Engine (Stock Updates & Threshold Monitoring)
   ↓
FastAPI Backend (REST API + WebSockets)
   ↓
React Web Dashboard (Live Camera, Overview, Stock, Alerts, Logs, Analytics)
```

---

## Key Features

1. **Real-time Product & Customer Detection**: Multi-class detection using YOLOv8.
2. **Customer Movement Tracking**: ByteTrack identity preservation, trajectory estimation, and dwell-time calculation.
3. **Vision Transformer Product Classification**: High-accuracy fine-grained classification on cropped product regions.
4. **Autonomous Interaction Detections**: Detects when customers approach shelves, pick up items, remove items, or return items.
5. **Smart Inventory & Low-Stock Alerts**: Automatic stock decrement/increment with persistent database updates and real-time alert triggers.
6. **Unified Analytics Dashboard**: Live visual feedback, real-time WebSocket stats, store telemetry, event logging, and customer dwell/product affinity analytics.

---

## Tech Stack

- **Computer Vision & Deep Learning**: Python 3.11+, OpenCV, PyTorch, Ultralytics YOLOv8, ByteTrack, Vision Transformer (Timm / Hugging Face Transformers).
- **Backend API**: FastAPI, Uvicorn, WebSockets, Pydantic v2.
- **Database Layer**: SQLAlchemy, SQLite (with PostgreSQL migration path).
- **Frontend Dashboard**: React, Vite, Tailwind CSS, Lucide React Icons.

---

## Quick Start & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Webcam or video source

### 1. Environment Setup
Clone the repository and set up environment configuration:
```bash
git clone https://github.com/your-repo/MetaRetail-AI.git
cd MetaRetail-AI
cp .env.example .env
```

### 2. Backend Setup
Create a Python virtual environment and install dependencies:
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Seed initial products and inventory data into SQLite:
```bash
python scripts/seed_db.py
```

Start the FastAPI backend server:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Frontend Setup
Navigate to `frontend/`, install dependencies, and launch Vite development server:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running the Complete AI Pipeline Demo

Run the standalone end-to-end processing pipeline using webcam or sample video file:
```bash
python scripts/run_pipeline_demo.py --source 0
```

---

## Documentation Links

Detailed technical specs are available under `docs/`:
- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md): Complete functional and non-functional requirements.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): End-to-end system design & sequence diagrams.
- [`docs/DATASET_PLAN.md`](docs/DATASET_PLAN.md): Public dataset strategies (SKU-110K, RPC) & custom dataset specs.
- [`docs/API.md`](docs/API.md): Full OpenAPI REST and WebSocket specification.
- [`docs/MODEL_TRAINING.md`](docs/MODEL_TRAINING.md): Training pipeline guidelines for YOLO and ViT fine-tuning.
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md): Presentation guide for the 0th review and live demo setup.

---

## License

Academic Project — Department of CSE / AI & ML (2026–27).
