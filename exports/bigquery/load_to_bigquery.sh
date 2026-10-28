#!/usr/bin/env bash
# ==============================================================================
# MetaRetail AI - Automated BigQuery Ingestion Script
# Usage: ./load_to_bigquery.sh [YOUR_GCP_PROJECT_ID]
# ==============================================================================
set -e

PROJECT_ID="${1:-YOUR_PROJECT_ID}"
DATASET="retail_enterprise_bi"

echo "=== Ingesting MetaRetail AI Data into BigQuery: ${PROJECT_ID}.${DATASET} ==="

# 1. Create dataset if not exists
bq --location=US mk -d --description "MetaRetail AI Store Data" "${PROJECT_ID}:${DATASET}" || true

# 2. Ingest Store Products
echo "Loading store_products..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \
  "${PROJECT_ID}:${DATASET}.store_products" ./store_products.ndjson

# 3. Ingest Customer Footfall
echo "Loading customer_footfall..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \
  --time_partitioning_field=entry_time \
  "${PROJECT_ID}:${DATASET}.customer_footfall" ./customer_footfall.ndjson

# 4. Ingest Shelf Interactions
echo "Loading shelf_interactions..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \
  --time_partitioning_field=timestamp \
  "${PROJECT_ID}:${DATASET}.shelf_interactions" ./shelf_interactions.ndjson

# 5. Ingest Store Invoices
echo "Loading store_invoices..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \
  --time_partitioning_field=created_at \
  "${PROJECT_ID}:${DATASET}.store_invoices" ./store_invoices.ndjson

# 6. Ingest Security Incidents
echo "Loading security_incidents..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \
  --time_partitioning_field=created_at \
  "${PROJECT_ID}:${DATASET}.security_incidents" ./security_incidents.ndjson

echo "=== BigQuery Ingestion Completed Successfully! ==="
