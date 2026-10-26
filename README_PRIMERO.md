# Reinicio ERP desde cero

1. Crea **un nuevo proyecto de desarrollo** en Supabase Cloud (no reutilices producción).
2. Configura Supabase MCP en Claude Code o Codex, restringido al `project_ref` de desarrollo, con escritura habilitada y acceso OAuth.
3. Crea carpeta VACÍA para el proyecto. Copia `ESPECIFICACION_MAESTRA.md`, `AGENTS.md`, `CLAUDE.md` y `PROMPT_E0.md` a la raíz.
4. Desde el agente con la conexión MCP activa, ordena: «Lee `PROMPT_E0.md` y ejecuta E0. Implementa, prueba y revisa tu propio trabajo. Detente después del informe».
5. Comparte con ChatGPT al terminar el informe y el contenido de `docs/ESTADO.md` (sin secretos) para preparar E1.

No instalar Docker. Nunca proporcionar contraseña de base de datos o `service_role` por chat. La llave publicable puede ir en `.env.local`; no debe confundirse con credenciales administrativas.
