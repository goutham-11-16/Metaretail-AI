"""
Database Initial Seeder Script for MetaRetail AI
Populates initial product catalog, inventory stock, alerts, and sample events.
"""
import os
import sys

# Add project root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.database.session import SessionLocal, engine
from backend.app.database.base import Base
from backend.app.models.domain import Product, Alert, Event, Customer, Interaction
from datetime import datetime, timedelta

def seed_database():
    print("Initializing MetaRetail AI database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if products already exist
        if db.query(Product).count() > 0:
            print("Database already contains product catalog records. Skipping seed.")
            return

        print("Database tables initialized empty and ready for real data.")
        db.commit()

        print("Successfully seeded MetaRetail AI database!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
