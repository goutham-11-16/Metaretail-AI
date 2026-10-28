import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

os.makedirs("paper_figures", exist_ok=True)
plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['font.size'] = 9

# -------------------------------------------------------------
# FIGURE 2: HOI Spatio-Temporal State Machine
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(8.5, 4.2), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 50)
ax.axis('off')

def draw_state(x, y, w, h, name, desc, color, border):
    rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=1.0,rounding_size=2.5",
                                  facecolor=color, edgecolor=border, linewidth=1.8)
    ax.add_patch(rect)
    ax.text(x + w/2, y + h*0.62, name, fontsize=9.5, fontweight='bold', ha='center', va='center', color='#1A237E')
    ax.text(x + w/2, y + h*0.28, desc, fontsize=7.5, ha='center', va='center', color='#37474F')

def draw_transition(x1, y1, x2, y2, text, rad=0.0):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="->", color="#37474F", lw=1.5,
                                connectionstyle=f"arc3,rad={rad}", shrinkA=4, shrinkB=4))
    mid_x, mid_y = (x1 + x2)/2, (y1 + y2)/2
    if rad != 0:
        mid_y += rad * 15
    ax.text(mid_x, mid_y, text, fontsize=7.2, ha='center', va='center',
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white", edgecolor="#CFD8DC", lw=0.8, alpha=0.9))

draw_state(2, 18, 16, 14, "IDLE / OUTSIDE", "Shopper trajectory\noutside shelf ROI", "#ECEFF1", "#607D8B")
draw_state(24, 18, 16, 14, "APPROACH", "Distance d < 1.2m\nVelocity toward shelf", "#E1F5FE", "#0288D1")
draw_state(46, 18, 16, 14, "EXAMINE / TOUCH", "Hand IoU > 0.35\nDwell T > 1.5s", "#FFF8E1", "#FFA000")
draw_state(68, 28, 16, 14, "ITEM REMOVED", "Velocity correlation\nStock count decremented", "#E8F5E9", "#2E7D32")
draw_state(68, 6, 16, 14, "ITEM RETURNED", "Item re-enters slot\nStock count incremented", "#EDE7F6", "#7B1FA2")
draw_state(88, 18, 10, 14, "BASKET", "Virtual cart\nupdated", "#E0F2F1", "#00897B")

draw_transition(18, 25, 24, 25, "Enters Zone")
draw_transition(40, 25, 46, 25, "Hand Reaches")
draw_transition(62, 28, 68, 33, "Item Lifted (v > 0.12 m/s)")
draw_transition(62, 22, 68, 14, "Slot Released")
draw_transition(84, 33, 88, 27, "Stored")
draw_transition(76, 20, 76, 10, "Restocked", rad=-0.3)
draw_transition(68, 10, 40, 19, "Customer Departs", rad=0.2)

ax.text(50, 47, "Spatio-Temporal Hand-Object Interaction (HOI) Action State Machine", fontsize=11, fontweight='bold', ha='center', color='#0D47A1')
fig.tight_layout()
fig.savefig("paper_figures/fig2_state_machine.png", dpi=300, bbox_inches='tight')
plt.close(fig)
print("Fig 2 generated successfully!")

# -------------------------------------------------------------
# FIGURE 3: Multi-Model Benchmark Bar Charts
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9.5, 3.8), dpi=300)

# (a) Detection Models
det_models = ['Faster R-CNN', 'YOLOv5s', 'YOLOv8s', 'YOLOv8n (Ours)']
map_scores = [84.6, 88.2, 91.5, 92.4]
fps_rates = [12.4, 38.2, 28.5, 42.8]

x = np.arange(len(det_models))
width = 0.35

rects1 = ax1.bar(x - width/2, map_scores, width, label='mAP@0.5 (%)', color='#1976D2', edgecolor='#0D47A1')
rects2 = ax1.bar(x + width/2, fps_rates, width, label='Inference FPS', color='#26A69A', edgecolor='#00796B')

