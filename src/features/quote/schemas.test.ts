import { describe, expect, it } from "vitest";

import { clientFunnelEventSchema, funnelEventSchema } from "./schemas";

describe("eventos del embudo", () => {
  const event = {
    event: "quote_started",
    step: 1,
    sessionId: "3f1c2b8e-4d5a-4c6b-8e7f-9a0b1c2d3e4f",
    locale: "es",
  } as const;

  it("el navegador reporta los pasos del cotizador", () => {
    expect(clientFunnelEventSchema.safeParse(event).success).toBe(true);
  });

  it("solo el servidor registra una cotización guardada", () => {
    const saved = { ...event, event: "quote_saved", step: 7 };
    expect(clientFunnelEventSchema.safeParse(saved).success).toBe(false);
    expect(funnelEventSchema.safeParse(saved).success).toBe(true);
  });
});
