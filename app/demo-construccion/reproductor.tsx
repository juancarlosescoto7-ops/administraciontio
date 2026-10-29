"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";
import { MarcaIcono } from "@/components/marca";
import { DURACION_TOTAL, estadoVisual, progreso, RECORRIDO, reloj } from "./guion";
import "./demo.css";

function escucharMovimiento(cambio: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", cambio);
  return () => media.removeEventListener("change", cambio);
}
const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const movimientoServidor = () => false;
type Estado = ReturnType<typeof estadoVisual>;
const MENU: { nombre: string; id: string; icono: NombreIcono }[] = [
  { nombre: "Inicio", id: "inicio", icono: "inicio" },
  { nombre: "Clientes", id: "clientes", icono: "clientes" },
  { nombre: "Membresías", id: "membresias", icono: "membresia" },
  { nombre: "Ambulancias", id: "ambulancias", icono: "servicios" },
  { nombre: "Alquileres", id: "alquileres", icono: "llave" },
  { nombre: "Transportes", id: "transportes", icono: "flota" },
  { nombre: "Cobros", id: "cobros", icono: "dinero" },
  { nombre: "Gastos", id: "gastos", icono: "finanzas" },
  { nombre: "Reportes", id: "reportes", icono: "grafico" },
];
const moneda = (valor: number) => `L ${valor.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DemoConstruccion() {
  const [tiempo, setTiempo] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [aviso, setAviso] = useState("");
  const contenedor = useRef<HTMLElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const reducir = useSyncExternalStore(escucharMovimiento, movimientoReducido, movimientoServidor);
  const estado = estadoVisual(tiempo);
  const terminado = tiempo >= DURACION_TOTAL;
  const enMarcha = reproduciendo && !terminado;

  useEffect(() => {
    if (!enMarcha) return;
    let anterior = performance.now();
    const timer = window.setInterval(() => {
      const ahora = performance.now();
      const delta = ahora - anterior;
      anterior = ahora;
      setTiempo((actual) => Math.min(DURACION_TOTAL, actual + delta * velocidad));
    }, 40);
    const ocultar = () => { if (document.hidden) setReproduciendo(false); };
    document.addEventListener("visibilitychange", ocultar);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", ocultar); };
  }, [enMarcha, velocidad]);

  function reproducir() {
    if (terminado) setTiempo(0);
    setReproduciendo(terminado || !reproduciendo);
  }

  async function pantallaCompleta() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (contenedor.current?.requestFullscreen) await contenedor.current.requestFullscreen();
      else setAviso("Pantalla completa no disponible en este navegador.");
    } catch { setAviso("No se pudo abrir la pantalla completa."); }
  }

  return (
    <main className="ds-film" ref={contenedor} data-playing={enMarcha} data-reduced={reducir}>
      <h1 className="sr-only">Simulación visual del sistema</h1>
      <div className="ds-viewport" ref={escenario}>
        <div className="ds-system" data-phase={estado.fase} data-screen={estado.pantalla} inert>
          <aside className="ds-sidebar">
            <div className="ds-brand"><MarcaIcono className="size-10" /><div><strong>ERP interno</strong><small>Gestión de servicios</small></div></div>
            <div className="ds-menu-label">MI EMPRESA</div>
            <nav aria-label="Menú simulado"><ul>{MENU.map((item) => <li key={item.id}><a href="#" data-target={item.id} data-selected={estado.pantalla === item.id}><Icono nombre={item.icono} /><span>{item.nombre}</span>{estado.pantalla === item.id && <i />}</a></li>)}</ul></nav>
            <div className="ds-user"><span>AD</span><div>Administrador<small>Mi espacio de trabajo</small></div><Icono nombre="configuracion" /></div>
          </aside>
          <div className="ds-body">
            <header className="ds-topbar"><span>Mi empresa <span>/</span> {MENU.find((item) => item.id === estado.pantalla)?.nombre}</span><span><Icono nombre="calendario" /> 29 oct 2026</span></header>
            <div className="ds-content">
              {estado.pantalla === "inicio" ? <Panel estado={estado} tiempo={tiempo} reducir={reducir} /> : <Listado estado={estado} />}
            </div>
          </div>
          {estado.modal && <Formulario tipo={estado.modal} tiempo={tiempo} reducir={reducir} />}
          {estado.guardado && <div className="ds-toast"><Icono nombre="finalizar" />{estado.guardado}</div>}
        </div>
        {!reducir && tiempo >= 24000 && tiempo < 64600 && <Cursor tiempo={tiempo} escenario={escenario} />}
      </div>
      <section className="ds-player" aria-label="Controles de reproducción">
        <label className="ds-progress"><span className="sr-only">Posición de la animación</span><input type="range" min={0} max={DURACION_TOTAL} step={100} value={tiempo} aria-valuetext={`${reloj(tiempo)} de ${reloj(DURACION_TOTAL)}`} onChange={(event) => setTiempo(Number(event.target.value))} style={{ "--progress": `${tiempo / DURACION_TOTAL * 100}%` } as CSSProperties} /></label>
        <div className="ds-controls">
          <button className="ds-play" onClick={reproducir} aria-label={enMarcha ? "Pausar animación" : terminado ? "Volver a reproducir" : "Reproducir animación"}><span aria-hidden="true" data-symbol={enMarcha ? "Ⅱ" : "▶"} />{enMarcha ? "Pausar" : terminado ? "Ver de nuevo" : "Reproducir"}</button>
          <button onClick={() => { setTiempo(0); setReproduciendo(false); }} aria-label="Reiniciar animación"><Icono nombre="historial" /><span className="ds-control-label">Reiniciar</span></button>
          <span className="ds-clock">{reloj(tiempo)} <span>/ {reloj(DURACION_TOTAL)}</span></span>
          <span className="ds-simulation">Simulación · datos ficticios</span>
          <select aria-label="Velocidad de reproducción" value={velocidad} onChange={(event) => setVelocidad(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select>
          <button onClick={pantallaCompleta} aria-label="Alternar pantalla completa"><Icono nombre="expandir" /></button>
        </div>
      </section>
      <p className="sr-only" role="status">{estado.fase === "html" ? "Interfaz HTML sin estilos" : estado.fase === "layout" ? "Distribución de la interfaz" : estado.fase === "tipo" ? "Tipografía aplicada" : estado.fase === "color" ? "Diseño aplicado" : `Sistema terminado. ${estado.pantalla}. ${estado.guardado ?? ""}`}</p>
      {aviso && <p className="ds-notice" role="status">{aviso}</p>}
    </main>
  );
}

function Panel({ estado, tiempo, reducir }: { estado: Estado; tiempo: number; reducir: boolean }) {
  const crecimiento = reducir || tiempo < 20000 ? 1 : progreso(tiempo, 20000, 2000);
  const entrada = reducir || tiempo < 63000 ? 1 : progreso(tiempo, 63000, 650);
  const indicadores: { nombre: string; valor: string; detalle: string; icono: NombreIcono }[] = [
    { nombre: "Cobrado hoy", valor: moneda(estado.cobroCreado ? 500 : 0), detalle: estado.cobroCreado ? "1 cobro confirmado" : "Sin cobros hoy", icono: "dinero" },
    { nombre: "Por cobrar", valor: moneda(Math.round((estado.membresiaCreada && !estado.cobroCreado ? 2800 : 2300) * crecimiento)), detalle: "Saldos pendientes", icono: "finanzas" },
    { nombre: "Clientes", valor: estado.clienteCreado ? "2" : "1", detalle: "Clientes activos", icono: "clientes" },
    { nombre: "Membresías", valor: estado.membresiaCreada ? "1" : "0", detalle: "Membresías activas", icono: "membresia" },
  ];
  return <div className="ds-dashboard" style={{ "--entry": entrada } as CSSProperties}>
    <h2 className="ds-home-title">Inicio</h2>
    <div className="ds-search"><Icono nombre="buscar" /><span>Buscar clientes, servicios o movimientos…</span><kbd>Ctrl K</kbd></div>
    <div className="ds-actions">{[{ nombre: "Registrar cobro", icono: "dinero" }, { nombre: "Nuevo cliente", icono: "clientes" }, { nombre: "Nueva membresía", icono: "membresia" }, { nombre: "Nuevo traslado", icono: "servicios" }].map((item) => <button key={item.nombre} type="button"><Icono nombre={item.icono as NombreIcono} />{item.nombre}<Icono nombre="flecha" /></button>)}</div>
    <div className="ds-metrics">{indicadores.map((item) => <article className="ds-card ds-metric" key={item.nombre}><span className="ds-metric-icon"><Icono nombre={item.icono} /></span><div><h3>{item.nombre}</h3><strong>{item.valor}</strong><small>{item.detalle}</small></div></article>)}</div>
    <div className="ds-grid">
      <section className="ds-card ds-financial"><div className="ds-section-title"><span><Icono nombre="grafico" />Resumen financiero</span><small>Este mes</small></div><div className="ds-revenue"><span>Ingresos generados</span><strong>{moneda(Math.round((estado.membresiaCreada ? 2800 : 2300) * crecimiento))}</strong></div><div className="ds-chart" aria-label="Ingresos por actividad">{[{ nombre: "Membresías", monto: estado.membresiaCreada ? 500 : 0 }, { nombre: "Alquileres", monto: 1500 }, { nombre: "Transportes", monto: 800 }].map((item, i) => <div className="ds-bar-column" key={item.nombre}><span>{moneda(item.monto)}</span><div className="ds-bar-track"><div style={{ height: `${item.monto / 1500 * 100 * crecimiento}%`, opacity: reducir ? 1 : tiempo >= 20000 && tiempo < 23000 ? progreso(tiempo, 20000 + i * 250, 700) : 1 }} /></div><small>{item.nombre}</small></div>)}</div><div className="ds-financial-bottom"><span>Cobros recibidos <b>{moneda(estado.cobroCreado ? 500 : 0)}</b></span><span>Pendiente <b>{moneda(2300)}</b></span></div></section>
      <section className="ds-card ds-modules"><div className="ds-section-title"><span><Icono nombre="servicios" />Operación</span></div>{[{ titulo: "Ambulancias", detalle: "Traslados y cobertura", icono: "servicios" }, { titulo: "Alquileres", detalle: "Reservas, entregas y devoluciones", icono: "llave" }, { titulo: "Transportes", detalle: "Servicios con conductor", icono: "flota" }].map((item, i) => <div className="ds-module" key={item.titulo} style={{ "--module": reducir || tiempo < 20000 ? 1 : progreso(tiempo, 20500 + i * 350, 600) } as CSSProperties}><Icono nombre={item.icono as NombreIcono} /><div><h3>{item.titulo}</h3><p>{item.detalle}</p></div><Icono nombre="flecha" /></div>)}<div className="ds-available"><span /> Recursos disponibles</div></section>
    </div>
    <section className="ds-card ds-recent"><div className="ds-section-title"><span>Movimientos recientes</span><small>Ver todos →</small></div><Tabla cabeceras={["Concepto", "Cliente", "Estado", "Importe"]} filas={[
      ...(estado.cobroCreado ? [["Cobro de mensualidad", "Ana Demo", "Confirmado", "L 500.00"]] : []),
      ...(estado.membresiaCreada ? [["Mensualidad · Plan de ejemplo", "Ana Demo", estado.cobroCreado ? "Pagado" : "Pendiente", "L 500.00"]] : []),
      ["Alquiler ALQ-01", "Cliente de ejemplo", "Pendiente", "L 1,500.00"],
      ["Transporte TR-01", "Cliente de ejemplo", "Pendiente", "L 800.00"],
    ]} /></section>
  </div>;
}

function Tabla({ cabeceras, filas }: { cabeceras: string[]; filas: string[][] }) {
  return <div className="ds-table-wrap"><table><thead><tr>{cabeceras.map((valor) => <th key={valor}>{valor}</th>)}</tr></thead><tbody>{filas.map((fila) => <tr key={fila.join("|")}>{fila.map((valor, i) => <td key={i}>{["Activo", "Activa", "Confirmado", "Pagado", "Pendiente"].includes(valor) ? <span className="ds-badge" data-pending={valor === "Pendiente"}>{valor}</span> : valor}</td>)}</tr>)}</tbody></table></div>;
}

function Listado({ estado }: { estado: Estado }) {
  const cliente = estado.pantalla === "clientes";
  const membresia = estado.pantalla === "membresias";
  const titulo = cliente ? "Clientes" : membresia ? "Membresías" : "Cobros";
  const filas = cliente ? [["Cliente de ejemplo", "Natural", "Activo"], ...(estado.clienteCreado ? [["Ana Demo", "Natural", "Activo"]] : [])] : membresia ? estado.membresiaCreada ? [["Ana Demo", "Plan de ejemplo", "Activa", "L 500.00"]] : [] : estado.cobroCreado ? [["Ana Demo", "Efectivo", "Confirmado", "L 500.00"]] : [];
  return <div className="ds-list">
    <div className="ds-list-heading"><div><h2>{titulo}</h2><p>{cliente ? "Personas y empresas" : membresia ? "Planes y beneficiarios" : "Cobros recibidos de clientes"}</p></div><button type="button" className="ds-primary" data-target="nuevo"><Icono nombre="mas" />{cliente ? "Nuevo cliente" : membresia ? "Nueva membresía" : "Registrar cobro"}</button></div>
    <div className="ds-card ds-filters"><Icono nombre="buscar" /><span>Buscar {titulo.toLowerCase()}…</span><span>Todos los estados <Icono nombre="abajo" /></span></div>
    <section className="ds-card"><Tabla cabeceras={cliente ? ["Nombre", "Tipo", "Estado"] : ["Cliente", membresia ? "Plan" : "Método", "Estado", "Importe"]} filas={filas} />{filas.length === 0 && <div className="ds-empty"><Icono nombre={membresia ? "membresia" : "finanzas"} /><p>{membresia ? "Sin membresías registradas" : "Sin cobros registrados"}</p></div>}</section>
    <p className="ds-count">{filas.length} {filas.length === 1 ? "registro" : "registros"}</p>
  </div>;
}

function Formulario({ tipo, tiempo, reducir }: { tipo: NonNullable<Estado["modal"]>; tiempo: number; reducir: boolean }) {
  const inicio = tipo === "cliente" ? 29500 : tipo === "membresia" ? 41500 : 53500;
  const campos = tipo === "cliente" ? [{ etiqueta: "Nombre completo", valor: "Ana Demo" }, { etiqueta: "Correo electrónico", valor: "ana@example.com" }, { etiqueta: "Tipo", valor: "Persona natural" }] : tipo === "membresia" ? [{ etiqueta: "Cliente titular", valor: "Ana Demo" }, { etiqueta: "Plan", valor: "Plan de ejemplo · L 500.00" }, { etiqueta: "Beneficiario", valor: "Ana Demo" }] : [{ etiqueta: "Cliente", valor: "Ana Demo" }, { etiqueta: "Importe · HNL", valor: "500.00" }, { etiqueta: "Cuenta y método", valor: "Caja de ejemplo · Efectivo" }];
  const entrada = reducir ? 1 : progreso(tiempo, inicio, 350);
  return <div className="ds-modal-backdrop" style={{ opacity: entrada }}><div className="ds-modal" style={{ transform: `translateY(${(1 - entrada) * 18}px) scale(${0.98 + entrada * 0.02})` }}>
    <div className="ds-modal-title"><h2>{tipo === "cliente" ? "Nuevo cliente" : tipo === "membresia" ? "Nueva membresía" : "Registrar cobro"}</h2><Icono nombre="cerrar" /></div>
    <div className="ds-form-fields">{campos.map((campo, i) => {
      const desde = inicio + [900, 2600, 4400][i];
      const caracteres = Math.floor(Math.max(0, tiempo - desde) / 48);
      const escribiendo = tiempo >= desde && tiempo < desde + 1350;
      return <label key={campo.etiqueta}><span>{campo.etiqueta}</span><input tabIndex={-1} readOnly value={reducir ? campo.valor : campo.valor.slice(0, caracteres)} placeholder="Seleccionar o escribir…" data-target={`campo-${i}`} data-writing={escribiendo} /></label>;
    })}</div>
    <div className="ds-form-bottom"><span>Cancelar</span><button type="button" className="ds-primary" data-target="guardar" data-click={tiempo >= inicio + 6200}>{tipo === "cliente" ? "Guardar cliente" : tipo === "membresia" ? "Crear membresía" : "Confirmar cobro"}<Icono nombre="flecha" /></button></div>
  </div></div>;
}

/** El cursor usa el mismo reloj que los formularios y sigue sus elementos. */
function Cursor({ tiempo, escenario }: { tiempo: number; escenario: RefObject<HTMLDivElement | null> }) {
  const cursor = useRef<HTMLDivElement>(null);
  const indice = Math.max(0, RECORRIDO.findLastIndex((punto) => tiempo >= punto.en - 800));
  const punto = RECORRIDO[indice];
  const clic = "clic" in punto && punto.clic && tiempo >= punto.en && tiempo < punto.en + 280;
  useEffect(() => {
    const marco = escenario.current;
    const flecha = cursor.current;
    if (!marco || !flecha) return;
    function situar() {
      if (!marco || !flecha) return;
      const origen = marco.getBoundingClientRect();
      function coordenadas(destino: string) {
        const rect = marco!.querySelector(`[data-target="${destino}"]`)?.getBoundingClientRect();
        return rect ? { x: rect.left - origen.left + Math.min(40, rect.width / 2), y: rect.top - origen.top + rect.height / 2 } : { x: origen.width * 0.65, y: origen.height * 0.55 };
      }
      const a = coordenadas(RECORRIDO[Math.max(0, indice - 1)].destino);
      const b = coordenadas(punto.destino);
      const p = progreso(tiempo, punto.en - 800, 800);
      const suave = p * p * (3 - 2 * p);
      flecha.style.transform = `translate(${a.x + (b.x - a.x) * suave}px, ${a.y + (b.y - a.y) * suave}px)`;
    }
    situar();
    window.addEventListener("resize", situar);
    marco.addEventListener("scroll", situar, true);
    return () => { window.removeEventListener("resize", situar); marco.removeEventListener("scroll", situar, true); };
  }, [tiempo, indice, punto, escenario]);
  return <div ref={cursor} className="ds-cursor" aria-hidden="true" data-click={clic}><span /><svg viewBox="0 0 24 28"><path d="M2 2v22l6-6 5 9 4-2-5-9h9Z" fill="#111a2d" stroke="white" strokeWidth="2" /></svg></div>;
}
