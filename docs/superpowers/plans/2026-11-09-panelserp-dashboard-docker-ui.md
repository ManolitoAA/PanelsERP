# PanelsERP Fase 7: Postgres en Docker, Dashboard ERP, Navegación y UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dockerizar PostgreSQL, añadir un dashboard de beneficios por trabajador (mes y día), una barra lateral que muestre dónde estás y exponer en la UI leads, pedidos, proveedores y plantillas, con una interfaz más cuidada.

**Architecture:** El backend FastAPI gana `GET /api/stats` y un campo `status` en `Client`. El frontend Astro pasa a un layout común (`AppShell.jsx` con sidebar) y una página por sección; cada página es una isla `client:only="react"`. Estilo con tokens de Tailwind y componentes UI pequeños compartidos; los gráficos son barras CSS sin librería.

**Tech Stack:** FastAPI, SQLModel, PostgreSQL 16 (Docker Compose), `psycopg[binary]`, Astro 5, React 19, Tailwind 3, pytest, Playwright.

**Spec:** `docs/project-info.md` (funciones y roles) y los requisitos dados en chat el 2026-11-09 (resumidos en Global Constraints).

## Global Constraints

- Postgres vía `docker-compose.yml`; la app lee `DATABASE_URL` (`postgresql+psycopg://...`). Sin `DATABASE_URL` sigue usando SQLite. Claves solo en `.env` (nunca en git); `.env.example` sin valores.
- Dependencia nueva única: `psycopg[binary]` (driver Postgres). Gráficos sin librería (barras CSS); no añadir `recharts`.
- Cada comercial ve solo su dashboard; `jefe` y `admin_rrhh` ven todo y pueden filtrar por comercial.
- Margen en el formulario de pedido: solo lectura, `(precio - coste) / precio * 100` con 1 decimal (ya implementado).
- Máximo 500 líneas por archivo; lógica separada de la interfaz; cada cambio con su prueba en el mismo commit.
- Pruebas rápidas con SQLite en memoria (`db_session` de `backend/tests/conftest.py`); E2E en puertos aislados 8001/4322 (`npm run test:e2e` en `frontend/`).
- Nada toca producción: el compose es solo entorno local. Sin push.
- No hay migraciones: al cambiar el modelo, la BD de desarrollo se recrea (SQLite: borrar `backend/panelserp.db`; Postgres: `docker compose down -v`).

## Review Focus

- Comercial pide `/api/stats?commercial_id=<otro>`: debe recibir 403, nunca datos ajenos.
- Comercial sin pedidos: stats devuelve listas vacías y totales 0, no error; la UI muestra "Sin datos".
- Pedidos de varios meses y de días sin ventas: los meses se ordenan cronológicamente y los días sin ventas no aparecen con basura.
- Cliente con `status` inválido en alta o filtro: 422, no se guarda.
- Plantilla con variable ausente en el contexto: la UI muestra el error de render, no se rompe.

---

## File Structure

- `docker-compose.yml` (nuevo): servicio `db` postgres:16 con volumen.
- `backend/src/services/stats.py` (nuevo): agregación mensual/diaria, sin FastAPI.
- `backend/src/routers/stats.py` (nuevo): `GET /api/stats`.
- `backend/src/models.py`, `routers/clients.py`: campo y filtro `status`.
- `frontend/src/components/AppShell.jsx` (nuevo): sidebar + cabecera + guardia de sesión.
- `frontend/src/components/ui.jsx` (nuevo): `Card`, `StatCard`, `Table`, `Button`, `BarChart`.
- `frontend/src/components/nav.js` (nuevo): `navFor(role)` lógica pura de menú.
- Páginas Astro: `dashboard`, `clients`, `orders/index`, `orders/new`, `suppliers`, `templates`.
- Componentes de página: `StatsDashboard.jsx`, `ClientsPage.jsx`, `OrdersList.jsx`, `SuppliersPage.jsx`, `TemplatesPage.jsx`.

---

### Task 1: PostgreSQL en Docker

