import { beforeEach, describe, expect, it, vi } from "vitest";
import { estadoInicial } from "@/lib/catalogos/estado";
import { registrarCobro } from "./acciones";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), usuario: vi.fn(), revalidar: vi.fn(), redirigir: vi.fn() }));
vi.mock("@/lib/auth/sesion", () => ({ usuarioActivoOpcional: mocks.usuario }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirigir }));

const cliente = "12345678-1234-4234-8234-123456789abc";
const cuenta = "22345678-1234-4234-8234-123456789abc";
const clave = "32345678-1234-4234-8234-123456789abc";
const cobro = "42345678-1234-4234-8234-123456789abc";
function formulario() {
  const form = new FormData();
  for (const [nombre, valor] of Object.entries({ idempotencia: clave, cuenta_dinero_id: cuenta, fecha: "2026-01-01", metodo: "efectivo", monto: "1200.00", referencia: "" })) form.set(nombre, valor);
  return form;
}

describe("registro de cobros con aplicación automática", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.usuario.mockResolvedValue({ id: "operador", rol: "operador" });
    mocks.rpc.mockResolvedValue({ data: cobro, error: null });
    mocks.redirigir.mockImplementation(() => { throw new Error("REDIRECT"); });
  });

  it("registra solo el importe y actualiza membresías tras confirmar el cobro", async () => {
    const form = formulario();
    form.set(`aplicar_${cliente}`, "999999.00"); // Un campo inyectado no decide la distribución.
    await expect(registrarCobro(cliente, estadoInicial({}), form)).rejects.toThrow("REDIRECT");
    expect(mocks.rpc.mock.calls).toEqual([
      ["registrar_cobro_automatico", { p_idempotencia: clave, p_cliente_id: cliente, p_cuenta_dinero_id: cuenta, p_fecha: "2026-01-01", p_metodo: "efectivo", p_monto: "1200.00", p_referencia: null }],
      ["actualizar_mensualidades", { p_cliente_id: cliente }],
    ]);
    expect(mocks.revalidar).toHaveBeenCalledWith("/", "layout");
    expect(mocks.redirigir).toHaveBeenCalledWith(`/finanzas/cobros/${cobro}?guardado=1`);
  });

  it("sin sesión no envía un cobro a la base", async () => {
    mocks.usuario.mockResolvedValue(null);
    const estado = await registrarCobro(cliente, estadoInicial({}), formulario());
    expect(estado.error).toContain("sesión expiró");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("importe inválido no llega a la base", async () => {
    const form = formulario();
    form.set("monto", "no-es-un-importe");
    const estado = await registrarCobro(cliente, estadoInicial({}), form);
    expect(estado.errores.monto).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("si falla el cobro no reactiva membresías ni redirige y conserva el monto", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Cuenta inactiva." } });
    const estado = await registrarCobro(cliente, estadoInicial({}), formulario());
    expect(estado.error).toBe("Cuenta inactiva.");
    expect(estado.valores.monto).toBe("1200.00");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.redirigir).not.toHaveBeenCalled();
  });
});
