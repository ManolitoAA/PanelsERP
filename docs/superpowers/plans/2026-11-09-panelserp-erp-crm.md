# PanelsERP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight web ERP/CRM for a 7-person polyethylene protection export SME, featuring role-based access control, client/lead tracking, flexible order margin calculation, supplier directory, and customizable message templating.

**Architecture:** A decoupled architecture with a Python FastAPI backend exposing REST APIs and an Astro frontend with Tailwind CSS and React islands for dynamic CRUD and dashboards. Persistence is handled via SQLModel (SQLAlchemy + Pydantic) on PostgreSQL (with SQLite support for isolated tests), JWT for RBAC enforcement, and Jinja2 + native SMTP background tasks for templated messaging.

**Tech Stack:** Python 3.12+, FastAPI, SQLModel, PostgreSQL (SQLite for local unit tests), PyJWT, Passlib/Pwdlib, Jinja2, Astro 4+, React 18+, Tailwind CSS, Playwright, Pytest.

**Spec:** `docs/project-info.md`

## Global Constraints

- **File size limit:** Maximum 500 lines per file (enforced in `AGENTS.md`). Split files by responsibility if approaching limits.
- **Testing policy:** All business logic, calculations, and RBAC rules must have automated tests; no code finishes without green tests.
- **Security:** No secrets or credentials in git; all configuration loaded from `.env`.
- **Minimal dependencies (Ponytail):** No Celery/Redis for background email tasks; use FastAPI `BackgroundTasks`. No complex microservices.

## Review Focus

1. **Role Leakage on Client Listing:** Commercial A attempts to query all clients or a specific client owned by Commercial B; API must enforce filter/403 and never return Commercial B's records.
2. **Division by Zero or Negative Margins in Orders:** An order submitted with zero units, zero price, or negative costs must be handled gracefully without crashing calculation endpoints.
3. **Template Variable Injection:** A template rendering untrusted customer data must escape HTML/code to prevent injection while interpolating valid placeholders (`{{ cliente.nombre }}`).
4. **Token Expiration / Invalid Roles:** Requests with tampered JWT roles or expired tokens must receive a clean HTTP 401 Unauthorized, never 500.
5. **Accumulated Client Totals Consistency:** Deleting or adding an order must correctly update the client's cached `total_facturado` and `beneficio_neto`.

---

### Task 0: Project Scaffolding & Health Check

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/src/__init__.py`
- Create: `backend/src/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`
- Create: `frontend/package.json`
- Create: `frontend/astro.config.mjs`
- Create: `frontend/src/pages/index.astro`

**Interfaces:**
- Produces: `GET /api/health` returning `{"status": "ok", "app": "PanelsERP"}`

- [ ] **Step 1: Write the failing health check test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "PanelsERP"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: FAIL (ImportError or module not found)

- [ ] **Step 3: Implement minimal FastAPI app and Astro scaffolding**

Create `backend/src/main.py` with FastAPI instance and `/api/health` route. Create `backend/pyproject.toml` with dependencies: `fastapi`, `uvicorn`, `sqlmodel`, `pytest`, `httpx`, `pyjwt`, `pwdlib[argon2]`, `jinja2`. Scaffold minimal Astro setup in `frontend/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend frontend
git commit -m "feat: scaffold backend FastAPI and frontend Astro skeletons"
```

---

### Task 1: Database Setup & SQLModel Schemas

**Files:**
- Create: `backend/src/db.py`
- Create: `backend/src/models.py`
- Create: `backend/tests/test_models.py`

**Interfaces:**
- Produces: Models `User`, `RoleEnum` (`jefe`, `comercial`, `admin_rrhh`), `Client`, `Order`, `OrderItem`, `Supplier`, `Template`
- Produces: `get_session()` database session generator

- [ ] **Step 1: Write failing tests for models and profit calculations**

```python
# backend/tests/test_models.py
from sqlmodel import Session, SQLModel, create_engine, select
import pytest
from src.models import User, RoleEnum, Client, Order, OrderItem

@pytest.fixture
def session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s

def test_order_profit_calculation(session):
    client = Client(name="Bauhaus DE", company="Bauhaus", contact_email="contact@bauhaus.de", commercial_id=1)
    session.add(client)
    session.commit()

    order = Order(client_id=client.id, commercial_id=1)
    session.add(order)
    session.commit()

    # Case 1 from spec: 200 units @ 15 EUR with 9 EUR cost
    item = OrderItem(order_id=order.id, product_name="Perfil Polietileno 2m", quantity=200, unit_price=15.0, unit_cost=9.0)
    session.add(item)
    session.commit()

    assert item.subtotal == 3000.0
    assert item.net_profit == 1200.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_models.py -v`
Expected: FAIL (models not found)

- [ ] **Step 3: Implement `backend/src/models.py` and `backend/src/db.py`**

Define SQLModel classes:
- `RoleEnum`: `JEFE = "jefe"`, `COMERCIAL = "comercial"`, `ADMIN_RRHH = "admin_rrhh"`
- `User`: `id`, `email`, `hashed_password`, `name`, `role`
- `Client`: `id`, `name`, `company`, `contact_email`, `commercial_id`, `total_billed`, `total_profit`
- `Order`: `id`, `client_id`, `commercial_id`, `created_at`, `status`, `total_billed`, `net_profit`
- `OrderItem`: `id`, `order_id`, `product_name`, `quantity`, `unit_price`, `unit_cost` (with computed properties or column helpers for `subtotal` and `net_profit`)
- `Supplier`: `id`, `name`, `contact_info`, `notes`
- `Template`: `id`, `name`, `subject`, `body_content`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/db.py backend/src/models.py backend/tests/test_models.py
git commit -m "feat: add SQLModel data models and profit computation logic"
```