**Files:**
- Create: `docker-compose.yml`, `backend/tests/test_postgres.py`
- Modify: `backend/pyproject.toml`, `.env.example`, `README.md`

**Interfaces:**
- Produces: `DATABASE_URL=postgresql+psycopg://panelserp:<POSTGRES_PASSWORD>@localhost:5432/panelserp` utilizable por `src/db.py` sin cambios.

- [ ] **Step 1: Commit del trabajo pendiente** (`OrderForm.jsx`, `conftest.py`, config E2E): `git add -A && git commit -m "feat: margen solo lectura, fixtures SQLite y E2E aislado"`.
- [ ] **Step 2: Write the failing test** `test_postgres_roundtrip` en `backend/tests/test_postgres.py`: se salta (`pytest.mark.skipif`) si `TEST_POSTGRES_URL` no está definida; si lo está, crea un engine con esa URL, `SQLModel.metadata.create_all`, inserta un `Supplier` y lo lee de vuelta.
- [ ] **Step 3: Run** `.venv/bin/pytest backend/tests/test_postgres.py -v` → Expected: SKIPPED (sin BD).
- [ ] **Step 4: Crear `docker-compose.yml`**: servicio `db` imagen `postgres:16`, variables `POSTGRES_USER/PASSWORD/DB` leídas de `.env`, puerto `5432:5432`, volumen nombrado `pgdata`, `healthcheck` con `pg_isready`. Añadir `psycopg[binary]>=3.2` a `dependencies` e instalarlo en `.venv`. Añadir `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (sin valores) y el `DATABASE_URL` de ejemplo a `.env.example`. Documentar en `README.md` el arranque (`docker compose up -d`, seed, uvicorn) y que `down -v` borra los datos.
- [ ] **Step 5: Verificar con Postgres real** (tú pones valores en `.env`): `docker compose up -d`, luego `TEST_POSTGRES_URL=postgresql+psycopg://... .venv/bin/pytest backend/tests/test_postgres.py -v` → Expected: 1 passed. Y `DATABASE_URL=... .venv/bin/python -m src.seed` sin error.
- [ ] **Step 6: Commit** `feat: postgres en docker compose`.

### Task 2: Estado de lead en clientes

**Files:**
- Modify: `backend/src/models.py`, `backend/src/routers/clients.py`
- Test: `backend/tests/test_clients.py`

**Interfaces:**
- Produces: `Client.status: str` (`"lead"` | `"cliente"`, por defecto `"lead"`); `GET /api/clients?status=lead|cliente`; `ClientCreate.status` y `ClientUpdate.status` opcionales.

- [ ] **Step 1: Write failing tests** en `test_clients.py`: `test_new_client_defaults_to_lead` (POST sin status → `status == "lead"`), `test_filter_clients_by_status` (dos clientes, uno pasado a `"cliente"` con PUT; `?status=cliente` devuelve solo ese), `test_invalid_status_rejected` (status `"foo"` → 422, también en el filtro).
- [ ] **Step 2: Run** `.venv/bin/pytest backend/tests/test_clients.py -v` → Expected: FAIL.
- [ ] **Step 3: Implement** `status` con `Literal["lead","cliente"]` en los esquemas y en el parámetro de consulta; columna en `Client`. El filtro respeta el aislamiento por comercial existente.
- [ ] **Step 4: Run** `.venv/bin/pytest backend -q` → Expected: todo pasa. Recrear la BD de desarrollo.
- [ ] **Step 5: Commit** `feat: estado lead/cliente`.

### Task 3: API de estadísticas

**Files:**
- Create: `backend/src/services/stats.py`, `backend/src/routers/stats.py`, `backend/tests/test_stats.py`
- Modify: `backend/src/main.py` (registrar router)

**Interfaces:**
- Produces: `compute_stats(session: Session, commercial_id: int | None) -> StatsResponse`, con `StatsResponse{ totals: {billed: float, profit: float, orders: int}, monthly: list[{month: str "YYYY-MM", billed: float, profit: float}], daily: list[{day: str "YYYY-MM-DD", sales: int}] }`, ordenadas cronológicamente. `GET /api/stats?commercial_id=<int>`: comercial → siempre los suyos y 403 si pide otro id; `jefe`/`admin_rrhh` → todos si no pasan `commercial_id`, o el indicado.

