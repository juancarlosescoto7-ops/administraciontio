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

### Finanzas (E2)

Las tablas financieras son de solo lectura desde la API; toda escritura pasa por funciones SQL (`public.registrar_*`, `reversar_*`, `anular_*`) que verifican el rol, registran documento, movimiento de caja/banco y asiento contable en una sola transacción y son idempotentes (clave por operación). Los saldos se calculan siempre (vistas `saldos_*`); nada se borra: se corrige con reversos que exigen motivo y quedan en la bitácora.

| Operación | Administrador | Operador | Finanzas |
|---|---|---|---|
| Consultar cargos, cobros y saldos de clientes | Sí | Sí | Sí |
| Registrar cobros y aplicar saldo a favor | Sí | Sí | Sí |
| Registrar cargos administrativos | Sí | No | No |
| Gastos, pagos de gastos y transferencias | Sí | No | Sí |
| Consultar saldos/movimientos de caja y bancos, gastos y asientos | Sí | No | Sí |
| Saldos iniciales, reversos y anulaciones | Sí | No | No |

Plantillas contables: cargo D CxC / H ingreso de la línea · cobro D caja-banco / H anticipos · aplicación D anticipos / H CxC · gasto D gasto de la categoría / H CxP · pago D CxP / H caja-banco · transferencia D destino / H origen · saldo inicial D caja-banco / H capital y saldos iniciales.

### Membresías (E3)

`/membresias`: listado, alta (cliente → plan y fecha → revisión de condiciones y beneficiarios → confirmar) y detalle con condiciones, beneficiarios, mensualidades, disponibilidad de traslados e historial. Igual que en finanzas, las tablas son de solo lectura desde la API y se escriben con funciones SQL (`registrar_membresia`, `actualizar_condiciones_membresia`, `agregar_beneficiario_membresia`, `inactivar_beneficiario_membresia`, `cancelar_membresia`, `actualizar_mensualidades`; consulta: `consultar_cobertura`, `historial_membresia`).

- **Mensualidades:** cada período genera un solo cargo de E2 (D CxC / H 4100 Ingreso por membresías) que vence al inicio del período. Las renovaciones se calculan desde el día de anclaje (31 ene → 28/29 feb → 31 mar). Las cuotas se pagan con los cobros, anticipos y saldos a favor de E2.
- **Actualizar mensualidades** (sin cron): botón en `/membresias` y en cada detalle, al abrir el panel (Server Action por POST, nunca en el GET) y tras cada cobro o aplicación de saldo registrados desde la aplicación. Es idempotente y solo genera hasta hoy.
- **Morosidad:** una cuota impaga después de inicio + días de gracia suspende la membresía desde el día siguiente. No se generan cuotas mientras está suspendida. Al saldarla se reactiva: si ya pasó la renovación, empieza un ciclo nuevo desde la fecha de reactivación y los meses suspendidos no se cobran. Una membresía cancelada no se reactiva.

| Operación | Administrador | Operador | Finanzas |
|---|---|---|---|
| Consultar membresías, cobertura e historial | Sí | Sí | Sí |
| Crear membresías y dar de alta o baja beneficiarios | Sí | Sí | No |
| Condiciones particulares, editar condiciones y cancelar | Sí | No | No |
| Actualizar mensualidades y cobrar cuotas (E2) | Sí | Sí | Sí |

### Traslados de ambulancia (E4)

`/ambulancias`: listado (búsqueda, estado, tipo y fechas), nueva solicitud (cliente → membresía o particular → datos) y detalle con datos, horario, recursos, cobertura, datos financieros, acciones e historial. Escritura solo por funciones SQL (`registrar_traslado`, `programar_traslado`, `asignar_recursos_traslado`, `reprogramar_traslado`, `ajustar_duracion_traslado`, `editar_traslado`, `revalidar_cobertura_traslado`, `iniciar_traslado`, `finalizar_traslado`, `cancelar_traslado`, `convertir_traslado_a_particular`, `revertir_consumo_traslado`).

- **Estados:** solicitado → programado → en curso → completado, o cancelado (solo antes de iniciar). La base rechaza cualquier otra transición. Una solicitud urgente se registra aunque falten destino, recursos, precio o cobertura confirmada.
- **Cubiertos:** la cobertura (válida, pendiente de validación o no válida) se evalúa para el período de la fecha del servicio. Si es válida, reserva un beneficio; si el período aún no se generó, la reserva es provisional y no se cobra la mensualidad por adelantado. Se revalida al reprogramar, antes de iniciar y cuando cambian la membresía o sus beneficiarios. Al completar se consume el beneficio y al cancelar se libera. Nunca pasa sola a particular: el cambio es explícito y con motivo.
- **Particulares:** el precio puede proponerse desde una tarifa y ajustarse. El cargo (D CxC / H 4200) se genera una sola vez al completar, y puede aplicarse el saldo a favor del cliente (E2).
- **Recursos:** ambulancia y conductor son opcionales al registrar y obligatorios para iniciar. La tabla `ocupaciones_recurso`, con una restricción de exclusión por horario y bloqueo del recurso, impide asignar el mismo vehículo o conductor a dos servicios que se cruzan; E5 la reutilizará.

