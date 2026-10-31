# Estado del proyecto

## Contratos de membresía y de cada servicio (2026-10-31)

**Solicitud:** cambiar el contrato de membresía tomando como modelo el contrato de arrendamiento de vehículo de la empresa, y tener contrato para cualquier servicio con los datos que el sistema ya registra. El propietario confirmó: los montos del alquiler (depósito de L 3,000.00, recargo de L 300.00 por hora o fracción y lavado de L 300.00) se escriben fijos en el texto, y firma por la empresa Jorge Alberto Rodríguez Lagos. Migración aplicada exclusivamente en Supabase de desarrollo `cgohbizokewvivxmvbij`. No se inicia E7.

### Funcionalidad

- **Plantillas por tipo:** membresía, alquiler de vehículo, viaje con conductor y traslado en ambulancia. Cada una tiene sus variables y su texto vigente; el administrador las edita en Configuración › Contratos (pestañas por tipo, lista de variables y vista previa con datos de ejemplo). Guardar crea una versión nueva y conserva las anteriores.
- **Textos iniciales** con el modelo de la empresa: SERVICIOS MÚLTIPLES Y TRANSPORTE J.A.R.L. S. DE R.L., RTN 08249025198349, Talanga, Francisco Morazán; representante Jorge Alberto Rodríguez Lagos; pago en efectivo o transferencia; cláusulas de narcotráfico y lavado de activos, de cumplimiento de la ley y antisoborno; cierre «a los 31 días del mes de octubre de 2026» y firmas del representante y del cliente. El de alquiler sigue casi literal el contrato del propietario. La membresía es la versión 4 de su plantilla; las anteriores se conservan.
- **Contrato de cada servicio:** botón «Contrato» en la ficha del alquiler, del viaje y del traslado (`/…/[id]/contrato`). Se genera a pedido con cliente, vehículo (código, placa, marca, modelo, año), conductor, fechas, duración, origen, destino, motivo, tarifa y precio pactado; lo no asignado se escribe «Por asignar». Queda congelado. «Generar de nuevo» crea otra versión si los datos cambiaron (si no cambiaron, devuelve la misma) y conserva las anteriores. No se genera para servicios cancelados. Se imprime o guarda como PDF desde el navegador, con el logo.
- **Permisos:** generan contratos de servicio el administrador y el operador; finanzas solo los lee. Las plantillas las edita solo el administrador.
- Generar o imprimir un contrato **no** crea cargos, cobros ni depósitos: el depósito y los recargos del alquiler son texto del contrato. Si se cobran, se registran como hasta ahora (cobro o cargo adicional al devolver).
- Datos que el sistema no registra y por eso no aparecen: color, motor y cilindraje del vehículo, y nacionalidad del cliente.

### Migración

| Versión | Contenido | MD5 (SQL aplicado = archivo) |
|---|---|---|
| `20261031225533_contratos_servicios.sql` | `plantillas_contrato.tipo` y único (tipo, versión); tabla `contratos_servicio` (inmutable, RLS de solo lectura, una referencia por servicio); `generar_contrato_servicio`, `guardar_plantilla_contrato(p_contenido, p_tipo)` y `vista_previa_contrato(p_contenido, p_tipo)`; `{{vigencia}}` y `{{fecha_contrato_letras}}` en la membresía; plantillas iniciales | `4986dd7b017bf706ed4fe3fed0a31e22` |

Sin instrucciones destructivas: el servidor MCP de Supabase rechazaba automáticamente la primera versión, que eliminaba restricciones y funciones. Por eso el número de versión de las plantillas sigue siendo único entre todos los tipos (membresía 4, alquiler 5, viaje 6, traslado 7) y las firmas anteriores sin tipo (`guardar_plantilla_contrato(text)`, `vista_previa_contrato(text)`) se conservan y equivalen a membresía. La interfaz no muestra el número global. Tipos de TypeScript actualizados a mano en las partes afectadas. Asesores: sin hallazgos nuevos aparte del patrón ya existente de funciones `SECURITY DEFINER` con control de rol interno, e índices aún sin uso.

### Pruebas y evidencia

- `npm run lint` (archivos tocados) OK, `npm run typecheck` OK, `npm test` **130/130** (nuevo `lib/contratos/contratos.test.ts`).
- `scripts/verificar-contratos.sql` **20/20** en Supabase de desarrollo dentro de una transacción revertida: plantillas vigentes firmadas por el representante y vistas previas sin variables pendientes; variables por tipo; solo el administrador edita; membresía con vigencia y sin párrafo de vencimiento duplicado; alquiler con placa, precio, fecha «06/03/2027 a las 12:00 PM» y montos fijos; doble envío sin copia; inserción directa rechazada; cancelado rechazado; viaje «Por asignar» y versión nueva al asignar recursos; traslado particular; finanzas no genera. Comprobado después: 0 contratos de servicio residuales.
- `scripts/e2e-membresia-contrato.mjs` y `scripts/verificar-membresia-contrato.mjs` filtran ahora la plantilla de membresía (`tipo=eq.membresia`), porque el número de versión es global.

### Pendiente

- Prueba en navegador con sesión iniciada (generar, regenerar, imprimir y editar plantillas): en esta sesión no había `E2E_CREDENCIALES`.

## Empleados y pago de salarios (2026-10-31)

**Solicitud:** módulo de empleados en Gastos para seleccionar un empleado y registrar el pago de su salario, y en los gastos operativos o de cada servicio la opción de pagar el salario/remuneración del conductor. Primera implementación hecha por Codex; revisada, completada y verificada por Claude Code. Migración aplicada exclusivamente en Supabase de desarrollo `cgohbizokewvivxmvbij`. No se inicia E7.

### Funcionalidad

- **Empleados** (`/empleados`, menú «Flota y personal»): catálogo con nombre, puesto, teléfono y activo. Solo administrador y finanzas lo ven y editan (RLS y página).
- **Registrar gasto:** campos «Salario de empleado» y «Salario / remuneración de conductor». Un gasto tiene un solo destinatario (empleado, conductor o proveedor) y, si es remuneración, debe usar la categoría Salarios (cuenta 5300). Usa el pago inmediato o parcial y la contabilidad existentes; lo no pagado queda pendiente y se liquida con «Registrar pago».
- **Accesos directos:** «Registrar pago de salario» en la ficha del empleado y del conductor, y «Pagar al conductor» en «Gastos de este servicio» de viajes con chofer y traslados con conductor asignado. Abren el formulario con la persona, la categoría Salarios y un concepto ya rellenados.
- **Historial:** la ficha del empleado y la del conductor muestran sus últimos 50 salarios (fecha, importe, pendiente o anulado). El operador ve la ficha del conductor sin pagos.
- **Listado y detalle de gastos:** columna «Destinatario» (empleado/conductor o proveedor); la búsqueda también encuentra por nombre del empleado o conductor. El destinatario conserva el nombre de la fecha del pago aunque luego se renombre o inactive la persona.

### Migración

| Versión | Contenido | MD5 (SQL aplicado = archivo sin salto final) |
|---|---|---|
| `20261031103159_empleados_remuneraciones.sql` | Tabla `empleados` con auditoría y RLS; `gastos_personal` (destinatario único, solo lectura); RPC `registrar_gasto_personal` atómica e idempotente sobre `registrar_gasto_servicio` | `423eaaa38f23dc906a09849fe67ecfc1` |

Codex dejó el archivo como `20261031102018_…` sin aplicarlo; se aplicó por MCP y se renombró a la versión devuelta por Supabase. Tipos regenerados por MCP. Asesores: sin hallazgos nuevos aparte del patrón ya existente de funciones `SECURITY DEFINER` con control de rol interno, e índices aún sin uso.

### Pruebas y evidencia

- `npm run lint` OK, `npm run typecheck` OK (Codex lo había dejado con 9 errores: tipos sin regenerar y `PageProps` de `/empleados`), `npm test` **127/127**.
- `scripts/verificar-personal.sql` **21/21** en PGlite (`node scripts/verificar-servicios-local.mjs`, junto con 38/38 de servicios) y **21/21** en Supabase de desarrollo dentro de una transacción revertida: abono parcial y liquidación, reintento idempotente sin pago ni asiento duplicado, cambio de destinatario rechazado, dos destinatarios, categoría errónea, empleado inactivo, conductor ligado a un viaje, nombre histórico, RLS del operador y modificación del historial bloqueada. Comprobado después: 0 empleados y 0 remuneraciones residuales.
- `node scripts/verificar-limpieza-local.mjs` aprobado (no aplica migraciones posteriores a la limpieza).
- PostgREST acepta el orden por `gastos(fecha)` del historial; el rol anónimo recibe `permission denied` en `gastos_personal`.
- Las rutas nuevas responden en `next dev` (redirigen a inicio de sesión sin sesión).

### Pendientes

- **Prueba de navegador con sesión no ejecutada:** las pruebas e2e dejan registros permanentes y la base acaba de limpiarse; además no se leyeron credenciales de prueba. Recorrido manual sugerido: crear un empleado › «Registrar pago de salario» con abono parcial › ver el pendiente en su ficha › «Pagar al conductor» desde un viaje con conductor.
- Sin commit.

## Limpieza de operaciones conservando catálogos (2026-10-31)

**Solicitud expresa:** «limpiar todos los registros, menos los clientes, vehículos o cualquier tipo de catálogo». Limpieza excepcional ejecutada únicamente en desarrollo `cgohbizokewvivxmvbij`; no modifica las reglas normales que impiden borrar historial desde la aplicación ni inicia otra etapa.

- **Eliminados:** 257 registros de 21 tablas operativas: alquileres, aplicaciones de cobro, asientos y líneas, bitácora, cargos adicionales, cargos de clientes, cobros, contratos individuales, gastos y vínculos a servicios, asociaciones membresía/beneficiarios, membresías, movimientos de dinero, ocupaciones de recursos, pagos de gastos, períodos, reservas de beneficio, transferencias, transportes y traslados. Todas quedaron con 0 filas.
- **Conservados íntegros:** clientes **8**, vehículos **6**, beneficiarios **6**, conductores **1**, proveedores **5**, planes **3**, tarifas **2**, cuentas de dinero **1**, cuentas contables **14**, categorías de gasto **5**, plantillas de contrato **3**, perfiles **2**. No se tocaron usuarios ni sesiones de Auth.
- Las cuentas de caja/banco se conservaron como catálogo; al quitar sus movimientos, sus saldos quedaron en **0**. Clientes sin deuda ni anticipos. No se guardaron datos personales ni credenciales en Git.
- Migración aplicada y guardada: `supabase/migrations/20261031101037_limpiar_operaciones_conservar_catalogos.sql`. MD5 del SQL aplicado y del archivo local: `9b3ac6fe91d026daf8887b36e84c8557`. Es una limpieza de datos exclusiva de desarrollo, **no debe reutilizarse en producción con datos**.
- Seguridad de ejecución: una transacción, lista explícita de tablas, bloqueo contra escrituras concurrentes y `TRUNCATE ... RESTRICT` sin cascada. Solo se deshabilitaron temporalmente los triggers que impiden truncar las tablas autorizadas. Comparación interna de hashes de todas las filas de los 12 catálogos antes/después; comprobación de restauración exacta del estado de los triggers. Cualquier diferencia habría revertido todo.
- Prueba previa en PostgreSQL temporal con datos ficticios y relaciones reales: aprobada. Reproducible con `node scripts/verificar-limpieza-local.mjs` (PGlite ya instalado en `.temp`, sin Docker).
- Verificación posterior por MCP: inventario de las 33 tablas; 21 vacías y 12 conservadas con los conteos indicados; **0** clientes con saldo, **0** cuentas con saldo, **0** gastos y **0** triggers deshabilitados.
- No hubo cambios de interfaz, esquema permanente o permisos. No se requieren compilación ni pruebas de navegador para este vaciado. Sin defectos ni pendientes de limpieza. `.claude/` preexistente quedó intacto.

## Gastos por servicio, vigencia, duración y plan de cuotas (2026-10-31)

**Resultado:** cambios solicitados el 2026-10-30 implementados en el código local y migraciones aplicadas exclusivamente en Supabase de desarrollo `cgohbizokewvivxmvbij`. La aclaración final sobre reactivación se recibió el 2026-10-31. No se inicia E7 ni se despliega a producción.

### Funcionalidad

- Desde el detalle de cada membresía, alquiler, viaje con chofer o traslado de ambulancia, administrador/finanzas pueden abrir «Gastos de este servicio» y registrar un gasto relacionado. El gasto usa la contabilidad y los pagos existentes; en su detalle hay enlace al servicio. Se conserva la opción de gastos generales por actividad. Operadores no adquieren permisos de finanzas.
- El administrador puede fijar el vencimiento en las condiciones particulares del alta o en «Vigencia del contrato» de una membresía existente, con motivo y bitácora. El final debe coincidir con el último día de un período mensual; no se recortan períodos emitidos ni se ignoran traslados posteriores. Las membresías antiguas permanecen sin fecha hasta que el dueño la establezca.
- Al vencer se corta la cobertura y la generación de nuevas cuotas, conservando la deuda. El listado distingue «Vencidas». La reactivación de contratos finitos conserva anclaje y vencimiento, omite ciclos completos suspendidos y genera únicamente la cuota del ciclo vigente con su calendario y precio originales. Si esa cuota ya está fuera de gracia, también debe pagarse para recuperar cobertura. Sin fecha final se conserva la regla histórica.
- El contrato generado con fecha final incluye el vencimiento pactado. Los contratos ya congelados no se reescriben; el plan de pagos muestra la vigencia actual.
- Transportes y ambulancias permiten duración en minutos, horas o días, incluidas fracciones que equivalgan a minutos exactos; ya no hay límite de 24 horas. La base conserva minutos y valida disponibilidad transaccional. En alquileres se puede calcular la devolución mediante duración o introducir fechas directamente; un día son 24 horas y esto no cambia las tarifas pactadas.
- En el detalle de membresía, «Plan de pagos» abre `/membresias/[id]/plan-pagos`: cuotas emitidas, aplicaciones, pendientes, fechas y proyección hasta el vencimiento. «Imprimir o guardar PDF» usa la impresión del navegador. La proyección no crea cargos ni muestra cuotas futuras como deuda. Lectura paginada de cuotas para no truncar contratos largos.

### Migraciones y verificación de desarrollo

Ambas migraciones existen en `supabase/migrations/` con las versiones devueltas por Supabase y el mismo SQL aplicado (MD5 del cuerpo verificado):

| Versión | Contenido | MD5 |
|---|---|---|
| `20261031015204_servicios_gastos_vigencia_duracion.sql` | Relación `gastos_servicio` con cuatro FKs, una relación por gasto, RLS e índices; RPC atómica/idempotente; duraciones de varios días | `5c1978e92245a34bf7811ccd908b6f44` |
| `20261031082102_membresias_vigencia_plan_pagos.sql` | `fecha_fin`, validación de final de ciclo, corte de cuotas/cobertura, reactivación, modificación por administrador y snapshot contractual | `adbd6e964b2048debc7fb1467146c809` |

Tipos de Supabase regenerados por MCP después de ambas migraciones. No se leyeron ni publicaron valores de `.env.local`.

### Pruebas y evidencia

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado con tipos regenerados desde Cloud.
- `npm test`: **127/127**; cinco pruebas nuevas cubren unidades, fracciones exactas, rechazos, representación y ciclos 31/febrero/bisiesto.
- `npm run build`: aprobado; incluye la nueva ruta de plan de pagos.
- `node scripts/verificar-servicios-local.mjs`: **38 comprobaciones** en PostgreSQL temporal con PGlite (dependencia de pruebas ya disponible, sin Docker); aplica las migraciones reales, excepto la limpieza histórica de datos de prueba.
- `scripts/verificar-servicios-contrato.sql` por MCP en desarrollo: **38 comprobaciones aprobadas**. Roles administrador/operador/finanzas, las cuatro relaciones, rechazo de servicio inexistente/actividad incorrecta, reintentos, abono L 300 sobre gasto L 800 (saldo L 500, un solo egreso), viajes de varios días y rechazo de solapamientos, cuota final/aniversario 31, cobertura en último día y posterior, deuda conservada, reactivación sin cuotas duplicadas ni extensión, asientos balanceados.
- Las pruebas Cloud se ejecutaron dentro de `BEGIN`/`ROLLBACK`, con usuarios ficticios y reloj simulado. Se comprobó después que el reloj estaba restaurado y que no quedaron los clientes ficticios.
- Asesores de seguridad: ninguna alerta ERROR; advertencias por RPC `SECURITY DEFINER` accesibles a authenticated (patrón existente, funciones nuevas con rol explícito y privilegios restringidos) y protección de contraseñas filtradas deshabilitada (pendiente previo). RLS y denegación de escritura directa probadas.

### Revisión propia, defectos y límites

- Corregidos durante implementación: BOM generado por PowerShell en un SQL, tipo explícito del arreglo de cuotas, código ficticio de vehículo inválido y creación de caja de prueba bajo un rol sin permiso. Son fallos de preparación/prueba, no cambios en reglas de negocio.
- Se revisaron también el vencimiento en listado/filtros, cancelaciones, mensajes de reactivación, consultas con permisos, unidades convertidas en servidor mediante validación de minutos, y separación de importe proyectado/deuda.
- Una llamada MCP no llegó a ejecutarse por agotamiento temporal de la revisión automática de herramientas. El acceso se recuperó y las migraciones/pruebas se completaron; no queda bloqueo de aprobación.
- **Límite de verificación:** no se ejecutó prueba de navegador con sesión autenticada ni se inspeccionó físicamente la impresión; no hay credenciales de prueba configuradas en esta sesión. No se afirma validación visual o E2E de navegador. Se verificaron compilación, lógica y transacciones reales.
- Pendiente operativo: el dueño debe asignar vencimientos a membresías existentes. No se inventaron fechas ni se modificaron datos comerciales históricos. `.claude/`, preexistente sin seguimiento, quedó intacto.

Los cambios se conservan en un commit específico; el hash se informa al cerrar la entrega.

## Time lapse de construcción con código real y base de datos (2026-10-29)

> Rastro para cualquier agente (Claude o Codex). Trabajo terminado y verificado; ver «Pendientes» para lo que queda a decisión del usuario.

