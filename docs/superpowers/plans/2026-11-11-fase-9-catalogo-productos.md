# Fase 9 · Catálogo de productos desde PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo compartido de modelos y variantes, importable desde PDF con Gemini (revisión y conflictos), usable al crear pedidos en la web y en el bot de Telegram.

**Architecture:** Dos tablas nuevas (`Product`, `ProductVariant`) y `OrderItem.variant_id`. La lógica vive en `services/catalog_service.py` (duplicados, permisos, guardado) y `services/catalog_parser.py` (Gemini). `routers/catalog.py` solo traduce HTTP. El frontend añade la página Catálogo con pantalla de revisión y un buscador de variantes en `OrderForm`.

**Tech Stack:** FastAPI, SQLModel, google-genai (ya instalado), python-multipart (ya instalado), Astro + React, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-catalogo-productos-fichas-design.md` (solo la Fase 9; la Fase 10 tiene plan propio).

## Global Constraints

- Sin dependencias nuevas, ni de Python ni de npm. Si la Task 3 demuestra que hace falta trocear el PDF con una librería, para y pregunta antes de instalarla.
- Máximo 500 líneas por archivo; lógica de negocio fuera de routers y componentes.
- Roles: importar y editar `comercial` y `jefe`; `admin_rrhh` solo `GET` (403 en el resto).
- Sobrescribir una variante: solo su `created_by` o un `jefe`.
- Acciones de conflicto, literales exactos: `"crear"`, `"sobrescribir"`, `"mantener"`; además `"descartar"` para cualquier variante de la revisión.
- PDF: tipo `application/pdf`, empieza por `%PDF` y ocupa 20 MB como máximo (20 * 1024 * 1024); si no, 422 sin llamar a Gemini.
- Mensajes de error y textos de interfaz en español, como el resto de la app.
- Pruebas junto a su código y en el mismo commit; `pytest` desde `backend/` y `npm run test:e2e` desde `frontend/` en verde al cerrar.
- Nunca hacer push. Nada contra la base de datos real sin permiso explícito (ver Task 1).

## Review Focus

1. Medidas escritas con separador de miles (`1.500` frente a `1500`) o con espacios (`Ø 100`) deben contar como la misma variante → test en Task 2.
2. El mismo producto repetido dentro del mismo PDF no debe crear dos variantes en silencio → test en Task 2.
3. Un comercial que manda `"sobrescribir"` a mano (saltándose la interfaz) sobre una variante ajena → 403 y nada guardado → test en Task 4.
4. Un pedido con `variant_id` y precio editado a mano debe conservar el precio de la línea, no el del catálogo → test en Task 5.
5. Una base de datos ya existente sin la columna `orderitem.variant_id` debe arrancar y seguir creando pedidos → test en Task 1.

---

### Task 1: Modelos `Product` / `ProductVariant` y columna `variant_id`

**Files:**
- Create: `backend/src/catalog_models.py`
- Modify: `backend/src/models.py` (añadir `variant_id` a `OrderItem`), `backend/src/db.py`, `backend/src/main.py` (importar `catalog_models` para que `create_all` cree las tablas)
- Test: `backend/tests/test_catalog_models.py`

**Interfaces:**
- Produces:
  - `Product(SQLModel, table=True)`: `id`, `name: str`, `subtitle: str = ""`, `family: Optional[str]`, `description: str = ""`, `section_title: str = ""`, `note: str = ""`, `table_headers: list[str]` (columna JSON, `sa_column=Column(JSON)`), `created_by: int` (índice), `created_at: datetime` (UTC).
  - `ProductVariant(SQLModel, table=True)`: `id`, `product_id: int` (índice), `reference: Optional[str]` (índice), `dimensions: list[str]` (JSON), `usage: Optional[str]` (`"transpaleta" | "carretilla" | "peatonal"`), `unit_price: Optional[float]`, `unit_cost: Optional[float]`, `created_by: int`, `created_at: datetime`.
  - `OrderItem.variant_id: Optional[int] = Field(default=None, index=True)`.
  - `db.add_missing_columns(engine) -> None`: si la tabla `orderitem` existe y no tiene `variant_id`, ejecuta `ALTER TABLE orderitem ADD COLUMN variant_id INTEGER`. Se llama desde `create_db_and_tables()` después de `create_all`.

- [ ] **Step 1: Write the failing tests**

```python
def test_variant_persists_dimensions_json(db_session):
    p = Product(name="BOLARDO PCK", family="PCK", table_headers=["Ø Diámetro", "Altura (mm)"], created_by=1)
    db_session.add(p); db_session.commit()
    v = ProductVariant(product_id=p.id, dimensions=["100", "430"], usage="carretilla", created_by=1)
    db_session.add(v); db_session.commit(); db_session.refresh(v)
    assert v.dimensions == ["100", "430"] and v.unit_price is None

