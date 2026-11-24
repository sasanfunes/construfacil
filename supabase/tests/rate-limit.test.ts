import { describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, service, user } from "./helpers";

type Result = { allowed: boolean; remaining: number; reset_at: Date };

const hit = (bucket: string, limit: number, windowSeconds = 3600) =>
  as(
    service,
    async (db) =>
      (
        await db.query<Result>("select * from public.check_rate_limit($1, $2, $3)", [
          bucket,
          limit,
          windowSeconds,
        ])
      ).rows[0]!,
    { commit: true },
  );

describe("rate limiting", () => {
  it("permite hasta el límite y luego bloquea", async () => {
    const bucket = `test:${crypto.randomUUID()}`;
    expect(await hit(bucket, 3)).toMatchObject({ allowed: true, remaining: 2 });
    expect(await hit(bucket, 3)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await hit(bucket, 3)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await hit(bucket, 3)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("cada bucket lleva su propia cuenta", async () => {
    const a = `test:${crypto.randomUUID()}`;
    const b = `test:${crypto.randomUUID()}`;
    await hit(a, 1);
    expect(await hit(a, 1)).toMatchObject({ allowed: false });
    expect(await hit(b, 1)).toMatchObject({ allowed: true });
  });

  it("informa cuándo se reinicia la ventana", async () => {
    const result = await hit(`test:${crypto.randomUUID()}`, 5, 60);
    const msUntilReset = result.reset_at.getTime() - Date.now();
    expect(msUntilReset).toBeGreaterThan(0);
    expect(msUntilReset).toBeLessThanOrEqual(60_000);
  });

  it("rechaza parámetros inválidos", async () => {
    expect(await errorCode(service, "select * from public.check_rate_limit('x', 0, 60)")).toBe("22023");
    expect(await errorCode(service, "select * from public.check_rate_limit('', 5, 60)")).toBe("22023");
    expect(await errorCode(service, "select * from public.check_rate_limit('x', 5, 999999)")).toBe("22023");
  });

  it("solo el servidor puede usarlo: ni visitantes ni usuarios con sesión", async () => {
    const cliente = await createUser("cliente");
    const admin = await createUser("admin");
    for (const actor of [anon, user(cliente), user(admin)]) {
      expect(await errorCode(actor, "select * from public.check_rate_limit('x', 5, 60)")).toBe(DENIED);
      expect(await errorCode(actor, "select * from public.rate_limits")).toBe(DENIED);
      expect(await errorCode(actor, "delete from public.rate_limits")).toBe(DENIED);
    }
  });
});