**Pedido del usuario:** «time lapse muy rápido de la construcción del sistema; simular que estoy escribiendo código y el sistema se va creando; realista; código real del proyecto; usar la base de datos para simular que la estamos creando y conectando las tablas».

Aclaraciones del usuario durante el trabajo, en orden; la última manda:
1. Pantalla dividida: código a un lado y el proyecto al otro. La base aparece en «flashes». Las conexiones deben verse naturales, como las haría una persona.
2. La base es parte de la ventana del código, debajo del editor, trabajada a la par. El sistema ocupa más espacio horizontal. Sin bordes de ventana (ni minimizar ni cerrar).
3. La barra lateral del ERP debe quedar dentro de la ventana del sistema.
4. «No veo la construcción del sistema en la otra pantalla». La ventana de la base no debe animarse tanto: más simple y más estática.
5. Última revisión: el sistema debe construirse «probando» el diseño (tipografía, etc.) y la base debe parecer que realmente se está creando.
6. «Una última escena donde se prueba ya el sistema con los componentes más interesantes».

Dudas resueltas con lo propuesto, tras el «continúa» del usuario:
- **Base de datos:** solo lectura de la estructura real; la creación en pantalla es simulada.
- **Duración:** ~40 s pedidos. Resultado final: 57.7 s, con 46.6 s de construcción (pruebas de diseño y creación columna por columna) y 11 s de la escena de prueba.
- **Cierre:** el sistema real terminado.

**Resultado (`/demo-construccion`):** arranca solo, sin controles ni rótulos; al final solo aparece «Repetir». Pantalla dividida sin marcos:
- **Izquierda (~36 %):**
  - Editor con pestañas, ruta, números de línea reales, resaltado y barra de estado. El código real se teclea en ráfagas y luego salta al final del archivo con su numeración real.
  - Panel «BASE DE DATOS · public», como un diseñador de esquemas:
    - Cada tabla de la migración nace vacía y recibe sus columnas una a una, con su **tipo real** (`uuid`, `text`, `timestamptz`, enums…), la marca `RLS` y «+ N columnas» si hay más.
    - Después aparecen las llaves foráneas reales como conectores ortogonales estáticos (sin cursor ni trazos animados).
    - Un registro de dos líneas muestra lo que se ejecuta: `create table public.X (N columnas)`, `enable row level security` y `add foreign key …`.
    - Entre migraciones queda visible la última aplicada.
  - Terminal: `apply_migration` con conteos reales de tablas, políticas y funciones; typecheck; `git commit` con hash, mensaje y `--shortstat` reales.
- **Derecha (~64 %):** el ERP real (`gruposNavegacion`, `Encabezado`, `FormularioFiltros`, `Tabla`, panel de inicio real) **se construye a la par del código**:
  - Al empezar a teclear el archivo de una etapa, el sistema pasa a su pantalla vacía.
  - Mientras se escribe aparecen en orden los enlaces nuevos del menú, el encabezado, la caja de filtros, la tabla y sus filas (en el inicio: buscador, accesos, indicadores, grupos y cajas). Lo controlan `estado.sistema.progreso` en `guion.ts` y `data-construido` en `vista.tsx`.
  - Si la pantalla es la misma que en la etapa anterior, solo aparecen los enlaces nuevos.
  - Mientras se arma, **se prueba el diseño en vivo**: el título se teclea letra a letra y un aspecto cambia dos veces antes de asentarse en el estilo real (`PRUEBAS` en `guion.ts`, reglas `data-prueba` en `demo.css`). Aspectos: tipografía en Clientes, color en Cobros, esquinas en Membresías, densidad de tabla en Traslados, sombras en Alquileres.
  - Un recuadro tipo inspector abajo a la derecha muestra la regla probada, con los intentos tachados. Sus valores finales son los reales de `globals.css`: `Inter Variable`, `#533afd`, `0.5rem`, `0.75rem`, `var(--sombra)`. Se dibuja al ancho real de la pantalla y se reduce al panel; `contain: paint` mantiene la barra lateral fija dentro.
- **Cierre: escena de prueba (`prueba.tsx`, 11 s).** El sistema terminado pasa a pantalla completa y un cursor lo usa con sus piezas más vistosas:
  1. Se desplaza y abre «Cobros de los últimos 7 días»: el `GraficoColumnas` real, con barras que crecen.
  2. Sube y pulsa el acceso rápido «Registrar cobro».
  3. Llena el formulario real (`camposCobro`: importe recibido 1200.00, caja o banco, fecha, método de pago → Transferencia bancaria, referencia TRF-0042), con el `ResumenImportes` real del cliente ficticio «Clínica Modelo» (pendiente L 2,400.00).
  4. Pulsa «Registrar cobro» y aparece la `Notificacion` real «Cobro registrado.».
  5. Vuelve al inicio: «Cobrado hoy» pasa a L 4,700.00 con la `CifraAnimada` real, y se actualizan los cobros recientes, saldos y gráfico.

  Las tres versiones del panel (`panelDemo({ grafico, cobro })`) llegan en un objeto para que el panel se actualice en su sitio.

**Etapas (commit → migraciones → archivo tecleado):**
1. E0 `de98964` → — → `app/page.tsx`
2. E1 `58e37ae` → `e1_perfiles_y_acceso`, `e1_catalogos` → `components/catalogos/paginas.tsx`
3. E2 `22bc0dc` → `e2_finanzas_estructura` → `lib/finanzas/acciones.ts`
4. E3 `9b5b864` → `e3_membresias_estructura` → `app/(privado)/membresias/nueva/page.tsx`
5. E4 `b9f4c3f` → `e4_ambulancias_estructura` → `app/(privado)/ambulancias/nuevo/page.tsx`
6. E5 `c41854e` → `e5_alquileres_transportes_estructura` → `app/(privado)/alquileres/nuevo/page.tsx`
7. Rediseño `e974098` → — → `components/panel.tsx`
8. E6 `958626c` → `e6_reportes` → `app/(privado)/reportes/page.tsx`
9. Contrato (árbol de trabajo, sin commit) → `e6_membresia_integrada_contrato` → `app/(privado)/membresias/[id]/contrato/page.tsx`
10. Cobros automáticos `587ee16` → `cobros_automaticos_antiguedad` → `lib/finanzas/acciones.ts`

No se muestran `e6_estados_financieros` ni `limpieza_datos_prueba`, ni las migraciones de operaciones u orígenes.

**Archivos (`app/demo-construccion/`):**

| Archivo | Contenido |
|---|---|
| `page.tsx` | servidor: arma listados y panel reales |
| `lapso.tsx` | reloj y disposición |
| `guion.ts` | línea de tiempo derivada de los datos; constantes de ritmo arriba |
| `editor.tsx` | editor y terminal |
| `diagrama.tsx` | `PanelBd`: retícula adaptativa, creación columna por columna con tipos, RLS, registro y conectores ortogonales estáticos |
| `vista.tsx` | `SistemaReal`, marco del ERP con menú por etapa, construcción progresiva, títulos tecleados y prueba de diseño |
| `pantallas.tsx` | pantallas con componentes reales y datos ficticios |
| `prueba.tsx` | escena final: cursor, desplazamientos y formulario de cobro |
| `resaltado.ts` (+ `.test.ts`) | resaltado de sintaxis |
| `demo.css` | estilos de la demo |
| `esquema-bd.json` | estructura de la base de desarrollo leída por MCP en solo lectura (`information_schema` y `pg_class`): 32 tablas con columnas, tipos reales y RLS (todas activadas); 48 relaciones sin columnas de auditoría ni duplicados de llaves compuestas |
| `lapso-datos.json` | **generado** |

- **Exportar a video** (pedido del usuario: llevarlo a un editor): `node scripts/exportar-demo-video.mjs [--salida ruta.mp4] [--ancho 1920] [--alto 1080] [--fps 60] [--hasta segundos]`.
  - Por omisión genera `%USERPROFILE%Videosdemo-construccion-erp.mp4` en 1920×1080, 60 fps, H.264 `yuv420p`, CRF 16, `+faststart`.
  - Se graba cuadro a cuadro con un reloj virtual inyectado antes de cargar la página: temporizadores, `requestAnimationFrame`, `performance.now`/`Date.now`, animaciones y transiciones CSS (en pausa y colocadas con `currentTime`) y desplazamientos suaves avanzan exactamente 1/fps. El video es fluido aunque cada captura tarde unos 200 ms.
  - Oculta el indicador de Next, «Repetir» y las barras de desplazamiento.
  - Requiere ffmpeg: se instaló con `winget install Gyan.FFmpeg` (9.0.2). El script lo busca en PATH, en WinGet o en `FFMPEG`.
  - Tarda unos 12 s reales por segundo de video.
- **Regenerar** los datos (tras nuevos commits o migraciones): `node scripts/generar-lapso-construccion.mjs`. Toma el contenido de cada archivo en su commit (`git show`), las migraciones del disco y el historial. Falla si alguna tabla de `esquema-bd.json` no tiene una migración que la cree y rechaza secretos o correos no ficticios; se admiten los dominios `example`/`ejemplo`. Si cambia el esquema, actualizar antes `esquema-bd.json` con una consulta de solo lectura.
- **Eliminado:** `formulario.tsx` y `reproductor.tsx` (versiones anteriores).
- **Supabase:** solo lectura por MCP; sin migraciones ni escrituras.

**Evidencia:**

| Comando | Resultado |
|---|---|
| `tsc --noEmit`, `npx eslint app/demo-construccion scripts/…` | OK |
| `npx vitest run app/demo-construccion lib/auth` | 10/10 |
| `node scripts/e2e-demo-construccion.mjs` contra `localhost:3000` | **51/51**, Edge sin interfaz |

La e2e comprueba:
- que los extractos sean idénticos a `supabase/migrations` y a `git show` de cada commit, y que los commits y mensajes sean reales;
- que cada línea mostrada en el editor exista en su archivo real (1544 revisadas);
- que surjan las 32 tablas y se conecten las 48 relaciones, con la base sin cursor ni animaciones;
- que el sistema se construya a la par del código en cada pantalla (cuadros con bloques hechos y pendientes) y quede completo al terminar cada archivo;
- las pruebas de diseño (cinco aspectos, dos intentos y el valor real; la tipografía cambia de verdad), los títulos tecleados y que los valores finales del inspector existan en `globals.css`;
- que la base muestre tipos reales, cree las tablas columna por columna y registre cada `create table` y cada llave foránea reales;
- el orden de etapas y archivos y la duración;
- la base debajo del editor, la ausencia de marcos de ventana, el sistema más ancho y la barra lateral contenida a 1440 y 1280 px;
- la ausencia de desbordamiento a 1440/390/320 px;
- la escena de prueba: gráfico abierto y cobro registrado en orden, formulario, cursor, desplazamiento, aviso real, barra lateral fija al desplazarse e indicador en L 4,700.00;
- el cierre real, la consola sin errores y el movimiento reducido;
- que no haya peticiones a Supabase y que `/clientes` siga autenticado.

Capturas revisadas: prueba de tipografía (Georgia → Trebuchet → Inter), prueba de color del panel, creación de tablas de E1 y E2 con tipos y registro, escritorio y móvil.

**Defectos corregidos durante la revisión:**
- Correo de ejemplo `@ejemplo.hn` detenido por el filtro de secretos: es correcto que se detuviera.
- La prueba no admitía dos versiones de una misma ruta.
- Las líneas de la terminal se encimaban en móvil.
- Un conector atravesaba una tabla intermedia.
- La barra lateral se salía de la vista previa.
- La duración pasaba de 54 s.
- En la escena final, la barra lateral fija del ERP se movía con la página: la animación de entrada dejaba una transformación (`both`), y además el primer desplazamiento empezaba antes de que terminara. Se corrigió con `backwards` y con el primer desplazamiento a los 800 ms.

**Pendientes / decisiones del usuario:**
- **Riesgo:** `/demo-construccion` es pública (sin sesión, `lib/auth/rutas.ts`) y ahora muestra fragmentos de código y la estructura real de la base. Decidir si exige sesión antes de publicar el ERP.
- No se ejecutó `next build`, porque el servidor de desarrollo del usuario está activo en `:3000`.
- Sin commit: el usuario no lo pidió.
- No se inicia E7.

## Lapso de construcción por capas (2026-10-29)

- **Resultado:** según la aclaración del usuario («una animación de cómo se construye el sistema, desde su esqueleto, su color, sus animaciones»), `/demo-construccion` muestra pantallas reales del ERP armándose por capas. El recorrido dura 10.7 s y arranca solo al abrir la página. No tiene rótulos ni controles; al final solo aparece «Repetir».
- **Capas, en cada pantalla:**
  1. **Esqueleto:** se traza de arriba abajo; contornos, barras grises en lugar de texto y marcos punteados en lugar de íconos y acentos.
  2. **Contenido:** textos e íconos reales, en blanco y negro.
  3. **Color:** un filtro gris que se retira en barrido de izquierda a derecha.
  4. **Vivo:** animaciones reales (entrada del panel, cifras que cuentan, buscador que escribe ejemplos, caja que se abre) más filas e insignias que entran.
- **Pantallas:** panel de inicio (también arma el marco y el menú lateral) → listado de Membresías → formulario Nuevo cliente, que se escribe solo y termina con el aviso real «Cliente registrado.». Las pantallas siguientes se arman más rápido.
- **Cómo:** `page.tsx` (servidor) arma el panel y el listado con los componentes reales (`pantallas.tsx`). `formulario.tsx` reproduce el marcado de `FormularioCatalogo`. `lapso.tsx` reproduce el marco de `navegacion.tsx` y fija `data-capa` en el marco y en el contenido según el reloj de `guion.ts`. `demo.css` define las capas sobre las clases reales de `globals.css`; no cambia estilos del ERP.
- Datos ficticios. La interfaz es inerte; no hay sesión, consultas ni acciones. Con movimiento reducido se muestra el resultado final. Sin cambios en autenticación, permisos ni Supabase. No se inicia E7.

| Comando | Resultado |
|---|---|
| `tsc --noEmit` / `npx eslint app/demo-construccion scripts/e2e-demo-construccion.mjs` | OK |
| `node scripts/e2e-demo-construccion.mjs` contra `localhost:3000` | **36/36**, Edge sin interfaz |

La prueba graba un recorrido completo y comprueba:
- el orden pantalla/capa;
- la duración;
- los estilos computados de cada capa: texto transparente con barra y sin íconos en el esqueleto; texto e íconos con filtro gris en el contenido; recorte animado en el color; sin filtro en vivo;
- que la caja se abre solo en vivo;
- las piezas reales y el menú;
- el formulario escrito y el aviso;
- la ausencia de rótulos;
- la ausencia de desbordamiento a 1440/1280/390/320 px y la barra móvil;
- la consola sin errores y el movimiento reducido;
- que no hay peticiones a Supabase y que `/clientes` sigue pidiendo sesión.

Corregidos durante la revisión: un efecto que devolvía un valor (detenía el reloj) y un barrido que saltaba en lugar de animarse (faltaba `from` en el keyframe). Capturas revisadas de cada capa en escritorio, del barrido a medias y del esqueleto en móvil. No se ejecutó `next build`, porque el servidor de desarrollo del usuario está activo.

## Simulación visual del sistema — sustitución de la demo (2026-10-29)

- **Resultado:** se reemplaza la demo explicativa anterior según la corrección del usuario. `/demo-construccion` muestra únicamente el sistema a pantalla completa y controles de video discretos. Se retiran editor, terminal, navegador decorativo, títulos narrativos y capítulos explicativos.
- **Secuencia, 72 segundos:** HTML con estilos nativos (0–5 s), distribución (5–10 s), tipografía (10–15 s), colores/tarjetas (15–20 s), cifras/barras/entradas animadas (20–27 s), navegación y alta de cliente (27–39 s), membresía (39–51 s), cobro (51–63 s), panel actualizado (63–72 s).
- El mismo árbol del panel recibe las capas de diseño; se reutilizan marca e iconos del ERP y se reproducen su navegación, buscador, accesos, tarjetas, tablas y formularios. El cursor sigue elementos de la interfaz y usa el reloj del reproductor, igual que la escritura y la apertura de ventanas.
- Datos ilustrativos deterministas: cliente inicial con cargos de alquiler/transporte por L 2,300.00; alta de Ana Demo, mensualidad de L 500.00 y cobro de L 500.00. Panel final: ingresos L 2,800.00, cobros L 500.00, pendiente L 2,300.00, 2 clientes y 1 membresía. Buscar hacia atrás deshace los registros; reiniciar restaura HTML sin estilos.
- Se conservan pausa/reanudación, reinicio, línea de tiempo, velocidades y pantalla completa. La simulación es inerte; solo los controles de reproducción son interactivos. Movimiento reducido elimina transiciones/cursor y muestra campos completos. Indicador discreto de datos ficticios en el reproductor de escritorio.
- **Seguridad/esquema:** sin cambios en autenticación, permisos, consultas o acciones de negocio. Sin migraciones ni acceso a Supabase. No se inicia E7 ni se publica el ERP. Cambios previos de otras tareas conservados.

### Evidencia de la versión sustitutiva

| Verificación | Resultado |
| --- | --- |
| `npm.cmd run typecheck` | OK |
| `npm.cmd run lint` | OK |
| `npm.cmd test` | **118/118** |
| `npm.cmd run build` | OK, 62 páginas; demo estática |
| `node scripts/e2e-demo-construccion.mjs` contra `localhost:3000` | **83/83**, Edge sin interfaz |

El script verifica estilos nativos iniciales, transformación del mismo panel, tipografía/colores, cifras y gráficos animados, navegación, formularios inicialmente vacíos, escritura progresiva, confirmación, coherencia del panel final, búsqueda hacia atrás, pausa de reloj y cursor, reinicio al HTML, velocidad y final exacto. Incluye anchos 1280/390/320 px, controles visibles, movimiento reducido, ausencia de consultas de navegador a Supabase y autenticación intacta de `/clientes`. Capturas revisadas en `.next/demo-capturas/`: HTML, estructura, diseño, tres formularios, panel final y formulario móvil.

**Revisión y límites:** los controles operativos representados son inertes, no admiten entradas reales. La presentación es HTML animado, sin audio ni archivo de video. En pantallas pequeñas el contenido del sistema permite desplazamiento interno y los controles permanecen visibles. La apertura de pantalla completa depende del navegador y no se probó automáticamente. Sin defectos funcionales pendientes identificados para este ajuste.

