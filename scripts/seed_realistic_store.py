"""
Realistic Warehouse Store Catalog & Operational Activity Seeder for MetaRetail AI
Generates authentic warehouse products with custom packaging images, realistic INR pricing,
barcodes, categories, customers, dwell times, interactions, carts, invoices, and security events.
"""
import os
import sys
import json
import random
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont

# Add project root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.database.session import SessionLocal, engine
from backend.app.database.base import Base
from backend.app.models.domain import (
    Product, ProductImage, Customer, Interaction, InteractionDetail,
    CartItem, Invoice, SecurityIncident, Alert, Event, Zone, ZoneProduct, Camera
)

UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "products"))
os.makedirs(UPLOADS_DIR, exist_ok=True)


REALISTIC_PRODUCTS = [
    {
        "sku": "BEV-COKE-330",
        "name": "Coca-Cola Classic (330ml Can)",
        "category": "Beverages",
        "unit_price": 40.0,
        "current_stock": 28,
        "min_stock_threshold": 6,
        "barcode": "8901764012217",
        "description": "Original sparkling cola refreshment in a 330ml chilled aluminium can.",
        "zone_id": 2, # Aisle 1 - Chilled Beverages
        "bg_color": (218, 41, 28), # Coke Red
        "accent_color": (255, 255, 255),
        "text_main": "Coca-Cola",
        "text_sub": "ORIGINAL TASTE\n330 ml"
    },
    {
        "sku": "DRY-AMUL-1L",
        "name": "Amul Taaza Milk (1L Tetra Pak)",
        "category": "Dairy",
        "unit_price": 74.0,
        "current_stock": 20,
        "min_stock_threshold": 5,
        "barcode": "8901262010053",
        "description": "Pasteurised homogenised toned milk, fortified with Vitamin A & D. 1 Litre.",
        "zone_id": 2,
        "bg_color": (32, 124, 202), # Amul Blue
        "accent_color": (255, 255, 255),
        "text_main": "Amul Taaza",
        "text_sub": "TONED MILK\n1 Litre"
    },
    {
        "sku": "BEV-TROP-1L",
        "name": "Tropicana 100% Orange Juice (1L)",
        "category": "Beverages",
        "unit_price": 135.0,
        "current_stock": 16,
        "min_stock_threshold": 4,
        "barcode": "8902080000109",
        "description": "100% pure squeezed Florida orange juice with natural fruit pulp. No added sugar.",
        "zone_id": 2,
        "bg_color": (245, 130, 32), # Orange
        "accent_color": (255, 255, 255),
        "text_main": "Tropicana",
        "text_sub": "100% ORANGE JUICE\n1 Litre Pure"
    },
    {
        "sku": "SNK-DORITOS-150",
        "name": "Doritos Nacho Cheese Chips (150g)",
        "category": "Snacks",
        "unit_price": 60.0,
        "current_stock": 35,
        "min_stock_threshold": 8,
        "barcode": "8901491101850",
        "description": "Bold and cheesy crispy tortilla chips with extreme crunch in a 150g pack.",
        "zone_id": 3, # Aisle 2 - Snacks
        "bg_color": (180, 25, 25), # Doritos dark red
        "accent_color": (255, 215, 0), # Gold
        "text_main": "Doritos",
        "text_sub": "NACHO CHEESE\n150g Bold Crunch"
    },
    {
        "sku": "SNK-LAYS-MASALA",
        "name": "Lay's India's Magic Masala (115g)",
        "category": "Snacks",
        "unit_price": 40.0,
        "current_stock": 42,
        "min_stock_threshold": 10,
        "barcode": "8901491100013",
        "description": "Ridged potato chips tossed with authentic aromatic Indian spices and mango powder.",
        "zone_id": 3,
        "bg_color": (10, 75, 160), # Lay's Blue
        "accent_color": (255, 204, 0), # Yellow
        "text_main": "Lay's",
        "text_sub": "MAGIC MASALA\n115g Spiced Chips"
    },
    {
        "sku": "CNF-CADBURY-SILK",
        "name": "Cadbury Dairy Milk Silk Chocolate (150g)",
        "category": "Confectionery",
        "unit_price": 175.0,
        "current_stock": 25,
        "min_stock_threshold": 5,
        "barcode": "7622201438999",
        "description": "Silky smooth, rich chocolate made with fresh glass and a half of dairy milk. 150g.",
        "zone_id": 3,
        "bg_color": (55, 15, 95), # Cadbury Royal Purple
        "accent_color": (255, 215, 0), # Gold
        "text_main": "Cadbury Silk",
        "text_sub": "DAIRY MILK SILK\n150g Pure Indulgence"
    },
    {
        "sku": "BAK-WHEAT-BREAD",
        "name": "English Oven 100% Whole Wheat Bread (400g)",
        "category": "Bakery",
        "unit_price": 55.0,
        "current_stock": 18,
        "min_stock_threshold": 4,
        "barcode": "8906012480012",
        "description": "Healthy high-fibre artisanal brown bread prepared with 100% whole wheat flour.",
        "zone_id": 4, # Aisle 3 - Fresh & Bakery
        "bg_color": (150, 95, 45), # Rustic Bakery Brown
        "accent_color": (255, 245, 220), # Warm cream
        "text_main": "English Oven",
        "text_sub": "100% WHOLE WHEAT\n400g Fresh Baked"
    },
    {
        "sku": "DRY-EPIGAMIA-100",
        "name": "Epigamia Artisanal Greek Yogurt (100g)",
        "category": "Dairy",
        "unit_price": 50.0,
        "current_stock": 22,
        "min_stock_threshold": 6,
        "barcode": "8906070430011",
        "description": "Thick and creamy traditional strained Greek yogurt packed with 8g natural protein.",
        "zone_id": 4,
        "bg_color": (245, 248, 252), # Off-white clean
        "accent_color": (20, 50, 110), # Epigamia Navy
        "text_main": "epigamia",
        "text_sub": "GREEK YOGURT\n100g Natural Protein"
    },
    {
        "sku": "BEV-NESCAFE-100",
        "name": "Nescafé Classic Instant Coffee (100g Jar)",
        "category": "Beverages",
        "unit_price": 210.0,
        "current_stock": 15,
        "min_stock_threshold": 4,
        "barcode": "8901058852970",
        "description": "Richly roasted Arabica and Robusta blend instant coffee granules in a glass jar.",
        "zone_id": 2,
        "bg_color": (45, 25, 20), # Coffee dark brown
        "accent_color": (220, 35, 35), # Nescafe Red
        "text_main": "NESCAFÉ",
        "text_sub": "CLASSIC COFFEE\n100g 100% Pure"
    },
    {
        "sku": "SNK-MAGGI-4PK",
        "name": "Maggi 2-Minute Masala Noodles (Pack of 4)",
        "category": "Packaged Foods",
        "unit_price": 56.0,
        "current_stock": 45,
        "min_stock_threshold": 10,
        "barcode": "8901058859184",
        "description": "India's favourite 2-minute instant noodles with special masala tastemaker. 4 x 70g.",
        "zone_id": 3,
        "bg_color": (255, 208, 0), # Maggi Yellow
        "accent_color": (200, 20, 20), # Red
        "text_main": "Maggi",
        "text_sub": "2-MINUTE NOODLES\nPack of 4 Masala"
    },
    {
        "sku": "ELC-BOAT-141",
        "name": "boAt Airdopes 141 True Wireless Earbuds",
        "category": "Electronics",
        "unit_price": 1299.0,
        "current_stock": 9,
        "min_stock_threshold": 2,
        "barcode": "8904354400128",
        "description": "True wireless earbuds with 42H battery playback, 8mm dynamic drivers, ENx noise isolation.",
        "zone_id": 5, # Electronics Bay
        "bg_color": (22, 24, 30), # Matte Charcoal Black
        "accent_color": (0, 225, 200), # Neon Cyan
        "text_main": "boAt Airdopes",
        "text_sub": "141 TWS EARBUDS\n42H Playback Beast"
    },
    {
        "sku": "ELC-SANDISK-64G",
        "name": "SanDisk Ultra Dual Drive Go 64GB USB",
        "category": "Electronics",
        "unit_price": 549.0,
        "current_stock": 14,
        "min_stock_threshold": 3,
        "barcode": "0619659178451",
        "description": "2-in-1 flash drive with reversible USB Type-C and traditional Type-A connectors. 150MB/s.",
        "zone_id": 5,
        "bg_color": (45, 55, 72), # Tech Grey
        "accent_color": (229, 62, 62), # SanDisk Red
        "text_main": "SanDisk Ultra",
        "text_sub": "64GB DUAL DRIVE\nType-C + Type-A 150MB/s"
    }
]


