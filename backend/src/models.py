from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from sqlmodel import Field, SQLModel

class RoleEnum(str, Enum):
    JEFE = "jefe"
    COMERCIAL = "comercial"
    ADMIN_RRHH = "admin_rrhh"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    hashed_password: str
    role: RoleEnum = Field(default=RoleEnum.COMERCIAL)

class Client(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    company: str
    contact_email: str
    commercial_id: int = Field(index=True)
    status: str = Field(default="lead")
    total_billed: float = Field(default=0.0)
    total_profit: float = Field(default=0.0)

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(index=True)
    commercial_id: int = Field(index=True)
    status: str = Field(default="completado")
    total_billed: float = Field(default=0.0)
    net_profit: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(index=True)
    product_name: str
    quantity: int = Field(default=1)
    unit_price: float = Field(default=0.0)
    unit_cost: float = Field(default=0.0)

    @property
    def subtotal(self) -> float:
        return round(self.quantity * self.unit_price, 2)

    @property
    def net_profit(self) -> float:
        return round(self.quantity * (self.unit_price - self.unit_cost), 2)

class Supplier(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    contact_info: str
    notes: Optional[str] = None

class Template(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    subject: str
    body_content: str
