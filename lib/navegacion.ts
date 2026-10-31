import { puede, puedeAdministrarUsuarios, type Rol } from "@/lib/auth/roles";
import type { GrupoNavegacion } from "@/components/navegacion";

// Solo rutas existentes; la visibilidad por rol repite la de cada página,
// que sigue validando permisos en el servidor.
export function gruposNavegacion(rol: Rol): GrupoNavegacion[] {
  return [
    { titulo: null, icono: "inicio", enlaces: [{ href: "/", etiqueta: "Inicio" }] },
    {
      titulo: "Servicios",
      icono: "servicios",
      enlaces: [
        { href: "/ambulancias", etiqueta: "Traslados de ambulancia" },
        { href: "/alquileres", etiqueta: "Alquileres" },
        { href: "/transportes", etiqueta: "Transporte con conductor" },
        { href: "/membresias", etiqueta: "Membresías" },
      ],
    },
    {
      titulo: "Clientes",
      icono: "clientes",
      enlaces: [
        { href: "/clientes", etiqueta: "Clientes" },
        { href: "/beneficiarios", etiqueta: "Beneficiarios" },
      ],
    },
    {
      titulo: "Flota y personal",
      icono: "flota",
      enlaces: [
        { href: "/vehiculos", etiqueta: "Vehículos" },
        { href: "/conductores", etiqueta: "Conductores" },
        ...(puede("gestionarGastos", rol) ? [{ href: "/empleados", etiqueta: "Empleados" }] : []),
      ],
    },
    {
      titulo: "Finanzas",
      icono: "finanzas",
      enlaces: [
        { href: "/finanzas/cobros", etiqueta: "Cobros" },
        { href: "/finanzas/cargos", etiqueta: "Cargos" },
        { href: "/finanzas/pendientes", etiqueta: "Pendientes" },
        ...(puede("verTesoreria", rol) ? [{ href: "/finanzas/gastos", etiqueta: "Gastos" }] : []),
        { href: "/finanzas/cuentas", etiqueta: "Cajas y bancos" },
        { href: "/proveedores", etiqueta: "Proveedores" },
        ...(puede("verReportes", rol) ? [{ href: "/reportes", etiqueta: "Reportes" }] : []),
      ],
    },
    {
      titulo: "Configuración",
      icono: "configuracion",
      enlaces: [
        { href: "/planes", etiqueta: "Planes de membresía" },
        { href: "/tarifas", etiqueta: "Tarifas" },
        ...(puede("gestionarContrato", rol) ? [{ href: "/configuracion/contrato", etiqueta: "Contrato de membresía" }] : []),
        ...(puedeAdministrarUsuarios(rol) ? [{ href: "/configuracion/usuarios", etiqueta: "Usuarios" }] : []),
      ],
    },
  ];
}
