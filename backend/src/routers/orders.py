from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from src.auth import get_current_user, require_roles
from src.db import get_session
from src.models import Client, Order, OrderItem, RoleEnum, User
from src.services.profit_calculator import ItemCalculationInput, compute_item_financials

router = APIRouter(tags=["orders"])

class OrderCreate(BaseModel):
    client_id: int
    items: List[ItemCalculationInput]

class OrderResponse(BaseModel):
    id: int
    client_id: int
    commercial_id: int
    status: str
    total_billed: float
    net_profit: float
    items: List[dict] = []

class CommercialReport(BaseModel):
    commercial_id: int
    commercial_name: str
    total_billed: float
    total_profit: float
    order_count: int

@router.post("/api/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    client = session.get(Client, payload.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if current_user.role == RoleEnum.COMERCIAL and client.commercial_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden for this client")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    computed_items = [compute_item_financials(it) for it in payload.items]
    order_billed = round(sum(it.subtotal for it in computed_items), 2)
    order_profit = round(sum(it.net_profit for it in computed_items), 2)

    order = Order(
        client_id=client.id,
        commercial_id=client.commercial_id,
        status="completado",
        total_billed=order_billed,
        net_profit=order_profit,
    )
    session.add(order)
    session.commit()
    session.refresh(order)

    item_dicts = []
    for it in computed_items:
        db_item = OrderItem(
            order_id=order.id,
            product_name=it.product_name,
            quantity=it.quantity,
            unit_price=it.unit_price,
            unit_cost=it.unit_cost,
        )
        session.add(db_item)
        item_dicts.append({
            "product_name": it.product_name,
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "unit_cost": it.unit_cost,
            "subtotal": it.subtotal,
            "net_profit": it.net_profit,
        })

    # Update client totals
    client.total_billed = round(client.total_billed + order_billed, 2)
    client.total_profit = round(client.total_profit + order_profit, 2)
    session.add(client)
    session.commit()

    return OrderResponse(
        id=order.id,
        client_id=order.client_id,
        commercial_id=order.commercial_id,
        status=order.status,
        total_billed=order.total_billed,
        net_profit=order.net_profit,
        items=item_dicts,
    )

@router.get("/api/orders", response_model=List[OrderResponse])
def list_orders(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role == RoleEnum.COMERCIAL:
        statement = select(Order).where(Order.commercial_id == current_user.id)
    else:
        statement = select(Order)
    orders = session.exec(statement).all()
    return [
        OrderResponse(
            id=o.id,
            client_id=o.client_id,
            commercial_id=o.commercial_id,
            status=o.status,
            total_billed=o.total_billed,
            net_profit=o.net_profit,
        ) for o in orders
    ]

@router.get("/api/reports/billing", response_model=List[CommercialReport])
def get_billing_report(
    current_user: User = Depends(require_roles([RoleEnum.JEFE, RoleEnum.ADMIN_RRHH])),
    session: Session = Depends(get_session)
):
    commercials = session.exec(select(User).where(User.role == RoleEnum.COMERCIAL)).all()
    report = []
    for com in commercials:
        orders = session.exec(select(Order).where(Order.commercial_id == com.id)).all()
        total_billed = round(sum(o.total_billed for o in orders), 2)
        total_profit = round(sum(o.net_profit for o in orders), 2)
        report.append(CommercialReport(
            commercial_id=com.id,
            commercial_name=com.name,
            total_billed=total_billed,
            total_profit=total_profit,
            order_count=len(orders)
        ))
    return report
