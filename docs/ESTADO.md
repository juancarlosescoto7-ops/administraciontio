# Estado del proyecto

## E0 — Arranque técnico

- **Fecha:** 2026-10-25
- **Resultado:** APROBADO. Lo local y la verificación remota de Supabase Cloud (MCP y app) están terminados y verificados (ver «Verificación de Supabase Cloud»).

### Funcionalidad entregada

- Next.js 16.4.3 (App Router, Turbopack, Cache Components + Partial Prefetching de la plantilla oficial), TypeScript estricto, Tailwind CSS 4, ESLint 9 (`eslint-config-next`), Vitest 5.
- Clientes Supabase con `@supabase/ssr` según el patrón oficial:
  - [lib/supabase/client.ts](../lib/supabase/client.ts): cliente de navegador.
  - [lib/supabase/server.ts](../lib/supabase/server.ts): cliente de servidor con `cookies()`.
  - [lib/supabase/proxy.ts](../lib/supabase/proxy.ts) + [proxy.ts](../proxy.ts): refresco de sesión con `getClaims()`. En E0 no redirige ni protege rutas (eso es E1).
  - [lib/supabase/config.ts](../lib/supabase/config.ts): lee solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; exige https y **rechaza claves secretas** (`sb_secret_…` o JWT `service_role`). Los mensajes de error nunca incluyen la URL ni la clave.
- Pantalla inicial en español ([app/page.tsx](../app/page.tsx)): «Proyecto inicializado» y estado de conexión calculado **en el servidor por solicitud** (`connection()` + `Suspense`), nunca en el build. La verificación ([lib/supabase/estado-conexion.ts](../lib/supabase/estado-conexion.ts)) consulta `GET /auth/v1/health` con la clave publicable y distingue: sin configurar, configuración inválida, conectado, clave rechazada y error de red/tiempo agotado (5 s).
- `.env.example` sin valores reales, `.gitignore` (excluye `.env*` salvo `.env.example`, llaves/credenciales, estado local de Supabase CLI, builds y temporales), README con puesta en marcha y configuración del MCP.
- Scripts npm: `dev`, `build`, `start`, `lint`, `typecheck` (`next typegen && tsc --noEmit`), `test` (`vitest run`).
- No se crearon rutas de módulos: la pantalla indica «Próximamente».

### Dependencias (fijadas en `package-lock.json`)

| Paquete | Versión |
|---|---|
| next / eslint-config-next | 16.4.3 |
| react / react-dom | 19.3.0 |
| @supabase/supabase-js | 2.118.0 (exacta) |
| @supabase/ssr | 0.12.7 (exacta) |
| tailwindcss / @tailwindcss/turbopack | 4.3.3 |
| typescript | 5.9.3 |
| eslint | 9.39.5 |
| vitest | 5.0.5 (exacta) |
| @types/node | 24.19.2 (la plantilla traía `^20`, incompatible con vitest 5; se alineó con Node 24) |

### Cambios de esquema / migraciones

- **Ninguna migración creada ni aplicada.** E0 no requiere tablas ni funciones: la conectividad de la app se valida con el endpoint de salud de Auth, sin exponer datos ni conceder permisos a `anon`. No se generó una migración vacía. Se creó la carpeta `supabase/migrations/` (con `.gitkeep`) para E1.
- No se realizó ningún cambio en Supabase Cloud.

### Verificación de Supabase Cloud (2026-10-25, Claude Code + MCP oficial)

| Comprobación | Resultado |
|---|---|
| Proyecto conectado (`get_project_url`) | `https://cgohbizokewvivxmvbij.supabase.co`: coincide con el `project_ref` de desarrollo de `.mcp.json` y `.codex/config.toml`; el servidor MCP está limitado a ese proyecto |
| Herramientas disponibles | `list_tables`, `list_migrations`, `apply_migration`, `execute_sql`, `get_advisors`, `generate_typescript_types`, `query_logs`, `search_docs` |
| `list_tables` (`public`) | Sin tablas |
| `list_migrations` | Sin migraciones (coincide con `supabase/migrations/` vacío) |
| `select version(), current_setting('transaction_read_only')` | PostgreSQL 17.11; `transaction_read_only = off` (no es de solo lectura) |
| `get_advisors` (security) | Sin avisos |
| App real: `.env.local` (ignorado por Git) con URL y clave **publicable** `sb_publishable_…` obtenida por `get_publishable_keys`; `npm run build` + `next start` → `GET /` | HTTP 200, «Proyecto inicializado» y «Conexión con Supabase validada»; ni el `project_ref` ni la clave aparecen en el HTML ni en `.next/static` |

Supabase Cloud fue realmente alcanzado, tanto por MCP como desde el servidor de la app. Tras configurar `.env.local` se repitieron `lint`, `typecheck`, `test` (13/13) y `build`, todos OK.

### Comandos y pruebas (2026-10-25, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` | OK, 0 errores / 0 advertencias |
| `npm run typecheck` | OK |
| `npm test` | OK, 2 archivos, 13 pruebas |
| `npm run build` | OK; `/` como Partial Prerender (estático + estado de conexión dinámico), `proxy.ts` activo |
| `npm audit` | 0 vulnerabilidades |
| `next start` sin `.env.local` → `GET /` | HTTP 200, `lang="es"`, «Proyecto inicializado», «Supabase no configurado»; `GET /clientes` → 404 (no aparenta funcionar) |
| `next dev` con URL/clave **ficticias** de un proyecto inexistente | «No se pudo validar la conexión — No se pudo establecer la conexión.»; ni la URL ni la clave aparecen en el HTML ni en el JS del cliente |

Pruebas unitarias cubren: validación de configuración (https, configuración parcial, rechazo de `sb_secret_` y JWT `service_role`, aceptación de clave anon heredada, mensajes sin secretos) y verificación de conexión con `fetch` simulado (endpoint y cabecera `apikey`, `no-store`, sin red si falta configuración, 401 → clave rechazada, 503 → error, error de red y tiempo agotado sin filtrar la URL).

### Autorrevisión

- Sin archivos ni scripts Docker ni `supabase start`.
- Sin secretos en el repositorio (solo un valor ficticio `sb_secret_ficticia` dentro de una prueba). `.env.local` existe solo en local, contiene únicamente la URL y la clave publicable y Git lo ignora. `.mcp.json` y `.codex/config.toml` no contienen tokens.
- Sin operaciones fuera de alcance: no hay login, roles, tablas comerciales ni despliegue.
- Defectos corregidos durante la etapa: conflicto de `@types/node` con Vitest 5; advertencia de Vite por cargar `vitest.config` ESM como CommonJS (renombrado a `.mts`); se eliminaron Google Fonts (dependencia de red en build) y los SVG de la plantilla no usados.
- `AGENTS.md`: se **añadió al final**, sin modificar el contenido existente, el bloque `nextjs-agent-rules` que `next dev` inserta automáticamente cuando detecta un agente; así el árbol de Git no queda con cambios espurios.

### Bloqueos

Ninguno. Los dos bloqueos anteriores quedaron resueltos:

1. **MCP de Supabase:** el proyecto de desarrollo `cgohbizokewvivxmvbij` está configurado en `.mcp.json` (Claude) y `.codex/config.toml` (Codex) con `features=database,development,debugging,docs` y sin modo de solo lectura; ambos clientes están autenticados por OAuth (los tokens no se guardan en el repositorio). Verificado por MCP (ver tabla anterior).
2. **`.env.local`:** creado localmente con la URL y la clave publicable; está excluido por `.gitignore` (`.env.*`) y no se versiona. La app muestra «Conexión con Supabase validada».

