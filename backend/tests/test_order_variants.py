"""Pedidos que eligen una variante del catálogo."""
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select
from src.auth import create_access_token, hash_password
from src.catalog_models import Product, ProductVariant
from src.db import get_session
from src.main import app
from src.models import Client, OrderItem, RoleEnum, User
from src.services.catalog_service import fill_from_variant
from src.services.order_service import OrderError
from src.services.profit_calculator import ItemCalculationInput


@pytest.fixture
def env():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override
    with Session(engine) as s:
        s.add(User(id=1, email="c1@t", name="C1", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL))
        s.add(Client(id=10, name="Hans", company="Bauhaus", contact_email="h@b.de", commercial_id=1))
        p = Product(name="BOLARDO PCK", table_headers=["Ø", "Altura"], created_by=1)
        s.add(p)
        s.commit()
        s.add(ProductVariant(id=7, product_id=p.id, dimensions=["100", "430"], unit_price=15.0, unit_cost=9.0, created_by=1))
        s.add(ProductVariant(id=8, product_id=p.id, dimensions=["120", "430"], created_by=1))
        s.commit()
    token = create_access_token({"sub": "c1@t", "role": RoleEnum.COMERCIAL.value})
    yield TestClient(app), {"Authorization": f"Bearer {token}"}, engine
    app.dependency_overrides.clear()


def post_order(tc, h, **line):
    return tc.post("/api/orders", headers=h, json={"client_id": 10, "items": [{"product_name": "Bolardo", "quantity": 200, **line}]})


def test_order_line_takes_price_and_cost_from_variant(env):
    tc, h, engine = env
    r = post_order(tc, h, variant_id=7)
    assert r.status_code == 201
    assert r.json()["total_billed"] == 3000.0 and r.json()["net_profit"] == 1200.0
    with Session(engine) as s:
        assert s.exec(select(OrderItem)).one().variant_id == 7


def test_order_line_keeps_manual_price_over_catalog(env):
    tc, h, _ = env
    assert post_order(tc, h, variant_id=7, unit_price=16.0).json()["total_billed"] == 3200.0


def test_order_unknown_variant_is_404(env):
    tc, h, _ = env
    assert post_order(tc, h, variant_id=999, unit_cost=1).status_code == 404


def test_order_variant_without_cost_is_422(env):
    tc, h, _ = env
    r = post_order(tc, h, variant_id=8, unit_price=10)
    assert r.status_code == 422 and "coste" in r.json()["detail"]


def test_order_without_variant_still_requires_cost(env):
    tc, h, _ = env
    assert post_order(tc, h, unit_price=10).status_code == 422


def test_fill_from_variant_without_id_returns_same(env):
    *_, engine = env
    item = ItemCalculationInput(product_name="x", unit_cost=1)
    with Session(engine) as s:
        assert fill_from_variant(s, item) == item
        with pytest.raises(OrderError):
            fill_from_variant(s, ItemCalculationInput(product_name="x", variant_id=999))


def test_order_margin_wins_over_catalog_price(env):
    tc, h, _ = env
    r = post_order(tc, h, variant_id=7, margin_pct=50)
    assert r.status_code == 201 and r.json()["total_billed"] == 3600.0  # 9 / (1 - 0.5) = 18 €
