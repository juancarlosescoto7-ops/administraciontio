import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP interno",
  description: "Sistema administrativo interno",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Aplica la preferencia del menú antes de pintar, sin parpadeo: «fijo» o, por
// omisión, ocultación automática (empieza desplegado y se oculta solo).
const PREFERENCIA_MENU = `(function(r){var m=null;try{m=localStorage.getItem("erp-menu")}catch(e){}if(m==="fijo")r.dataset.menu="fijo";else r.dataset.menuAuto="flotante"})(document.documentElement)`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script fija data-menu o data-menu-auto en <html> antes de hidratar.
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCIA_MENU }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
