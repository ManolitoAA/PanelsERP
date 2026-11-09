from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session
from src.auth import create_access_token, hash_password
from src.db import get_session
from src.main import app
from src.models import Order, RoleEnum, User
from src.services.stats import compute_stats

def _order(cid, billed, profit, y, m, d):
    return Order(client_id=1, commercial_id=cid, total_billed=billed, net_profit=profit,
                 created_at=datetime(y, m, d, 10, tzinfo=timezone.utc))

@pytest.fixture
def env(db_engine, db_session):
    db_session.add_all([
        User(id=1, email="c1@t.com", name="C1", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL),
        User(id=2, email="c2@t.com", name="C2", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL),
        User(id=3, email="jefe@t.com", name="Jefe", hashed_password=hash_password("pw"), role=RoleEnum.JEFE),
        User(id=4, email="adm@t.com", name="Adm", hashed_password=hash_password("pw"), role=RoleEnum.ADMIN_RRHH),
    ])
    db_session.add_all([
        _order(1, 3000, 1200, 2026, 1, 5), _order(1, 1500, 500, 2026, 1, 5),
        _order(1, 100, 10, 2026, 2, 1), _order(2, 999, 99, 2026, 1, 7),
    ])
    db_session.commit()

    def override():
        with Session(db_engine) as s:
            yield s
    app.dependency_overrides[get_session] = override
    h = lambda e, r: {"Authorization": "Bearer " + create_access_token({"sub": e, "role": r.value})}
    yield {"tc": TestClient(app), "c1": h("c1@t.com", RoleEnum.COMERCIAL),
           "jefe": h("jefe@t.com", RoleEnum.JEFE), "adm": h("adm@t.com", RoleEnum.ADMIN_RRHH),
           "session": db_session}
    app.dependency_overrides.clear()

def test_monthly_and_daily_aggregation(env):
    s = compute_stats(env["session"], 1)
    assert [m.month for m in s.monthly] == ["2026-01", "2026-02"]
    assert (s.monthly[0].billed, s.monthly[0].profit) == (4500.0, 1700.0)
    assert [(d.day, d.sales) for d in s.daily] == [("2026-01-05", 2), ("2026-02-01", 1)]
    assert (s.totals.billed, s.totals.profit, s.totals.orders) == (4600.0, 1710.0, 3)

def test_empty_user_returns_zeros(env):
    s = compute_stats(env["session"], 99)
    assert s.monthly == [] and s.daily == [] and s.totals.orders == 0 and s.totals.billed == 0

def test_commercial_gets_only_own_and_cannot_request_other(env):
    tc = env["tc"]
    assert tc.get("/api/stats", headers=env["c1"]).json()["totals"]["orders"] == 3
    assert tc.get("/api/stats?commercial_id=1", headers=env["c1"]).status_code == 200
    assert tc.get("/api/stats?commercial_id=2", headers=env["c1"]).status_code == 403

def test_jefe_sees_all_and_can_filter(env):
    tc = env["tc"]
    assert tc.get("/api/stats", headers=env["jefe"]).json()["totals"]["orders"] == 4
    assert tc.get("/api/stats?commercial_id=2", headers=env["jefe"]).json()["totals"]["orders"] == 1

def test_admin_rrhh_can_read(env):
    assert env["tc"].get("/api/stats", headers=env["adm"]).status_code == 200

def test_requires_auth(env):
    assert env["tc"].get("/api/stats").status_code == 401
