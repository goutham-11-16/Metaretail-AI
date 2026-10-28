import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

os.makedirs("paper_figures", exist_ok=True)
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 9

# -------------------------------------------------------------
# FIGURE 1: System Architecture Block Diagram
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 6.8), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis('off')

# Color palette (Clean Academic Blue/Teal/Indigo/Amber)
c_ingest = '#E1F5FE'  # Light Blue
c_ingest_border = '#0288D1'
c_vision = '#EDE7F6'  # Light Purple
c_vision_border = '#512DA8'
c_hoi = '#E8F5E9'     # Light Green
c_hoi_border = '#2E7D32'
c_engine = '#FFF3E0'  # Light Orange
c_engine_border = '#EF6C00'
c_ui = '#ECEFF1'      # Slate
c_ui_border = '#455A64'

def draw_box(x, y, w, h, title, subtitle, bg, border):
    rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1.2,rounding_size=2.0",
                                  facecolor=bg, edgecolor=border, linewidth=1.5)
    ax.add_patch(rect)
    ax.text(x + w/2, y + h*0.65, title, fontsize=9.5, fontweight='bold', ha='center', va='center', color='#1A237E')
    ax.text(x + w/2, y + h*0.30, subtitle, fontsize=7.8, ha='center', va='center', color='#37474F')

def draw_arrow(x1, y1, x2, y2, label=""):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="->", color="#37474F", lw=1.5, shrinkA=3, shrinkB=3))
    if label:
        ax.text((x1+x2)/2, (y1+y2)/2 + 1.2, label, fontsize=7, ha='center', va='bottom', color='#455A64', fontweight='semibold')

# Header Title in plot
ax.text(50, 97, "MetaRetail AI — End-to-End System Architecture", fontsize=12, fontweight='bold', ha='center', color='#0D47A1')
ax.text(50, 94, "Autonomous Computer Vision & Retail Analytics Pipeline", fontsize=8.5, ha='center', color='#546E7A')

# Layer 1: Multi-Source Edge Ingest
draw_box(4, 76, 26, 14, "Edge Video Ingest", "Smartphone RTSP/Webcam\nBinary WS (canvas.toBlob)", c_ingest, c_ingest_border)
draw_box(37, 76, 26, 14, "Zero-Copy Ingestion", "Async JPEG Header Parser\nDrop-Stale Frame Buffer", c_ingest, c_ingest_border)
draw_box(70, 76, 26, 14, "Frame Preprocessing", "Auto-Resize (480p/640p)\nLighting & Contrast Norm", c_ingest, c_ingest_border)

draw_arrow(30, 83, 37, 83, "Raw Bytes")
draw_arrow(63, 83, 70, 83, "Decoded")

# Layer 2: Core Vision Pipeline
draw_box(4, 48, 26, 16, "YOLOv8 Detection", "Shopper & Product ROI\nmAP@0.5 = 92.4% (30 FPS)", c_vision, c_vision_border)
draw_box(37, 48, 26, 16, "ByteTrack & Re-ID", "Kalman Tracking + Torso\nHSV Color Signature Match", c_vision, c_vision_border)
draw_box(70, 48, 26, 16, "Vision Transformer", "Cropped ViT-Base / ORB\nDeep Metric Embeddings", c_vision, c_vision_border)

draw_arrow(83, 76, 83, 67, "")
draw_arrow(83, 67, 17, 67, "")
draw_arrow(17, 67, 17, 64, "Tensor Batch")

draw_arrow(30, 56, 37, 56, "BBoxes")
draw_arrow(63, 56, 70, 56, "Product RoIs")

# Layer 3: Interaction & Security Engines
draw_box(4, 20, 26, 16, "Spatio-Temporal HOI", "State Machine: Approach,\nTouch, Removal, Return", c_hoi, c_hoi_border)
draw_box(37, 20, 26, 16, "Shelf Inventory Engine", "Real-Time Stock Audit,\nAuto Low-Stock Alerts", c_engine, c_engine_border)
draw_box(70, 20, 26, 16, "Loss Prevention Engine", "Bulk-Sweep & Concealment\nUnbilled Exit Deterrence", c_engine, c_engine_border)

draw_arrow(17, 48, 17, 36, "Track Vectors")
draw_arrow(50, 48, 50, 36, "Trajectory")
draw_arrow(83, 48, 83, 36, "SKU Labels")
draw_arrow(30, 28, 37, 28, "Item Deltas")
draw_arrow(63, 28, 70, 28, "Discrepancy")

# Layer 4: Serving & Presentation
draw_box(16, 2, 32, 11, "FastAPI Async Microservices", "REST APIs + Push WebSockets\nSQLAlchemy ORM + Audit Log", c_ui, c_ui_border)
draw_box(56, 2, 32, 11, "React 18 Analytics Dashboard", "Live Multi-Cam Grid, SVG Overlays\nDwell Heatmaps & Stock Telemetry", c_ui, c_ui_border)

draw_arrow(50, 20, 32, 13, "Events")
draw_arrow(48, 7, 56, 7, "Push Stream (30 FPS)")

fig.tight_layout()
fig.savefig("paper_figures/fig1_system_architecture.png", dpi=300, bbox_inches='tight')
plt.close(fig)
print("Fig 1 generated successfully!")
