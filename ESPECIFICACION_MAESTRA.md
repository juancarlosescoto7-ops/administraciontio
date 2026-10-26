# ERP INTERNO — ESPECIFICACIÓN MAESTRA V1.0

**Estado:** definición funcional y técnica aprobada para iniciar un proyecto totalmente nuevo.  
**Alcance:** una empresa en Honduras, un solo establecimiento lógico, 1–3 usuarios internos, moneda HNL.  
**Prioridad:** simplicidad operativa con integridad financiera y seguridad básica.  
**Herramientas:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase Cloud (PostgreSQL + Auth + RLS), Vercel al publicar.  
**Modo de trabajo:** un solo agente (Claude *o* Codex) implementa, ejecuta pruebas y revisa su propia entrega; se trabaja una etapa a la vez.  
**Estado del repositorio:** totalmente nuevo; NO hay archivos que conservar del ERP anterior.  
**Nota:** este documento especifica un sistema administrativo interno, no una plataforma fiscal certificada ni un producto de seguros.

## 1. Objetivo y límites

Una única aplicación en español con clientes comunes para: (A) membresías de asistencia y traslados en ambulancia; (B) alquiler de vehículos; (C) transporte contratado con conductor; (D) control financiero consolidado, con resultados separados por cada actividad. El operador registra servicios, cuotas, pagos y gastos; el administrador consulta saldos y resultados. No hay autoservicio de clientes.

### Principios innegociables
1. No agregar módulos, estados ni flujos no previstos aquí; tampoco montar microservicios, colas, WebSockets, multiempresa, multi-sucursal, CRM, inventario, recursos humanos ni automatizaciones de IA.
2. No usar Docker. El agente trabaja contra un proyecto **nuevo y dedicado a desarrollo en Supabase Cloud** mediante MCP. El ambiente de producción se configurará más adelante y será independiente.
3. Un solo desarrollador/agente por etapa. Debe implementar, probar, revisar y documentar resultados reales. No declarar aprobado lo no comprobado.
4. Moneda HNL, importes `numeric(14,2)` en PostgreSQL; nunca `float` para dinero. Zona horaria de presentación `America/Tegucigalpa`; almacenar marcas de tiempo en UTC (`timestamptz`).
5. No eliminar datos con operaciones históricas: marcar inactivo o cancelar. Los cobros, pagos y asientos confirmados se corrigen mediante reversos, no borrando entradas.
6. Una misma operación no puede registrarse dos veces por reintentos: usar restricciones únicas e identificadores idempotentes en procesos financieros y generación de cuotas.
7. Todo usuario debe iniciar sesión; sin registro público. Cada operación sensible verifica sesión y autorización en el servidor/base de datos.
8. No exponer claves secretas. Variables `NEXT_PUBLIC_` solo para URL y clave publicable. Probar siempre autorización RLS por rol.

## 2. Roles y navegación

Tres perfiles estáticos (sin diseñador de permisos):
- `administrador`: todas las operaciones, configuración de planes/tarifas y usuarios, ajustes administrativos y finanzas.
- `operador`: CRUD de clientes y datos operativos, membresías, servicios, cobros; consulta de saldos relacionados. No puede gestionar usuarios, modificar asientos ni eliminar movimientos financieros.
- `finanzas`: consulta comercial; registra cobros, gastos, abonos a proveedores, transferencias y reportes; no administra usuarios ni altera catálogos operativos sensibles.

Si solo trabaja una persona, utilizará `administrador`; los demás roles son opcionales. Ningún flujo necesita doble autorización. Para acciones sensibles administrativas dejar registro de quién/cuándo/motivo, sin proceso de aprobación.

Rutas mínimas: `/login`, `/` panel, `/clientes`, `/membresias`, `/ambulancias/traslados`, `/vehiculos`, `/alquileres`, `/transportes`, `/finanzas/cobros`, `/finanzas/gastos`, `/finanzas/cuentas`, `/finanzas/pendientes`, `/reportes`, `/configuracion/usuarios`. Las rutas aún no implementadas no deben aparentar ser funcionales. Formulario y tabla/listado para cada recurso; diseño responsive sin paneles excesivos. Sin fotos, archivos, contratos PDF, correos automáticos ni notificaciones externas en el MVP.

## 3. Catálogos compartidos

