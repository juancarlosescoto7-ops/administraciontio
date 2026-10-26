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