## Presentación animada del desarrollo (2026-10-29)

> Versión anterior, sustituida por la simulación visual descrita arriba. Se conserva esta sección como historial.

- **Resultado:** demo local en `/demo-construccion`, solicitada como recreación de la construcción del ERP. Siete capítulos, 98 segundos, escritura de código, pestañas de navegador, cursor, formularios con datos ficticios y resultados conectados. No inicia E7 ni publica el sistema.
- **Controles:** reproducir, pausar, reiniciar, buscar en la línea de tiempo, saltar capítulos, velocidades 0.5×/1×/1.5×/2× y pantalla completa cuando el navegador la permita. Empieza pausada y se pausa al ocultar la pestaña. Movimiento reducido muestra textos completos y elimina transiciones.
- **Diseño:** reutiliza `MarcaIcono`, `Icono`, tarjetas, insignias y colores existentes; las pantallas operativas están recreadas sin importar sus acciones ni consultas. Estilos exclusivos con prefijo `dc-`; controles visibles en escritorio y móvil.
- **Datos:** Ana Demo, correo reservado `ana@example.com`, plan y recursos de ejemplo. Mensualidad de L 500.00, alquiler cerrado de L 1,500.00 y transporte completado de L 800.00: ingresos L 2,800.00, cobro L 500.00 y pendiente L 2,300.00. Son valores ilustrativos, no nuevas tarifas ni configuración comercial.
- **Seguridad:** solo `/demo-construccion` se permite sin sesión, por ser una presentación ficticia; no se permiten sus subrutas. Los módulos del ERP conservan autenticación. No hay acciones, escrituras, consultas de datos operativos ni credenciales en la demo. El proxy de sesión existente sigue aplicándose. Metadatos `noindex`/`nofollow`.
- **Migraciones:** ninguna; no se usó MCP ni se modificó Supabase.

### Evidencia

| Verificación | Resultado |
| --- | --- |
| `npm.cmd test` | **118/118**, incluidos los límites de la nueva ruta pública |
| `npm.cmd run lint` | OK; tras la corrección visual, ESLint de todos los archivos de la demo, script y rutas de acceso también OK |
| `npm.cmd run typecheck` | OK; TypeScript también pasó en el build final |
| `npm.cmd run build` | OK, 62 páginas; `/demo-construccion` prerenderizada estáticamente |
| `node scripts/e2e-demo-construccion.mjs` | **53/53** contra el build local en `localhost:3001`, Edge sin interfaz, sin usuarios ni datos reales |

El script comprueba las siete escenas, escritura y campos, resultados, pausa/reanudación, reinicio, búsqueda, capítulos, velocidad, fin exacto, repetición, movimiento reducido, ausencia de peticiones del navegador a Supabase y redirección al login de `/clientes` y `/demo-construccion/clientes`. Verifica ausencia de desbordamiento horizontal a 390 y 320 px y controles visibles a 1280×800 y 390×844. Capturas revisadas: escritorio (formulario y resultado) y móvil, generadas en `.next/demo-capturas/` (ignoradas por Git).

### Revisión propia, defectos corregidos y límites

- La regla CSS de Turbopack existente no exportaba los nombres de CSS Modules: la primera captura mostró la demo sin estilos. Se cambió a CSS con prefijos exclusivos sin modificar la configuración compartida.
- Las animaciones de entrada pausadas podían ocultar la primera pantalla; se eliminan esas entradas al pausar o buscar. Los controles permanecen disponibles al desplazarse en móvil.
- El script de navegador inicialmente tenía dos selectores con comillas incorrectas; corregidos y ejecutado de nuevo sobre la versión compilada.
- Es una recreación ilustrativa, no una grabación ni una reproducción exacta del historial Git. Fragmentos de código y terminal rotulados como simulados; no se ejecutan. Sin audio ni exportación a video, conforme al formato de demo en navegador elegido.
- Pantalla completa depende de la API y permisos del navegador; tiene mensaje de alternativa. No se comprobó su apertura automáticamente. No hay pendientes funcionales para esta entrega.
- Conservados todos los cambios locales previos; el commit de esta entrega incluye únicamente la demo, su prueba, la excepción exacta de ruta y esta documentación.

## Ajuste de cobros — aplicación automática por antigüedad (2026-10-28)

- **Resultado:** implementación y migración aplicadas en Supabase Cloud de desarrollo; verificación SQL local y remota, regresiones API (incluida la concurrencia) y navegador aprobadas. No se inicia E7.
- Regla acordada: cada cobro nuevo recorre los cargos vigentes del cliente por `fecha`, `created_at`, `id`; liquida cada pendiente y abona el remanente al siguiente. El excedente sobre la deuda queda a favor. No busca combinaciones de importes ni requiere selección manual.
- Se conservan cobros históricos, anticipos anteriores, aplicaciones de saldo a favor a cargos nuevos, permisos y reversos. La distribución se calcula en PostgreSQL, con importes `numeric(14,2)`, bloqueos en orden fijo y consulta de saldos después del bloqueo.
- Formulario sin campos por cuota; la Server Action ignora campos de distribución inyectados y conserva la actualización de membresías después de confirmar el cobro. La entrada `registrar_cobro_automatico` impide que la UI nueva utilice silenciosamente el comportamiento antiguo si falta la migración.
- **Migración aplicada:** [20261029011014_cobros_automaticos_antiguedad.sql](../supabase/migrations/20261029011014_cobros_automaticos_antiguedad.sql). Generada originalmente mediante Supabase CLI como `20261029004533`; renombrada al identificador asignado por MCP al aplicarla, sin cambiar el SQL. Reemplaza `registrar_cobro` conservando la firma para reintentos históricos y añade la entrada automática sin distribución manual. No crea tablas ni modifica registros históricos. MD5 del archivo y del SQL en `supabase_migrations.schema_migrations`: **`6a31f2de714ba1d0fed1f013f8887aba`**. La fecha del nombre es UTC; corresponde al 28 de octubre en Honduras.
- Se ajustaron las pruebas API/navegador que enviaban distribuciones manuales y se añadió un caso de dos cobros distintos simultáneos en `scripts/verificar-finanzas.mjs`.

### Evidencia local

| Verificación | Resultado |
|---|---|
| `npm.cmd test` | **111/111**; incluye 4 pruebas nuevas de la Server Action: permisos, validación, distribución inyectada y fallo sin reactivar membresías |
| `node scripts/verificar-cobros-automaticos.mjs` | **35/35** en PostgreSQL temporal PGlite 0.5.13; ejecuta migraciones reales E1/E2 y este ajuste, con usuarios ficticios y Auth simulado |
| `npm.cmd run lint` | OK, sin avisos tras retirar variables de pruebas obsoletas |
| `npm.cmd run typecheck` | OK; también TypeScript pasó en el build posterior con la nueva entrada RPC |
| `npm.cmd run build` | OK, 61 páginas |

Los 35 casos SQL verifican prioridad incluso si el importe coincide con un cargo reciente, pago completo/parcial, saldo previamente abonado, desempates, centavos, excedente, cliente sin deuda, aislamiento, anulaciones, idempotencia histórica/nueva, rechazo de reparto manual, reversos, rol inactivo/anon y escritura directa denegada. Una falla inducida en la segunda aplicación revierte también la primera y el cobro completo. Se comprueban partida doble, una sola entrada en caja y ausencia de sobreaplicaciones.

### Revisión y límites pendientes

- Corregido durante revisión: sin una entrada RPC nueva, el formulario actualizado podía invocar la implementación antigua y dejar el dinero sin aplicar mientras faltara migrar. Ahora falla sin registrar dinero.
- El bloqueo de acceso MCP quedó resuelto al continuar desde `425bc49`: se comprobó acceso al proyecto configurado `cgohbizokewvivxmvbij` y se aplicó únicamente esta migración allí. No se cambiaron proyectos ni se usó producción.
- Las regresiones API/navegador y la concurrencia real se ejecutaron después contra Cloud (sección siguiente).
- La dependencia de prueba está aislada en `supabase/.temp/pruebas-cobros` (ignorado). Preparación reproducible en la cabecera del script; no se añadieron dependencias a la aplicación ni se utilizó Docker.
- Los cambios locales previos de otras tareas se conservaron. El commit de este ajuste incluye únicamente sus cambios, con selección de bloques en los archivos compartidos.

### Continuación de `425bc49`: aplicación y verificación Cloud (2026-10-28)

| Verificación | Resultado |
|---|---|
| MCP: inspección del esquema y funciones existentes | La implementación anterior era manual; la entrada automática no existía y la migración no figuraba en el historial |
| MCP: aplicación y comprobación de contenido | Aplicada como `20261029011014`; SQL idéntico al archivo local (MD5 indicado arriba) |
| Históricos antes/después de migrar | Mismos conteos y MD5 de todos los registros en cobros (2), aplicaciones (0), asientos (6) y movimientos (4) |
| [verificar-cobros-cloud.sql](../scripts/verificar-cobros-cloud.sql), por MCP | **28/28**, PostgreSQL 17.11 real; usuarios ficticios y datos dentro de `BEGIN`/`ROLLBACK`, sin residuos |
| Privilegios de ambas funciones | `anon` y `PUBLIC` sin ejecución; `authenticated` con ejecución; `search_path` vacío. Entrada nueva `SECURITY INVOKER`, función interna pública con validación de perfil/rol |
| Libro tras pruebas SQL remotas | 6 asientos, **0 descuadrados**; mismos MD5 de cobros y asientos; 0 clientes de la prueba persistidos |
| `npm.cmd test` | **111/111**, 13 archivos |
| `node scripts/verificar-cobros-automaticos.mjs` | **35/35**, también tras actualizar la ruta al nombre aplicado |
| `npm.cmd run typecheck` | OK |

Los 28 casos remotos cubren prioridad por fecha pese a coincidencia de importe, abono parcial, cliente ajeno, cargo anulado, reintentos y ausencia de duplicados, roles operador/finanzas, excedente, una sola entrada en caja, anticipo previo intacto, centavos, rechazo atómico de reparto manual, reverso de cada cuota, partida doble, ausencia de sobreaplicaciones, perfil inactivo, RLS y rechazo de escritura directa/anon. Se usa el rol PostgreSQL `authenticated` con claims de usuarios ficticios; esto no equivale a iniciar sesión por Supabase Auth.

**Advisors de seguridad:** 72 avisos de [funciones `SECURITY DEFINER` ejecutables por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), coherentes con las RPC protegidas del sistema, y el aviso existente de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). La función de cobro valida perfil activo y rol antes de escribir; la entrada nueva es `SECURITY INVOKER`. No se alteró la configuración Auth.

No se modificó código de la aplicación en esta continuación: se alineó el nombre de la migración con Cloud, se actualizó su referencia en la prueba local y se añadió la prueba SQL remota reproducible. El build aprobado en el commit original sigue siendo evidencia de esa implementación; no se repitió en esta continuación.

### Regresiones API y navegador contra Cloud (2026-10-28)

Usuarios ficticios `prueba.*@example.com` existentes, con contraseñas nuevas en un archivo `E2E_CREDENCIALES` fuera del repositorio. Estaban todos inactivos: se activaron administrador, operador y finanzas para las pruebas y al terminar se dejaron otra vez inactivos. Navegador contra el `next dev` del usuario (`:3000`).

| Verificación | Resultado |
|---|---|
| `verificar-finanzas.mjs` (incluye dos cobros simultáneos) | **78/78** |
| `verificar-rls.mjs` | **61/61**. Un primer intento dio 60/61 porque los perfiles se activaron por SQL antes de correrlo: `actualizar_perfil` no registró bitácora al no haber cambio. Con la precondición original (operador y finanzas inactivos), 61/61 |
| `verificar-membresias.mjs` / `verificar-ambulancias.mjs` / `verificar-alquileres-transportes.mjs` | **92/92** / **74/74** / **73/73** |
| `verificar-reportes.mjs` / `verificar-membresia-contrato.mjs` | **64/64** / **31/31** |
| `e2e-membresias.mjs` / `e2e-reportes.mjs` | **26/26** / **29/29** |
| `e2e-finanzas.mjs` | **27/27**, tras ajustar la prueba: con las ventanas emergentes, el botón que abre y el de envío se llaman «Reversar cobro» y `pulsar` tomaba el primero. Ahora se pulsa el de `dialog[open]`. El ajuste queda junto con los cambios sin confirmar de las ventanas emergentes en ese archivo |

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

E3: `9b5b864`.

---

## E4 — Traslados de ambulancia

- **Fecha:** 2026-10-26 (America/Tegucigalpa)
- **Resultado:** APROBADO. Todo se verificó contra Supabase Cloud de desarrollo (`cgohbizokewvivxmvbij`, comprobado con `get_project_url` antes de aplicar cambios), por API REST con usuarios reales, por SQL y en navegador real.

### Funcionalidad entregada

- **Solicitudes** (administrador y operador):
  - Cliente → membresía (cubierto) o servicio particular → datos: beneficiario o pasajero, fecha y hora, duración estimada (90 min por omisión, ajustable), origen, destino, motivo, observaciones, ambulancia y conductor opcionales, y precio si es particular.
  - Una solicitud urgente se registra con solo cliente, hora y origen. Cada formulario lleva su clave de idempotencia.
- **Estados operativos:** solicitado → programado → en curso → completado, o cancelado (solo antes de iniciar), con trazabilidad en la bitácora. Un trigger de la base rechaza las transiciones incoherentes y cualquier cambio a un traslado completado o cancelado.
- **Cobertura** (solo cubiertos): `valida`, `pendiente_validacion` o `no_valida`, separada del estado operativo.
  - Se evalúan el estado de la membresía, las cuotas vencidas fuera de gracia, el vínculo del beneficiario en la fecha, el período de esa fecha y el cupo compartido o individual (contando reservas y consumos).
  - Si la cobertura no es válida, la solicitud se conserva sin reserva, no puede iniciarse como cubierta y puede revalidarse.
- **Reservas y consumos** (`reservas_beneficio`): una reserva por traslado, contada en el período de la fecha del servicio.
  - Al completar se consume exactamente una; al cancelar se libera con motivo. Completar dos veces no consume otra.
  - Un período futuro todavía no generado recibe una reserva provisional; no se genera la mensualidad por adelantado.
  - Antes de iniciar se revalida y solo se inicia con el período generado y la reserva confirmada.
- **Revalidación automática** (triggers sobre `membresias` y `membresia_beneficiarios`) cuando cambian el estado, el ciclo o las condiciones de la membresía o sus beneficiarios: suspensión, cancelación, reactivación, renovación, cambio de cupo, baja o alta de un beneficiario.
  - Las reservas inválidas se liberan. Si sobran reservas, se liberan primero las más recientes.
  - Las solicitudes sin cobertura recuperan el cupo por orden de llegada.
- **Paso a particular:** explícito, con precio, motivo y confirmación de que el cliente acepta. Libera la reserva y conserva el historial de cobertura (bitácora y reservas liberadas).
- **Recursos** (`ocupaciones_recurso`, tabla técnica reutilizable por E5):
  - Ambulancia operativa (tipo ambulancia o mixto) y conductor activo, obligatorios para iniciar.
  - Una restricción de exclusión GiST impide dos horarios planificados que se crucen para el mismo recurso. Las funciones bloquean además la fila del recurso, de modo que dos asignaciones simultáneas no pasan.
  - Un servicio en curso ocupa el recurso hasta terminar, aunque se prolongue. Ajustar su duración informa de los cruces con servicios posteriores sin reprogramarlos.
  - Los recursos pueden reasignarse con registro del cambio.
- **Inicio y fin:**
  - Al iniciar se registra la hora real. Un particular puede iniciarse sin pagar.
  - Al finalizar se registran la hora real y las observaciones, y se liberan los recursos. En un cubierto se consume el beneficio, sin ingreso nuevo. En un particular se genera un solo cargo de E2 por el precio pactado (D 1200 / H 4200) y, si el operador lo indica, se aplica el saldo a favor del cliente con `aplicar_saldo_a_favor`.
- **Cancelación** con motivo: libera recursos y reserva, no genera cargo, y los anticipos quedan como saldo a favor.
- **Corrección** (solo administrador): devolver un beneficio consumido. Los importes se corrigen con los reversos de E2.
- **Interfaz `/ambulancias`:**
  - Listado con fecha, cliente, beneficiario o pasajero, tipo, estado, cobertura, ambulancia y conductor; filtros por búsqueda, estado, tipo y fechas.
  - Nueva solicitud, con la cobertura de hoy y una tarifa que propone el precio.
  - Detalle con datos, horario, recursos, cobertura e historial de reservas, datos financieros separados del estado operativo, acciones según estado y rol, avisos e historial.
  - El panel muestra traslados de hoy, en curso, pendientes sin recursos y cubiertos sin cobertura válida.
  - `/ambulancias/traslados` (la ruta de la especificación maestra) redirige al módulo. El detalle del cargo enlaza al traslado.

### Decisiones (opción más simple compatible con la especificación)

- **Permisos:** registrar y gestionar traslados, administrador y operador. Finanzas consulta y cobra mediante E2, sin cambiar estados. Devolver un beneficio consumido, solo administrador.
- **Ciclo de la solicitud:** se puede iniciar desde «solicitado» (urgencias) o «programado». La reserva se hace al registrar.
- **Datos obligatorios:** el destino se exige para iniciar y el precio de un particular para finalizar.
- **Cancelación:** no consume beneficio ni aplica penalización.
- **Reutilización de E3 sin reescribirlo:** se reemplazó `private.cupo_ocupado` (en E3 devolvía 0) para que cuente reservas reales, y se añadieron triggers de revalidación. No se modificó ninguna función pública de E2 ni de E3.
- **Hora local:** Honduras no tiene horario de verano; la interfaz convierte la hora local a UTC−6.

### Archivos principales

