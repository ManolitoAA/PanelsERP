from datetime import datetime, timezone
from sqlmodel import select
from src.models import Client, Order, RoleEnum, Supplier, Template, User
from src.auth import hash_password
from src.seed import seed
from src.demo_data import seed_demo
from src.services.stats import compute_stats

TODAY = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)

def _prepared(db_session):
    seed(db_session)
    seed_demo(db_session, today=TODAY)

def _com(db_session, email):
    return db_session.exec(select(User).where(User.email == email)).one()

def test_demo_data_has_clients_suppliers_templates(db_session):
    _prepared(db_session)
    clients = db_session.exec(select(Client)).all()
    assert {c.status for c in clients} == {"lead", "cliente"}
    assert {c.commercial_id for c in clients} == {_com(db_session, "comercial1@panelserp.com").id, _com(db_session, "comercial2@panelserp.com").id}
    assert len(db_session.exec(select(Supplier)).all()) >= 3
    assert len(db_session.exec(select(Template)).all()) >= 3

def test_client_totals_match_their_orders(db_session):
    _prepared(db_session)
    for c in db_session.exec(select(Client)).all():
        orders = db_session.exec(select(Order).where(Order.client_id == c.id)).all()
        assert round(sum(o.total_billed for o in orders), 2) == c.total_billed
        assert round(sum(o.net_profit for o in orders), 2) == c.total_profit
        assert all(o.commercial_id == c.commercial_id for o in orders)

def test_stats_span_several_months_with_a_loss_and_multiple_sales_a_day(db_session):
    _prepared(db_session)
    s = compute_stats(db_session, _com(db_session, "comercial1@panelserp.com").id)
    assert len(s.monthly) >= 5
    assert any(m.profit < 0 for m in s.monthly) or any(m.profit < 0 for m in compute_stats(db_session, None).monthly)
    assert max(d.sales for d in s.daily) >= 2
    assert all(o.created_at <= TODAY for o in db_session.exec(select(Order)).all())

def test_other_commercial_also_has_data(db_session):
    _prepared(db_session)
    assert compute_stats(db_session, _com(db_session, "comercial2@panelserp.com").id).totals.orders >= 5

def test_demo_data_is_idempotent_and_templates_render(db_session):
    _prepared(db_session)
    n = len(db_session.exec(select(Order)).all())
    seed_demo(db_session, today=TODAY)
    assert len(db_session.exec(select(Order)).all()) == n
    from src.routers.templates import _render_template
    for t in db_session.exec(select(Template)).all():
        subject, body = _render_template(t, {"nombre": "Hans", "empresa": "Bauhaus", "importe": "3.000 €", "pedido": 7, "comercial": "Comercial Uno"})
        assert "{{" not in subject + body
