// Todo se deriva del reloj; buscar y reiniciar deshacen los datos ficticios.
export const DURACION_TOTAL = 72_000;
export function progreso(tiempo: number, inicio: number, duracion: number) {
  return Math.max(0, Math.min(1, (tiempo - inicio) / duracion));
}
export function estadoVisual(tiempo: number) {
  const fase = tiempo < 5000 ? "html" : tiempo < 10000 ? "layout" : tiempo < 15000 ? "tipo" : tiempo < 20000 ? "color" : "movimiento";
  const pantalla = tiempo < 27000 || tiempo >= 63000 ? "inicio" : tiempo < 39000 ? "clientes" : tiempo < 51000 ? "membresias" : "cobros";
  const modal = tiempo >= 29500 && tiempo < 36000 ? "cliente" : tiempo >= 41500 && tiempo < 48000 ? "membresia" : tiempo >= 53500 && tiempo < 60000 ? "cobro" : null;
  const guardado = tiempo >= 36000 && tiempo < 39000 ? "Cliente guardado" : tiempo >= 48000 && tiempo < 51000 ? "Membresía creada" : tiempo >= 60000 && tiempo < 63000 ? "Cobro registrado" : null;
  return { fase, pantalla, modal, guardado, clienteCreado: tiempo >= 36000, membresiaCreada: tiempo >= 48000, cobroCreado: tiempo >= 60000 };
}
export const RECORRIDO = [
  { en: 24000, destino: "inicio" },
  { en: 26700, destino: "clientes", clic: true },
  { en: 29000, destino: "nuevo", clic: true },
  { en: 30300, destino: "campo-0" },
  { en: 32000, destino: "campo-1" },
  { en: 34000, destino: "campo-2" },
  { en: 35700, destino: "guardar", clic: true },
  { en: 38700, destino: "membresias", clic: true },
  { en: 41000, destino: "nuevo", clic: true },
  { en: 42300, destino: "campo-0" },
  { en: 44000, destino: "campo-1" },
  { en: 45800, destino: "campo-2" },
  { en: 47700, destino: "guardar", clic: true },
  { en: 50700, destino: "cobros", clic: true },
  { en: 53000, destino: "nuevo", clic: true },
  { en: 54300, destino: "campo-0" },
  { en: 56000, destino: "campo-1" },
  { en: 57800, destino: "campo-2" },
  { en: 59700, destino: "guardar", clic: true },
  { en: 62700, destino: "inicio", clic: true },
] as const;
export function reloj(ms: number) {
  const segundos = Math.floor(ms / 1000);
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}
