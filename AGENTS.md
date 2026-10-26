# Instrucciones para cualquier agente (Claude o Codex)

Lee `ESPECIFICACION_MAESTRA.md` antes de modificar código.

Este repositorio comienza completamente vacío y pertenece a una empresa con 1–3 usuarios internos. Es un ERP pequeño, no una plataforma multiempresa. No sobrearquitecturar.

- Un solo agente implementa, ejecuta pruebas y revisa su propio trabajo por etapa.
- Ejecuta exclusivamente la etapa solicitada por el usuario. No inicies la siguiente.
- Usa Next.js App Router/TypeScript/Tailwind y Supabase Cloud; NO Docker.
- Supabase MCP debe estar acotado al proyecto de DESARROLLO. Puedes realizar cambios de esquema y migraciones para la etapa autorizada, no operaciones destructivas o modificaciones a producción.
- Cada migración aplicada también debe existir idéntica en `supabase/migrations/` y quedar documentada.
- Nunca expongas credenciales secretas, usuarios reales o valores de `.env.local`. No guardes secretos en Git.
- Valida sesión/permisos en servidor y RLS, incluso si la interfaz oculta botones.
- Importes decimal(14,2), HNL; timestamps UTC, interfaz America/Tegucigalpa.
- No duplicar cargos, cobros, asientos ni reservar dos veces los mismos recursos.
- Ante requisitos externos no decididos, usa los predeterminados expresos del contrato; no crees reglas comerciales nuevas.
- Revisa y corrige tu trabajo. Ejecuta pruebas concretas y publica un resumen con evidencia.
- Actualiza `docs/ESTADO.md` al concluir cada etapa (resultado, migraciones, pruebas, defectos, pendientes). Usa Git para conservar una historia clara.
- No montar herramientas/procesos burocráticos adicionales. No exigir revisión de un segundo agente.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
