"""
Production WebSocket Endpoint for Real-time AI Stream & Client Webcam Frame Processing
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import base64
import logging
import cv2
import numpy as np
from backend.app.services.camera_service import CameraService
from backend.app.services.pipeline_instance import shared_pipeline_service

logger = logging.getLogger("metaretail.backend.websocket")

router = APIRouter()

@router.websocket("/ws/live")
async def websocket_live_stream(websocket: WebSocket):
    """
    Bidirectional WebSocket:
    1. Receives live webcam frames from browser navigator.mediaDevices.getUserMedia()
    2. Runs real YOLOv8 + ByteTrack + ViT on the received frame
    3. Responds with annotated bounding boxes, product predictions, and inventory updates.
    """
    await websocket.accept()
    logger.info("React Dashboard connected to /ws/live stream.")

    pipeline_service = shared_pipeline_service
    camera_service = CameraService(source=0)
    camera_service.start()

    async def receive_client_frames():
        while True:
            try:
                message = await websocket.receive_text()
                data = json.loads(message)
                
                # Handle client-sent browser webcam frame
                if data.get("type") == "frame" and data.get("image"):
                    raw_b64 = data["image"]
                    if "," in raw_b64:
                        raw_b64 = raw_b64.split(",", 1)[1]
                    
                    img_bytes = base64.b64decode(raw_b64)
                    np_arr = np.frombuffer(img_bytes, np.uint8)
                    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                    if frame is not None and frame.size > 0:
                        telemetry = pipeline_service.process_frame(frame)
                        await websocket.send_text(json.dumps(telemetry))

            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error processing client frame: {e}")
                await asyncio.sleep(0.05)

    try:
        # Listen for client frames (browser webcam)
        await receive_client_frames()
    except WebSocketDisconnect:
        logger.info("React Dashboard disconnected from /ws/live.")
    except Exception as e:
        logger.error(f"WebSocket session error: {e}")
    finally:
        camera_service.stop()
