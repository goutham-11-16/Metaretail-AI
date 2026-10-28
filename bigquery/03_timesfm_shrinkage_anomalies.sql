-- ==============================================================================
-- MetaRetail AI - Store Anomaly & Loss Prevention Detection via TimesFM 2.0
-- Flags abnormal shrinkage, sudden theft surges, and traffic drops
-- ==============================================================================

WITH historical_baseline AS (
  -- 60-day baseline interaction and dwell patterns per aisle zone
  SELECT
    DATE(timestamp) AS event_date,
    CAST(zone_id AS STRING) AS zone_id,
    COUNT(interaction_id) AS total_pickups,
    COUNTIF(was_replaced = TRUE) AS total_replaces
  FROM `PROJECT_ID.retail_enterprise_bi.shelf_interactions`
  WHERE timestamp BETWEEN TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
                      AND TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  GROUP BY 1, 2
),

current_week_target AS (
  -- Recent 7-day target evaluation window
  SELECT
    DATE(timestamp) AS event_date,
    CAST(zone_id AS STRING) AS zone_id,
    COUNT(interaction_id) AS total_pickups,
    COUNTIF(was_replaced = TRUE) AS total_replaces
  FROM `PROJECT_ID.retail_enterprise_bi.shelf_interactions`
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  GROUP BY 1, 2
)

-- Detect abnormal drops in item returns (indicating unrecorded item concealment)
SELECT
  zone_id,
  time_series_timestamp AS evaluation_date,
  time_series_data AS actual_pickups,
  lower_bound,
  upper_bound,
  is_anomaly,
  ROUND(anomaly_probability, 3) AS anomaly_probability,
  CASE
    WHEN is_anomaly AND time_series_data > upper_bound THEN 'Spike: Unusual Bulk Sweep or Rush'
    WHEN is_anomaly AND time_series_data < lower_bound THEN 'Drop: Potential Shelf Stockout or Occlusion'
    ELSE 'Normal Operation'
  END AS anomaly_diagnosis
FROM
  AI.DETECT_ANOMALIES(
    (SELECT event_date, zone_id, total_pickups FROM historical_baseline),
    (SELECT event_date, zone_id, total_pickups FROM current_week_target),
    data_col => 'total_pickups',
    timestamp_col => 'event_date',
    id_cols => ['zone_id'],
    anomaly_prob_threshold => 0.92,
    model => 'TimesFM 2.0'
  )
ORDER BY anomaly_probability DESC, evaluation_date DESC;
