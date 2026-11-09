from sqlmodel import Session, SQLModel, create_engine, select
import pytest
from src.models import User, RoleEnum, Client, Order, OrderItem, Supplier, Template

@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s

def test_order_profit_calculation(session):
    client = Client(name="Bauhaus DE", company="Bauhaus", contact_email="contact@bauhaus.de", commercial_id=1)
    session.add(client)
    session.commit()
    session.refresh(client)

    order = Order(client_id=client.id, commercial_id=1)
    session.add(order)
    session.commit()
    session.refresh(order)

    # Case 1 from spec: 200 units @ 15 EUR with 9 EUR cost
    item = OrderItem(order_id=order.id, product_name="Perfil Polietileno 2m", quantity=200, unit_price=15.0, unit_cost=9.0)
    session.add(item)
    session.commit()
    session.refresh(item)

    assert item.subtotal == 3000.0
    assert item.net_profit == 1200.0

def test_user_roles(session):
    user = User(
        name="Carlos Jefe",
        email="carlos@panelserp.com",
        hashed_password="hashed_pw",
        role=RoleEnum.JEFE
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    assert user.id is not None
    assert user.role == RoleEnum.JEFE
