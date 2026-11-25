import type { Home, Lot } from "./types";

/**
 * Plan de pagos SUGERIDO que se muestra en la ficha de una casa o terreno. Es orientativo:
 * el plan real va en el contrato. Montos redondeados a $1.
 *
 * EJEMPLO: los montos de apartado son valores de ejemplo y pasarán a ajustes en la Fase 2.
 */
export const RESERVATION_DEPOSIT_USD_CENTS = { home: 50_000, lot: 30_000 } as const;

export type SuggestedPaymentKey = "reservation" | "initial" | "construction" | "deed";
export type SuggestedPayment = { key: SuggestedPaymentKey; amountUsdCents: number };

const toDollar = (cents: number) => Math.round(cents / 100) * 100;

export function suggestedHomePlan(
  home: Pick<Home, "priceUsdCents" | "constructionStatus">,
  initialPercent: number,
) {
  const price = home.priceUsdCents;
  const reservation = Math.min(RESERVATION_DEPOSIT_USD_CENTS.home, price);
  const initial = Math.max(toDollar((price * initialPercent) / 100) - reservation, 0);
  const plan: SuggestedPayment[] = [
    { key: "reservation", amountUsdCents: reservation },
    { key: "initial", amountUsdCents: initial },
  ];
  if (home.constructionStatus === "ready") {
    plan.push({ key: "deed", amountUsdCents: price - reservation - initial });
  } else {
    const construction = toDollar(price * 0.5);
    plan.push(
      { key: "construction", amountUsdCents: construction },
      { key: "deed", amountUsdCents: price - reservation - initial - construction },
    );
  }
  return plan;
}

export function suggestedLotPlan(lot: Pick<Lot, "priceUsdCents">) {
  const price = lot.priceUsdCents;
  const reservation = Math.min(RESERVATION_DEPOSIT_USD_CENTS.lot, price);
  const initial = Math.max(toDollar(price * 0.3) - reservation, 0);
  return [
    { key: "reservation", amountUsdCents: reservation },
    { key: "initial", amountUsdCents: initial },
    { key: "deed", amountUsdCents: price - reservation - initial },
  ] satisfies SuggestedPayment[];
}