### Pendiente antes de E1

- Crear manualmente en el Dashboard el primer usuario administrador y deshabilitar el registro público (Auth > Sign In / Providers) cuando se inicie E1.

### Cierre de E0 (2026-10-25)

- Revisión previa al commit: el `.env.example` del árbol de trabajo tenía la URL real y la clave publicable del proyecto de desarrollo; se restauraron los valores ficticios exigidos por el contrato (§10). Los valores reales permanecen solo en `.env.local` (ignorado por `.gitignore`).
- Búsqueda de secretos en los archivos versionables (`sb_secret_`, JWT, claves `sb_publishable_` reales): sin coincidencias fuera de `.env.local` y de los valores ficticios de las pruebas.
- Repetidos `npm run lint` (OK), `npm run typecheck` (OK), `npm test` (13/13) y `npm run build` (OK).
- Se versionan `.mcp.json` y `.codex/config.toml` (solo la URL del MCP con el `project_ref` de desarrollo, sin tokens).

### Commit

- Arranque: `de98964`.
- Cierre de E0: `859aef1` (este registro del hash se añadió en un commit de documentación posterior).

---

## E1 — Acceso y catálogos

- **Fecha:** 2026-10-25 (America/Tegucigalpa; 2026-10-26 UTC)
- **Resultado:** APROBADO con configuraciones manuales pendientes (ver «Pendientes»). Todo lo implementado se verificó contra Supabase Cloud de desarrollo y en navegador real.

### Funcionalidad entregada

- **Autenticación** (Supabase Auth, correo y contraseña, `@supabase/ssr`): `/login`, inicio y cierre de sesión, cookies de sesión gestionadas por `@supabase/ssr` y refrescadas en [proxy.ts](../proxy.ts) con `getClaims()`. El proxy redirige a `/login?siguiente=…` toda ruta sin sesión (destino validado contra redirecciones abiertas) y `/login` al panel si ya hay sesión. La aplicación no ofrece registro.
- **Acceso solo para perfiles activos:** [lib/auth/sesion.ts](../lib/auth/sesion.ts) es la única fuente de identidad en el servidor (sesión verificada + perfil). Un usuario sin perfil activo es desconectado al iniciar sesión, va a `/sin-acceso` si conserva una sesión, y la RLS no le devuelve datos.
- **Roles** `administrador`, `operador`, `finanzas` en `public.perfiles`. El rol solo cambia con `public.actualizar_perfil` (administrador activo, nunca el propio rol/estado, motivo obligatorio al cambiar rol/estado, registro en `public.bitacora`). Matriz de permisos en el README.
- **Bootstrap del primer administrador:** `private.bootstrap_primer_administrador(correo, nombre)`, solo ejecutable por el propietario de la base (SQL Editor/MCP), no expuesta por la API, se niega si ya hay un administrador activo. Procedimiento en el README.
- **Catálogos** con listado (búsqueda y filtro activo/inactivo), alta, consulta y edición; las acciones se muestran según el rol y se vuelven a verificar en el servidor y en RLS: clientes (advertencia de posibles duplicados por nombre o identificación, sin bloquear), beneficiarios, vehículos (código y placa únicos, normalizados en mayúsculas), conductores, proveedores, planes de membresía, tarifas y cajas/bancos. Sin borrado: los registros se inactivan.
- **Administración de perfiles** en `/configuracion/usuarios` (solo administrador): listado, edición de nombre/rol/estado con motivo y bitácora por usuario.
- **Interfaz** en español, responsive (menú desplegable en móvil, barra lateral en escritorio, tarjetas en móvil y tabla en escritorio), modo claro/oscuro, montos HNL (`L 1,250.50`), fechas dd/mm/aaaa y horas en America/Tegucigalpa. Los módulos de etapas posteriores se anuncian como «Próximamente» sin rutas.
- Se retiró la pantalla de E0 (estado de conexión); [lib/supabase/estado-conexion.ts](../lib/supabase/estado-conexion.ts) se conserva con sus pruebas como utilidad de diagnóstico, sin uso en la interfaz.

### Archivos principales

- Acceso: [proxy.ts](../proxy.ts), [lib/supabase/proxy.ts](../lib/supabase/proxy.ts), [lib/auth/](../lib/auth/) (`sesion.ts`, `roles.ts`, `rutas.ts`), [app/login/](../app/login/), [app/sin-acceso/page.tsx](../app/sin-acceso/page.tsx).
- Catálogos: [lib/catalogos/](../lib/catalogos/) (definiciones, validación, Server Action `acciones.ts`), [components/catalogos/](../components/catalogos/), rutas en `app/(privado)/`.
- Usuarios: [lib/usuarios/acciones.ts](../lib/usuarios/acciones.ts), `app/(privado)/configuracion/usuarios/`.
- Tipos generados: [lib/supabase/tipos-bd.ts](../lib/supabase/tipos-bd.ts).
- Verificación: [scripts/verificar-rls.mjs](../scripts/verificar-rls.mjs), [scripts/e2e-navegador.mjs](../scripts/e2e-navegador.mjs).

### Cambios de esquema / migraciones (aplicadas en `cgohbizokewvivxmvbij` por MCP)

| Versión | Archivo | Contenido | Resultado |
|---|---|---|---|
| `20261026024644` | [e1_perfiles_y_acceso](../supabase/migrations/20261026024644_e1_perfiles_y_acceso.sql) | esquema `private`; enum `rol_usuario`; `perfiles`, `bitacora`; funciones `rol_activo`, `tiene_rol`, `es_usuario_activo`; triggers sobre `auth.users` (perfil inactivo al crear, sincronización de correo) y protección de perfiles; `actualizar_perfil`; `bootstrap_primer_administrador`; RLS; perfil inactivo para el usuario Auth existente | Aplicada |
| `20261026024721` | [e1_catalogos](../supabase/migrations/20261026024721_e1_catalogos.sql) | enums de tipos/estados/actividad; `clientes`, `beneficiarios`, `vehiculos`, `conductores`, `proveedores`, `planes`, `tarifas`, `cuentas_dinero` (PK uuid, `numeric(14,2)`, `CHECK`, `UNIQUE`, índices, columnas técnicas `created_at/updated_at/creado_por/actualizado_por` selladas por trigger); RLS y privilegios por rol (sin `DELETE`, sin acceso `anon`) | Aplicada |

- **Identidad repositorio = base:** el MD5 del SQL registrado en `supabase_migrations.schema_migrations` coincide con el de cada archivo (`cb5828e8…` y `6eeeb1c3…`). `.gitattributes` fija LF en `*.sql` para que Git en Windows no altere los archivos.
- No se crearon tablas financieras, de membresías ni de servicios. `categorias_gasto` se deja para E2 (la usan los gastos); los catálogos técnicos de E1 son los enums.
- Advisors de seguridad tras el DDL: (1) `actualizar_perfil` es SECURITY DEFINER ejecutable por `authenticated`: **intencional**, es el único camino de cambio de rol y valida internamente; (2) protección de contraseñas filtradas desactivada (ajuste manual de Auth). Advisors de rendimiento: solo «índice sin uso» (tablas recién creadas).

