# Plan de Implementación de PanelsERP

El agente trabaja una fase cada vez y marca las casillas al cerrarla.  
> *Detalle técnico paso a paso disponible en:* [`docs/superpowers/plans/2026-11-09-panelserp-erp-crm.md`](docs/superpowers/plans/2026-11-09-panelserp-erp-crm.md)

## Fase 0 · Esqueleto y Health Check

**Objetivo:** Crear la estructura base del backend (FastAPI) y frontend (Astro) con un endpoint de comprobación operativo.

**Tareas:**
- [ ] Crear estructura base de backend con FastAPI y dependencias en `backend/pyproject.toml`.
- [ ] Crear endpoint `GET /api/health` en `backend/src/main.py`.
- [ ] Inicializar esqueleto del frontend en Astro dentro de `frontend/`.

**Pruebas:**
- `pytest backend/tests/test_health.py` comprueba que la API responde `{"status": "ok", "app": "PanelsERP"}` con código 200.

**Hecho cuando:** `pytest backend/tests/test_health.py` pasa en verde y el proyecto compila.

---

## Fase 1 · Modelos de datos y Cálculos de beneficio

**Objetivo:** Definir el esquema relacional con SQLModel (User, RoleEnum, Client, Order, OrderItem, Supplier, Template) y la lógica matemática de márgenes.

**Tareas:**
- [ ] Configurar conexión a base de datos (`backend/src/db.py`).
- [ ] Implementar modelos SQLModel en `backend/src/models.py`.
- [ ] Implementar cálculo de subtotal y beneficio neto en las líneas de pedido.

**Pruebas:**
- `pytest backend/tests/test_models.py` valida la persistencia en base de datos y el cálculo del Caso 1 del spec (200 uds a 15 € con coste 9 € = 3.000 € facturación y 1.200 € beneficio neto).

**Hecho cuando:** Todos los modelos se instancian, guardan en base de datos y las pruebas unitarias pasan.

---

## Fase 2 · Autenticación JWT y Control de Acceso por Roles (RBAC)

**Objetivo:** Permitir inicio de sesión seguro y proteger endpoints según el rol (`comercial`, `jefe`, `admin_rrhh`).

**Tareas:**
- [ ] Implementar hash de contraseñas y firma/verificación de tokens JWT en `backend/src/auth.py`.
- [ ] Crear dependencias FastAPI `get_current_user` y guardias de rol `require_roles(...)`.
- [ ] Crear endpoint `/api/auth/login`.

**Pruebas:**
- `pytest backend/tests/test_auth.py` valida login exitoso, rechazo con credenciales erróneas y respuesta 401 en tokens inválidos o expirados.

**Hecho cuando:** El flujo de autenticación y verificación de roles funciona con pruebas automatizadas en verde.

---

## Fase 3 · Clientes, Leads y Aislamiento por Comercial

**Objetivo:** Gestión CRUD de clientes garantizando que cada comercial solo ve y edita sus propios registros, mientras jefes y administración tienen acceso de supervisión.

**Tareas:**
- [ ] Crear router `backend/src/routers/clients.py` con filtrado por rol y propiedad de comercial.
- [ ] Asegurar asignación automática del comercial creador.

**Pruebas:**
- `pytest backend/tests/test_clients.py` prueba que el Comercial A no puede ver clientes del Comercial B (Caso 2 del spec), mientras que el Jefe ve todos.

**Hecho cuando:** Los endpoints de clientes respetan el aislamiento RBAC y la suite de pruebas pasa.

---

## Fase 4 · Pedidos, Cálculo flexible de márgenes y Reportes

**Objetivo:** Creación y consulta de pedidos recurrentes o libres con cálculo dinámico de costes/márgenes y actualización de acumulados de cliente.

**Tareas:**
- [ ] Implementar servicio de cálculo flexible `backend/src/services/profit_calculator.py`.
- [ ] Crear router `backend/src/routers/orders.py` con actualización automática de `total_billed` y `total_profit` en el cliente.
- [ ] Crear endpoint `/api/reports/billing` para supervisión de facturación por comercial.

**Pruebas:**
- `pytest backend/tests/test_orders.py` valida cálculo de márgenes, actualización de saldos del cliente y permisos de reportes.

**Hecho cuando:** Los pedidos se procesan correctamente, recalculan el beneficio neto y las pruebas pasan.

---

## Fase 5 · Proveedores y Mensajería con Plantillas (Email y Portapapeles)

**Objetivo:** Directorio de proveedores y renderizado de plantillas Jinja2 para envío directo o copia al portapapeles.

**Tareas:**
- [ ] Crear router de proveedores `backend/src/routers/suppliers.py`.
- [ ] Crear router de plantillas `backend/src/routers/templates.py`.
- [ ] Implementar renderizado con Jinja2 y servicio de envío de email en segundo plano (`BackgroundTasks`) en `backend/src/services/mailer.py`.

**Pruebas:**
- `pytest backend/tests/test_templates.py` valida la sustitución correcta de variables en asunto y cuerpo, así como la respuesta adecuada para copiar al portapapeles.

**Hecho cuando:** Las plantillas se renderizan con variables personalizadas y se pueden despachar o previsualizar.

---

## Fase 6 · Frontend Web (Astro + React) y Pruebas E2E con Playwright

**Objetivo:** Desarrollar la interfaz web completa y verificar de extremo a extremo el flujo de trabajo.

**Tareas:**
- [ ] Crear layout y vistas de login, dashboard comercial y panel de supervisión.
- [ ] Crear islas interactivas en React (`ClientList.tsx`, `OrderForm.tsx`, `TemplateModal.tsx` con botón de copia al portapapeles y envío).
- [ ] Configurar y ejecutar pruebas de extremo a extremo con Playwright.

**Pruebas:**
- `npx playwright test e2e/panelserp.spec.ts` simula el inicio de sesión del comercial, creación de cliente, cálculo de pedido y verificación de interfaz.

**Hecho cuando:** La aplicación se abre en navegador, todos los formularios funcionan y la prueba de Playwright pasa al 100%.