def generate_packaging_image(prod_data: dict, filepath: str):
    """
    Renders a realistic 400x400 warehouse product packaging image with crisp styling,
    contrasting branding banners, product text, badge accents, and barcode lines.
    """
    width, height = 400, 400
    bg = prod_data["bg_color"]
    acc = prod_data["accent_color"]
    main_text = prod_data["text_main"]
    sub_text = prod_data["text_sub"]

    im = Image.new("RGB", (width, height), color=bg)
    draw = ImageDraw.Draw(im)

    # Decorative outer border
    draw.rectangle([8, 8, width - 9, height - 9], outline=acc, width=3)
    draw.rectangle([14, 14, width - 15, height - 15], outline=acc, width=1)

    # Top brand ribbon
    draw.rectangle([0, 30, width, 95], fill=acc)
    
    # Text font fallbacks
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
        font_mid = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_micro = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    except Exception:
        font_large = ImageFont.load_default()
        font_mid = ImageFont.load_default()
        font_small = ImageFont.load_default()
        font_micro = ImageFont.load_default()

    # Brand Title in ribbon
    ribbon_text_color = bg if bg != (245, 248, 252) else (20, 50, 110)
    draw.text((25, 45), main_text, fill=ribbon_text_color, font=font_large)

    # Center Product Badge Box
    draw.rounded_rectangle([35, 125, width - 35, 275], radius=16, fill=(0, 0, 0, 40), outline=acc, width=2)
    
    # Sub-text in Center Box
    lines = sub_text.split("\n")
    y_off = 155
    for line in lines:
        draw.text((55, y_off), line, fill=acc, font=font_mid)
        y_off += 34

    # Category Pill Badge
    draw.rounded_rectangle([35, 290, 190, 322], radius=8, fill=acc)
    draw.text((45, 296), prod_data["category"].upper(), fill=ribbon_text_color, font=font_small)

    # Price Tag Badge
    price_str = f"₹{prod_data['unit_price']:.0f}"
    draw.rounded_rectangle([width - 150, 290, width - 35, 322], radius=8, fill=(34, 197, 94))
    draw.text((width - 135, 296), price_str, fill=(255, 255, 255), font=font_mid)

    # Barcode graphical lines at bottom
    bc_y1, bc_y2 = 345, 380
    start_x = 40
    # Seed pseudo-random barcode lines
    random.seed(sum(ord(c) for c in prod_data["sku"]))
    x = start_x
    while x < width - 110:
        bar_w = random.choice([2, 3, 4, 6])
        draw.rectangle([x, bc_y1, x + bar_w - 1, bc_y2], fill=acc)
        x += bar_w + random.choice([2, 3, 5])

    draw.text((width - 100, 355), prod_data["sku"][:8], fill=acc, font=font_micro)

    im.save(filepath, "JPEG", quality=92)