---

### Task 2: Authentication & RBAC Dependencies

**Files:**
- Create: `backend/src/auth.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/src/main.py`

**Interfaces:**
- Produces: `create_access_token(data: dict) -> str`
- Produces: `verify_password(plain: str, hashed: str) -> bool`
- Produces: `get_current_user(token: str, session: Session) -> User`
- Produces: `require_roles(roles: list[RoleEnum]) -> Callable`

- [ ] **Step 1: Write failing tests for JWT authentication and role enforcement**

```python
# backend/tests/test_auth.py
import pytest
from src.auth import create_access_token, hash_password, verify_password
from src.models import User, RoleEnum

def test_password_hash_and_token():
    pw = "secret123"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)

    token = create_access_token({"sub": "test@panelserp.com", "role": "comercial"})
    assert isinstance(token, str)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `backend/src/auth.py`**

Implement password hashing with `pwdlib`/argon2, JWT encode/decode with `pyjwt`, and FastAPI dependency `get_current_user` and `require_roles(allowed_roles)`. Register `/api/auth/login` endpoint in `backend/src/main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_auth.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth.py backend/tests/test_auth.py backend/src/main.py
git commit -m "feat: implement JWT authentication and RBAC dependency guards"
```

---

### Task 3: Client & Lead Management with RBAC Isolation

**Files:**
- Create: `backend/src/routers/clients.py`
- Create: `backend/tests/test_clients.py`
- Modify: `backend/src/main.py`

**Interfaces:**
- Consumes: `get_current_user`, `require_roles`, `get_session`
- Produces: `GET /api/clients`, `POST /api/clients`, `GET /api/clients/{id}`, `PUT /api/clients/{id}`

- [ ] **Step 1: Write failing test verifying isolation rules (Spec Case 2)**

```python
# backend/tests/test_clients.py
def test_commercial_cannot_see_other_commercial_clients(client_commercial_1, client_commercial_2):
    # Commercial 1 creates a client
    c1 = client_commercial_1.post("/api/clients", json={"name": "Client A", "company": "Co A", "contact_email": "a@a.com"}).json()
    
    # Commercial 2 lists clients -> must NOT contain Client A
    res = client_commercial_2.get("/api/clients")
    assert not any(c["id"] == c1["id"] for c in res.json())

    # Commercial 2 tries to GET client A directly -> 403 Forbidden
    res_direct = client_commercial_2.get(f"/api/clients/{c1['id']}")
    assert res_direct.status_code == 403

def test_boss_can_see_all_clients(client_boss, client_commercial_1):
    c1 = client_commercial_1.post("/api/clients", json={"name": "Client Boss Test", "company": "Co B", "contact_email": "b@b.com"}).json()
    res = client_boss.get("/api/clients")
    assert any(c["id"] == c1["id"] for c in res.json())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_clients.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `backend/src/routers/clients.py`**

- If user is `RoleEnum.COMERCIAL`: filter queries by `Client.commercial_id == current_user.id`.
- If user is `RoleEnum.JEFE` or `RoleEnum.ADMIN_RRHH`: query all clients.
- On creation: automatically assign `commercial_id = current_user.id` unless created by `JEFE`.
- Register router in `backend/src/main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_clients.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routers/clients.py backend/tests/test_clients.py backend/src/main.py
git commit -m "feat: add client/lead API with RBAC filtering and commercial isolation"
```

---

### Task 4: Orders & Flexible Profit Margin Calculation API

**Files:**
- Create: `backend/src/routers/orders.py`
- Create: `backend/src/services/profit_calculator.py`
- Create: `backend/tests/test_orders.py`
- Modify: `backend/src/main.py`

**Interfaces:**
- Consumes: `Client`, `Order`, `OrderItem`, `User`
- Produces: `POST /api/orders` (creates order, recalculates client totals), `GET /api/orders` (filtered by role), `GET /api/reports/billing` (admin & jefe only)

- [ ] **Step 1: Write failing test for order creation and margin calculation**

