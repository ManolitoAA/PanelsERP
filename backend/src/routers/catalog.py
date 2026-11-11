import logging
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from src.auth import get_current_user, require_roles
from src.catalog_models import Product, ProductVariant
from src.db import get_session
from src.models import RoleEnum, User
from src.services.catalog_parser import parse_catalog_from_env
from src.services.catalog_schemas import ImportPreview
from src.services.catalog_service import apply_import, can_edit, classify, normalize
from src.services.order_service import OrderError

log = logging.getLogger(__name__)
router = APIRouter(tags=["catalog"])
editors = require_roles([RoleEnum.COMERCIAL, RoleEnum.JEFE])
MAX_PDF = 20 * 1024 * 1024


class VariantUpdate(BaseModel):
    reference: Optional[str] = None
    usage: Optional[str] = None
    unit_price: Optional[float] = Field(None, ge=0)
    unit_cost: Optional[float] = Field(None, ge=0)


def _variant_dict(v: ProductVariant) -> dict:
    return v.model_dump(include={"id", "reference", "dimensions", "usage", "unit_price", "unit_cost", "created_by"})


@router.get("/api/products")
def list_products(q: str = "", _: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # shortcut: filtra en memoria, cambiar a SQL si el catálogo pasa de unos miles de variantes
    tokens = [normalize(t) for t in q.split() if normalize(t)]
    by_product: Dict[int, List[ProductVariant]] = {}
    for v in session.exec(select(ProductVariant).order_by(ProductVariant.id)).all():
        by_product.setdefault(v.product_id, []).append(v)
    out = []
    for p in session.exec(select(Product).order_by(Product.name)).all():
        def matches(v: ProductVariant) -> bool:
            hay = normalize(p.name) + "|" + normalize(v.reference) + "|" + "|".join(normalize(d) for d in v.dimensions)
            return all(t in hay for t in tokens)
        vs = [v for v in by_product.get(p.id, []) if matches(v)]
        if vs or (not tokens and not by_product.get(p.id)):
            out.append({**p.model_dump(include={"id", "name", "subtitle", "family", "description", "table_headers"}),
                        "variants": [_variant_dict(v) for v in vs]})
    return out


@router.patch("/api/variants/{variant_id}")
def update_variant(variant_id: int, payload: VariantUpdate, user: User = Depends(editors),
                   session: Session = Depends(get_session)):
    variant = session.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(404, "Variant not found")
    if not can_edit(user, variant):
        raise HTTPException(403, "Solo el autor o el jefe pueden editar esta variante")
    for k, val in payload.model_dump(exclude_unset=True).items():
        setattr(variant, k, val)
    session.add(variant)
    session.commit()
    session.refresh(variant)
    return _variant_dict(variant)


@router.post("/api/catalog/import", response_model=ImportPreview)
async def import_catalog(file: UploadFile = File(...), user: User = Depends(editors),
                         session: Session = Depends(get_session)):
    pdf = await file.read(MAX_PDF + 1)
    if file.content_type != "application/pdf" or not pdf.startswith(b"%PDF"):
        raise HTTPException(422, "El archivo debe ser un PDF")
    if len(pdf) > MAX_PDF:
        raise HTTPException(422, "El PDF no puede pasar de 20 MB")
    try:
        draft = parse_catalog_from_env(pdf)
    except Exception:
        log.exception("Gemini no disponible al importar catálogo")
        raise HTTPException(502, "Gemini no disponible, prueba en un minuto")
    return classify(session, user, draft)


@router.post("/api/catalog/import/confirm")
def confirm_import(preview: ImportPreview, user: User = Depends(editors), session: Session = Depends(get_session)):
    try:
        return apply_import(session, user, preview)
    except OrderError as e:
        raise HTTPException(e.status_code, e.detail)
