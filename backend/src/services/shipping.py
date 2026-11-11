"""Envío de pedidos: mensajería, código de seguimiento y estado."""
from typing import Optional
from urllib.parse import quote
from sqlmodel import Session
from src.models import Courier, Order, RoleEnum, User
from src.services.order_service import OrderError

SHIPPING_STATUSES = ("en curso", "enviado", "entregado")
LEGACY_STATUS = "completado"  # pedidos anteriores a los envíos: no cambian de estado


def can_edit_shipping(user: User, order: Order) -> bool:
    return user.role == RoleEnum.JEFE or (user.role == RoleEnum.COMERCIAL and order.commercial_id == user.id)


def check_tracking_url(url: Optional[str]) -> Optional[str]:
    """Solo http(s): la URL acaba como enlace clicable en la web."""
    url = (url or "").strip() or None
    if url and not url.lower().startswith(("http://", "https://")):
        raise OrderError(422, "La web de seguimiento debe empezar por http:// o https://")
    return url


def tracking_link(courier: Optional[Courier], code: Optional[str]) -> Optional[str]:
    if not courier or not courier.tracking_url or not code or "{tracking}" not in courier.tracking_url:
        return None
    return courier.tracking_url.replace("{tracking}", quote(code, safe=""))


def update_shipping(session: Session, user: User, order_id: int, changes: dict) -> Order:
    """`changes` solo trae los campos enviados (courier_id, tracking_code, status); None borra el valor."""
    order = session.get(Order, order_id)
    if not order:
        raise OrderError(404, "Pedido no encontrado")
    if not can_edit_shipping(user, order):
        raise OrderError(403, "No puedes cambiar el envío de este pedido")

    courier_id = changes.get("courier_id", order.courier_id)
    if "courier_id" in changes and courier_id is not None and not session.get(Courier, courier_id):
        raise OrderError(404, "Mensajería no encontrada")
    tracking = changes.get("tracking_code", order.tracking_code)
    tracking = (tracking or "").strip() or None

    status = changes.get("status")
    if status is not None:
        if order.status == LEGACY_STATUS:
            raise OrderError(400, "Los pedidos antiguos no cambian de estado")
        if status not in SHIPPING_STATUSES:
            raise OrderError(422, f"Estado no válido: {status}")
    elif order.status == "en curso" and courier_id and tracking:
        status = "enviado"  # poner mensajería y tracking es enviarlo
    else:
        status = order.status

    if status in ("enviado", "entregado") and not (courier_id and tracking):
        raise OrderError(422, "Para marcarlo como enviado hacen falta mensajería y código de seguimiento")

    # se valida todo antes de tocar el pedido: un error no deja cambios a medias en la sesión
    order.courier_id, order.tracking_code, order.status = courier_id, tracking, status
    session.add(order)
    session.commit()
    session.refresh(order)
    return order
