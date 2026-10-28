import asyncio
import base64
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from backend.app.services.pipeline_instance import shared_pipeline_service
import logging
import json

logger = logging.getLogger("metaretail.camera_ws")
router = APIRouter()

from backend.app.services.camera_manager import shared_camera_manager as camera_manager


async def run_ai_inference_worker(camera_id: int, frame_queue: asyncio.Queue):
    """
    Dedicated background AI inference consumer.
    Runs YOLOv8 + ByteTrack + ViT + Universal Shelf Tracker in a separate worker thread
    via asyncio.to_thread so the FastAPI event loop is 100% unblocked.
    """
    while True:
        try:
            item = await frame_queue.get()
            if item is None:  # Sentinel to shutdown
                frame_queue.task_done()
                break

            frame_bytes = item

            def sync_inference(raw_bytes: bytes, cid: int):
                np_arr = np.frombuffer(raw_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if frame is None:
                    return None
                return shared_pipeline_service.process_frame(frame, camera_id=cid)

            # Offload heavy CPU inference to worker thread so event loop never starves
            result = await asyncio.to_thread(sync_inference, frame_bytes, camera_id)

            if result:
                if "detections" in result:
                    camera_manager.store_detections(camera_id, result["detections"])

                if "image_base64" in result:
                    raw_b64 = result["image_base64"].split(",", 1)[-1]
                    annotated_bytes = base64.b64decode(raw_b64)
                    camera_manager.store_annotated_frame(camera_id, annotated_bytes)

        except asyncio.CancelledError:
            break
        except Exception as pe:
            logger.error(f"Inference error for camera {camera_id}: {pe}")
        finally:
            try:
                frame_queue.task_done()
            except ValueError:
                pass


@router.websocket("/ws/camera/{camera_id}")
async def camera_stream_ws(websocket: WebSocket, camera_id: int, token: str = Query(None)):
    await websocket.accept()
    logger.info(f"WebSocket connection opened for camera {camera_id}")

    # Decouple ingest from inference: Queue(maxsize=1) with drop-stale policy
    frame_queue = asyncio.Queue(maxsize=1)
    worker_task = asyncio.create_task(run_ai_inference_worker(camera_id, frame_queue))

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect(message.get("code", 1000))

            frame_bytes = None

            if "bytes" in message and message["bytes"]:
                # Pure binary JPEG frame from client canvas.toBlob: ZERO deserialization (<0.02ms)
                frame_bytes = message["bytes"]
                camera_manager.receive_jpeg_bytes(camera_id, frame_bytes)

            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                except Exception:
                    continue

                msg_type = payload.get("type")
                # Responsive WebSocket ping-pong for cross-platform millisecond RTT telemetry
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "t": payload.get("t")}))
                    continue
                elif msg_type == "meta":
                    # Diagnostic telemetry update without frame overhead
                    camera_manager.update_telemetry(
                        camera_id,
                        width=payload.get("width"),
                        height=payload.get("height"),
                        quality=payload.get("quality"),
                        client_fps=payload.get("fps"),
                        lens=payload.get("lens"),
                        signal_bars=payload.get("signal_bars"),
                        signal_quality=payload.get("signal_quality"),
                        rtt_ms=payload.get("rtt_ms")
                    )
                    continue

                # Backward compatibility for legacy JSON frame payload
                frame_b64 = payload.get("frame")
                if frame_b64:
                    frame_bytes = base64.b64decode(frame_b64)
                    camera_manager.receive_jpeg_bytes(
                        camera_id,
                        frame_bytes,
                        width=payload.get("width"),
                        height=payload.get("height"),
                        quality=payload.get("quality"),
                        client_fps=payload.get("fps"),
                        lens=payload.get("lens") or payload.get("facing"),
                        signal_bars=payload.get("signal_bars"),
                        signal_quality=payload.get("signal_quality"),
                        rtt_ms=payload.get("rtt_ms")
                    )

            if frame_bytes:
                # Offer to AI worker queue with drop-stale policy (ensures AI is always analyzing the latest frame)
                if frame_queue.full():
                    try:
                        frame_queue.get_nowait()
                        frame_queue.task_done()
                    except (asyncio.QueueEmpty, ValueError):
                        pass

                try:
                    frame_queue.put_nowait(frame_bytes)
                except asyncio.QueueFull:
                    pass

    except WebSocketDisconnect:
        logger.info(f"WebSocket connection closed for camera {camera_id}")
    except Exception as e:
        logger.error(f"WebSocket error for camera {camera_id}: {e}")
    finally:
        # Stop background AI worker cleanly
        try:
            if not worker_task.done():
                worker_task.cancel()
                await asyncio.gather(worker_task, return_exceptions=True)
        except Exception:
            pass

        camera_manager.set_camera_offline(camera_id)
        try:
            await websocket.close()
        except Exception:
            pass
