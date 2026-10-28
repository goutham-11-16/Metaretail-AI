-- ==============================================================================
-- MetaRetail AI - Enterprise BigQuery Data Warehouse DDL
-- Dataset: retail_enterprise_bi
-- ==============================================================================

-- 1. Create Enterprise Dataset
CREATE SCHEMA IF NOT EXISTS `PROJECT_ID.retail_enterprise_bi`
OPTIONS(
  location = 'US',
  description = 'MetaRetail AI Autonomous Store Enterprise Analytics & AI/ML Warehouse'
);

-- 2. Store Products Dimension Table
CREATE TABLE IF NOT EXISTS `PROJECT_ID.retail_enterprise_bi.store_products` (
  id INT64 NOT NULL,
  sku STRING NOT NULL,
  name STRING NOT NULL,
  category STRING,
  current_stock INT64,
  min_stock_threshold INT64,
  unit_price FLOAT64,
  barcode STRING,
  description STRING,
  created_at TIMESTAMP
)
CLUSTER BY category, sku;

-- 3. Customer Footfall & Dwell Fact Table
CREATE TABLE IF NOT EXISTS `PROJECT_ID.retail_enterprise_bi.customer_footfall` (
  customer_id INT64 NOT NULL,
  track_id INT64,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,
  dwell_time_seconds FLOAT64,
  is_checked_out BOOL,
  store_zone STRING
)
PARTITION BY DATE(entry_time)
CLUSTER BY store_zone, track_id;

-- 4. Shelf Interactions & Computer Vision Events
CREATE TABLE IF NOT EXISTS `PROJECT_ID.retail_enterprise_bi.shelf_interactions` (
  interaction_id INT64 NOT NULL,
  customer_id INT64,
  product_id INT64,
  product_name STRING,
  action STRING NOT NULL, -- APPROACH, PICKUP, REMOVE, RETURN
  confidence FLOAT64,
  timestamp TIMESTAMP NOT NULL,
  hold_duration_seconds FLOAT64,
  was_replaced BOOL,
  inferred_reason STRING, -- High Price, Checking Expiry Date, etc.
  zone_id INT64,
  camera_id INT64
)
PARTITION BY DATE(timestamp)
CLUSTER BY product_name, action;

-- 5. Autonomous Invoices & Point of Sale (POS)
CREATE TABLE IF NOT EXISTS `PROJECT_ID.retail_enterprise_bi.store_invoices` (
  invoice_id INT64 NOT NULL,
  invoice_number STRING NOT NULL,
  customer_track_id INT64 NOT NULL,
  subtotal FLOAT64,
  tax_amount FLOAT64, -- 18% GST (9% CGST + 9% SGST)
  total_amount FLOAT64,
  payment_status STRING,
  payment_method STRING,
  items_json STRING,
  created_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY customer_track_id, payment_status;

-- 6. Loss Prevention & Security Incidents
CREATE TABLE IF NOT EXISTS `PROJECT_ID.retail_enterprise_bi.security_incidents` (
  incident_id INT64 NOT NULL,
  incident_type STRING NOT NULL, -- CONCEALMENT, UNPAID_EXIT, BULK_SWEEP, SUSPICIOUS_DWELL
  risk_score FLOAT64,
  customer_track_id INT64,
  camera_id INT64,
  zone_id INT64,
  description STRING NOT NULL,
  recommended_action STRING,
  status STRING, -- OPEN, RESOLVED, DISMISSED
  created_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP
)
PARTITION BY DATE(created_at)
CLUSTER BY incident_type, status;