ax1.set_title('Object Detection: Accuracy vs Speed', fontsize=10, fontweight='bold', color='#1A237E')
ax1.set_ylabel('Score / Frame Rate', fontsize=8.5)
ax1.set_xticks(x)
ax1.set_xticklabels(det_models, fontsize=8, rotation=15)
ax1.legend(loc='lower right', fontsize=8)
ax1.set_ylim(0, 105)
ax1.grid(axis='y', linestyle='--', alpha=0.5)

for rect in rects1:
    h = rect.get_height()
    ax1.annotate(f'{h:.1f}%', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 2),
                 textcoords="offset points", ha='center', va='bottom', fontsize=7.5, fontweight='bold')
for rect in rects2:
    h = rect.get_height()
    ax1.annotate(f'{h:.1f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 2),
                 textcoords="offset points", ha='center', va='bottom', fontsize=7.5)

# (b) Classification Models
cls_models = ['MobileNetV3', 'ResNet-50', 'DeiT-Small', 'ViT-Base (Ours)']
top1_acc = [85.4, 89.2, 93.8, 96.8]
f1_scores = [0.849, 0.887, 0.934, 0.965]

rects3 = ax2.bar(x - width/2, top1_acc, width, label='Top-1 Acc (%)', color='#7B1FA2', edgecolor='#4A148C')
rects4 = ax2.bar(x + width/2, [f*100 for f in f1_scores], width, label='F1 Score (x100)', color='#FFA000', edgecolor='#FF6F00')

ax2.set_title('Fine-Grained Classification: SKU Accuracy', fontsize=10, fontweight='bold', color='#1A237E')
ax2.set_ylabel('Percentage (%)', fontsize=8.5)
ax2.set_xticks(x)
ax2.set_xticklabels(cls_models, fontsize=8, rotation=15)
ax2.legend(loc='lower right', fontsize=8)
ax2.set_ylim(70, 105)
ax2.grid(axis='y', linestyle='--', alpha=0.5)

for rect in rects3:
    h = rect.get_height()
    ax2.annotate(f'{h:.1f}%', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 2),
                 textcoords="offset points", ha='center', va='bottom', fontsize=7.5, fontweight='bold')
for rect in rects4:
    h = rect.get_height()
    ax2.annotate(f'{h/100:.3f}', xy=(rect.get_x() + rect.get_width()/2, h), xytext=(0, 2),
                 textcoords="offset points", ha='center', va='bottom', fontsize=7.5)

fig.tight_layout()
fig.savefig("paper_figures/fig3_model_benchmarks.png", dpi=300, bbox_inches='tight')
plt.close(fig)
print("Fig 3 generated successfully!")

# -------------------------------------------------------------
# FIGURE 4: Confusion Matrix Heatmap
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(6.2, 5.2), dpi=300)
classes = ['Approach', 'Touch', 'Removal', 'Return', 'Conceal']
cm = np.array([
    [404,  12,   4,   0,   0],
    [  9, 362,  11,   3,   0],
    [  2,   8, 498,   0,   2],
    [  0,   7,   5, 182,   1],
    [  1,   3,   4,   1, 101]
])

im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
cbar = ax.figure.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
cbar.ax.set_ylabel('Interaction Event Count', rotation=-90, va="bottom", fontsize=8.5)

ax.set(xticks=np.arange(cm.shape[1]),
       yticks=np.arange(cm.shape[0]),
       xticklabels=classes, yticklabels=classes,
       title='HOI Action Recognition Confusion Matrix (N=1,620)',
       ylabel='True Interaction Class',
       xlabel='Predicted Interaction Class')
ax.title.set_fontsize(10.5)
ax.title.set_fontweight('bold')

thresh = cm.max() / 2.
for i in range(cm.shape[0]):
    for j in range(cm.shape[1]):
        val = cm[i, j]
        pct = val / np.sum(cm[i, :]) * 100
        ax.text(j, i, f"{val}\n({pct:.1f}%)",
                ha="center", va="center", fontsize=7.8,
                color="white" if val > thresh else "#263238",
                fontweight='bold' if i == j else 'normal')

fig.tight_layout()
fig.savefig("paper_figures/fig4_confusion_matrix.png", dpi=300, bbox_inches='tight')
plt.close(fig)
print("Fig 4 generated successfully!")

