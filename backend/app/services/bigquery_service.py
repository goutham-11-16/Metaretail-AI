"""
BigQuery Enterprise Sync & Ingestion Service for MetaRetail AI
Serializes local SQLite edge data into BigQuery-compliant Newline-Delimited JSON (NDJSON)
and generates automated ingestion commands and schema DDLs.
"""
import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.app.models.domain import (
    Product, Customer, Interaction, InteractionDetail,
    Invoice, SecurityIncident
)

logger = logging.getLogger("metaretail.bigquery")

EXPORTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "exports", "bigquery"))
BIGQUERY_SQL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "bigquery"))


class BigQuerySyncService:
    def __init__(self, exports_dir: str = EXPORTS_DIR):
        self.exports_dir = exports_dir
        os.makedirs(self.exports_dir, exist_ok=True)

    def _format_timestamp(self, dt: Any) -> str:
        if isinstance(dt, datetime):
            return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
        if isinstance(dt, str) and dt:
            return dt
        return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    def export_all_tables(self, db: Session) -> Dict[str, Any]:
        """
        Exports all local retail tables to NDJSON format ready for BigQuery `bq load`.
        """
        results = {}

        # 1. Store Products
        products = db.query(Product).all()
        prod_rows = [
            {
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "category": p.category or "General",
                "current_stock": p.current_stock or 0,
                "min_stock_threshold": p.min_stock_threshold or 2,
                "unit_price": float(p.unit_price or 0.0),
                "barcode": p.barcode or "",
                "description": p.description or "",
                "created_at": self._format_timestamp(p.created_at)
            }
            for p in products
        ]
        prod_path = os.path.join(self.exports_dir, "store_products.ndjson")
        self._write_ndjson(prod_path, prod_rows)
        results["store_products"] = {"count": len(prod_rows), "file": prod_path}

        # 2. Customer Footfall
        customers = db.query(Customer).all()
        cust_rows = [
            {
                "customer_id": c.id,
                "track_id": c.track_id or c.id,
                "entry_time": self._format_timestamp(c.entry_time),
                "exit_time": self._format_timestamp(c.exit_time) if c.exit_time else None,
                "dwell_time_seconds": float(c.dwell_time or 0.0),
                "is_checked_out": c.exit_time is not None,
                "store_zone": f"Zone-{(c.track_id or c.id) % 5 + 1}"
            }
            for c in customers
        ]
        cust_path = os.path.join(self.exports_dir, "customer_footfall.ndjson")
        self._write_ndjson(cust_path, cust_rows)
        results["customer_footfall"] = {"count": len(cust_rows), "file": cust_path}

        # 3. Shelf Interactions
        interactions = db.query(Interaction).all()
        intr_rows = []
        for i in interactions:
            detail = db.query(InteractionDetail).filter(InteractionDetail.interaction_id == i.id).first()
            p = db.query(Product).filter(Product.id == i.product_id).first()
            intr_rows.append({
                "interaction_id": i.id,
                "customer_id": i.customer_id,
                "product_id": i.product_id,
                "product_name": p.name if p else "Retail Product",
                "action": i.action,
                "confidence": float(i.confidence or 0.9),
                "timestamp": self._format_timestamp(i.timestamp),
                "hold_duration_seconds": float(detail.hold_duration_seconds) if detail and detail.hold_duration_seconds else 2.5,
                "was_replaced": bool(detail.was_replaced) if detail else False,
                "inferred_reason": detail.inferred_reason if detail else None,
                "zone_id": detail.zone_id if detail else 2,
                "camera_id": detail.camera_id if detail else 8888
            })
        intr_path = os.path.join(self.exports_dir, "shelf_interactions.ndjson")
        self._write_ndjson(intr_path, intr_rows)
        results["shelf_interactions"] = {"count": len(intr_rows), "file": intr_path}

        # 4. Store Invoices
        invoices = db.query(Invoice).all()
        inv_rows = [
            {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_track_id": inv.customer_track_id,
                "subtotal": float(inv.subtotal or 0.0),
                "tax_amount": float(inv.tax_amount or 0.0),
                "total_amount": float(inv.total_amount or 0.0),
                "payment_status": inv.payment_status or "PAID",
                "payment_method": inv.payment_method or "AUTONOMOUS_JUST_WALK_OUT",
                "items_json": inv.items_json or "[]",
                "created_at": self._format_timestamp(inv.created_at)
            }
            for inv in invoices
        ]
        inv_path = os.path.join(self.exports_dir, "store_invoices.ndjson")
        self._write_ndjson(inv_path, inv_rows)
        results["store_invoices"] = {"count": len(inv_rows), "file": inv_path}

        # 5. Security Incidents
        incidents = db.query(SecurityIncident).all()
        inc_rows = [
            {
                "incident_id": inc.id,
                "incident_type": inc.incident_type,
                "risk_score": float(inc.risk_score or 0.85),
                "customer_track_id": inc.customer_track_id,
                "camera_id": inc.camera_id,
                "zone_id": inc.zone_id,
                "description": inc.description,
                "recommended_action": inc.recommended_action,
                "status": inc.status or "OPEN",
                "created_at": self._format_timestamp(inc.created_at),
                "resolved_at": self._format_timestamp(inc.resolved_at) if inc.resolved_at else None
            }
            for inc in incidents
        ]
        inc_path = os.path.join(self.exports_dir, "security_incidents.ndjson")
        self._write_ndjson(inc_path, inc_rows)
        results["security_incidents"] = {"count": len(inc_rows), "file": inc_path}

        # 6. Generate Ingestion Shell Script
        load_script_path = os.path.join(self.exports_dir, "load_to_bigquery.sh")
        self._generate_load_script(load_script_path)
        results["load_script"] = load_script_path

        logger.info(f"BigQuery NDJSON export completed across {len(results)} entities.")
        return results

    def _write_ndjson(self, filepath: str, records: List[Dict[str, Any]]):
        with open(filepath, "w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def _generate_load_script(self, script_path: str):
        content = """#!/usr/bin/env bash
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
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \\
  "${PROJECT_ID}:${DATASET}.store_products" ./store_products.ndjson

# 3. Ingest Customer Footfall
echo "Loading customer_footfall..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \\
  --time_partitioning_field=entry_time \\
  "${PROJECT_ID}:${DATASET}.customer_footfall" ./customer_footfall.ndjson

# 4. Ingest Shelf Interactions
echo "Loading shelf_interactions..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \\
  --time_partitioning_field=timestamp \\
  "${PROJECT_ID}:${DATASET}.shelf_interactions" ./shelf_interactions.ndjson

# 5. Ingest Store Invoices
echo "Loading store_invoices..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \\
  --time_partitioning_field=created_at \\
  "${PROJECT_ID}:${DATASET}.store_invoices" ./store_invoices.ndjson

# 6. Ingest Security Incidents
echo "Loading security_incidents..."
bq load --autodetect --replace --source_format=NEWLINE_DELIMITED_JSON \\
  --time_partitioning_field=created_at \\
  "${PROJECT_ID}:${DATASET}.security_incidents" ./security_incidents.ndjson

echo "=== BigQuery Ingestion Completed Successfully! ==="
"""
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(content)
        os.chmod(script_path, 0o755)

    def get_bundled_sql_scripts(self) -> List[Dict[str, str]]:
        """
        Returns list of all available BigQuery AI/ML SQL scripts with their contents.
        """
        scripts = []
        if os.path.exists(BIGQUERY_SQL_DIR):
            for filename in sorted(os.listdir(BIGQUERY_SQL_DIR)):
                if filename.endswith(".sql"):
                    filepath = os.path.join(BIGQUERY_SQL_DIR, filename)
                    with open(filepath, "r", encoding="utf-8") as f:
                        scripts.append({
                            "filename": filename,
                            "filepath": filepath,
                            "content": f.read()
                        })
        return scripts


shared_bigquery_service = BigQuerySyncService()
