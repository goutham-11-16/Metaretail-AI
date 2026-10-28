"""
Cart & Autonomous Checkout Service for MetaRetail AI
Powers real-time virtual shopper carts and automated tax invoice generation (D-Mart / Reliance standard).
"""
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models.domain import CartItem, Invoice, Product, Event, Customer
from backend.app.database.session import SessionLocal

logger = logging.getLogger("metaretail.cart")


class CartService:
    def __init__(self):
        self._next_invoice_seq = 1001

    def add_to_cart(self, db: Session, customer_track_id: int, product_name: str, quantity: int = 1) -> Optional[CartItem]:
        """
        Adds product to customer's active virtual basket upon shelf removal.
        """
        prod = db.query(Product).filter(Product.name.ilike(f"%{product_name[:6]}%")).first()
        if not prod:
            # Fallback to any matching name
            prod = db.query(Product).first()
        if not prod:
            logger.warning(f"Cannot add to cart: Product {product_name} not found in database.")
            return None

        # Check for existing item in active cart
        existing = db.query(CartItem).filter(
            CartItem.customer_track_id == customer_track_id,
            CartItem.product_id == prod.id,
            CartItem.status == "IN_CART"
        ).first()

        if existing:
            existing.quantity += quantity
            db.commit()
            db.refresh(existing)
            logger.info(f"Customer #{customer_track_id} updated cart: {prod.name} x{existing.quantity}")
            return existing
        else:
            item = CartItem(
                customer_track_id=customer_track_id,
                product_id=prod.id,
                quantity=quantity,
                unit_price=prod.unit_price or 4.99,
                status="IN_CART",
                added_at=datetime.utcnow()
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            logger.info(f"Customer #{customer_track_id} added to cart: {prod.name} x{quantity}")
            return item

    def remove_from_cart(self, db: Session, customer_track_id: int, product_name: str, quantity: int = 1) -> bool:
        """
        Removes or decrements product from customer's virtual basket upon shelf replacement.
        """
        prod = db.query(Product).filter(Product.name.ilike(f"%{product_name[:6]}%")).first()
        if not prod:
            return False

        existing = db.query(CartItem).filter(
            CartItem.customer_track_id == customer_track_id,
            CartItem.product_id == prod.id,
            CartItem.status == "IN_CART"
        ).first()

        if existing:
            if existing.quantity > quantity:
                existing.quantity -= quantity
            else:
                existing.status = "REMOVED"
            db.commit()
            logger.info(f"Customer #{customer_track_id} removed from cart: {prod.name}")
            return True
        return False

    def get_customer_cart(self, db: Session, customer_track_id: int) -> Dict[str, Any]:
        """
        Retrieves active virtual basket details for a specific customer.
        """
        items = db.query(CartItem).filter(
            CartItem.customer_track_id == customer_track_id,
            CartItem.status == "IN_CART"
        ).all()

        item_list = []
        subtotal = 0.0
        total_items = 0

        for it in items:
            prod = it.product
            price = it.unit_price or (prod.unit_price if prod else 0.0)
            line_total = round(price * it.quantity, 2)
            subtotal += line_total
            total_items += it.quantity
            item_list.append({
                "id": it.id,
                "product_id": it.product_id,
                "product_name": prod.name if prod else "Store Item",
                "category": prod.category if prod else "General",
                "sku": prod.sku if prod else "SKU-N/A",
                "quantity": it.quantity,
                "unit_price": price,
                "total_price": line_total,
                "image_url": prod.image_url if prod else None,
                "added_at": it.added_at.isoformat() if it.added_at else None
            })

        subtotal = round(subtotal, 2)
        # Indian Retail Standard 18% GST (9% CGST + 9% SGST)
        cgst = round(subtotal * 0.09, 2)
        sgst = round(subtotal * 0.09, 2)
        tax = round(cgst + sgst, 2)
        grand_total = round(subtotal + tax, 2)

        return {
            "customer_track_id": customer_track_id,
            "total_items": total_items,
            "items": item_list,
            "subtotal": subtotal,
            "cgst_9pct": cgst,
            "sgst_9pct": sgst,
            "tax_amount": tax,
            "grand_total": grand_total,
            "currency": "INR",
            "currency_symbol": "₹"
        }

    def get_all_active_carts(self, db: Session) -> List[Dict[str, Any]]:
        """
        Returns all shoppers currently holding active virtual carts.
        """
        active_track_ids = db.query(CartItem.customer_track_id).filter(
            CartItem.status == "IN_CART"
        ).distinct().all()

        track_ids = [t[0] for t in active_track_ids]
        carts = []
        for tid in track_ids:
            cart = self.get_customer_cart(db, tid)
            if cart["total_items"] > 0:
                carts.append(cart)
        return carts

    def checkout_customer(self, db: Session, customer_track_id: int, payment_method: str = "AUTONOMOUS_JUST_WALK_OUT") -> Dict[str, Any]:
        """
        Executes autonomous checkout, marks items CHECKED_OUT, deducts stock, and generates official tax invoice.
        """
        cart = self.get_customer_cart(db, customer_track_id)
        if cart["total_items"] == 0:
            raise ValueError(f"Customer #{customer_track_id} has no active items in cart.")

        # Sequential invoice number format
        now = datetime.utcnow()
        date_prefix = now.strftime("%Y%m%d")
        inv_number = f"INV-{date_prefix}-{customer_track_id:03d}-{int(now.timestamp()) % 10000:04d}"

        # Deduct stock for all items
        for it in cart["items"]:
            prod = db.query(Product).filter(Product.id == it["product_id"]).first()
            if prod:
                prod.current_stock = max(0, (prod.current_stock or 0) - it["quantity"])

        # Mark cart items as checked out
        db.query(CartItem).filter(
            CartItem.customer_track_id == customer_track_id,
            CartItem.status == "IN_CART"
        ).update({
            "status": "CHECKED_OUT",
            "checked_out_at": now
        })

        # Save official Invoice
        invoice = Invoice(
            invoice_number=inv_number,
            customer_track_id=customer_track_id,
            subtotal=cart["subtotal"],
            tax_amount=cart["tax_amount"],
            total_amount=cart["grand_total"],
            payment_status="PAID",
            payment_method=payment_method,
            items_json=json.dumps(cart["items"]),
            created_at=now
        )
        db.add(invoice)

        # Log store event
        event = Event(
            event_type="CHECKOUT_COMPLETED",
            description=f"Autonomous Checkout completed for Customer #{customer_track_id}. Invoice: {inv_number}, Total: ₹{cart['grand_total']:.2f}",
            timestamp=now,
            metadata_json=json.dumps({
                "invoice_number": inv_number,
                "customer_track_id": customer_track_id,
                "total_amount": cart["grand_total"],
                "items_count": cart["total_items"]
            })
        )
        db.add(event)
        db.commit()
        db.refresh(invoice)

        logger.info(f"Autonomous Invoice Generated: {inv_number} for Customer #{customer_track_id} (Total: ₹{cart['grand_total']})")

        return {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "customer_track_id": customer_track_id,
            "subtotal": invoice.subtotal,
            "cgst_9pct": cart["cgst_9pct"],
            "sgst_9pct": cart["sgst_9pct"],
            "tax_amount": invoice.tax_amount,
            "total_amount": invoice.total_amount,
            "payment_status": invoice.payment_status,
            "payment_method": invoice.payment_method,
            "items": cart["items"],
            "created_at": invoice.created_at.isoformat(),
            "store_info": {
                "name": "MetaRetail Autonomous Store (Smart Express)",
                "location": "Aisle 4, Tech Plaza, Bengaluru",
                "gstin": "29AABCU9603R1ZM",
                "fssai": "11223344556677"
            }
        }


shared_cart_service = CartService()