**Clientes:** persona natural o jurídica; nombre/razón social obligatorio; identificación/RTN, teléfono, correo, dirección opcionales; activo/inactivo. Un cliente puede tener membresías, alquileres, traslados y saldo pendiente. Evitar duplicados por advertencia, no por identidad obligatoria.

**Beneficiarios:** nombre obligatorio; identificación, nacimiento, teléfono, tutor y notas opcionales. Un beneficiario puede estar asociado a más de una membresía; la membresía conserva su propia asociación. No asumir que todos tienen número de identidad.

**Vehículos:** código interno y tipo (`ambulancia`, `alquiler`, `transporte`, `mixto`), placa opcional única si está presente, marca/modelo opcionales, estado (`operativo`, `mantenimiento`, `fuera_servicio`), activo. Un mismo vehículo puede atender distintas líneas de negocio si su tipo lo permite. No GPS ni mantenimientos avanzados.

**Conductores:** nombre, teléfono, documento opcional y activo. No nómina, turnos ni vencimientos documentales en el MVP.

**Proveedores:** nombre y datos de contacto opcionales, activo. **Cuentas de dinero:** una o varias cajas y cuentas bancarias, HNL, activas; saldos derivados de movimientos confirmados, nunca editados manualmente. **Categorías de gasto:** catálogo simple (combustible, mantenimiento, salarios, servicios, otros). **Actividades:** `ambulancias`, `alquileres`, `transportes` y `general` (gastos generales).

## 4. Membresías — funcionalidad mínima

**Planes:** nombre, precio mensual, cupo de traslados al mes (entero >=0), modalidad de cupo (`compartido` o `individual`), días de gracia (entero >=0), activo. Valores iniciales establecidos por administrador; no inventar precios.

**Membresía:** cliente titular, plan, beneficiarios, fecha de inicio, próxima renovación, precio/cupo/modalidad/días de gracia pactados (snapshot editable por administrador solo para ciclos futuros), estado (`activa`, `suspendida`, `cancelada`). Los cambios de precios del catálogo no cambian periodos históricos.

**Ciclos:** período mensual desde la fecha de aniversario, ajustando a último día del mes cuando no exista el día original (p. ej. 31). Debe preservarse el día de anclaje. Cada ciclo genera **un solo cargo** por su precio y cupo; restricción única por membresía y fecha de inicio. Generación idempotente mediante acción administrativa «Actualizar mensualidades» y al abrir el panel en sesión autorizada, hasta la fecha actual. No utilizar cron ni cobrar automáticamente al banco. Periodos futuros no se facturan solos.

**Morosidad/cobertura:** el impago dentro de gracia se muestra como pendiente. Pasado el vencimiento más gracia, no habilitar nuevos traslados cubiertos. Las cuotas vencidas persisten; no crear nuevas cuotas por periodos que transcurran mientras la membresía esté suspendida. Al pagar la deuda vencida, el sistema puede reactivar, establecer nuevo día de inicio de ciclo y generar un cargo pendiente del nuevo ciclo; documentar claramente esa operación sin duplicados. La cancelación impide nuevos ciclos.

**Cupos:** traslados cubiertos cuentan contra el ciclo al que pertenece la fecha programada del servicio. Una reserva válida ocupa temporalmente un cupo; al completar consume; al cancelar libera. En cupo compartido cuentan todos los beneficiarios de la membresía; en individual, por beneficiario. Revalidar si cambia la fecha o se pierde cobertura. Si el traslado futuro pertenece a un ciclo todavía no generado, mantener solicitud pendiente de validación, sin consumir cupo inexistente ni prometer cobertura. Nunca convertir por sí solo un servicio cubierto a servicio privado pagado. No acumulación entre meses ni recompensas en MVP.

**Pagos:** mensualidades admiten cobro completo, parcial y anticipos; usar el núcleo financiero único. No duplicar ingreso al recibir dinero y al aplicar anticipo.

## 5. Traslados de ambulancia — funcionalidad mínima

Registrar fecha/hora prevista, origen, destino, cliente, beneficiario opcional, modalidad (`cubierto` o `particular`), membresía si cubierto, vehículo/conductor opcionales hasta iniciar, duración estimada editable (valor inicial de configuración, por defecto 90 minutos, ajustable), precio pactado si particular, notas, estado (`solicitado`, `programado`, `en_curso`, `completado`, `cancelado`).

