"""Convierte un mensaje (texto o audio) en un borrador de pedido usando Gemini."""
import os
from typing import List, Optional
from pydantic import BaseModel, Field
from src.models import Client
from src.services.profit_calculator import ItemCalculationInput, compute_item_financials


class DraftItem(BaseModel):
    product_name: str
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    unit_cost: Optional[float] = None
    margin_pct: Optional[float] = None


class NewClient(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact_email: Optional[str] = None


class OrderDraft(BaseModel):
    client_id: Optional[int] = Field(None, description="id del cliente si está claro; null si no o si hay varios posibles")
    client_mentioned: Optional[str] = Field(None, description="nombre del cliente tal como lo dijo el usuario")
    client_candidates: List[int] = Field(default_factory=list, description="ids posibles si el cliente es ambiguo")
    items: List[DraftItem] = Field(default_factory=list)
    new_client: Optional[NewClient] = Field(None, description="datos del cliente a crear si no existe y el usuario quiere darlo de alta")


PROMPT = """Eres el asistente de pedidos de un ERP de protecciones de polietileno.
Extrae del mensaje del comercial el cliente y las líneas del pedido.
Reglas:
- Usa solo ids de esta lista de clientes: {clients}
- Si el cliente no está claro o encaja con varios, deja client_id a null y pon los posibles en client_candidates.
- Si el usuario pide crear un cliente, o da nombre/empresa/email de un cliente que no está en la lista, rellena new_client con lo que diga y deja client_id a null. Si después elige un cliente de la lista, pon su client_id y new_client a null.
- Un mensaje puede ser solo para crear un cliente, sin productos: items vacío.
- No inventes cantidades, precios, costes ni márgenes: si no se dicen, déjalos a null.
- Precios y costes son unitarios en euros; un margen «del 40 %» es margin_pct=40.
Borrador anterior (complétalo con el mensaje nuevo, sin perder lo que ya tenía): {previous}"""


def _clients_text(clients: List[Client]) -> str:
    return "; ".join(f"{c.id}: {c.name} ({c.company})" for c in clients) or "ninguno"


def parse_order(genai_client, model: str, clients: List[Client], text: Optional[str] = None,
                audio: Optional[bytes] = None, previous: Optional[OrderDraft] = None) -> OrderDraft:
    from google.genai import types

    prompt = PROMPT.format(clients=_clients_text(clients), previous=previous.model_dump_json() if previous else "ninguno")
    contents: list = [prompt]
    if text:
        contents.append(f"Mensaje: {text}")
    if audio:
        contents.append(types.Part.from_bytes(data=audio, mime_type="audio/ogg"))
    response = genai_client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=OrderDraft),
    )
    return OrderDraft.model_validate_json(response.text)


def make_genai_client():
    from google import genai
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def find_missing(draft: OrderDraft, clients: List[Client]) -> List[str]:
    """Lista de preguntas para el usuario; vacía si el borrador está completo."""
    by_id = {c.id: c for c in clients}
    missing = []
    if draft.client_id in by_id:
        pass
    elif draft.new_client:
        missing += _new_client_missing(draft.new_client, clients)
    else:
        candidates = [by_id[i] for i in draft.client_candidates if i in by_id]
        if len(candidates) > 1:
            missing.append("¿Para qué cliente? " + ", ".join(f"{c.name} ({c.company})" for c in candidates))
        else:
            who = f"«{draft.client_mentioned}»" if draft.client_mentioned else "del pedido"
            missing.append(f"No existe el cliente {who} entre los tuyos. ¿Lo creo? Dime nombre, empresa y email.")
    if not draft.items and not draft.new_client:
        missing.append("No veo productos en el pedido.")
    for it in draft.items:
        if not it.quantity or it.quantity <= 0:
            missing.append(f"Falta la cantidad de {it.product_name}.")
        if it.unit_cost is None:
            missing.append(f"Falta el coste unitario de {it.product_name}.")
        if it.unit_price is None and it.margin_pct is None:
            missing.append(f"Falta el precio o el margen de {it.product_name}.")
    return missing


def _new_client_missing(nc: NewClient, clients: List[Client]) -> List[str]:
    missing = [f"Falta {label} del cliente nuevo." for field, label in
               (("name", "el nombre"), ("company", "la empresa"), ("contact_email", "el email"))
               if not (getattr(nc, field) or "").strip()]
    if nc.contact_email and "@" not in nc.contact_email:
        missing.append(f"El email «{nc.contact_email}» no parece válido.")
    company = (nc.company or "").strip().lower()
    dup = next((c for c in clients if company and c.company.strip().lower() == company), None)
    if dup:
        missing.append(f"Ya tienes un cliente de {dup.company}: {dup.name}. Dime si es para él o /cancelar.")
    return missing


def to_items(draft: OrderDraft) -> List[ItemCalculationInput]:
    return [ItemCalculationInput(**it.model_dump()) for it in draft.items]


def summary(draft: OrderDraft, clients: List[Client]) -> str:
    """Resumen para confirmar. Requiere un borrador sin nada en find_missing()."""
    nc = draft.new_client if draft.client_id not in {c.id for c in clients} else None
    if nc:
        lines = [f"Cliente nuevo: {nc.name} ({nc.company}, {nc.contact_email})"]
        if draft.items:
            lines.append("Pedido:")
    else:
        client = next(c for c in clients if c.id == draft.client_id)
        lines = [f"Pedido para {client.name} ({client.company}):"]
    if not draft.items:
        return "\n".join(lines)
    total = profit = 0.0
    for it in map(compute_item_financials, to_items(draft)):
        lines.append(f"• {it.quantity} × {it.product_name} a {it.unit_price:.2f} € (coste {it.unit_cost:.2f} €) = {it.subtotal:.2f} €")
        total += it.subtotal
        profit += it.net_profit
    lines.append(f"Total: {total:.2f} € · Beneficio: {profit:.2f} €")
    return "\n".join(lines)
