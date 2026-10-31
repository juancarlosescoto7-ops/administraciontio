import type { ReactNode } from "react";
import { Suspense } from "react";
import { accesosRapidos } from "@/lib/accesos";
import { ETIQUETAS_ROL } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { gruposNavegacion } from "@/lib/navegacion";
import { Navegacion } from "@/components/navegacion";
import { MarcaIcono, MarcaLogo } from "@/components/marca";
import { CajasProvider } from "@/components/plegable";
import { AvisoClienteNuevo } from "@/components/aviso-cliente-nuevo";

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
          <Suspense fallback={null}>
            <AvisoClienteNuevo />
          </Suspense>
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
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center vidrio-barra border-b px-4 sm:px-6 lg:px-8 xl:hidden">
        <span className="font-semibold">ERP interno</span>
      </div>
      <div className="menu-lateral fixed inset-y-0 left-0 hidden w-[var(--ancho-menu)] overflow-hidden vidrio-barra border-r xl:block">
        <div className="flex h-[4.5rem] items-center gap-3 px-5">
          <MarcaIcono className="solo-compacto size-10" />
          <MarcaLogo alto={44} className="solo-amplio" />
        </div>
      </div>
    </>
  );
}
