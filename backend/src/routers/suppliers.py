from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from src.auth import get_current_user
from src.db import get_session
from src.models import Supplier, User

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

class SupplierCreate(BaseModel):
    name: str
    contact_info: str
    notes: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_info: Optional[str] = None
    notes: Optional[str] = None

@router.get("", response_model=List[Supplier])
def list_suppliers(
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(select(Supplier)).all()

@router.post("", response_model=Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    supplier = Supplier(**payload.model_dump())
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier

@router.get("/{supplier_id}", response_model=Supplier)
def get_supplier(
    supplier_id: int,
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.put("/{supplier_id}", response_model=Supplier)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier
