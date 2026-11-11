from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from src.auth import get_current_user, require_roles
from src.db import get_session
from src.models import Order, RoleEnum, User
from src.services.order_service import OrderError, create_order as create_order_service
from src.services.profit_calculator import ItemCalculationInput

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