- Migraciones: [origen](../supabase/migrations/20261026220923_e4_ambulancias_origen.sql), [estructura](../supabase/migrations/20261026221014_e4_ambulancias_estructura.sql), [operaciones](../supabase/migrations/20261026221256_e4_ambulancias_operaciones.sql) e [índice](../supabase/migrations/20261026223142_e4_ambulancias_indice.sql).
- Aplicación:
  - [lib/ambulancias/](../lib/ambulancias/): `acciones.ts` (Server Actions) y `definiciones.ts` (formularios, etiquetas y la matriz de acciones por estado y rol).
  - [components/ambulancias/](../components/ambulancias/) y rutas en `app/(privado)/ambulancias/`.
  - Campo `fecha_hora` en el formulario común, con conversiones en [lib/formato.ts](../lib/formato.ts); filtros con selectores adicionales.
- Verificación: [scripts/verificar-ambulancias.mjs](../scripts/verificar-ambulancias.mjs), [scripts/e2e-ambulancias.mjs](../scripts/e2e-ambulancias.mjs) y [lib/ambulancias/ambulancias.test.ts](../lib/ambulancias/ambulancias.test.ts).

### Cambios de esquema / migraciones (aplicadas en `cgohbizokewvivxmvbij` por MCP)

| Versión | Archivo | Contenido | MD5 (archivo = `schema_migrations`) |
|---|---|---|---|
| `20261026220923` | `e4_ambulancias_origen` | Valor `traslado_ambulancia` en `origen_cargo`, en migración propia por ser un valor nuevo de enum | `d3557650…` |
| `20261026221014` | `e4_ambulancias_estructura` | Extensión `btree_gist` (esquema `extensions`); 5 enums; tablas `traslados_ambulancia` (CHECK de coherencia de tipo, cargo, ejecución y cancelación), `reservas_beneficio` (una vigente por traslado) y `ocupaciones_recurso` (exclusión de solapes); índices; triggers de protección (transiciones, reservas y ocupaciones; sin DELETE ni TRUNCATE); vista `saldos_traslados`; RLS de solo lectura | `ffb1e6cf…` |
| `20261026221256` | `e4_ambulancias_operaciones` | 16 funciones públicas `SECURITY DEFINER` con `search_path` vacío, `auth.uid()` y rol verificados; 24 auxiliares en `private` sin acceso desde la API; triggers de revalidación sobre membresías y vínculos; reemplazo de `private.cupo_ocupado` | `f99410b0…` |
| `20261026223142` | `e4_ambulancias_indice` | Índice completo de la FK `reservas_beneficio.membresia_id`, detectado en la revisión propia | `2bbd68fc…` |

- Antes de aplicar se comprobó que ningún nombre nuevo existiera. Nada se borra ni se modifica de forma destructiva.
- Tipos regenerados en [lib/supabase/tipos-bd.ts](../lib/supabase/tipos-bd.ts).
- **Advisors de seguridad:** 16 avisos nuevos «SECURITY DEFINER ejecutable por authenticated», intencionales como en E2 y E3 (son las únicas vías de escritura), más el aviso manual de contraseñas filtradas.
- **Índices de FK:** las tres tablas nuevas tienen cubiertas todas sus claves foráneas (verificado por SQL).

### Comandos y pruebas (2026-10-26, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | OK / OK |
| `npm test` | OK, 8 archivos, **69 pruebas** (11 nuevas: transiciones por estado y rol, hora local y formularios) |
| `npm run build` | OK (`/ambulancias`, `/ambulancias/nuevo`, `/ambulancias/[id]`, `/ambulancias/traslados`) |
| `npm audit` | 0 vulnerabilidades |
| `node scripts/verificar-ambulancias.mjs` (API REST, usuarios reales) | **74/74**. En la primera ejecución, 73/74: la expresión de una comprobación no coincidía con el mensaje real (el comportamiento era el esperado); se corrigió la prueba |
| `node scripts/e2e-ambulancias.mjs` (Edge sin interfaz, `next start`) | **21/21**; log del servidor sin errores |
| Regresión E1: `verificar-rls.mjs` / `e2e-navegador.mjs` | **61/61** / **43/43** |
| Regresión E2: `verificar-finanzas.mjs` / `e2e-finanzas.mjs` | **75/75** / **28/28** |
| Regresión E3: `verificar-membresias.mjs` / `e2e-membresias.mjs` | **92/92** / **25/25** |
| SQL (transacción revertida): provisional → período generado; bajada y subida de cupo; cancelación | Las dos provisionales pasan a válidas con período enlazado; con cupo 1 se libera la más reciente y con cupo 2 se recupera; al cancelar la membresía, 0 reservas vigentes |
| Defensas contra el propietario (SQL, revertido) | Rechazados: DELETE y TRUNCATE; editar un completado; saltar de solicitado a completado; volver una consumida a reservada o moverla de período; cambiar el horario de una ocupación; insertar un solape (restricción de exclusión); una segunda reserva vigente del mismo traslado; finalizar uno no iniciado |
| Invariantes (SQL), tras todas las corridas | 396 asientos, 0 descuadrados, libro neto 0.00; 7 particulares completados = 7 cargos, sin huérfanos; 0 dobles consumos, 0 reservas u ocupaciones colgadas, 0 períodos sobrerreservados, 0 solapes activos, 0 movimientos de dinero por cargos o aplicaciones |

**Pruebas obligatorias (`verificar-ambulancias.mjs`, salvo indicación):**

1. Cubierto registrado por el operador: solicitado, con el cliente de la membresía, cobertura válida y reserva en el período de la fecha. El reintento con la misma clave no duplica.
2. Particular registrado y programado: precio pactado, pasajero sin ficha, sin cobertura ni reserva. No admite membresía.
3. Un beneficiario no vinculado se registra como no válido, sin reserva. Se rechazan un cubierto sin beneficiario y una membresía de otro cliente.
4. Con la membresía suspendida, la solicitud se conserva como no válida; con la activa, es válida.
5. La reserva aparece en la consulta de cupo (usados 1, disponibles 1).
6. Al completar se consume exactamente un beneficio, sin cargo ni ingreso nuevo.
7. Al cancelar se libera la reserva con motivo y vuelve el cupo.
8. Completar dos veces no consume otra vez. Un particular se inicia con saldo pendiente.
9. Dos solicitudes simultáneas por el último cupo: una válida y otra no; una sola reserva vigente.
10. Compartido 2: A completa uno y B reserva otro, disponibilidad 0, y la tercera solicitud no es válida.
11. Individual 2: A usa sus dos, la tercera de A no es válida y B conserva su cupo.
12. Período futuro: pendiente de validación con reserva provisional; no se genera la mensualidad; el cupo futuro cuenta las provisionales; no se inicia como cubierto. La confirmación al generarse el período se probó por SQL.
13. Pérdida y recuperación de cobertura:
    - La baja del beneficiario deja el traslado como no válido y libera la reserva; no se inicia ni se convierte solo.
    - La nueva alta lo revalida con una reserva nueva y conserva el historial.
    - El paso a particular es explícito y con motivo. Revalidar recupera el cupo liberado.
14. Reprogramación:
    - En el mismo período conserva la reserva y mueve los recursos.
    - A un período futuro deja una reserva provisional.
    - Sobre un horario ocupado se rechaza sin cambios. Exige motivo.
15. Ambulancia ocupada: rechazo con descripción del cruce. Un vehículo de alquiler no sirve. Dos asignaciones simultáneas de la misma ambulancia: solo prospera una. La consulta de disponibilidad marca la ocupada.
16. Conductor ocupado: rechazo; el intento fallido no deja ocupaciones.
17. No se inicia sin ambulancia y conductor.
18. Finalización: completado con hora real y observaciones; libera los recursos.
19. Dos finalizaciones simultáneas de un particular: un solo cargo de L 1,500 con asiento D 1200 / H 4200.
20. Cobro parcial de finanzas: pagado L 500, pendiente L 1,000, estado financiero «parcial».
21. Anticipo de L 800 aplicado al completar: pagado 800, pendiente 700, saldo a favor 0. Una sola entrada de dinero y una aplicación D 2200 / H 1200. Aplicar más saldo del disponible se rechaza sin completar nada.
22. Cancelación con anticipo: sin cargo, recursos liberados, saldo a favor conservado y sin movimientos nuevos.
23. Permisos:
    - Finanzas no registra, programa, asigna, inicia, cancela ni reprograma (42501); los tres roles consultan.
    - Solo el administrador devuelve un beneficio consumido.
24. RLS: `anon` no lee las 4 tablas o vistas ni ejecuta funciones; un usuario inactivo no registra. Nadie, ni el administrador, inserta, edita o borra directamente traslados, reservas u ocupaciones.
25. Un cargo por particular completado; ninguna reserva vigente duplicada; 13 asientos de la corrida balanceados; solo los cobros mueven dinero.
26. Regresión de E1, E2 y E3: tabla anterior.

**Escenarios en navegador (`e2e-ambulancias.mjs`):**

- **Operador, cubierto:** cobertura de hoy en el formulario; registro programado con recursos; iniciar y finalizar con consumo del beneficio.
- **Operador, particular urgente:** sin destino ni recursos, con precio propuesto por tarifa. El inicio se rechaza con un mensaje claro; luego edita el destino y asigna recursos. Al finalizar aplica el anticipo de L 500: cargo de L 1,200 con L 700 pendientes.
- **Cancelación:** rechazada sin confirmar; con motivo, el traslado se conserva.
- **Listado:** filtros por búsqueda, estado y tipo.
- **Finanzas:** ve los datos financieros y «Registrar cobro», sin acciones operativas, y consulta el historial.
- **Móvil 390×844:** sin desplazamiento horizontal.

### Datos en Supabase de desarrollo

- Registros ficticios marcados `[PRUEBA E4]`: planes, clientes, beneficiarios, ambulancias, conductores, cajas, tarifas, membresías, traslados, reservas, ocupaciones, cargos, cobros y asientos. Por diseño no se pueden borrar.
- Los usuarios ficticios se reactivaron temporalmente y **se desactivaron de nuevo** (bitácora). Solo el administrador real queda activo.

### Defectos encontrados y corregidos durante la etapa

1. **FK sin índice completo:** `reservas_beneficio.membresia_id` solo tenía un índice parcial. Corregido con la migración `20261026223142`.
2. **Función estable con UUID volátil:** `recursos_disponibles` usaba `gen_random_uuid()` como origen excluido. Se cambió por un UUID fijo antes de aplicar la migración.
3. **Pruebas:**
   - Una expresión no coincidía con el mensaje real.
   - Los intervalos llegan en UTC por la API.
   - Dos comprobaciones de defensas por SQL no eran concluyentes porque no había filas que modificar; se repitieron creando los datos en la transacción revertida.

### Pendientes (configuración manual del propietario, sin cambios desde E1)

1. Deshabilitar el registro público en Supabase › Authentication › Sign In / Providers.
2. Activar la protección de contraseñas filtradas si el plan lo permite.

### Limitaciones

- La condición de cobertura guardada se actualiza con los eventos (registro, reprogramación, revalidación, inicio y cambios de membresía). Una cuota que vence sin que nadie actualice las mensualidades no la cambia hasta la siguiente revalidación, pero el inicio siempre revalida.
- Los recursos solo se reasignan antes de iniciar. Durante el servicio solo se ajusta la duración.
- Corregir el importe de un particular completado se hace con E2: anular el cargo y registrar un cargo administrativo. El traslado conserva el cargo anulado como referencia.
- No hay penalizaciones por cancelación, mapas, GPS ni notificaciones (fuera del MVP).
- La alta muestra hasta 300 beneficiarios activos, sin buscador.
- Las pruebas de navegador se ejecutaron en el puerto 3100 (el 3000 lo ocupa un `next dev` del usuario, que no se tocó).

### Commit

E4: `b9f4c3f`.

---

## E5 — Alquileres y transporte con conductor

- **Fecha:** 2026-10-26 (America/Tegucigalpa)
- **Resultado:** APROBADO. Todo se verificó contra Supabase Cloud de desarrollo (`cgohbizokewvivxmvbij`, comprobado con `get_project_url` antes de aplicar cambios), por API REST con usuarios reales, por SQL y en navegador real.

### Funcionalidad entregada

- **Alquileres (`/alquileres`):**
  - Reserva: cliente → entrega y devolución previstas + tarifa → disponibilidad y precio propuesto (tarifa diaria × días en bloques de 24 h iniciados, mínimo 1) → precio ajustable → confirmar. El vehículo queda ocupado en el intervalo.
  - La reserva puede modificarse con motivo (vehículo, fechas, precio), siempre comprobando disponibilidad en la base.
  - **Entrega:** hora real, kilometraje y combustible de salida, observaciones. Puede entregarse sin estar pagado; el vehículo queda ocupado hasta su devolución real.
  - **Devolución:** hora real, kilometraje y combustible de regreso, observaciones y cargos adicionales expresos (concepto e importe). Se muestran el recorrido y la diferencia de combustible, sin calcular multas ni daños. Un kilometraje de regreso menor que el de salida solo lo admite el administrador, con motivo.
  - **Estados** validados por un trigger: reservado → entregado → devuelto, o cancelado (solo reservado). No se devuelve un vehículo no entregado ni se cancela uno entregado.
- **Transporte con conductor (`/transportes`):**
  - Solicitud con fecha y hora, duración estimada (90 min por omisión), origen, destino, tarifa de referencia, precio pactado y vehículo y conductor opcionales.
  - Programar, asignar o reasignar recursos, reprogramar, iniciar (exige ambos recursos aptos y libres), ajustar la duración en curso (con avisos, sin reprogramar otros), finalizar y cancelar sin iniciar.
  - Estados: solicitado → programado → en curso → completado, o cancelado.
- **Cobros (E2, sin un sistema nuevo):**
  - Un solo cargo: al devolver el alquiler (precio pactado + adicionales, D 1200 / H 4300) o al completar el transporte (D 1200 / H 4400). Repetir la operación, incluso de forma simultánea, no lo duplica.
  - Los anticipos son saldo a favor del cliente y se aplican al cerrar con `aplicar_saldo_a_favor`, sin nueva entrada de dinero.
  - Abonos y saldo pendiente con los cobros de E2. Las cancelaciones no generan cargo y los anticipos quedan como saldo a favor.
- **Disponibilidad compartida:**
  - Alquileres, transportes y traslados usan la misma tabla `ocupaciones_recurso` de E4, con su restricción de exclusión y el bloqueo del recurso. Un vehículo o conductor no puede estar en dos operaciones de cualquier módulo cuyos horarios se crucen.
  - Cancelar libera. Un alquiler entregado o un servicio en curso ocupa hasta su fin real y, aunque se pase de horario, impide nuevos inicios del mismo recurso.
  - Los avisos advierten del horario excedido y de las operaciones de las dos horas siguientes que pueden verse afectadas, sin modificarlas.
- **Vehículos:** se reutiliza `vehiculos`. Alquiler: tipo alquiler o mixto; transporte: transporte o mixto; ambulancia: ambulancia o mixto. Siempre activo y operativo; nunca se cambia el tipo.
- **Interfaz:**
  - Listados con búsqueda, estado y fechas.
  - Altas guiadas.
  - Detalles con datos, entrega y devolución o asignación, cobros (estado financiero separado del operativo), acciones según estado y rol, avisos e historial.
  - El panel muestra vehículos alquilados, devoluciones vencidas, entregas próximas y transportes de hoy y en curso. El detalle del cargo enlaza a su alquiler o transporte.

### Decisiones (opción más simple compatible con la especificación)

- **Permisos:** reservar, entregar, devolver y gestionar transportes, administrador y operador. Finanzas consulta y cobra (E2) sin cambiar estados. Corregir un kilometraje menor, solo administrador.
- **Anticipos:** no se vinculan a un contrato concreto; se aplican al cerrar el saldo a favor del cliente que indica el operador.
- **Reservas e inicio:**
  - El alquiler exige precio pactado al reservar; el transporte puede registrarse sin precio, que se exige al completar.
  - La entrega anticipada se rechaza si el vehículo tiene otra operación programada antes de la devolución prevista.
  - El inicio de un transporte, como el de un traslado, solo se bloquea si un recurso sigue en curso; los cruces posteriores son avisos.
- **Infraestructura de ocupaciones:** solo se añadieron los orígenes `alquiler` y `transporte` al enum de E4. Sus funciones y su restricción ya comparaban con ocupaciones de cualquier origen, así que no se duplicó nada. No se modificó ninguna función de E1–E4.

### Archivos principales

- Migraciones: [orígenes](../supabase/migrations/20261027002456_e5_alquileres_transportes_origenes.sql), [estructura](../supabase/migrations/20261027002539_e5_alquileres_transportes_estructura.sql), [operaciones](../supabase/migrations/20261027002739_e5_alquileres_transportes_operaciones.sql) y [avisos](../supabase/migrations/20261027002912_e5_avisos_horario_excedido.sql).
- Aplicación:
  - [lib/alquileres/](../lib/alquileres/) y [lib/transportes/](../lib/transportes/) (acciones y definiciones).
  - [components/operaciones.tsx](../components/operaciones.tsx): piezas comunes de los detalles, extraídas del detalle de traslados, que ahora también las usa.
  - Rutas en `app/(privado)/alquileres/` y `app/(privado)/transportes/`.
- Verificación: [scripts/verificar-alquileres-transportes.mjs](../scripts/verificar-alquileres-transportes.mjs), [scripts/e2e-alquileres-transportes.mjs](../scripts/e2e-alquileres-transportes.mjs) y [lib/alquileres/alquileres-transportes.test.ts](../lib/alquileres/alquileres-transportes.test.ts).

### Cambios de esquema / migraciones (aplicadas en `cgohbizokewvivxmvbij` por MCP)

| Versión | Archivo | Contenido | MD5 (archivo = `schema_migrations`) |
|---|---|---|---|
| `20261027002456` | `e5_alquileres_transportes_origenes` | Valores `alquiler` y `transporte` en `origen_ocupacion` y `origen_cargo` | `bd5d6803…` |
| `20261027002539` | `e5_alquileres_transportes_estructura` | Enums `estado_alquiler`, `nivel_combustible` y `estado_transporte`; tablas `alquileres`, `cargos_adicionales_alquiler` y `transportes` (CHECK de coherencia); índices; trigger genérico de transiciones; sin DELETE ni TRUNCATE; adicionales inmutables; vistas `saldos_alquileres` y `saldos_transportes`; RLS de solo lectura | `312c950e…` |
| `20261027002739` | `e5_alquileres_transportes_operaciones` | 17 funciones públicas `SECURITY DEFINER` con `search_path` vacío, `auth.uid()` y rol verificados; 6 auxiliares en `private` sin acceso desde la API | `0b2339e3…` |
| `20261027002912` | `e5_avisos_horario_excedido` | Los avisos de una operación en curso pasada de horario miran también las dos horas siguientes (revisión propia, ver defectos) | `0861cf52…` |

