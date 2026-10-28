# MetaRetail AI — API Specification

The MetaRetail AI backend exposes RESTful endpoints and WebSockets for real-time frontend integration.

Base URL: `http://localhost:8000/api`

## REST Endpoints

### System Health
- **`GET /health`**
  - Response: `{"status": "ok", "version": "1.0.0", "timestamp": "2026-08-31T11:20:00Z"}`

### Products & Inventory
- **`GET /api/products`**: List all tracked retail products.
- **`POST /api/products`**: Create a new product.
- **`GET /api/inventory`**: Get current shelf stock levels and minimum thresholds.
- **`PUT /api/inventory/{product_id}`**: Manually adjust stock count.

### Customers & Interactions
- **`GET /api/customers`**: Retrieve active and historical tracked customers.
- **`GET /api/interactions`**: List customer-product interaction log (APPROACH, PICKUP, REMOVE, RETURN).

### Events & Alerts
- **`GET /api/events`**: Get chronological event audit log.
- **`GET /api/alerts`**: Fetch active low-stock alerts.
- **`POST /api/alerts/{alert_id}/resolve`**: Resolve a low-stock alert.

### Analytics
- **`GET /api/analytics`**: Summary of store metrics, dwell times, interaction counts, and top-selling items.

### Camera Control
- **`GET /api/camera/status`**: Check camera service state.
- **`POST /api/camera/start`**: Start video stream processing.
- **`POST /api/camera/stop`**: Stop video stream processing.

## WebSocket Live Stream
- **`WS /ws/live`**
  - Broadcasts frame metadata, bounding boxes, active tracking IDs, detected interactions, and live stats at up to 30 FPS.
