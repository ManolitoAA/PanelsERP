# Catálogo de productos desde PDF y fichas técnicas — Diseño

Fecha: 2026-11-11 · Estado: pendiente de revisión

## Objetivo

Que comerciales y jefe suban catálogos de productos en PDF para:
1. Rellenar pedidos más rápido (web y bot de Telegram) eligiendo productos del catálogo.
2. Generar fichas técnicas en PDF con el diseño de `Fichas-Panelchok`.

Se reparte en dos fases:
- **Fase 9:** catálogo (modelos, variantes, importación desde PDF, conflictos) y uso en pedidos.
- **Fase 10:** fichas técnicas e imágenes de producto.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance del catálogo | Un catálogo único compartido; todos los roles lo ven. |
| Quién importa / edita | `comercial` y `jefe`. `admin_rrhh` solo lectura. |
| Efecto de una importación | Solo añade productos; nunca borra. |
| Duplicados | Misma `reference` si ambas la tienen; si no, nombre de modelo normalizado + medidas normalizadas (minúsculas, sin acentos, espacios colapsados). |
| Resolución de conflictos | Quien importa decide por variante: **crear otro**, **sobrescribir** o **mantener el antiguo**. |
| Sobrescribir | Solo el autor de la variante existente (`created_by`) o un `jefe`. Los demás solo ven crear / mantener. |
| Granularidad | Un pedido elige una **variante** concreta (p. ej. Bolardo PCK Ø100×430). La ficha es por **modelo**. |

## Datos de partida (comprobados)

- `catalogo.pdf` de Panelchok es un escaneo sin capa de texto (`pdftotext` devuelve vacío). Gemini lo procesa como imagen; no se añade OCR.
- El catálogo **no trae precios, costes ni referencias**. Las variantes importadas llegan sin `unit_price`/`unit_cost`; se rellenan en la revisión o después.
- `Fichas-Panelchok/_fuente/scripts/generar.py` genera el `.tex` con `ficha_tex(p)` desde un diccionario por modelo (`titulo`, `subtitulo`, `familia`, `descripcion`, `fotos`, `render`, `tituloseccion`, `tabla`, `nota`, `amedida`). Compila con `tectonic` (instalado en `/opt/homebrew/bin/tectonic`).
- El recorte de fotos de `generar.py` usa coordenadas fijas de páginas del catálogo: **no se reutiliza**. Las imágenes se suben a mano.

## Fase 9 · Catálogo y pedidos

### Modelos (SQLModel)

Si `models.py` supera 500 líneas, van a `catalog_models.py`.

**`Product`** (modelo / ficha)
- `id`, `name` (p. ej. "BOLARDO PCK"), `subtitle`, `family` (`"PCK"`, `"PTH"` o null), `description`, `section_title`, `note`
- `table_headers`: JSON, lista de cabeceras de la tabla de medidas
- `created_by`: id de usuario, `created_at`

**`ProductVariant`** (lo que se vende)
- `id`, `product_id` (índice), `reference` (opcional, índice)
- `dimensions`: JSON, lista de valores en el orden de `table_headers`
- `usage`: `"transpaleta" | "carretilla" | "peatonal" | null` (color de la fila en la ficha)
- `unit_price`, `unit_cost`: opcionales
- `created_by`, `created_at`

**`OrderItem`**: nuevo campo `variant_id` opcional. `product_name`, precio y coste siguen siendo propios de la línea (se copian al elegir variante; cambios posteriores del catálogo no alteran pedidos pasados). El texto libre sigue funcionando.

### Servicios (lógica separada de la interfaz)

- `services/catalog_parser.py`: envía el PDF a Gemini con salida estructurada (`CatalogDraft` → lista de modelos con sus variantes). PDF de más de ~10 páginas se trocea en bloques y se juntan los resultados. Reutiliza `make_genai_client()`.
- `services/catalog_service.py`:
  - `normalize_key(variant, product)` → clave de duplicado.
  - `classify(draft, user, session)` → marca cada variante `nueva` o `conflicto`, con `existing_variant_id` y `allowed_actions` según permisos.
  - `apply_import(draft, decisions, user, session)` → revalida conflictos y permisos y guarda todo en una transacción.

### API (`routers/catalog.py`)

| Método y ruta | Roles | Qué hace |
|---|---|---|
| `GET /api/products` | todos | Modelos con variantes; búsqueda `?q=` por nombre, medidas o referencia. |
| `PATCH /api/variants/{id}` | autor o jefe | Editar referencia, precio, coste, uso. |
| `POST /api/catalog/import` | comercial, jefe | Sube PDF; devuelve borrador clasificado. No guarda nada. |
| `POST /api/catalog/import/confirm` | comercial, jefe | Recibe borrador revisado + decisión por conflicto; guarda. |

