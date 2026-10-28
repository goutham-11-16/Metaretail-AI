# MetaRetail AI — System Architecture & Data Flow

## System Architecture Diagram

```
+-----------------------------------------------------------------------+
|                            INPUT LAYER                                |
|  - USB Webcam / Phone Camera (RTSP/HTTP Stream)                       |
|  - Video File Reader (Test Benchmark Input)                           |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                           OPENCV ENGINE                               |
|  - Frame Capture & Preprocessing (Resize, RGB normalization)          |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                           DETECTION LAYER                             |
|  - YOLOv8 Detector (Person bounding box, Product bounding box)        |
+-----------------------------------------------------------------------+
                        |                      |
                        v                      v
+-------------------------------+      +-------------------------------+
|        TRACKING ENGINE        |      |      CLASSIFICATION ENGINE    |
| - ByteTrack Customer ID       |      | - Product Region Cropper      |
| - Trajectory & Dwell Time     |      | - Vision Transformer (ViT)    |
+-------------------------------+      +-------------------------------+
                        \                      /
                         v                    v
+-----------------------------------------------------------------------+
|                         INTERACTION ENGINE                            |
|  - Spatial Proximity Calculation (Customer vs Product ROI)            |
|  - Temporal State Machine (Approach -> Touch -> Removal -> Return)    |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    INVENTORY & ANALYTICS ENGINE                       |
|  - Inventory Increment / Decrement Service                            |
|  - Low-Stock Alert Evaluator                                          |
|  - Customer Dwell & Interaction Aggregator                            |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                     FASTAPI BACKEND & ORM LAYER                       |
|  - REST Endpoints (/api/products, /api/inventory, /api/analytics)    |
|  - WebSocket Endpoint (/ws/live)                                      |
|  - SQLite Database (SQLAlchemy ORM)                                   |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                         REACT DASHBOARD UI                            |
|  - Live Camera Canvas Feed with Annotated Bounding Boxes              |
|  - Store Telemetry Cards, Stock Tables, Real-Time Alert Feeds         |
+-----------------------------------------------------------------------+
```

## Data Models & Entity Relationships

- **Product**: `id`, `sku`, `name`, `category`, `current_stock`, `min_stock_threshold`, `unit_price`, `image_url`
- **Customer**: `id`, `track_id`, `entry_timestamp`, `exit_timestamp`, `total_dwell_seconds`
- **Interaction**: `id`, `customer_id`, `product_id`, `action_type` (`APPROACH`, `PICKUP`, `REMOVE`, `RETURN`), `confidence`, `timestamp`
- **Event**: `id`, `event_type`, `description`, `timestamp`, `metadata_json`
- **Alert**: `id`, `alert_type`, `product_id`, `severity`, `message`, `is_resolved`, `created_at`