- [ ] **Step 1: Write failing tests** en `test_stats.py` con `db_session` y pedidos con `created_at` explícito: `test_monthly_and_daily_aggregation` (3 pedidos: dos el mismo día de enero 3.000/1.200 y 1.500/500, uno en febrero → enero billed 4.500, profit 1.700; daily enero día con `sales == 2`), `test_empty_user_returns_zeros`, `test_commercial_cannot_request_other` (403), `test_jefe_sees_all_and_can_filter`, `test_admin_rrhh_can_read`.
- [ ] **Step 2: Run** `.venv/bin/pytest backend/tests/test_stats.py -v` → Expected: FAIL.
- [ ] **Step 3: Implement** la agregación en Python agrupando `Order` por `created_at` (suficiente a esta escala; sin SQL específico de motor, para que funcione igual en SQLite y Postgres) y el router con `get_current_user`.
- [ ] **Step 4: Run** `.venv/bin/pytest backend -q` → Expected: pasa.
- [ ] **Step 5: Commit** `feat: endpoint de estadisticas`.

### Task 4: Sistema visual y barra lateral

**Files:**
- Create: `frontend/src/components/nav.js`, `AppShell.jsx`, `ui.jsx`
- Modify: `frontend/tailwind.config.mjs`, `pages/index.astro`, `components/LoginForm.jsx`, `e2e/panelserp.spec.ts`

**Interfaces:**
- Produces: `navFor(role: string): { key: string, label: string, href: string }[]`: los tres roles ven las mismas cinco secciones (`dashboard`, `clients`, `orders`, `suppliers`, `templates`); lo que cambia por rol son los datos, no el menú. `AppShell({ active: string, title: string, children })` redirige a `/` sin token, resalta el ítem `active` con `aria-current="page"`, muestra nombre, rol y "Cerrar sesión". `ui.jsx` exporta `Card`, `StatCard({ label, value, tone })`, `Table`, `Button`, `BarChart({ data: {label: string, value: number}[], unit?: string })`.
- Tokens en Tailwind: color de marca (`brand`), radios y sombras suaves, fuente del sistema.

- [ ] **Step 1: Write failing E2E** `la barra lateral resalta la sección activa y permite navegar`: tras login, `getByRole('link', { name: 'Clientes' })` visible; clic → URL `/clients` y ese enlace tiene `aria-current="page"`.
- [ ] **Step 2: Run** `cd frontend && npm run test:e2e` → Expected: FAIL.
- [ ] **Step 3: Implement** `nav.js`, `AppShell.jsx` (sidebar fija en escritorio, colapsable en móvil) y `ui.jsx`; restilizar login con los tokens. Redirigir el login a `/dashboard`.
- [ ] **Step 4: Run** `npm run test:e2e` → Expected: pasa (tras Task 5 las rutas existen; si no, crear primero la página `clients` mínima aquí).
- [ ] **Step 5: Commit** `feat: layout con barra lateral y sistema visual`.

### Task 5: Páginas y reorganización de rutas

**Files:**
- Create: `pages/clients.astro`, `pages/orders/index.astro`, `pages/orders/new.astro`, `pages/suppliers.astro`, `pages/templates.astro`, `ClientsPage.jsx`, `OrdersList.jsx`, `SuppliersPage.jsx`, `TemplatesPage.jsx`
- Modify: `pages/dashboard.astro`, `Dashboard.jsx` (se reemplaza por Task 6), `ClientList.jsx` (enlace a `/orders/new?client_id=`), `OrderPage.jsx`, `e2e/panelserp.spec.ts` (rutas)
- Delete: `pages/orders.astro`

