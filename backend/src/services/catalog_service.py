"""Catálogo compartido: detección de duplicados, permisos de conflicto y guardado de importaciones."""
import re
import unicodedata
from typing import Dict, List, Optional, Tuple, TypeVar
from pydantic import BaseModel
from sqlmodel import Session, select
from src.catalog_models import Product, ProductVariant
from src.models import RoleEnum, User
from src.services.catalog_schemas import (CatalogDraft, DraftProduct, DraftVariant, ImportPreview,
                                          PreviewProduct, PreviewVariant)
from src.services.order_service import OrderError

EDITORS = (RoleEnum.COMERCIAL, RoleEnum.JEFE)


def normalize(text: Optional[str]) -> str:
    """'Ø 1.500' y '1500', 'GUARDARRAÍL' y 'guardarrail' dan la misma clave."""
    s = unicodedata.normalize("NFKD", (text or "").lower().replace("ø", ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", s)  # punto de miles
    return re.sub(r"\s+", "", s)


def same_variant(name_a: str, var_a: DraftVariant, name_b: str, var_b: DraftVariant) -> bool:
    if var_a.reference and var_b.reference:
        return normalize(var_a.reference) == normalize(var_b.reference)
    return (normalize(name_a) == normalize(name_b)
            and [normalize(d) for d in var_a.dimensions] == [normalize(d) for d in var_b.dimensions])


def can_edit(user: User, variant: ProductVariant) -> bool:
    return user.role == RoleEnum.JEFE or (user.role == RoleEnum.COMERCIAL and variant.created_by == user.id)


def allowed_actions(user: User, existing: ProductVariant) -> List[str]:
    return ["crear", "mantener"] + (["sobrescribir"] if can_edit(user, existing) else [])


def _as_draft(v: ProductVariant) -> DraftVariant:
    return DraftVariant(reference=v.reference, dimensions=v.dimensions, usage=v.usage,
                        unit_price=v.unit_price, unit_cost=v.unit_cost)


def _existing(session: Session) -> Tuple[List[Product], List[Tuple[str, ProductVariant]]]:
    products = list(session.exec(select(Product)).all())
    names = {p.id: p.name for p in products}
    return products, [(names.get(v.product_id, ""), v) for v in session.exec(select(ProductVariant)).all()]


def classify(session: Session, user: User, draft: CatalogDraft) -> ImportPreview:
    products, existing = _existing(session)
    seen: List[Tuple[str, DraftVariant]] = []
    out = []
    for dp in draft.products:
        match = next((p for p in products if normalize(p.name) == normalize(dp.name)), None)
        pvs = []
        for dv in dp.variants:
            if any(same_variant(n, s, dp.name, dv) for n, s in seen):
                pv = PreviewVariant(**dv.model_dump(), status="repetida", allowed_actions=["crear", "descartar"])
            else:
                ev = next((v for n, v in existing if same_variant(n, _as_draft(v), dp.name, dv)), None)
                if ev:
                    pv = PreviewVariant(**dv.model_dump(), status="conflicto", existing_variant_id=ev.id,
                                        existing=_as_draft(ev), allowed_actions=allowed_actions(user, ev))
                else:
                    pv = PreviewVariant(**dv.model_dump(), status="nueva", allowed_actions=["crear", "descartar"])
            seen.append((dp.name, dv))
            pvs.append(pv)
        out.append(PreviewProduct(**dp.model_dump(exclude={"variants"}), variants=pvs,
                                  existing_product_id=match.id if match else None))
    return ImportPreview(products=out, failed_pages=draft.failed_pages)


def _to_draft(preview: ImportPreview) -> CatalogDraft:
    fields = set(DraftVariant.model_fields)
    return CatalogDraft(products=[
        DraftProduct(**p.model_dump(include=set(DraftProduct.model_fields) - {"variants"}),
                     variants=[DraftVariant(**v.model_dump(include=fields)) for v in p.variants])
        for p in preview.products])


def _decide(sent: PreviewVariant, fresh: PreviewVariant, label: str) -> str:
    """Acción final de una variante; lanza 409 si el borrador está desfasado, 403/422 si la acción no vale."""
    if sent.status != fresh.status or sent.existing_variant_id != fresh.existing_variant_id:
        raise OrderError(409, "stale")
    action = sent.action or ("crear" if fresh.status == "nueva" else None)
    if action is None:
        raise OrderError(422, f"Falta decidir qué hacer con {label}")
    if action == "descartar" or action in fresh.allowed_actions:
        return action
    if action == "sobrescribir":
        raise OrderError(403, f"No puedes sobrescribir {label}: solo su autor o el jefe")
    raise OrderError(422, f"Acción «{action}» no válida para {label}")


def apply_import(session: Session, user: User, preview: ImportPreview) -> Dict[str, int]:
    if user.role not in EDITORS:
        raise OrderError(403, "Not enough permissions")
    fresh = classify(session, user, _to_draft(preview))
    counts = {"created": 0, "overwritten": 0, "kept": 0, "discarded": 0}
    try:
        for sent_p, fresh_p in zip(preview.products, fresh.products):
            product_id = fresh_p.existing_product_id
            for sent, fv in zip(sent_p.variants, fresh_p.variants):
                label = f"{fresh_p.name} {' × '.join(fv.dimensions)}".strip()
                try:
                    action = _decide(sent, fv, label)
                except OrderError as e:
                    if e.status_code == 409:
                        raise OrderError(409, fresh.model_dump()) from None
                    raise
                data = fv.model_dump(include=set(DraftVariant.model_fields))
                if action == "crear":
                    if product_id is None:
                        product = Product(**fresh_p.model_dump(include=set(DraftProduct.model_fields) - {"variants"}),
                                          created_by=user.id)
                        session.add(product)
                        session.flush()
                        product_id = product.id
                    session.add(ProductVariant(**data, product_id=product_id, created_by=user.id))
                    counts["created"] += 1
                elif action == "sobrescribir":
                    ev = session.get(ProductVariant, fv.existing_variant_id)
                    for k, val in data.items():
                        if val is not None:  # lo que el PDF no trae no borra lo que ya había
                            setattr(ev, k, val)
                    session.add(ev)
                    counts["overwritten"] += 1
                else:
                    counts["kept" if action == "mantener" else "discarded"] += 1
        session.commit()
    except Exception:
        session.rollback()
        raise
    return counts


T = TypeVar("T", bound=BaseModel)


def fill_from_variant(session: Session, item: T) -> T:
    """Completa precio y coste vacíos con los de la variante; lo que el usuario escribió manda."""
    if item.variant_id is None:
        return item
    variant = session.get(ProductVariant, item.variant_id)
    if not variant:
        raise OrderError(404, "Variant not found")
    return item.model_copy(update={k: getattr(variant, k) for k in ("unit_price", "unit_cost")
                                   if getattr(item, k) is None})


def catalog_text(session: Session) -> str:
    """Variantes del catálogo en una línea cada una, para el prompt del bot."""
    _, existing = _existing(session)
    lines = [f"{v.id}: {name} {' × '.join(v.dimensions)}" + (f" ref {v.reference}" if v.reference else "")
             for name, v in existing]
    return "\n".join(lines) or "ninguno"
