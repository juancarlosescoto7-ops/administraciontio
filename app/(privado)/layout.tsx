import type { ReactNode } from "react";
import { Suspense } from "react";
import { puede, puedeAdministrarUsuarios, ETIQUETAS_ROL, type Rol } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { Navegacion, type GrupoNavegacion } from "@/components/navegacion";

const GRUPOS: GrupoNavegacion[] = [
  { titulo: null, enlaces: [{ href: "/", etiqueta: "Panel" }] },
  {
    titulo: "Catálogos",
    enlaces: [
      { href: "/clientes", etiqueta: "Clientes" },
      { href: "/beneficiarios", etiqueta: "Beneficiarios" },
      { href: "/vehiculos", etiqueta: "Vehículos" },
      { href: "/conductores", etiqueta: "Conductores" },
      { href: "/proveedores", etiqueta: "Proveedores" },
    ],
  },
  { titulo: "Servicios", enlaces: [{ href: "/membresias", etiqueta: "Membresías" }] },
  {
    titulo: "Planes y tarifas",
    enlaces: [
      { href: "/planes", etiqueta: "Planes de membresía" },
      { href: "/tarifas", etiqueta: "Tarifas" },
    ],
  },
];

function grupoFinanzas(rol: Rol): GrupoNavegacion {
  return {
    titulo: "Finanzas",
    enlaces: [
      { href: "/finanzas/cobros", etiqueta: "Cobros" },
      { href: "/finanzas/cargos", etiqueta: "Cargos" },
      { href: "/finanzas/pendientes", etiqueta: "Pendientes" },
      ...(puede("verTesoreria", rol) ? [{ href: "/finanzas/gastos", etiqueta: "Gastos" }] : []),
      { href: "/finanzas/cuentas", etiqueta: "Cajas y bancos" },
    ],
  };
}

const GRUPO_CONFIGURACION: GrupoNavegacion = {
  titulo: "Configuración",
  enlaces: [{ href: "/configuracion/usuarios", etiqueta: "Usuarios" }],
};

export default function LayoutPrivado({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Suspense fallback={<BarraProvisional />}>
        <BarraNavegacion />
      </Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

async function BarraNavegacion() {
  const usuario = await requerirUsuario();
  const grupos = [
    ...GRUPOS,
    grupoFinanzas(usuario.rol),
    ...(puedeAdministrarUsuarios(usuario.rol) ? [GRUPO_CONFIGURACION] : []),
  ];

  return (
    <Navegacion
      grupos={grupos}
      nombreUsuario={usuario.nombre}
      rolUsuario={ETIQUETAS_ROL[usuario.rol]}
    />
  );
}

function BarraProvisional() {
  return (
    <div className="border-b border-borde bg-superficie px-4 py-3 md:w-64 md:border-r md:border-b-0">
      <span className="font-semibold">ERP interno</span>
    </div>
  );
}
