"use client";

import { useEffect, useId, useRef, useState } from "react";
import { aCentavos, centavosATexto } from "@/lib/finanzas/montos";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { formatearMoneda } from "@/lib/formato";
import { NOMBRE_CAMPO_LINEAS, totalesLineas, type LineaFormulario } from "@/lib/bonos/lineas";
import type { OpcionesLineas } from "@/lib/bonos/servidor";
import { useHidratado } from "@/components/use-hidratado";

/**
 * Los controles visibles no pertenecen al formulario (atributo form a un id
 * inexistente): no se envían sueltos ni los borra el reinicio automático del
 * formulario. Lo que se envía es el campo oculto con todas las líneas.
 */
const FUERA_DEL_FORMULARIO = "lineas-gasto-sin-envio";
const CONCEPTO_BONO = "Bono por servicio";

/** UUID v4 también en http (crypto.randomUUID solo existe en contextos seguros). */
function nuevaClave(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type Ingreso = {
  etiqueta: string;
  /** Nombre del campo del formulario que tiene el precio (se lee en vivo). */
  campo?: string;
  /** Importe fijo cuando no hay campo de precio. */
  monto?: number | string | null;
  nota?: string;
};

export function LineasGasto({
  opciones,
  ingreso,
  claveInicial,
  destinatarioInicial = "",
  titulo = "Bonos y gastos de este servicio",
  descripcion = "Opcional. Lo que pague ahora sale de la caja o banco elegido y genera su voucher; lo pendiente se paga después desde el servicio.",
}: {
  opciones: OpcionesLineas;
  ingreso?: Ingreso;
  /** Si se indica, se empieza con un bono ya abierto (clave generada en el servidor). */
  claveInicial?: string;
  destinatarioInicial?: string;
  titulo?: string;
  descripcion?: string;
}) {
  const hidratado = useHidratado();
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const nueva = (clave: string, bono: boolean, destinatario = ""): LineaFormulario => ({
    clave,
    categoria: bono ? (opciones.bonos ?? "") : "",
    destinatario,
    concepto: bono ? CONCEPTO_BONO : "",
    monto: "",
    pagarAhora: true,
    cuenta: opciones.cuentas.length === 1 ? opciones.cuentas[0].valor : "",
    metodo: "efectivo",
    referencia: "",
  });
  const [lineas, setLineas] = useState<LineaFormulario[]>(() =>
    claveInicial ? [nueva(claveInicial, true, destinatarioInicial)] : [],
  );

  // Precio escrito en el mismo formulario (alquiler, viaje o traslado).
  const [precioCampo, setPrecioCampo] = useState<string>("");
  useEffect(() => {
    if (!ingreso?.campo) return;
    const formulario = raiz.current?.closest("form");
    if (!formulario) return;
    const leer = () => {
      const control = formulario.elements.namedItem(ingreso.campo!);
      setPrecioCampo(control && "value" in control ? String(control.value) : "");
    };
    leer();
    formulario.addEventListener("input", leer);
    formulario.addEventListener("change", leer);
    return () => {
      formulario.removeEventListener("input", leer);
      formulario.removeEventListener("change", leer);
    };
  }, [ingreso?.campo]);

  const cambiar = (clave: string, cambios: Partial<LineaFormulario>) =>
    setLineas((actuales) => actuales.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  const cambiarCategoria = (linea: LineaFormulario, categoria: string) => {
    const nombre = (valor: string) => (valor === opciones.bonos ? CONCEPTO_BONO : (opciones.categorias.find((c) => c.valor === valor)?.etiqueta ?? ""));
    // Si el concepto era el automático de la categoría anterior, se actualiza.
    const automatico = linea.concepto.trim() === "" || linea.concepto === nombre(linea.categoria);
    cambiar(linea.clave, { categoria, ...(automatico ? { concepto: nombre(categoria) } : {}) });
  };

  const totales = totalesLineas(lineas);
  const centavosIngreso = ingreso ? (aCentavos((ingreso.campo ? precioCampo : String(ingreso.monto ?? 0)).trim() || "0") ?? null) : null;
  const queda = centavosIngreso === null ? null : centavosIngreso - totales.total;
  const conPersonas = opciones.empleados.length + opciones.conductores.length + opciones.proveedores.length > 0;

  return (
    <div ref={raiz} className="flex flex-col gap-4 border-t border-borde pt-5" data-lineas-gasto>
      <input type="hidden" name={NOMBRE_CAMPO_LINEAS} value={JSON.stringify(lineas)} />
      <div>
        <h3 className="font-semibold">{titulo}</h3>
        <p className="text-sm texto-tenue">{descripcion}</p>
      </div>

      {lineas.map((linea, posicion) => {
        const pre = `${id}-${linea.clave}`;
        const esBono = linea.categoria !== "" && linea.categoria === opciones.bonos;
        return (
          <fieldset key={linea.clave} className="tarjeta flex flex-col gap-3 p-4" data-linea-gasto={posicion + 1}>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-semibold">
                {esBono ? "Bono" : "Gasto"} {posicion + 1}
              </legend>
              <button
                type="button"
                className="boton boton-secundario min-h-9 px-3 text-sm"
                onClick={() => setLineas((actuales) => actuales.filter((l) => l.clave !== linea.clave))}
              >
                Quitar
              </button>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
              <div className="campo">
                <label className="campo-etiqueta" htmlFor={`${pre}-categoria`}>Tipo</label>
                <select id={`${pre}-categoria`} form={FUERA_DEL_FORMULARIO} className="entrada" value={linea.categoria} onChange={(e) => cambiarCategoria(linea, e.target.value)}>
                  <option value="">Seleccione…</option>
                  {opciones.categorias.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
                </select>
              </div>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor={`${pre}-destinatario`}>{esBono ? "¿A quién se le da?" : "¿A quién se le paga?"}</label>
                <select id={`${pre}-destinatario`} form={FUERA_DEL_FORMULARIO} className="entrada" value={linea.destinatario} onChange={(e) => cambiar(linea.clave, { destinatario: e.target.value })}>
                  <option value="">{esBono ? "Seleccione…" : "Nadie en particular"}</option>
                  {opciones.empleados.length > 0 && <optgroup label="Empleados">{opciones.empleados.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}</optgroup>}
                  {opciones.conductores.length > 0 && <optgroup label="Conductores">{opciones.conductores.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}</optgroup>}
                  {opciones.proveedores.length > 0 && <optgroup label="Proveedores y prestadores">{opciones.proveedores.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}</optgroup>}
                </select>
                {!conPersonas && <p className="campo-ayuda">No hay empleados, conductores ni proveedores activos.</p>}
              </div>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor={`${pre}-concepto`}>Concepto</label>
                <input id={`${pre}-concepto`} form={FUERA_DEL_FORMULARIO} className="entrada" maxLength={200} value={linea.concepto} onChange={(e) => cambiar(linea.clave, { concepto: e.target.value })} />
              </div>
              <div className="campo">
                <label className="campo-etiqueta" htmlFor={`${pre}-monto`}>Importe</label>
                <input id={`${pre}-monto`} form={FUERA_DEL_FORMULARIO} className="entrada" inputMode="decimal" placeholder="0.00" value={linea.monto} onChange={(e) => cambiar(linea.clave, { monto: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2" role="radiogroup" aria-label="¿Cuándo se paga?">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" form={FUERA_DEL_FORMULARIO} name={`${pre}-cuando`} checked={linea.pagarAhora} onChange={() => cambiar(linea.clave, { pagarAhora: true })} className="h-4 w-4" />
                Pagarlo ahora
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" form={FUERA_DEL_FORMULARIO} name={`${pre}-cuando`} checked={!linea.pagarAhora} onChange={() => cambiar(linea.clave, { pagarAhora: false })} className="h-4 w-4" />
                Dejarlo pendiente (se paga después)
              </label>
            </div>
            {linea.pagarAhora && (
              <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-3">
                <div className="campo">
                  <label className="campo-etiqueta" htmlFor={`${pre}-cuenta`}>Sale de</label>
                  <select id={`${pre}-cuenta`} form={FUERA_DEL_FORMULARIO} className="entrada" value={linea.cuenta} onChange={(e) => cambiar(linea.clave, { cuenta: e.target.value })}>
                    <option value="">Seleccione…</option>
                    {opciones.cuentas.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label className="campo-etiqueta" htmlFor={`${pre}-metodo`}>Método</label>
                  <select id={`${pre}-metodo`} form={FUERA_DEL_FORMULARIO} className="entrada" value={linea.metodo} onChange={(e) => cambiar(linea.clave, { metodo: e.target.value })}>
                    {Object.entries(ETIQUETAS_METODO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label className="campo-etiqueta" htmlFor={`${pre}-referencia`}>Referencia (opcional)</label>
                  <input id={`${pre}-referencia`} form={FUERA_DEL_FORMULARIO} className="entrada" maxLength={80} value={linea.referencia} onChange={(e) => cambiar(linea.clave, { referencia: e.target.value })} />
                </div>
              </div>
            )}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton boton-secundario" disabled={!hidratado} onClick={() => setLineas((a) => [...a, nueva(nuevaClave(), true)])}>
          + Agregar bono
        </button>
        <button type="button" className="boton boton-secundario" disabled={!hidratado} onClick={() => setLineas((a) => [...a, nueva(nuevaClave(), false)])}>
          + Agregar otro gasto
        </button>
      </div>

      {ingreso && (
        <dl className="tarjeta grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 p-4 text-sm tabular-nums" aria-live="polite" data-resumen-servicio>
          <dt>{ingreso.etiqueta}</dt>
          <dd className="text-right">{centavosIngreso === null ? "—" : formatearMoneda(centavosATexto(centavosIngreso))}</dd>
          <dt>− Bonos y gastos</dt>
          <dd className="text-right">{formatearMoneda(centavosATexto(totales.total))}</dd>
          {totales.total > 0 && (
            <dd className="col-span-2 text-xs texto-tenue">
              Pagado ahora {formatearMoneda(centavosATexto(totales.pagado))} · pendiente {formatearMoneda(centavosATexto(totales.pendiente))}
            </dd>
          )}
          <dt className="mt-1 border-t border-borde pt-2 font-semibold">Le queda (ganancia)</dt>
          <dd className={`mt-1 border-t border-borde pt-2 text-right font-semibold ${queda !== null && queda < 0 ? "text-[var(--peligro)]" : ""}`} data-ganancia>
            {queda === null ? "—" : formatearMoneda(centavosATexto(queda))}
          </dd>
          {ingreso.nota && <dd className="col-span-2 mt-1 text-xs texto-tenue">{ingreso.nota}</dd>}
        </dl>
      )}
    </div>
  );
}