- Antes de aplicar se comprobó que ningún nombre nuevo existiera. Nada se borra ni se modifica de forma destructiva.
- Tipos regenerados en [lib/supabase/tipos-bd.ts](../lib/supabase/tipos-bd.ts).
- **Advisors de seguridad:** 17 avisos nuevos «SECURITY DEFINER ejecutable por authenticated», intencionales, más el aviso manual de contraseñas filtradas.
- **Verificación por SQL:**
  - Ninguna función es ejecutable por `anon` ni ninguna privada por `authenticated` (salvo los ayudantes de rol de E1).
  - Todas tienen `search_path` vacío.
  - No hay FK sin índice en las tablas nuevas.

### Comandos y pruebas (2026-10-26, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | OK / OK |
| `npm test` | OK, 9 archivos, **78 pruebas** (9 nuevas: días cobrables, precio sugerido, combustible, cargos adicionales y acciones por estado y rol) |
| `npm run build` | OK (`/alquileres`, `/alquileres/nuevo`, `/alquileres/[id]`, `/transportes`, `/transportes/nuevo`, `/transportes/[id]`) |
| `node scripts/verificar-alquileres-transportes.mjs` (API REST, usuarios reales) | **73/73** (dos ejecuciones) |
| `node scripts/e2e-alquileres-transportes.mjs` (Edge sin interfaz, `next start`) | **22/22** (tres ejecuciones); log del servidor sin errores. Un primer intento abortó antes de cualquier comprobación porque no encontró el formulario de login, un problema de tiempos al arrancar |
| Regresión E1: `verificar-rls.mjs` / `e2e-navegador.mjs` | **61/61** / **43/43** |
| Regresión E2: `verificar-finanzas.mjs` / `e2e-finanzas.mjs` | **75/75** / **28/28** |
| Regresión E3: `verificar-membresias.mjs` / `e2e-membresias.mjs` | **92/92** / **25/25** |
| Regresión E4: `verificar-ambulancias.mjs` / `e2e-ambulancias.mjs` | **74/74** / **21/21** (tres ejecuciones tras corregir una espera intermitente de la prueba, ver defectos) |
| Defensas contra el propietario (SQL, revertido) | Rechazados: editar un alquiler devuelto; saltar de reservado a devuelto; reabrir un transporte completado; editar un cargo adicional; DELETE y TRUNCATE |
| Invariantes (SQL), tras todas las corridas | 543 asientos, 0 descuadrados, libro neto 0.00; 9 alquileres devueltos = 9 cargos (importe = precio + adicionales); 9 transportes completados = 9 cargos; 0 cargos huérfanos, 0 ocupaciones colgadas, 0 entregados sin ocupación, 0 solapes planificados, 0 movimientos de dinero por cargos o aplicaciones |

**Pruebas obligatorias (`verificar-alquileres-transportes.mjs`):**

1. **Reserva:** reservado, L 3,600, sin cargo y una ocupación. El reintento con la misma clave no duplica. Se rechazan una ambulancia, un vehículo fuera de servicio y una devolución anterior a la entrega. La disponibilidad marca el vehículo ocupado.
2. **Reservas incompatibles:** una reserva que se cruza se rechaza y una contigua se admite. De dos reservas simultáneas que se cruzan, solo una prospera. Sin precio se rechaza.
3. **Entrega:** km 1,000, tanque lleno, con ocupación en curso. Exige km y combustible; no se entrega dos veces ni se cancela una vez entregado.
4. **Devolución:** no se devuelve sin entrega. De dos devoluciones simultáneas resulta un solo cargo. Cierra la ocupación. Un cargo adicional exige concepto; con L 400 el importe final es L 4,000 en un solo cargo.
5. **Kilometraje y combustible:** se registran 250 km recorridos y el paso de lleno a medio. Un kilometraje menor se rechaza al operador y al administrador sin motivo; el administrador lo corrige con motivo, que queda registrado.
6. **Anticipo** de L 1,000 de finanzas, aplicado al devolver: cargo L 3,600, aplicado 1,000, pendiente 2,600 (el ejemplo de la especificación) y una sola entrada de dinero.
7. **Cargo final** una sola vez, con asiento D 1200 / H 4300.
8. **Abono** de L 600: pendiente L 2,000 en el alquiler y en el cliente.
9. **Cancelación:** exige motivo; deja sin cargo y libera la ocupación; el intervalo se vuelve a reservar.
10. **Solicitud de transporte** sin recursos. El reintento no duplica y sin destino se rechaza.
11. **Asignación** de vehículo y conductor, con dos ocupaciones. Una ambulancia no sirve para transporte.
12. **Conflictos de horario:** vehículo y conductor ocupados se rechazan. De dos asignaciones simultáneas solo prospera una. Reprogramar sobre un horario ocupado se rechaza sin cambios y a uno libre conserva los recursos.
13. **Iniciar y completar:** no se inicia sin recursos; queda en curso con hora real; se completa y libera los recursos.
14. **Cargo único:** de dos finalizaciones simultáneas resulta un solo cargo de L 800 (D 1200 / H 4400). Sin precio no se completa.
15. **Anticipo** de L 300 aplicado: pendiente L 500, sin nueva entrada de dinero.
16. **Cancelación** antes de iniciar: libera y no genera cargo. Un servicio en curso no se cancela; uno cancelado no se inicia.
17. **Alquiler ↔ ambulancia** (vehículo mixto): bloqueado en ambos sentidos. Al cancelar el alquiler, el vehículo queda libre para el traslado.
18. **Alquiler ↔ transporte:** bloqueado en ambos sentidos.
19. **Ambulancia ↔ transporte:** no comparten vehículo ni conductor.
20. **Horario excedido:** con un alquiler entregado y pasado de su horario, no se inicia ni un transporte ni un traslado con ese vehículo. Los avisos señalan el exceso y las operaciones afectadas, sin cambiarlas. Tras la devolución real, el transporte se inicia.
21. **Reintentos concurrentes:** tres reservas y tres solicitudes simultáneas con la misma clave dejan un alquiler y un transporte, más los casos simultáneos de 2, 4, 12 y 14.
22. **Permisos:** finanzas es rechazada en 10 operaciones operativas (42501); los tres roles consultan. El operador modifica una reserva con motivo y la ocupación pasa al nuevo vehículo.
23. **RLS:** `anon` no lee las 5 tablas o vistas ni ejecuta funciones; un usuario inactivo no reserva. Nadie, ni el administrador, escribe directamente alquileres, transportes, adicionales u ocupaciones.
24. **Contabilidad:** un cargo por cada alquiler devuelto y cada transporte completado, ninguno por cancelaciones, y los 12 asientos de la corrida balanceados.
25. **Movimientos de dinero:** cada cobro tiene un único movimiento y nada más mueve caja.

**Escenarios en navegador (`e2e-alquileres-transportes.mjs`):**

- **Operador, alquiler:** reserva con disponibilidad (el vehículo ya reservado aparece ocupado y no se ofrece), 3 días a L 3,600 propuestos, entrega y devolución. Un cargo adicional sin importe se rechaza; con anticipo, quedan L 3,000 pendientes. Cancela otra reserva con motivo.
- **Operador, transporte:** propone el precio por tarifa, registra con recursos, inicia y finaliza: cargo de L 800 pendiente.
- **Listados** con búsqueda.
- **Finanzas:** ve cobros e historial y puede registrar un cobro, sin acciones operativas.
- **Móvil 390×844:** listado y detalles sin desplazamiento horizontal.

### Datos en Supabase de desarrollo

- Registros ficticios marcados `[PRUEBA E5]`: clientes, vehículos, conductores, cajas, tarifas, alquileres, adicionales, transportes, traslados, ocupaciones, cargos, cobros y asientos. Por diseño no se pueden borrar.
- Los usuarios ficticios se reactivaron temporalmente y **se desactivaron de nuevo** (bitácora). Solo el administrador real queda activo.

### Defectos encontrados y corregidos durante la etapa

1. **Avisos de horario excedido incompletos.** Con un alquiler entregado y vencido, los avisos solo detectaban cruces hasta el momento actual, no las operaciones que empiezan poco después. Corregido con la migración `20261027002912`. El bloqueo de inicios no cambió.
2. **Prueba de E4 intermitente** («la tarifa propone el precio…»): la espera se cumplía sobre el contenido que llega por streaming aún oculto. Se espera ahora a que sea visible (mismo patrón que en E3). No era un defecto de la aplicación.
3. **Pruebas de E5:** una comprobación de reprogramación no tenía efecto (cualquier resultado la daba por buena); se reescribió con un conflicto real.
4. **Interrupción de red** durante la revisión: el DNS de este equipo dejó de resolver y el MCP no respondió. Las comprobaciones SQL se repitieron completas al recuperarse.

### Pendientes (configuración manual del propietario, sin cambios desde E1)

1. Deshabilitar el registro público en Supabase › Authentication › Sign In / Providers.
2. Activar la protección de contraseñas filtradas si el plan lo permite.

### Limitaciones

- Un anticipo no se asocia a un contrato: el operador elige cuánto saldo a favor aplicar al cerrar.
- Las tarifas no están vinculadas a vehículos concretos: el operador elige la tarifa y el precio queda ajustable.
- El alquiler muestra las diferencias de kilometraje y combustible, pero no calcula multas ni daños (fuera del MVP).
- Corregir el importe de un alquiler devuelto o de un transporte completado se hace con E2: anular el cargo y registrar un cargo administrativo.
- Los recursos de un transporte en curso no se reasignan; solo se ajusta su duración.
- La ventana de avisos para operaciones pasadas de horario es de dos horas, solo informativa.
- Las pruebas de navegador se ejecutaron en el puerto 3100 (el 3000 lo ocupa un `next dev` del usuario, que no se tocó).

### Commit

El hash del commit de E5 se informa en la entrega (no puede incluirse en el propio commit).

## Rediseño UI/UX — Fase 1 (shell global)

- **Fecha:** 2026-10-26
- **Referencia:** `referencias-diseno/` (línea «D — Corporativa y Operativa»). Solo interfaz: sin cambios en Supabase, migraciones, RLS, acciones de servidor, permisos ni reglas de negocio.
- **Resultado:** implementada; pendiente de aprobación del propietario antes de la Fase 2 (dashboard).

### Cambios

- [app/globals.css](../app/globals.css): tokens de la guía ajustados a AA (primario `#1F6BD6` en lugar de `#2475E7`, que daba 4.40:1 con texto blanco; textos de estado oscurecidos), sombra discreta en `.tarjeta`, radios de 10 px en controles, foco de 2 px con color primario, enlace «Saltar al contenido». Se conserva el modo oscuro.
- [components/navegacion.tsx](../components/navegacion.tsx): barra superior de 64 px (sección actual + menú de cuenta con «Cerrar sesión») y barra lateral de 264 px fija desde 1280 px; por debajo se despliega con «Menú» (ancho completo en móvil, 288 px en tablet), se cierra con Escape, con el fondo o al navegar.
- [components/iconos.tsx](../components/iconos.tsx): iconos SVG en línea, decorativos, sin dependencias.
- [app/(privado)/layout.tsx](../app/(privado)/layout.tsx): menú reagrupado solo con rutas existentes y las mismas reglas por rol (Gastos: tesorería; Usuarios: administrador). «Panel» pasa a llamarse «Inicio»; Proveedores pasa a Finanzas; Planes y Tarifas, a Configuración. Contenido hasta `max-w-6xl`.

### Pruebas

| Comando | Antes | Después |
|---|---|---|
| `npm run lint` | OK | OK |
| `npm run typecheck` | OK | OK |
| `npm test` | 78/78 | 78/78 |
| `npm run build` | — | OK |

Revisión visual con Edge sin interfaz sobre el shell renderizado de forma estática (arnés temporal fuera del repositorio) a 1440, 1280, 1024, 820 y 390 px, en claro y oscuro: sin desplazamiento horizontal y foco visible. **Pendiente:** ejecutar los e2e con sesión real (`scripts/e2e-*.mjs`); los selectores que usan (`nav a[href]`, `#menu-principal`, botones «Menú» y «Cerrar sesión») se mantuvieron.

## Rediseño UI/UX — Fase 2 (panel de inicio)

- **Fecha:** 2026-10-27
- **Resultado:** implementada; pendiente de revisión del propietario. Sin cambios en Supabase, migraciones, RLS, acciones de servidor ni permisos.

### Cambios

- [app/(privado)/page.tsx](../app/(privado)/page.tsx):
  - Encabezado con perfil, fecha en Tegucigalpa y una acción principal según el rol: «Nueva solicitud de traslado» (administrador y operador) o «Registrar cobro» (finanzas).
  - Cuatro indicadores con período: traslados de hoy, transportes de hoy, vehículos alquilados ahora y membresías activas.
  - «Servicios activos y próximos»: traslados, transportes, entregas y devoluciones sin terminar, por hora prevista.
  - «Requiere atención»: los pendientes que ya existían, más las solicitudes de traslado y de transporte sin programar.
  - Accesos rápidos según el rol, finanzas (los mismos saldos de antes), estado de la flota (el campo `estado` registrado del vehículo, sin inferir disponibilidad a partir de los servicios), cobros recientes y catálogos.
- Una consulta que falla muestra «No disponible» o un aviso, nunca 0. Las listas vacías muestran su estado (por ejemplo, «Sin servicios programados»). Mientras carga se ve un esqueleto (`role="status"`).
- Sin gráficos: no hay histórico que los justifique. Sin variaciones porcentuales.
- [components/panel.tsx](../components/panel.tsx): componentes de presentación del panel. [lib/panel.ts](../lib/panel.ts): ordenar eventos y etiquetas de hora (pruebas en [lib/panel.test.ts](../lib/panel.test.ts)). `formatearFechaLarga` en [lib/formato.ts](../lib/formato.ts).
- Se conservan los textos que comprueban los e2e: «Perfil: …», «Traslados de hoy», «Vehículos alquilados ahora», «Membresías activas», «Cuotas vencidas», «Por cobrar (CxC)» y «Dinero disponible».

### Pruebas

`npm run lint` OK · `npm run typecheck` OK · `npm test` 82/82 (4 nuevas) · `npm run build` OK. Revisión visual con un arnés temporal fuera del repositorio (Supabase simulado con datos marcados «[ARNÉS]»), en los escenarios con datos, vacío, error y carga, a 1440, 1024 y 390 px, en claro y oscuro: sin desplazamiento horizontal. **Pendiente:** ejecutar los e2e con sesión real.

## Rediseño UI/UX — Fases 3 y 4 (biblioteca visual y módulos)

- **Fecha:** 2026-10-27
- **Resultado:** implementadas (el propietario aprobó hacer el rediseño completo). Sin cambios en Supabase, migraciones, RLS, acciones de servidor, permisos, campos, validaciones ni textos de los flujos.

### Biblioteca (componentes compartidos, misma API)

- [components/encabezado.tsx](../components/encabezado.tsx):
  - `Encabezado` (título, descripción y una acción principal; «volver» con icono).
  - `Cargando` (esqueleto; «Cargando…» queda para lectores de pantalla).
  - `SinPermiso` con icono.
  - `EstadoVacio`, nuevo.
- [components/finanzas/tabla.tsx](../components/finanzas/tabla.tsx): estado vacío, cabecera de columnas, totales e importes a la derecha; tarjetas enlazadas en móvil.
- [components/operaciones.tsx](../components/operaciones.tsx): `Desplegable` con flecha y variante `peligro`; `Historial` como línea de tiempo.
- [components/catalogos/formulario-catalogo.tsx](../components/catalogos/formulario-catalogo.tsx): marca de obligatorio y propiedad `tono="peligro"` para el botón de envío (también en `FormularioOperacion`). `FormularioCorreccion` (reversos y anulaciones) siempre usa `peligro`.
- [app/globals.css](../app/globals.css):
  - Campos con hover, foco y error visibles.
  - Selector con flecha; casillas con color primario.
  - Botón `boton-peligro`.
  - Avisos con borde lateral y nuevo `aviso-info`.
  - Insignias con punto más texto.
  - Tablas con cabecera tintada.
  - Contraste AA verificado en claro y oscuro.
- [components/marca.tsx](../components/marca.tsx): distintivo común para la barra lateral, el login, la página 404 y «sin acceso». Pantalla de error con icono.

### Módulos

- Catálogos, traslados, alquileres, transportes, membresías, finanzas y usuarios heredan la biblioteca. Además:
  - Las cancelaciones, bajas, reversos y anulaciones se marcan como zona de peligro, con botón rojo y texto explícito. Sus formularios de confirmación no cambian.
  - Los desplegables de membresías usan el mismo patrón.
  - Las notas informativas usan `aviso-info`.
  - Los historiales y listas vacías usan los componentes comunes.
- No se añadieron diálogos modales ni toasts: las confirmaciones irreversibles siguen siendo la casilla «Confirmo…» con motivo dentro del formulario, y los resultados, el aviso `role="status"` existente. Cambiarlos alteraría los flujos.
- Se respetaron los selectores de los e2e: `ul.sm:hidden`, la estructura `main table`, `summary`, `h1` y `h2` solo con texto, ids `campo-*`, textos de botones y avisos. No se usa `text-transform`, que alteraría `innerText`.

### Pruebas

`npm run lint` OK · `npm run typecheck` OK · `npm test` 82/82 · `npm run build` OK. El diff de las páginas de módulos solo cambia clases y las propiedades `peligro` y `tono`. Revisión visual de la biblioteca con el arnés temporal a 1280 y 390 px, sin desplazamiento horizontal. **Pendiente:** ejecutar los e2e de los módulos con sesión real (`scripts/e2e-*.mjs`).

## Rediseño UI/UX — Ajuste de fidelidad a la referencia