**Interfaces:**
- Consumes: `AppShell`, `ui.jsx`, `GET /api/clients?status=`, `GET /api/orders`, `GET|POST /api/suppliers`, `GET|POST /api/templates`, `TemplateModal({ template, onClose })` existente.
- Produces: rutas `/clients` (formulario de alta + lista con filtro lead/cliente y cambio de estado), `/orders` (listado: id, cliente, total, beneficio, estado), `/orders/new?client_id=`, `/suppliers` (lista + alta), `/templates` (lista + alta + botón "Usar" que abre `TemplateModal`, con copiar y enviar).

- [ ] **Step 1: Write failing E2E** (3 tests en `panelserp.spec.ts`): `clientes: filtrar por lead y cliente`, `pedidos: el pedido creado aparece en el listado`, `proveedores y plantillas: crear y usar plantilla con vista previa` (crea plantilla `Hola {{ nombre }}`, contexto `{"nombre":"Hans"}`, la vista previa contiene `Hola Hans`; también una plantilla con variable ausente muestra el error en pantalla).
- [ ] **Step 2: Run** `npm run test:e2e` → Expected: FAIL.
- [ ] **Step 3: Implement** las páginas con `AppShell` y reutilizando los componentes existentes; mover el flujo de pedido a `/orders/new` y actualizar enlaces y la redirección tras crear (a `/orders`). Cada componente < 500 líneas.
- [ ] **Step 4: Run** `npm run test:e2e` y `.venv/bin/pytest backend -q` → Expected: todo pasa.
- [ ] **Step 5: Commit** `feat: paginas de clientes, pedidos, proveedores y plantillas`.

### Task 6: Dashboard de beneficios

**Files:**
- Create: `frontend/src/components/StatsDashboard.jsx`
- Modify: `pages/dashboard.astro`, `e2e/panelserp.spec.ts`

**Interfaces:**
- Consumes: `GET /api/stats` (Task 3); el selector de comercial para jefe/admin se alimenta de `GET /api/reports/billing` (ya devuelve `commercial_id` y `commercial_name`).
- Produces: tarjetas Facturado / Beneficio neto / Nº pedidos; `BarChart` de facturación y beneficio por mes; `BarChart` de ventas por día; selector "Comercial" solo para `jefe`/`admin_rrhh` (opción "Todos").

- [ ] **Step 1: Write failing E2E** `el dashboard muestra totales y se filtra por comercial`: tras crear el pedido del Caso 1, el comercial ve 3000.00 / 1200.00 y 1 pedido; el jefe ve el mismo total con "Todos" y el selector `Comercial Uno`; un comercial sin pedidos ve "Sin datos".
- [ ] **Step 2: Run** `npm run test:e2e` → Expected: FAIL.
- [ ] **Step 3: Implement** `StatsDashboard.jsx`: llama a `/api/stats` (con `commercial_id` cuando se elige) y compone las tarjetas y gráficos con `ui.jsx`.
- [ ] **Step 4: Run** `npm run test:e2e` → Expected: pasa.
- [ ] **Step 5: Commit** `feat: dashboard de beneficios`.

### Task 7: Pulido estético y verificación final

**Files:**
- Modify: componentes de `frontend/src/components/*` y páginas, solo estilos y estados vacíos/carga/error.

- [ ] **Step 1: Estados y consistencia:** todas las tablas y listas usan `Table`/`Card`; estados "cargando", vacío y error homogéneos; botones y formularios con foco visible; el layout funciona a 375 px de ancho (sidebar colapsable).
- [ ] **Step 2: Write failing E2E** `la app es usable en móvil`: viewport 375×812, el menú se abre con el botón "Menú" y permite ir a Clientes.
- [ ] **Step 3: Implement** el colapsado móvil. Run `npm run test:e2e` → Expected: pasa.
- [ ] **Step 4: Revisión visual:** capturas con Playwright de login, dashboard, clientes, pedido, plantillas (escritorio y móvil) en `frontend/test-results/`, para tu revisión.
- [ ] **Step 5: Verificación final:** `.venv/bin/pytest backend -q` y `npm run test:e2e` → Expected: todo en verde; `npx astro build` sin errores.
- [ ] **Step 6: Actualizar `PLAN.md`** con la Fase 7 marcada y commit `feat: pulido visual y cierre fase 7`.
