import { describe, expect, it } from "vitest";
import { puede } from "@/lib/auth/roles";
import { validarRegistro } from "@/lib/catalogos/validacion";
import { camposAltaMembresia, camposEditarCondiciones, describirActualizacion } from "./definiciones";
import { periodosDesde, siguienteRenovacion, sumarDias } from "./fechas";

/** Serie de inicios de período desde una fecha (día de anclaje = su día). */
function serie(inicio: string, cantidad: number): string[] {
  return periodosDesde(inicio, cantidad).map((p) => p.inicio);
}

describe("renovaciones ancladas al día original (espejo de private.siguiente_renovacion)", () => {
  it("31 de enero: fin de mes cuando el día no existe y vuelve al 31", () => {
    expect(serie("2026-01-31", 6)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30"]);
  });

  it("años bisiestos", () => {
    expect(serie("2023-12-31", 4)).toEqual(["2023-12-31", "2024-01-31", "2024-02-29", "2024-03-31"]);
    expect(serie("2024-01-29", 3)).toEqual(["2024-01-29", "2024-02-29", "2024-03-29"]);
    expect(serie("2024-01-30", 3)).toEqual(["2024-01-30", "2024-02-29", "2024-03-30"]);
  });

  it("días 28, 29 y 30 en año no bisiesto", () => {
    expect(serie("2026-01-28", 3)).toEqual(["2026-01-28", "2026-02-28", "2026-03-28"]);
    expect(serie("2026-01-29", 3)).toEqual(["2026-01-29", "2026-02-28", "2026-03-29"]);
    expect(serie("2026-01-30", 3)).toEqual(["2026-01-30", "2026-02-28", "2026-03-30"]);
  });

  it("no usa el día ajustado como nuevo anclaje y cruza el año", () => {
    expect(siguienteRenovacion("2026-02-28", 31)).toBe("2026-03-31");
    expect(siguienteRenovacion("2026-12-31", 31)).toBe("2027-01-31");
  });

  it("cada período termina el día anterior al siguiente", () => {
    expect(periodosDesde("2026-01-31", 2)).toEqual([
      { inicio: "2026-01-31", fin: "2026-02-27" },
      { inicio: "2026-02-28", fin: "2026-03-30" },
    ]);
    expect(sumarDias("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("permisos de membresías (espejo de las funciones SQL)", () => {
  it("administrador y operador registran; finanzas no", () => {
    expect(puede("registrarMembresia", "administrador")).toBe(true);
    expect(puede("registrarMembresia", "operador")).toBe(true);
    expect(puede("registrarMembresia", "finanzas")).toBe(false);
  });

  it("solo el administrador gestiona condiciones y cancela", () => {
    expect(puede("gestionarMembresia", "administrador")).toBe(true);
    expect(puede("gestionarMembresia", "operador")).toBe(false);
    expect(puede("gestionarMembresia", "finanzas")).toBe(false);
  });

  it("los tres roles actualizan mensualidades y registran cobros", () => {
    for (const rol of ["administrador", "operador", "finanzas"] as const) {
      expect(puede("actualizarMensualidades", rol)).toBe(true);
      expect(puede("registrarCobro", rol)).toBe(true);
    }
  });
});

describe("formularios de membresías", () => {
  const beneficiarios = [{ id: "11111111-1111-4111-8111-111111111111", nombre: "Ana", detalle: null }];

  it("el operador no recibe campos de condiciones particulares", () => {
    const nombres = (administrador: boolean) => camposAltaMembresia(beneficiarios, administrador).map((c) => c.nombre);
    expect(nombres(false)).not.toContain("precio");
    expect(nombres(true)).toEqual(expect.arrayContaining(["precio", "cupo", "modalidad", "dias_gracia"]));
  });

  it("las condiciones particulares son opcionales en el alta", () => {
    const campos = camposAltaMembresia(beneficiarios, true);
    const resultado = validarRegistro({ campos }, { confirmar: "on", [`beneficiario_${beneficiarios[0].id}`]: "on" });
    expect(resultado.ok).toBe(true);
  });

  it("editar condiciones exige todas y un motivo; precio 0 es válido", () => {
    const campos = camposEditarCondiciones();
    expect(validarRegistro({ campos }, { precio: "0", cupo: "2", modalidad: "individual", dias_gracia: "5", motivo: "x" }).ok).toBe(true);
    const sinMotivo = validarRegistro({ campos }, { precio: "500", cupo: "2", modalidad: "individual", dias_gracia: "5", motivo: "" });
    expect(sinMotivo.ok).toBe(false);
    const negativo = validarRegistro({ campos }, { precio: "500", cupo: "-1", modalidad: "otra", dias_gracia: "5", motivo: "x" });
    expect(negativo.ok ? {} : negativo.errores).toMatchObject({ cupo: expect.any(String), modalidad: expect.any(String) });
  });

  it("resume la actualización de mensualidades", () => {
    expect(describirActualizacion({ periodos: 1, suspendidas: 0, reactivadas: 0 })).toBe("Mensualidades al día: 1 mensualidad generada.");
    expect(describirActualizacion({ periodos: 2, suspendidas: 1, reactivadas: 1 })).toContain("1 suspendida(s) por morosidad, 1 reactivada(s)");
  });
});
