"""
Shelf Stock & Low-Stock Alert Engine
"""
from dataclasses import dataclass
from typing import Dict, List, Optional
import time
import logging

logger = logging.getLogger("metaretail.ai.inventory")

@dataclass
class StockUpdateEvent:
    product_name: str
    previous_stock: int
    new_stock: int
    is_low_stock: bool
    timestamp: float

class InventoryEngine:
    """
    Manages in-memory and database-backed inventory stock estimation and low-stock alerts.
    """
    def __init__(self, initial_stock: Optional[Dict[str, Dict[str, int]]] = None):
        self.stock: Dict[str, Dict[str, int]] = initial_stock or {
            "Coke": {"count": 5, "min_threshold": 2},
            "Pepsi": {"count": 5, "min_threshold": 2},
            "Lays": {"count": 3, "min_threshold": 2},
            "Biscuits": {"count": 4, "min_threshold": 2},
            "Juice Box": {"count": 4, "min_threshold": 2}
        }

    def process_removal(self, product_name: str) -> Optional[StockUpdateEvent]:
        """
        Decrements stock upon confirmed product removal.
        """
        if product_name in self.stock:
            prev = self.stock[product_name]["count"]
            if prev > 0:
                self.stock[product_name]["count"] -= 1
                new_cnt = self.stock[product_name]["count"]
                min_thresh = self.stock[product_name]["min_threshold"]
                is_low = new_cnt <= min_thresh
                
                evt = StockUpdateEvent(
                    product_name=product_name,
                    previous_stock=prev,
                    new_stock=new_cnt,
                    is_low_stock=is_low,
                    timestamp=time.time()
                )
                logger.info(f"Inventory update: {product_name} stock {prev} -> {new_cnt} (Low stock: {is_low})")
                return evt
        return None

    def process_return(self, product_name: str) -> Optional[StockUpdateEvent]:
        """
        Increments stock upon confirmed product return.
        """
        if product_name in self.stock:
            prev = self.stock[product_name]["count"]
            self.stock[product_name]["count"] += 1
            new_cnt = self.stock[product_name]["count"]
            min_thresh = self.stock[product_name]["min_threshold"]
            is_low = new_cnt <= min_thresh
            
            evt = StockUpdateEvent(
                product_name=product_name,
                previous_stock=prev,
                new_stock=new_cnt,
                is_low_stock=is_low,
                timestamp=time.time()
            )
            logger.info(f"Inventory update: {product_name} returned {prev} -> {new_cnt}")
            return evt
        return None

    def get_all_stock(self) -> Dict[str, Dict[str, int]]:
        return self.stock
