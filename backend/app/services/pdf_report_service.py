"""
Professional PDF Report Generator for MetaRetail AI Warehouse & Store Operations.
Creates an executive sales, item dispatch, inventory audit, and loss prevention report.
"""
import io
import json
from datetime import datetime
from typing import List, Dict, Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and stamp total page count on all pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header banner line & title (pages 2+)
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(40, letter[1] - 35, letter[0] - 40, letter[1] - 35)
            self.drawString(40, letter[1] - 30, "METARETAIL AI — WAREHOUSE EXECUTIVE INTELLIGENCE & AUDIT REPORT")
            self.drawRightString(letter[0] - 40, letter[1] - 30, datetime.utcnow().strftime("%B %d, %Y"))

        # Footer divider line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(40, 42, letter[0] - 40, 42)

        # Footer text
        self.drawString(40, 30, "CONFIDENTIAL & PROPRIETARY — MetaRetail AI Autonomous Vision Platform")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 40, 30, page_str)
        self.restoreState()


def build_warehouse_pdf_report(
    invoices: list,
    products: list,
    customers: list,
    incidents: list = None
) -> bytes:
    """
    Generates a PDF document with comprehensive sales breakdowns,
    itemized sold goods, current inventory levels, and operational metrics.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=48,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Custom typography palette
    c_primary = colors.HexColor("#1E293B")     # Dark Slate
    c_secondary = colors.HexColor("#0284C7")   # Deep Sky Blue
    c_accent = colors.HexColor("#0F766E")      # Teal
    c_dark = colors.HexColor("#0F172A")        # Near Black
    c_muted = colors.HexColor("#64748B")       # Slate Muted
    c_border = colors.HexColor("#CBD5E1")      # Slate Light
    c_bg_light = colors.HexColor("#F8FAFC")    # Slate Off-White
    c_emerald = colors.HexColor("#059669")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_dark
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_muted
    )
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=c_dark
    )
    body_bold = ParagraphStyle(
        'BodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=c_dark
    )
    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white
    )
    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=c_dark
    )
    td_num_style = ParagraphStyle(
        'TableCellNum',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        alignment=2,  # Right-aligned
        textColor=c_dark
    )
    td_badge_style = ParagraphStyle(
        'TableBadge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        alignment=1,  # Center-aligned
        textColor=c_emerald
    )

    story = []

    # 1. HEADER SECTION
    story.append(Paragraph("MetaRetail AI — Warehouse Commercial Operations Audit", title_style))
    story.append(Spacer(1, 4))
    report_time = datetime.utcnow().strftime("%A, %B %d, %Y at %H:%M:%S UTC")
    story.append(Paragraph(f"Autonomous Vision Telemetry & Sales Liquidation Report • Generated: <b>{report_time}</b>", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_secondary, spaceBefore=0, spaceAfter=12))

    # 2. EXECUTIVE METRICS CALCULATION
    total_sales_inr = sum(inv.total_amount for inv in invoices)
    total_invoices_count = len(invoices)
    
    # Calculate itemized sales from invoices
    item_sales: Dict[str, Dict[str, Any]] = {}
    for inv in invoices:
        if inv.items_json:
            try:
                items = json.loads(inv.items_json)
                for it in items:
                    sku = it.get('sku') or 'SKU-GEN'
                    name = it.get('product_name') or 'Unnamed Product'
                    cat = it.get('category') or 'General'
                    qty = int(it.get('quantity', 0))
                    price = float(it.get('unit_price', 0.0))
                    tot = float(it.get('line_total', qty * price))

                    if sku not in item_sales:
                        item_sales[sku] = {
                            'name': name,
                            'category': cat,
                            'quantity': 0,
                            'unit_price': price,
                            'total_revenue': 0.0,
                            'orders_count': 0
                        }
                    item_sales[sku]['quantity'] += qty
                    item_sales[sku]['total_revenue'] += tot
                    item_sales[sku]['orders_count'] += 1
            except Exception:
                pass

    total_units_sold = sum(v['quantity'] for v in item_sales.values())
    total_inventory_items = sum(p.current_stock for p in products)
    low_stock_count = sum(1 for p in products if p.current_stock <= p.min_stock_threshold)
    avg_basket_val = (total_sales_inr / total_invoices_count) if total_invoices_count > 0 else 0.0

    # 3. KPI HIGHLIGHT CARDS
    kpi_card_data = [
        [
            Paragraph("<b>TOTAL REVENUE (GMV)</b>", subtitle_style),
            Paragraph("<b>ITEMS DISPATCHED / SOLD</b>", subtitle_style),
            Paragraph("<b>COMPLETED INVOICES</b>", subtitle_style),
            Paragraph("<b>STOCK HEALTH</b>", subtitle_style),
        ],
        [
            Paragraph(f"<font size=14 color='#0F172A'><b>₹{total_sales_inr:,.2f}</b></font>", body_style),
            Paragraph(f"<font size=14 color='#0F172A'><b>{total_units_sold:,} Units</b></font>", body_style),
            Paragraph(f"<font size=14 color='#0F172A'><b>{total_invoices_count:,} Receipts</b></font>", body_style),
            Paragraph(f"<font size=14 color='{('#DC2626' if low_stock_count > 0 else '#059669')}'><b>{low_stock_count} Alert{'s' if low_stock_count != 1 else ''}</b></font>", body_style),
        ],
        [
            Paragraph(f"Avg Basket: ₹{avg_basket_val:.2f}", subtitle_style),
            Paragraph(f"Across {len(item_sales)} distinct SKUs", subtitle_style),
            Paragraph("Autonomous Just-Walk-Out", subtitle_style),
            Paragraph(f"{total_inventory_items:,} units in warehouse", subtitle_style),
        ]
    ]

    t_kpi = Table(kpi_card_data, colWidths=[130, 134, 134, 134])
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_bg_light),
        ('BOX', (0, 0), (-1, -1), 0.75, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 14))

    # 4. SECTION: WHAT WAS SOLD (DETAILED ITEMS BREAKDOWN)
    story.append(Paragraph("1. Sold Items & Product Liquidation Breakdown", h1_style))
    story.append(Paragraph(
        "Clear itemized accounting of all goods picked and autonomously checked out through the vision tracking gates.",
        subtitle_style
    ))
    story.append(Spacer(1, 6))

    sold_header = [
        Paragraph("SKU", th_style),
        Paragraph("Product Description", th_style),
        Paragraph("Category", th_style),
        Paragraph("Qty Sold", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Unit Price (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Total Sales (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("% Volume", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
    ]

    sold_rows = [sold_header]
    sorted_sales = sorted(item_sales.items(), key=lambda x: x[1]['quantity'], reverse=True)

    if sorted_sales:
        for idx, (sku, data) in enumerate(sorted_sales):
            vol_pct = (data['quantity'] / total_units_sold * 100) if total_units_sold > 0 else 0
            bg = c_bg_light if idx % 2 == 1 else colors.white
            sold_rows.append([
                Paragraph(f"<b>{sku}</b>", td_style),
                Paragraph(data['name'], td_style),
                Paragraph(data['category'], td_style),
                Paragraph(f"<b>{data['quantity']}</b>", td_num_style),
                Paragraph(f"{data['unit_price']:,.2f}", td_num_style),
                Paragraph(f"<b>{data['total_revenue']:,.2f}</b>", td_num_style),
                Paragraph(f"{vol_pct:.1f}%", td_num_style),
            ])
        # Summary row
        sold_rows.append([
            Paragraph("<b>TOTALS</b>", body_bold),
            Paragraph(f"<b>{len(sorted_sales)} Product Lines</b>", body_bold),
            Paragraph("-", td_style),
            Paragraph(f"<b>{total_units_sold}</b>", ParagraphStyle('R_TB', parent=body_bold, alignment=2)),
            Paragraph("-", td_style),
            Paragraph(f"<b>₹{sum(d['total_revenue'] for d in item_sales.values()):,.2f}</b>", ParagraphStyle('R_TB', parent=body_bold, alignment=2)),
            Paragraph("<b>100.0%</b>", ParagraphStyle('R_TB', parent=body_bold, alignment=2)),
        ])
    else:
        sold_rows.append([
            Paragraph("No sales registered yet", td_style),
            Paragraph("-", td_style),
            Paragraph("-", td_style),
            Paragraph("0", td_num_style),
            Paragraph("0.00", td_num_style),
            Paragraph("0.00", td_num_style),
            Paragraph("0.0%", td_num_style),
        ])

    t_sold = Table(sold_rows, colWidths=[70, 162, 75, 45, 60, 70, 50], repeatRows=1)
    t_sold.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('BOX', (0, 0), (-1, -1), 0.75, c_border),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
    ]))
    for r_idx in range(1, len(sold_rows) - 1):
        if r_idx % 2 == 0:
            t_sold.setStyle(TableStyle([('BACKGROUND', (0, r_idx), (-1, r_idx), c_bg_light)]))

    story.append(t_sold)
    story.append(Spacer(1, 14))

    # 5. SECTION: COMPLETED INVOICES & DISPATCH LOG
    story.append(Paragraph("2. Recent Autonomous Invoices & Transaction Log", h1_style))
    story.append(Paragraph(
        "Chronological ledger of verified customer exit receipts, tax breakdown (18% GST), and payment settlements.",
        subtitle_style
    ))
    story.append(Spacer(1, 6))

    inv_header = [
        Paragraph("Invoice #", th_style),
        Paragraph("Track ID", th_style),
        Paragraph("Subtotal (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("GST 18% (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Total (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Status", ParagraphStyle('C_TH', parent=th_style, alignment=1)),
        Paragraph("Timestamp (UTC)", th_style),
    ]

    inv_rows = [inv_header]
    for idx, inv in enumerate(invoices[:25]):  # Up to 25 latest invoices
        inv_rows.append([
            Paragraph(f"<b>{inv.invoice_number}</b>", td_style),
            Paragraph(f"Shopper #{inv.customer_track_id}", td_style),
            Paragraph(f"{inv.subtotal:,.2f}", td_num_style),
            Paragraph(f"{inv.tax_amount:,.2f}", td_num_style),
            Paragraph(f"<b>{inv.total_amount:,.2f}</b>", td_num_style),
            Paragraph("PAID", td_badge_style),
            Paragraph(inv.created_at.strftime("%Y-%m-%d %H:%M") if inv.created_at else "-", td_style),
        ])

    t_inv = Table(inv_rows, colWidths=[105, 65, 65, 62, 65, 55, 115], repeatRows=1)
    t_inv.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_secondary),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (2, 1), (4, -1), 'RIGHT'),
        ('ALIGN', (5, 1), (5, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('BOX', (0, 0), (-1, -1), 0.75, c_border),
    ]))
    for r_idx in range(1, len(inv_rows)):
        if r_idx % 2 == 0:
            t_inv.setStyle(TableStyle([('BACKGROUND', (0, r_idx), (-1, r_idx), c_bg_light)]))

    story.append(t_inv)
    story.append(Spacer(1, 14))

    # 6. SECTION: WAREHOUSE INVENTORY AUDIT & STOCK HEALTH
    story.append(Paragraph("3. Warehouse Inventory & Shelf-Stock Valuation", h1_style))
    story.append(Paragraph(
        "Current physical inventory count, minimum safety threshold, and asset value across monitored warehouse zones.",
        subtitle_style
    ))
    story.append(Spacer(1, 6))

    prod_header = [
        Paragraph("SKU", th_style),
        Paragraph("Product Name", th_style),
        Paragraph("Category", th_style),
        Paragraph("Current Stock", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Min Reorder", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Unit Price (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Asset Value (₹)", ParagraphStyle('R_TH', parent=th_style, alignment=2)),
        Paragraph("Status", ParagraphStyle('C_TH', parent=th_style, alignment=1)),
    ]

    prod_rows = [prod_header]
    total_asset_val = 0.0

    for idx, p in enumerate(products):
        val = p.current_stock * p.unit_price
        total_asset_val += val
        is_low = p.current_stock <= p.min_stock_threshold
        status_text = "<font color='#DC2626'><b>LOW STOCK</b></font>" if is_low else "<font color='#059669'><b>OPTIMAL</b></font>"
        
        prod_rows.append([
            Paragraph(f"<b>{p.sku}</b>", td_style),
            Paragraph(p.name, td_style),
            Paragraph(p.category, td_style),
            Paragraph(f"<b>{p.current_stock}</b>", td_num_style),
            Paragraph(str(p.min_stock_threshold), td_num_style),
            Paragraph(f"{p.unit_price:,.2f}", td_num_style),
            Paragraph(f"{val:,.2f}", td_num_style),
            Paragraph(status_text, ParagraphStyle('StatusStyle', parent=td_style, alignment=1)),
        ])

    # Inventory summary row
    prod_rows.append([
        Paragraph("<b>TOTALS</b>", body_bold),
        Paragraph(f"<b>{len(products)} SKUs Tracked</b>", body_bold),
        Paragraph("-", td_style),
        Paragraph(f"<b>{total_inventory_items}</b>", ParagraphStyle('R_TB', parent=body_bold, alignment=2)),
        Paragraph("-", td_style),
        Paragraph("-", td_style),
        Paragraph(f"<b>₹{total_asset_val:,.2f}</b>", ParagraphStyle('R_TB', parent=body_bold, alignment=2)),
        Paragraph("AUDITED", ParagraphStyle('C_TB', parent=body_bold, alignment=1)),
    ])

    t_prod = Table(prod_rows, colWidths=[65, 140, 68, 48, 42, 54, 60, 55], repeatRows=1)
    t_prod.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_accent),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (3, 1), (6, -1), 'RIGHT'),
        ('ALIGN', (7, 1), (7, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('BOX', (0, 0), (-1, -1), 0.75, c_border),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
    ]))
    for r_idx in range(1, len(prod_rows) - 1):
        if r_idx % 2 == 0:
            t_prod.setStyle(TableStyle([('BACKGROUND', (0, r_idx), (-1, r_idx), c_bg_light)]))

    story.append(t_prod)

    # 7. BUILD DOCUMENT VIA NUMBERED CANVAS
    doc.build(story, canvasmaker=NumberedCanvas)
    pdf_data = buffer.getvalue()
    buffer.close()
    return pdf_data