def test_add_missing_columns_upgrades_old_orderitem_table():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    with engine.begin() as c:
        c.exec_driver_sql("CREATE TABLE orderitem (id INTEGER PRIMARY KEY, order_id INTEGER, product_name VARCHAR, quantity INTEGER, unit_price FLOAT, unit_cost FLOAT)")
    add_missing_columns(engine)
    add_missing_columns(engine)  # idempotente
    assert "variant_id" in {col["name"] for col in inspect(engine).get_columns("orderitem")}
```

- [ ] **Step 2: Run, expect FAIL** — `cd backend && ../.venv/bin/pytest tests/test_catalog_models.py -v` → `ImportError`.
- [ ] **Step 3: Implement** los modelos y `add_missing_columns` (usa `sqlalchemy.inspect`; funciona igual en SQLite y Postgres).
- [ ] **Step 4: Run** `../.venv/bin/pytest -q` → todo en verde (incluidas las pruebas de pedidos existentes).
- [ ] **Step 5: Avisar antes de arrancar contra el Postgres de Docker:** el `ALTER TABLE` se aplica solo al arrancar. Es la base de desarrollo local, no producción; si hay dudas de qué base apunta `DATABASE_URL`, preguntar.
- [ ] **Step 6: Commit** — `feat: modelos de catálogo y variant_id en líneas de pedido`

---

### Task 2: `catalog_service` — duplicados, permisos y guardado

**Files:**
- Create: `backend/src/services/catalog_service.py`, `backend/src/services/catalog_schemas.py` (modelos Pydantic compartidos con el parser y el router)
- Test: `backend/tests/test_catalog_service.py`

**Interfaces:**
- Consumes: `Product`, `ProductVariant` (Task 1); `OrderError` de `order_service` (reutilizado como error de servicio con `status_code`).
- Produces (en `catalog_schemas.py`):
  - `DraftVariant(BaseModel)`: `reference: Optional[str]`, `dimensions: List[str]`, `usage: Optional[str]`, `unit_price: Optional[float] = Field(None, ge=0)`, `unit_cost: Optional[float] = Field(None, ge=0)`.
  - `DraftProduct(BaseModel)`: `name`, `subtitle=""`, `family: Optional[str]`, `description=""`, `section_title=""`, `note=""`, `table_headers: List[str]`, `variants: List[DraftVariant]`.
  - `CatalogDraft(BaseModel)`: `products: List[DraftProduct]`, `failed_pages: List[str] = []`.
  - `PreviewVariant(DraftVariant)`: `status: Literal["nueva", "conflicto", "repetida"]`, `existing_variant_id: Optional[int]`, `existing: Optional[DraftVariant]`, `allowed_actions: List[str]`, `action: Optional[str] = None`.
  - `PreviewProduct(DraftProduct)`: `existing_product_id: Optional[int]`, `variants: List[PreviewVariant]`.
  - `ImportPreview(BaseModel)`: `products: List[PreviewProduct]`, `failed_pages: List[str]`.
- Produces (en `catalog_service.py`):
  - `normalize(text: str) -> str`: sin acentos (NFKD), minúsculas, sin `Ø`, sin espacios, sin el punto de miles (`1.500` → `1500`).
  - `same_variant(name_a, var_a, name_b, var_b) -> bool`: referencias iguales si ambas existen; si no, mismo `normalize(name)` y mismas medidas normalizadas.
  - `allowed_actions(user: User, existing: ProductVariant) -> List[str]`: `["crear", "mantener"]` más `"sobrescribir"` si `user.role == JEFE` o `existing.created_by == user.id`.
  - `classify(session, user, draft: CatalogDraft) -> ImportPreview`
  - `apply_import(session, user, preview: ImportPreview) -> dict` → `{"created": int, "overwritten": int, "kept": int, "discarded": int}`. Lanza `OrderError(403, ...)` o `OrderError(409, ...)`; el 409 lleva el `ImportPreview` reclasificado en `detail`.

Reglas que fija este task:
- Un producto del borrador se une a un `Product` existente si coincide `normalize(name)`; si no, se crea un `Product` nuevo con `created_by=user.id`. Sobrescribir actualiza solo la variante (referencia, medidas, uso y precio/coste si vienen); los campos del `Product` existente no se tocan.
- `repetida`: segunda aparición de la misma variante dentro del borrador; `allowed_actions = ["crear", "descartar"]`.
- En `apply_import` se vuelve a ejecutar `classify`. Si una variante es `conflicto` y su `action` falta o no está en `allowed_actions`, se lanza 409 (borrador desfasado) o 403 (`"sobrescribir"` no permitido). Variantes `nueva` sin `action` = `"crear"`. Todo en un único `session.commit()`; ante error, `session.rollback()`.

- [ ] **Step 1: Write the failing tests**

```python
def test_normalize_ignores_thousands_accents_and_diameter():
    assert normalize(" Ø 1.500 ") == normalize("1500")
    assert normalize("GUARDARRAÍL PCK") == normalize("guardarrail  pck")

