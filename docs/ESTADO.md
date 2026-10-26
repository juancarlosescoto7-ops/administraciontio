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
- Revisión posterior: el hash se informa en la entrega (no puede incluirse en el propio commit).
