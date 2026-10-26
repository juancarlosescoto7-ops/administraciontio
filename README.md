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

La pantalla inicial valida en el servidor la conexión con Supabase y muestra el resultado sin revelar la URL ni la clave.

`.env.local` solo admite `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca colocar la clave secreta/`service_role` ni la contraseña de la base de datos; la aplicación rechaza claves secretas.

## Scripts

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | Genera tipos de rutas y ejecuta `tsc --noEmit` |
| `npm test` | Pruebas Vitest |
| `npm run build` | Build de producción |

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

Después, autenticar con `/mcp` en una sesión interactiva de Claude Code. No usar `read_only=true`.

Toda migración aplicada debe existir idéntica en `supabase/migrations/`.