- Para `cubierto`, validar beneficiario asociado, vigencia, cupo y reserva; al completar consumir un cupo. Cancelado libera cupo y no genera consumo.
- Para `particular`, precio propuesto configurable y editable; el cargo final nace al completar; se permiten pagos anticipados mediante saldo a favor.
- Antes de iniciar, asignar ambulancia y conductor operativos, sin horario incompatible con otra reserva/servicio activo del mismo recurso. Si todavía no se han asignado, la solicitud puede estar programada pero no iniciarse.
- Completar registra fechas reales y libera disponibilidad. Corregir datos relevantes con motivo y bitácora; evitar borrar servicios.
- Servicio urgente: poder registrar la solicitud sin validar al principio todos los datos administrativos, pero nunca marcarlo como cubierto sin cumplir los controles de cobertura. No retrasar atención médica por controles de interfaz.
- No monitoreo GPS, alertas avanzadas, cálculo de rutas, recompensa por no uso, cortesía compleja ni reprogramación automática en MVP.

## 6. Alquileres de vehículos — funcionalidad mínima

Datos: cliente, vehículo apto, entrega prevista, devolución prevista, tarifa de referencia y precio total pactado, observaciones, estado (`reservado`, `entregado`, `cerrado`, `cancelado`). Al entregar y devolver: fecha/hora real, kilometraje, nivel de combustible (`vacio`, `cuarto`, `medio`, `tres_cuartos`, `lleno`) y observaciones; ajustes adicionales al precio manuales con motivo. No fotos/inspecciones detalladas, ni penalizaciones automáticas.

- No permitir reservar intervalos superpuestos del mismo vehículo entre alquileres y servicios de transporte/ambulancia. Verificar de nuevo dentro de la transacción de confirmación para evitar carreras.
- El importe de referencia se sugiere por tarifa diaria × número de días o por precio manual, con posibilidad de editarlo antes de confirmar. Guardar importe pactado históricamente.
- Al reservar pueden existir cobros anticipados; al cerrar se confirma el cargo de alquiler y se aplica automáticamente el anticipo disponible designado al contrato. Cancelaciones con dinero adelantado quedan por resolver mediante devolución o saldo a favor, no se elimina dinero.
- No fianzas, seguros adicionales, depósito de garantía, cargos automáticos, ampliaciones complejas o firma digital en MVP.

## 7. Servicios de transporte con conductor — funcionalidad mínima

Datos: cliente, origen, destino, fecha/hora, duración estimada, vehículo, conductor, tarifa propuesta editable, precio pactado, estado (`solicitado`, `programado`, `en_curso`, `completado`, `cancelado`), notas.

Permitir programación sin asignar ambos recursos; exigirlos para iniciar; validar cruces horarios; finalizar registra ejecución y crea cargo; cancelación libera recursos. Anticipos y abonos siguen el mismo mecanismo que alquileres. No rutas automáticas ni integración con mapas.

## 8. Núcleo financiero (una sola fuente de verdad)

**Regla:** el contrato/servicio es origen de un cargo; el pago es una operación distinta. No confundir ingresos devengados con dinero cobrado. El saldo del cliente = cargos confirmados - asignaciones de cobro; saldo a favor = cobros no aplicados. Proveedores: gasto registrado y pagos parciales distintos. Un pago es único y registra una sola entrada/salida de la cuenta monetaria correspondiente.

### Cobros a clientes
Un cobro puede aplicarse total o parcialmente a uno o varios cargos del mismo cliente; sobrante se conserva como anticipo del cliente (sin vencimiento automático). Al crear un cargo, el operador puede aplicar saldo a favor. Cada cobro tiene cuenta de dinero, fecha, método (`efectivo`, `transferencia`, `tarjeta`, `otro`), importe >0 y referencia opcional. Nunca permitir aplicar más del saldo de cobro ni más del pendiente de cargo. Reversar pagos/ajustes con operación inversa y motivo, sin borrar historial.

### Gastos y pagos a proveedores
Registrar categoría, actividad (`ambulancias`, `alquileres`, `transportes`, `general`), concepto, proveedor opcional, importe >0, fecha, vencimiento opcional, observaciones. Un gasto puede quedar pendiente, pagarse de contado o tener abonos parciales desde cualquier cuenta de dinero. El saldo por pagar se deriva del gasto menos los pagos. El gasto general no se reparte automáticamente entre actividades.

### Cuentas de dinero
Saldos individuales por caja/banco; transferencias internas disminuyen cuenta origen y aumentan destino en una transacción; nunca son ingresos ni gastos. Saldo inicial mediante movimiento de apertura documentado, no editando el saldo directamente.

