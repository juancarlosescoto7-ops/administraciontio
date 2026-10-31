import type { Campo } from "@/lib/catalogos/definiciones";

export const CAMPO_FECHA_FIN: Campo = {
  nombre: "fecha_fin", etiqueta: "Fecha de vencimiento del contrato", tipo: "fecha",
  ayuda: "La fija el dueño. Debe ser el último día de un período mensual; después no hay cobertura ni nuevas cuotas.",
};
export const camposVencimiento: Campo[] = [
  { ...CAMPO_FECHA_FIN, requerido: true },
  { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 },
];