### Datos en Supabase de desarrollo

- **Usuarios ficticios** (dominio reservado `example.com`): `prueba.admin`, `prueba.operador`, `prueba.finanzas`, `prueba.inactivo`. Contraseñas aleatorias guardadas solo fuera del repositorio. Al terminar las pruebas se dejaron **todos inactivos** para que el bootstrap del administrador real funcione; el administrador puede reactivarlos desde `/configuracion/usuarios` para repetir las pruebas.
- **Registros ficticios** marcados `[PRUEBA E1]` / `PRB-…` (clientes, vehículos, planes, tarifa, caja, proveedor, beneficiarios y conductores). Deben excluirse de producción (el proyecto de producción será otro).
- **Cuenta real `administraciontio@gmail.com`:** queda con perfil **inactivo** (rol operador), a la espera del bootstrap por el propietario. Incidente: al probar el bootstrap envié dos llamadas en paralelo; el sistema de permisos denegó la primera, pero la segunda —que esperaba que fallara— la habilitó como administrador con el nombre «Otro intento». Lo revertí de inmediato (inactiva, operador, nombre original) y quedó en la bitácora (`bootstrap_primer_administrador` y `revertir_bootstrap`).

### Comandos y pruebas (2026-10-25, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` | OK, 0 errores / 0 advertencias |
| `npm run typecheck` | OK |
| `npm test` | OK, 5 archivos, 35 pruebas (validación de catálogos, montos sin float, fechas, permisos por rol, rutas públicas, redirección segura, formato HNL/zona horaria, configuración y conexión de E0) |
| `npm run build` | OK; rutas privadas como Partial Prerender, `proxy.ts` activo |
| `npm audit` | 0 vulnerabilidades |
| `node scripts/verificar-rls.mjs` (API REST real) | **61/61** |
| `node scripts/e2e-navegador.mjs` (Edge sin interfaz, `next start`) | **43/43**; log del servidor sin errores |
| Bootstrap por SQL | Éxito con el administrador ficticio; segundo intento rechazado («Ya existe un administrador activo») |
| Consultas MCP de persistencia | Registros creados por la app presentes en Cloud, con `creado_por/actualizado_por` correctos |

**Escenarios verificados en RLS (API REST con sesiones reales):** `anon` no lee ninguna de las 10 tablas, no inserta ni ejecuta `actualizar_perfil`; el bootstrap no está expuesto. Administrador: activa usuarios con motivo, rechazo sin motivo, no cambia su rol ni se desactiva, ve perfiles y bitácora, registra planes/tarifas/cajas, `CHECK` de precio negativo y de tarifa «general», unicidad de código y placa (varios NULL permitidos), código no normalizado rechazado. Usuario inactivo: solo ve su perfil, ningún catálogo, no inserta. Operador: registra/edita clientes, beneficiario menor sin identidad, conductor y vehículo; no borra; no registra planes, tarifas ni cajas; solo ve su perfil; no ve la bitácora; no cambia su rol (UPDATE directo, función, ni el de otro); no inserta perfiles; `creado_por` no se puede falsear. Finanzas: consulta clientes; no registra/edita clientes, beneficiarios, conductores, vehículos ni cajas; registra proveedores; no cambia su rol.

**Escenarios verificados en navegador:** redirección al login sin sesión (y regreso a la ruta pedida), sin registro público, contraseña incorrecta, usuario inactivo rechazado sin sesión residual, `/login` con sesión → panel, menú según rol, validación en servidor conservando lo escrito, alta/edición de cliente y de vehículo persistidas, advertencia de duplicado con confirmación, búsqueda y filtro, error de código repetido en el campo, restricciones del operador, solo lectura para finanzas, edición de perfiles por el administrador (propio rol bloqueado, motivo obligatorio), plan con monto `1,250.5` → `1250.50` y listado en HNL, cierre de sesión y rutas protegidas después. Móvil (390×844): sin desplazamiento horizontal, tarjetas, menú plegable; escritorio (1280×800): barra lateral y tablas.

### Defectos encontrados y corregidos durante la etapa

1. **Error `Date.now()` al prerenderizar** en todas las rutas privadas: con Partial Prefetching el «App Shell» incluye la lectura de cookies y `getClaims()` consulta la hora. Corregido con `await connection()` en `obtenerSesion` (la sesión y los datos se resuelven siempre por solicitud).
2. **Pantalla en blanco al enviar un formulario antes de la hidratación:** con Cache Components, la respuesta a un envío nativo (sin JS) que devuelve un estado de error llega sin HTML. Corregido deshabilitando los botones de envío hasta hidratar ([components/use-hidratado.ts](../components/use-hidratado.ts)). Consecuencia: la aplicación requiere JavaScript.
3. Prueba de RLS no idempotente (dependía de que el operador estuviera inactivo); corregida.
4. Página de error del grupo privado en español (`app/(privado)/error.tsx`); se añadió después de la última corrida E2E y no cambia los flujos probados (lint, typecheck, pruebas y build repetidos).

### Pendientes (configuración manual del propietario)

1. **Deshabilitar el registro público** en Supabase › Authentication › Sign In / Providers («Allow new users to sign up»). Hoy `disable_signup = false`; mitigado porque toda cuenta nueva nace inactiva y sin acceso, pero debe desactivarse.
2. ~~Bootstrap del administrador real~~ **Resuelto (2026-10-25):** a pedido expreso del propietario se ejecutó `private.bootstrap_primer_administrador('administraciontio@gmail.com', 'Administrador')`; el perfil quedó `administrador` y activo, con registro en la bitácora. Antes de ejecutarlo, el perfil figuraba con rol `administrador` pero inactivo, un cambio hecho fuera de la aplicación después de la reversión del incidente.
3. Activar la protección de contraseñas filtradas en Auth si el plan lo permite.

### Limitaciones

- Un registro inexistente o un ID no válido muestra la página «no existe», pero con HTTP 200: el contenido privado se transmite en streaming dentro de `<Suspense>` y el estado HTTP ya se envió. No afecta a la seguridad (la RLS no devuelve datos) ni al usuario.
- `private.bootstrap_primer_administrador` comprueba «no hay administrador activo» sin bloqueo: dos ejecuciones simultáneas del propietario podrían habilitar a dos usuarios. Riesgo bajo: solo la ejecuta el propietario por SQL y, con el administrador real activo, ya se rechaza siempre.
- La aplicación requiere JavaScript para enviar formularios (ver defecto 2). Los listados muestran hasta 200 registros (se pide refinar la búsqueda).
- La advertencia de duplicados compara nombre igual (sin distinguir mayúsculas) e identificación igual; no detecta variantes ortográficas.
- `perfiles` referencia `auth.users` con `ON DELETE RESTRICT`: una cuenta con perfil no se puede borrar desde el Dashboard; se desactiva.
- No se probó en un teléfono físico: la vista móvil se verificó con emulación de 390×844 en Edge.

### Revisión posterior al commit de E1 (2026-10-26)

**Cambios revisados e incluidos** (sin cambios de esquema):

