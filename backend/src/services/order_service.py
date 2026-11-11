"""Creación de pedidos compartida entre la API web y el bot de Telegram."""
from datetime import datetime
from typing import List, Optional
from sqlmodel import Session, select
from src.models import Client, Order, OrderItem, RoleEnum, User
from src.services.profit_calculator import ItemCalculationInput, compute_item_financials


class OrderError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def clients_for(session: Session, user: User) -> List[Client]:
    """Clientes que el usuario puede usar en un pedido (un comercial, solo los suyos)."""
    statement = select(Client)
    if user.role == RoleEnum.COMERCIAL:
        statement = statement.where(Client.commercial_id == user.id)
    return list(session.exec(statement).all())


def check_owner(session: Session, commercial_id: int) -> None:
    """Un cliente solo puede pertenecer a un comercial o al jefe, y debe existir."""
    owner = session.get(User, commercial_id)
    if not owner or owner.role not in (RoleEnum.COMERCIAL, RoleEnum.JEFE):
        raise OrderError(400, f"commercial_id {commercial_id} no es un comercial ni el jefe")


def create_client(session: Session, user: User, name: str, company: str, contact_email: str,
                  status: str = "lead", commercial_id: Optional[int] = None) -> Client:
    if user.role not in (RoleEnum.COMERCIAL, RoleEnum.JEFE):
        raise OrderError(403, "Not enough permissions")
    owner = commercial_id if user.role == RoleEnum.JEFE and commercial_id is not None else user.id
    if owner != user.id:
        check_owner(session, owner)
    client = Client(name=name, company=company, contact_email=contact_email,
                    commercial_id=owner, status=status, total_billed=0.0, total_profit=0.0)
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


def create_order(session: Session, user: User, client_id: int, items: List[ItemCalculationInput],
                 created_at: Optional[datetime] = None) -> dict:
    if user.role not in (RoleEnum.COMERCIAL, RoleEnum.JEFE):
        raise OrderError(403, "Not enough permissions")

    # bloquea la fila: dos pedidos a la vez (web y bot) no se pisan los totales del cliente
    client = session.get(Client, client_id, with_for_update=True)
    if not client:
        raise OrderError(404, "Client not found")
    if user.role == RoleEnum.COMERCIAL and client.commercial_id != user.id:
        raise OrderError(403, "Forbidden for this client")
    if not items:
        raise OrderError(400, "Order must have at least one item")

    from src.services.catalog_service import fill_from_variant  # import local: catalog_service importa OrderError de aquí
    items = [fill_from_variant(session, it) for it in items]
    for it in items:
        if it.unit_cost is None:
            raise OrderError(422, f"Falta el coste de {it.product_name}")
    computed_items = [compute_item_financials(it) for it in items]
    order_billed = round(sum(it.subtotal for it in computed_items), 2)
    order_profit = round(sum(it.net_profit for it in computed_items), 2)

    order = Order(
        client_id=client.id,
        commercial_id=client.commercial_id,
        status="completado",
        total_billed=order_billed,
        net_profit=order_profit,
    )
    if created_at:
        order.created_at = created_at
    session.add(order)
    session.flush()  # solo para tener order.id: pedido, líneas y totales van en un único commit

    item_dicts = []
    for it, src_item in zip(computed_items, items):
        session.add(OrderItem(
            order_id=order.id,
            product_name=it.product_name,
            quantity=it.quantity,
            unit_price=it.unit_price,
            unit_cost=it.unit_cost,
            variant_id=src_item.variant_id,
        ))
        item_dicts.append(it.model_dump())

    client.total_billed = round(client.total_billed + order_billed, 2)
    client.total_profit = round(client.total_profit + order_profit, 2)
    session.add(client)
    session.commit()

    return {
        "id": order.id,
        "client_id": order.client_id,
        "commercial_id": order.commercial_id,
        "status": order.status,
        "total_billed": order.total_billed,
        "net_profit": order.net_profit,
        "items": item_dicts,
    }
