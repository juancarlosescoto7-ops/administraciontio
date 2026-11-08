import { beforeEach, describe, expect, it, vi } from "vitest";
import { estadoInicial } from "@/lib/catalogos/estado";
import { aplicarSaldo } from "./acciones";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), usuario: vi.fn(), revalidar: vi.fn(), redirigir: vi.fn() }));
vi.mock("@/lib/auth/sesion", () => ({ usuarioActivoOpcional: mocks.usuario }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidar }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirigir }));

const cargo = "12345678-1234-4234-8234-123456789abc";
const cliente = "22345678-1234-4234-8234-123456789abc";
const clave = "32345678-1234-4234-8234-123456789abc";
const traslado = "42345678-1234-4234-8234-123456789abc";
function formulario(monto = "500.00") {
  const form = new FormData();
  form.set("idempotencia", clave);
  form.set("monto", monto);
  return form;
}

describe("aplicar saldo a favor desde la pregunta automática", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.usuario.mockResolvedValue({ id: "operador", rol: "operador" });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { cliente_id: cliente } }) }) }) });
    mocks.redirigir.mockImplementation(() => { throw new Error("REDIRECT"); });
  });

  it("aplica el importe confirmado y vuelve a la página que preguntó", async () => {
    await expect(aplicarSaldo(cargo, `/ambulancias/${traslado}`, estadoInicial({}), formulario())).rejects.toThrow("REDIRECT");
    expect(mocks.rpc.mock.calls).toEqual([
      ["aplicar_saldo_a_favor", { p_idempotencia: clave, p_cargo_id: cargo, p_monto: "500.00" }],
      ["actualizar_mensualidades", { p_cliente_id: cliente }],
    ]);
    expect(mocks.redirigir).toHaveBeenCalledWith(`/ambulancias/${traslado}?aplicado=1`);
  });

  it("desde el detalle del cargo vuelve al cargo", async () => {
    await expect(aplicarSaldo(cargo, `/finanzas/cargos/${cargo}`, estadoInicial({}), formulario())).rejects.toThrow("REDIRECT");
    expect(mocks.redirigir).toHaveBeenCalledWith(`/finanzas/cargos/${cargo}?aplicado=1`);
  });

  it.each(["https://ejemplo.com", "//ejemplo.com/x", "/finanzas/gastos/nuevo", `/ambulancias/${traslado}?x=1`, ""])(
    "rechaza el destino %j sin tocar la base",
    async (volver) => {
      const estado = await aplicarSaldo(cargo, volver, estadoInicial({}), formulario());
      expect(estado.error).toBe("Operación no válida.");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.redirigir).not.toHaveBeenCalled();
    },
  );

  it("si la base rechaza el importe, no redirige y la ventana muestra el error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "El importe supera el saldo a favor." } });
    const estado = await aplicarSaldo(cargo, `/membresias/${traslado}`, estadoInicial({}), formulario("9999.00"));
    expect(estado.error).toBe("El importe supera el saldo a favor.");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.redirigir).not.toHaveBeenCalled();
  });
});
