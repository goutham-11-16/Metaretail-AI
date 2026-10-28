"""
Shared Global Pipeline Service Instance for MetaRetail AI Backend
Ensures state synchronization across REST API endpoints and WebSocket live stream.
"""
from backend.app.services.pipeline_service import VisionPipelineService

# Global shared pipeline instance
shared_pipeline_service = VisionPipelineService()
