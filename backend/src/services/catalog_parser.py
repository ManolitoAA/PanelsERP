"""Convierte un catálogo en PDF (aunque sea escaneado) en un borrador de productos usando Gemini."""
import os
from pathlib import Path
from src.services.catalog_schemas import CatalogDraft

PROMPT = """Eres el asistente de catálogo de un ERP de protecciones industriales.
Extrae del PDF los productos con su tabla de medidas.
Reglas:
- Un producto por modelo o ficha (p. ej. «BOLARDO PCK», «BARANDILLA PCK 200»). name en mayúsculas, como en el catálogo.
- subtitle, description, section_title (título de la tabla) y note (nota bajo la tabla) tal cual aparecen; vacío si no hay.
- family: «PCK» o «PTH» si el modelo pertenece a esa gama; null si no.
- table_headers: las cabeceras de la tabla de medidas, en orden.
- Una variante por fila de la tabla; dimensions son los valores de la fila como texto, en el orden de table_headers.
- usage según el color del texto de la fila: amarillo = transpaleta, gris = carretilla, naranja = peatonal; null si no se distingue.
- No inventes referencias, precios ni costes: déjalos a null si no aparecen.
- Ignora páginas que no sean de producto (portada, índice, contacto)."""


def parse_catalog(genai_client, model: str, pdf: bytes) -> CatalogDraft:
    from google.genai import types

    response = genai_client.models.generate_content(
        model=model,
        contents=[PROMPT, types.Part.from_bytes(data=pdf, mime_type="application/pdf")],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=CatalogDraft),
    )
    return CatalogDraft.model_validate_json(response.text)


def parse_catalog_from_env(pdf: bytes) -> CatalogDraft:
    fake = os.getenv("GEMINI_FAKE_CATALOG")
    if fake:  # solo pruebas: devuelve un borrador fijo sin llamar a Gemini
        return CatalogDraft.model_validate_json(Path(fake).read_text())
    from src.services.order_parser import make_genai_client
    return parse_catalog(make_genai_client(), os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite", pdf)