- Navegación inmediata: los listados, altas y detalles de catálogos y de usuarios muestran el encabezado al instante y cargan la sesión y los datos dentro de `<Suspense>` ([components/catalogos/paginas.tsx](../components/catalogos/paginas.tsx), `app/(privado)/configuracion/usuarios/`). El botón «Nuevo…» se resuelve aparte según el rol. Las verificaciones de sesión y rol no cambian: cada componente asíncrono llama a `requerirUsuario()`, que se ejecuta una sola vez por solicitud gracias a `cache`.
- El indicador «Cargando…» pasa a ser el componente `Cargando` de [components/encabezado.tsx](../components/encabezado.tsx), reutilizado por `app/(privado)/loading.tsx`.
- Pendiente 2 (bootstrap del administrador real) marcado como resuelto. Bitácora: `bootstrap_primer_administrador` a las 03:21:50 UTC. La bitácora no tiene ninguna entrada del paso intermedio a «administrador inactivo», lo que confirma que ese cambio se hizo fuera de la aplicación.

**Revisión propia:** migraciones, RLS, Server Actions, proxy, sesión, validación (montos como texto decimal, búsqueda saneada para `or` de PostgREST, destino de login sin redirección abierta). No se hallaron defectos que exijan cambios de código ni de esquema; dos observaciones menores se anotaron en «Limitaciones».

**Verificaciones repetidas (2026-10-26, Node 24.22.0, Windows 11):**

| Comprobación | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | OK / OK |
| `npm test` | OK, 5 archivos, 35 pruebas |
| `npm run build` | OK; rutas privadas como Partial Prerender |
| `npm audit` | 0 vulnerabilidades |
| `node scripts/verificar-rls.mjs` | **61/61** |
| `node scripts/e2e-navegador.mjs` contra `next start` | **43/43**; log del servidor sin errores |
| Comprobación adicional en navegador (operador) | 5/5: cliente inexistente e ID no válido muestran «no existe» sin quedarse en «Cargando…»; detalle de usuario muestra aviso de permiso; botón «Nuevo cliente» visible |
| MCP `list_migrations` + MD5 de `schema_migrations` | Mismas 2 migraciones; MD5 idéntico al de los archivos (`cb5828e8…`, `6eeeb1c3…`) |
| MCP `get_advisors` (security) | Los mismos 2 avisos ya documentados |
| Búsqueda de secretos en archivos versionados | Sin coincidencias (solo los valores ficticios de `.env.example`) |

**Datos de desarrollo:** para repetir las pruebas se reactivaron temporalmente `prueba.admin`, `prueba.operador` y `prueba.finanzas` por SQL y después se volvieron a desactivar. Las dos operaciones quedaron en la bitácora (`reactivar_usuario_prueba` y `desactivar_usuario_prueba`). Las pruebas añadieron registros ficticios marcados `[PRUEBA E1]`. Estado final: solo el administrador real está activo.

### Commit

- E1: `58e37ae`.
- Revisión posterior: `26a2a15`.

---

## E2 — Núcleo financiero

- **Fecha:** 2026-10-26 (America/Tegucigalpa)
- **Resultado:** APROBADO. Todo lo implementado se verificó contra Supabase Cloud de desarrollo (`cgohbizokewvivxmvbij`, comprobado con `get_project_url` antes de cada cambio), por API REST con usuarios reales y en navegador real.

### Funcionalidad entregada

- **Cargos a clientes:** cargo administrativo (origen `manual`, solo administrador) con cliente, línea de ingreso (membresías, ambulancias particulares, alquileres, transportes), concepto, fecha, vencimiento opcional e importe. `UNIQUE (origen_tipo, origen_id)`: un mismo evento no genera dos cargos. Pendiente = importe − aplicaciones vigentes. Los cargos de E3–E5 llegarán por sus módulos.
- **Cobros:** cliente, caja o banco, fecha, método (`efectivo`, `transferencia`, `tarjeta`, `otro`), referencia opcional e importe. Se aplican total o parcialmente a uno o varios cargos del mismo cliente; el sobrante queda como **saldo a favor**. Todo cobro entra una sola vez en la caja o banco.
- **Anticipos:** un cobro sin cargos queda íntegro como saldo a favor, sin vencimiento. «Aplicar saldo a favor» lo traslada a un cargo tomando primero los cobros más antiguos, sin nueva entrada de dinero.
- **Gastos y pagos:** gasto con proveedor opcional, categoría, actividad (incluida `general`), fecha, vencimiento, concepto, importe y notas; pago inmediato opcional (contado o abono) y pagos parciales posteriores. Por pagar = gasto − pagos confirmados.
- **Caja y bancos:** saldo por cuenta = suma de movimientos confirmados (no existe columna de saldo); movimientos por cuenta; transferencias entre cuentas; saldo inicial documentado (uno vigente por cuenta, con contrapartida en capital).
- **Contabilidad automática:** plan mínimo con 1100 Caja y bancos (desglosada por caja o banco), 1200 CxC, 2100 CxP, 2200 Anticipos, 3100 Capital y saldos iniciales, 4100–4400 ingresos por línea y 5100–5900 gastos por categoría. Cada evento genera su asiento con las plantillas de la especificación; `UNIQUE (origen_tipo, origen_id, evento)`. Sin pantalla de asientos manuales: los asientos de cada documento se muestran en solo lectura (administrador y finanzas).
- **Reversos y anulaciones** (solo administrador, con motivo y confirmación obligatorios y registro en la bitácora): reversar cobro (primero reversa sus aplicaciones), reversar aplicación, anular cargo (lo aplicado vuelve al saldo a favor), reversar pago de gasto, anular gasto (exige reversar antes sus pagos), reversar transferencia y reversar saldo inicial. Cada reverso crea el asiento espejo y el contramovimiento; el original queda marcado y nada se borra.
- **Interfaz:**
  - `/finanzas/cobros`: listado, alta en dos pasos (buscar cliente y registrar con aplicación a cargos) y detalle.
  - `/finanzas/cargos`: listado, alta y detalle con aplicar saldo y anular.
  - `/finanzas/pendientes`: CxC por cliente con saldo a favor y CxP; `/finanzas/pendientes/[cliente]` es el estado de cuenta.
  - `/finanzas/gastos`: listado, alta con pago inmediato y detalle con abonos.
  - `/finanzas/cuentas`: saldos y total disponible; el detalle de cuenta muestra saldo, saldo inicial y movimientos; `/finanzas/cuentas/transferir` y detalle de transferencia.
  - Listados con búsqueda, estado y rango de fechas; importes Total / Pagado / Pendiente / Saldo a favor siempre visibles. El panel muestra CxC, saldos a favor, CxP y dinero disponible. Menú y acciones según el rol.

### Decisiones (opción más simple compatible con la especificación)

- **Permisos:** cobros y aplicación de saldo a favor, los tres roles (el operador registra cobros, §2). Gastos, pagos y transferencias: administrador y finanzas. Cargos manuales, saldos iniciales, reversos y anulaciones: solo administrador («ajustes administrativos», §2). Lectura: cargos, cobros y saldos de clientes para todos; tesorería, gastos y asientos para administrador y finanzas.
- **Idempotencia:** cada formulario lleva una clave UUID nueva. Un reintento con la misma clave devuelve lo ya registrado; con otros datos, se rechaza.
- **1100 Caja y bancos** es una sola cuenta contable, desglosada en las líneas por `cuenta_dinero_id`; así la transferencia es D 1100 (destino) / H 1100 (origen).
- **Saldos contables:** suman todas las líneas, originales y reversos; `asientos.estado = 'reversado'` es solo informativo.
- Las fechas de las operaciones no pueden ser futuras; el reverso se fecha el día en que se registra.
- No se impide dejar una caja en negativo (la especificación no lo prevé).
- Las categorías de gasto se crean con la migración (combustible, mantenimiento, salarios, servicios, otros), sin pantalla de edición.

