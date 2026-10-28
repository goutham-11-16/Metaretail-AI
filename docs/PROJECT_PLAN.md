# MetaRetail AI — Project Plan & Detailed Specifications

## 1. Project Overview
MetaRetail AI is an autonomous retail analytics software suite engineered for senior CSE / AI & ML academic evaluation. The system converts low-cost video inputs (PC webcam, mobile camera) into structured, actionable visual retail intelligence.

## 2. Functional Requirements
- **FR-1**: Detect customers and retail products in real time (20+ FPS target).
- **FR-2**: Assign consistent tracking IDs to customers navigating near shelves using ByteTrack.
- **FR-3**: Classify cropped product images using Vision Transformer (ViT) to distinguish fine-grained retail packaging (e.g. Coke vs. Pepsi vs. Lays).
- **FR-4**: Infer customer interactions (Approach, Touch/Pickup, Item Removal, Item Return) using spatial-temporal bounding box relationships.
- **FR-5**: Maintain persistent inventory levels, automatically decrementing on confirmed item removal and incrementing on item return.
- **FR-6**: Generate persistent low-stock alerts when stock drops to or below pre-configured thresholds.
- **FR-7**: Expose REST endpoints and WebSockets for real-time video, event streaming, and analytics.
- **FR-8**: Provide an interactive web dashboard built with React + Vite + Tailwind CSS.

## 3. Technology Stack Justification
- **OpenCV & YOLOv8**: High-speed frame capture, bounding box prediction, GPU/CPU execution optimization.
- **ByteTrack**: Motion prediction using Kalman Filtering and Hungarian association without heavy re-ID neural networks.
- **Vision Transformer (ViT)**: Self-attention mechanism captures fine-grained texture features in cropped packaging regions where traditional CNNs struggle.
- **FastAPI + Uvicorn**: Asynchronous Python backend capable of streaming high-frequency WebSocket frames and JSON payloads.
- **SQLite / SQLAlchemy**: Lightweight file database with zero configuration, designed with standard ORM mapping for easy PostgreSQL migration.
- **React + Vite**: Fast, modular frontend component rendering with immediate hot-reloading during development.

## 4. Development Phases
1. **Phase 1: Foundation & Architecture Setup** (Current)
2. **Phase 2: OpenCV Frame Capture & Video Pipeline**
3. **Phase 3: YOLO Object Detection Integration**
4. **Phase 4: ByteTrack Multi-Object Customer Tracking**
5. **Phase 5: ViT Product Classification Pipeline**
6. **Phase 6: Temporal Interaction Deduction Engine**
7. **Phase 7: Inventory & Low-Stock Alert Engine**
8. **Phase 8: Customer & Event Analytics Engine**
9. **Phase 9: FastAPI Backend REST & WebSocket Integration**
10. **Phase 10: React Web Dashboard Development**
11. **Phase 11: End-to-End System Testing & Live Demo Validation**

## 5. Risk Assessment & Mitigations
- **Occlusion during product pickup**: Mitigated by temporal tracking across multiple frames rather than single-frame detection.
- **Similar product packaging (e.g., Diet Coke vs Regular Coke)**: ViT patch embeddings retain global and fine-grained spatial features.
- **Hardware resource limits on CPU**: Optimized model selection (YOLOv8n + ViT-base quantized/distilled) to maintain smooth processing on standard laptops.
