from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, func, or_, select
from src.auth import get_current_user, require_roles
from src.db import get_session
from src.models import Courier, Order, RoleEnum, User
from src.services.order_service import OrderError, create_order as create_order_service
from src.services.profit_calculator import ItemCalculationInput
from src.services.shipping import tracking_link, update_shipping

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
    created_at: Optional[datetime] = None
    courier_id: Optional[int] = None
    courier_name: Optional[str] = None
    courier_phone: Optional[str] = None
    tracking_code: Optional[str] = None
    tracking_url: Optional[str] = None

class ShippingUpdate(BaseModel):
    courier_id: Optional[int] = None
    tracking_code: Optional[str] = None
    status: Optional[str] = None

def _order_response(o: Order, courier: Optional[Courier]) -> OrderResponse:
    return OrderResponse(
        id=o.id, client_id=o.client_id, commercial_id=o.commercial_id, status=o.status,
        total_billed=o.total_billed, net_profit=o.net_profit, created_at=o.created_at,
        courier_id=o.courier_id, courier_name=courier.name if courier else None,
        courier_phone=courier.support_phone if courier else None,
        tracking_code=o.tracking_code, tracking_url=tracking_link(courier, o.tracking_code),
    )

class CommercialReport(BaseModel):
    commercial_id: int
    commercial_name: str
    total_billed: float
    total_profit: float
    order_count: int

@router.post("/api/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    current_user: User = Depends(require_roles([RoleEnum.COMERCIAL, RoleEnum.JEFE])),
    session: Session = Depends(get_session)
):
    try:
        return OrderResponse(**create_order_service(session, current_user, payload.client_id, payload.items))
    except OrderError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

@router.get("/api/orders", response_model=List[OrderResponse])
def list_orders(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role == RoleEnum.COMERCIAL:
        statement = select(Order).where(Order.commercial_id == current_user.id)
    else:
        statement = select(Order)
    orders = session.exec(statement.order_by(Order.id.desc())).all()
    couriers = {c.id: c for c in session.exec(select(Courier)).all()}
    return [_order_response(o, couriers.get(o.courier_id)) for o in orders]

@router.patch("/api/orders/{order_id}/shipping", response_model=OrderResponse)
def set_shipping(
    order_id: int,
    payload: ShippingUpdate,
    current_user: User = Depends(require_roles([RoleEnum.COMERCIAL, RoleEnum.JEFE])),
    session: Session = Depends(get_session)
):
    try:
        order = update_shipping(session, current_user, order_id, payload.model_dump(exclude_unset=True))
    except OrderError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return _order_response(order, session.get(Courier, order.courier_id) if order.courier_id else None)

@router.get("/api/reports/billing", response_model=List[CommercialReport])
def get_billing_report(
    current_user: User = Depends(require_roles([RoleEnum.JEFE, RoleEnum.ADMIN_RRHH])),
    session: Session = Depends(get_session)
):
    # todo el que tenga pedidos (también el jefe con clientes propios) y los comerciales aunque no tengan
    rows = session.exec(
        select(User.id, User.name,
               func.coalesce(func.sum(Order.total_billed), 0.0),
               func.coalesce(func.sum(Order.net_profit), 0.0),
               func.count(Order.id))
        .outerjoin(Order, Order.commercial_id == User.id)
        .group_by(User.id, User.name, User.role)
        .having(or_(User.role == RoleEnum.COMERCIAL, func.count(Order.id) > 0))
        .order_by(User.id)
    ).all()
    return [CommercialReport(commercial_id=uid, commercial_name=name, total_billed=round(billed, 2),
                             total_profit=round(profit, 2), order_count=count)
            for uid, name, billed, profit, count in rows]
