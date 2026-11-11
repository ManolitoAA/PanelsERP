"""API de mensajerías y del envío de pedidos."""
from tests.test_orders import order_env  # noqa: F401  (fixture con comercial, jefe y admin)

SEUR = {"name": "SEUR", "support_phone": "900 000 000", "tracking_url": "https://seur.example/t?id={tracking}"}


def _order(tc, headers, client_id):
    payload = {"client_id": client_id, "items": [{"product_name": "P", "quantity": 1, "unit_price": 10, "unit_cost": 5}]}
    return tc.post("/api/orders", json=payload, headers=headers).json()


def test_create_list_and_update_courier(order_env):
    tc, c1 = order_env["client"], order_env["c1_headers"]
    res = tc.post("/api/couriers", json=SEUR, headers=c1)
    assert res.status_code == 201
    cid = res.json()["id"]
    assert tc.put(f"/api/couriers/{cid}", json={"support_phone": "911"}, headers=c1).json()["support_phone"] == "911"
    assert [c["name"] for c in tc.get("/api/couriers", headers=order_env["admin_headers"]).json()] == ["SEUR"]


def test_courier_validation_and_roles(order_env):
    tc = order_env["client"]
    assert tc.post("/api/couriers", json={**SEUR, "tracking_url": "javascript:x"}, headers=order_env["c1_headers"]).status_code == 422
    assert tc.post("/api/couriers", json={"name": " "}, headers=order_env["c1_headers"]).status_code == 422
    assert tc.post("/api/couriers", json=SEUR, headers=order_env["admin_headers"]).status_code == 403
    assert tc.put("/api/couriers/999", json={"name": "X"}, headers=order_env["jefe_headers"]).status_code == 404


def test_set_shipping_and_list_shows_tracking(order_env):
    tc, c1 = order_env["client"], order_env["c1_headers"]
    order = _order(tc, c1, order_env["client_id"])
    assert order["status"] == "en curso"
    cid = tc.post("/api/couriers", json=SEUR, headers=c1).json()["id"]
    res = tc.patch(f"/api/orders/{order['id']}/shipping", json={"courier_id": cid, "tracking_code": "AB 1"}, headers=c1)
    assert res.status_code == 200
    assert res.json()["status"] == "enviado"
    listed = tc.get("/api/orders", headers=order_env["jefe_headers"]).json()[0]
    assert listed["courier_name"] == "SEUR" and listed["courier_phone"] == "900 000 000"
    assert listed["tracking_url"] == "https://seur.example/t?id=AB%201"


def test_shipping_errors_and_roles(order_env):
    tc, c1 = order_env["client"], order_env["c1_headers"]
    order = _order(tc, c1, order_env["client_id"])
    url = f"/api/orders/{order['id']}/shipping"
    assert tc.patch(url, json={"status": "enviado"}, headers=c1).status_code == 422
    assert tc.patch(url, json={"tracking_code": "X"}, headers=order_env["admin_headers"]).status_code == 403
    assert tc.patch("/api/orders/999/shipping", json={}, headers=c1).status_code == 404