`POST /api/orders` acepta `variant_id` opcional por línea; si viene y faltan precio o coste, los toma de la variante.

### Frontend

- Página **Catálogo** (nav para todos los roles): lista de modelos y variantes; edición de precio/coste; botón **Subir catálogo PDF** (oculto para `admin_rrhh`).
- **Pantalla de revisión**: tabla de variantes nuevas (editables, con casilla para descartar) y de conflictos (actual vs. nuevo, selector con las acciones permitidas). Botón **Confirmar importación**.
- **`OrderForm`**: el campo Producto pasa a buscador de variantes; al elegir se rellenan nombre, precio y coste (editables). Sigue admitiendo texto libre.

### Bot de Telegram

`order_parser.PROMPT` recibe la lista de variantes (id, modelo, medidas, referencia) igual que la de clientes. `DraftItem` gana `variant_id` opcional. Si Gemini lo rellena y faltan precio o coste, se toman de la variante antes de `find_missing()`.

## Fase 10 · Fichas técnicas

- `backend/datasheet_assets/`: copia de `panelchok.sty` (versión de las carpetas de producto, no la de `_fuente/`), `despiece-pck.png`, `despiece-pth.png` y el logo que use el estilo.
- `services/datasheet.py`: `ficha_tex()` portado, recibiendo `Product` + variantes en lugar del diccionario `PRODUCTOS`. Composición y ventajas por familia se copian tal cual de `generar.py` (`COMPOSICION`, `VENTAJAS`).
- `latex_escape(text)`: escapa `\ { } $ & # % _ ^ ~` en todo texto que venga de usuarios o de Gemini. `tectonic` se ejecuta **sin** shell-escape.
- Imágenes: `POST /api/products/{id}/images` (render, foto1..3; autor o jefe) guarda en `backend/uploads/products/{id}/`. `uploads/` va al `.gitignore`. Producto sin imágenes → ficha sin ellas.
- `GET /api/products/{id}/datasheet.pdf` (todos): monta carpeta temporal, ejecuta `tectonic` con timeout de 60 s y devuelve el PDF. No se cachea.
- Botón **Ficha técnica** por modelo en la página Catálogo.
- `tectonic` se documenta en el README como requisito del sistema. La primera compilación necesita red para descargar paquetes.

## Errores

| Caso | Respuesta |
|---|---|
| Archivo no PDF o > 20 MB | 422 con mensaje; no se llama a Gemini. |
| Gemini falla en un bloque de páginas | El borrador indica qué páginas fallaron; el resto sigue. |
| Confirmación con borrador desfasado (nuevos duplicados) | 409 con conflictos actualizados; no se guarda nada. |
| Sobrescribir sin permiso | 403; transacción revertida. |
| `admin_rrhh` importa o edita | 403. |
| `tectonic` ausente, error o > 60 s | 503 "No se pudo generar la ficha"; log en servidor. |

## Pruebas

- **Unitarias:** `normalize_key` (referencia, nombre + medidas, acentos y espacios); `allowed_actions` por rol y autoría; `latex_escape`; `ficha_tex()` de un producto ejemplo contra la estructura del `.tex` de Bolardo PCK.
- **API (pytest, Gemini falso como en `test_order_parser.py`):** importar → borrador clasificado; confirmar con crear / sobrescribir / mantener; 403 para `admin_rrhh` y para sobrescribir ajeno; 409 por borrador desfasado; pedido con `variant_id` toma precio y coste.
- **Bot:** borrador con `variant_id` cuando el texto menciona una variante del catálogo.
- **Fichas:** compilación real con `tectonic` comprueba que sale un PDF; se salta si `tectonic` no está instalado.
- **E2E (`e2e/`, Playwright):** con el backend arrancado con `GEMINI_FAKE_CATALOG=<ruta a JSON de borrador>` (solo pruebas: `catalog_parser` devuelve ese JSON sin llamar a Gemini), subir PDF pequeño, resolver un conflicto, crear pedido eligiendo variante, descargar ficha (Fase 10).
- **Manual, al empezar la Fase 9:** enviar el `catalogo.pdf` real a Gemini para validar la extracción y el tamaño de bloque antes de construir la pantalla de revisión.

## Fuera de alcance

- Borrar productos o catálogos desde la importación.
- Recorte automático de fotos desde el PDF.
- Caché o histórico de fichas generadas.
- Precios por cliente o tarifas.
