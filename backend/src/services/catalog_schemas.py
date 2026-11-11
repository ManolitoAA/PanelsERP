"""Borradores de importación de catálogo, compartidos entre parser, servicio y API."""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class DraftVariant(BaseModel):
    reference: Optional[str] = Field(None, description="referencia o código si aparece en el catálogo; null si no")
    dimensions: List[str] = Field(default_factory=list, description="valores de la fila, en el orden de table_headers")
    usage: Optional[Literal["transpaleta", "carretilla", "peatonal"]] = None
    unit_price: Optional[float] = Field(None, ge=0)
    unit_cost: Optional[float] = Field(None, ge=0)


class DraftProduct(BaseModel):
    name: str
    subtitle: str = ""
    family: Optional[str] = None
    description: str = ""
    section_title: str = ""
    note: str = ""
    table_headers: List[str] = Field(default_factory=list)
    variants: List[DraftVariant] = Field(default_factory=list)


class CatalogDraft(BaseModel):
    products: List[DraftProduct] = Field(default_factory=list)
    failed_pages: List[str] = Field(default_factory=list)


class PreviewVariant(DraftVariant):
    status: Literal["nueva", "conflicto", "repetida"]
    existing_variant_id: Optional[int] = None
    existing: Optional[DraftVariant] = None
    allowed_actions: List[str] = Field(default_factory=list)
    action: Optional[Literal["crear", "sobrescribir", "mantener", "descartar"]] = None


class PreviewProduct(DraftProduct):
    existing_product_id: Optional[int] = None
    variants: List[PreviewVariant] = Field(default_factory=list)


class ImportPreview(BaseModel):
    products: List[PreviewProduct] = Field(default_factory=list)
    failed_pages: List[str] = Field(default_factory=list)
