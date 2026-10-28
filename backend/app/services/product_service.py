import os
import shutil
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.models.domain import Product, ProductImage
import logging

logger = logging.getLogger("metaretail.services.product")

class ProductService:
    def __init__(self, upload_dir="uploads/products"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    async def lookup_barcode(self, barcode: str) -> dict:
        """Look up product info from Open Food Facts API"""
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    product = data.get("product", {})
                    return {
                        "name": product.get("product_name"),
                        "category": product.get("categories", "").split(",")[0] if product.get("categories") else "General",
                        "brand": product.get("brands"),
                        "image_url": product.get("image_url")
                    }
        except Exception as e:
            logger.error(f"Barcode lookup failed: {e}")
        return None
        
    def save_product_image(self, db: Session, product_id: int, image_data: bytes, angle: str = "front") -> ProductImage:
        """Save a product image to disk and create DB record"""
        product_dir = os.path.join(self.upload_dir, str(product_id))
        os.makedirs(product_dir, exist_ok=True)
        
        filename = f"{angle}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        file_path = os.path.join(product_dir, filename)
        
        with open(file_path, "wb") as f:
            f.write(image_data)
            
        img_record = ProductImage(
            product_id=product_id,
            image_path=file_path,
            angle=angle,
            is_reference=True
        )
        db.add(img_record)
        db.commit()
        db.refresh(img_record)
        return img_record
    
    def get_product_images(self, db: Session, product_id: int) -> list:
        """Get all reference images for a product"""
        return db.query(ProductImage).filter(ProductImage.product_id == product_id).all()
        
    def delete_product(self, db: Session, product_id: int):
        """Delete product and all its images"""
        product_dir = os.path.join(self.upload_dir, str(product_id))
        if os.path.exists(product_dir):
            shutil.rmtree(product_dir)
            
        db.query(ProductImage).filter(ProductImage.product_id == product_id).delete()
        db.query(Product).filter(Product.id == product_id).delete()
        db.commit()
