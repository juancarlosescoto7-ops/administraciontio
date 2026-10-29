"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";
import { MarcaIcono } from "@/components/marca";
import { DURACION_ESCENA, DURACION_TOTAL, ESCENAS, posicion, reloj } from "./guion";
import "./demo.css";

const MENU: { nombre: string; icono: NombreIcono }[] = [
  { nombre: "Inicio", icono: "inicio" },
  { nombre: "Clientes", icono: "clientes" },
  { nombre: "Membresías", icono: "membresia" },
  { nombre: "Ambulancias", icono: "servicios" },
  { nombre: "Flota y transportes", icono: "flota" },
  { nombre: "Finanzas", icono: "finanzas" },
];

function escucharMovimiento(cambio: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", cambio);
  return () => media.removeEventListener("change", cambio);
}
const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sinMovimientoServidor = () => false;

/** Un reloj único permite pausar y buscar sin dejar timers de escenas anteriores. */
export function DemoConstruccion() {
  const [tiempo, setTiempo] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const [aviso, setAviso] = useState("");
  const contenedor = useRef<HTMLElement>(null);
  const reducir = useSyncExternalStore(escucharMovimiento, movimientoReducido, sinMovimientoServidor);
  const { indice, local } = posicion(tiempo);
  const escena = ESCENAS[indice];
  const terminado = tiempo >= DURACION_TOTAL;
  const enMarcha = reproduciendo && !terminado;
  const navegadorActivo = local >= 5100;
  const fase = local < 5100 ? "Escribiendo código" : local < 10800 ? "Probando en el navegador" : "Viendo el resultado";

  useEffect(() => {
    if (!enMarcha) return;
    let anterior = performance.now();
    const timer = window.setInterval(() => {
      const ahora = performance.now();
      const delta = ahora - anterior;
      anterior = ahora;
      setTiempo((actual) => Math.min(DURACION_TOTAL, actual + delta * velocidad));
    }, 50);
    const ocultar = () => {
      if (document.hidden) setReproduciendo(false);
    };
    document.addEventListener("visibilitychange", ocultar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ocultar);
    };
  }, [enMarcha, velocidad]);

  function reproducir() {
    if (terminado) setTiempo(0);
    setReproduciendo(terminado || !reproduciendo);
  }

  async function pantallaCompleta() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (contenedor.current?.requestFullscreen) await contenedor.current.requestFullscreen();
      else setAviso("Este navegador no permite pantalla completa. Puedes ampliar la ventana.");
    } catch {
      setAviso("No se pudo abrir la pantalla completa. Puedes seguir reproduciendo aquí.");
    }
  }

  const subtitulo = local < 5100 ? escena.descripcion : local < 10800 ? escena.accion : escena.resultado;
  return (
    <main ref={contenedor} className="dc-demo" data-playing={enMarcha} data-reduced={reducir} data-scene={indice}>
      <header className="dc-cabecera">
        <div className="dc-identidad"><MarcaIcono /><span>ERP interno <span className="dc-separador">/</span> <span className="dc-tenue">Dentro del desarrollo</span></span></div>
        <span className="dc-etiqueta"><span /> RECREACIÓN ANIMADA</span>
      </header>

      <section className="dc-intro" aria-labelledby="titulo-demo">
        <div><p className="dc-eyebrow">DE LA PRIMERA LÍNEA AL SISTEMA COMPLETO</p><h1 id="titulo-demo">Así se construyó.</h1></div>
        <p>Código que toma forma.<br /><span>Una mirada al desarrollo de nuestro ERP.</span></p>
      </section>

      <section className="dc-escenario" aria-label="Recreación del editor y del navegador">
        <div className="dc-barraEscenario">
          <span><span className="dc-luz" /> empresa-tio <span className="dc-tenue">/ estudio de desarrollo</span></span>
          <span className="dc-paso">{String(indice + 1).padStart(2, "0")} / 07 <span>{fase}</span></span>
        </div>
        <div className="dc-ventanas" data-focus={navegadorActivo ? "browser" : "editor"}>
          <Editor indice={indice} local={local} reducir={reducir} />
          <div className="dc-navegador">
            <div className="dc-pestanas" aria-hidden="true">
              <span className="dc-pestana" data-active={indice === 0 || indice === 6}><Icono nombre="inicio" /> Inicio</span>
              {indice > 0 && indice < 6 && <span key={indice} className={`dc-pestana dc-nuevaPestana`} data-active="true"><Icono nombre={escena.modulo} /> {escena.corto}<span className="dc-cerrarTab">×</span></span>}
              <span className="dc-nuevaTab">+</span>
            </div>
            <div className="dc-direccion" aria-hidden="true"><Icono nombre="atras" /><Icono nombre="historial" /><span><Icono nombre="candado" /> erp.demo{escena.ruta}</span><span className="dc-local">VISTA SIMULADA</span></div>
            <div className="dc-aplicacion">
              <aside className="dc-menu" aria-label="Navegación representada">
                <div className="dc-marcaApp"><MarcaIcono /><strong>ERP interno</strong></div>
                <p>ESPACIO DE TRABAJO</p>
                {MENU.map((item) => <div key={item.icono} className="dc-menuItem" data-active={item.icono === escena.modulo}><Icono nombre={item.icono} /><span>{item.nombre}</span></div>)}
                <div className="dc-usuario"><span>AD</span><div>Administrador<small>Sesión de ejemplo</small></div></div>
              </aside>
              <div className="dc-pantalla" key={indice}>
                <div className="dc-miga">Mi empresa <span>/</span> {MENU.find((item) => item.icono === escena.modulo)?.nombre}</div>
                <Pantalla indice={indice} local={local} reducir={reducir} />
                {indice > 0 && indice < 6 && local >= 5400 && local < 11200 && <span aria-hidden="true" className="dc-cursor" style={{ "--cursor-x": local < 8000 ? "55%" : "80%", "--cursor-y": local < 8000 ? "47%" : "82%" } as CSSProperties}><svg viewBox="0 0 24 28"><path d="M2 2v22l6-6 5 9 4-2-5-9h9Z" fill="#101b34" stroke="white" strokeWidth="2" /></svg><span>Desarrollador</span></span>}
              </div>
            </div>
            <div className="dc-notaDatos"><Icono nombre="escudo" /> Datos ficticios · ninguna operación se guarda</div>
          </div>
        </div>
        <div className="dc-relato">
          <span className="dc-numeroEscena">{String(indice + 1).padStart(2, "0")}</span>
          <div aria-live="polite" aria-atomic="true"><h2>{escena.titulo}</h2><p>{subtitulo}</p></div>
          <span className="dc-indicadorFase" aria-hidden="true"><i data-active={local < 5100} /><i data-active={local >= 5100 && local < 10800} /><i data-active={local >= 10800} /></span>
        </div>
      </section>

      <section className="dc-reproductor" aria-label="Controles de reproducción">
        <div className="dc-controles">
          <button className="dc-play" onClick={reproducir} aria-label={enMarcha ? "Pausar animación" : terminado ? "Volver a reproducir" : "Reproducir animación"}><span aria-hidden="true" data-symbol={enMarcha ? "Ⅱ" : "▶"} />{enMarcha ? "Pausar" : terminado ? "Ver de nuevo" : "Reproducir"}</button>
          <button className="dc-control" onClick={() => { setTiempo(0); setReproduciendo(false); }} aria-label="Reiniciar animación"><Icono nombre="historial" /><span>Reiniciar</span></button>
          <span className="dc-tiempo" aria-label={`Tiempo ${reloj(tiempo)} de ${reloj(DURACION_TOTAL)}`}>{reloj(tiempo)} <span>/ {reloj(DURACION_TOTAL)}</span></span>
          <label className="dc-velocidad"><span>Velocidad</span><select value={velocidad} onChange={(event) => setVelocidad(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
          <button className="dc-control" onClick={pantallaCompleta} aria-label="Alternar pantalla completa"><Icono nombre="expandir" /></button>
        </div>
        <label className="dc-progreso"><span className="sr-only">Posición de la animación</span><input type="range" min={0} max={DURACION_TOTAL} step={100} value={tiempo} aria-valuetext={`${reloj(tiempo)} de ${reloj(DURACION_TOTAL)}. ${escena.titulo}`} onChange={(event) => setTiempo(Number(event.target.value))} style={{ "--progreso": `${tiempo / DURACION_TOTAL * 100}%` } as CSSProperties} /></label>
        <nav className="dc-capitulos" aria-label="Capítulos de la animación">{ESCENAS.map((capitulo, i) => <button key={capitulo.corto} onClick={() => setTiempo(i * DURACION_ESCENA)} aria-current={indice === i ? "step" : undefined}><span>{String(i + 1).padStart(2, "0")}</span>{capitulo.corto}<small>{reloj(i * DURACION_ESCENA)}</small></button>)}</nav>
      </section>
      <footer className="dc-pie"><span>Hecho de componentes reales. Contado paso a paso.</span><span>Recreación ilustrativa · {reloj(DURACION_TOTAL)} · Sin audio</span></footer>
      {reducir && <p className="dc-aviso">Movimiento reducido: el código y los campos aparecen completos. Puedes recorrer las escenas con los capítulos.</p>}
      {aviso && <p className="dc-aviso" role="status">{aviso}</p>}
    </main>
  );
}

function Editor({ indice, local, reducir }: { indice: number; local: number; reducir: boolean }) {
  const escena = ESCENAS[indice];
  const texto = escena.codigo.slice(0, reducir ? escena.codigo.length : Math.floor(Math.max(0, local - 350) / 4200 * escena.codigo.length));
  return (
    <div className="dc-editor">
      <div className="dc-tituloEditor"><span className="dc-puntos"><i /><i /><i /></span><span>Editor de código</span><span>···</span></div>
      <div className="dc-archivo"><span>TSX</span>{escena.archivo.split("/").at(-1)}<i /></div>
      <div className="dc-rutaArchivo">{escena.archivo}</div>
      <div className="dc-codigo" aria-label={`Fragmento ilustrativo de ${escena.archivo}`}>
        <pre aria-hidden="true">{texto.split("\n").map((linea, i) => <div key={i} className="dc-linea"><span className="dc-numeroLinea">{i + 1}</span><code className={linea.trim().startsWith("//") ? "dc-comentario" : undefined}>{linea.split(/("[^"]*"|\b(?:export|default|function|return|const|if)\b)/g).map((parte, j) => <span key={j} className={parte.startsWith('"') ? "dc-cadena" : /^(export|default|function|return|const|if)$/.test(parte) ? "dc-palabra" : undefined}>{parte}</span>)}{i === texto.split("\n").length - 1 && local < 5100 && <i className="dc-caret" />}</code></div>)}</pre>
        <span className="sr-only">{escena.codigo}</span>
      </div>
      <div className="dc-terminal"><div><span>TERMINAL</span><span>Salida simulada</span></div><p><b>›</b> {local < 4600 ? "Preparando la siguiente vista…" : escena.terminal}</p>{local >= 5100 && <p className="dc-terminalOk">✓ Vista lista para mostrar</p>}</div>
      <div className="dc-estadoEditor"><span>⑂ main</span><span>TypeScript React <span>UTF-8</span></span></div>
    </div>
  );
}

function CampoDemo({ etiqueta, valor, local, desde, reducir }: { etiqueta: string; valor: string; local: number; desde: number; reducir: boolean }) {
  const texto = reducir ? valor : valor.slice(0, Math.floor(Math.max(0, local - desde) / 35));
  const escribiendo = local >= desde && local < desde + valor.length * 35;
  return <div className="dc-campoDemo"><span>{etiqueta}</span><div className="dc-valorCampo" data-writing={escribiendo}>{texto || <span className="dc-placeholder">Seleccionar o escribir…</span>}{escribiendo && <i className="dc-caretCampo" />}</div></div>;
}

function CabeceraVista({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return <div className="dc-cabeceraVista"><h3>{titulo}</h3><p>{subtitulo}</p></div>;
}

function Exito({ texto }: { texto: string }) {
  return <div className="dc-exito"><Icono nombre="finalizar" /><span>{texto}</span></div>;
}

function Pantalla({ indice, local, reducir }: { indice: number; local: number; reducir: boolean }) {
  const guardado = local >= 10800;
  if (indice === 0 || indice === 6) return <PanelDemo final={indice === 6} local={local} />;
  if (indice === 1) return <>
    <CabeceraVista titulo={guardado ? "Clientes" : "Nuevo cliente"} subtitulo="Una misma persona, todos sus servicios." />
    {guardado ? <><Exito texto="Cliente guardado correctamente" /><div className="dc-tablaDemo"><div className="dc-filaCabecera"><span>Nombre</span><span>Tipo</span><span>Estado</span></div><div className="dc-fila"><strong>Ana Demo</strong><span>Natural</span><span className="insignia insignia-activo">Activo</span></div></div></> : <div className={`tarjeta dc-formulario`}>
      <CampoDemo etiqueta="Nombre completo *" valor="Ana Demo" local={local} desde={5700} reducir={reducir} />
      <CampoDemo etiqueta="Tipo de cliente" valor="Persona natural" local={local} desde={6500} reducir={reducir} />
      <CampoDemo etiqueta="Correo electrónico" valor="ana@example.com" local={local} desde={7600} reducir={reducir} />
      <span className="dc-botonSimulado" data-click={local >= 9900}>Guardar cliente <Icono nombre="flecha" /></span>
    </div>}
  </>;
  if (indice === 2) return <>
    <CabeceraVista titulo={guardado ? "Membresía de Ana Demo" : "Nueva membresía"} subtitulo="Asistencia y traslados en ambulancia." />
    {guardado ? <><Exito texto="Membresía creada · primer ciclo generado" /><div className={`tarjeta dc-ficha`}><span className="insignia insignia-activo">Activa</span><h4>Plan de ejemplo</h4><p>Ana Demo · titular y beneficiaria</p><strong>L 500.00 <small>/ mes</small></strong><div className="dc-detalle">2 traslados por ciclo · cupo compartido</div><div className="dc-pendiente">Primera mensualidad pendiente</div></div></> : <div className={`tarjeta dc-formulario`}>
      <CampoDemo etiqueta="Cliente titular" valor="Ana Demo" local={local} desde={5500} reducir={reducir} />
      <CampoDemo etiqueta="Plan" valor="Plan de ejemplo · L 500.00 / mes" local={local} desde={6300} reducir={reducir} />
      <CampoDemo etiqueta="Beneficiario" valor="Ana Demo · titular" local={local} desde={7800} reducir={reducir} />
      <span className="dc-botonSimulado" data-click={local >= 9900}>Crear membresía <Icono nombre="flecha" /></span>
    </div>}
  </>;
  if (indice === 3) return <>
    <CabeceraVista titulo="Traslado de ambulancia" subtitulo="Modalidad cubierta · Ana Demo" />
    {guardado ? <><Exito texto="Traslado programado correctamente" /><div className={`tarjeta dc-ficha`}><span className="insignia insignia-activo">Programado</span><div className="dc-recorrido"><span>●</span><div><small>ORIGEN</small><h4>Domicilio de ejemplo</h4><small>DESTINO</small><h4>Clínica de ejemplo</h4></div></div><div className="dc-detalle">AMB-01 · Conductor Demo</div><p>1 de 2 cupos reservado · sin cargo particular</p></div></> : <div className={`tarjeta dc-formulario`}>
      <CampoDemo etiqueta="Origen" valor="Domicilio de ejemplo" local={local} desde={5500} reducir={reducir} />
      <CampoDemo etiqueta="Destino" valor="Clínica de ejemplo" local={local} desde={6700} reducir={reducir} />
      <CampoDemo etiqueta="Recursos disponibles" valor="AMB-01 · Conductor Demo" local={local} desde={7900} reducir={reducir} />
      <span className="dc-botonSimulado" data-click={local >= 9900}>Programar traslado <Icono nombre="flecha" /></span>
    </div>}
  </>;
  if (indice === 4) return <>
    <CabeceraVista titulo={guardado ? "Alquileres y transportes" : "Devolver vehículo"} subtitulo="Servicios de Ana Demo · vehículos de ejemplo" />
    {guardado ? <><Exito texto="Servicios finalizados · cargos generados" /><div className="dc-tablaDemo"><div className="dc-filaCabecera"><span>Servicio</span><span>Estado</span><span>Cargo</span></div><div className="dc-fila"><strong>Alquiler ALQ-01</strong><span>Cerrado</span><strong>L 1,500.00</strong></div><div className="dc-fila"><strong>Transporte TR-01</strong><span>Completado</span><strong>L 800.00</strong></div></div><div className="dc-detalle">Cargos pendientes de cobro · recursos liberados</div></> : <div className={`tarjeta dc-formulario`}>
      <CampoDemo etiqueta="Vehículo" valor="ALQ-01 · alquiler de ejemplo" local={local} desde={5400} reducir={reducir} />
      <CampoDemo etiqueta="Kilometraje al regreso" valor="42,180 km" local={local} desde={6700} reducir={reducir} />
      <CampoDemo etiqueta="Combustible al regreso" valor="Lleno" local={local} desde={7800} reducir={reducir} />
      <span className="dc-botonSimulado" data-click={local >= 9900}>Registrar devolución <Icono nombre="flecha" /></span>
    </div>}
  </>;
  if (indice === 5) return <>
    <CabeceraVista titulo={guardado ? "Detalle del cobro" : "Registrar cobro"} subtitulo="Ana Demo · cargos pendientes: L 2,800.00" />
    {guardado ? <><Exito texto="Cobro confirmado y aplicado" /><div className={`tarjeta dc-ficha`}><span className="insignia insignia-activo">Confirmado</span><h4>Ingreso a caja</h4><strong>L 500.00</strong><p>Efectivo · Caja de ejemplo</p><div className="dc-detalle">Aplicado a la primera mensualidad</div><div className="dc-saldo"><span>Saldo pendiente del cliente</span><b>L 2,300.00</b></div></div></> : <div className={`tarjeta dc-formulario`}>
      <CampoDemo etiqueta="Importe · HNL" valor="500.00" local={local} desde={5500} reducir={reducir} />
      <CampoDemo etiqueta="Cuenta de dinero" valor="Caja de ejemplo" local={local} desde={6500} reducir={reducir} />
      <CampoDemo etiqueta="Método de pago" valor="Efectivo" local={local} desde={7700} reducir={reducir} />
      <span className="dc-botonSimulado" data-click={local >= 9900}>Confirmar cobro <Icono nombre="flecha" /></span>
    </div>}
  </>;
  return null;
}

function PanelDemo({ final, local }: { final: boolean; local: number }) {
  const listo = final || local >= 5100;
  const indicadores: { titulo: string; valor: string; icono: NombreIcono }[] = [
    { titulo: "Cobros recibidos", valor: "L 500.00", icono: "dinero" },
    { titulo: "Por cobrar", valor: "L 2,300.00", icono: "finanzas" },
    { titulo: "Membresías activas", valor: "1", icono: "membresia" },
    { titulo: "Traslados programados", valor: "1", icono: "servicios" },
  ];
  return <>
    <CabeceraVista titulo="Tu operación, de un vistazo" subtitulo={final ? "El resultado del recorrido · datos de ejemplo" : "Bienvenido a tu espacio de trabajo."} />
    <div className="dc-busqueda"><Icono nombre="buscar" /><span>Buscar un cliente, servicio o movimiento…</span><kbd>⌘ K</kbd></div>
    <div className="dc-indicadores">{indicadores.map((item, i) => <div key={item.titulo} className={`tarjeta dc-indicador`} style={{ opacity: listo || local > (i + 1) * 900 ? 1 : 0.15 }}><span className="dc-iconoIndicador"><Icono nombre={item.icono} /></span><div><span>{item.titulo}</span><strong>{final ? item.valor : "—"}</strong></div></div>)}</div>
    {final ? <><div className={`tarjeta dc-resumenFinal`}><div><Icono nombre="grafico" /><strong>Resumen financiero</strong><span>HNL</span></div><dl><div><dt>Ingresos generados</dt><dd>L 2,800.00</dd></div><div><dt>Cobros recibidos</dt><dd>L 500.00</dd></div><div><dt>Pendiente por cobrar</dt><dd>L 2,300.00</dd></div></dl><div className="dc-barraFinanciera"><span /></div><p>El ingreso y el cobro se muestran por separado.</p></div><div className="dc-modulosFinal">{["Clientes", "Membresías", "Ambulancias", "Alquileres", "Transportes", "Finanzas"].map((nombre) => <span key={nombre}>✓ {nombre}</span>)}</div></> : <div className={`tarjeta dc-inicioVacio`}><MarcaIcono className="size-12" /><h4>Todo empieza con una estructura.</h4><p>Ahora vamos a darle vida, módulo por módulo.</p><div className="dc-esqueleto"><i /><i /><i /></div></div>}
  </>;
}
