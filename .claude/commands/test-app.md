---
description: Prueba la app a mano con el MCP de Playwright (navegador visible) y da un mini informe
---

Prueba PanelsERP de punta a punta con las herramientas del MCP de Playwright (`mcp__plugin_playwright_playwright__*`), en un navegador **visible** para que el usuario vea cada paso. Responde en español.

Foco opcional que ha pedido el usuario (si está vacío, prueba todo): $ARGUMENTS

## 1. Levantar un entorno aislado

No toques la base de datos del usuario ni sus servidores (8000/4321). Usa puertos propios y una SQLite temporal:

- Backend, en segundo plano (`run_in_background`), desde `backend/`:
  `rm -f test-app.db && DATABASE_URL=sqlite:///./test-app.db ../.venv/bin/python -m src.seed --demo && DATABASE_URL=sqlite:///./test-app.db ../.venv/bin/uvicorn src.main:app --port 8002`
- Frontend, en segundo plano, desde `frontend/`:
  `PUBLIC_API_URL=http://localhost:8002 npm run dev -- --port 4323`
- Espera a que respondan `http://localhost:8002/api/health` y `http://localhost:4323` (reintenta con `curl -s` unos segundos). Si alguno no arranca, lee su salida, para y repórtalo como error.

## 2. Probar en el navegador (visible)

Usa `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_resize` y `browser_console_messages`. Ve despacio y con pasos claros para que el usuario lo siga. Usuarios de demo: los de `README.md` (contraseña `password123`).

Anota cada prueba como OK o FALLO. Si algo falla, haz `browser_take_screenshot`, mira consola y red (`browser_network_requests`) y sigue con el resto.

1. **Login:** credenciales incorrectas muestran error; `comercial1@panelserp.com` entra.
2. **Dashboard (comercial):** se ven facturación y beneficio con datos demo; aparece el aviso de fechas en UTC.
3. **Clientes:** crear un lead nuevo, filtrar por lead y por cliente, cambiar su estado.
4. **Pedidos:** crear un pedido con precio 3000 y coste 1200; el margen de solo lectura muestra 60 %; el pedido aparece en el listado.
5. **Proveedores:** crear uno y verlo en la lista.
6. **Plantillas:** crear una con una variable Jinja, ver la vista previa; una sintaxis inválida muestra error.
7. **Jefe** (`jefe@panelserp.com`): ve todo, filtra el dashboard por comercial y ve el panel de supervisión.
8. **RRHH** (`admin@panelserp.com`): solo lectura en clientes y no puede crear pedidos.
9. **Navegación:** la barra lateral marca la sección activa; cerrar sesión funciona.
10. **Móvil:** `browser_resize` a 375x812, el menú se abre y navega. Vuelve a 1280x800.
11. **Consola:** al final, ningún error en `browser_console_messages`.

## 3. Recoger

Cierra el navegador (`browser_close`), para los dos servidores en segundo plano y borra `backend/test-app.db`. No cambies código ni hagas commits.

## 4. Mini informe

- **Si todo va bien:** lista corta de las pruebas hechas y una línea final: «Todo OK».
- **Si algo falla**, por cada fallo:
  - **Qué falla:** el paso, qué esperabas y qué pasó (mensaje de error exacto, respuesta HTTP o error de consola).
  - **Causa probable:** archivo y línea si la encuentras (busca en `frontend/src` y `backend/src`).
  - **Cómo arreglarlo:** propuesta concreta. No la apliques: según `AGENTS.md`, primero va una prueba que reproduzca el bug y luego el arreglo, y eso lo decide el usuario.
  Después, una lista corta de lo que sí pasó OK.