### Archivos principales

- Migraciones: [estructura](../supabase/migrations/20261026190818_e2_finanzas_estructura.sql), [operaciones](../supabase/migrations/20261026191029_e2_finanzas_operaciones.sql), [corrección](../supabase/migrations/20261026192721_e2_finanzas_triggers_definer.sql).
- Aplicación: [lib/finanzas/](../lib/finanzas/) (`acciones.ts` Server Actions, `definiciones.ts` formularios, `montos.ts` importes en centavos, `consultas.ts`), [components/finanzas/](../components/finanzas/), rutas en `app/(privado)/finanzas/` y permisos en [lib/auth/roles.ts](../lib/auth/roles.ts).
- Verificación: [scripts/verificar-finanzas.mjs](../scripts/verificar-finanzas.mjs) y [scripts/e2e-finanzas.mjs](../scripts/e2e-finanzas.mjs); el control de Edge se extrajo de `e2e-navegador.mjs` a [scripts/navegador.mjs](../scripts/navegador.mjs) y el cliente REST común está en [scripts/comun.mjs](../scripts/comun.mjs). Pruebas unitarias en [lib/finanzas/finanzas.test.ts](../lib/finanzas/finanzas.test.ts).

### Cambios de esquema / migraciones (aplicadas en `cgohbizokewvivxmvbij` por MCP)

| Versión | Archivo | Contenido | MD5 (archivo = `schema_migrations`) |
|---|---|---|---|
| `20261026190818` | `e2_finanzas_estructura` | 11 enums; tablas `cuentas_contables` (14 cuentas), `categorias_gasto` (5), `cargos_cliente`, `cobros_cliente`, `aplicaciones_cobro` (FK compuestas que garantizan el mismo cliente), `gastos`, `pagos_gasto`, `transferencias` (cabecera técnica), `asientos`, `lineas_asiento` y `movimientos_dinero`; índices; triggers de invariantes (aplicación y pago sin exceder saldos, con bloqueo de filas); trigger diferido de cuadre (Debe = Haber y 1100 = movimientos); protección del historial (sin DELETE ni TRUNCATE ni cambio de importes, ni siquiera por el propietario); vistas `saldos_cargos`, `saldos_cobros`, `saldos_clientes`, `saldos_gastos` y `saldos_cuentas_dinero` (`security_invoker`); RLS de solo lectura por rol | `1e058744…` |
| `20261026191029` | `e2_finanzas_operaciones` | 14 funciones públicas `SECURITY DEFINER` con `search_path` vacío y verificación de rol: `registrar_cargo`, `anular_cargo`, `registrar_cobro`, `aplicar_saldo_a_favor`, `reversar_aplicacion`, `reversar_cobro`, `registrar_gasto`, `registrar_pago_gasto`, `reversar_pago_gasto`, `anular_gasto`, `registrar_transferencia`, `reversar_transferencia`, `registrar_apertura` y `reversar_apertura`; 18 auxiliares en `private`, sin acceso desde la API | `d4f779e9…` |
| `20261026192721` | `e2_finanzas_triggers_definer` | Corrección del defecto 1: los triggers de integridad pasan a `SECURITY DEFINER` | `9432eb90…` |

- Antes de aplicar se comprobó que ningún nombre nuevo existiera. Las migraciones solo crean objetos: E1 no se modificó y solo se referencia por FK. Tipos regenerados en [lib/supabase/tipos-bd.ts](../lib/supabase/tipos-bd.ts).
- Advisors de seguridad: los 14 avisos nuevos «SECURITY DEFINER ejecutable por authenticated» son **intencionales**, porque son las únicas vías de escritura y validan identidad, rol y datos. Se mantiene el aviso manual de contraseñas filtradas. Advisors de rendimiento: solo «índice sin uso» (tablas nuevas).

### Comandos y pruebas (2026-10-26, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | OK / OK |
| `npm test` | OK, 6 archivos, **46 pruebas** (11 nuevas: importes en centavos sin float, permisos financieros y validación de formularios) |
| `npm run build` | OK; las 15 rutas financieras como Partial Prerender |
| `npm audit` | 0 vulnerabilidades |
| `node scripts/verificar-finanzas.mjs` (API REST, usuarios reales) | **75/75** |
| `node scripts/verificar-rls.mjs` (regresión E1) | **61/61** |
| `node scripts/e2e-finanzas.mjs` (Edge sin interfaz, `next start`) | **28/28**; log del servidor sin errores |
| `node scripts/e2e-navegador.mjs` (regresión E1) | **43/43** |
| Invariantes por SQL (MCP) sobre todo el libro, tras todas las corridas | 93 asientos: 0 descuadrados, 0 sin líneas, 0 cajas o bancos con movimientos distintos de sus líneas de 1100, 0 sobreaplicaciones, 0 aplicaciones entre clientes distintos, 0 movimientos duplicados; libro neto 0.00 |
| Defensas contra el propietario (SQL, revertido) | DELETE, TRUNCATE, cambiar un importe, «des-reversar» y editar un movimiento: todos rechazados por los triggers |

**Pruebas obligatorias contra Supabase (`verificar-finanzas.mjs`):**

1. Cargo de L 1,500 y cobro de L 500: total 1,500, aplicado 500, pendiente 1,000 y una sola entrada de L 500 en caja. Asientos: D CxC / H ingreso; D caja / H anticipos; D anticipos / H CxC, sin movimiento de caja.
2. Anticipo de L 700 sin cargo: saldo a favor 700 y caja +700. Tras un cargo de L 1,000 y la aplicación: pendiente 300 y saldo a favor 0, sin nuevo movimiento de dinero.
3. Gasto de L 800 con pago de L 300: gasto 800, salida de caja 300 y CxP 500. Asientos D 5100 / H CxP y D CxP / H caja; el gasto no se duplica. Un abono de L 600, mayor que lo pendiente, se rechaza.
4. Transferencia de L 1,000: Caja −1,000, Banco +1,000, total igual y solo líneas de 1100. Una transferencia a la misma cuenta se rechaza.
5. Idempotencia: los reintentos secuenciales y **simultáneos** (3 en paralelo) de un cobro dejan un cobro, un movimiento y un asiento. Cargo, gasto pagado de contado, transferencia y aplicación de saldo reintentados en paralelo se registran una vez. Una clave reutilizada con otros datos se rechaza.
6. Sobreaplicación: se rechaza aplicar más que el pendiente del cargo, más que el saldo a favor o más que el importe del cobro (en este caso el cobro no se registra). De **dos aplicaciones simultáneas** contra el mismo anticipo solo prospera una.
7. Aislamiento: el cobro de un cliente no se aplica al cargo de otro y no deja rastro; el saldo a favor de un cliente no paga cargos de otro.
8. Todos los asientos balancean, ningún evento tiene dos asientos y cada caja o banco cuadra con sus líneas de 1100.
9. Permisos:
   - anon no lee ninguna de las 16 tablas o vistas ni ejecuta funciones; un usuario inactivo no tiene acceso.
   - Operador y finanzas no registran cargos manuales.
   - El operador no registra gastos ni transferencias, ni ve tesorería, asientos o gastos.
   - Solo el administrador reversa y registra saldos iniciales.
   - Nadie, ni siquiera el administrador, inserta, edita o borra directamente cobros, movimientos, asientos, líneas o aplicaciones.
