"""Catálogo compartido: un Product es un modelo (una ficha técnica), una ProductVariant es lo que se vende."""
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    subtitle: str = ""
    family: Optional[str] = None  # "PCK", "PTH" o None
    description: str = ""
    section_title: str = ""
    note: str = ""
    table_headers: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_by: int = Field(index=True)
    created_at: datetime = Field(default_factory=_now)


class ProductVariant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(index=True)
    reference: Optional[str] = Field(default=None, index=True)
    dimensions: List[str] = Field(default_factory=list, sa_column=Column(JSON))  # en el orden de table_headers
    usage: Optional[str] = None  # "transpaleta" | "carretilla" | "peatonal"
    unit_price: Optional[float] = None
    unit_cost: Optional[float] = None
    created_by: int = Field(index=True)
    created_at: datetime = Field(default_factory=_now)
