"""Envío de pedidos: lógica del servicio (estados, permisos, enlace)."""
import pytest
from src.models import Client, Courier, Order, RoleEnum, User
from src.services.order_service import OrderError
from src.services.shipping import check_tracking_url, tracking_link, update_shipping


@pytest.fixture
def env(db_session):
    com1 = User(id=1, email="a@t", name="A", hashed_password="x", role=RoleEnum.COMERCIAL)
    com2 = User(id=2, email="b@t", name="B", hashed_password="x", role=RoleEnum.COMERCIAL)
    jefe = User(id=3, email="j@t", name="J", hashed_password="x", role=RoleEnum.JEFE)
    db_session.add_all([com1, com2, jefe,
                        Client(id=10, name="H", company="Bauhaus", contact_email="h@b", commercial_id=1),
                        Courier(id=5, name="SEUR", support_phone="900 000 000",
                                tracking_url="https://seur.example/track?id={tracking}"),
                        Order(id=100, client_id=10, commercial_id=1),
                        Order(id=101, client_id=10, commercial_id=1, status="completado")])
    db_session.commit()
    return {"s": db_session, "com1": com1, "com2": com2, "jefe": jefe}


def test_new_order_starts_in_progress(env):
    assert env["s"].get(Order, 100).status == "en curso"


def test_courier_and_tracking_mark_order_as_sent(env):
    order = update_shipping(env["s"], env["com1"], 100, {"courier_id": 5, "tracking_code": " AB123 "})
    assert (order.status, order.courier_id, order.tracking_code) == ("enviado", 5, "AB123")


def test_only_courier_keeps_order_in_progress(env):
    assert update_shipping(env["s"], env["com1"], 100, {"courier_id": 5}).status == "en curso"


def test_mark_delivered_and_back(env):
    update_shipping(env["s"], env["com1"], 100, {"courier_id": 5, "tracking_code": "AB1"})
    assert update_shipping(env["s"], env["com1"], 100, {"status": "entregado"}).status == "entregado"
    assert update_shipping(env["s"], env["com1"], 100, {"status": "en curso"}).status == "en curso"


def test_sent_needs_courier_and_tracking(env):
    with pytest.raises(OrderError) as e:
        update_shipping(env["s"], env["com1"], 100, {"status": "enviado", "courier_id": 5})
    assert e.value.status_code == 422
    assert env["s"].get(Order, 100).courier_id is None  # sin cambios a medias


def test_clearing_tracking_of_sent_order_is_rejected(env):
    update_shipping(env["s"], env["com1"], 100, {"courier_id": 5, "tracking_code": "AB1"})
    with pytest.raises(OrderError):
        update_shipping(env["s"], env["com1"], 100, {"tracking_code": ""})


def test_invalid_status(env):
    with pytest.raises(OrderError) as e:
        update_shipping(env["s"], env["com1"], 100, {"status": "perdido"})
    assert e.value.status_code == 422


def test_legacy_order_keeps_status_but_accepts_tracking(env):
    with pytest.raises(OrderError) as e:
        update_shipping(env["s"], env["com1"], 101, {"status": "enviado"})
    assert e.value.status_code == 400
    order = update_shipping(env["s"], env["com1"], 101, {"courier_id": 5, "tracking_code": "X1"})
    assert (order.status, order.tracking_code) == ("completado", "X1")


def test_unknown_courier_and_order(env):
    with pytest.raises(OrderError) as e:
        update_shipping(env["s"], env["com1"], 100, {"courier_id": 999})
    assert e.value.status_code == 404
    with pytest.raises(OrderError) as e:
        update_shipping(env["s"], env["com1"], 999, {})
    assert e.value.status_code == 404


def test_other_commercial_cannot_edit_but_boss_can(env):
    with pytest.raises(OrderError) as e:
        update_shipping(env["s"], env["com2"], 100, {"tracking_code": "X"})
    assert e.value.status_code == 403
    assert update_shipping(env["s"], env["jefe"], 100, {"tracking_code": "X"}).tracking_code == "X"


def test_tracking_link():
    c = Courier(name="DHL", tracking_url="https://dhl.example/t?n={tracking}")
    assert tracking_link(c, "A B/1&x") == "https://dhl.example/t?n=A%20B%2F1%26x"
    assert tracking_link(c, None) is None
    assert tracking_link(Courier(name="X", tracking_url="https://x.example"), "A1") is None
    assert tracking_link(None, "A1") is None


def test_check_tracking_url():
    assert check_tracking_url("  ") is None
    assert check_tracking_url("https://x.example/{tracking}") == "https://x.example/{tracking}"
    with pytest.raises(OrderError):
        check_tracking_url("javascript:alert(1)")
