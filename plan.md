# MetaRetail AI — Project Initialization & Architecture

You are the lead software architect and AI engineer for my senior project.

I am building the project described in the attached PowerPoint:

**Project Name:** MetaRetail AI
**Title:** Vision Transformer-Based Autonomous Retail Analytics
**Department:** CSE / AI & ML
**Academic Year:** 2026–27

The attached PPT is the primary project specification. Carefully study the entire PPT before making implementation decisions.

---

# 1. PROJECT GOAL

Build the MetaRetail AI system from scratch.

The system should convert an ordinary phone camera or PC webcam into an intelligent retail analytics system.

The intended pipeline is:

Camera / Webcam
→ OpenCV
→ YOLO Object Detection
→ ByteTrack Customer Tracking
→ Vision Transformer Product Classification
→ Interaction Engine
→ Inventory + Analytics
→ Low-Stock Alerts
→ FastAPI Backend
→ React Web Dashboard

The system should eventually support:

1. Real-time product detection
2. Real-time customer detection
3. Customer tracking
4. Product classification using Vision Transformer
5. Customer-product interaction analysis
6. Product removal detection
7. Shelf-stock estimation
8. Inventory updates
9. Low-stock alerts
10. Event logging
11. Customer analytics
12. Live retail dashboard

The PPT describes the intended live demonstration as:

Customer approaches shelf
→ customer takes a product
→ system detects the event
→ inventory changes
→ dashboard updates.

Do not change the fundamental project concept.

---

# 2. IMPORTANT DEVELOPMENT RULE

This is a completely new project.

There is currently no existing implementation.

Do NOT assume that any backend, frontend, AI model, database, dataset, API, or UI already exists.

Build everything from scratch.

Do NOT generate a fake/demo implementation that merely looks complete.

Every major component should eventually have real implementation.

However, work incrementally and keep the project runnable at every stage.

---

# 3. FIRST TASK — ANALYZE BEFORE CODING

Before writing substantial implementation code:

1. Read and analyze the complete attached PPT.
2. Extract all functional requirements.
3. Extract the technology stack specified in the PPT.
4. Identify all major modules.
5. Identify dependencies between modules.
6. Design the complete system architecture.
7. Design the project folder structure.
8. Identify which components require training and which can use pretrained models.
9. Identify dataset requirements.
10. Identify what must be collected as custom data.
11. Identify risks and technically difficult components.
12. Create a phased implementation plan.

Create a document:

`docs/PROJECT_PLAN.md`

containing:

* Project overview
* Requirements
* Architecture
* Modules
* Technology stack
* Dataset strategy
* ML strategy
* API strategy
* Database strategy
* Frontend strategy
* Development phases
* Testing strategy
* Future scope
* Known limitations

Do not skip this planning step.

---

# 4. REQUIRED TECHNOLOGY STACK

Use the following stack as the baseline because it is specified in the project PPT.

## Computer Vision

* Python
* OpenCV
* YOLO

## Deep Learning

* PyTorch
* Vision Transformer (ViT)

## Tracking

* ByteTrack

Use ByteTrack as the primary tracker.

Do not unnecessarily implement multiple tracking algorithms initially.

## Backend

* Python
* FastAPI
* Uvicorn

## Frontend

* React
* Vite
* Tailwind CSS

## Database

Start with:

* SQLite

Design the database layer so it can later migrate to:

* PostgreSQL

## Communication

* REST API
* WebSocket for live camera/AI updates where appropriate

## Development

* Git
* GitHub-compatible project structure
* Python virtual environment

---

# 5. PROJECT STRUCTURE

Create a clean modular structure similar to:

MetaRetail-AI/

