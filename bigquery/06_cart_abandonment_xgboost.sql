-- ==============================================================================
-- MetaRetail AI - Shopper Abandonment Predictor via Native BQML XGBoost
-- Predicts whether an active customer will walk out without purchasing
-- ==============================================================================

-- 1. Training Feature Dataset View
CREATE OR REPLACE VIEW `PROJECT_ID.retail_enterprise_bi.shopper_behavior_features` AS
WITH session_aggregates AS (
  SELECT
    c.track_id,
    c.dwell_time_seconds,
    COUNT(i.interaction_id) AS total_shelf_interactions,
    COUNTIF(i.action = 'PICKUP') AS pickups_count,
    COUNTIF(i.was_replaced = TRUE) AS replaced_count,
    AVG(COALESCE(i.hold_duration_seconds, 2.0)) AS avg_hold_seconds,
    -- Label: Did this customer checkout an invoice? (0 = purchased, 1 = abandoned)
    IF(inv.invoice_id IS NULL, 1, 0) AS has_abandoned
  FROM
    `PROJECT_ID.retail_enterprise_bi.customer_footfall` AS c
  LEFT JOIN
    `PROJECT_ID.retail_enterprise_bi.shelf_interactions` AS i
    ON c.customer_id = i.customer_id
  LEFT JOIN
    `PROJECT_ID.retail_enterprise_bi.store_invoices` AS inv
    ON c.track_id = inv.customer_track_id
  WHERE
    c.exit_time IS NOT NULL -- Completed sessions only for training
  GROUP BY
    c.track_id, c.dwell_time_seconds, inv.invoice_id
)
SELECT
  dwell_time_seconds,
  total_shelf_interactions,
  pickups_count,
  replaced_count,
  avg_hold_seconds,
  has_abandoned
FROM
  session_aggregates;

-- 2. Train Gradient-Boosted Trees Classifier (Automatic Train/Test Split)
CREATE OR REPLACE MODEL `PROJECT_ID.retail_enterprise_bi.cart_abandonment_model`
OPTIONS (
  MODEL_TYPE = 'BOOSTED_TREE_CLASSIFIER',
  INPUT_LABEL_COLS = ['has_abandoned'],
  AUTO_SPLIT = TRUE,
  EARLY_STOP = TRUE,
  DATA_SPLIT_EVAL_FRACTION = 0.2
) AS
SELECT * FROM `PROJECT_ID.retail_enterprise_bi.shopper_behavior_features`;

-- 3. Model Performance Evaluation
SELECT
  roc_auc,
  accuracy,
  precision,
  recall,
  f1_score,
  log_loss
FROM
  ML.EVALUATE(MODEL `PROJECT_ID.retail_enterprise_bi.cart_abandonment_model`);

-- 4. Real-Time Inference on Active Shoppers
SELECT
  customer_track_id,
  predicted_has_abandoned,
  probs.prob AS abandonment_risk_score,
  CASE
    WHEN probs.prob > 0.75 THEN 'HIGH: Prompt Mobile Offer or Assistance'
    WHEN probs.prob > 0.45 THEN 'MODERATE: Monitor Aisle Camera'
    ELSE 'LOW: Organic Checkout Expected'
  END AS recommended_action
FROM
  ML.PREDICT(
    MODEL `PROJECT_ID.retail_enterprise_bi.cart_abandonment_model`,
    (
      SELECT
        c.track_id AS customer_track_id,
        c.dwell_time_seconds,
        COUNT(i.interaction_id) AS total_shelf_interactions,
        COUNTIF(i.action = 'PICKUP') AS pickups_count,
        COUNTIF(i.was_replaced = TRUE) AS replaced_count,
        AVG(COALESCE(i.hold_duration_seconds, 2.0)) AS avg_hold_seconds
      FROM
        `PROJECT_ID.retail_enterprise_bi.customer_footfall` AS c
      LEFT JOIN
        `PROJECT_ID.retail_enterprise_bi.shelf_interactions` AS i
        ON c.customer_id = i.customer_id
      WHERE
        c.exit_time IS NULL -- Active shoppers currently in store
      GROUP BY
        c.track_id, c.dwell_time_seconds
    )
  ),
  UNNEST(predicted_has_abandoned_probs) AS probs
WHERE
  probs.label = 1
ORDER BY
  abandonment_risk_score DESC;
