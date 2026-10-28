"""
Pydantic settings configuration for MetaRetail AI Backend
"""
import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "MetaRetail AI"
    API_V1_STR: str = "/api"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./metaretail.db"
    
    # Camera & Vision
    CAMERA_INDEX: int = 0
    DEFAULT_CONFIDENCE_THRESHOLD: float = 0.45
    YOLO_MODEL_PATH: str = "models/yolo/yolov8n.pt"
    VIT_MODEL_NAME: str = "google/vit-base-patch16-224"
    VIT_MODEL_PATH: str = "models/vit/vit_retail_finetuned.pth"
    
    # Inventory
    DEFAULT_LOW_STOCK_THRESHOLD: int = 2
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
