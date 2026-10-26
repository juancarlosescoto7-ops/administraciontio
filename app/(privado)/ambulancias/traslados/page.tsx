import { permanentRedirect } from "next/navigation";

// Ruta de la especificación maestra; el módulo vive en /ambulancias.
export default function RedirigirTraslados() {
  permanentRedirect("/ambulancias");
}