- **Fecha:** 2026-10-27
- **Motivo:** el propietario indicó que el resultado no se parecía en tono ni en estilo a `referencias-diseno/dashboard-aprobado.png`.
- **Causas:**
  - La app seguía el modo oscuro del sistema; la referencia es clara.
  - Inter no estaba disponible y se usaba Segoe UI.
  - Los iconos tenían un solo color de acento.
  - El panel no seguía la estructura de la referencia.

### Cambios

- **Tema:** siempre claro (`color-scheme: light`, sin `prefers-color-scheme: dark`). Se añaden acentos azul, verde, morado y naranja para los iconos, con contraste ≥3:1 como marcas gráficas, e `insignia-info` azul para «En curso» y «Entregado». Las insignias son píldoras sin punto.
- **Tipografía:** Inter mediante `@fontsource-variable/inter@5.3.0` (OFL-1.1). Los archivos de la fuente se sirven desde el propio proyecto, sin llamadas de red en tiempo de ejecución ni en el build. Era la única dependencia nueva necesaria: la referencia usa Inter y E0 descartó Google Fonts. `npm audit`: 0 vulnerabilidades.
- **Barra lateral:** grupos plegables con flecha (los enlaces siguen en el DOM) y subtítulo «Gestión de servicios» bajo la marca.
- **Panel ([app/(privado)/page.tsx](../app/(privado)/page.tsx)):**
  - Desde 1536 px: columna principal y columna lateral, como la referencia.
  - Columna principal: cuatro indicadores con iconos de color (Cobrado hoy, Traslados de hoy, Vehículos alquilados ahora y Membresías activas), gráfico de cobros de 7 días junto a «Requiere atención», tarjetas de módulo con dos cifras reales, finanzas y tabla de cobros recientes.
  - Columna lateral: botón principal, «Próximos servicios» en línea de tiempo, «Estado de vehículos», accesos rápidos en mosaico y catálogos.
  - En pantallas más estrechas las piezas se reordenan por prioridad.
  - Contenido hasta 1440 px.
- **Datos nuevos, solo lectura y con las mismas reglas de acceso:**
  - Cobrado hoy y gráfico: `saldos_cobros` confirmados por `fecha` (los reversados se excluyen); los días sin cobros quedan en cero (`serieUltimosDias`, probado).
  - Estado de vehículos: `vehiculos` activos con su `estado` registrado.
- **Gráfico:** una serie sin leyenda; columnas de 24 px como máximo con la punta redondeada; líneas guía finas; cada columna enfocable con su importe en una burbuja y en `aria-label`; el valor de hoy rotulado en escritorio.

### Pruebas

`npm run lint` OK · `npm run typecheck` OK · `npm test` 83/83 · `npm run build` OK. Revisión visual con el arnés temporal (Inter cargada) a 1536, 1280 y 390 px, sin desplazamiento horizontal. Los textos que comprueban los e2e se mantienen. **Pendiente:** e2e con sesión real.

## Rediseño UI/UX — Tipografía compacta y botones de porcelana

- **Fecha:** 2026-10-27 · Solo [app/globals.css](../app/globals.css) y tamaños de títulos en `encabezado.tsx`, `panel.tsx`, `navegacion.tsx` y `layout.tsx`.
- **Tipografía más pequeña:**
  - Base de 14 px.
  - Escala de Tailwind redefinida: `text-xs` 11 px, `sm` 13 px, `base` 14 px, `lg` 16 px, `xl` 18 px, `2xl` 22 px.
  - Botones, tablas, avisos, insignias, etiquetas de campo y menú reducidos un paso.
  - Los espacios no cambian, así que los componentes tienen más aire.
  - En móvil los campos siguen a 16 px (evita el zoom de iOS) y los controles a 44 px de alto.
- **Botones de porcelana:**
  - Degradado vertical suave, brillo interior en el borde superior, sombra tenue que crece al pasar el puntero y hundimiento de 1 px al pulsar.
  - Variantes: primario azul (`#2A74DC`→`#1A5FC4`, mínimo 4.54:1 con texto blanco), secundario blanco porcelana (`#FFFFFF`→`#EEF2F7`) y peligro rojo (`#C74444`→`#A83535`).
- **Pruebas:** lint OK · `npm test` 83/83 · build OK; revisión visual del panel y de los botones con el arnés.

## Rediseño UI/UX — Modernidad e intuición (tras investigación)

- **Fecha:** 2026-10-27
- **Investigación (fuentes de la industria, no normas):** tendencias de dashboards SaaS 2026 (diseños sobrios, jerarquía escaneable, acción sobre reporte, barra lateral contraíble) y patrones de navegación:
  - Paleta Ctrl/⌘+K solo con rutas permitidas y nunca como única vía.
  - Menú contraíble a iconos que recuerda su estado.
  - Avisos en línea en lugar de mensajes emergentes para todo.
  - Esqueletos de carga.
  - Antipatrones evitados: colores por sección en el menú, degradados en la estructura e ilustraciones grandes.

### Cambios

- **Paleta de comandos** ([components/paleta.tsx](../components/paleta.tsx)):
  - Botón «Buscar página o acción… Ctrl K» en la barra superior; Ctrl/⌘+K la abre o cierra.
  - Ofrece las páginas del menú del rol y las acciones rápidas que el rol puede iniciar. No busca registros.
  - Accesible: diálogo modal con combobox y listbox, `aria-activedescendant`, flechas, Enter, Esc con retorno del foco, búsqueda sin tildes ni mayúsculas.
- **Acciones rápidas compartidas** ([lib/accesos.ts](../lib/accesos.ts)) entre el panel y la paleta, con pruebas por rol y de búsqueda.
- **Menú contraíble a iconos** (≥1280 px):
  - Botón «Contraer menú» al pie de la barra lateral; el ancho pasa de 264 a 72 px.
  - Las etiquetas quedan para lectores de pantalla y se muestran como `title`; pulsar un grupo vuelve a expandir el menú.
  - La preferencia se guarda en `localStorage` y la aplica un script del layout raíz antes de pintar (sin parpadeo; `suppressHydrationWarning` en `<html>`).
- **Barra superior translúcida** con desenfoque.
- **Microinteracciones:**
  - Las tarjetas enlazadas se elevan 2 px con sombra al pasar el puntero.
  - Las filas cambian de fondo con transición.
  - El contenido entra con un fundido de 220 ms (`app/(privado)/template.tsx`).
  - Todo se anula con `prefers-reduced-motion`.
- **Avisos con icono** por tipo (éxito, error, advertencia, información) en los avisos de párrafo; las listas conservan sus viñetas.
- **Saludo según la hora** de Tegucigalpa en el panel.

### Pruebas

- `npm run lint` OK · `npm run typecheck` OK · `npm test` 85/85 (2 nuevas: `lib/accesos.test.ts`).
- Prueba interactiva de la paleta en Edge sin interfaz (componente compilado con Vite y el CSS servido por `next dev`): 10 comprobaciones. 9 OK; la restante falló por un error del script de prueba (la expresión regular perdió la barra invertida). Su resultado real, una opción «Cajas y bancos», es el esperado.
- Capturas del panel con el menú amplio y contraído a 1536 px y en móvil, sin desplazamiento horizontal.
- No se ejecutó `npm run build` para no congelar el `next dev` del propietario.

## Rediseño UI/UX — Estilo «vidrio azulado»

- **Fecha:** 2026-10-27
- **Pedido:** quitar los colores saturados y pasar a un diseño glass moderno, con azules tenues y toques de degradado.

### Cambios ([app/globals.css](../app/globals.css) y clases en `navegacion.tsx`, `marca.tsx`, `paleta.tsx` y `layout.tsx`)

- **Fondo:** degradado claro con cuatro halos azules suaves, fijo al desplazar.
- **Tarjetas de vidrio:**
  - Degradado translúcido blanco (80 % → 56 %) con `backdrop-filter: blur(16px) saturate(1.35)`.
  - Borde claro de cristal, anillo azul muy tenue y brillo interior.
  - Ventanas flotantes (menú de cuenta, paleta y burbujas) más opacas para leerse bien.
- **Barra superior y menú lateral:** vidrio (`.vidrio-barra`). La opción activa del menú pasa de azul sólido a un degradado azul tenue con texto `#2C5290`.
- **Paleta atenuada:** primario `#3A64A8`. Botón principal en degradado `#4A74B8` → `#3A619F` (4.69:1). Secundario en vidrio blanco. Peligro `#B65555` → `#9C4545`.
- **Estados atenuados:** éxito, advertencia, error e información, todos ≥4.9:1.
- **Acentos de iconos:** todos en la familia azul (azul, cian, índigo y pizarra), con fondos en degradado. Las barras del gráfico, en degradado `#6A92CF` → `#4A74B8` (≥3:1).
- **Distintivo, avatar y opción activa de la paleta:** degradado azul (`.fondo-degradado`).
- **Corrección:** el diálogo de la paleta se renderiza en un portal sobre `<body>`. Con `backdrop-filter` en la barra superior, un `fixed` dentro de ella quedaba recortado a la barra; verificado que ahora cubre la ventana.

### Pruebas

- `npm run lint` OK · `npm run typecheck` OK · `npm test` 85/85.
- Capturas del panel (1536 px y móvil) y del muestrario con el CSS compilado por un `next dev` temporal en el puerto 3100, detenido al terminar. Sin desplazamiento horizontal.
- Prueba de teclado de la paleta repetida.

## Rediseño UI/UX — Composición del panel como sistema

- **Fecha:** 2026-10-27
- **Pedido:** último análisis de diseño para que la composición se lea como un sistema elegante.

### Diagnóstico

- La columna lateral terminaba unos 400 px por debajo de la principal y dejaba un hueco.
- Medianiles mezclados (16 px y 24 px), y la columna lateral arrancaba por debajo del saludo.
- «Requiere atención» medía 258 px de ancho, así que sus filas se partían en dos o tres líneas.
- Cabeceras de sección dispares (unas con subtítulo y otras no) y tarjetas dentro de tarjetas en Finanzas.

### Cambios ([app/(privado)/page.tsx](../app/(privado)/page.tsx), [components/panel.tsx](../components/panel.tsx), [components/encabezado.tsx](../components/encabezado.tsx))

- **Retícula con un único medianil de 1.25 rem** entre todas las piezas: indicadores, módulos, columnas y filas.
- **En 2xl:**
  - El encabezado pasa a la columna principal, y la lateral arranca a su altura con la acción principal.
  - Las dos columnas cierran a la misma línea: la última pieza de cada una se estira con `[&>:last-child]:flex-1`.
- **Gráfico y «Requiere atención» en proporción 3:2** (antes 2:1). Las filas de atención se compactaron.
- **Todas las secciones llevan título y subtítulo**, para que el contenido de una misma fila arranque a la misma altura. Se añadieron textos descriptivos; no hay datos nuevos.
- **Finanzas:** cifras con divisores en lugar de tarjetas anidadas, en cuadrícula 2×2 entre `lg` y `2xl` para no dejar hueco junto a «Estado de vehículos».
- **Catálogos:** franja a todo el ancho que cierra la página, con el mismo patrón etiqueta-cifra que Finanzas.
- **`Encabezado`** admite `className`; el margen por defecto `mb-6` no cambia en las demás páginas.
- **Sin cambios** en consultas, permisos, cálculos ni textos que leen las pruebas e2e.

### Pruebas

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- Capturas a 1536, 1280 y 390 px con el CSS servido por el `next dev` del usuario: sin desplazamiento horizontal y con las bases de las columnas alineadas en 2xl.
- **Pendiente:** e2e con credenciales y `npm run build` sin un `next dev` activo.

## Rediseño UI/UX — Vidrio visible

- **Fecha:** 2026-10-27
- **Pedido:** «no veo el efecto anterior de glass».
- **Causa:** el CSS sí se servía (desenfoque, transparencia y borde), pero el fondo era casi liso y muy claro. Un vidrio esmerilado sobre un fondo uniforme no deja ver nada detrás, así que las tarjetas parecían blancas.

### Cambios ([app/globals.css](../app/globals.css))

- **Fondo:** cinco manchas difusas en azul, cielo y lavanda tenues, con tamaños en porcentaje para escalar con la ventana, sobre un degradado base `#EAF0FA` → `#DFE6F5`.
- **Tarjetas más translúcidas:**
  - Blanco entre 68 % y 46 %, con un brillo radial en la esquina superior.
  - `blur(22px) saturate(1.7)`.
  - Línea de luz interior en el borde superior.
- **Contraste:** se midió el píxel más oscuro del fondo renderizado por Edge (`rgb(189,197,239)`, a 1536, 1280 y 390 px). Para cumplir AA incluso sobre el fondo sin vidrio:
  - `--tenue` pasa de `#56677F` a `#415068` (4.82:1 sobre ese píxel; 6.22:1 sobre las tarjetas).
  - `--primario` pasa de `#3A64A8` a `#2C4F88` (4.80:1 sobre ese píxel; 6.19:1 sobre las tarjetas).
  - `--primario-hover` pasa a `#233F6D`.
  - El botón principal conserva su degradado.

### Pruebas

- Capturas del panel (1536 y 390 px) y del muestrario (1440 px) con el CSS servido por el `next dev` del usuario. Sin desplazamiento horizontal.

## Rediseño UI/UX — Detalles de porcelana

- **Fecha:** 2026-10-27
- **Pedido:** los botones y detalles en porcelana, con líneas azul oscuro en degradado; el vidrio queda para los componentes (menú lateral, barra y tarjetas). Las acciones que requieren atención van en verde (positivas) y rojo (negativas).

### Cambios

- **Botones ([app/globals.css](../app/globals.css)):**
  - Cuerpo blanco esmaltado (`--porcelana`) con brillo interior y sombra tenue.
  - La línea del borde es un degradado (capa `border-box` bajo la porcelana).
  - Variantes:
    - `.boton-primario`: línea azul marino `#3A5F9E` → `#0F2142`, texto `#1B3461` (10.6:1).
    - `.boton-secundario`: línea gris perla, texto oscuro.
    - `.boton-exito` (nueva): línea verde, texto `#1D6146` (6.3:1).
    - `.boton-peligro`: línea roja, texto `#8E2C2C` (7.1:1).
- **Acciones positivas en verde** (`tono="exito"` en `FormularioOperacion` y `FormularioCatalogo`): Confirmar reserva, Confirmar membresía, Registrar entrega, Registrar devolución, Finalizar traslado y Finalizar servicio. Las acciones de cancelar, anular, reversar y dar de baja ya estaban en `tono="peligro"`.
- **Detalles de porcelana** (`.porcelana`, que reemplaza a `.fondo-degradado`): distintivo, avatar, opción activa de la paleta y opción activa del menú lateral. El buscador de la barra y las teclas (Ctrl K) también son de porcelana.
- **Sin cambios** en textos, acciones, permisos ni lógica.

### Pruebas

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- Capturas del panel (1536 y 390 px) y del muestrario (1440 px, con fila de botones) con el CSS servido por el `next dev` del usuario.

## Rediseño UI/UX — Porcelana blanca (sustituye al vidrio)

- **Fecha:** 2026-10-27
- **Pedido:**
  - Todo blanco, incluido el fondo.
  - Fondo sin vidrio, con degradado de blanco a un gris o café muy tenue, imitando porcelana.
  - Botones de porcelana sin redondeado.

### Cambios ([app/globals.css](../app/globals.css))

- **Fondo:** `linear-gradient(170deg, #FFFFFF → #FBFAF8 → #F3F0EB → #ECE7E0)`, sin manchas de color.
- **Sin vidrio:**
  - Se eliminan los tokens `--vidrio*` y todo `backdrop-filter`.
  - Tarjetas, barra superior y menú lateral en blanco sólido con línea fina `#E7E2DB`.
  - La clase `.vidrio-barra` pasa a llamarse `.superficie-barra`.
  - La paleta usa un velo cálido sin desenfoque.
- **Sombras:** cálidas y tenues (`rgb(60 48 36 / …)`).
- **Neutros cálidos:** texto tenue `#5C5852` y texto del menú `#3D3A36`. Bordes, cabeceras de tabla, estados de paso y fondos neutros en gris cálido.
- **Gráfico:** barras en degradado azul marino, la misma familia que las líneas de los botones.
- **Esquinas rectas** (`border-radius: 0`) en botones, campos, buscador, teclas, elementos del menú, botón de usuario y distintivo. Las tarjetas conservan su radio. El avatar sigue circular.
- **Porcelana cálida:** degradado `#FFFFFF` → `#FBFAF8` → `#EFEBE6` en botones, detalles y cuadros de iconos (con línea fina).
- **Accesos rápidos del panel:** pasan a ser botones de porcelana (`boton boton-secundario`).
- **Líneas de color sin cambios:** azul marino (principal), verde (positivo) y rojo (negativo).
- **Foco:** `--foco` pasa a `#2C4F88`.
- **Contraste:** medido sobre el tono más oscuro del fondo renderizado (`rgb(236,231,224)`).
  - Texto tenue: 5.74:1.
  - Primario: 6.61:1.
  - Texto: 11.53:1.

### Pruebas

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- Capturas del panel (1536 y 390 px) y del muestrario (1440 px) con el CSS servido por el `next dev` del usuario. Sin desplazamiento horizontal.

## Rediseño UI/UX — Sistema inspirado en Stripe (sustituye porcelana y vidrio)

- **Fecha:** 2026-10-27
- **Pedido:**
  - «No me gusta el resultado»: analizar todos los cambios y quedarse con lo mejor.
  - «El diseño perfecto es algo como https://stripe.com/es-us».
- **Fuente de los valores:** el CSS público de stripe.com (sistema «hds»), descargado y leído; los colores no se tomaron de memoria.

### Se conserva de las etapas anteriores

- Estructura de la referencia D y composición en retícula con columnas equilibradas.
- Tipografía compacta.
- Paleta Ctrl K, menú compacto y microinteracciones.
- Botones casi rectos.
- Verde para acciones positivas y rojo para negativas.
- Vidrio solo en la barra superior y el menú lateral.

### Cambios ([app/globals.css](../app/globals.css))

- **Paleta:**
  - Lienzo `#F8FAFD`, superficies blancas, bordes `#E5EDF5` / `#D4DEE9`.
  - Texto `#061B31`, secundario `#50617A`, texto del menú `#3C4F69`.
  - Acento índigo `#533AFD` (al pasar el ratón, `#4032C8`).
