# Información del proyecto

## Qué es
ERP y CRM web ligero para una pyme de exportación de protecciones de polietileno por Europa, enfocado en gestión comercial, pedidos con cálculo flexible de margen/beneficio, proveedores, control de acceso por roles y mensajería mediante plantillas personalizables.

## Para quién
Equipo de 7 trabajadores (Dirección, Comerciales, Administración / Contabilidad / RRHH):
- **Comerciales:** gestionan sus propios leads, clientes y pedidos de forma ágil y autónoma.
- **Jefe / Dirección:** supervisa todas las cuentas, operaciones, facturación global y márgenes netos.
- **Administración / RRHH:** consulta facturación por cliente y comercial asociado para generar reportes y liquidaciones.

## Funciones
- **Leads y Clientes:** Registro de datos de contacto, empresa, histórico de pedidos asociados, total facturado acumulado y beneficio neto total.
- **Catálogo base y Pedidos flexibles:** Registro de pedidos con productos recurrentes estándar o ítems libres. El comercial puede introducir precio de venta, coste o margen deseado, calculándose automáticamente el beneficio neto.
- **Control de acceso por roles (RBAC):**
  - Comercial: acceso restringido únicamente a sus propios leads, clientes y pedidos.
  - Dirección: acceso global sin restricciones a datos comerciales y económicos.
  - Administración / Contabilidad / RRHH: acceso de lectura a facturación por cliente, comercial asociado y generación de reportes.
- **Gestión de Proveedores:** Directorio y fichas de contacto con proveedores habituales para pedidos de material o consultas.
- **Mensajería con plantillas:** Generación de mensajes y presupuestos personalizados mediante plantillas con variables (cliente, pedido, importes), con doble opción:
  1. Envío directo por correo electrónico (SMTP).
  2. Previsualización y copia rápida al portapapeles (para envío manual por WhatsApp, Outlook u otros canales).

## Fuera de alcance
- Pasarelas de cobro online con tarjeta o integración bancaria directa automatizada (SEPA / PSD2).
- Sistema avanzado de producción en planta (MRP con control de tiempos de máquina, corte automático o turnos de operarios).
- Cliente de correo electrónico completo (no es un webmail tipo Gmail, solo emisión de mensajes desde plantillas).
- Gestión de almacén multi-ubicación con lectores de código de barras.

## Tecnología
- **Frontend:** Astro + Tailwind CSS, utilizando islas interactivas en React para formularios y tablas dinámicas.
- **Backend:** Python 3.12+ con FastAPI.
- **Base de datos & ORM:** PostgreSQL con SQLModel (combina Pydantic y SQLAlchemy para minimizar código redundante).
- **Autenticación:** JWT (Bearer token) gestionado de forma nativa en FastAPI con verificación de roles (`Depends`).
- **Plantillas & Mensajería:** Jinja2 para interpolación de plantillas; envío SMTP asíncrono con `BackgroundTasks` de FastAPI (sin necesidad de Celery o Redis).

## Datos y claves
Variables de entorno requeridas en `.env`:
- `DATABASE_URL` (conexión a PostgreSQL)
- `SECRET_KEY` (firma de tokens JWT)
- `ALGORITHM` (algoritmo para JWT, ej. `HS256`)
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `EMAILS_FROM_EMAIL`

## Cómo se prueba
- **Caso 1 (Cálculo y flexibilidad de pedidos):** Un comercial crea un pedido recurrente de 200 perfiles de polietileno a 15 €/ud con un coste unitario indicado de 9 €/ud. El sistema registra un total facturado de 3.000 € y calcula un beneficio neto de 1.200 € (40 % de margen).
- **Caso 2 (Aislamiento RBAC):** El Comercial A no puede ver ni editar los clientes o pedidos del Comercial B (devuelve HTTP 403 / no listado en API). El Jefe consulta el panel y ve los pedidos y márgenes de ambos comerciales. Administración consulta el reporte agrupado por comercial y facturación.