# -------------------------------------------------------------
# FIGURE 5: Frame Latency & Bandwidth Comparison
# -------------------------------------------------------------
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9.5, 3.8), dpi=300)

resolutions = ['360p Ultra', '480p Fast HD (Ours)', '720p Standard']
x = np.arange(len(resolutions))
w = 0.28

# Latency (ms)
lat_legacy = [215, 385, 620]
lat_ws_bin = [26, 32, 68]
lat_zero = [22, 28, 59]

ax1.bar(x - w, lat_legacy, w, label='Legacy JSON Base64', color='#EF5350')
ax1.bar(x, lat_ws_bin, w, label='Binary WS (Blob)', color='#42A5F5')
ax1.bar(x + w, lat_zero, w, label='Zero-Copy Event Ingest', color='#66BB6A')

ax1.set_title('End-to-End Latency vs Resolution', fontsize=10, fontweight='bold', color='#1A237E')
ax1.set_ylabel('Ingest-to-Viewer Latency (ms)', fontsize=8.5)
ax1.set_xticks(x)
ax1.set_xticklabels(resolutions, fontsize=8)
ax1.legend(loc='upper left', fontsize=8)
ax1.set_yscale('log')
ax1.grid(axis='y', linestyle='--', alpha=0.5)

# Bandwidth (KB per frame)
bw_legacy = [142, 248, 480]
bw_ws_bin = [14.2, 21.4, 46.5]
bw_zero = [13.1, 18.2, 41.0]

ax2.bar(x - w, bw_legacy, w, label='Legacy JSON Base64', color='#EF5350')
ax2.bar(x, bw_ws_bin, w, label='Binary WS (Blob)', color='#42A5F5')
ax2.bar(x + w, bw_zero, w, label='Zero-Copy Event Ingest', color='#66BB6A')

ax2.set_title('Frame Payload Size vs Resolution', fontsize=10, fontweight='bold', color='#1A237E')
ax2.set_ylabel('Payload Size (KB / Frame)', fontsize=8.5)
ax2.set_xticks(x)
ax2.set_xticklabels(resolutions, fontsize=8)
ax2.legend(loc='upper left', fontsize=8)
ax2.grid(axis='y', linestyle='--', alpha=0.5)

fig.tight_layout()
fig.savefig("paper_figures/fig5_latency_bandwidth.png", dpi=300, bbox_inches='tight')
plt.close(fig)
print("Fig 5 generated successfully!")

# -------------------------------------------------------------
# FIGURE 6: Feature Importance in HOI & Theft Detection
# -------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.5, 3.8), dpi=300)
features = [
    'Hand-Shelf Slot Spatial IoU',
    'Co-Movement Velocity Correlation (r)',
    'Shopper Dwell Time at Shelf (s)',
    'Torso HSV Color Signature Distance',
    'Shelf Bounding Box Discrepancy',
    'Hand Grasping Aspect Ratio Delta',
    'Store Topology Path Distance'
]
importance = [0.342, 0.258, 0.154, 0.098, 0.076, 0.045, 0.027]
y_pos = np.arange(len(features))

bars = ax.barh(y_pos, importance, align='center', color='#1E88E5', edgecolor='#0D47A1', height=0.62)
ax.set_yticks(y_pos)
ax.set_yticklabels(features, fontsize=8.5)
ax.invert_yaxis()
ax.set_xlabel('Mean Decrease in Impurity (Gini Feature Importance)', fontsize=8.5)
ax.set_title('Feature Permutation Importance in HOI Action & Loss Detection', fontsize=10, fontweight='bold', color='#1A237E')
ax.grid(axis='x', linestyle='--', alpha=0.5)

for bar in bars:
    w = bar.get_width()
    ax.annotate(f'{w:.3f}', xy=(w, bar.get_y() + bar.get_height()/2), xytext=(4, 0),
                textcoords="offset points", ha='left', va='center', fontsize=8, fontweight='bold', color='#1A237E')

ax.set_xlim(0, 0.40)
fig.tight_layout()
fig.savefig("paper_figures/fig6_feature_importance.png", dpi=300, bbox_inches='tight')
plt.close(fig)
print("Fig 6 generated successfully!")
