import { describe, expect, it } from "vitest";
import { validarRegistro } from "@/lib/catalogos/validacion";
import { camposBaja, camposBien, prepararAdquisicion } from "./definiciones";

const CUENTA = "11111111-1111-4111-8111-111111111111";
const PROVEEDOR = "22222222-2222-4222-8222-222222222222";

const base = { nombre: "Camioneta", clase: "vehiculo", actividad: "general", costo: "600000.00", fecha_adquisicion: "2026-10-01" };

describe("bienes", () => {
  it("valida el formulario: un terreno puede ir sin vida útil y no admite fechas futuras", () => {
    const campos = camposBien("2026-11-04", [], [], []);
    const terreno = validarRegistro({ campos }, { ...base, clase: "terreno", forma: "existente" }, "2026-11-04");
    expect(terreno.ok).toBe(true);
    if (terreno.ok) expect(terreno.datos.vida_util_meses).toBeNull();
    const futura = validarRegistro({ campos }, { ...base, forma: "contado", fecha_adquisicion: "2026-11-05" }, "2026-11-04");
    expect(futura.ok).toBe(false);
    const vida = validarRegistro({ campos }, { ...base, forma: "contado", vida_util_meses: "0" }, "2026-11-04");
    expect(vida.ok).toBe(false);
  });

  it("contado: paga el costo completo aunque el importe quede vacío", () => {
    const r = prepararAdquisicion({ ...base, forma: "contado", pago_cuenta_dinero_id: CUENTA, pago_monto: null, pago_metodo: "transferencia" });
    expect(r).toMatchObject({ ok: true, origen: "compra", vencimiento: null, pago: { cuenta_dinero_id: CUENTA, monto: "600000.00", metodo: "transferencia" } });
  });

  it("contado: exige la caja o banco y no admite un abono parcial", () => {
    expect(prepararAdquisicion({ ...base, forma: "contado" })).toMatchObject({ ok: false, errores: { pago_cuenta_dinero_id: expect.any(String) } });
    expect(prepararAdquisicion({ ...base, forma: "contado", pago_monto: "1000.00", pago_cuenta_dinero_id: CUENTA })).toMatchObject({
      ok: false,
      errores: { pago_monto: expect.stringContaining("crédito") },
    });
  });

  it("crédito: sin pago queda todo por pagar; un abono no supera el costo", () => {
    expect(prepararAdquisicion({ ...base, forma: "credito", proveedor_id: PROVEEDOR, vencimiento: "2026-12-01" })).toMatchObject({
      ok: true,
      origen: "compra",
      proveedorId: PROVEEDOR,
      vencimiento: "2026-12-01",
      pago: null,
    });
    expect(prepararAdquisicion({ ...base, forma: "credito", pago_monto: "100000.00", pago_cuenta_dinero_id: CUENTA })).toMatchObject({
      ok: true,
      pago: { monto: "100000.00", metodo: "efectivo" },
    });
    expect(prepararAdquisicion({ ...base, forma: "credito", pago_monto: "600000.01", pago_cuenta_dinero_id: CUENTA })).toMatchObject({ ok: false });
  });

  it("ya era de la empresa: sin proveedor, vencimiento ni pago; conserva incorporación y depreciación previa", () => {
    expect(prepararAdquisicion({ ...base, forma: "existente", fecha_registro: "2026-01-01", depreciacion_previa: "120000.00" })).toMatchObject({
      ok: true,
      origen: "existente",
      fechaRegistro: "2026-01-01",
      depreciacionPrevia: "120000.00",
      pago: null,
    });
    const r = prepararAdquisicion({ ...base, forma: "existente", proveedor_id: PROVEEDOR, pago_monto: "1.00" });
    expect(r).toMatchObject({ ok: false, errores: { proveedor_id: expect.any(String), pago_monto: expect.any(String) } });
  });

  it("una compra no lleva datos de bien existente", () => {
    expect(prepararAdquisicion({ ...base, forma: "credito", depreciacion_previa: "5.00", fecha_registro: "2026-10-02" })).toMatchObject({
      ok: false,
      errores: { depreciacion_previa: expect.any(String), fecha_registro: expect.any(String) },
    });
  });

  it("la baja exige fecha y motivo", () => {
    const r = validarRegistro({ campos: camposBaja("2026-11-04") }, { fecha: "2026-11-04", motivo: "", confirmar: "on" }, "2026-11-04");
    expect(r.ok).toBe(false);
  });
});
