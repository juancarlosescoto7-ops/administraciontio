# ERP interno

Sistema administrativo interno (Next.js App Router + TypeScript + Tailwind + Supabase Cloud).
El contrato funcional está en [ESPECIFICACION_MAESTRA.md](ESPECIFICACION_MAESTRA.md); las normas para agentes en [AGENTS.md](AGENTS.md); el avance por etapa en [docs/ESTADO.md](docs/ESTADO.md).

No se usa Docker ni `supabase start`: se trabaja contra un proyecto **de desarrollo** en Supabase Cloud.

## Requisitos

- Node.js 20.9 o superior (probado con Node 24).
- Un proyecto Supabase Cloud dedicado a desarrollo.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar URL y clave PUBLICABLE del proyecto de desarrollo
npm run dev                  # http://localhost:3000
```

Todas las rutas, salvo `/login`, exigen sesión. Si Supabase no está configurado, `/login` lo indica.

`.env.local` solo admite `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca colocar la clave secreta/`service_role` ni la contraseña de la base de datos; la aplicación rechaza claves secretas.

## Scripts

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | Genera tipos de rutas y ejecuta `tsc --noEmit` |
| `npm test` | Pruebas Vitest |
| `npm run build` | Build de producción |

## Acceso, usuarios y roles

No existe registro público. Cada cuenta creada en Supabase Auth recibe automáticamente un perfil interno **inactivo** (rol `operador`) y no ve ningún dato hasta que un administrador la active. El rol se guarda en `public.perfiles` (nunca en `user_metadata`) y solo cambia con la función `public.actualizar_perfil`, que exige administrador activo, impide cambiar el propio rol o desactivarse, pide motivo y deja registro en `public.bitacora`.

### Ajustes manuales en Supabase Dashboard (una vez)

1. **Authentication › Sign In / Providers:** desactivar «Allow new users to sign up» (registro público). Aunque quede activo, una cuenta autorregistrada nace inactiva y sin acceso, pero debe desactivarse.
2. **Authentication › Sign In / Providers › Email:** activar la protección de contraseñas filtradas si el plan lo permite.

### Primer administrador (bootstrap, una sola vez)

1. Crear la cuenta en **Authentication › Users › Add user** (correo y contraseña, «Auto Confirm User»).
2. En **SQL Editor** (rol propietario), ejecutar:

   ```sql
   select private.bootstrap_primer_administrador('correo@dominio', 'Nombre visible');
   ```

La función solo existe en el esquema `private` (no expuesto por la API), solo la puede ejecutar el propietario de la base, falla si el correo no existe en Auth y **se niega si ya hay un administrador activo**. Queda registrada en la bitácora.

### Más usuarios

Crear la cuenta en el Dashboard (paso 1 anterior). Aparece en `/configuracion/usuarios` como inactiva; el administrador asigna el rol, la activa e indica el motivo. Para retirar el acceso se desactiva el perfil (las cuentas con perfil no se pueden borrar desde Auth: se conserva el historial).

### Permisos (RLS en la base y verificación en el servidor)

| Catálogo | Administrador | Operador | Finanzas |
|---|---|---|---|
| Clientes, beneficiarios, vehículos, conductores | Consulta y edita | Consulta y edita | Consulta |
| Proveedores | Consulta y edita | Consulta y edita | Consulta y edita |
| Planes, tarifas, cajas y bancos | Consulta y edita | Consulta | Consulta |
| Usuarios y bitácora | Gestiona | Solo su perfil | Solo su perfil |

Nadie borra registros: se inactivan. Usuarios sin sesión no tienen ningún privilegio.

## Verificación contra el proyecto de desarrollo

Además de `npm test`, hay dos scripts sin dependencias adicionales que usan usuarios **ficticios** y crean registros marcados `[PRUEBA E1]`. Se niegan a ejecutarse si `.env.local` no apunta al proyecto de desarrollo. Las credenciales de prueba van en un archivo fuera del repositorio (`E2E_ADMIN_CORREO`, `E2E_ADMIN_CLAVE`, y lo mismo para `OPERADOR`, `FINANZAS` e `INACTIVO`); el administrador, operador y finanzas de prueba deben estar activos y el usuario «inactivo», no.

```bash
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-rls.mjs       # RLS por rol vía API REST
npm run build && npm start                                                    # en otra terminal
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-navegador.mjs       # navegador real (Edge/Chrome)
```

## Supabase MCP (agentes)

Las migraciones se aplican mediante el MCP oficial de Supabase, acotado al proyecto de desarrollo y autenticado por OAuth. Configuración de proyecto (`.mcp.json` en la raíz; el `project_ref` no es secreto):

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<PROJECT_REF_DEV>&features=database%2Cdevelopment%2Cdebugging%2Cdocs"
    }
  }
}
```

Este repositorio ya configura el proyecto de desarrollo `cgohbizokewvivxmvbij` en `.mcp.json` (Claude Code) y `.codex/config.toml` (Codex). Ambos usan únicamente `database,development,debugging,docs`, con escritura habilitada. No usar `read_only=true`.

Desde la raíz del repositorio:

- **Codex:** ejecutar `codex mcp login supabase` y completar OAuth en el navegador. El repositorio debe ser de confianza para cargar su configuración local.
- **Claude Code:** abrir `claude` y aprobar el servidor del proyecto; después ejecutar `claude mcp login supabase` y completar OAuth (también disponible desde `/mcp`).
- Verificar con `codex mcp get supabase` y `claude mcp get supabase`. Reiniciar las sesiones existentes para cargar las herramientas. Registrar el servidor no demuestra todavía acceso a la base de datos.

Los tokens OAuth se gestionan en cada cliente; nunca se guardan en estos archivos ni en Git.

Toda migración aplicada debe existir idéntica en `supabase/migrations/` (con fin de línea LF, fijado en `.gitattributes`). Tras cada migración, regenerar [lib/supabase/tipos-bd.ts](lib/supabase/tipos-bd.ts) con `generate_typescript_types`.
