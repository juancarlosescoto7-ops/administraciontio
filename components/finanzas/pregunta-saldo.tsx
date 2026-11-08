import { puede, type Sujeto } from "@/lib/auth/roles";
import { aplicarSaldo } from "@/lib/finanzas/acciones";
import { camposAplicarSaldo } from "@/lib/finanzas/definiciones";
import { aCentavos, centavosATexto } from "@/lib/finanzas/montos";
import { formatearMoneda } from "@/lib/formato";
import { FormularioOperacion } from "@/components/finanzas/operaciones";
import { PreguntaAutomatica } from "@/components/finanzas/pregunta-automatica";

/**
 * Cuando un cargo vigente queda con pendiente y el cliente tiene saldo a
 * favor, pregunta al llegar a la página si se aplica ese saldo al cargo. No
 * aplica nada por sí sola (§ cobros: los anticipos anteriores no se consumen
 * automáticamente); propone el máximo posible y el usuario confirma.
 */
export function PreguntaSaldoAFavor({
  cargoId,
  concepto,
  vigente,
  pendiente,
  aFavor,
  rol,
  volver,
  recienAplicado,
}: {
  cargoId: string;
  concepto: string;
  vigente: boolean;
  pendiente: string | number | null | undefined;
  aFavor: string | number | null | undefined;
  rol: Sujeto;
  /** Página a la que se vuelve tras aplicar (la que muestra la pregunta). */
  volver: string;
  /** La página llega de aplicar saldo: no se vuelve a abrir sola. */
  recienAplicado: boolean;
}) {
  const centavosPendiente = aCentavos(pendiente) ?? 0;
  const centavosAFavor = aCentavos(aFavor) ?? 0;
  if (!vigente || centavosPendiente <= 0 || centavosAFavor <= 0 || !puede("registrarCobro", rol)) return null;
  const sugerido = Math.min(centavosPendiente, centavosAFavor);
  // Si cambian el pendiente o el saldo, se vuelve a preguntar; la clave como
  // `key` remonta la ventana (cerrada) tras una aplicación parcial.
  const clave = `saldo-a-favor:${cargoId}:${centavosPendiente}:${centavosAFavor}`;

  return (
    <div className="mb-6">
      <PreguntaAutomatica
        key={clave}
        clave={clave}
        abrir={!recienAplicado}
        titulo="¿Aplicar saldo a favor a este cargo?"
        textoBoton="Aplicar saldo a favor"
      >
        <p className="mb-4 text-sm">
          El cliente tiene <strong>{formatearMoneda(centavosATexto(centavosAFavor))}</strong> a favor y el cargo «{concepto}» tiene{" "}
          <strong>{formatearMoneda(centavosATexto(centavosPendiente))}</strong> pendientes. Se toma de sus cobros más antiguos y no
          vuelve a entrar dinero a caja.
        </p>
        <FormularioOperacion
          campos={camposAplicarSaldo()}
          accion={aplicarSaldo.bind(null, cargoId, volver)}
          registro={{ monto: centavosATexto(sugerido) }}
          textoEnviar="Sí, aplicar saldo"
          prefijo="saldo-"
          tono="exito"
        />
      </PreguntaAutomatica>
    </div>
  );
}