### Contabilidad básica interna
Implementar asientos de partida doble AUTOMÁTICOS, sin pantalla de captura de asientos manuales en MVP. Plan mínimo de cuentas: Caja/Bancos, Cuentas por cobrar, Anticipos de clientes, Cuentas por pagar, Ingreso por membresías, Ingreso ambulancias particulares, Ingreso alquileres, Ingreso transportes, Gastos por categoría, Capital/saldos iniciales. Cada asiento debe balancear Debe=Haber y vincularse al evento único que lo generó.

Plantillas:
- Cargo mensualidad al iniciar ciclo: Debe CxC, Haber Ingreso membresías (simplificación de informe gerencial; no equivale necesariamente a criterio fiscal/contable certificado).
- Traslado particular completado, alquiler cerrado o transporte completado: Debe CxC, Haber Ingreso de su actividad.
- Todo cobro recibido (tenga o no un cargo pendiente): Debe Caja/Banco, Haber Anticipos de clientes.
- Cada aplicación parcial o total del cobro a un cargo: Debe Anticipos de clientes, Haber CxC. No volver a mover Caja/Banco.
- Gasto registrado sin pagar: Debe Gasto, Haber CxP. Pago de gasto: Debe CxP, Haber Caja/Banco.
- Transferencia entre cuentas: Debe destino, Haber origen.
- Apertura de cuenta: Debe Caja/Banco, Haber Saldos iniciales (contrapartida de apertura que debe revisarse según el origen real de fondos).

Para evitar doble contabilización, los cobros parcialmente aplicados generan en recepción la entrada de Caja/Banco y su contrapartida a una cuenta transitoria de anticipos; cada aplicación de ese cobro a un cargo genera transferencia de Anticipos a CxC. Esto sirve tanto para cobros previos al servicio como para abonos sobre deuda existente. Nunca generar un segundo asiento de Caja/Banco al aplicar un cobro ya recibido.

**Límite:** no emisión de facturas SAR, cálculo de impuestos, conciliación bancaria automática, cierres fiscales ni balances legales certificados. Los informes son gerenciales.

### Reportes
Por rango de fechas y actividad: ingresos devengados, gastos, resultado gerencial, cobros, pagos, saldos por cuenta, cuentas por cobrar pendientes y cuentas por pagar pendientes. Distinguir explícitamente ingresos de cobros. Exportar CSV opcional sencillo; no dashboards avanzados ni PDF en MVP.

## 9. Modelo de datos: tablas y mínimos obligatorios

Usar `uuid` como PK, `created_at timestamptz default now()`, FKs, `CHECK`, `UNIQUE`, índices de búsqueda y estado. Los campos `*_monto`/`*_precio` serán `numeric(14,2)`; fechas de servicio en `timestamptz`, fechas de vencimiento en `date`. Todas las tablas de `public` con RLS habilitada. Las columnas aquí indicadas constituyen el modelo mínimo; el agente puede añadir columnas técnicas indispensables (timestamps, usuario actor, identificador de idempotencia) pero no crear nuevas funcionalidades comerciales.

