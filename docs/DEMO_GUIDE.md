# MetaRetail AI — 0th Review & Live Demo Guide

## 1. Physical Setup
- **Webcam / Phone Camera**: Pointed at a designated mock retail shelf containing sample products (`Coke`, `Pepsi`, `Lays`, `Biscuits`).
- **AI Laptop**: Running FastAPI backend, OpenCV video stream pipeline, and Vite React Dashboard.

## 2. Live Demo Script
1. **Initial State**:
   - Web Dashboard displays real-time video feed.
   - Inventory table lists initial stock counts (e.g. Coke: 3, Pepsi: 5, Lays: 2, Biscuits: 4).
2. **Customer Approach**:
   - A person enters the camera frame.
   - Bounding box `Customer #01` appears around the person.
3. **Product Interaction**:
   - Customer reaches out and picks up a product (e.g. `Coke`).
   - Interaction Engine logs `10:43 Customer #01 approach & pickup Coke`.
4. **Product Removal**:
   - Product leaves the shelf zone.
   - Inventory automatically updates (`Coke: 3 -> 2`).
5. **Low Stock Alert**:
   - When stock drops below minimum threshold (e.g., Lays: 2 -> 1 <= threshold 2), a persistent warning banner `Low stock: Lays (1 remaining)` triggers on the dashboard with audio/visual highlight.
