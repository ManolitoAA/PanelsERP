from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from src.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)
from src.db import get_session
from src.models import RoleEnum, User

@pytest.fixture
def auth_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    SQLModel.metadata.create_all(engine)

    app = FastAPI()

    def override_get_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override_get_session

    @app.get("/guarded/jefe")
    def jefe_only(user: User = Depends(require_roles([RoleEnum.JEFE]))):
        return {"status": "ok", "user": user.email}

    @app.get("/guarded/all")
    def all_roles(user: User = Depends(get_current_user)):
        return {"status": "ok", "role": user.role}

    # Add initial test users
    with Session(engine) as session:
        session.add(User(email="jefe@test.com", name="El Jefe", hashed_password=hash_password("admin123"), role=RoleEnum.JEFE))
        session.add(User(email="comercial@test.com", name="Comercial 1", hashed_password=hash_password("com123"), role=RoleEnum.COMERCIAL))
        session.commit()

    return TestClient(app)

def test_password_hash_and_token():
    pw = "secret123"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)

    token = create_access_token({"sub": "test@panelserp.com", "role": "comercial"})
    assert isinstance(token, str)

def test_rbac_dependency_guards(auth_client):
    jefe_token = create_access_token({"sub": "jefe@test.com", "role": RoleEnum.JEFE.value})
    comercial_token = create_access_token({"sub": "comercial@test.com", "role": RoleEnum.COMERCIAL.value})

    # Jefe accessing jefe_only
    res = auth_client.get("/guarded/jefe", headers={"Authorization": f"Bearer {jefe_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # Comercial accessing jefe_only -> 403 Forbidden
    res_forbidden = auth_client.get("/guarded/jefe", headers={"Authorization": f"Bearer {comercial_token}"})
    assert res_forbidden.status_code == 403

    # Missing token -> 401 Unauthorized
    res_unauth = auth_client.get("/guarded/all")
    assert res_unauth.status_code == 401