10. Error intermedio: un gasto con pago inválido no deja gasto. Un cobro cuya segunda aplicación falla no deja cobro, aplicaciones ni dinero. El reintento corregido con la misma clave se registra una sola vez.
11. Reversos:
    - Sin motivo, se rechazan.
    - El cobro reversado se conserva con autor y motivo; sus aplicaciones quedan reversadas, el asiento original marcado con su espejo, y el contramovimiento es de −500. Un cobro no se reversa dos veces.
    - Un gasto con pagos no se anula hasta reversarlos.
    - Se reversa una transferencia.
    - Anular un cargo devuelve lo aplicado al saldo a favor.
    - Los cinco quedan en la bitácora.

**Escenarios en navegador (`e2e-finanzas.mjs`):**

- Menú según el rol.
- Operador: busca un cliente y registra un cobro con aplicación (con error si aplica más de lo recibido, conservando lo escrito); consulta el estado de cuenta; no ve gastos, saldos de caja ni asientos.
- Finanzas: registra un gasto con abono y una transferencia; ve los saldos (Caja L 1,200 = 2,000 + 500 − 300 − 1,000; Banco L 1,000); no registra saldos iniciales.
- Administrador: ve los indicadores del panel, registra un anticipo y lo aplica desde el cargo, reversa un cobro (rechazado mientras no confirma la casilla) y el cargo vuelve a quedar pendiente.
- Móvil 390×844: sin desplazamiento horizontal y con tarjetas.

### Datos en Supabase de desarrollo

- Registros ficticios marcados `[PRUEBA E2]`: clientes, cajas y bancos, cargos, cobros, gastos, transferencias, saldos iniciales y sus asientos. Por diseño no se pueden borrar; el proyecto de producción será otro y no los contendrá.
- Los usuarios ficticios se reactivaron temporalmente para las pruebas y **se desactivaron de nuevo** al final (bitácora: `reactivar_usuario_prueba` / `desactivar_usuario_prueba`). Solo el administrador real queda activo, y no se crearon datos financieros con su cuenta.

### Defectos encontrados y corregidos durante la etapa

1. **Cobro del operador rechazado como «asiento descuadrado (Debe 0, Haber 0)».** El trigger diferido de cuadre se ejecuta al confirmar, con el rol del usuario, y la RLS le ocultaba al operador las líneas del asiento. La prueba de humo con el administrador no lo detectó; sí `verificar-finanzas.mjs`. Corregido con la migración `20261026192721` (triggers de integridad `SECURITY DEFINER`). La transacción fallida no dejó rastro.
2. **Las casillas no mostraban su error.** El formulario genérico no pintaba el mensaje de los campos booleanos («Marque la casilla para confirmar»). Corregido en [components/catalogos/formulario-catalogo.tsx](../components/catalogos/formulario-catalogo.tsx).
3. **Estado del formulario tras un error de la base.** La primera versión de las Server Actions reemplazaba los valores escritos al devolver el error. Corregido antes de las pruebas: ahora solo se devuelven el error y los mensajes por campo.
4. **Saldo inicial fuera de los últimos 200 movimientos.** El detalle de la cuenta dejaba de detectarlo; ahora se consulta aparte.
5. `corregir` valida el tipo de corrección con `Object.hasOwn`, porque los argumentos enlazados llegan del cliente.

### Pendientes (configuración manual del propietario, sin cambios desde E1)

1. Deshabilitar el registro público en Supabase › Authentication › Sign In / Providers.
2. Activar la protección de contraseñas filtradas si el plan lo permite.

### Limitaciones

- En E2 solo hay cargos administrativos; membresías, traslados, alquileres y transportes generarán los suyos en E3–E5, añadiendo valores a `origen_cargo`.
- Las categorías de gasto son fijas (sin pantalla de edición).
- Los listados muestran hasta 200 registros (500 en Pendientes) con filtros, y los totales de un listado suman solo lo mostrado.
- El detalle del cargo muestra la actividad, no la línea de ingreso, porque el operador no tiene acceso al plan de cuentas.
- La caja puede quedar en negativo. No hay conciliación bancaria ni reportes (E6).
- Las pruebas de navegador se ejecutaron en el puerto 3100 porque el 3000 estaba ocupado por un `next dev` del usuario, que no se tocó.

### Commit

E2: `22bc0dc`.

---

## E3 — Membresías

- **Fecha:** 2026-10-26 (America/Tegucigalpa)
- **Resultado:** APROBADO. Todo se verificó contra Supabase Cloud de desarrollo (`cgohbizokewvivxmvbij`, comprobado con `get_project_url` antes de aplicar cambios), por API REST con usuarios reales, por SQL y en navegador real.

### Funcionalidad entregada

- **Alta de membresías** (administrador y operador): buscar cliente → elegir plan activo y fecha de inicio → revisar condiciones (precio, cupo, modalidad, gracia y primeros períodos) y marcar beneficiarios → confirmar. Se copian las condiciones del plan. Solo el administrador puede pactar condiciones particulares. La fecha de inicio puede ser pasada: se generan los períodos transcurridos.
- **Beneficiarios:** varios por membresía; un beneficiario puede estar en varias membresías. Las altas y bajas (con motivo) se conservan como historial; solo un vínculo activo por beneficiario y membresía.
- **Mensualidades:** cada período (inicio, fin, precio, cupo, modalidad, gracia y límite de pago) genera un solo cargo de E2 en la misma transacción. Las renovaciones se calculan desde el día de anclaje (31 ene → 28 feb → 31 mar → 30 abr). `UNIQUE (membresia_id, inicio)` y `UNIQUE (origen_tipo, origen_id)` impiden duplicados.
- **Actualizar mensualidades:** botón en el listado y en el detalle; al abrir el panel (Server Action por POST, nunca en el GET); y tras cada cobro o aplicación de saldo registrados desde la aplicación. Es idempotente, sin cron, y solo genera hasta hoy.
- **Pagos:** solo con E2 (cobro completo, parcial, anticipado y aplicación de saldo a favor), sin tablas de cobro nuevas. El detalle enlaza a «Registrar cobro» y cada cuota, a su cargo.
- **Morosidad:** la cuota vence al inicio del período y su límite es inicio + días de gracia. Pasado el límite con saldo, la membresía queda suspendida desde el día siguiente. No genera cuotas mientras está suspendida, no cubre traslados y conserva deudas, pagos, beneficiarios e historial.
- **Reactivación automática** al saldar las cuotas vencidas: si la renovación pendiente ya pasó, empieza un ciclo nuevo desde la fecha de reactivación (nuevo día de anclaje y nueva cuota) y los meses suspendidos no se cobran. Si se salda antes, el ciclo continúa igual. La fecha de afiliación no cambia y la bitácora registra el día de anclaje anterior y el nuevo. Una cancelada no se reactiva.
- **Edición de condiciones** (administrador, con motivo): se aplica a los ciclos futuros; los períodos generados conservan las suyas.
- **Cancelación** (administrador, con motivo y confirmación): antes genera los períodos ya iniciados; después no renueva. Las deudas se conservan.
- **Cobertura y cupo:** `consultar_cobertura(membresía, beneficiario, fecha)` comprueba estado, vínculo en la fecha, período generado, morosidad y cupo del período (compartido o individual), y avisa de cuotas en gracia. Si el período aún no existe, responde «pendiente de validación». El cupo no se acumula entre meses. No reserva ni consume nada.
- **Interfaz `/membresias`:**
  - Listado con cliente, plan, estado, próxima renovación, beneficiarios, saldo pendiente y vencido; búsqueda y filtro por estado.
  - Alta en tres pasos.
  - Detalle con información general, condiciones, beneficiarios, disponibilidad de hoy, mensualidades pagadas, pendientes y vencidas, cancelación e historial.
  - El panel muestra membresías activas, suspendidas, cuotas vencidas e importe vencido. El detalle del cargo enlaza a su membresía.