def seed_realistic_store():
    print("🚀 Seeding Authentic Warehouse Store Catalog & Real Retail Activity...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Clean up obsolete test products (e.g. 'Goutham', 'Unknown Product', duplicate 'book')
        old_products = db.query(Product).all()
        target_skus = {p["sku"] for p in REALISTIC_PRODUCTS}
        
        for p in old_products:
            if p.sku not in target_skus:
                print(f"  Cleaning legacy/test product: id={p.id}, name='{p.name}', sku='{p.sku}'")
                # Remove associated records first to preserve foreign key constraints
                db.query(ZoneProduct).filter(ZoneProduct.product_id == p.id).delete()
                db.query(ProductImage).filter(ProductImage.product_id == p.id).delete()
                db.query(CartItem).filter(CartItem.product_id == p.id).delete()
                db.query(Alert).filter(Alert.product_id == p.id).delete()
                # Delete interactions pointing to this product
                intrs = db.query(Interaction).filter(Interaction.product_id == p.id).all()
                for intr in intrs:
                    db.query(InteractionDetail).filter(InteractionDetail.interaction_id == intr.id).delete()
                    db.delete(intr)
                db.delete(p)
        db.commit()

        # 2. Insert or update the 12 authentic warehouse products
        seeded_prods = {}
        for pdata in REALISTIC_PRODUCTS:
            sku = pdata["sku"]
            img_filename = f"{sku.lower().replace('-', '_')}.jpg"
            img_path = os.path.join(UPLOADS_DIR, img_filename)
            rel_img_url = f"/uploads/products/{img_filename}"

            # Generate crisp packaging image
            generate_packaging_image(pdata, img_path)

            prod = db.query(Product).filter(Product.sku == sku).first()
            if not prod:
                prod = Product(
                    sku=sku,
                    name=pdata["name"],
                    category=pdata["category"],
                    current_stock=pdata["current_stock"],
                    min_stock_threshold=pdata["min_stock_threshold"],
                    unit_price=pdata["unit_price"],
                    image_url=rel_img_url,
                    barcode=pdata["barcode"],
                    description=pdata["description"]
                )
                db.add(prod)
                db.commit()
                db.refresh(prod)
                print(f"  Created product: [{prod.id}] {prod.name} (₹{prod.unit_price})")
            else:
                prod.name = pdata["name"]
                prod.category = pdata["category"]
                prod.current_stock = pdata["current_stock"]
                prod.min_stock_threshold = pdata["min_stock_threshold"]
                prod.unit_price = pdata["unit_price"]
                prod.image_url = rel_img_url
                prod.barcode = pdata["barcode"]
                prod.description = pdata["description"]
                db.commit()
                db.refresh(prod)
                print(f"  Updated product: [{prod.id}] {prod.name} (₹{prod.unit_price})")

            seeded_prods[sku] = prod

            # Add reference ProductImage if missing
            existing_img = db.query(ProductImage).filter(
                ProductImage.product_id == prod.id,
                ProductImage.angle == "front"
            ).first()
            if not existing_img:
                db.add(ProductImage(
                    product_id=prod.id,
                    image_path=rel_img_url,
                    angle="front",
                    is_reference=True
                ))
                db.commit()

            # Assign product to its retail zone
            existing_zp = db.query(ZoneProduct).filter(
                ZoneProduct.zone_id == pdata["zone_id"],
                ZoneProduct.product_id == prod.id
            ).first()
            if not existing_zp:
                db.add(ZoneProduct(zone_id=pdata["zone_id"], product_id=prod.id))
                db.commit()

        # 3. Seed Realistic Customers & Store Footfall
        print("  Seeding authentic shopper footfall and dwelling records...")
        now = datetime.utcnow()

        # We will seed 15 customers:
        # Customers 101-112: checked out earlier today
        # Customers 113-115: currently active inside the store
        db.query(Customer).delete()
        db.commit()

        customers = []
        for cid in range(101, 113):
            entry = now - timedelta(minutes=random.randint(40, 240))
            dwell = round(random.uniform(90.0, 320.0), 1)
            exit_t = entry + timedelta(seconds=dwell)
            cust = Customer(
                id=cid,
                track_id=cid,
                entry_time=entry,
                exit_time=exit_t,
                dwell_time=dwell
            )
            db.add(cust)
            customers.append(cust)

        # Active shoppers currently in store
        for cid in [113, 114, 115]:
            entry = now - timedelta(minutes=random.randint(2, 12))
            dwell = round(random.uniform(45.0, 115.0), 1)
            cust = Customer(
                id=cid,
                track_id=cid,
                entry_time=entry,
                exit_time=None,
                dwell_time=dwell
            )
            db.add(cust)
            customers.append(cust)
        db.commit()

        # 4. Seed Rich Shelf Interactions & Dwell Details
        print("  Seeding genuine shelf interactions & replacement reasons...")
        db.query(InteractionDetail).delete()
        db.query(Interaction).delete()
        db.commit()

        reasons = [
            "Checking Expiry Date",
            "Price Consideration",
            "Nutritional Info Review",
            "Comparison with Alternate Brand",
            "Packaging Inspection"
        ]

        all_prod_list = list(seeded_prods.values())
        interaction_count = 0

        for cust in customers:
            # Pick 2-4 products per customer
            sample_prods = random.sample(all_prod_list, k=random.randint(2, 4))
            for p in sample_prods:
                intr_time = cust.entry_time + timedelta(seconds=random.randint(10, 80))
                
                # Customer either took it or replaced it
                is_replaced = (random.random() < 0.35) # 35% abandonment rate
                action_name = "APPROACH" if is_replaced else "PICKUP"

                intr = Interaction(
                    customer_id=cust.id,
                    product_id=p.id,
                    action=action_name,
                    confidence=round(random.uniform(0.88, 0.98), 2),
                    timestamp=intr_time
                )
                db.add(intr)
                db.commit()
                db.refresh(intr)
                interaction_count += 1

                hold_dur = round(random.uniform(3.5, 22.0), 1)
                detail = InteractionDetail(
                    interaction_id=intr.id,
                    pickup_timestamp=intr_time,
                    replace_timestamp=intr_time + timedelta(seconds=hold_dur) if is_replaced else None,
                    hold_duration_seconds=hold_dur,
                    was_replaced=is_replaced,
                    inferred_reason=random.choice(reasons) if is_replaced else None,
                    zone_id=next((pdata["zone_id"] for pdata in REALISTIC_PRODUCTS if pdata["sku"] == p.sku), 2),
                    camera_id=random.choice([8888, 9999, 1])
                )
                db.add(detail)
        db.commit()

        # 5. Seed Active Virtual Baskets for Current In-Store Shoppers
        print("  Seeding live shopping baskets for active customers #113, #114, #115...")
        db.query(CartItem).filter(CartItem.status == "IN_CART").delete()
        db.commit()

        active_carts_data = [
            (113, [("BEV-COKE-330", 1), ("SNK-DORITOS-150", 2)]),
            (114, [("BAK-WHEAT-BREAD", 1), ("DRY-AMUL-1L", 1), ("DRY-EPIGAMIA-100", 2)]),
            (115, [("ELC-SANDISK-64G", 1), ("BEV-NESCAFE-100", 1)])
        ]

        for tid, items in active_carts_data:
            for sku, qty in items:
                p = seeded_prods[sku]
                cart_item = CartItem(
                    customer_track_id=tid,
                    product_id=p.id,
                    quantity=qty,
                    unit_price=p.unit_price,
                    status="IN_CART",
                    added_at=now - timedelta(minutes=random.randint(1, 5))
                )
                db.add(cart_item)
        db.commit()

        # 6. Seed Realistic Invoices with High SKU Affinity (Market Basket Co-occurrence)
        print("  Seeding realistic completed tax invoices (D-Mart / Reliance standard)...")
        # Keep recent completed invoices or seed a coherent 20-order history
        db.query(Invoice).delete()
        db.commit()

        basket_combinations = [
            [("BEV-COKE-330", 2), ("SNK-DORITOS-150", 1)],
            [("BAK-WHEAT-BREAD", 1), ("DRY-AMUL-1L", 2), ("DRY-EPIGAMIA-100", 1)],
            [("SNK-MAGGI-4PK", 2), ("BEV-COKE-330", 1), ("SNK-LAYS-MASALA", 2)],
            [("CNF-CADBURY-SILK", 2), ("BEV-NESCAFE-100", 1)],
            [("ELC-BOAT-141", 1), ("ELC-SANDISK-64G", 1)],
            [("BEV-TROP-1L", 1), ("BAK-WHEAT-BREAD", 1), ("DRY-EPIGAMIA-100", 2)],
            [("SNK-DORITOS-150", 2), ("BEV-COKE-330", 2)],
            [("SNK-LAYS-MASALA", 3), ("BEV-COKE-330", 1)],
            [("BAK-WHEAT-BREAD", 2), ("DRY-AMUL-1L", 1)],
            [("CNF-CADBURY-SILK", 1), ("SNK-DORITOS-150", 1), ("BEV-COKE-330", 1)],
            [("SNK-MAGGI-4PK", 1), ("SNK-LAYS-MASALA", 1)],
            [("ELC-SANDISK-64G", 2), ("BEV-COKE-330", 1)]
        ]

        date_str = now.strftime("%Y%m%d")
        for idx, basket in enumerate(basket_combinations, start=1):
            cust_tid = 100 + idx
            inv_time = now - timedelta(minutes=random.randint(15, 200))
            item_list = []
            subtotal = 0.0

            for sku, qty in basket:
                p = seeded_prods[sku]
                line_total = round(p.unit_price * qty, 2)
                subtotal += line_total
                item_list.append({
                    "product_id": p.id,
                    "product_name": p.name,
                    "sku": p.sku,
                    "category": p.category,
                    "quantity": qty,
                    "unit_price": p.unit_price,
                    "line_total": line_total
                })

            subtotal = round(subtotal, 2)
            cgst = round(subtotal * 0.09, 2)
            sgst = round(subtotal * 0.09, 2)
            tax = round(cgst + sgst, 2)
            grand_total = round(subtotal + tax, 2)

            inv_no = f"INV-{date_str}-{cust_tid:03d}-{1000 + idx}"
            invoice = Invoice(
                invoice_number=inv_no,
                customer_track_id=cust_tid,
                subtotal=subtotal,
                tax_amount=tax,
                total_amount=grand_total,
                payment_status="PAID",
                payment_method="AUTONOMOUS_JUST_WALK_OUT",
                items_json=json.dumps(item_list),
                created_at=inv_time
            )
            db.add(invoice)
        db.commit()

        # 7. Seed Authentic Security Incidents & Shrinkage Prevention
        print("  Seeding loss prevention security incidents...")
        db.query(SecurityIncident).delete()
        db.commit()

        incidents_data = [
            {
                "type": "CONCEALMENT",
                "risk": 0.94,
                "track_id": 105,
                "zone_id": 3,
                "desc": "Shopper placed 2x Doritos Nacho Cheese into personal backpack without cart attribution.",
                "action": "Autonomous Turnstile Alert Triggered - Staff Verified",
                "status": "RESOLVED",
                "mins_ago": 110
            },
            {
                "type": "BULK_SWEEP",
                "risk": 0.88,
                "track_id": 108,
                "zone_id": 3,
                "desc": "Rapid grab of 4x Cadbury Dairy Milk Silk bars within 3.2 seconds from Shelf B-2.",
                "action": "Overhead Camera Auto-Zoom Tracking",
                "status": "RESOLVED",
                "mins_ago": 75
            },
            {
                "type": "UNPAID_EXIT",
                "risk": 0.91,
                "track_id": 111,
                "zone_id": 6,
                "desc": "Turnstile tailgate attempt with unbilled boAt Airdopes 141 in coat pocket.",
                "action": "Exit Turnstile Auto-Lock Intercept",
                "status": "RESOLVED",
                "mins_ago": 35
            },
            {
                "type": "SUSPICIOUS_DWELL",
                "risk": 0.72,
                "track_id": 114,
                "zone_id": 5,
                "desc": "Customer lingering in High-Value Electronics Bay for > 190s without picking merchandise.",
                "action": "Floor Associate Courtesy Patrol",
                "status": "OPEN",
                "mins_ago": 8
            },
            {
                "type": "UNATTENDED_ITEM",
                "risk": 0.65,
                "track_id": 115,
                "zone_id": 2,
                "desc": "Chilled beverage bottle placed on ambient snack shelf (Planogram displacement).",
                "action": "Planogram Restocking Task Created",
                "status": "OPEN",
                "mins_ago": 4
            }
        ]

        for inc in incidents_data:
            created = now - timedelta(minutes=inc["mins_ago"])
            resolved = created + timedelta(minutes=5) if inc["status"] == "RESOLVED" else None
            db.add(SecurityIncident(
                incident_type=inc["type"],
                risk_score=inc["risk"],
                customer_track_id=inc["track_id"],
                camera_id=random.choice([8888, 9999, 1]),
                zone_id=inc["zone_id"],
                description=inc["desc"],
                recommended_action=inc["action"],
                status=inc["status"],
                created_at=created,
                resolved_at=resolved
            ))
        db.commit()

        # 8. Seed Realistic Inventory Alerts
        print("  Seeding low stock and planogram alerts...")
        db.query(Alert).delete()
        db.commit()

        alerts_data = [
            ("LOW_STOCK", seeded_prods["ELC-BOAT-141"].id, "WARNING", "boAt Airdopes 141 running low (9 units remaining, reorder threshold 2)."),
            ("LOW_STOCK", seeded_prods["BEV-NESCAFE-100"].id, "INFO", "Nescafé Classic 100g shelf depletion rate +24% above 7-day average."),
            ("PLANOGRAM_MISMATCH", seeded_prods["DRY-EPIGAMIA-100"].id, "WARNING", "Epigamia Greek Yogurt facing displaced by adjacent Whole Wheat Bread.")
        ]
        for atype, pid, sev, msg in alerts_data:
            db.add(Alert(
                alert_type=atype,
                product_id=pid,
                severity=sev,
                message=msg,
                is_resolved=False,
                created_at=now - timedelta(minutes=random.randint(10, 60))
            ))
        db.commit()

        # 9. Register Product Images into ViT Classifier
        print("  Registering product packaging images into ViT Vision Classifier...")
        try:
            from backend.app.services.pipeline_instance import shared_pipeline_service
            shared_pipeline_service.classifier.load_from_database()
            print("  ✅ All 12 products successfully indexed into ViT feature gallery!")
        except Exception as e:
            print(f"  Note: ViT classifier registration handled gracefully: {e}")

        print("\n✨ Authentic Warehouse Store Catalog & Live Data Successfully Seeded!")
        print(f"  • 12 Authentic Warehouse Products with custom packaging graphics")
        print(f"  • 15 Real Customer trajectories (12 completed, 3 active in-store)")
        print(f"  • {interaction_count} Shelf interactions & replacement reasons")
        print(f"  • 3 Active virtual carts (Customer #113, #114, #115)")
        print(f"  • 12 Detailed tax invoices with SKU affinity cross-sell patterns")
        print(f"  • 5 Security incidents (3 resolved shrinkage prevention, 2 active)")
        print(f"  • Realistic INR pricing across all aisles (₹40 to ₹1,299)")

    except Exception as e:
        print(f"❌ Error during store seeding: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_realistic_store()
