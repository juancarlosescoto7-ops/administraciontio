# PROMPT MAESTRO — CODEX | Rediseño UI/UX ERP

Actúa como **ingeniero frontend senior y diseñador de producto especializado en ERP**. Trabajarás sobre el repositorio que ya está abierto en Visual Studio Code. La referencia visual aprobada es **“D — Corporativa y Operativa”**, adjunta como captura `referencias-diseno/dashboard-aprobado.png` (si ese archivo no está disponible, indícamelo; NO supongas que lo has visto). Lee también `Especificacion_UI_UX_ERP_Corporativo_Operativo.docx` si tienes capacidad de lectura; de lo contrario utiliza las instrucciones de este prompt.

## Contexto
ERP web en español para administración de **ambulancias, membresías, alquiler de vehículos, transporte con conductor, clientes y finanzas**, desarrollado con Next.js, TypeScript, Tailwind y Supabase. El sistema ya tiene reglas de negocio y operaciones existentes. La imagen de referencia es **conceptual**, no una prueba de funcionalidades: nombres, gráficos, GPS, horarios y montos pueden ser ficticios.

## Objetivo
Implementar un lenguaje visual **corporativo, operativo, intuitivo, accesible y responsive**, con sidebar, topbar, paneles, formularios y tablas consistentes. Priorizar reconocimiento inmediato de tareas, lectura rápida y reducción de clics. Eliminar ruido visual sin sacrificar información.

## Restricciones no negociables
1. NO modificar migraciones, esquemas, RLS, funciones SQL, autenticación, API, reglas de cálculo, contratos de datos, lógica de negocio, ni transiciones de estado.
2. NO crear páginas vacías o enlaces sin funcionamiento. No implementar funcionalidades como seguimiento GPS, calendario, búsqueda global o reportes nuevos solo porque aparecen en la referencia.
3. NO insertar números de demostración como datos reales. Cada KPI debe venir de fuente existente y respetar permisos. Si no existe consulta confiable, omite ese KPI o deja un estado vacío explícito.
4. NO borrar campos, validaciones, acciones, mensajes ni flujos operativos ya disponibles.
5. Respetar roles, verificación de permisos del servidor, registro de auditoría y restricciones existentes; un cambio visual no puede sustituir seguridad.
6. No instalar dependencias sin justificación y sin comprobar si ya existe una alternativa en el repositorio.
7. Diseño en español, moneda HNL, fechas de Honduras (America/Tegucigalpa). No mostrar variaciones porcentuales sin dato comparativo.
8. Mantener compatibilidad con la versión real de Next.js, React y Tailwind del proyecto. No asumir estructura o nombres de archivos.

## Dirección visual
- Superficie principal #F5F7FB, tarjetas #FFFFFF, texto #17243A, texto secundario #63738A, bordes #E3E9F1.
- Azul primario sugerido #2475E7, hover #155FC5, verde #168A5B, ámbar #B97915 y rojo #C74444; ajustar para contraste AA.
- Tipografía Inter/Geist/sistema según lo que ya esté disponible.
- Sidebar desktop ~240–264 px; topbar 60–72 px; espaciados de 4/8/12/16/24/32 px; radios 10–14 px y sombras discretas.
- Desktop con varios paneles, tablet con sidebar colapsable, móvil con navegación desplegable, columnas apiladas y tablas manejables.
- Botón principal claro por página. Estados operativos con etiqueta textual + color; nunca únicamente color.
- Estados loading, vacío, error y sin permisos.

## Procedimiento obligatorio — por fases con aprobación
### Fase 0: auditoría del proyecto (primero)
- Inspecciona árbol de archivos, package.json, rutas, layouts, componentes, design tokens, navegación, roles, consultas y pruebas.
- Comprueba estado git y no sobrescribas cambios sin guardar de otros trabajos.
- Identifica los flujos existentes críticos, especialmente servicios de ambulancias y finanzas.
- Emite un resumen muy concreto del layout actual, elementos reutilizables, riesgos y los archivos que planeas modificar.
- Establece comandos reales para test, lint, build y su estado inicial.

### Fase 1: implementar solamente el shell global
- Introduce o adapta tokens, AppShell, Sidebar, Topbar, navegación activa y comportamiento responsive con componentes reutilizables.
- Respeta la arquitectura existente, autenticación y rutas reales. No inventes menús.
- Mantén el contenido de cada página existente funcional; cambia solo el contenedor y navegación en esta fase.
- Prueba escritorio, tablet y móvil; accesibilidad de foco, teclado y aria labels.
- Corre TypeScript/lint/build/pruebas existentes, registra resultados.
- **DETENTE tras completar Fase 1 y solicita mi autorización antes de iniciar la Fase 2.**

### Fase 2: dashboard (SOLO tras mi aprobación)
- Construye KPIs y próximos servicios únicamente con consultas verificadas, según roles.
- Prioriza solicitudes, servicios próximos y acciones frecuentes realmente disponibles. Gráficos solo cuando el histórico exista.
- Maneja carga, ausencia de datos, error y cero resultados; sin números hardcodeados.
- Conserva performance y control de permisos.
- Detente para revisión.

### Fase 3: biblioteca visual (SOLO tras aprobación)
- Unifica PageHeader, StatCard, SectionCard, DataTable, StatusBadge, campos de formulario, diálogos, toast, empty states.
- Valida teclado, responsive y accesibilidad. No introducir breaking changes.
- Detente para revisión.

### Fase 4: módulos (SOLO tras aprobación)
- Refactor visual gradual en ambulancias, membresías, alquileres, transporte y finanzas según existan realmente; pruebas de regresión tras cada módulo.

## Entregable al finalizar Fase 1
1. Archivos creados/cambiados y justificación.
2. Qué partes están listas y cuáles quedan para fases posteriores.
3. Capturas de escritorio y móvil si dispones de herramientas visuales, o instrucciones exactas para revisar localmente.
4. Resultados de los comandos de validación con errores preexistentes diferenciados.
5. Confirmación explícita de que **no se modificó lógica de negocio, Supabase ni permisos**; si no puedes confirmarlo, detalla las excepciones.
6. Pregunta de aprobación: **“¿Apruebas Fase 1 para comenzar Fase 2 (dashboard)?”**

**Comienza ahora con Fase 0, después ejecuta Fase 1 si el diagnóstico demuestra que puedes hacerlo sin riesgos importantes. Si encuentras incompatibilidades o cambios que afecten comportamiento, detente y explica el bloqueo antes de modificar.**
