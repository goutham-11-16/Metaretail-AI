"""
Standalone OpenCV Visual Demo Runner for MetaRetail AI
Displays live camera window with annotated bounding boxes, customer IDs, product labels, and stock telemetry.
"""
import os
import sys
import cv2
import time
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.camera_service import CameraService
from backend.app.services.pipeline_service import VisionPipelineService

def run_demo(source: int | str):
    print(f"Starting MetaRetail AI Autonomous Visual Demo (Source: {source})...")
    print("Press 'q' in the window to quit.")

    camera = CameraService(source=source)
    camera.start()
    pipeline = VisionPipelineService()

    cv2.namedWindow("MetaRetail AI - Vision Transformer Retail Analytics", cv2.WINDOW_NORMAL)

    try:
        while True:
            ret, frame = camera.get_frame()
            if not ret:
                break

            telemetry = pipeline.process_frame(frame)

            # Draw Customer bounding boxes & trajectories
            for customer in telemetry["customers"]:
                xmin, ymin, xmax, ymax = customer["bbox"]
                track_id = customer["track_id"]
                dwell = customer["dwell_seconds"]
                
                cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (255, 128, 0), 2)
                cv2.putText(frame, f"Customer #{track_id:02d} ({dwell}s)", (xmin, ymin - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 128, 0), 2)

            # Draw Product bounding boxes & ViT labels
            for product in telemetry["products"]:
                xmin, ymin, xmax, ymax = product["bbox"]
                p_name = product["product_name"]
                conf = product["confidence"]

                cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (0, 255, 0), 2)
                cv2.putText(frame, f"{p_name} ({int(conf*100)}%)", (xmin, ymin - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            # Draw HUD Telemetry Header
            cv2.rectangle(frame, (0, 0), (640, 40), (20, 20, 20), -1)
            hud_text = f"Customers: {len(telemetry['customers'])} | FPS: {int(1000/max(telemetry['processing_ms'], 1))} | Processing: {telemetry['processing_ms']}ms"
            cv2.putText(frame, hud_text, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 200), 1)

            cv2.imshow("MetaRetail AI - Vision Transformer Retail Analytics", frame)

            if cv2.waitKey(30) & 0xFF == ord('q'):
                break

    finally:
        camera.stop()
        cv2.destroyAllWindows()
        print("Demo stopped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MetaRetail AI OpenCV Demo Runner")
    parser.add_argument("--source", default=0, help="Camera index (0) or path to video file")
    args = parser.parse_args()
    
    src = int(args.source) if str(args.source).isdigit() else args.source
    run_demo(src)
