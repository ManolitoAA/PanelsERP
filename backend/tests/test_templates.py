from unittest.mock import patch
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from src.auth import create_access_token, hash_password
from src.db import get_session
from src.main import app
from src.models import RoleEnum, User

@pytest.fixture
def tpl_client():
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
        u = User(id=1, email="com@test.com", name="Comercial", hashed_password=hash_password("pw"), role=RoleEnum.COMERCIAL)
        session.add(u)
        session.commit()

    tc = TestClient(app)
    token = create_access_token({"sub": "com@test.com", "role": RoleEnum.COMERCIAL.value})
    headers = {"Authorization": f"Bearer {token}"}
    return tc, headers

def test_supplier_crud(tpl_client):
    tc, headers = tpl_client
    res = tc.post("/api/suppliers", json={
        "name": "Plásticos del Mediterráneo",
        "contact_info": "ventas@plasticosmed.com | +34 961 000 000",
        "notes": "Proveedor habitual de bobinas de polietileno expandido"
    }, headers=headers)
    assert res.status_code == 201
    s_data = res.json()
    assert s_data["name"] == "Plásticos del Mediterráneo"

    list_res = tc.get("/api/suppliers", headers=headers)
    assert list_res.status_code == 200
    assert any(s["id"] == s_data["id"] for s in list_res.json())

def test_render_template_with_variables(tpl_client):
    tc, headers = tpl_client
    tpl = tc.post("/api/templates", json={
        "name": "Presupuesto Exportacion",
        "subject": "Oferta para {{ cliente.empresa }}",
        "body_content": "Hola {{ cliente.nombre }}, su pedido asciende a {{ pedido.total_billed }} EUR."
    }, headers=headers).json()

    render_req = {
        "context": {
            "cliente": {"nombre": "Hans", "empresa": "Bauhaus"},
            "pedido": {"total_billed": 3000.0}
        }
    }
    res = tc.post(f"/api/templates/{tpl['id']}/render", json=render_req, headers=headers)
    assert res.status_code == 200
    assert res.json()["rendered_subject"] == "Oferta para Bauhaus"
    assert res.json()["rendered_body"] == "Hola Hans, su pedido asciende a 3000.0 EUR."

@patch("src.services.mailer.send_smtp_email")
def test_send_email_mock(mock_send, tpl_client):
    tc, headers = tpl_client
    tpl = tc.post("/api/templates", json={
        "name": "Notificacion",
        "subject": "Test Subj",
        "body_content": "Test Body"
    }, headers=headers).json()

    res = tc.post(f"/api/templates/{tpl['id']}/send", json={
        "to_email": "cliente@europa.de",
        "context": {}
    }, headers=headers)
    assert res.status_code == 202
    assert res.json()["status"] == "enqueued"

def _render(tc, headers, body):
    t = tc.post("/api/templates", json={"name": "T", "subject": "S", "body_content": body}, headers=headers).json()
    return tc.post(f"/api/templates/{t['id']}/render", json={"context": {}}, headers=headers)

def test_template_sandbox_blocks_attribute_escape(tpl_client):
    tc, headers = tpl_client
    res = _render(tc, headers, "{{ ''.__class__.__mro__[1].__subclasses__() }}")
    assert res.status_code == 422
    assert "unsafe" in res.text

def test_template_runtime_error_is_422_not_500(tpl_client):
    tc, headers = tpl_client
    assert _render(tc, headers, "{{ 1/0 }}").status_code == 422
