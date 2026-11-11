from sqlalchemy import inspect
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine
from src.catalog_models import Product, ProductVariant
from src.db import add_missing_columns


def test_variant_persists_dimensions_json(db_session):
    p = Product(name="BOLARDO PCK", family="PCK", table_headers=["Ø Diámetro", "Altura (mm)"], created_by=1)
    db_session.add(p)
    db_session.commit()
    v = ProductVariant(product_id=p.id, dimensions=["100", "430"], usage="carretilla", created_by=1)
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    db_session.refresh(p)
    assert v.dimensions == ["100", "430"] and v.unit_price is None
    assert p.table_headers == ["Ø Diámetro", "Altura (mm)"]


def test_add_missing_columns_upgrades_old_orderitem_table():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    with engine.begin() as c:
        c.exec_driver_sql("CREATE TABLE orderitem (id INTEGER PRIMARY KEY, order_id INTEGER, product_name VARCHAR,"
                          " quantity INTEGER, unit_price FLOAT, unit_cost FLOAT)")
    add_missing_columns(engine)
    add_missing_columns(engine)  # idempotente
    assert "variant_id" in {col["name"] for col in inspect(engine).get_columns("orderitem")}


def test_add_missing_columns_without_table_does_nothing():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    add_missing_columns(engine)
    assert not inspect(engine).has_table("orderitem")
