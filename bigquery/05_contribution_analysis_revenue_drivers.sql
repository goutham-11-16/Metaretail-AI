-- ==============================================================================
-- MetaRetail AI - Revenue Key Driver Analysis via Contribution Analysis
-- Isolates which store factors drove recent shifts in gross revenue
-- ==============================================================================

-- 1. Create the Key Driver Contribution Analysis Model
CREATE OR REPLACE MODEL `PROJECT_ID.retail_enterprise_bi.revenue_driver_model`
OPTIONS (
  MODEL_TYPE = 'CONTRIBUTION_ANALYSIS',
  CONTRIBUTION_METRIC = 'SUM(total_amount)',
  IS_TEST_COL = 'is_current_cohort',
  DIMENSION_ID_COLS = ['payment_method', 'basket_size_bracket', 'primary_category'],
  MIN_APRIORI_SUPPORT = 0.05
) AS
SELECT
  inv.total_amount,
  inv.payment_method,
  CASE
    WHEN ARRAY_LENGTH(JSON_EXTRACT_ARRAY(inv.items_json)) <= 2 THEN 'Small (1-2 items)'
    WHEN ARRAY_LENGTH(JSON_EXTRACT_ARRAY(inv.items_json)) <= 4 THEN 'Medium (3-4 items)'
    ELSE 'Large (5+ items)'
  END AS basket_size_bracket,
  -- Primary item category
  COALESCE(JSON_VALUE(JSON_EXTRACT_ARRAY(inv.items_json)[OFFSET(0)], '$.category'), 'General') AS primary_category,
  -- Test cohort (last 14 days) vs Control cohort (prior period)
  (inv.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)) AS is_current_cohort
FROM
  `PROJECT_ID.retail_enterprise_bi.store_invoices` AS inv
WHERE
  inv.payment_status = 'PAID';

-- 2. Inspect Insights & Key Drivers
SELECT
  contributors,
  ROUND(metric_test, 2) AS current_cohort_revenue,
  ROUND(metric_control, 2) AS prior_cohort_revenue,
  ROUND(difference, 2) AS revenue_variance,
  ROUND(relative_difference * 100, 1) AS percentage_change
FROM
  ML.GET_INSIGHTS(MODEL `PROJECT_ID.retail_enterprise_bi.revenue_driver_model`)
ORDER BY
  ABS(difference) DESC
LIMIT 15;