- **Franja superior:** degradado pastel (índigo, cielo, rosa y durazno) cortado en diagonal (`body::before`). Se desplaza con la página y mide 20 rem, o 26 rem desde 1024 px. Su intensidad está limitada para que el texto encima mantenga AA.
- **Tarjetas:** blancas, radio de 8 px, borde fino y sombra en dos capas con tinte azul tinta, según la escala de sombras de Stripe.
- **Botones:** sólidos, con radio de 4 px (el `button-radius` de Stripe):
  - Principal: índigo.
  - Neutro: blanco con borde.
  - `.boton-exito`: verde `#006F3A`.
  - `.boton-peligro`: rojo `#D8351E`.
  - Texto blanco ≥4.7:1.
- **Campos y controles:** campos con radio de 4 px y anillo de foco índigo. Elementos del menú y buscador con 6 px.
- **Opción activa del menú:** texto índigo sobre `#F5F5FF`.
- **Distintivo:** `.distintivo` reemplaza a `.porcelana`. Es un degradado índigo en el logo, el avatar y la opción activa de la paleta.
- **Estados:**
  - Éxito `#006F3A`/`#E9F8EF`, error `#A01400`/`#FFF1EE`, advertencia `#7A4F14`/`#FFF4DD`, información `#4032C8`/`#F2F2FF`.
  - Insignias con radio de 5 px.
- **Acentos de iconos tintados:** índigo, verde, magenta `#A51D85` y naranja `#AB3500`.
- **Tipografía:** pesos más ligeros. Los títulos pasan de `font-bold` a `font-semibold`; el título de página mide 26 px con tracking −0.02em. Inter sustituye a Söhne, que no es libre.

### Pruebas

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- **Contraste** medido sobre el píxel más oscuro de la franja renderizada (`rgb(223,221,254)`): texto secundario 4.78:1, índigo 4.69:1, texto 13.16:1.
- **Capturas** del panel (1536 y 390 px) y del muestrario (1440 px) con el CSS servido por el `next dev` del usuario. Sin desplazamiento horizontal.

## Rediseño UI/UX — Cinta animada y vistas plegables

Objetivo: páginas más limpias, que muestran primero lo esencial y dejan lo secundario a un clic, con una cinta en degradado animada como firma visual (referencia: portada de stripe.com).

### Cinta animada

- **Componente:** [components/cinta.tsx](../components/cinta.tsx), montado en [app/layout.tsx](../app/layout.tsx). Reemplaza la franja `body::before`.
- **Dibujo:** SVG decorativo (`aria-hidden`), sin bibliotecas. Son tres capas de hebras con degradados celeste, violeta, rosa y naranja.
- **Animación:** cada capa ondula despacio (19, 25 y 31 s) moviéndose solo con `transform`, sin repintar. Con «reducir movimiento» queda quieta.
- **Máscara (contraste AA):**
  - Escritorio: intensa tras la barra de vidrio y en la esquina superior derecha, donde solo hay títulos y botones opacos. Se desvanece donde van descripciones y textos secundarios.
  - Móvil: solo tras la barra superior.
- **Fecha del panel:** pasa a una etiqueta con fondo propio para leerse sobre la cinta.

### Contenido plegable

Regla: a la vista lo de uso diario (estado, importes, acción principal y lo que se consulta a menudo). Plegado lo secundario.

- **Inicio** ([app/(privado)/page.tsx](../app/(privado)/page.tsx)):
  - El saludo pasa a una cabecera ancha y despejada, con la fecha y la acción principal.
  - «Estado de vehículos», «Catálogos» y «Cobros recientes» quedan plegados al final (`Seccion plegable` en [components/panel.tsx](../components/panel.tsx)).
- **Historial** (traslados, alquileres, transportes y membresías): se ven los tres eventos más recientes y el botón «Ver N eventos anteriores» despliega el resto ([components/historial-plegable.tsx](../components/historial-plegable.tsx)). Los anteriores solo se ocultan a la vista; los lectores de pantalla leen el historial completo.
- **Asientos contables:** plegados en cobros, cargos, gastos y transferencias (`Seccion plegable` en [components/finanzas/resumen.tsx](../components/finanzas/resumen.tsx)).
- **Correcciones:** «Reversar cobro», «Anular cargo», «Anular gasto», «Reversar transferencia» y «Cancelar la membresía» pasan a desplegables de peligro, como ya estaban las cancelaciones de traslados, alquileres y transportes.
  - El aviso «reverse primero sus pagos» sigue visible.
  - Los reversos que se abren desde un enlace explícito (`?aplicacion=`, `?pago=`) siguen abiertos.
- **Fichas de catálogo** (clientes, beneficiarios, vehículos, conductores, proveedores, planes, tarifas, cajas y bancos): los datos se muestran en modo lectura y el formulario pasa a «Editar datos».
- **Filtros de listados:** búsqueda y estado a la vista. Tipo y fechas pasan a «Más filtros», que se abre solo si alguno está aplicado e indica cuántos lo están.
- **Sin cambios:** los formularios de alta muestran todos sus campos (cada uno se usa al registrar). Las acciones operativas principales (iniciar, finalizar, entregar, devolver, registrar pago, aplicar saldo) siguen a la vista.
- No se eliminó ningún campo, acción, mensaje ni permiso.

### Pruebas e2e actualizadas

Antes de usarlos, las pruebas abren los nuevos desplegables, como ya hacían con «Editar datos» o «Cancelar traslado»:

- `e2e-finanzas`: «Reversar cobro».
- `e2e-membresias`: «Cancelar la membresía».
- `e2e-navegador`: «Editar datos» en clientes y vehículos.

Siguen pendientes de ejecutar contra el entorno real (requieren `E2E_CREDENCIALES`).

### Verificación

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- **Contraste medido texto por texto** sobre el fondo real (cinta, vidrio y tarjetas) en seis instantes de la animación, a 1536, 1280, 1024 y 390 px:
  - Panel y muestrario: mínimo 4.53:1.
  - Única excepción: el título de la barra superior en móvil, recortado con «…». Su rectángulo sin recortar pasa bajo el avatar; es un artefacto de la medición y no depende de la cinta.
- **Capturas** con el CSS servido por el `next dev` del usuario. Sin desplazamiento horizontal.

## Rediseño UI/UX — Todo plegado en barras y velocidad

### Barras plegables ([components/plegable.tsx](../components/plegable.tsx))

- **Barra:** una tarjeta con título y, si hace falta, una línea de resumen. Toda la barra es el botón (`aria-expanded`) y se abre con una transición de altura.
- **Contenido cerrado:** queda `inert`, así que no recibe foco ni lo leen los lectores de pantalla.
- **Comprobado en Edge:** con la sección cerrada se pueden abrir sus desplegables, rellenar campos y pulsar botones por código, y el texto sigue en `innerText`. Las pruebas e2e no necesitan pasos nuevos para esto. Algunas comprobaciones de texto ahora validan contenido que está dentro de barras cerradas.
- **Inicio:** quedan a la vista la cabecera (saludo, fecha y acción principal) y los cuatro indicadores. Lo demás va en un mosaico de barras cerradas:
  - Requiere atención, Próximos servicios, Cobros de 7 días, Finanzas.
  - Resumen por servicio, Accesos rápidos, Estado de vehículos, Catálogos, Cobros recientes.
  - La barra que se abre ocupa todo el ancho.
- **Detalles** (`Seccion` de [components/finanzas/resumen.tsx](../components/finanzas/resumen.tsx)):
  - Cada sección es una barra cerrada.
  - `fija` deja a la vista los pasos numerados de las altas y los grupos que ya son desplegables (cambios, correcciones, cancelar).
  - `abierta` abre al llegar los reversos pedidos por enlace y las listas de Pendientes.
- **Listados:** el buscador pasa a la barra «Buscar y filtrar», que indica cuántos filtros hay aplicados y se abre sola si hay alguno.
- **Fichas de catálogo:** «Datos» y «Editar datos» quedan plegados.

### Velocidad

Mediciones del 2026-10-27:

| Qué se midió | Resultado |
| --- | --- |
| Supabase, primer byte | 110–140 ms |
| Verificación de la sesión | Local, con claves ES256: sin llamada extra a Auth |
| Avisos de rendimiento de la base | Ninguno, salvo índices sin usar |
| JavaScript de `/login` en `next dev` | 3.6 MB sin minificar |

La lentitud que se percibe viene sobre todo del modo desarrollo:
- compila cada ruta la primera vez que se visita;
- usa React en modo depuración;
- no precarga los enlaces (eso solo ocurre en producción).

Cambios en el código:
- **Navegación:** se elimina `app/(privado)/template.tsx`. Volvía a montar la página en cada navegación y la animaba durante 220 ms.
- **Puesta al día de mensualidades del inicio:** se lanza cuando el navegador queda libre (`requestIdleCallback`) y ya no compite con la carga. Su lógica no cambia.

### Verificación

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- **Capturas** con el CSS servido, incluidas barras abiertas de forma simulada.

## Rediseño UI/UX — Cajas de íconos, sin colores decorativos y medición de velocidad

### Cajas de íconos ([components/plegable.tsx](../components/plegable.tsx))

Sustituyen a las barras plegables:

- **Aspecto:** cada sección es una caja con ícono y nombre (y una línea breve opcional). El ícono se elige según el título.
- **Apertura:** al pulsarla, su contenido aparece debajo de su fila de cajas, con el título y un botón «Cerrar». Solo hay una abierta a la vez (`CajasProvider` en el layout privado). La selección se reinicia al cambiar de página.
- **Colocación:** la retícula `.cajas` del contenedor de página reparte las cajas en columnas. `dense` agrupa las cajas en filas y deja su contenido debajo. El resto del contenido ocupa todo el ancho.
- **Sin animación.** Lo cerrado queda `inert`: no recibe foco ni lo leen los lectores de pantalla, pero las pruebas e2e pueden rellenar y pulsar por código.
- **Títulos que coincidían con botones de las pruebas e2e:**
  - «Cancelar reserva» pasa a «Cancelación de la reserva».
  - «Cancelar membresía» pasa a «Baja de la membresía».
- **Siempre a la vista:** los pasos numerados de las altas y las listas de Pendientes.

### Sin colores decorativos

- Íconos teñidos, opción activa del menú, logo y avatar, columnas del gráfico y puntos del historial pasan a gris tinta.
- Se conservan los colores con significado: botón principal, enlaces, verde y rojo de las acciones, e insignias de estado.

### Cinta

- **Color:** grises.
- **Movimiento:** quieta. Solo se acomoda una vez (900 ms) al cambiar de página: [components/cinta.tsx](../components/cinta.tsx), con la ruta como clave. Ya no hay animación continua bajo la barra de vidrio.
- **Contraste:** mínimo 6.03:1 en todos los textos de la parte superior (1536, 1280, 1024 y 390 px).

### Velocidad (medida el 2026-10-27)

**Traza del `next dev` del usuario** (`.next/dev/trace`, 352 peticiones):

- Compilaciones de hasta 20 s en la primera visita.
- Con el código ya compilado, las páginas tardan entre 0.3 y 2.8 s en renderizarse en modo depuración.

**Base de datos** (`pg_stat_statements`):

- Las lecturas no figuran entre las consultas lentas; las operaciones más pesadas promedian menos de 35 ms.
- Las tablas tienen como mucho unas mil filas.

**Supabase:** 110–140 ms por petición; la sesión se verifica localmente (ES256).

**Producción vs. desarrollo:** la copia de producción compila sin errores con `next build` y se probó en el puerto 3200.

| Medida | Desarrollo | Producción |
| --- | --- | --- |
| Respuesta de `/login` | 94–270 ms | 10–55 ms |
| JavaScript de `/login` | 3.6 MB | 0.57 MB |

Todas las rutas son de prerenderizado parcial: la estructura es inmediata y los datos llegan en streaming.

**Conclusión:** la lentitud viene del modo desarrollo. Para el uso diario, `npm run build` y luego `npm start`.

### Verificación

- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.
- `next build` OK en la copia.

### Ajuste: tipografía gris y más pequeña

- **Color:** el texto índigo de enlaces, «Ver…» y filas de tablas pasa a gris tinta `--enlace` `#2C3D55` (11:1 sobre blanco). Lo mismo para:
  - las insignias informativas («En curso», «Entregado»): `#26364D` sobre `#EAEEF4`;
  - el importe destacado;
  - la opción activa de la paleta.
  
  El botón principal conserva su color.
- **Escala tipográfica** (un punto menor, para dejar más aire en cada elemento):
  - Base 13 px; `sm` 12 px; `lg` 15 px; `xl` 17 px; `2xl` 20 px.
  - Título de página 22 px; cifras de los indicadores 20 px.
  - Botones, avisos, tablas y etiquetas de campo 12 px.
  - Los campos de formulario siguen en 16 px en móvil, para evitar el zoom de iOS.
- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.

### Ajuste: contenido al tamaño del menú lateral

- Desde 1280 px (donde se ve el menú lateral, a 12 px), el texto general, los nombres de las cajas y los campos también pasan a 12 px, igual que tablas, avisos, botones y descripciones.
- Por debajo de 1280 px el texto general sigue en 13 px, como el menú desplegable.
- Títulos y cifras de importes mantienen su tamaño mayor para conservar la jerarquía.
- Comprobado con los tamaños calculados en el navegador (1440 y 1100 px). `npm run lint` OK · `npm test` 85/85.

### Ajuste: la cinta se desplaza entre pantallas