├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── ai/
│   │   ├── core/
│   │   ├── database/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   │
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── utils/
│   └── package.json
│
├── ai/
│   ├── detection/
│   ├── tracking/
│   ├── classification/
│   ├── interaction/
│   ├── inventory/
│   └── analytics/
│
├── datasets/
│   ├── public/
│   └── custom/
│
├── models/
│   ├── yolo/
│   └── vit/
│
├── scripts/
│
├── videos/
│
├── docs/
│
├── tests/
│
├── requirements.txt
├── .gitignore
├── README.md
└── docker-compose.yml

You may improve this structure if there is a strong technical reason, but keep the architecture modular and easy to understand for an academic project.

---

# 6. AI ARCHITECTURE

Design the AI pipeline as independent modules.

## Detector

Create a YOLO detection module responsible for:

* person detection
* retail product detection
* bounding boxes
* confidence scores
* class labels

The detector must have a clean interface so the model can later be replaced or retrained.

Example conceptual interface:

detect(frame) → detections

Each detection should contain:

* class
* confidence
* bounding box
* timestamp/frame ID

Do not hard-code product names throughout the application.

---

# 7. CUSTOMER TRACKING

Implement ByteTrack as a separate module.

Responsibilities:

* assign track IDs
* maintain customer identity between frames
* track movement
* calculate approximate dwell time
* maintain customer trajectories

Example:

Customer #01
Customer #02

The tracker should consume YOLO detections rather than directly accessing camera logic.

---

# 8. VISION TRANSFORMER

Create a separate product-classification module.

The intended architecture is:

YOLO detects product
→ crop product region
→ ViT classifies product
→ return product identity + confidence

Use a pretrained Vision Transformer initially.

Do NOT train a ViT from scratch unless there is a strong reason.

Design the classification module so a fine-tuned model can later be loaded.

Keep model loading and inference separate from API code.

---

# 9. INTERACTION ENGINE

Create a dedicated interaction engine.

This is a major project component.

It should eventually combine:

* customer tracking
* product detections
* product classification
* shelf/product positions
* temporal changes
* customer proximity
* product disappearance/reappearance

to infer events such as:

* customer approaches product
* customer interacts with product
* product picked up
* product removed
* product returned

Do NOT implement naive logic such as:

"If customer is near Coke → Coke removed."

The system should use temporal evidence and shelf-state changes.

Initially create the architecture and interfaces, then progressively improve the algorithm.

---

# 10. INVENTORY ENGINE

Create a separate inventory service.

It should maintain:

* product ID
* product name
* current stock
* minimum stock threshold
* last update time

Example:

Coke = 3
Pepsi = 5
Lays = 2

When a confirmed product-removal event occurs:

stock → stock - 1

When a return event is confirmed:

stock → stock + 1

Do not update inventory merely because a product detection disappears for one frame.

Require a confirmed interaction/removal event.

---

# 11. ALERT SYSTEM

Implement low-stock alert logic.

Example:

If:

stock <= minimum_stock

create a low-stock alert.

Store alerts in the database.

The frontend should eventually display active alerts.

---

# 12. EVENT LOGGING

Create an event system.

Store events such as:

* customer_detected
* customer_entered
* customer_exited
* product_detected
* product_removed
* product_returned
* inventory_updated
* low_stock

Every event should contain an appropriate timestamp and useful metadata.

---

# 13. CUSTOMER ANALYTICS

The system should eventually calculate:

* customer count
* dwell time
* interaction count
* most-interacted products
* customer movement
* product interaction frequency

Keep analytics modular so more metrics can be added later.

---

# 14. DATABASE

Use SQLite initially.

Create a clean database abstraction.

Suggested entities:

### Product

* id
* name
* category
* stock
* minimum_stock
* image_path

### Customer

* id
* track_id
* entry_time
* exit_time
* dwell_time

### Interaction

* id
* customer_id
* product_id
* action
* confidence
* timestamp

### Event

* id
* event_type
* description
* timestamp
* metadata

### Alert

* id
* alert_type
* product_id
* message
* severity
* created_at
* resolved_at

