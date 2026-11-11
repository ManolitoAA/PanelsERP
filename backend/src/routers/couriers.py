from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from src.auth import get_current_user, require_roles
from src.db import get_session
from src.models import Courier, RoleEnum, User
from src.services.order_service import OrderError
from src.services.shipping import check_tracking_url

router = APIRouter(prefix="/api/couriers", tags=["couriers"])
editors = require_roles([RoleEnum.COMERCIAL, RoleEnum.JEFE])

class CourierCreate(BaseModel):
    name: str
    support_phone: Optional[str] = None
    tracking_url: Optional[str] = None

class CourierUpdate(BaseModel):
    name: Optional[str] = None
    support_phone: Optional[str] = None
    tracking_url: Optional[str] = None

def _clean(data: dict) -> dict:
    if "name" in data and not (data["name"] or "").strip():
        raise HTTPException(status_code=422, detail="La mensajería necesita un nombre")
    try:
        if "tracking_url" in data:
            data["tracking_url"] = check_tracking_url(data["tracking_url"])
    except OrderError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return data

@router.get("", response_model=List[Courier])
def list_couriers(_: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return session.exec(select(Courier).order_by(Courier.name)).all()

@router.post("", response_model=Courier, status_code=status.HTTP_201_CREATED)
def create_courier(payload: CourierCreate, _: User = Depends(editors), session: Session = Depends(get_session)):
    courier = Courier(**_clean(payload.model_dump()))
    session.add(courier)
    session.commit()
    session.refresh(courier)
    return courier

@router.put("/{courier_id}", response_model=Courier)
def update_courier(courier_id: int, payload: CourierUpdate, _: User = Depends(editors),
                   session: Session = Depends(get_session)):
    courier = session.get(Courier, courier_id)
    if not courier:
        raise HTTPException(status_code=404, detail="Mensajería no encontrada")
    for key, value in _clean(payload.model_dump(exclude_unset=True)).items():
        setattr(courier, key, value)
    session.add(courier)
    session.commit()
    session.refresh(courier)
    return courier