def test_same_variant_by_reference_else_name_and_dimensions():
    a = DraftVariant(reference="PE-1", dimensions=["100"])
    assert same_variant("X", a, "Y", DraftVariant(reference="pe-1", dimensions=["999"]))
    assert not same_variant("X", a, "X", DraftVariant(reference="PE-2", dimensions=["100"]))
    assert same_variant("Bolardo PCK", a, "BOLARDO PCK", DraftVariant(dimensions=["100"]))

def test_classify_marks_conflict_and_actions_for_non_author(env):  # env: comercial 1 (autor), comercial 4, jefe 2, variante existente de 1
    preview = classify(env.session, env.com4, draft_with(["100", "430"]))
    v = preview.products[0].variants[0]
    assert v.status == "conflicto" and v.allowed_actions == ["crear", "mantener"]
    assert "sobrescribir" in classify(env.session, env.jefe, draft_with(["100", "430"])).products[0].variants[0].allowed_actions

def test_classify_marks_repeated_inside_same_pdf(env):
    preview = classify(env.session, env.com4, draft_with(["70", "266"], ["70", "266"]))
    assert [v.status for v in preview.products[0].variants] == ["nueva", "repetida"]

def test_apply_import_each_action(env): ...          # crear → 2 variantes; mantener → sin cambios; sobrescribir (autor) → precio nuevo; descartar → nada
def test_apply_import_409_when_new_conflict_appeared(env): ...   # preview sin conflicto, se crea la variante después, apply → 409 y 0 filas nuevas
def test_apply_import_403_overwrite_foreign_and_rolls_back(env): ...  # com4 manda "sobrescribir" a mano → 403, nada guardado
```

- [ ] **Step 2: Run, expect FAIL** — `../.venv/bin/pytest tests/test_catalog_service.py -v`.
- [ ] **Step 3: Implement** `catalog_schemas.py` y `catalog_service.py`.
- [ ] **Step 4: Run** `../.venv/bin/pytest -q` → verde.
- [ ] **Step 5: Commit** — `feat: servicio de catálogo con duplicados y conflictos`

---

### Task 3: `catalog_parser` — Gemini lee el PDF (y prueba con el catálogo real)

**Files:**
- Create: `backend/src/services/catalog_parser.py`, `backend/tests/fixtures/catalog_draft.json` (borrador de ejemplo: BOLARDO PCK con 2 variantes)
- Modify: `.env.example` (`GEMINI_FAKE_CATALOG=` con comentario «solo pruebas»)
- Test: `backend/tests/test_catalog_parser.py`

**Interfaces:**
- Consumes: `CatalogDraft` (Task 2), `make_genai_client()` de `order_parser`.
- Produces:
  - `parse_catalog(genai_client, model: str, pdf: bytes) -> CatalogDraft`: una llamada con `types.Part.from_bytes(data=pdf, mime_type="application/pdf")`, `response_mime_type="application/json"`, `response_schema=CatalogDraft`.
  - `parse_catalog_from_env(pdf: bytes) -> CatalogDraft`: si `GEMINI_FAKE_CATALOG` tiene una ruta, devuelve ese JSON validado sin llamar a Gemini; si no, `parse_catalog(make_genai_client(), os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite", pdf)`.
  - Constante `PROMPT` con las reglas: un producto por modelo/ficha; una variante por fila de la tabla de medidas; `dimensions` en el orden de `table_headers`, como texto tal cual; `usage` según el color de la fila (amarillo = transpaleta, gris = carretilla, naranja = peatonal); no inventar referencias, precios ni costes (null).

- [ ] **Step 1: Write the failing tests** (Gemini falso, igual que `FakeGenai` de `test_order_parser.py`)

```python
def test_parse_catalog_sends_pdf_part_and_schema():
    fake = FakeGenai(CatalogDraft(products=[]))
    parse_catalog(fake, "m", b"%PDF-1.4")
    call = fake.calls[0]
    assert call["contents"][1].inline_data.mime_type == "application/pdf"
    assert call["config"].response_schema is CatalogDraft

def test_parse_catalog_from_env_uses_fake_file(monkeypatch):
    monkeypatch.setenv("GEMINI_FAKE_CATALOG", str(FIXTURE))
    draft = parse_catalog_from_env(b"%PDF")
    assert draft.products[0].name == "BOLARDO PCK" and len(draft.products[0].variants) == 2
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `catalog_parser.py`.
- [ ] **Step 4: Run** `../.venv/bin/pytest -q` → verde.
- [ ] **Step 5: Prueba manual con el catálogo real** (usa la clave de Gemini del `.env`; no toca la base de datos). Script desechable en el scratchpad:
  `python -I script.py ~/Desktop/Fichas-Panelchok/_fuente/catalogo.pdf` → llama a `parse_catalog` e imprime nº de modelos, nº de variantes y si el JSON vino truncado.
  - **Aceptado si:** sale JSON válido con 15 o más modelos de las páginas 30–57 y las medidas de BOLARDO PCK coinciden con `01-bolardo-pck/Ficha_Bolardo_PCK.tex`.
  - **Si se trunca o falla por tamaño:** añadir `pages: Optional[str]` a `parse_catalog` («procesa solo las páginas X–Y» en el prompt, mismo PDF) y un bucle de bloques de 10 páginas en `parse_catalog_from_env`. Los bloques que fallen se apuntan en `CatalogDraft.failed_pages`. Si eso no basta, **parar y preguntar** antes de añadir una librería para partir el PDF.
  - Enseñar al usuario el resumen de la extracción.
- [ ] **Step 6: Commit** — `feat: extracción de catálogo PDF con Gemini`

---

### Task 4: Router `/api/products`, `/api/variants`, `/api/catalog/import`

**Files:**
- Create: `backend/src/routers/catalog.py`
- Modify: `backend/src/main.py` (`app.include_router(catalog.router)`)
- Test: `backend/tests/test_catalog_api.py` (fixture como `order_env` de `test_orders.py`, con `GEMINI_FAKE_CATALOG` apuntando al fixture de la Task 3)

**Interfaces:**
- Consumes: `classify`, `apply_import`, `ImportPreview` (Task 2); `parse_catalog_from_env` (Task 3).
- Produces:
  - `GET /api/products?q=` (todos los roles) → `List[{id, name, subtitle, family, description, table_headers, variants: [{id, reference, dimensions, usage, unit_price, unit_cost, created_by}]}]`. `q` filtra en Python por `normalize(name + reference + dimensions)`. Escribir `# shortcut: filtra en memoria, cambiar a SQL si el catálogo pasa de unos miles de variantes`.
  - `PATCH /api/variants/{id}` (autor o jefe; si no, 403; `admin_rrhh` 403) con body `{reference?, usage?, unit_price?, unit_cost?}` → variante actualizada.
  - `POST /api/catalog/import` (comercial, jefe), multipart `file` → `ImportPreview`. Si Gemini lanza una excepción en la llamada única → 502 «Gemini no disponible, prueba en un minuto» (mismo texto que el bot); en modo por bloques, los fallos van a `failed_pages`.
  - `POST /api/catalog/import/confirm` (comercial, jefe), body `ImportPreview` → `{"created", "overwritten", "kept", "discarded"}`; traduce `OrderError` a `HTTPException`.

- [ ] **Step 1: Write the failing tests**

```python
def test_import_returns_preview_without_saving(api): ...       # 200, products[0].variants[*].status == "nueva", GET /api/products vacío
def test_import_rejects_non_pdf_and_big_files(api): ...        # b"hola" → 422; 21 MB empezando por %PDF → 422; el parser no se llama
def test_import_gemini_failure_is_502(api): ...               # parser falso que lanza → 502, nada guardado
def test_confirm_saves_and_lists(api): ...                     # confirm → created == 2; GET /api/products?q=bolardo devuelve 2 variantes
def test_admin_rrhh_can_list_but_not_import_or_patch(api): ... # GET 200; import, confirm y PATCH → 403
def test_confirm_overwrite_foreign_variant_is_403(api): ...    # com2 manda action "sobrescribir" sobre variante de com1 → 403
def test_patch_variant_only_author_or_jefe(api): ...           # autor 200, otro comercial 403, jefe 200
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `routers/catalog.py` (validación del PDF antes de leer el parser: `content_type`, cabecera `%PDF` y límite de 20 MB).
- [ ] **Step 4: Run** `../.venv/bin/pytest -q` → verde.
- [ ] **Step 5: Commit** — `feat: API de catálogo e importación con revisión`

---

### Task 5: Pedidos con `variant_id`

**Files:**
- Modify: `backend/src/services/profit_calculator.py` (`ItemCalculationInput`: `variant_id: Optional[int] = None`; `unit_cost: Optional[float] = Field(None, ge=0)`), `backend/src/services/order_service.py`, `backend/src/services/catalog_service.py`
- Test: `backend/tests/test_orders.py`, `backend/tests/test_catalog_service.py`

**Interfaces:**
- Produces: `catalog_service.fill_from_variant(session, item: T) -> T`, donde `T` es cualquier `BaseModel` con `variant_id`, `unit_price` y `unit_cost` (`ItemCalculationInput` aquí, `DraftItem` en la Task 6); devuelve `item.model_copy(update=...)`. Sin `variant_id` → devuelve el item igual. Variante inexistente → `OrderError(404, "Variant not found")`. Rellena solo `unit_price` y `unit_cost` que vengan a `None`, a partir de la variante.
- `create_order` llama a `fill_from_variant` en cada línea antes de `compute_item_financials`. Si después `unit_cost` sigue a `None` → `OrderError(422, f"Falta el coste de {product_name}")`. Guarda `OrderItem.variant_id`.

- [ ] **Step 1: Write the failing tests**

```python
def test_order_line_takes_price_and_cost_from_variant(order_env_with_variant):   # variante 15 € / 9 €
    # línea {product_name, quantity: 200, variant_id} → total_billed 3000.0, net_profit 1200.0; OrderItem.variant_id guardado

def test_order_line_keeps_manual_price_over_catalog(order_env_with_variant):
    # línea con variant_id y unit_price 16.0 → total_billed 3200.0 (no 3000.0)

def test_order_unknown_variant_is_404(order_env): ...
```

  El caso existente `{"unit_cost": None}` de `test_orders.py:133` debe seguir dando 422.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `../.venv/bin/pytest -q` → verde (incluidos `test_telegram_bot.py` y `test_order_parser.py`).
- [ ] **Step 5: Commit** — `feat: pedidos con variantes del catálogo`

---

### Task 6: Bot de Telegram reconoce variantes

**Files:**
- Modify: `backend/src/services/order_parser.py`, `backend/src/telegram_bot.py`, `backend/src/services/catalog_service.py`
- Test: `backend/tests/test_order_parser.py`, `backend/tests/test_telegram_bot.py`

**Interfaces:**
- Consumes: `fill_from_variant` (Task 5).
- Produces:
  - `catalog_service.catalog_text(session) -> str`: una línea por variante, `"{id}: {product.name} {' × '.join(dimensions)}"` más `f" ref {reference}"` si existe; `"ninguno"` si está vacío.
  - `DraftItem.variant_id: Optional[int] = Field(None, description="id de la variante del catálogo si encaja claramente")`.
  - `parse_order(..., catalog: str = "ninguno")`: `PROMPT` gana la regla «Usa solo ids de esta lista de variantes: {catalog}. No inventes precios: si eliges variante y no se dicen, déjalos a null».
  - En `telegram_bot.py`, tras `parse_order`, cada item con `variant_id` pasa por `fill_from_variant` antes de `find_missing` (los valores se escriben en el `DraftItem`).

- [ ] **Step 1: Write the failing tests**

```python
def test_parse_order_sends_catalog_text():
    fake = FakeGenai(OrderDraft()); parse_order(fake, "m", CLIENTS, text="x", catalog="7: BOLARDO PCK 100 × 430")
    assert "7: BOLARDO PCK 100 × 430" in fake.calls[0]["contents"][0]

def test_bot_fills_price_and_cost_from_variant(...):   # el Gemini falso devuelve item con variant_id y sin precio/coste → el resumen muestra 15.00 € y coste 9.00 €
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `../.venv/bin/pytest -q` → verde.
- [ ] **Step 5: Commit** — `feat: el bot usa las variantes del catálogo`

---

### Task 7: Página Catálogo y pantalla de revisión

**Files:**
- Create: `frontend/src/pages/catalog.astro`, `frontend/src/components/CatalogPage.jsx`, `frontend/src/components/CatalogImportReview.jsx`
- Modify: `frontend/src/components/nav.js` (sección `{ key: 'catalog', label: 'Catálogo', href: '/catalog' }` después de Pedidos; icono existente de `icons.jsx` o uno nuevo en ese archivo)

**Interfaces:**
- Consumes: endpoints de la Task 4.
- Comportamiento:
  - `CatalogPage`: sigue el patrón de `SuppliersPage.jsx` (`AppShell`, `Card`, `Table`, `ErrorNote`). Buscador → `GET /api/products?q=`. Una fila por variante: modelo, medidas, referencia, precio y coste. Precio y coste editables inline (→ `PATCH`) si `variant.created_by === yo` o el rol es `jefe`. Botón «Subir catálogo PDF» (`input[type=file][accept="application/pdf"]`, `name="catalog-file"`) oculto para `admin_rrhh`. Para saber «yo» usar `GET /api/auth/me`.
  - `CatalogImportReview` (props `preview`, `onDone`): tabla con columnas Modelo, Medidas, Referencia, Precio, Coste, Estado, Acción. Para `conflicto` muestra «Actual: …» y un `<select>` con `allowed_actions`, sin opción por defecto, obligatorio. Para `nueva` hay casilla «Descartar», y `repetida` lleva un select crear/descartar. Si hay `failed_pages`, aviso «No se pudieron leer las páginas …». Botón «Confirmar importación»: en 200 muestra el resumen y llama a `onDone`; en 409 sustituye la revisión por la nueva y avisa «Han cambiado productos mientras revisabas»; en 403/422 usa `ErrorNote` con el `detail`.
  - Cada archivo de menos de 500 líneas.

- [ ] **Step 1:** Implementar y comprobarlo a mano en `npm run dev` con `GEMINI_FAKE_CATALOG` en el backend. Las pruebas automáticas de esta pantalla van en la Task 9.
- [ ] **Step 2: Run** `cd frontend && npx astro build` → compila sin avisos.
- [ ] **Step 3: Commit** — `feat: página de catálogo con revisión de importación` (junto con la e2e de la Task 9 si se prefiere un único commit de interfaz).

---

### Task 8: Buscador de variantes en `OrderForm`

**Files:**
- Modify: `frontend/src/components/OrderForm.jsx` (si pasa de 500 líneas, extraer `VariantField.jsx`)

**Interfaces:**
- Consumes: `GET /api/products`.
- Comportamiento: el input «Producto» de cada línea usa un `<datalist id="catalog-variants">` con una opción por variante, con etiqueta `"{modelo} {medidas unidas por ' × '}"` más `" · {ref}"`. Si el texto coincide exactamente con una etiqueta: se guarda `variant_id` en la línea y se rellenan `unit_price` y `unit_cost`, salvo que el usuario ya los haya escrito. Si el texto cambia y deja de coincidir, se borra `variant_id`. El payload incluye `variant_id` solo si existe. El texto libre funciona como hasta ahora.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2: Run** `npx astro build` → OK.
- [ ] **Step 3: Commit** — `feat: elegir variante del catálogo en el pedido`

---

### Task 9: E2E, PLAN.md y cierre de fase

**Files:**
- Create: `e2e/fixtures/catalogo-mini.pdf` (PDF mínimo válido de una página; se genera con un script de una línea que escribe un PDF vacío y válido), `e2e/fixtures/catalog-draft.json` (copia del fixture de la Task 3)
- Modify: `frontend/playwright.config.ts` (env del backend: `GEMINI_FAKE_CATALOG` con ruta absoluta al fixture), `e2e/panelserp.spec.ts` (o `e2e/catalog.spec.ts` si el primero pasa de 500 líneas), `PLAN.md`

- [ ] **Step 1: Write e2e tests**
  - `comercial imports catalog PDF and confirms`: login de comercial, ir a Catálogo, subir `catalogo-mini.pdf`, ver 2 filas «nueva», confirmar, ver las 2 variantes en la tabla.
  - `second import shows conflict with allowed actions only`: login de otro comercial, subir el mismo PDF; el select de conflicto ofrece «crear» y «mantener» pero no «sobrescribir»; elegir «mantener» y confirmar.
  - `order form fills price and cost from catalog variant`: nuevo pedido, escribir la etiqueta de la variante, los campos precio y coste se rellenan, guardar, el total coincide.
  - `admin_rrhh sees catalog without upload button`.
  - Los usuarios demo del seed se dejan como están; los precios de la variante se ponen en la propia prueba vía `PATCH` o en la revisión.
- [ ] **Step 2: Run** `cd frontend && npm run test:e2e` → todo en verde (incluidas las pruebas anteriores).
- [ ] **Step 3: Run** `cd backend && ../.venv/bin/pytest -q` → verde, sin avisos.
- [ ] **Step 4:** Añadir **Fase 9** a `PLAN.md` con tareas marcadas, pruebas y «Hecho cuando», en el formato de las fases anteriores. Añadir **Fase 10 · Fichas técnicas** sin marcar, con enlace a la spec.
- [ ] **Step 5:** Enseñar al usuario capturas de la revisión de importación y del pedido con variante, y el resultado de las pruebas.
- [ ] **Step 6: Commit** — `feat: catálogo de productos desde PDF (fase 9)`, que incluye `PLAN.md`.
