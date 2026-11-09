from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from src.auth import get_current_user
from src.db import get_session
from src.models import Client, RoleEnum, User

router = APIRouter(prefix="/api/clients", tags=["clients"])

class ClientCreate(BaseModel):
    name: str
    company: str
    contact_email: str
    commercial_id: Optional[int] = None
    status: Literal["lead", "cliente"] = "lead"

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact_email: Optional[str] = None
    commercial_id: Optional[int] = None
    status: Optional[Literal["lead", "cliente"]] = None

@router.get("", response_model=List[Client])
def list_clients(
    status: Optional[Literal["lead", "cliente"]] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.role == RoleEnum.COMERCIAL:
        statement = select(Client).where(Client.commercial_id == current_user.id)
    else:
        statement = select(Client)
    if status:
        statement = statement.where(Client.status == status)
    return session.exec(statement).all()

@router.post("", response_model=Client, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    commercial_id = current_user.id
    if current_user.role == RoleEnum.JEFE and payload.commercial_id is not None:
        commercial_id = payload.commercial_id

    client = Client(
        name=payload.name,
        company=payload.company,
        contact_email=payload.contact_email,
        commercial_id=commercial_id,
        status=payload.status,
        total_billed=0.0,
        total_profit=0.0,
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

@router.get("/{client_id}", response_model=Client)
def get_client(
    client_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if current_user.role == RoleEnum.COMERCIAL and client.commercial_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden to this client")

    return client

@router.put("/{client_id}", response_model=Client)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if current_user.role == RoleEnum.COMERCIAL and client.commercial_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden to this client")

    client_data = payload.model_dump(exclude_unset=True)
    if current_user.role == RoleEnum.COMERCIAL and "commercial_id" in client_data:
        del client_data["commercial_id"]

    for key, value in client_data.items():
        setattr(client, key, value)

    session.add(client)
    session.commit()
    session.refresh(client)
    return client
