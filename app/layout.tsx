import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Suspense } from "react";
import { Trazos, TrazosFijos } from "@/components/trazos";

export const metadata: Metadata = {
  title: "ERP interno",
  description: "Sistema administrativo interno",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Aplica el menú contraído guardado antes de pintar, sin parpadeo.
const PREFERENCIA_MENU = `try{if(localStorage.getItem("erp-menu")==="compacto")document.documentElement.dataset.menu="compacto"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script fija data-menu en <html> antes de hidratar.
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCIA_MENU }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<TrazosFijos />}>
          <Trazos />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
