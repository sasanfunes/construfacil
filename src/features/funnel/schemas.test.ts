import { describe, expect, it } from "vitest";

import { clientFunnelEventSchema, funnelEventSchema } from "./schemas";

describe("eventos del embudo", () => {
  const event = {
    event: "project_started",
    step: 1,
    sessionId: "3f1c2b8e-4d5a-4c6b-8e7f-9a0b1c2d3e4f",
    locale: "es",
  } as const;

  it("el navegador reporta los pasos del onboarding", () => {
    expect(clientFunnelEventSchema.safeParse(event).success).toBe(true);
    expect(
      clientFunnelEventSchema.safeParse({ ...event, event: "calculator_used", step: null }).success,
    ).toBe(true);
  });

  it("solo el servidor registra un proyecto guardado", () => {
    const saved = { ...event, event: "project_saved", step: 9 };
    expect(clientFunnelEventSchema.safeParse(saved).success).toBe(false);
    expect(funnelEventSchema.safeParse(saved).success).toBe(true);
  });

  it("rechaza eventos inventados", () => {
    expect(funnelEventSchema.safeParse({ ...event, event: "quote_saved" }).success).toBe(false);
  });
});
