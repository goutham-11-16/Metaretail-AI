"""
Pydantic Schemas for API Serialization
"""
from pydantic import BaseModel, model_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

class ProductBase(BaseModel):
    sku: Optional[str] = None
    name: str
    category: Optional[str] = "General"
    current_stock: Optional[int] = 0
    min_stock_threshold: Optional[int] = 2
    unit_price: Optional[float] = 0.0
    image_url: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None

class ProductImageCreate(BaseModel):
    product_id: int
    image_path: str
    angle: Optional[str] = "front"
    is_reference: Optional[bool] = True

class ProductImageSchema(ProductImageCreate):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProductCreate(ProductBase):
    price: Optional[float] = None
    stock: Optional[int] = None
    min_stock: Optional[int] = None
    zone_id: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_product_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # price -> unit_price
            if "unit_price" not in data or data.get("unit_price") is None:
                data["unit_price"] = float(data.get("price", 0.0) or 0.0)
            # stock -> current_stock
            if "current_stock" not in data or data.get("current_stock") is None:
                data["current_stock"] = int(data.get("stock", 0) or 0)
            # min_stock -> min_stock_threshold
            if "min_stock_threshold" not in data or data.get("min_stock_threshold") is None:
                data["min_stock_threshold"] = int(data.get("min_stock", 2) or 2)
            if not data.get("category"):
                data["category"] = "General"
            if not data.get("sku"):
                data["sku"] = f"SKU-{int(datetime.utcnow().timestamp())}"
        return data

class ProductUpdate(BaseModel):
    current_stock: Optional[int] = None
    min_stock_threshold: Optional[int] = None

class ProductOut(ProductBase):
    id: int
    image_url: Optional[str] = None
    images: List[ProductImageSchema] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CustomerOut(BaseModel):
    id: int
    track_id: int
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    dwell_time_seconds: Optional[float] = 0.0
    is_active: Optional[bool] = True

    class Config:
        from_attributes = True

class InteractionOut(BaseModel):
    id: int
    customer_id: int
    product_id: int
    interaction_type: str
    dwell_time_seconds: Optional[float] = 0.0
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True

class EventOut(BaseModel):
    id: int
    event_type: str
    description: str
    timestamp: Optional[datetime] = None
    metadata_json: Optional[str] = None

    class Config:
        from_attributes = True

class AlertOut(BaseModel):
    id: int
    alert_type: str
    product_id: Optional[int] = None
    severity: str
    message: str
    is_resolved: bool
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProductAbandonmentStatOut(BaseModel):
    product_name: str
    category: str
    pickups: int
    replaced_left: int
    purchases: int
    abandonment_rate_pct: float
    conversion_rate_pct: float
    owner_insight: str
    last_time: str

class AnalyticsOut(BaseModel):
    total_customers_today: int
    active_customers_now: int
    avg_dwell_time_seconds: float
    total_interactions: int
    most_interacted_product: str
    conversion_rate_pct: float
    total_pickups: Optional[int] = 0
    total_replaced_left: Optional[int] = 0
    total_purchases: Optional[int] = 0
    store_abandonment_rate_pct: Optional[float] = 0.0
    most_abandoned_product: Optional[str] = "None"
    product_stats: Optional[List[Dict[str, Any]]] = []
    recent_actions: Optional[List[Dict[str, Any]]] = []

class CameraStatusOut(BaseModel):
    is_active: bool
    source: str
    fps: float
    resolution: str

from pydantic import BaseModel, model_validator

class CameraCreate(BaseModel):
    name: str
    camera_type: Optional[str] = "LOCAL"
    type: Optional[str] = None
    connection_url: Optional[str] = None
    url: Optional[str] = None
    assigned_zone_id: Optional[int] = None
    zone_id: Optional[Any] = None
    resolution: Optional[str] = None
    fps: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            c_type = data.get("camera_type") or data.get("type") or "LOCAL"
            data["camera_type"] = str(c_type).upper()
            if not data.get("connection_url") and data.get("url"):
                data["connection_url"] = data["url"]
            zid = data.get("assigned_zone_id") or data.get("zone_id")
            if zid and zid != "unassigned":
                try:
                    data["assigned_zone_id"] = int(zid)
                except (ValueError, TypeError):
                    data["assigned_zone_id"] = None
            else:
                data["assigned_zone_id"] = None
        return data

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    assigned_zone_id: Optional[int] = None

class CameraSchema(CameraCreate):
    id: int
    status: str
    zone_name: Optional[str] = "Unassigned"
    resolution: Optional[str] = None
    fps: Optional[float] = None
    quality: Optional[float] = None
    quality_preset: Optional[str] = None
    lens: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    signal_bars: Optional[int] = 5
    signal_quality: Optional[str] = "Excellent"
    rtt_ms: Optional[float] = 0.0
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ZoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None

class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None

class ZoneSchema(ZoneCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class ZoneProductSchema(BaseModel):
    id: int
    zone_id: int
    product_id: int
    class Config:
        from_attributes = True

class InteractionDetailSchema(BaseModel):
    id: int
    interaction_id: int
    pickup_timestamp: datetime
    replace_timestamp: Optional[datetime] = None
    hold_duration_seconds: Optional[float] = None
    was_replaced: bool
    inferred_reason: Optional[str] = None
    zone_id: Optional[int] = None
    camera_id: Optional[int] = None
    class Config:
        from_attributes = True

class BarcodeLookupResponse(BaseModel):
    found: bool
    product: Optional[ProductOut] = None
