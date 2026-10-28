-- ==============================================================================
-- MetaRetail AI - Multi-SKU Demand Forecasting via TimesFM 2.0
-- Predicts future 14-day store sales across individual SKUs without model training
-- ==============================================================================

-- 1. Daily Aggregated SKU Demand View
CREATE OR REPLACE VIEW `PROJECT_ID.retail_enterprise_bi.daily_sku_sales` AS
SELECT
  DATE(inv.created_at) AS sale_date,
  JSON_VALUE(item, '$.sku') AS sku,
  JSON_VALUE(item, '$.product_name') AS product_name,
  SUM(CAST(JSON_VALUE(item, '$.quantity') AS INT64)) AS units_sold,
  SUM(CAST(JSON_VALUE(item, '$.line_total') AS FLOAT64)) AS daily_revenue
FROM
  `PROJECT_ID.retail_enterprise_bi.store_invoices` AS inv,
  UNNEST(JSON_QUERY_ARRAY(inv.items_json)) AS item
GROUP BY 1, 2, 3;

-- 2. TimesFM 2.0 Forecast Query (14-Day Horizon with 90% Prediction Intervals)
SELECT
  sku,
  time_series_timestamp AS forecast_date,
  ROUND(GREATEST(0.0, time_series_data), 1) AS predicted_units,
  ROUND(GREATEST(0.0, lower_bound), 1) AS min_units_expected,
  ROUND(upper_bound, 1) AS max_units_expected,
  ROUND((upper_bound - lower_bound), 1) AS uncertainty_spread
FROM
  AI.FORECAST(
    (
      SELECT
        sale_date,
        sku,
        units_sold
      FROM `PROJECT_ID.retail_enterprise_bi.daily_sku_sales`
      WHERE sale_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    ),
    data_col => 'units_sold',
    timestamp_col => 'sale_date',
    id_cols => ['sku'],
    horizon => 14,
    confidence_level => 0.90,
    model => 'TimesFM 2.0'
  )
ORDER BY sku, forecast_date;

-- 3. Restock Risk Alert (Comparing Projected Demand against Current On-Hand Stock)
WITH projected_14d_demand AS (
  SELECT
    sku,
    SUM(time_series_data) AS total_projected_demand
  FROM
    AI.FORECAST(
      (
        SELECT sale_date, sku, units_sold
        FROM `PROJECT_ID.retail_enterprise_bi.daily_sku_sales`
        WHERE sale_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      ),
      data_col => 'units_sold',
      timestamp_col => 'sale_date',
      id_cols => ['sku'],
      horizon => 14,
      model => 'TimesFM 2.0'
    )
  GROUP BY sku
)

SELECT
  p.sku,
  p.name AS product_name,
  p.category,
  p.current_stock AS on_hand_inventory,
  ROUND(f.total_projected_demand, 0) AS projected_14d_sales,
  (p.current_stock - f.total_projected_demand) AS projected_stock_balance,
  CASE
    WHEN p.current_stock < f.total_projected_demand * 0.5 THEN 'CRITICAL: Severe Stockout Risk'
    WHEN p.current_stock < f.total_projected_demand THEN 'WARNING: Restock Needed'
    ELSE 'HEALTHY: Adequate Stock'
  END AS inventory_status
FROM
  `PROJECT_ID.retail_enterprise_bi.store_products` AS p
JOIN
  projected_14d_demand AS f ON p.sku = f.sku
ORDER BY projected_stock_balance ASC;
