/**
 * What the licence costs right now.
 *
 * The launch is a **numbered founding cohort**: a fixed number of licences at
 * the launch price, then the price steps up. This is the one honest way to say
 * "sell-out" about a digital product — supply is capped because we capped it,
 * and the number shown is the real count of licences issued, read from the
 * ledger. A countdown nobody can verify is just decoration; this one is true.
 *
 * Defaults are the launch plan: 5,000 founding licences at $9, then $19.
 * Every number is env-overridable so the ladder can be changed without a
 * deploy.
 */

export interface PriceTier {
  /** "founding" while seats remain, then "standard". */
  cohort: "founding" | "standard";
  /** Price in whole USD. */
  usd: number;
  /** Display form, e.g. "$9". */
  display: string;
  /** Seats left in the founding cohort (0 once sold out). */
  seatsLeft: number;
  /** Total founding seats, for "312 of 5,000 claimed". */
  seatsTotal: number;
  /** Licences issued so far. */
  issued: number;
  /** What the next cohort pays — what the buyer is beating by acting now. */
  nextUsd: number;
}

export interface PricingConfig {
  foundingSeats: number;
  foundingUsd: number;
  standardUsd: number;
  currency: "USD";
}

export function pricingConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): PricingConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    foundingSeats: num(env.CAROUSEL_FOUNDING_SEATS, 5000),
    foundingUsd: num(env.CAROUSEL_FOUNDING_PRICE, 9),
    standardUsd: num(env.CAROUSEL_STANDARD_PRICE, 19),
    currency: "USD",
  };
}

/** The price a buyer pays right now, given how many licences exist. */
export function priceFor(issued: number, cfg: PricingConfig): PriceTier {
  const claimed = Math.max(0, Math.floor(issued));
  const seatsLeft = Math.max(0, cfg.foundingSeats - claimed);
  const founding = seatsLeft > 0;
  const usd = founding ? cfg.foundingUsd : cfg.standardUsd;
  return {
    cohort: founding ? "founding" : "standard",
    usd,
    display: `$${usd}`,
    seatsLeft,
    seatsTotal: cfg.foundingSeats,
    issued: claimed,
    nextUsd: cfg.standardUsd,
  };
}

/** The line under the price — true statements only. */
export function priceCaption(tier: PriceTier): string {
  if (tier.cohort === "founding") {
    const after = tier.nextUsd > tier.usd ? ` After that it's $${tier.nextUsd}.` : "";
    return `${tier.issued.toLocaleString()} of ${tier.seatsTotal.toLocaleString()} founding licences claimed.${after}`;
  }
  return "The founding cohort sold out. One payment, yours forever.";
}
