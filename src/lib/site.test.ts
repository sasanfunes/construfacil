import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl } from "./site";

describe("buildWhatsAppUrl", () => {
  it("arma el enlace con el mensaje codificado", () => {
    expect(buildWhatsAppUrl("50499998888", "Hola, ¿me cotizan una casa?")).toBe(
      "https://wa.me/50499998888?text=Hola%2C+%C2%BFme+cotizan+una+casa%3F",
    );
  });

  it("limpia espacios, guiones y el signo más del número", () => {
    expect(buildWhatsAppUrl("+504 9999-8888")).toBe("https://wa.me/50499998888");
  });
});
