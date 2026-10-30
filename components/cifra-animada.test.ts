import { describe, expect, it } from "vitest";
import { partirCifra } from "./cifra-animada";

describe("cifras animadas", () => {
  it("separa prefijo, número, decimales y sufijo", () => {
    expect(partirCifra("L 1,300.50")).toEqual({ antes: "L ", numero: 1300.5, decimales: 2, despues: "" });
    expect(partirCifra("12")).toEqual({ antes: "", numero: 12, decimales: 0, despues: "" });
    expect(partirCifra("3 en curso")).toEqual({ antes: "", numero: 3, decimales: 0, despues: " en curso" });
  });

  it("no anima textos sin número", () => {
    expect(partirCifra("No disponible")).toBeNull();
  });
});
