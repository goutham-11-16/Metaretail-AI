"""
SQLAlchemy Domain Models (Product, Customer, Interaction, Event, Alert)
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.database.base import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, default="General")
    current_stock = Column(Integer, default=0)
    min_stock_threshold = Column(Integer, default=2)
    unit_price = Column(Float, default=0.0)
    image_url = Column(String, nullable=True)
    barcode = Column(String, nullable=True, unique=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    interactions = relationship("Interaction", back_populates="product")
    alerts = relationship("Alert", back_populates="product")
    images = relationship("ProductImage", backref="product", cascade="all, delete-orphan")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, index=True)
    entry_time = Column(DateTime, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    dwell_time = Column(Float, default=0.0)

    interactions = relationship("Interaction", back_populates="customer")


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    action = Column(String, nullable=False)  # APPROACH, PICKUP, REMOVE, RETURN
    confidence = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="interactions")
    product = relationship("Product", back_populates="interactions")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    metadata_json = Column(Text, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, default="LOW_STOCK")
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    severity = Column(String, default="WARNING")  # INFO, WARNING, CRITICAL
    message = Column(String, nullable=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    product = relationship("Product", back_populates="alerts")


class ProductImage(Base):
    __tablename__ = 'product_images'
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    image_path = Column(String, nullable=False)
    angle = Column(String, default='front')  # front, back, left, right, top
    is_reference = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Camera(Base):
    __tablename__ = 'cameras'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    camera_type = Column(String, nullable=False)  # LOCAL, PHONE, NETWORK
    connection_url = Column(String, nullable=True)
    status = Column(String, default='OFFLINE')  # ONLINE, OFFLINE
    assigned_zone_id = Column(Integer, ForeignKey('zones.id'), nullable=True)
    resolution = Column(String, nullable=True)
    fps = Column(Integer, nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Zone(Base):
    __tablename__ = 'zones'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    location = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ZoneProduct(Base):
    __tablename__ = 'zone_products'
    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(Integer, ForeignKey('zones.id'), nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)


class InteractionDetail(Base):
    __tablename__ = 'interaction_details'
    id = Column(Integer, primary_key=True, autoincrement=True)
    interaction_id = Column(Integer, ForeignKey('interactions.id'), nullable=False)
    pickup_timestamp = Column(DateTime, nullable=False)
    replace_timestamp = Column(DateTime, nullable=True)
    hold_duration_seconds = Column(Float, nullable=True)
    was_replaced = Column(Boolean, default=False)
    inferred_reason = Column(String, nullable=True)
    zone_id = Column(Integer, ForeignKey('zones.id'), nullable=True)
    camera_id = Column(Integer, ForeignKey('cameras.id'), nullable=True)


class CartItem(Base):
    __tablename__ = 'cart_items'
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_track_id = Column(Integer, index=True, nullable=False)
    product_id = Column(Integer, ForeignKey('products.id'), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    status = Column(String, default="IN_CART")  # IN_CART, CHECKED_OUT, REMOVED
    added_at = Column(DateTime, default=datetime.utcnow)
    checked_out_at = Column(DateTime, nullable=True)

    product = relationship("Product")


class Invoice(Base):
    __tablename__ = 'invoices'
    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    customer_track_id = Column(Integer, index=True, nullable=False)
    subtotal = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)  # 18% GST (9% CGST + 9% SGST)
    total_amount = Column(Float, default=0.0)
    payment_status = Column(String, default="PAID")  # PAID, PENDING
    payment_method = Column(String, default="AUTONOMOUS_JUST_WALK_OUT")
    items_json = Column(Text, nullable=False)  # Itemized breakdown snapshot
    created_at = Column(DateTime, default=datetime.utcnow)


class SecurityIncident(Base):
    __tablename__ = 'security_incidents'
    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_type = Column(String, nullable=False)  # CONCEALMENT, UNPAID_EXIT, BULK_SWEEP, SUSPICIOUS_DWELL
    risk_score = Column(Float, default=0.85)  # 0.0 to 1.0
    customer_track_id = Column(Integer, nullable=True)
    camera_id = Column(Integer, ForeignKey('cameras.id'), nullable=True)
    zone_id = Column(Integer, ForeignKey('zones.id'), nullable=True)
    description = Column(Text, nullable=False)
    recommended_action = Column(String, default="Security Staff Verification")
    status = Column(String, default="OPEN")  # OPEN, RESOLVED, DISMISSED
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