| Tabla | Campos y relaciones esenciales |
|---|---|
| `perfiles` | `id` PK/FK `auth.users`, `nombre`, `rol` enum admin/operador/finanzas, `activo` |
| `clientes` | `id`, `tipo` natural/juridica, `nombre`, `identificacion?`, `telefono?`, `correo?`, `direccion?`, `activo` |
| `beneficiarios` | `id`, `nombre`, `identificacion?`, `fecha_nacimiento?`, `telefono?`, `tutor?`, `notas?`, `activo` |
| `planes` | `id`, `nombre`, `precio_mensual`, `cupo_mensual`, `modalidad_cupo`, `dias_gracia`, `activo` |
| `membresias` | `id`, `cliente_id`, `plan_id`, `fecha_inicio`, `dia_ancla`, `proxima_renovacion`, `precio_pactado`, `cupo_pactado`, `modalidad_cupo`, `dias_gracia`, `estado` |
| `membresia_beneficiarios` | `id`, `membresia_id`, `beneficiario_id`, `activo`, `fecha_alta`, `fecha_baja?`; único vínculo activo entre mismos IDs |
| `periodos_membresia` | `id`, `membresia_id`, `inicio`, `fin`, `cupo_asignado`, `precio`, `cargo_id?`; UNIQUE (`membresia_id`,`inicio`) |
| `vehiculos` | `id`, `codigo` UNIQUE, `placa?` UNIQUE si no nula, `tipo`, `marca?`, `modelo?`, `anio?`, `estado`, `activo` |
| `conductores` | `id`, `nombre`, `identificacion?`, `telefono?`, `activo` |
| `traslados_ambulancia` | `id`, `cliente_id`, `beneficiario_id?`, `membresia_id?`, `periodo_id?`, `tipo`, `estado`, `inicio_previsto`, `minutos_estimados`, `inicio_real?`, `fin_real?`, `origen`, `destino`, `vehiculo_id?`, `conductor_id?`, `precio_pactado?`, `cargo_id?`, `notas?` |
| `alquileres` | `id`, `cliente_id`, `vehiculo_id`, `inicio_previsto`, `fin_previsto`, `entrega_real?`, `devolucion_real?`, `km_salida?`, `km_regreso?`, `combustible_salida?`, `combustible_regreso?`, `precio_pactado`, `ajuste_precio`, `motivo_ajuste?`, `estado`, `cargo_id?`, `notas?` |
| `transportes` | `id`, `cliente_id`, `vehiculo_id?`, `conductor_id?`, `inicio_previsto`, `minutos_estimados`, `inicio_real?`, `fin_real?`, `origen`, `destino`, `precio_pactado`, `estado`, `cargo_id?`, `notas?` |
| `tarifas` | `id`, `actividad`, `nombre`, `unidad` dia/servicio, `precio_base`, `activo`; catálogos sin reglas de precio complejas |
| `cuentas_dinero` | `id`, `nombre`, `tipo` caja/banco, `banco?`, `numero_cuenta?`, `activo` |
| `proveedores` | `id`, `nombre`, `telefono?`, `identificacion?`, `activo` |
| `categorias_gasto` | `id`, `nombre`, `activo` |
| `gastos` | `id`, `proveedor_id?`, `categoria_id`, `actividad`, `fecha`, `vencimiento?`, `concepto`, `monto`, `notas?`, `estado` registrado/anulado |
| `cargos_cliente` | `id`, `cliente_id`, `actividad`, `origen_tipo`, `origen_id`, `concepto`, `fecha`, `vencimiento?`, `monto`, `estado` vigente/anulado; UNIQUE (`origen_tipo`,`origen_id`) para cargos de origen único |
| `cobros_cliente` | `id`, `cliente_id`, `cuenta_dinero_id`, `fecha`, `metodo`, `referencia?`, `monto`, `estado` confirmado/reversado, `idempotencia` UNIQUE |
| `aplicaciones_cobro` | `id`, `cobro_id`, `cargo_id`, `monto`, `fecha`; impedir sobreaplicación y cliente distinto |
| `pagos_gasto` | `id`, `gasto_id`, `cuenta_dinero_id`, `fecha`, `metodo`, `referencia?`, `monto`, `estado` confirmado/reversado, `idempotencia` UNIQUE |
| `movimientos_dinero` | `id`, `cuenta_dinero_id`, `fecha`, `tipo` ingreso/egreso/apertura/transferencia, `monto_con_signo`, `origen_tipo`, `origen_id`, UNIQUE combinación idempotente de evento/cuenta |
| `cuentas_contables` | `id`, `codigo` UNIQUE, `nombre`, `tipo` activo/pasivo/patrimonio/ingreso/gasto, `activo` |
| `asientos` | `id`, `fecha`, `concepto`, `actividad`, `origen_tipo`, `origen_id`, `evento`, `estado` confirmado/reversado, UNIQUE (`origen_tipo`,`origen_id`,`evento`) |
| `lineas_asiento` | `id`, `asiento_id`, `cuenta_contable_id`, `debe`, `haber`; CHECK no negativos y exactamente un lado positivo; cada asiento debe balancear |
| `bitacora` | `id`, `actor_id?`, `entidad`, `registro_id`, `accion`, `motivo?`, `antes?` jsonb, `despues?` jsonb, `fecha` (solo eventos importantes) |

Las transferencias internas pueden registrarse con `movimientos_dinero` vinculados a un mismo ID de transferencia generado por una operación atómica; si hace falta, crear `transferencias` como tabla técnica de cabecera, sin añadir funcionalidad de negocio. Los cargos previos a realización son importes *propuestos* en el contrato/servicio, no cargos contables hasta el evento de devengo especificado.

