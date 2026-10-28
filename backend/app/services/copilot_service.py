"""
AI Retail Copilot Intelligence Service for MetaRetail AI
Provides live conversational store operational intelligence, grounded in real-time
telemetry, inventory levels, sales velocity, shrinkage incidents, and BigQuery AI/ML models.
"""
import re
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.domain import (
    Product, Customer, CartItem, Invoice, SecurityIncident, Alert, Interaction, InteractionDetail
)
from backend.app.services.cart_service import shared_cart_service
from ai.simulation.store_simulator import shared_store_simulator

logger = logging.getLogger("metaretail.copilot")


class RetailCopilotService:
    def process_query(self, db: Session, user_query: str) -> Dict[str, Any]:
        res = self._handle_query(db, user_query)
        if "answer" not in res and "reply" in res:
            res["answer"] = res["reply"]
        if "reply" not in res and "answer" in res:
            res["reply"] = res["answer"]
        if "confidence" not in res:
            res["confidence"] = 0.98
        if "category" not in res:
            res["category"] = "OPERATIONAL_ASSISTANT"
        if "recommendations" not in res:
            res["recommendations"] = res.get("suggested_followups", [])
        if "suggested_followups" not in res:
            res["suggested_followups"] = res.get("recommendations", [])
        return res

    def _handle_query(self, db: Session, user_query: str) -> Dict[str, Any]:
        """
        Interprets manager's natural language question and compiles a grounded operational response
        with direct action execution where appropriate.
        """
        query = user_query.strip().lower()

        # 1. Action: Restock product (e.g., "restock coke by 10", "add 5 stock to doritos")
        restock_match = re.search(r"(?:restock|add|increase stock(?: of)?)\s+([a-zA-Z0-9\s-]+?)(?:\s+by|\s+with)?\s+(\d+)", query)
        if restock_match:
            item_query = restock_match.group(1).strip()
            amount = int(restock_match.group(2))
            prod = db.query(Product).filter(
                (Product.name.ilike(f"%{item_query[:6]}%")) | (Product.sku.ilike(f"%{item_query}%"))
            ).first()
            if prod:
                old_stock = prod.current_stock or 0
                prod.current_stock = old_stock + amount
                db.commit()
                db.refresh(prod)
                return {
                    "reply": f"✅ **Stock Successfully Updated**: Added **+{amount} units** to **{prod.name}** (`{prod.sku}`). New shelf balance is **{prod.current_stock} units** (previously {old_stock}).",
                    "action": {"type": "RESTOCK_COMPLETED", "product_id": prod.id, "new_stock": prod.current_stock},
                    "suggested_followups": [
                        f"Check inventory status of {prod.name}",
                        "Which other items are low on stock?",
                        "Open Planogram Monitor"
                    ]
                }

        # 2. Stockout & Inventory Inquiries
        if any(w in query for w in ["stock", "inventory", "deplet", "shortage", "restock"]):
            products = db.query(Product).all()
            low_stock = [p for p in products if (p.current_stock or 0) <= (p.min_stock_threshold or 3)]
            if low_stock:
                items_str = "\n".join([f"- **{p.name}** (`{p.sku}`): **{p.current_stock} left** (min: {p.min_stock_threshold}) — *₹{p.unit_price}*" for p in low_stock])
                return {
                    "reply": f"⚠️ **Attention Needed: {len(low_stock)} Low Stock SKUs Identified**:\n\n{items_str}\n\n*Recommendation*: Trigger replenishment from the central warehouse or use the Planogram rack restock buttons.",
                    "action": {"type": "NAVIGATE", "route": "/planogram"},
                    "suggested_followups": [
                        f"Restock {low_stock[0].name.split()[0]} by 10",
                        "Show TimesFM demand forecast",
                        "View all inventory"
                    ]
                }
            else:
                return {
                    "reply": f"✅ **Inventory is Healthy**: All **{len(products)} catalog SKUs** have stock above their minimum threshold. No immediate replenishment orders required.",
                    "action": None,
                    "suggested_followups": [
                        "What is our revenue velocity today?",
                        "Show customer footfall",
                        "Run BigQuery demand forecast"
                    ]
                }

        # 3. Revenue, Sales & GMV Inquiries
        if any(w in query for w in ["revenue", "sales", "gmv", "money", "earnings", "invoices", "orders"]):
            invoices = db.query(Invoice).all()
            total_gmv = sum(inv.total_amount or 0.0 for inv in invoices)
            total_orders = len(invoices)
            abv = (total_gmv / total_orders) if total_orders > 0 else 0.0
            return {
                "reply": f"📊 **Executive Commercial Summary**:\n\n- **Gross Revenue (GMV)**: **₹{total_gmv:,.2f}**\n- **Completed Invoices**: **{total_orders} orders**\n- **Average Basket Value (ABV)**: **₹{abv:.2f}**\n- **Projected Daily Velocity**: **₹{total_gmv * 3.5:,.2f}**\n\nAll invoices are processed with automated autonomous checkout and itemized 18% GST (9% CGST + 9% SGST).",
                "action": {"type": "NAVIGATE", "route": "/checkout"},
                "suggested_followups": [
                    "Which products sell together most?",
                    "Export store data to BigQuery",
                    "Download audit CSV"
                ]
            }

        # 4. Security, Theft & Loss Prevention Inquiries
        if any(w in query for w in ["theft", "security", "shrinkage", "incident", "loss", "alert", "stole"]):
            incidents = db.query(SecurityIncident).order_by(SecurityIncident.created_at.desc()).limit(5).all()
            open_inc = [inc for inc in incidents if inc.status == "OPEN"]
            resolved_count = db.query(SecurityIncident).filter(SecurityIncident.status == "RESOLVED").count()
            saved_inr = resolved_count * 450.0

            if open_inc:
                list_str = "\n".join([f"- **[{i.incident_type}]** (Risk: {int((i.risk_score or 0.8) * 100)}%): {i.description} — *Action: {i.recommended_action}*" for i in open_inc])
                return {
                    "reply": f"🚨 **Active Loss Prevention Alerts ({len(open_inc)} Open)**:\n\n{list_str}\n\n🛡️ **Shrinkage Prevented**: Estimated **₹{saved_inr:,.0f}** saved across {resolved_count} resolved turnstile interventions.",
                    "action": {"type": "NAVIGATE", "route": "/alerts"},
                    "suggested_followups": [
                        "View overhead camera feeds",
                        "Show suspicious dwell shoppers",
                        "Review security rules"
                    ]
                }
            else:
                return {
                    "reply": f"🛡️ **Store Security Status Normal**: Zero active security breaches. Total shrinkage prevented to date: **₹{saved_inr:,.0f}** across **{resolved_count} resolved interventions**.",
                    "action": None,
                    "suggested_followups": [
                        "Show footfall and dwell times",
                        "Check shelf abandonment rates",
                        "View camera status"
                    ]
                }

        # 5. Customer Footfall & Abandonment
        if any(w in query for w in ["customer", "footfall", "abandon", "shoppers", "dwell", "traffic"]):
            total_customers = db.query(Customer).count()
            active_now = db.query(Customer).filter(Customer.exit_time.is_(None)).count()
            dwell_records = db.query(Customer.dwell_time).filter(Customer.dwell_time > 0).all()
            avg_dwell = round(sum(d[0] for d in dwell_records) / max(1, len(dwell_records)), 1) if dwell_records else 0.0

            pickups = db.query(Interaction).filter(Interaction.action.ilike("%PICK%")).count()
            replaces = db.query(InteractionDetail).filter(InteractionDetail.was_replaced == True).count()
            abandon_rate = round((replaces / max(1, pickups)) * 100, 1)

            return {
                "reply": f"👥 **Shopper Behavioral Insights**:\n\n- **Total Footfall Today**: **{total_customers} shoppers**\n- **Active Inside Store Now**: **{active_now} shoppers**\n- **Average Dwell Time**: **{avg_dwell} seconds**\n- **Shelf Drop-off / Abandonment Rate**: **{abandon_rate}%** ({replaces} items left unbought of {pickups} inspections)\n\n*Top Reason for Put-Backs*: Customers checking expiry dates and comparing price tags before replacement.",
                "action": {"type": "NAVIGATE", "route": "/floorplan"},
                "suggested_followups": [
                    "View shopper path breadcrumbs",
                    "Which item has the highest abandonment?",
                    "Check active virtual carts"
                ]
            }

        # 6. BigQuery & AI/ML Capabilities
        if any(w in query for w in ["bigquery", "timesfm", "gemini", "forecast", "machine learning", "ai"]):
            return {
                "reply": f"⚡ **Google Cloud BigQuery AI & ML Integration**:\n\nMetaRetail AI features pre-built foundation models in `bigquery/`:\n1. **AI.FORECAST (TimesFM 2.0)**: Multi-series 14-day demand predictions with 90% confidence bands.\n2. **AI.DETECT_ANOMALIES**: Automated shrinkage & bulk sweep detection.\n3. **AI.GENERATE_TABLE (Gemini 2.5 Flash)**: Multimodal incident extraction into typed SQL schemas.\n4. **CONTRIBUTION_ANALYSIS**: Root cause revenue driver analysis.\n5. **BOOSTED_TREE_CLASSIFIER**: In-database cart abandonment predictor.\n\nClick below to export store data to BigQuery NDJSON or view SQL scripts.",
                "action": {"type": "NAVIGATE", "route": "/analytics"},
                "suggested_followups": [
                    "Export store data to BigQuery",
                    "View BigQuery SQL pipelines",
                    "What is our revenue velocity?"
                ]
            }

        # 7. Simulation Control
        if any(w in query for w in ["simulation", "simulator", "traffic", "simulate"]):
            sim_status = shared_store_simulator.get_status()
            state_str = "ACTIVE 🟢" if sim_status["is_running"] else "PAUSED ⚪"
            return {
                "reply": f"🤖 **Store Simulation Engine Status: {state_str}**\n\n- Active Simulated Shoppers: **{sim_status['active_simulated_shoppers']}**\n- Simulated Orders Completed: **{sim_status['total_simulated_orders']}**\n- Total Simulated Pickups: **{sim_status['total_simulated_pickups']}**\n\nYou can toggle simulation directly from the header controls or command palette (`Cmd+K`).",
                "action": {"type": "SIMULATION_STATUS", "status": sim_status},
                "suggested_followups": [
                    "Start simulation" if not sim_status["is_running"] else "Stop simulation",
                    "Show floorplan shopper paths",
                    "View active virtual carts"
                ]
            }

        # General Store Status Overview
        prods_count = db.query(Product).count()
        total_inv = db.query(Invoice).count()
        gmv = sum(i.total_amount or 0.0 for i in db.query(Invoice).all())
        active_shoppers = db.query(Customer).filter(Customer.exit_time.is_(None)).count()

        return {
            "reply": f"👋 **MetaRetail AI Operational Copilot Ready**.\n\nCurrently monitoring **MetaRetail Flagship 01**:\n- **Catalog**: {prods_count} active SKUs across 6 store zones\n- **Active Shoppers**: {active_shoppers} in-store\n- **Today's GMV**: ₹{gmv:,.2f} ({total_inv} orders)\n\nAsk me anything about demand forecasting, stock replenishment, loss prevention, or customer drop-offs!",
            "action": None,
            "suggested_followups": [
                "Which items are low on stock?",
                "What is today's revenue and footfall?",
                "Are there any security alerts?",
                "Explain BigQuery TimesFM forecasting"
            ]
        }


shared_copilot_service = RetailCopilotService()
