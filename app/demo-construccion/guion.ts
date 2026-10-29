// Guion visual, no código ejecutable ni datos del ERP. Los fragmentos resumen
// componentes y reglas existentes; no pretenden ser un historial de commits.
export const DURACION_ESCENA = 14_000;

export const ESCENAS = [
  {
    titulo: "El punto de partida",
    corto: "Estructura",
    archivo: "app/(privado)/layout.tsx",
    ruta: "/",
    modulo: "inicio",
    descripcion: "Una estructura común. Cada módulo empieza a encontrar su lugar.",
    accion: "Abrimos el navegador y aparece la estructura del sistema.",
    resultado: "La navegación y el espacio de trabajo están listos.",
    codigo: `// Una estructura para toda la operación\nexport default function Layout({ children }) {\n  return (\n    <div className="app">\n      <Navegacion />\n      <main>{children}</main>\n    </div>\n  );\n}`,
    terminal: "Vista previa · estructura y navegación",
  },
  {
    titulo: "El primer cliente",
    corto: "Clientes",
    archivo: "components/catalogos/formulario-catalogo.tsx",
    ruta: "/clientes/nuevo",
    modulo: "clientes",
    descripcion: "Creamos el formulario que conecta al cliente con todos sus servicios.",
    accion: "Escribimos los datos de una persona ficticia y guardamos el formulario.",
    resultado: "Ana Demo ya aparece en el listado de clientes.",
    codigo: `// Campos del catálogo de clientes\n<FormularioCatalogo\n  campos={[\n    { nombre: "nombre", requerido: true },\n    { nombre: "telefono" },\n    { nombre: "correo" },\n  ]}\n  textoEnviar="Guardar cliente"\n/>`,
    terminal: "Vista previa · alta y listado de clientes",
  },
  {
    titulo: "Una membresía toma forma",
    corto: "Membresías",
    archivo: "components/membresias/formulario-alta.tsx",
    ruta: "/membresias/nueva",
    modulo: "membresia",
    descripcion: "Unimos titular, plan y beneficiarios en una sola membresía.",
    accion: "Seleccionamos a Ana, un plan de ejemplo y su beneficiario.",
    resultado: "Membresía activa. Primera mensualidad: L 500.00 pendientes.",
    codigo: `// El plan conserva las condiciones pactadas\nconst membresia = {\n  cliente_id: cliente.id,\n  plan_id: plan.id,\n  precio_pactado: plan.precio_mensual,\n  cupo_pactado: plan.cupo_mensual,\n  modalidad_cupo: "compartido",\n};\n// Un solo cargo por cada ciclo mensual`,
    terminal: "Vista previa · membresía, beneficiario y mensualidad",
  },
  {
    titulo: "El servicio entra en movimiento",
    corto: "Ambulancias",
    archivo: "app/(privado)/ambulancias/[id]/page.tsx",
    ruta: "/ambulancias/traslados",
    modulo: "servicios",
    descripcion: "La membresía se conecta con la programación de un traslado cubierto.",
    accion: "Completamos el recorrido y asignamos ambulancia y conductor.",
    resultado: "Traslado programado: una reserva de cupo, sin cargo particular.",
    codigo: `// Antes de confirmar un traslado cubierto\nvalidarBeneficiario(membresia, beneficiario);\nvalidarCobertura(membresia, fecha);\nvalidarCupo(periodo);\nvalidarDisponibilidad(ambulancia, conductor);\n\n// Reservar ocupa un cupo del ciclo.\n// Cancelar lo libera. Completar lo consume.`,
    terminal: "Vista previa · recorrido y reserva de recursos",
  },
  {
    titulo: "La operación se amplía",
    corto: "Flota",
    archivo: "app/(privado)/alquileres/[id]/page.tsx",
    ruta: "/alquileres",
    modulo: "flota",
    descripcion: "Alquileres y transportes comparten clientes y control de disponibilidad.",
    accion: "Registramos la devolución del alquiler y cerramos un transporte de ejemplo.",
    resultado: "Alquiler: L 1,500.00. Transporte: L 800.00. Ambos generan su cargo al finalizar.",
    codigo: `// El cargo nace al finalizar el servicio\nif (alquiler.estado === "cerrado") {\n  confirmarCargo(alquiler);\n}\nif (transporte.estado === "completado") {\n  confirmarCargo(transporte);\n}\n// Un mismo vehículo no se reserva dos veces.\n// Cada servicio genera un único cargo.`,
    terminal: "Vista previa · devolución, cierre y cargos",
  },
  {
    titulo: "Cada lempira en su lugar",
    corto: "Cobros",
    archivo: "components/finanzas/operaciones.tsx",
    ruta: "/finanzas/cobros/nuevo",
    modulo: "finanzas",
    descripcion: "Registrar un cobro actualiza el saldo sin duplicar el ingreso.",
    accion: "Ingresamos L 500.00 en caja y confirmamos el cobro ficticio.",
    resultado: "La cuota más antigua queda pagada. Saldo del cliente: L 2,300.00.",
    codigo: `// Cobrar y generar un cargo son cosas distintas\nconst cobro = {\n  cliente_id: cliente.id,\n  monto: "500.00",\n  metodo: "efectivo",\n  cuenta_dinero_id: caja.id,\n};\n// Aplicar del cargo más antiguo al más reciente.\n// El sobrante queda como saldo a favor.`,
    terminal: "Vista previa · cobro y aplicación por antigüedad",
  },
  {
    titulo: "Todo empieza a conectarse",
    corto: "El resultado",
    archivo: "components/panel.tsx",
    ruta: "/",
    modulo: "inicio",
    descripcion: "El código se convierte en una vista clara de toda la empresa.",
    accion: "Volvemos al inicio para ver juntos los datos del recorrido.",
    resultado: "Clientes, membresías, servicios y finanzas. Un solo sistema.",
    codigo: `// El panel reúne la información de cada módulo\n<TarjetaIndicador\n  etiqueta="Cobros recibidos"\n  valor={formatearMoneda(cobros)}\n  icono="dinero"\n  tono="verde"\n/>\n// Ingresos: L 2,800.00 · Cobros: L 500.00\n// Por cobrar: L 2,300.00`,
    terminal: "Recorrido completo · todos los datos son ficticios",
  },
] as const;

export const DURACION_TOTAL = ESCENAS.length * DURACION_ESCENA;

export function posicion(tiempo: number) {
  const limitado = Math.max(0, Math.min(tiempo, DURACION_TOTAL));
  const indice = Math.min(Math.floor(limitado / DURACION_ESCENA), ESCENAS.length - 1);
  return { indice, local: limitado - indice * DURACION_ESCENA };
}

export function reloj(ms: number) {
  const segundos = Math.floor(ms / 1000);
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}