**Estados e integridad:** prohibido `CASCADE DELETE` sobre historial financiero. No confiar solo en validación del frontend. `update`/`delete` de asientos y pagos contabilizados prohibido a clientes web; reverso por función autorizada. `profiles.role` solo modificable por administrador mediante mecanismo seguro; no usar `user_metadata` editable para roles. Indexar FKs y columnas de fechas/estados. Los movimientos monetarios y asientos deben confirmarse atómicamente en base de datos.

## 10. Seguridad, autenticación e infraestructura

- Supabase Auth por email/contraseña; deshabilitar registro público. Crear primer usuario administrador manualmente en el Dashboard y habilitar su perfil a través de un paso de bootstrap restringido/documentado; crear otros usuarios solo bajo autorización del administrador.
- Usar `@supabase/ssr` con cliente navegador/servidor y `proxy.ts` para Next.js 16 si es la versión usada; verificar sesión con `getClaims()`/método oficial vigente. Acciones del servidor vuelven a verificar permisos.
- RLS en todas las tablas expuestas. Usuarios no autenticados sin acceso. El operador no puede alterar roles ni asientos. Privilegios de funciones SQL limitados con `REVOKE/GRANT`, verificación `auth.uid()`, política RLS y auditoría. Nada de clave `service_role` en cliente ni en Git.
- `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `.env.example` con valores de ejemplo ficticios. No es necesario almacenar secretos de Supabase si MCP mediante OAuth opera las migraciones y Auth estándar maneja el login.
- Supabase MCP remoto por OAuth, restringido a `project_ref` de desarrollo, con `features=database,development,debugging,docs`, sin `read_only=true`. No compartir tokens ni URL con clave privada en conversaciones.
- Migraciones SQL dentro de `supabase/migrations`, idénticas al esquema aplicado con MCP, registradas y versionadas. No crear/editar un proyecto de producción desde el agente. Sin Docker ni `supabase start`.
- Datos de prueba: clientes ficticios, 2-3 usuarios internos falsos para validar roles cuando sea viable; borrar/aislar datos sintéticos antes de producción.

## 11. Pantallas y UX

Interfaz en español, números en formato HNL, fecha día/mes/año, barra de navegación lateral o superior responsive. No gráficos complejos al principio. Formularios con validaciones y mensajes claros. Cada módulo tiene: listado (búsqueda, fecha, estado), creación, detalle, edición limitada y acción primaria (`Registrar cobro`, `Completar traslado`, `Devolver vehículo`, etc.). Mostrar siempre estado operacional y financiero por separado. Confirmaciones de cancelación/reverso con motivo; indicadores simples del panel (cuotas vencidas, alquileres activos, traslados de hoy, CxC/CxP, dinero disponible). Pantallas no desarrolladas deben mostrar «Próximamente» sin falsos datos.

## 12. Plan de implementación (una etapa por turno)

| Etapa | Entregable | Pruebas mínimas |
|---|---|---|
| **E0 — Arranque** | Repo vacío -> Next.js, Tailwind, Supabase MCP conectado al proyecto dev, `.env.local`, migración técnica inicial verificada, README y scripts básicos | Arranque, lint, build, consulta MCP y conexión real a dev |
| **E1 — Acceso y catálogos** | Login, perfiles/roles, bootstrap admin, clientes, beneficiarios, vehículos, conductores, proveedores, planes/tarifas, cuentas de dinero | Sesión, sin registro público, RLS y CRUD por rol |
| **E2 — Núcleo financiero** | Cargos, cobros, anticipos, aplicación parcial, pagos de gastos, movimiento caja/bancos, partida doble automática (tablas y funciones); UI financiera mínima | Invariantes de monto, idempotencia, asientos balanceados, transferencias |
| **E3 — Membresías** | Alta y beneficiarios, ciclos, cuotas, deuda, gracia/suspensión simplificada, reserva/cupo | Aniversarios 28–31, no doble cuota, cupo y morosidad |
| **E4 — Ambulancias** | Traslados cubiertos/privados, recursos, estados, consumo, cobro de particulares | Reserva, consumo único, cambio/cancelación, disponibilidad |
| **E5 — Alquileres y transporte** | Reservas, tarifas ajustables, anticipo, entrega/devolución, transportes con conductor, cargo al cierre/completar | Solapamientos, reprogramación, registro real, deuda correcta |
| **E6 — Gastos y reportes** | Captura completa de gastos/cxp, pagos, panel y reportes filtrables, finanzas por actividad y total | Cuadres, CxC/CxP, separación de cobro e ingreso |
| **E7 — Cierre y despliegue** | Pruebas integrales, seguridad, scripts de respaldo/recuperación, configuración de producción independiente y despliegue Vercel autorizado | Flujos completos, móvil, RLS, migraciones reproducibles |

**Excepción de dependencia:** la estructura del núcleo contable de E2 debe existir antes de comenzar cobros reales en las etapas E3–E5. Si una etapa posterior descubre una necesidad técnica indispensable, documentarla, implementarla puntualmente y ejecutar regresión; no rediseñar módulos completos.

## 13. Matriz de pruebas de negocio obligatorias

1. Persona no autenticada no accede a datos; operador no puede editar roles ni asientos; finanzas puede registrar cobros sin alterar miembros.
2. Cliente natural sin RTN se crea; beneficiario menor sin identidad se crea; puede asociarse a membresías distintas.
3. Crear dos veces mismo ciclo no duplica cuota/cargo. Mensualidad anclada en día 31 respeta fin de mes y retoma día 31 cuando exista.
4. Cobrar L 500 por servicio de L 1,500 deja L 1,000 pendientes; un reintento del mismo pago no registra otro movimiento.
5. Cobrar antes del cargo registra anticipo; al terminar servicio crea ingreso una vez, se aplica anticipo sin ingresar dinero por segunda vez.
6. Traslado cubierto reservado bloquea cupo; completado consume una vez; cancelado libera; traslado particular no afecta cupos.
7. Dos alquileres o transporte/ambulancia no reservan simultáneamente un mismo vehículo en franjas que se solapan. Antes de iniciar se exige conductor cuando corresponda.
8. Alquiler guarda kilometraje/combustible de entrega/devolución; cargo definitivo al cerrar; cancela sin borrar anticipo.
9. Gasto L 800 con abono L 300 muestra deuda L 500, desembolso L 300 e importe de gasto L 800, sin duplicarlo.
10. Transferir L 1,000 de Caja A a Banco B mantiene igual el total disponible y no aparece como ingreso/egreso operativo.
11. Todos los asientos de cada evento tienen Debe=Haber; no hay pagos ni asientos duplicados.
12. Reporte por actividad separa tres líneas y gastos generales; reporte consolidado coincide con sumas; ingreso y cobranza muestran cifras diferentes cuando hay anticipos o morosidad.

## 14. Fuera de alcance del MVP

Portal de clientes, WhatsApp, SMS/correo automático, pagos en línea, facturación fiscal SAR, pagos bancarios automáticos, inventario, nómina, multiempresa, app móvil nativa, GPS, mapas/rutas automáticas, telemetría, monitoreo tiempo real, mantenimiento de flota avanzado, informes PDF, contratos firmados, recompensas por no uso, acumulación de cupos, cotizaciones complejas, motor de seguros, aprobación de varios usuarios, presupuestos y proyecciones. No prometer una cobertura regulada como «seguro» sin asesoramiento legal local.

## 15. Criterio de entrega de cada etapa

El mismo agente crea código y migraciones; ejecuta lint/typecheck/build/pruebas; comprueba acceso y datos reales de *desarrollo* por MCP; verifica permisos y ausencia de secretos; hace revisión propia y corrige defectos detectados antes de informar. Al finalizar produce `docs/ESTADO.md` con: etapa, fecha, funcionalidad, cambios de esquema/migraciones (y si fueron aplicadas), comandos/pruebas con resultado, escenarios verificados, pendientes, bloqueos, commit si existe. No inicia siguiente etapa sin instrucción nueva. No hacer destructive SQL sin aprobación expresa, incluso en desarrollo si existen registros.

## 16. Fuentes técnicas oficiales

- MCP Supabase: https://supabase.com/docs/guides/ai-tools/mcp
- Supabase Next.js SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- Seguridad RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Codex MCP: https://learn.chatgpt.com/docs/extend/mcp

**Decisión de gestión:** el agente puede resolver detalles internos menores de implementación para hacer que una etapa funcione; no puede cambiar reglas de negocio, prioridades, roles, precios ni alcance. Ante ambigüedad no bloqueante, utilizar la opción más simple compatible con este documento y anotarla. Ante ambigüedad que afecte dinero, seguridad o cobertura, detener solamente esa parte y explicar la decisión requerida.
