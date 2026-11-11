import pytest
from src.models import Client, RoleEnum, User
from src.services.order_service import OrderError, clients_for, create_client, create_order
from src.services.profit_calculator import ItemCalculationInput


@pytest.fixture
def users(db_session):
    com_a = User(id=1, email="a@t.com", name="A", hashed_password="x", role=RoleEnum.COMERCIAL)
    com_b = User(id=2, email="b@t.com", name="B", hashed_password="x", role=RoleEnum.COMERCIAL)
    admin = User(id=3, email="r@t.com", name="R", hashed_password="x", role=RoleEnum.ADMIN_RRHH)
    db_session.add_all([com_a, com_b, admin,
        Client(id=10, name="Hans", company="Bauhaus", contact_email="h@b.de", commercial_id=1),
        Client(id=20, name="Marie", company="Leroy", contact_email="m@l.fr", commercial_id=2)])
    db_session.commit()
    return com_a, com_b, admin


def test_create_order_case_1(db_session, users):
    com_a, _, _ = users
    items = [ItemCalculationInput(product_name="Perfil", quantity=200, unit_price=15, unit_cost=9)]
    order = create_order(db_session, com_a, 10, items)
    assert order["total_billed"] == 3000.0
    assert order["net_profit"] == 1200.0
    assert db_session.get(Client, 10).total_billed == 3000.0


def test_commercial_cannot_order_for_other_client(db_session, users):
    com_a, _, _ = users
    with pytest.raises(OrderError) as e:
        create_order(db_session, com_a, 20, [ItemCalculationInput(product_name="P", unit_price=1)])
    assert e.value.status_code == 403


def test_admin_cannot_create_orders(db_session, users):
    _, _, admin = users
    with pytest.raises(OrderError) as e:
        create_order(db_session, admin, 10, [ItemCalculationInput(product_name="P", unit_price=1)])
    assert e.value.status_code == 403


def test_clients_for_only_own(db_session, users):
    com_a, _, _ = users
    assert [c.id for c in clients_for(db_session, com_a)] == [10]


def test_create_client_owned_by_commercial(db_session, users):
    com_a, _, _ = users
    client = create_client(db_session, com_a, "Ana", "Budmax", "a@b.pl", status="cliente", commercial_id=2)
    assert client.commercial_id == 1 and client.status == "cliente"  # un comercial no puede asignarlo a otro


def test_admin_cannot_create_clients(db_session, users):
    _, _, admin = users
    with pytest.raises(OrderError):
        create_client(db_session, admin, "Ana", "Budmax", "a@b.pl")