| Operación | Administrador | Operador | Finanzas |
|---|---|---|---|
| Consultar traslados, cobertura, recursos e historial | Sí | Sí | Sí |
| Registrar, programar, asignar, reprogramar, iniciar, finalizar y cancelar | Sí | Sí | No |
| Cobrar y registrar anticipos (E2) | Sí | Sí | Sí |
| Devolver un beneficio consumido (corrección) | Sí | No | No |

### Alquileres y transporte con conductor (E5)

- **`/alquileres`:** reserva (cliente → fechas y tarifa → disponibilidad y precio propuesto → confirmar), entrega con kilometraje y combustible, devolución con cargos adicionales expresos y cancelación de reservas.
  - Estados: reservado → entregado → devuelto, o cancelado (solo reservado).
  - El precio propuesto es la tarifa diaria × días (bloques de 24 h iniciados, mínimo 1), ajustable.
  - El cargo (D CxC / H 4300) se genera una sola vez al devolver: precio pactado + adicionales. Un kilometraje de regreso menor que el de salida solo lo admite el administrador, con motivo.
- **`/transportes`:** solicitud con vehículo y conductor opcionales, programación, asignación, reprogramación, inicio (exige ambos recursos libres), ajuste de duración en curso, finalización con un único cargo (D CxC / H 4400) y cancelación sin iniciar.
- **Disponibilidad compartida:** alquileres, transportes y traslados ocupan vehículos y conductores en la misma tabla `ocupaciones_recurso` de E4. La restricción de exclusión y el bloqueo del recurso impiden que se crucen. Un alquiler entregado o un servicio en curso ocupa hasta su fin real e impide nuevos inicios aunque se pase de horario; los avisos advierten de las operaciones posteriores afectadas.
- **Vehículos:** se reutiliza `vehiculos`. Alquiler: tipo alquiler o mixto; transporte: transporte o mixto; ambulancia: ambulancia o mixto. Siempre activo y operativo.
- **Anticipos:** son saldo a favor del cliente (E2) y se aplican al cargo al devolver o completar, sin nueva entrada de dinero.

| Operación | Administrador | Operador | Finanzas |
|---|---|---|---|
| Consultar alquileres, transportes, disponibilidad e historial | Sí | Sí | Sí |
| Reservar, modificar, entregar, devolver y cancelar alquileres | Sí | Sí | No |
| Registrar, asignar, reprogramar, iniciar, finalizar y cancelar transportes | Sí | Sí | No |
| Corregir un kilometraje de regreso menor que el de salida | Sí | No | No |
| Cobrar y registrar anticipos (E2) | Sí | Sí | Sí |

### Gastos y reportes (E6)

- **`/finanzas/gastos`:** proveedor opcional, categoría, actividad, vencimiento, pagos parciales e historial de abonos (E2), con filtros de categoría y actividad.
- **`/reportes`:** resumen, resultados por actividad (los gastos generales aparte y dentro del consolidado), ingresos, gastos, por cobrar, por pagar y caja y bancos. Períodos: mes actual, mes anterior, año actual o rango personalizado, en hora de Tegucigalpa y con ambos días incluidos.
- **Cálculo:** funciones `public.reporte_*` en PostgreSQL a partir del libro. Los ingresos y gastos se reconocen por la fecha del asiento; los cobros, anticipos, abonos y transferencias no son ingresos ni gastos; los reversos restan en su fecha. Los saldos actuales coinciden con las cuentas 1100, 1200, 2100 y 2200. El resultado es un informe gerencial, no utilidad fiscal.

| Operación | Administrador | Operador | Finanzas |
|---|---|---|---|
| Consultar reportes, resultados y saldos de caja y bancos | Sí | No | Sí |
| Registrar gastos y sus pagos (E2) | Sí | No | Sí |

## Verificación contra el proyecto de desarrollo

Además de `npm test`, hay scripts sin dependencias adicionales que usan usuarios **ficticios** y crean registros marcados `[PRUEBA E1]` a `[PRUEBA E6]`. Se niegan a ejecutarse si `.env.local` no apunta al proyecto de desarrollo. Las credenciales de prueba van en un archivo fuera del repositorio (`E2E_ADMIN_CORREO`, `E2E_ADMIN_CLAVE`, y lo mismo para `OPERADOR`, `FINANZAS` e `INACTIVO`); el administrador, operador y finanzas de prueba deben estar activos y el usuario «inactivo», no.

```bash
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-rls.mjs        # RLS por rol vía API REST
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-finanzas.mjs   # núcleo financiero vía API REST
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-membresias.mjs # membresías vía API REST
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-ambulancias.mjs # traslados vía API REST
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-alquileres-transportes.mjs # alquileres y transportes
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-reportes.mjs   # reportes contra el libro
npm run build && npm start                                                     # en otra terminal
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-navegador.mjs        # navegador real (Edge/Chrome)
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-finanzas.mjs         # interfaz financiera
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-membresias.mjs       # interfaz de membresías
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-ambulancias.mjs      # interfaz de traslados
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-alquileres-transportes.mjs # interfaz de alquileres y transportes
E2E_CREDENCIALES=/ruta/credenciales.env node scripts/e2e-reportes.mjs         # interfaz de reportes
```

`E2E_URL` cambia la dirección de la app (por omisión `http://localhost:3000`).

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
#   a d m i n i s t r a c i o n t i o  
 