from pathlib import Path
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from src.auth import create_access_token, hash_password
from src.db import get_session
from src.main import app
from src.models import RoleEnum, User
from src.routers import catalog as catalog_router

FIXTURE = Path(__file__).parent / "fixtures" / "catalog_draft.json"
PDF = b"%PDF-1.4 minimal"


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("GEMINI_FAKE_CATALOG", str(FIXTURE))
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override
    with Session(engine) as s:
        for uid, email, role in ((1, "c1@t", RoleEnum.COMERCIAL), (2, "c2@t", RoleEnum.COMERCIAL),
                                 (3, "j@t", RoleEnum.JEFE), (4, "r@t", RoleEnum.ADMIN_RRHH)):
            s.add(User(id=uid, email=email, name=email, hashed_password=hash_password("pw"), role=role))
        s.commit()
    headers = {k: {"Authorization": f"Bearer {create_access_token({'sub': e, 'role': r.value})}"}
               for k, e, r in (("c1", "c1@t", RoleEnum.COMERCIAL), ("c2", "c2@t", RoleEnum.COMERCIAL),
                               ("jefe", "j@t", RoleEnum.JEFE), ("rrhh", "r@t", RoleEnum.ADMIN_RRHH))}
    yield TestClient(app), headers
    app.dependency_overrides.clear()


def upload(tc, h, data=PDF, ctype="application/pdf"):
    return tc.post("/api/catalog/import", headers=h, files={"file": ("c.pdf", data, ctype)})


def import_all(tc, h):
    preview = upload(tc, h).json()
    return tc.post("/api/catalog/import/confirm", headers=h, json=preview)


def test_import_returns_preview_without_saving(api):
    tc, h = api
    r = upload(tc, h["c1"])
    assert r.status_code == 200
    assert [v["status"] for v in r.json()["products"][0]["variants"]] == ["nueva", "nueva"]
    assert tc.get("/api/products", headers=h["c1"]).json() == []


def test_import_rejects_non_pdf_and_big_files(api, monkeypatch):
    tc, h = api
    called = []
    monkeypatch.setattr(catalog_router, "parse_catalog_from_env", lambda pdf: called.append(1))
    assert upload(tc, h["c1"], data=b"hola").status_code == 422
    assert upload(tc, h["c1"], ctype="text/plain").status_code == 422
    assert upload(tc, h["c1"], data=b"%PDF" + b"0" * (20 * 1024 * 1024)).status_code == 422
    assert called == []


def test_import_gemini_failure_is_502(api, monkeypatch):
    tc, h = api

    def boom(pdf):
        raise RuntimeError("503 UNAVAILABLE")

    monkeypatch.setattr(catalog_router, "parse_catalog_from_env", boom)
    r = upload(tc, h["c1"])
    assert r.status_code == 502 and "Gemini" in r.json()["detail"]


def test_confirm_saves_and_lists(api):
    tc, h = api
    r = import_all(tc, h["c1"])
    assert r.status_code == 200 and r.json() == {"created": 2, "overwritten": 0, "kept": 0, "discarded": 0}
    products = tc.get("/api/products?q=bolardo 100", headers=h["c2"]).json()
    assert len(products) == 1 and [v["dimensions"][:2] for v in products[0]["variants"]] == [["100", "430"]]
    assert len(tc.get("/api/products?q=BOLARDO", headers=h["c2"]).json()[0]["variants"]) == 2


def test_admin_rrhh_can_list_but_not_import_or_patch(api):
    tc, h = api
    import_all(tc, h["c1"])
    assert tc.get("/api/products", headers=h["rrhh"]).status_code == 200
    vid = tc.get("/api/products", headers=h["rrhh"]).json()[0]["variants"][0]["id"]
    assert upload(tc, h["rrhh"]).status_code == 403
    preview = upload(tc, h["c1"]).json()
    assert tc.post("/api/catalog/import/confirm", headers=h["rrhh"], json=preview).status_code == 403
    assert tc.patch(f"/api/variants/{vid}", headers=h["rrhh"], json={"unit_price": 1}).status_code == 403


def test_confirm_overwrite_foreign_variant_is_403(api):
    tc, h = api
    import_all(tc, h["c1"])
    preview = upload(tc, h["c2"]).json()
    v = preview["products"][0]["variants"][0]
    assert v["status"] == "conflicto" and "sobrescribir" not in v["allowed_actions"]
    v["action"] = "sobrescribir"
    preview["products"][0]["variants"][1]["action"] = "mantener"
    assert tc.post("/api/catalog/import/confirm", headers=h["c2"], json=preview).status_code == 403


def test_confirm_stale_preview_is_409_with_new_preview(api):
    tc, h = api
    preview = upload(tc, h["c2"]).json()
    import_all(tc, h["c1"])
    r = tc.post("/api/catalog/import/confirm", headers=h["c2"], json=preview)
    assert r.status_code == 409
    assert r.json()["detail"]["products"][0]["variants"][0]["status"] == "conflicto"


def test_patch_variant_only_author_or_jefe(api):
    tc, h = api
    import_all(tc, h["c1"])
    vid = tc.get("/api/products", headers=h["c1"]).json()[0]["variants"][0]["id"]
    r = tc.patch(f"/api/variants/{vid}", headers=h["c1"], json={"unit_price": 15, "unit_cost": 9, "reference": "BP-70"})
    assert r.status_code == 200 and r.json()["unit_price"] == 15 and r.json()["reference"] == "BP-70"
    assert tc.patch(f"/api/variants/{vid}", headers=h["c2"], json={"unit_price": 1}).status_code == 403
    assert tc.patch(f"/api/variants/{vid}", headers=h["jefe"], json={"unit_cost": 8}).json()["unit_cost"] == 8
    assert tc.patch(f"/api/variants/{vid}", headers=h["jefe"], json={"unit_cost": -1}).status_code == 422
    assert tc.patch("/api/variants/999", headers=h["jefe"], json={"unit_cost": 1}).status_code == 404