Use SQLAlchemy or another clean ORM/data-access layer.

Do not tightly couple the application to SQLite-specific code.

---

# 15. FASTAPI BACKEND

Create a proper FastAPI backend.

Suggested API groups:

GET /api/products
GET /api/inventory
GET /api/customers
GET /api/interactions
GET /api/events
GET /api/alerts
GET /api/analytics

Also provide suitable endpoints for:

* camera status
* starting/stopping processing
* health checks

Create:

GET /health

The API must return structured JSON.

Use Pydantic schemas.

Keep routes thin.

Business logic should remain in service modules.

---

# 16. LIVE AI STREAM

Design a WebSocket-based live update system.

The eventual architecture should be:

Camera
→ AI Pipeline
→ FastAPI WebSocket
→ React Dashboard

Live updates should be able to contain:

* current frame or stream information
* customer count
* tracked customers
* detected products
* bounding boxes
* classifications
* interaction events

Do not send unnecessary huge data through WebSocket.

Design the protocol carefully.

---

# 17. REACT DASHBOARD

Create a professional academic-project dashboard.

The dashboard should eventually contain:

### Live Camera

Show:

* live video
* bounding boxes
* customer IDs
* product labels

### Store Overview

Show:

* active customers
* total interactions
* detected products
* recent events

### Inventory

Show:

* product
* current stock
* minimum stock
* status

### Alerts

Show:

* low-stock products
* alert severity
* timestamp

### Event Log

Show:

* customer detected
* product removed
* product returned
* inventory update

### Customer Analytics

Show:

* dwell time
* interaction count
* most-interacted product

Use charts where useful.

The UI should be clean, modern, responsive, and suitable for a college project demonstration.

---

# 18. DATASET STRATEGY

Do NOT blindly download massive datasets.

First determine exactly which datasets are required for which task.

Potential public datasets include:

* SKU-110K for retail shelf/product detection
* Retail Product Checkout Dataset (RPC) for fine-grained retail product classification
* Freiburg Groceries Dataset for additional product classification experiments

Verify dataset licenses and availability before downloading.

Create:

`docs/DATASET_PLAN.md`

Document:

* dataset name
* source
* purpose
* classes
* size
* license
* download method
* preprocessing
* train/validation/test split
* intended model

If a public dataset is very large, do not download it automatically without first determining whether a subset is sufficient for development.

The project will also require a custom dataset.

Create:

datasets/custom/

for:

* product images
* shelf images
* customer interaction videos
* product removal videos
* product return videos

The custom dataset will be provided later by me.

Do not assume it exists yet.

---

# 19. DATASET PIPELINE

Create scripts for:

* dataset preparation
* image preprocessing
* augmentation
* train/validation/test splitting
* YOLO annotation conversion where necessary
* product crop generation
* classification dataset preparation

Keep dataset preparation scripts separate from training scripts.

---

# 20. MODEL TRAINING ARCHITECTURE

Create a clear training structure.

YOLO:

dataset
→ annotation
→ train
→ validation
→ test
→ metrics
→ trained model

ViT:

product images
→ classes
→ train
→ validation
→ test
→ metrics
→ fine-tuned model

Track:

### Detection

* Precision
* Recall
* mAP

### Classification

* Accuracy
* Precision
* Recall
* F1

Do not invent performance numbers.

Only report metrics after actual experiments have been executed.

---

# 21. CONFIGURATION

Create centralized configuration.

Do not hard-code:

* model paths
* database paths
* camera indexes
* thresholds
* API URLs
* WebSocket URLs
* confidence thresholds

Use environment variables/config files.

Provide:

`.env.example`

Never commit secrets.

---

# 22. TESTING

Create tests for:

* database
* API
* inventory
* alerts
* interaction engine
* detection data structures
* tracking data structures

Also create basic integration tests.

The project should be testable without requiring the physical camera for every test.

Use mock/sample frames where appropriate.

