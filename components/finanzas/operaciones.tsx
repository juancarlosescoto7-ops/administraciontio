import { randomUUID } from "node:crypto";
import type { Campo } from "@/lib/catalogos/definiciones";
import { estadoInicial, type EstadoFormulario } from "@/lib/catalogos/estado";
import { valoresDesdeRegistro } from "@/lib/catalogos/validacion";
import { camposCorreccion } from "@/lib/finanzas/definiciones";
import { corregir, type TipoCorreccion } from "@/lib/finanzas/acciones";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { FormularioCatalogo } from "@/components/catalogos/formulario-catalogo";

type Accion = (anterior: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/**
 * Formulario de una operación financiera. Cada vez que se pinta recibe una
 * clave de idempotencia nueva: si el envío se repite (doble clic, reintento,
 * volver atrás), la base devuelve lo ya registrado en lugar de duplicarlo.
 */
export function FormularioOperacion({
  campos,
  accion,
  textoEnviar,
  rutaCancelar = null,
  registro = null,
  prefijo,
}: {
  campos: readonly Campo[];
  accion: Accion;
  textoEnviar: string;
  rutaCancelar?: string | null;
  /** Valores iniciales (p. ej., condiciones vigentes al editarlas). */
  registro?: Record<string, unknown> | null;
  /** Prefijo de los id si la página tiene varios formularios. */
  prefijo?: string;
}) {
  return (
    <FormularioCatalogo
      campos={campos}
      accion={accion}
      estadoInicial={estadoInicial(valoresDesdeRegistro({ campos }, registro))}
      textoEnviar={textoEnviar}
      rutaCancelar={rutaCancelar}
      hoy={hoyEnTegucigalpa()}
      ocultos={{ idempotencia: randomUUID() }}
      prefijo={prefijo}
    />
  );
}

/** Reverso o anulación con motivo obligatorio y confirmación explícita. */
export function FormularioCorreccion({
  tipo,
  id,
  volver,
  textoEnviar,
  confirmacion,
}: {
  tipo: TipoCorreccion;
  id: string;
  volver: string;
  textoEnviar: string;
  confirmacion: string;
}) {
  const campos = camposCorreccion(confirmacion);
  return (
    <FormularioCatalogo
      campos={campos}
      accion={corregir.bind(null, tipo, id, volver)}
      estadoInicial={estadoInicial(valoresDesdeRegistro({ campos }, null))}
      textoEnviar={textoEnviar}
      rutaCancelar={null}
      hoy={hoyEnTegucigalpa()}
      // Una página puede mostrar dos correcciones (p. ej., cobro y aplicación).
      prefijo={`${tipo}-`}
    />
  );
}

/** Aviso tras una operación (?guardado=1, ?corregido=1…). */
export function AvisoOperacion({
  parametros,
  mensajes,
}: {
  parametros: Record<string, string | string[] | undefined>;
  mensajes: Record<string, string>;
}) {
  const clave = Object.keys(mensajes).find((nombre) => parametros[nombre] === "1");
  if (!clave) return null;
  return (
    <p role="status" className="aviso aviso-exito mb-4">
      {mensajes[clave]}
    </p>
  );
}
