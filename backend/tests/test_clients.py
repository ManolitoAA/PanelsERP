from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from src.auth import create_access_token, hash_password
from src.db import get_session
from src.main import app
from src.models import RoleEnum, User

@pytest.fixture
def client_env():
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
        u1 = User(id=1, email="com1@test.com", name="Comercial Uno", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL)
        u2 = User(id=2, email="com2@test.com", name="Comercial Dos", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL)
        jefe = User(id=3, email="jefe@test.com", name="Jefe Global", hashed_password=hash_password("pw"), role=RoleEnum.JEFE)
        admin = User(id=4, email="admin@test.com", name="Admin RRHH", hashed_password=hash_password("pw"), role=RoleEnum.ADMIN_RRHH)
        session.add_all([u1, u2, jefe, admin])
        session.commit()

    tc = TestClient(app)

    token_c1 = create_access_token({"sub": "com1@test.com", "role": RoleEnum.COMERCIAL.value})
    token_c2 = create_access_token({"sub": "com2@test.com", "role": RoleEnum.COMERCIAL.value})
    token_jefe = create_access_token({"sub": "jefe@test.com", "role": RoleEnum.JEFE.value})
    token_admin = create_access_token({"sub": "admin@test.com", "role": RoleEnum.ADMIN_RRHH.value})

    return {
        "client": tc,
        "c1_headers": {"Authorization": f"Bearer {token_c1}"},
        "c2_headers": {"Authorization": f"Bearer {token_c2}"},
        "jefe_headers": {"Authorization": f"Bearer {token_jefe}"},
        "admin_headers": {"Authorization": f"Bearer {token_admin}"},
    }

def test_commercial_isolation_and_rbac(client_env):
    tc = client_env["client"]
    c1 = client_env["c1_headers"]
    c2 = client_env["c2_headers"]
    jefe = client_env["jefe_headers"]
    admin = client_env["admin_headers"]

    # 1. Commercial 1 creates a client
    create_res = tc.post("/api/clients", json={
        "name": "Hans Gruber",
        "company": "Bauhaus AG",
        "contact_email": "hans@bauhaus.de"
    }, headers=c1)
    assert create_res.status_code == 201
    client_data = create_res.json()
    assert client_data["commercial_id"] == 1
    client_id = client_data["id"]

    # 2. Commercial 2 lists clients -> must NOT contain Commercial 1's client
    res_c2 = tc.get("/api/clients", headers=c2)
    assert res_c2.status_code == 200
    assert not any(c["id"] == client_id for c in res_c2.json())

    # 3. Commercial 2 tries to access Commercial 1's client directly -> 403 Forbidden
    res_direct = tc.get(f"/api/clients/{client_id}", headers=c2)
    assert res_direct.status_code == 403

    # 4. Boss lists clients -> can see it
    res_jefe = tc.get("/api/clients", headers=jefe)
    assert res_jefe.status_code == 200
    assert any(c["id"] == client_id for c in res_jefe.json())

    # 5. Admin lists clients -> can see it with commercial_id
    res_admin = tc.get("/api/clients", headers=admin)
    assert res_admin.status_code == 200
    assert any(c["id"] == client_id for c in res_admin.json())

def _new(tc, h, name="Hans"):
    return tc.post("/api/clients", json={"name": name, "company": "Bauhaus", "contact_email": "h@b.de"}, headers=h)

def test_new_client_defaults_to_lead(client_env):
    res = _new(client_env["client"], client_env["c1_headers"])
    assert res.status_code == 201
    assert res.json()["status"] == "lead"

def test_filter_clients_by_status(client_env):
    tc, h = client_env["client"], client_env["c1_headers"]
    a = _new(tc, h, "A").json()["id"]
    _new(tc, h, "B")
    assert tc.put(f"/api/clients/{a}", json={"status": "cliente"}, headers=h).status_code == 200
    res = tc.get("/api/clients?status=cliente", headers=h)
    assert [c["id"] for c in res.json()] == [a]
    assert len(tc.get("/api/clients?status=lead", headers=h).json()) == 1

def test_invalid_status_rejected(client_env):
    tc, h = client_env["client"], client_env["c1_headers"]
    bad = tc.post("/api/clients", json={"name": "X", "company": "Y", "contact_email": "x@y.z", "status": "foo"}, headers=h)
    assert bad.status_code == 422
    assert tc.get("/api/clients?status=foo", headers=h).status_code == 422
