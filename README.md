# PanelsERP

ERP y CRM web ligero para una pyme de exportación de protecciones de polietileno: leads y clientes, pedidos con cálculo de margen, proveedores, plantillas de mensajes y un dashboard de beneficios, con control de acceso por roles. Más detalle en `docs/project-info.md`.

## Qué incluye

- **Dashboard:** facturación y beneficio neto por mes y ventas por día. Cada comercial ve lo suyo; jefe y administración/RRHH ven todo y filtran por comercial. Los beneficios negativos se dibujan hacia abajo, en rojo, bajo el eje del 0. Un valor 0 se ve como una marca sobre el eje, y un gráfico vacío significa que no hay datos.
- **Clientes y leads:** cada registro es `lead` o `cliente`, con filtro y cambio de estado. RRHH solo lee.
- **Pedidos:** listado y alta con cálculo automático. Tú pones precio y coste; el margen (`(precio − coste) / precio`) se muestra en un campo de solo lectura.
- **Proveedores** y **plantillas de mensajes** (variables Jinja2, vista previa, copiar al portapapeles y envío por email).
- **Roles:** `comercial` (solo lo suyo), `jefe` (todo) y `admin_rrhh` (lectura de facturación y clientes).

> **Fechas en UTC.** Los gráficos agrupan los pedidos por mes y día en hora UTC, no en hora de España. Un pedido hecho a las 00:30 en España puede contar en el día anterior. El dashboard lo indica en pantalla.

## Tecnología

Backend: Python 3.12+, FastAPI y SQLModel. Frontend: Astro, React y Tailwind. Base de datos: PostgreSQL (Docker) o SQLite. Pruebas: pytest y Playwright.

## Puesta en marcha

Requisitos: Python 3.12+, Node.js y Docker (solo si usas Postgres).

```bash
python3 -m venv .venv && .venv/bin/pip install -e "backend[dev]"
cd frontend && npm install && npx playwright install chromium && cd ..
cp .env.example .env
```

### Opción A: Postgres en Docker

1. Rellena en `.env` `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` y `DATABASE_URL` (por defecto el puerto 5433; cámbialo con `POSTGRES_PORT`).
2. Arranca la base de datos:

```bash
docker compose up -d --wait
```

3. Arranca el backend (crea las tablas y los usuarios de demo):

```bash
cd backend && set -a && . ../.env && set +a && ../.venv/bin/python -m src.seed && ../.venv/bin/uvicorn src.main:app --reload --port 8000
```

### Opción B: SQLite (sin Docker)

Sin `DATABASE_URL` el backend usa el archivo `backend/panelserp.db`. `SECRET_KEY` sigue siendo obligatoria (ver `.env.example`):

```bash
cd backend && set -a && . ../.env && set +a && ../.venv/bin/python -m src.seed && ../.venv/bin/uvicorn src.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend && npm run dev
```

Abre http://localhost:4321.

### Datos de demo (para enseñar el MVP)

```bash
cd backend && ../.venv/bin/python -m src.seed --demo
```

Añade 7 clientes y leads de dos comerciales, 24 pedidos repartidos en 6 meses (con un mes en pérdidas), 3 proveedores y 3 plantillas. Si la BD ya tiene clientes no hace nada, así que no duplica ni pisa tus datos. Las fechas son relativas al día en que lo ejecutas.

### Usuarios de demo

`comercial1@panelserp.com`, `comercial2@panelserp.com`, `jefe@panelserp.com` y `admin@panelserp.com`, todos con la contraseña `password123`. Son solo para desarrollo: no los uses en producción.

### Bot de Telegram (pedidos y clientes con IA)

Rellena `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID`, `TELEGRAM_ERP_USER_EMAIL`, `GEMINI_API_KEY` y `GEMINI_MODEL` en `.env` (ver `.env.example`) y arráncalo:

```bash
cd backend && set -a && . ../.env && set +a && ../.venv/bin/python -m src.telegram_bot
```

Mándale un texto o un audio («Apúntame 200 perfiles a 15 €, coste 9, para Hans de Bauhaus» o «Crea el cliente Ana Kowalska, de Budmax, ana@budmax.pl»). Pregunta lo que falte y no guarda nada hasta que pulsas Confirmar. Solo atiende al ID de Telegram autorizado.

## Sin migraciones: si cambia el modelo

El proyecto no usa migraciones. `create_all` crea tablas nuevas pero no añade columnas a las existentes. Si actualizas el código y la API devuelve 500 por una columna que falta (por ejemplo `status` en clientes), recrea la base de datos de desarrollo:

- **SQLite:** borra `backend/panelserp.db` y vuelve a ejecutar el seed.
- **Postgres:** `docker compose down -v` borra el volumen y todos los datos. Después, `docker compose up -d --wait` y el seed.

## Pruebas

```bash
.venv/bin/pytest backend -v
```

Usa SQLite en memoria, no necesita nada levantado. Las fixtures compartidas están en `backend/tests/conftest.py`. Para probar contra Postgres real:

```bash
set -a && . ./.env && set +a && TEST_POSTGRES_URL=$DATABASE_URL .venv/bin/pytest backend/tests/test_postgres.py -v
```

Pruebas de extremo a extremo (Playwright):

```bash
cd frontend && npm run test:e2e
```

Levantan su propio backend (puerto 8001, SQLite temporal) y su frontend (puerto 4322), así que no tocan tu base de datos ni tus servidores. Para generar capturas de revisión visual: `SHOTS=1 npm run test:e2e -- screenshots`.

## Estructura

- `backend/src/`: API (`routers/`), lógica de negocio (`services/`), modelos, autenticación y `seed.py`.
- `backend/tests/`: pruebas del backend, junto al código.
- `frontend/src/`: páginas Astro (`pages/`) y componentes React (`components/`).
- `e2e/`: pruebas de extremo a extremo.
- `docs/`: información del proyecto, planes de implementación y `presentacion/` (resumen del MVP por rol en LaTeX/beamer; compila con `tectonic panelserp-mvp.tex`).
- `PLAN.md`: fases del proyecto.
- `docker-compose.yml`: PostgreSQL local.

## Normas de trabajo y git

`AGENTS.md` recoge cómo trabaja el agente (`CLAUDE.md` lo enlaza). El push lo haces tú, después de revisar con `git status` que `.env` no aparece. Si usas GitHub, instala `gh` y haz `gh auth login` una vez.