### Decisiones (opción más simple compatible con la especificación)

- **Permisos:** consultar, actualizar mensualidades y cobrar, los tres roles (actualizar solo materializa lo que fijan las condiciones). Crear membresías y gestionar beneficiarios, administrador y operador. Condiciones particulares, edición de condiciones y cancelación, solo administrador («gestiona las membresías y sus condiciones»).
- **Reactivación sin modificar E2:** no se añadieron triggers a las tablas financieras. La reactivación ocurre al actualizar mensualidades, que se ejecuta tras cada cobro o aplicación desde la aplicación y al abrir el panel. Su fecha efectiva es el día en que se ejecuta.
- **Morosidad evaluada con el estado actual:** al ponerse al día, una renovación no se genera si alguna cuota ya estaba vencida antes de ella. Se usan los pagos registrados hasta ese momento, no la fecha de cada pago.
- **Reactivación dentro del mismo período:** si la deuda se salda antes de la renovación siguiente, no hay meses saltados y el ciclo sigue igual. Así no se cobra dos veces el mismo tramo.
- **Precio 0:** el período se genera sin cargo (`cargo_id` nulo) y nunca genera morosidad.
- **Beneficiario dado de baja:** pierde la cobertura desde el día de la baja.
- **Integración con E4 preparada:** `private.cupo_ocupado(periodo, beneficiario)` devuelve hoy 0 porque no hay traslados. E4 la reemplazará para contar reservas válidas y consumos reales. `private.registrar_cargo_servicio` queda disponible para los cargos de E4 y E5 con la plantilla de E2.

### Archivos principales

- Migraciones: [origen](../supabase/migrations/20261026210357_e3_membresias_origen.sql), [estructura](../supabase/migrations/20261026210430_e3_membresias_estructura.sql) y [operaciones](../supabase/migrations/20261026210603_e3_membresias_operaciones.sql).
- Aplicación:
  - [lib/membresias/](../lib/membresias/): `acciones.ts` (Server Actions), `definiciones.ts` (formularios y etiquetas) y `fechas.ts` (espejo del cálculo de renovaciones para la vista previa).
  - [lib/operaciones.ts](../lib/operaciones.ts): esqueleto común de las Server Actions, extraído de `lib/finanzas/acciones.ts`. No es `"use server"`, así que no queda expuesto como acción.
  - [components/membresias/](../components/membresias/) y rutas en `app/(privado)/membresias/`.
  - Permisos en [lib/auth/roles.ts](../lib/auth/roles.ts).
- Verificación: [scripts/verificar-membresias.mjs](../scripts/verificar-membresias.mjs), [scripts/e2e-membresias.mjs](../scripts/e2e-membresias.mjs) y [lib/membresias/membresias.test.ts](../lib/membresias/membresias.test.ts).

### Cambios de esquema / migraciones (aplicadas en `cgohbizokewvivxmvbij` por MCP)

| Versión | Archivo | Contenido | MD5 (archivo = `schema_migrations`) |
|---|---|---|---|
| `20261026210357` | `e3_membresias_origen` | Valor `periodo_membresia` en `origen_cargo`. Va en una migración propia porque un valor nuevo de enum no puede usarse en la misma transacción | `7094cf75…` |
| `20261026210430` | `e3_membresias_estructura` | Enum `estado_membresia`; tablas `membresias`, `membresia_beneficiarios` (índice único parcial de vínculo activo) y `periodos_membresia` (`UNIQUE (membresia_id, inicio)`, límite de pago generado, cargo obligatorio si hay precio); índices; sin DELETE ni TRUNCATE en las tres, y períodos inmutables; vistas `saldos_periodos` y `saldos_membresias` (`security_invoker`); RLS de solo lectura para los tres roles activos | `3fec3feb…` |
| `20261026210603` | `e3_membresias_operaciones` | 8 funciones públicas `SECURITY DEFINER` con `search_path` vacío, `auth.uid()` y rol verificados; 8 auxiliares en `private`, sin acceso desde la API | `f0e10d73…` |

- Antes de aplicar se comprobó que ningún nombre nuevo existiera. Las migraciones solo crean objetos: no modifican tablas ni funciones de E1 o E2, solo añaden un valor al enum `origen_cargo`, previsto en E2.
- Tipos regenerados en [lib/supabase/tipos-bd.ts](../lib/supabase/tipos-bd.ts).
- **Permisos de E2 reutilizados (verificado por SQL):** ninguna función es ejecutable por `anon`; ninguna función de `private` lo es por `authenticated` (salvo los ayudantes de rol de E1); todas tienen `search_path` vacío. `registrar_cobro` y `aplicar_saldo_a_favor` siguen exigiendo rol activo.
- Advisors de seguridad: 8 avisos nuevos «SECURITY DEFINER ejecutable por authenticated», **intencionales** como en E2, y el aviso manual de contraseñas filtradas. Rendimiento: solo «índice sin uso».

### Comandos y pruebas (2026-10-26, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | OK / OK |
| `npm test` | OK, 7 archivos, **58 pruebas** (12 nuevas: renovaciones 28–31 y bisiestos, permisos y formularios) |
| `npm run build` | OK (`/membresias`, `/membresias/nueva`, `/membresias/[id]`) |
| `npm audit` | 0 vulnerabilidades |
| `node scripts/verificar-membresias.mjs` (API REST, usuarios reales) | **92/92** (dos ejecuciones) |
| `node scripts/e2e-membresias.mjs` (Edge sin interfaz, `next start`) | **25/25** (tres ejecuciones seguidas); log del servidor sin errores |
| Regresión E1: `verificar-rls.mjs` / `e2e-navegador.mjs` | **61/61** / **43/43** |
| Regresión E2: `verificar-finanzas.mjs` / `e2e-finanzas.mjs` | **75/75** / **28/28** |
| SQL (MCP): fechas de `private.siguiente_renovacion` | 31/12/2023 → 31/01 → 29/02/2024 → 31/03; 29, 30 y 31 de enero de 2026 → 28/02; vuelve al día de anclaje |
| SQL (MCP): `private.calcular_disponibles` con usos simulados como argumentos | compartido 2 − 2 de otros = 0; individual 2 con 2 de otros = 2; nunca negativo |
| Defensas contra el propietario (SQL, revertido) | DELETE de período, membresía o vínculo, UPDATE de período, TRUNCATE, período duplicado y vínculo activo duplicado: todos rechazados |
| Invariantes del libro (SQL), tras todas las corridas | 293 asientos, 0 descuadrados, 0 cajas descuadradas, libro neto 0.00; 80 períodos con precio = 80 cargos de mensualidad; 0 movimientos de dinero por cargos o aplicaciones; 0 períodos solapados o duplicados; 0 activas atrasadas o morosas |

