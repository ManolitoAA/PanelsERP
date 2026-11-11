from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from src.auth import create_access_token, hash_password
from src.db import get_session
from src.main import app
from src.models import Client, RoleEnum, User

@pytest.fixture
def order_env():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    SQLModel.metadata.create_all(engine)

    def override_get_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override_get_session

    with Session(engine) as session:
        com1 = User(id=1, email="com1@test.com", name="Comercial Uno", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL)
        jefe = User(id=2, email="jefe@test.com", name="Jefe Global", hashed_password=hash_password("pw"), role=RoleEnum.JEFE)
        admin = User(id=3, email="admin@test.com", name="Admin RRHH", hashed_password=hash_password("pw"), role=RoleEnum.ADMIN_RRHH)
        session.add_all([com1, jefe, admin])
        session.commit()

        client = Client(id=10, name="Hans", company="Bauhaus", contact_email="hans@bauhaus.de", commercial_id=1)
        session.add(client)
        session.commit()

    tc = TestClient(app)
    t_c1 = create_access_token({"sub": "com1@test.com", "role": RoleEnum.COMERCIAL.value})
    t_jefe = create_access_token({"sub": "jefe@test.com", "role": RoleEnum.JEFE.value})
    t_admin = create_access_token({"sub": "admin@test.com", "role": RoleEnum.ADMIN_RRHH.value})

    return {
        "client": tc,
        "c1_headers": {"Authorization": f"Bearer {t_c1}"},
        "jefe_headers": {"Authorization": f"Bearer {t_jefe}"},
        "admin_headers": {"Authorization": f"Bearer {t_admin}"},
        "client_id": 10,
    }

def test_create_order_with_margin_and_client_total_update(order_env):
    tc = order_env["client"]
    c1 = order_env["c1_headers"]
    client_id = order_env["client_id"]

    # Spec Case 1: 200 items @ 15€, cost 9€ => 3000€ billed, 1200€ net profit
    payload = {
        "client_id": client_id,
        "items": [
            {"product_name": "Perfil Polietileno 2m", "quantity": 200, "unit_price": 15.0, "unit_cost": 9.0}
        ]
    }
    res = tc.post("/api/orders", json=payload, headers=c1)
    assert res.status_code == 201
    data = res.json()
    assert data["total_billed"] == 3000.0
    assert data["net_profit"] == 1200.0

    # Verify client totals got updated
    c_res = tc.get(f"/api/clients/{client_id}", headers=c1)
    assert c_res.json()["total_billed"] == 3000.0
    assert c_res.json()["total_profit"] == 1200.0

def test_flexible_margin_input_order(order_env):
    tc = order_env["client"]
    c1 = order_env["c1_headers"]
    client_id = order_env["client_id"]

    # Commercial provides unit_cost and margin_pct (margen sobre precio de venta)
    payload = {
        "client_id": client_id,
        "items": [
            {"product_name": "Cantonera Foam", "quantity": 100, "unit_cost": 10.0, "margin_pct": 50.0}
        ]
    }
    res = tc.post("/api/orders", json=payload, headers=c1)
    assert res.status_code == 201
    data = res.json()
    # Cost = 10, Margin 50% of price => Price = 20 => Total = 2000, Profit = 1000
    assert data["total_billed"] == 2000.0
    assert data["net_profit"] == 1000.0

def test_billing_report_by_commercial(order_env):
    tc = order_env["client"]
    admin = order_env["admin_headers"]

    res = tc.get("/api/reports/billing", headers=admin)
    assert res.status_code == 200
    report = res.json()
    assert isinstance(report, list)

def test_admin_rrhh_cannot_create_orders(order_env):
    tc, admin = order_env["client"], order_env["admin_headers"]
    payload = {"client_id": order_env["client_id"], "items": [{"product_name": "X", "quantity": 1, "unit_price": 1.0, "unit_cost": 0.5}]}
    assert tc.post("/api/orders", json=payload, headers=admin).status_code == 403
    assert tc.get("/api/orders", headers=admin).status_code == 200

def test_jefe_owned_orders_appear_in_billing_report(order_env):
    tc, jefe = order_env["client"], order_env["jefe_headers"]
    client_id = tc.post("/api/clients", json={"name": "Ana", "company": "Budmax", "contact_email": "a@b.pl"},
                        headers=jefe).json()["id"]
    items = [{"product_name": "P", "quantity": 10, "unit_price": 15.0, "unit_cost": 9.0}]
    assert tc.post("/api/orders", json={"client_id": client_id, "items": items}, headers=jefe).status_code == 201
    assert tc.post("/api/orders", json={"client_id": order_env["client_id"], "items": items},
                   headers=order_env["c1_headers"]).status_code == 201

    report = tc.get("/api/reports/billing", headers=order_env["admin_headers"]).json()
    by_name = {r["commercial_name"]: r for r in report}
    assert by_name["Jefe Global"]["total_billed"] == 150.0
    assert by_name["Comercial Uno"]["order_count"] == 1
    stats = tc.get("/api/stats", headers=order_env["admin_headers"]).json()["totals"]
    assert sum(r["total_billed"] for r in report) == stats["billed"]

def test_billing_report_lists_commercial_without_orders(order_env):
    report = order_env["client"].get("/api/reports/billing", headers=order_env["admin_headers"]).json()
    assert report == [{"commercial_id": 1, "commercial_name": "Comercial Uno",
                       "total_billed": 0.0, "total_profit": 0.0, "order_count": 0}]

@pytest.mark.parametrize("bad", [
    {"quantity": 0}, {"quantity": -5}, {"unit_price": -15.0}, {"unit_cost": -1.0},
    {"unit_price": None, "margin_pct": 100.0}, {"unit_cost": None},
])
def test_invalid_order_lines_are_rejected(order_env, bad):
    line = {"product_name": "P", "quantity": 10, "unit_price": 15.0, "unit_cost": 9.0, **bad}
    line = {k: v for k, v in line.items() if v is not None}
    res = order_env["client"].post("/api/orders", json={"client_id": order_env["client_id"], "items": [line]},
                                   headers=order_env["c1_headers"])
    assert res.status_code == 422
