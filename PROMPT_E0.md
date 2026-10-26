# EJECUTAR E0 — ARRANQUE TOTAL DESDE CERO

Eres el único agente de desarrollo y QA de este ERP. El usuario ha eliminado TODO el proyecto anterior; comienza desde una carpeta vacía. Lee y sigue `ESPECIFICACION_MAESTRA.md` y `AGENTS.md` (y `CLAUDE.md` si aplica).

## Permiso vigente
- Autorizado: crear el proyecto Next.js, archivos y dependencias locales; configurar conexión a un proyecto Supabase CLOUD de DESARROLLO ya autorizado; crear y aplicar SOLO migraciones técnicas estrictamente necesarias para E0; consultar tablas, versiones y verificar cambios de E0; usar datos ficticios.
- No autorizado: cambiar producción, borrar o reiniciar bases existentes, desplegar Vercel, crear tablas comerciales de etapas siguientes, compartir secretos, implementar roles/login si pertenecen a E1, ampliar el producto.

## E0 — entregables exactos
1. Verifica que no exista código del ERP anterior: la carpeta puede contener únicamente los archivos de instrucciones de este kit. No intentes rescatar el proyecto anterior. Si el generador de Next.js no admite estos archivos preexistentes, crea la app en una subcarpeta temporal y mueve sus archivos al directorio raíz sin sobrescribir las instrucciones.
2. Confirma que el MCP de Supabase conecta **únicamente** al project_ref de desarrollo, no es de solo lectura, y dispone de `list_tables`, `apply_migration`, `execute_sql` y asesores si están habilitados. Si no hay conexión, detén solo las tareas remotas y muestra el bloqueo exacto.
3. Inicializa Next.js App Router, TypeScript estricto, Tailwind, ESLint, scripts npm `dev`, `lint`, `typecheck`, `build`, `test` (Vitest sencillo). No Docker.
4. Añade `@supabase/supabase-js`, `@supabase/ssr` en versiones estables compatibles fijadas en lockfile. Implementa utilidades cliente/servidor con variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, sin usuario/contraseña de servicio. Usa el patrón oficial Next.js vigente.
5. Genera `.env.example` SIN valores reales; crea `.gitignore` que excluya `.env.local`, `.env.*.local`, credenciales, archivos temporales y builds. README breve con puesta en marcha.
6. Crea pantalla inicial en español con mensaje de proyecto inicializado y conexión al backend validada en servidor si las variables están presentes; nunca publiques secretos o conexión sensible en el HTML.
7. Genera una migración técnica inicial **solo si es necesaria** (por ejemplo, una función/estructura mínima de verificación segura); en otro caso documenta que E0 no requiere tablas y confirma la conectividad con una consulta de solo lectura a la base. No inventes una migración vacía solo para mostrar actividad.
8. Ejecuta lint, typecheck, tests y build; verifica por MCP el proyecto conectado y documenta si Supabase fue realmente alcanzado.
9. Realiza auto-revisión: busca errores, scripts Docker, claves en Git, exposición de secretos y operaciones fuera de alcance; corrige lo hallado.
10. Actualiza `docs/ESTADO.md`, genera commit si Git está disponible y el usuario ha permitido commits; informa hash.

## Informe final
- Estado E0: APROBADO / PARCIAL / BLOQUEADO.
- Archivos creados y dependencias.
- Verificación concreta de Supabase Cloud (project_ref sin secretos; tablas/migraciones vistas, consulta realizada).
- Migraciones nuevas y aplicadas (si las hay).
- Comandos y pruebas con éxitos/fallos.
- Autorrevisión y defectos corregidos.
- Lo único necesario antes de E1.

NO comiences E1.