---

# 23. LOGGING & ERROR HANDLING

Implement proper logging.

Handle:

* camera unavailable
* invalid frame
* model missing
* database unavailable
* invalid API request
* WebSocket disconnect
* missing dataset
* invalid model path

Do not silently swallow exceptions.

---

# 24. DOCUMENTATION

Create:

README.md

It should explain:

1. Project overview
2. Features
3. Architecture
4. Tech stack
5. Installation
6. Environment setup
7. Dataset setup
8. Model setup
9. Backend startup
10. Frontend startup
11. Running the AI pipeline
12. API endpoints
13. Testing
14. Future improvements

Also create:

docs/
├── PROJECT_PLAN.md
├── ARCHITECTURE.md
├── DATASET_PLAN.md
├── API.md
├── MODEL_TRAINING.md
└── DEMO_GUIDE.md

---

# 25. DEVELOPMENT PHASES

Implement the project in the following order.

## Phase 1

Project initialization

* repository structure
* backend
* frontend
* configuration
* database
* documentation
* basic health API

## Phase 2

OpenCV camera pipeline

* webcam input
* frame processing
* camera service

## Phase 3

YOLO detection

* model loading
* person detection
* product detection
* bounding boxes

## Phase 4

ByteTrack

* customer tracking
* track IDs
* trajectories
* dwell time

## Phase 5

ViT

* product crop
* classification
* confidence
* model loading

## Phase 6

Interaction engine

* approach
* pickup
* removal
* return
* temporal reasoning

## Phase 7

Inventory

* stock management
* inventory updates
* low-stock alerts

## Phase 8

Analytics

* customer analytics
* product interaction analytics
* event analytics

## Phase 9

FastAPI integration

* REST APIs
* WebSocket
* AI/backend integration

## Phase 10

React dashboard

* live camera
* inventory
* alerts
* event logs
* analytics

## Phase 11

End-to-end integration

Camera
→ OpenCV
→ YOLO
→ ByteTrack
→ ViT
→ Interaction Engine
→ Inventory
→ FastAPI
→ React

---

# 26. IMPORTANT: MVP FIRST

Do not attempt to perfect the complete autonomous system immediately.

The first working MVP should be:

Webcam
→ OpenCV
→ YOLO
→ Person/product detection
→ display bounding boxes

Then progressively add:

ByteTrack
→ ViT
→ Interaction
→ Inventory
→ FastAPI
→ React

Every phase must produce a runnable result.

---

# 27. AVOID THESE MISTAKES

Do NOT:

* create fake AI predictions
* hard-code detection results
* claim models are trained when they aren't
* generate fake accuracy numbers
* hard-code inventory changes without an event
* make the dashboard display fabricated live data
* download enormous datasets unnecessarily
* put all logic inside main.py
* put all React code into one component
* tightly couple frontend and AI code
* train models from scratch unnecessarily
* skip documentation
* skip testing

If a component is not yet implemented, clearly mark it as pending rather than pretending it works.

---

# 28. FIRST IMPLEMENTATION TASK

For this first task, do NOT attempt to finish the complete AI system.

Instead:

1. Analyze the PPT.
2. Create the project structure.
3. Create backend foundation.
4. Create frontend foundation.
5. Create database foundation.
6. Create configuration.
7. Create documentation.
8. Create basic health API.
9. Create basic React dashboard shell.
10. Create placeholder interfaces for AI modules.
11. Create dataset directory structure.
12. Create requirements files.
13. Create .gitignore.
14. Create .env.example.
15. Make sure backend and frontend can start successfully.

At the end, provide:

* files created
* architecture summary
* technologies used
* commands to run backend
* commands to run frontend
* current implementation status
* remaining phases
* any issues encountered

Do not move to advanced model training until this foundation is working.

The project must remain clean, modular, maintainable, and suitable for a senior-level CSE/AI&ML academic project.