```python
# backend/tests/test_orders.py
def test_create_order_with_margin_and_client_total_update(client_commercial_1, client_id):
    # Spec Case 1: 200 items @ 15€, cost 9€ => 3000€ billed, 1200€ net profit
    payload = {
        "client_id": client_id,
        "items": [
            {"product_name": "Perfil Polietileno 2m", "quantity": 200, "unit_price": 15.0, "unit_cost": 9.0}
        ]
    }
    res = client_commercial_1.post("/api/orders", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["total_billed"] == 3000.0
    assert data["net_profit"] == 1200.0

    # Verify client totals got updated
    c_res = client_commercial_1.get(f"/api/clients/{client_id}")
    assert c_res.json()["total_billed"] == 3000.0
    assert c_res.json()["total_profit"] == 1200.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_orders.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `profit_calculator.py` and `backend/src/routers/orders.py`**

- `calculate_order_totals(items)`: handles flexible inputs (either `unit_price` + `unit_cost`, or calculating `unit_price` from `margin_pct` and `unit_cost`).
- Persist order, compute item rows, and update `client.total_billed += order.total_billed`, `client.total_profit += order.net_profit`.
- Register `/api/orders` and `/api/reports/billing` endpoints in `backend/src/main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_orders.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routers/orders.py backend/src/services/profit_calculator.py backend/tests/test_orders.py backend/src/main.py
git commit -m "feat: implement order creation with flexible profit calculations and client aggregates"
```

---

### Task 5: Suppliers Directory & Message Templating

**Files:**
- Create: `backend/src/routers/suppliers.py`
- Create: `backend/src/routers/templates.py`
- Create: `backend/src/services/mailer.py`
- Create: `backend/tests/test_templates.py`
- Modify: `backend/src/main.py`

**Interfaces:**
- Produces: `CRUD /api/suppliers`
- Produces: `POST /api/templates/{id}/render` returning `{"rendered_subject": "...", "rendered_body": "..."}`
- Produces: `POST /api/templates/{id}/send` with background SMTP task

- [ ] **Step 1: Write failing test for Jinja2 template rendering and copy output**

```python
# backend/tests/test_templates.py
def test_render_template_with_variables(client_authenticated):
    tpl = client_authenticated.post("/api/templates", json={
        "name": "Presupuesto Exportacion",
        "subject": "Oferta para {{ cliente.empresa }}",
        "body_content": "Hola {{ cliente.nombre }}, su pedido asciende a {{ pedido.total_billed }} EUR."
    }).json()

    render_req = {
        "context": {
            "cliente": {"nombre": "Hans", "empresa": "Bauhaus"},
            "pedido": {"total_billed": 3000.0}
        }
    }
    res = client_authenticated.post(f"/api/templates/{tpl['id']}/render", json=render_req)
    assert res.status_code == 200
    assert res.json()["rendered_subject"] == "Oferta para Bauhaus"
    assert res.json()["rendered_body"] == "Hola Hans, su pedido asciende a 3000.0 EUR."
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/test_templates.py -v`
Expected: FAIL

- [ ] **Step 3: Implement supplier endpoints, Jinja2 template renderer, and background mailer**

Implement Jinja2 environment with sandboxed/safe rendering. Add endpoint `/api/templates/{id}/send` using FastAPI `BackgroundTasks` to send via Python `smtplib`. Register routers in `backend/src/main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/test_templates.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routers/suppliers.py backend/src/routers/templates.py backend/src/services/mailer.py backend/tests/test_templates.py backend/src/main.py
git commit -m "feat: add supplier directory and Jinja2 template messaging service"
```

---

### Task 6: Frontend Dashboards & Playwright E2E Verification

**Files:**
- Create: `frontend/src/components/LoginForm.tsx`
- Create: `frontend/src/components/ClientList.tsx`
- Create: `frontend/src/components/OrderForm.tsx`
- Create: `frontend/src/components/TemplateModal.tsx`
- Create: `frontend/src/pages/dashboard.astro`
- Create: `frontend/src/pages/orders.astro`
- Create: `e2e/panelserp.spec.ts`

**Interfaces:**
- Consumes: Backend `/api/auth/login`, `/api/clients`, `/api/orders`, `/api/templates`
- Produces: Complete responsive web interface for desktop and tablet

- [ ] **Step 1: Write Playwright E2E test covering login and role view**

```typescript
// e2e/panelserp.spec.ts
import { test, expect } from '@playwright/test';

test('commercial logs in, creates client, and views margin calculator', async ({ page }) => {
  await page.goto('http://localhost:4321/');
  await page.fill('input[name="email"]', 'comercial1@panelserp.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/.*dashboard/);
  await expect(page.locator('h1')).toContainText('Mis Clientes');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/panelserp.spec.ts`
Expected: FAIL (connection refused or page not found)

- [ ] **Step 3: Implement Astro pages and React interactive islands**

Implement `LoginForm.tsx`, `ClientList.tsx`, `OrderForm.tsx` with dynamic margin/profit calculation on input, and `TemplateModal.tsx` with "Copiar al portapapeles" (using `navigator.clipboard.writeText`) and "Enviar Email".

- [ ] **Step 4: Run E2E test to verify it passes**

Run: `npx playwright test e2e/panelserp.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/ e2e/
git commit -m "feat: complete Astro frontend with React islands and E2E validation"
```