- **Posición propia por pantalla** ([components/cinta.tsx](../components/cinta.tsx)): desplazamiento, giro y escala se derivan de la ruta con un hash FNV-1a. La misma pantalla siempre tiene la misma posición.
- **Rangos:** desplazamiento −24…8 % (horizontal) y −14…8 % (vertical), giro −13…10°, escala 1.05…1.45.
- **Profundidad:** las capas de atrás se desplazan hasta un 44 % más.
- **Movimiento:** al navegar, la cinta se desliza hasta la nueva posición como una pieza grande (transición de `transform` de 1.4 s, con entrada rápida y llegada lenta, y 50 ms de desfase entre capas). El resto del tiempo está quieta. Con «reducir movimiento» cambia sin transición.
- **Trazos:** las hebras se prolongan por arriba y a la derecha, para que al moverse no se vea dónde terminan.
- **Color:** grises algo más marcados.
- **Contraste:** medido con la posición de 11 rutas, todos los textos de la parte superior quedan en 5.28:1 o más.
- **Comprobación:** `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.

### Ajuste: órbitas en lugar de la cinta

- **Se elimina** `components/cinta.tsx` y sus estilos.
- **Nuevo elemento:** [components/orbitas.tsx](../components/orbitas.tsx), montado en [app/layout.tsx](../app/layout.tsx). En la esquina superior derecha hay:
  - seis anillos concéntricos de línea fina en gris, uno de ellos punteado;
  - una malla de puntos que se desvanece;
  - cinco nodos sobre los anillos, macizos o huecos.
- **Por qué:** llama la atención por la geometría, no por el color ni por el tamaño, y la máscara radial lo desvanece hacia el contenido.
- **Movimiento:** cada pantalla da a los nodos un ángulo propio, derivado de la ruta. Al navegar, se deslizan por su anillo durante 1.4 s (los exteriores avanzan menos). El resto del tiempo todo está quieto. Con «reducir movimiento», cambian sin transición.
- **Pantallas de menos de 1024 px:** sin nodos y con anillos más tenues, porque el título ocupa todo el ancho.
- **Contraste:** medido texto por texto con la posición de 11 rutas, a 1536, 1280, 1024 y 390 px. Mínimo 5.26:1. Solo falla el título recortado de la barra en móvil, un artefacto ya conocido de la medición.
- `npm run typecheck` OK · `npm run lint` OK · `npm test` 85/85.

### Ajuste: trazos curvos en lugar de órbitas

- **Se elimina** `components/orbitas.tsx` y sus estilos.
- **Nuevo elemento:** [components/trazos.tsx](../components/trazos.tsx). Es un haz de 16 líneas curvas finas que fluye por la esquina superior derecha, en grises, con una línea de acento algo más marcada. Es abstracto y de formas orgánicas.
- **Movimiento:** cada pantalla da al haz una posición propia (desplazamiento, giro y escala derivados de la ruta). Al navegar, sus dos grupos de líneas se deslizan hasta ella en 1.4 s, con desfase y giro contrario, de modo que el haz se abre y se ondula. El resto del tiempo está quieto. Con «reducir movimiento», cambia sin transición.
- **Pantallas de menos de 1024 px:** al 30 % de opacidad.
- **Contraste:** medido texto por texto con la posición de 11 rutas, a 1536, 1280, 1024 y 390 px. Mínimo 4.84:1.

### Cierre del rediseño: verificación para la integración

- **Funcionalidad:** cada archivo modificado por el rediseño se comparó con `HEAD`: textos visibles, cadenas, acciones del servidor (`accion=`), permisos (`puede…`), consultas (`from`/`rpc`) e importaciones de `@/lib`.
  - No falta ninguna acción, permiso, consulta ni mensaje.
  - Al reorganizar el panel se habían perdido tres accesos directos filtrados. Se restauraron como cifras enlazadas en «Resumen por servicio» ([components/panel.tsx](../components/panel.tsx), `TarjetaModulo`):
    - `/ambulancias?estado=en_curso`;
    - `/alquileres?estado=reservado`;
    - transportes de hoy (`/transportes?estado=todos&desde=…&hasta=…`).
  
    Se añadieron también `/ambulancias?estado=solicitado` y `/transportes?estado=en_curso`.
  - Lo demás son renombres de la composición aprobada; los datos se conservan.
- **Pantallas financieras** (cobros, cargos, gastos, cuentas, transferencias, pendientes y sus componentes): el mismo número de formularios, permisos, enlaces, consultas y secciones que en `HEAD`. La única diferencia es la consulta de categorías del listado de gastos, que añadió E6.
- **Comprobaciones** en una copia idéntica del árbol actual, incluido E6, para no tocar `.next` del `next dev` en uso:
  - `npm run lint` OK;
  - `npm run typecheck` OK;
  - `npm test` 99/99 (12 archivos);
  - `npm run build` OK (59 páginas).
- **Archivos compartidos con E6:**
  - `app/(privado)/layout.tsx`: el enlace «Reportes» es de E6.
  - `app/(privado)/page.tsx`: «Resultado del mes», `reporte_resumen` y la retirada de «Próximamente» son de E6.
  - este archivo: la sección de E6 está a continuación.
  
  No se revirtió ni sobrescribió ningún cambio de E6.

## E6 — Gastos y reportes financieros

- **Fecha:** 2026-10-27 (America/Tegucigalpa)
- **Resultado:** APROBADO. Todo se verificó contra Supabase Cloud de desarrollo (`cgohbizokewvivxmvbij`) por API REST con usuarios reales, por SQL independiente y en navegador real.

### Funcionalidad entregada

- **Gastos (`/finanzas/gastos`):** ya tenía de E2 proveedor opcional, categoría, actividad, importe, fecha, vencimiento, pendiente, pagos parciales e historial de abonos. Se añadieron los filtros de **categoría** y **actividad** en el listado. Las actividades se rotulan como en la especificación: «Ambulancias y membresías», «Alquileres», «Transporte con conductor» y «General».
- **Reportes (`/reportes`, administrador y finanzas):** siete vistas en pestañas con un selector de período (mes actual, mes anterior, año actual o rango personalizado; días en hora de Tegucigalpa, ambos extremos incluidos).
  1. **Resumen:** ingresos y gastos reconocidos, resultado operativo básico (rotulado como informe gerencial, no utilidad fiscal); aparte, cobros recibidos y pagos a proveedores del período; aparte, saldos actuales a la fecha de corte (por cobrar y vencido, por pagar y vencido, anticipos sin aplicar, caja y bancos).
  2. **Por actividad:** cuatro filas siempre presentes (la general sin repartir) y el consolidado como total. Si la suma no cuadrara con el consolidado, la página lo avisa.
  3. **Ingresos:** fecha, actividad, concepto, cliente e importe; una anulación aparece en negativo en su fecha; total de la base. Filtro por actividad.
  4. **Gastos:** fecha, concepto, categoría, proveedor, actividad, importe y estado de pago (pendiente, parcial, pagado, anulado); totales por categoría y por actividad. Filtro por actividad.
  5. **Por cobrar:** cliente, concepto, original, pagado, pendiente, vencimiento y estado, con filtros «con saldo», «vencidos» y «todos». El saldo a favor se muestra en una sección aparte.
  6. **Por pagar:** vencidas y no vencidas por separado, con sus totales.
  7. **Caja y bancos:** por cuenta, saldo inicial (al cierre del día anterior al período), entradas, salidas, transferencias, saldos iniciales, saldo final (al cierre del último día) y saldo actual; los negativos se muestran resaltados. Al elegir una cuenta, sus movimientos del período con el saldo acumulado.
- **Panel:** caja «Resultado del mes» (ingresos, gastos y resultado del mes en curso) para administrador y finanzas; desaparece el aviso «Próximamente: Reportes».
- **Navegación:** «Reportes» en el grupo Finanzas, solo para administrador y finanzas (permiso `verReportes`).

### Decisiones (opción más simple compatible con la especificación)

- **Fuente única:** ingresos y gastos se leen del libro (líneas de cuentas `ingreso` y `gasto`, por la fecha y la actividad del asiento). Así un gasto cuenta una vez aunque tenga varios abonos, los cobros y anticipos nunca son ingreso (tocan 1100/2200), las aplicaciones no duplican (2200/1200) y las transferencias no son ni ingreso ni gasto (1100/1100). Los reversos de E2 se fechan el día en que se registran: restan en ese período y el histórico no cambia.
- **Saldos actuales** (por cobrar, por pagar, anticipos, dinero): vistas de saldos de E2, que coinciden con las cuentas 1200, 2100, 2200 y 1100 del libro (comprobado). No dependen del período y se rotulan con su fecha.
- **Funciones en lugar de vistas:** como el período es un parámetro, se usan siete funciones `SECURITY DEFINER` con `search_path` vacío y `exigir_rol('administrador', 'finanzas')`. El rango se valida en la base (sin nulos, final ≥ inicial, como máximo diez años).
- **Totales:** los de cada informe vienen de la base. Solo las tablas de por cobrar, por pagar y caja suman las filas mostradas, y únicamente cuando la lista está completa (máximo 500 filas por consulta, con aviso si se recorta).
- **Vencido:** con saldo y vencimiento anterior a hoy; el día del vencimiento aún no vence. Sin vencimiento cuenta como no vencido.
- Sin gráficos, sin dependencias nuevas y sin exportar a PDF o Excel. No se tocó ninguna función de E1–E5.

### Archivos principales

- Migración: [20261027222743_e6_reportes.sql](../supabase/migrations/20261027222743_e6_reportes.sql).
- Aplicación:
  - [lib/reportes/periodo.ts](../lib/reportes/periodo.ts) (períodos) y [lib/reportes/definiciones.ts](../lib/reportes/definiciones.ts) (vistas, estado de pago, vencimiento y enlaces).
  - [components/reportes/vistas.tsx](../components/reportes/vistas.tsx) y [app/(privado)/reportes/page.tsx](../app/(privado)/reportes/page.tsx).
  - Cambios en [app/(privado)/finanzas/gastos/page.tsx](../app/(privado)/finanzas/gastos/page.tsx) (filtros), [app/(privado)/page.tsx](../app/(privado)/page.tsx) (resultado del mes), [app/(privado)/layout.tsx](../app/(privado)/layout.tsx) (menú), [lib/auth/roles.ts](../lib/auth/roles.ts) (`verReportes`) y [lib/finanzas/definiciones.ts](../lib/finanzas/definiciones.ts) (rótulos de actividad).
- Verificación: [scripts/verificar-reportes.mjs](../scripts/verificar-reportes.mjs), [scripts/e2e-reportes.mjs](../scripts/e2e-reportes.mjs) y [lib/reportes/reportes.test.ts](../lib/reportes/reportes.test.ts).

### Cambios de esquema / migraciones (aplicadas en `cgohbizokewvivxmvbij` por MCP)

| Versión | Archivo | Contenido | MD5 (archivo = `schema_migrations`) |
|---|---|---|---|
| `20261027222743` | `e6_reportes` | Funciones públicas `reporte_resumen`, `reporte_resultados_actividad`, `reporte_ingresos`, `reporte_gastos`, `reporte_gastos_agrupados`, `reporte_caja` y `reporte_movimientos` (`SECURITY DEFINER`, `search_path` vacío, rol verificado, `numeric(14,2)`); auxiliares `private.exigir_rango` y `private.lineas_resultado` sin acceso desde la API. Sin tablas nuevas ni escrituras | `9cc36b20…` |

- Migración aditiva: solo crea funciones. Tipos regenerados en [lib/supabase/tipos-bd.ts](../lib/supabase/tipos-bd.ts).
- **Advisors de seguridad:** 7 avisos nuevos «SECURITY DEFINER ejecutable por authenticated», intencionales (validan rol dentro), más el aviso manual de contraseñas filtradas.
- **Verificación por SQL:** ninguna de las 7 es ejecutable por `anon` ni por `PUBLIC`; las dos auxiliares no son ejecutables por `anon` ni `authenticated`; las 9 tienen `search_path` vacío.

### Comandos y pruebas (2026-10-27, Node 24.22.0, Windows 11)

| Comando | Resultado |
|---|---|
| `npm run lint` / `npm run typecheck` | OK / OK |
| `npm test` | OK, 12 archivos, **99 pruebas** (16 nuevas: períodos con febrero, bisiestos, cambio de año y zona de Tegucigalpa; rangos inválidos; estado de pago; vencimiento; enlaces; permiso `verReportes`) |
| `next build` | OK, incluida `/reportes`. Compilado en una copia del proyecto (el `next dev` del usuario ocupa el 3000 y su `.next`; no se tocó) |
| `node scripts/verificar-reportes.mjs` (API REST, usuarios reales) | **64/64** (dos ejecuciones, meses aislados octubre de 2012 y junio de 2015). La primera abortó por un defecto del propio script, ver defectos |
| `node scripts/e2e-reportes.mjs` (Edge sin interfaz, `next start` en el 3100) | **29/29** |
| Regresión E1: `verificar-rls.mjs` / `e2e-navegador.mjs` | **61/61** / **43/43** |
| Regresión E2: `verificar-finanzas.mjs` / `e2e-finanzas.mjs` | **75/75** / antes de la integración, intermitente (ver «Integración con el rediseño») |
| Regresión E3: `verificar-membresias.mjs` / `e2e-membresias.mjs` | **92/92** / **25/25** |
| Regresión E4: `verificar-ambulancias.mjs` / `e2e-ambulancias.mjs` | **74/74** / **21/21** |
| Regresión E5: `verificar-alquileres-transportes.mjs` / `e2e-alquileres-transportes.mjs` | **73/73** / **22/22** |
| Libro (SQL), tras todas las corridas | 585 asientos, 0 descuadrados, Σ debe = Σ haber |

**Pruebas obligatorias (`verificar-reportes.mjs`).** El script elige al azar un mes entre 2001 y 2019, mide antes y después y contrasta cada cifra con un cálculo independiente desde `asientos` y `lineas_asiento`:

1–4. Gastos de ambulancias (L 1,000), alquileres (L 800, pagado al registrar), transporte (L 600, sin proveedor) y general (L 400, el último día del mes): cada actividad sube exactamente lo suyo y el general no se reparte.
5. **Pago parcial** de L 300: el gasto sigue siendo L 1,000, con pagado L 300 y pendiente L 700. Los gastos del mes suben L 2,800, no L 3,100.
6. **Ingreso con pago parcial:** cargo de alquiler de L 2,000 con cobro de L 500. El ingreso es L 2,000 y la CxC queda en L 1,500.
7. **Anticipo** de L 1,000 sin cargo: suben los cobros, no los ingresos.
8. **Aplicación posterior** del anticipo a un cargo de membresía de L 700: el saldo a favor baja L 700 y el ingreso aparece una sola vez (mes del cargo + hoy, fecha de la aplicación).
9. **Transferencias** (caja → banco y desde una cuenta sin fondos): fuera de ingresos y gastos, y suman cero entre cuentas.
10. Resultado = ingresos − gastos.
11. Las cuatro actividades suman el consolidado (ingresos, gastos y resultado), en el mes aislado y en el año actual. Σ categorías = Σ actividades = gastos.
12. Por cobrar = cuenta 1200, por pagar = 2100, anticipos = 2200 y caja y bancos = 1100 del libro. Los vencidos coinciden con un cálculo independiente sobre las vistas de saldos.
13. **Reversos** (anular cargo y gasto, reversar el pago parcial): restan con fecha de hoy y el mes histórico no cambia. El cargo anulado suma cero entre ambos períodos, la CxP cambia −600 +300 y la caja conserva el saldo al cierre del mes y actualiza el actual.
14. **Filtros:** un rango de un solo día incluye ese día; el último día del mes entra en el mes y sale de un rango que termina antes; nada pasa al mes siguiente; el filtro por actividad funciona; un rango invertido, nulo o de más de diez años se rechaza (22023).
15. **Permisos:** administrador y finanzas consultan los 7 reportes (con las mismas cifras); el operador recibe 42501 en los 7.
16. **RLS y acceso:** el usuario inactivo recibe 42501 y la petición sin sesión se rechaza. Las funciones auxiliares no se exponen. El operador sigue sin ver movimientos ni saldos bancarios y nadie escribe en `asientos`.
17. Ningún asiento descuadrado en el mes aislado ni hoy (y 0 en todo el libro, por SQL).
18. **Regresión de E1 a E5:** ver la tabla.

Además, para caja y bancos: saldo inicial, movimientos y saldo final cuadran (L 10,250); el saldo inicial del mes siguiente es el saldo final del mes; el saldo actual coincide con la vista de E2; una cuenta negativa se muestra en −L 100. Los 7 movimientos del mes terminan con el saldo final.

**Escenarios en navegador (`e2e-reportes.mjs`):**

- **Finanzas:** «Reportes» en el menú; por omisión, el mes actual en Tegucigalpa. Desde el formulario elige un rango personalizado, y el resumen, la vista por actividad, los ingresos y los gastos muestran las mismas cifras que las funciones de la base.
- **Detalle:** CxC vencidos con el cargo parcial (pendiente L 1,000) y el saldo a favor aparte; CxP con el gasto en «Vencidas»; caja con los movimientos de la cuenta y su saldo final.
- **Gastos:** filtros de categoría y actividad del listado, y detalle del gasto.
- **Operador:** sin enlace, sin resultado del mes en el panel y con un aviso de permiso en `/reportes`, sin cifras.
- **Administrador:** ve «Reportes» y el resultado del mes; ya no aparece «Próximamente».
- **Móvil 390×844:** resumen, actividades, gastos y caja sin desplazamiento horizontal.

### Revisión propia

- Se contrastaron los totales con consultas independientes al libro (mes aislado y año actual), las vistas de saldos con las cuentas 1200, 2100, 2200 y 1100, y los vencidos con las vistas.
- Duplicados: un gasto con abonos y un cargo con aplicaciones aparecen una sola vez; los pagos y las aplicaciones no tocan cuentas de resultado.
- Anticipos: ni el cobro ni su aplicación son ingreso.
- Generales: fila propia, sin reparto, dentro del consolidado.
- Saldos: los actuales se rotulan con su fecha; el saldo al corte se calcula a esa fecha.
- Filtros: los límites del período se incluyen; el rango se valida en la base y en la página (con aviso si no es válido).
- Permisos: se validan en el servidor (página) y en PostgreSQL (función).

### Datos en Supabase de desarrollo

- Registros ficticios marcados `[PRUEBA E6]` en meses pasados (2006, 2012, 2015 y los de cada ejecución) y reversos con fecha de hoy: clientes, cajas y bancos, un proveedor, cargos, cobros, gastos, pagos, transferencias y asientos. Por diseño no se pueden borrar.
- Los usuarios ficticios se reactivaron temporalmente y **se desactivaron de nuevo** (bitácora). Solo el administrador real queda activo.

### Defectos encontrados y corregidos durante la etapa

1. **Ambigüedad de nombres en plpgsql:** las columnas de salida (`resultado`, `actividad`…) podían confundirse con las de las consultas. Se corrigió antes de aplicar con `#variable_conflict use_column` y alias propios.
2. **Totales por categoría:** el borrador agrupaba por cuenta contable y no por categoría del gasto. Se corrigió antes de aplicar.
3. **Script de verificación:** consultaba «del mes aislado a hoy», un rango de más de diez años que la base rechaza (correctamente). Se dividió en dos consultas.
4. **Prueba de navegador:** leía la copia oculta de los totales (la tabla se pinta para móvil y escritorio). Ahora lee la visible. No era un defecto de la aplicación.

No se encontró ningún defecto en las funciones financieras de E2, así que no se modificaron.

### Pendientes (configuración manual del propietario, sin cambios desde E1)

1. Deshabilitar el registro público en Supabase › Authentication › Sign In / Providers.
2. Activar la protección de contraseñas filtradas si el plan lo permite.

### Limitaciones

- Informes gerenciales: el resultado no es utilidad fiscal ni sustituye estados financieros.
- El estado de pago de un gasto o cargo es el actual, también en los reportes de períodos pasados.
- Las anulaciones restan el día en que se registran (comportamiento de E2), no en la fecha del documento original.
- Los totales por categoría y por actividad de la vista de gastos cubren todas las actividades aunque se filtre el detalle.
- Máximo 500 filas de detalle por vista (con aviso); los totales siempre son completos.

### Integración con el rediseño (2026-10-27)

E6 se desarrolló sobre el rediseño UI/UX, que estaba sin commit y en curso en otra sesión. Al cerrarse el rediseño:

- **Separación:** se revisaron `git status` y todos los diffs.
  - Solo de E6: los archivos nuevos de reportes, la migración, `README.md`, `finanzas/gastos/page.tsx`, `roles.ts`, `definiciones.ts`, `finanzas.test.ts` y `tipos-bd.ts`. Ninguno lo tocó el rediseño.
  - Mixtos: `app/(privado)/page.tsx` («Resultado del mes» y retirada de «Próximamente»), `app/(privado)/layout.tsx` (enlace «Reportes») y este archivo (sección E6).
  - Para el commit del rediseño, los tres mixtos se llevaron al índice sin los bloques de E6, generados por script (cada bloque debía aparecer exactamente una vez) y sin tocar el árbol de trabajo. `.vscode/` no se versiona; `referencias-diseno/` va con el rediseño, que la cita.
- **Nada sobrescrito:** todos los bloques de E6 seguían en los archivos mixtos, aunque el rediseño editó `page.tsx` después (18:35), y la migración conserva su MD5 (`9cc36b20…`).
- **El commit del rediseño, por sí solo** (árbol exportado del índice): `lint` OK, `typecheck` OK, `npm test` **85/85** y `build` OK.
- **Integrado (rediseño + E6),** en una copia del árbol (el `next dev` del usuario sigue en el 3000):
  - `lint` OK, `typecheck` OK, `npm test` **99/99** y `build` OK, con `/reportes`.
  - API: `verificar-reportes` **64/64** (mes aislado enero de 2012); regresión **61/61**, **75/75**, **92/92**, **74/74** y **73/73**.
  - Navegador: `e2e-reportes` **29/29**, `e2e-navegador` **43/43**, `e2e-membresias` **25/25**, `e2e-ambulancias` **21/21**, `e2e-alquileres-transportes` **22/22** y `e2e-finanzas` **28/28** (tres ejecuciones seguidas tras la corrección).
  - Libro (SQL): 888 asientos, 0 descuadrados.
- **Error de integración corregido** en [scripts/e2e-finanzas.mjs](../scripts/e2e-finanzas.mjs). Fallaba de forma intermitente (27/28) por dos motivos:
  - leía el texto sin esperar el contenido que llega por streaming;
  - enviaba el reverso dentro de la caja «Correcciones» cerrada (inerte), a veces antes de la hidratación.

  Ahora `contiene()` espera, las ausencias se comprueban tras una presencia en la misma página, y el reverso espera la hidratación y abre la caja como un usuario. Un diagnóstico aislado del paso (8/8) descartó un fallo de la aplicación.

### Commit

El rediseño (`Rediseño UI/UX: shell, panel de inicio y biblioteca visual`) y E6 van en commits separados, en ese orden. Los hashes se informan en la entrega (no pueden incluirse en el propio commit).