**Pruebas obligatorias (`verificar-membresias.mjs`, salvo indicación):**

1. El operador crea una membresía con dos beneficiarios; se copian las condiciones del plan. Un reintento con la misma clave devuelve la misma membresía; con otros datos se rechaza; sin beneficiarios se rechaza.
2. El administrador crea una membresía con condiciones particulares (L 450, cupo 3, individual, gracia 10). Al editarlas a L 600, el período ya generado conserva L 450. Cambiar el precio del plan no altera membresías ni períodos.
3. Primera mensualidad: un período de hoy al día anterior a la renovación y un cargo de L 500 (vence al inicio), con asiento D 1200 / H 4100 y sin movimiento de caja.
4. Renovación mensual: una membresía iniciada hace un mes tiene 2 períodos contiguos, un cargo por período y nada futuro.
5. Aniversarios 28, 29, 30 y 31 de enero de 2026, 29/01/2024 y 31/12/2023: las series generadas coinciden con el cálculo esperado (28/02, 29/02/2024 y regreso al 31).
6. Dos ejecuciones seguidas de «Actualizar mensualidades» no generan nada nuevo.
7. Concurrencia:
   - Tres actualizaciones simultáneas de una membresía recién saldada producen una reactivación y un solo período nuevo.
   - Tres altas simultáneas con la misma clave dejan una sola membresía.
   - Tres actualizaciones generales en paralelo terminan sin error.
8. Pago completo (finanzas): pendiente 0 y una sola entrada de L 500.
9. Pago parcial (operador): cargo L 500, aplicado L 300, pendiente L 200 y entrada de L 300. Dentro de la gracia sigue activa y cubierta, con aviso.
10. Anticipo de L 500 aplicado a la cuota: pendiente 0 y saldo a favor 0, sin nueva entrada de dinero. La aplicación es D 2200 / H 1200 y el ingreso se reconoce una sola vez.
11. Suspensión: una cuota impaga pasada la gracia suspende desde límite + 1 y deja de cubrir traslados.
12. Durante la suspensión no se genera la renovación ni otras al volver a actualizar; la deuda vencida se conserva.
13. Reactivación:
    - Tras pagar, el ciclo nuevo empieza hoy con su cuota. Se cobran 2 cuotas (L 1,000), no las de los meses suspendidos. La fecha de afiliación se conserva y el historial registra el cambio del día de anclaje.
    - Saldada antes de la renovación, se reactiva sin cambiar el ciclo.
14. Cancelación con motivo (no por el operador ni dos veces):
    - La deuda se conserva.
    - Actualizar no la revisa.
    - Pagar no la reactiva.
    - No cubre traslados ni admite beneficiarios.
15. Un mismo beneficiario está activo en dos membresías. Agregarlo de nuevo no duplica el vínculo. La baja con motivo quita la cobertura, y la nueva alta conserva el historial.
16. Modalidades: en compartido, cupo 2 para la membresía; en individual, 3 por beneficiario; un beneficiario no vinculado no está cubierto. La lógica de descuento se verificó por SQL con usos simulados como argumentos de la función pura.
17. Cada período tiene su cupo (2 y 2, no 4). Una fecha de un período no generado queda «pendiente de validación».
18. Permisos:
    - `anon` no lee las 5 tablas o vistas ni ejecuta las funciones; un usuario inactivo no opera.
    - Finanzas no crea membresías ni gestiona beneficiarios o condiciones.
    - El operador no pacta condiciones, no las edita ni cancela.
    - Nadie, ni el administrador, inserta, edita o borra directamente membresías, períodos o vínculos.
    - Los tres roles consultan.
19. Un cargo por período con precio. Cada cobro tiene un único movimiento de caja y nada más mueve dinero.
20. Los 23 asientos de la corrida están balanceados, uno por evento (el libro completo, en la tabla anterior).

**Escenarios en navegador (`e2e-membresias.mjs`):**

- **Operador:** alta en tres pasos, con error si no confirma (conserva la selección) y sin campos de condiciones particulares. En el detalle: cuota pendiente, cobertura y beneficiario agregado. Listado con búsqueda y filtro por estado.
- **Finanzas:** abrir el detalle (GET) no escribe; abrir el panel (POST) reactiva una membresía cuya deuda se pagó por la API. Registra el cobro de una cuota vencida desde el detalle, y la membresía se reactiva al instante con ciclo nuevo. El botón «Actualizar mensualidades» es idempotente.
- **Administrador:** edita las condiciones (L 650) sin alterar la cuota generada, cancela con motivo (rechazado sin confirmar) y ve condiciones particulares en el alta.
- **Móvil 390×844:** listado y detalle sin desplazamiento horizontal.

**Pendiente de E4 (no simulado):** la reserva temporal de cupo, el consumo al completar, la liberación al cancelar y la revalidación al cambiar la fecha requieren los traslados reales. E3 deja `consultar_cobertura` y `private.cupo_ocupado` listos para conectarlos.

### Datos en Supabase de desarrollo

- Registros ficticios marcados `[PRUEBA E3]`: planes, clientes, beneficiarios, cajas, membresías y sus períodos, cargos, cobros y asientos. Por diseño no se pueden borrar; el proyecto de producción será otro.
- Los usuarios ficticios se reactivaron temporalmente y **se desactivaron de nuevo** (bitácora: `reactivar_usuario_prueba` / `desactivar_usuario_prueba`). Solo el administrador real queda activo.

### Defectos encontrados y corregidos durante la etapa

1. **Id de campos repetidos en una misma página.** El detalle de membresía tiene varios formularios con «motivo» y «confirmar», que generaban el mismo `id`: las etiquetas apuntaban al campo de otro formulario. Lo mismo ocurría en E2 al abrir dos correcciones (por ejemplo, reverso de cobro y de aplicación). Ahora `FormularioCatalogo` acepta un prefijo de id; las correcciones de E2 usan el tipo como prefijo y se actualizó `e2e-finanzas.mjs`.
2. **«Registrar cobro» solo con deuda.** Impedía el pago anticipado desde el detalle; ahora se muestra siempre a los roles que cobran.
3. **Pruebas de navegador** (no de la aplicación):
   - El formato de moneda usa un espacio de no separación.
   - El contenido llega por streaming oculto y debe esperarse a que sea visible.

### Pendientes (configuración manual del propietario, sin cambios desde E1)

1. Deshabilitar el registro público en Supabase › Authentication › Sign In / Providers.
2. Activar la protección de contraseñas filtradas si el plan lo permite.

### Limitaciones

- Sin cron, una membresía se pone al día cuando alguien abre el panel, pulsa «Actualizar mensualidades» o registra un cobro desde la aplicación. Si nadie usa el sistema varios días, la suspensión o la reactivación se registran ese día.
- La reactivación toma como fecha efectiva el día en que se ejecuta. Un cobro registrado con fecha anterior no adelanta el nuevo ciclo.
- Cancelar el mismo día de la renovación genera esa cuota antes de cancelar, porque el período ya empezó.
- El cupo usado es 0 hasta E4. La disponibilidad mostrada es teórica.
- La alta muestra hasta 300 beneficiarios activos, sin buscador.
- El mensaje que ve el propietario de la base si intenta modificar un período reutiliza el texto genérico de E2 («asientos y movimientos»).

### Commit

El hash del commit de E3 se informa en la entrega (no puede incluirse en el propio commit).
