import type { ReactNode } from "react";

// Iconos de trazo en SVG en línea (sin dependencias). Siempre decorativos:
// el texto visible o el aria-label del control es lo que se anuncia.
const TRAZOS = {
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v12h14V9" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  servicios: (
    <>
      <path d="M2 6.5h12v10H2z" />
      <path d="M14 9.5h4l3.5 3.5v3.5H14" />
      <circle cx="6" cy="17.5" r="1.75" />
      <circle cx="17.5" cy="17.5" r="1.75" />
      <path d="M8 8.75v5.5M5.25 11.5h5.5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M2.5 20v-.5a6.5 6.5 0 0 1 13 0v.5" />
      <path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M21.5 20v-.5a6.5 6.5 0 0 0-3.5-5.8" />
    </>
  ),
  flota: (
    <>
      <path d="M4 16.5v-4.5l2.2-5h11.6l2.2 5v4.5z" />
      <path d="M4 12h16" />
      <circle cx="7.5" cy="16.5" r="1.75" />
      <circle cx="16.5" cy="16.5" r="1.75" />
    </>
  ),
  finanzas: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M15.5 14.5h2.5" />
    </>
  ),
  configuracion: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  llave: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="m10 13 10-10M16 7l3 3M14 9l2 2" />
    </>
  ),
  membresia: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 14h4" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  vacio: (
    <>
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
      <path d="M5.5 6.5 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-2.5-6.5a2 2 0 0 0-1.9-1.5H7.4a2 2 0 0 0-1.9 1.5z" />
    </>
  ),
  atras: <path d="M19 12H5M11 6l-6 6 6 6" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  contraer: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16M15.5 10l-2 2 2 2" />
    </>
  ),
  expandir: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16M13.5 10l2 2-2 2" />
    </>
  ),
  calendario: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  dinero: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  historial: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  documento: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  grafico: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V8M17 16v-7" />
    </>
  ),
  editar: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  finalizar: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3 5 6v5.5c0 4.3 3 7.6 7 9.5 4-1.9 7-5.2 7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  libro: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
      <path d="M9 7h6" />
    </>
  ),
  abajo: <path d="m6 9 6 6 6-6" />,
  salir: (
    <>
      <path d="M14 4h5v16h-5" />
      <path d="M10 8 6 12l4 4" />
      <path d="M6 12h10" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = "size-5" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
