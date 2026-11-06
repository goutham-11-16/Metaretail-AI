"""
Warehouse Owner Intelligence & Product Abandonment Engine
Tracks which products customers pick up, inspect, and replace (leave on shelf without buying)
vs which products customers actually purchase, providing actionable store-owner insights.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import time
from datetime import datetime

@dataclass
class ProductAbandonmentStat:
    product_name: str
    category: str
    pickups: int = 0
    replaced_left: int = 0      # Picked up & put back / left without buying
    purchases: int = 0          # Taken / bought
    last_interaction_time: str = ""

    @property
    def abandonment_rate_pct(self) -> float:
        if self.pickups == 0:
            return 0.0
        return round((self.replaced_left / self.pickups) * 100, 1)

    @property
    def conversion_rate_pct(self) -> float:
        if self.pickups == 0:
            return 0.0
        return round((self.purchases / self.pickups) * 100, 1)

    @property
    def owner_insight(self) -> str:
        if self.pickups == 0:
            return "No customer interaction recorded yet."
        if self.replaced_left > 0 and self.purchases == 0:
            return f"⚠️ High Abandonment: Picked up {self.pickups}x but always replaced on shelf. Review price or shelf placement."
        if self.replaced_left > self.purchases:
            return f"⚠️ Moderate Drop-off ({self.abandonment_rate_pct}%): Customers inspect but frequently leave on shelf."
        if self.purchases > 0 and self.replaced_left == 0:
            return f"✅ High Conversion (100%): Every customer who picked this item purchased it."
        return f"Active browsing: {self.purchases} bought vs {self.replaced_left} left on shelf."

@dataclass
class CustomerProductActionRecord:
    customer_id: int
    product_name: str
    action: str              # "PICKED UP", "REPLACED (LEFT ON SHELF)", "PURCHASED (TAKEN)"
    status: str              # "NOT BOUGHT", "BOUGHT", "INSPECTING"
    dwell_time_sec: float
    timestamp: str

@dataclass
class AnalyticsSummary:
    total_customers_today: int
    active_customers_now: int
    avg_dwell_time_seconds: float
    total_pickups: int
    total_replaced_left: int      # Total items left on shelf
    total_purchases: int          # Total items bought
    store_abandonment_rate_pct: float
    most_abandoned_product: str
    product_stats: List[Dict[str, Any]]
    recent_actions: List[Dict[str, Any]]

class AnalyticsEngine:
    """
    Core Warehouse Owner Business Intelligence Engine.
    Enables warehouse managers and store owners to see exactly which products customers pick up, inspect,
    and put back/replace on shelves (lost sales) versus what they buy.
    """
    def __init__(self):
        self.customer_dwells: List[float] = []
        self.total_customer_count = 0
        
        # Dictionary of product abandonment stats
        self.product_stats: Dict[str, ProductAbandonmentStat] = {}
        
        # Customer action history log
        self.action_history: List[CustomerProductActionRecord] = []

    def record_dwell(self, dwell_seconds: float):
        if dwell_seconds > 0:
            self.customer_dwells.append(dwell_seconds)

    def record_pickup(self, customer_id: int, product_name: str, category: str = "General"):
        now_str = datetime.now().strftime("%I:%M:%S %p")
        if product_name not in self.product_stats:
            self.product_stats[product_name] = ProductAbandonmentStat(product_name, category)
        stat = self.product_stats[product_name]
        stat.pickups += 1
        stat.last_interaction_time = now_str

        self.action_history.insert(0, CustomerProductActionRecord(
            customer_id=customer_id,
            product_name=product_name,
            action="PICKED UP",
            status="INSPECTING ITEM",
            dwell_time_sec=1.0,
            timestamp=now_str
        ))
        if len(self.action_history) > 30:
            self.action_history.pop()

    def record_replaced_left(self, customer_id: int, product_name: str, dwell_sec: float = 2.5):
        """
        Customer put the item back on the shelf without buying it.
        """
        now_str = datetime.now().strftime("%I:%M:%S %p")
        if product_name in self.product_stats:
            stat = self.product_stats[product_name]
            stat.replaced_left += 1
            stat.last_interaction_time = now_str

        self.action_history.insert(0, CustomerProductActionRecord(
            customer_id=customer_id,
            product_name=product_name,
            action="REPLACED ON SHELF",
            status="LEFT ON SHELF (NOT BOUGHT)",
            dwell_time_sec=dwell_sec,
            timestamp=now_str
        ))
        if len(self.action_history) > 30:
            self.action_history.pop()

    def record_purchase(self, customer_id: int, product_name: str, dwell_sec: float = 3.0):
        """
        Customer walked away with the item (purchased / taken).
        """
        now_str = datetime.now().strftime("%I:%M:%S %p")
        if product_name in self.product_stats:
            stat = self.product_stats[product_name]
            stat.purchases += 1
            stat.last_interaction_time = now_str

        self.action_history.insert(0, CustomerProductActionRecord(
            customer_id=customer_id,
            product_name=product_name,
            action="PURCHASED",
            status="BOUGHT (TAKEN)",
            dwell_time_sec=dwell_sec,
            timestamp=now_str
        ))
        if len(self.action_history) > 30:
            self.action_history.pop()

    def get_summary(self, active_customers_count: int = 0) -> AnalyticsSummary:
        avg_dwell = round(sum(self.customer_dwells) / len(self.customer_dwells), 1) if self.customer_dwells else 0.0
        
        tot_pickups = sum(s.pickups for s in self.product_stats.values())
        tot_left = sum(s.replaced_left for s in self.product_stats.values())
        tot_purchases = sum(s.purchases for s in self.product_stats.values())
        
        overall_abandon_rate = round((tot_left / max(tot_pickups, 1)) * 100, 1) if tot_pickups > 0 else 0.0

        # Find most abandoned product (picked and left the most)
        most_abandoned = "None"
        max_left = -1
        for name, s in self.product_stats.items():
            if s.replaced_left > max_left and s.replaced_left > 0:
                max_left = s.replaced_left
                most_abandoned = f"{name} ({s.replaced_left}x left)"

        stats_list = [
            {
                "product_name": s.product_name,
                "category": s.category,
                "pickups": s.pickups,
                "replaced_left": s.replaced_left,
                "purchases": s.purchases,
                "abandonment_rate_pct": s.abandonment_rate_pct,
                "conversion_rate_pct": s.conversion_rate_pct,
                "owner_insight": s.owner_insight,
                "last_time": s.last_interaction_time
            }
            for s in self.product_stats.values()
        ]

        recent_acts = [
            {
                "customer_id": a.customer_id,
                "product_name": a.product_name,
                "action": a.action,
                "status": a.status,
                "dwell_time_sec": a.dwell_time_sec,
                "timestamp": a.timestamp
            }
            for a in self.action_history
        ]

        return AnalyticsSummary(
            total_customers_today=max(self.total_customer_count, active_customers_count),
            active_customers_now=active_customers_count,
            avg_dwell_time_seconds=round(avg_dwell, 1),
            total_pickups=tot_pickups,
            total_replaced_left=tot_left,
            total_purchases=tot_purchases,
            store_abandonment_rate_pct=overall_abandon_rate,
            most_abandoned_product=most_abandoned,
            product_stats=stats_list,
            recent_actions=recent_acts
        )
