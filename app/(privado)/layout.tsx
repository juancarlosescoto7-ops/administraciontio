import type { ReactNode } from "react";
import { Suspense } from "react";
import { accesosRapidos } from "@/lib/accesos";
import { puede, puedeAdministrarUsuarios, ETIQUETAS_ROL, type Rol } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { Navegacion, type GrupoNavegacion } from "@/components/navegacion";
import { MarcaIcono } from "@/components/marca";
import { CajasProvider } from "@/components/plegable";

// Solo rutas existentes; la visibilidad por rol repite la de cada página,
// que sigue validando permisos en el servidor.
function gruposNavegacion(rol: Rol): GrupoNavegacion[] {
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
        ...(puedeAdministrarUsuarios(rol) ? [{ href: "/configuracion/usuarios", etiqueta: "Usuarios" }] : []),
      ],
    },
  ];
}

export default function LayoutPrivado({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col transition-[padding] duration-200 xl:pl-[var(--ancho-menu)]">
      <a href="#contenido" className="saltar-contenido">
        Saltar al contenido
      </a>
      <Suspense fallback={<MarcoProvisional />}>
        <BarraNavegacion />
      </Suspense>
      <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 xl:py-8">
        <div className="cajas mx-auto w-full max-w-[1440px]">
          <CajasProvider>{children}</CajasProvider>
        </div>
      </main>
    </div>
  );
}

async function BarraNavegacion() {
  const usuario = await requerirUsuario();

  return (
    <Navegacion
      grupos={gruposNavegacion(usuario.rol)}
      acciones={accesosRapidos(usuario.rol)}
      nombreUsuario={usuario.nombre}
      rolUsuario={ETIQUETAS_ROL[usuario.rol]}
      correoUsuario={usuario.correo}
    />
  );
}

function MarcoProvisional() {
  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center vidrio-barra border-b px-4 sm:px-6 lg:px-8">
        <span className="font-semibold xl:hidden">ERP interno</span>
      </div>
      <div className="menu-lateral fixed inset-y-0 left-0 hidden w-[var(--ancho-menu)] overflow-hidden vidrio-barra border-r xl:block">
        <div className="flex h-[4.5rem] items-center gap-3 px-5">
          <MarcaIcono className="size-10" />
          <span className="solo-amplio flex flex-col leading-tight">
            <span className="text-[0.875rem] font-bold tracking-tight">ERP interno</span>
            <span className="text-xs texto-tenue">Gestión de servicios</span>
          </span>
        </div>
      </div>
    </>
  );
}
