"use client";

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { PLANS, upsellFor, type Feature } from "@/lib/plan";
import type { AccessState } from "@/lib/access/types";
import { priceCaption, SCARCITY_THRESHOLD } from "@/lib/access/pricing";

interface Props {
  open: boolean;
  onClose: () => void;
  /** What prompted the sheet, for a headline that answers the real question. */
  context?: Feature;
  state: AccessState | null;
  onApplyLicense: (token: string) => Promise<void> | void;
  onClearLicense: () => Promise<void> | void;
  flash: (message: string) => void;
}

/**
 * The only paid surface in the app.
 *
 * It sells one thing — the cap coming off — and says so plainly. Everything
 * else in the product is free, so there is nothing here to be coy about: the
 * price, the number of founding licences left and what happens when they run
 * out are all stated as facts, because they are.
 */
export default function LicenseSheet({
  open,
  onClose,
  context,
  state,
  onApplyLicense,
  onClearLicense,
  flash,
}: Props) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState<"checkout" | "unlock" | "dev" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const licensed = state?.plan === "maker";
  const price = state?.price;
  const maker = PLANS.maker;

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(null);
    }
  }, [open]);

  const buy = async () => {
    setError(null);
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter the email your licence key should go to.");
      return;
    }
    setBusy("checkout");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json()) as { link?: string; error?: string };
      if (!res.ok || !body.link) {
        setError(body.error ?? "Checkout couldn't start. Try again in a moment.");
        return;
      }
      window.location.href = body.link;
    } catch {
      setError("Checkout couldn't start. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const unlock = async () => {
    setError(null);
    const candidate = token.trim();
    if (!candidate) {
      setError("Paste the licence key from your receipt.");
      return;
    }
    setBusy("unlock");
    try {
      const res = await fetch("/api/license/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: candidate }),
      });
      const body = (await res.json()) as { ok?: boolean; seat?: number; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "That licence key isn't valid.");
        return;
      }
      await onApplyLicense(candidate);
      setToken("");
      setShowPaste(false);
      flash(`Licence #${body.seat} active. The cap is off.`);
      onClose();
    } catch {
      setError("Couldn't check that key. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  // Development only: exercises the whole licensed experience before
  // Flutterwave keys exist. The server refuses it unless CAROUSEL_LICENSE_DEV_UNLOCK=1.
  const devUnlock = async () => {
    setBusy("dev");
    setError(null);
    try {
      const res = await fetch("/api/license/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dev: true, email: email.trim() || "dev@localhost" }),
      });
      const body = (await res.json()) as { token?: string; seat?: number; error?: string };
      if (!res.ok || !body.token) {
        setError(body.error ?? "Dev unlock is disabled on this server.");
        return;
      }
      await onApplyLicense(body.token);
      flash(`Dev licence #${body.seat} active.`);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={open}
      title={licensed ? "You're licensed" : "Go unlimited"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 pb-1">
        {licensed ? (
          <>
            <p className="rounded-[var(--r-md)] bg-[var(--color-brand-wash)] px-3 py-2.5 text-sm">
              Licence <strong>#{state?.license?.seat}</strong>
              {state?.license?.email ? ` · ${state.license.email}` : ""}. No cap, no subscription,
              nothing to renew.
            </p>
            {state && state.hosted.limit > 0 && !state.hosted.unlimited && (
              <p className="text-sm text-[var(--color-dim)]">
                {state.hosted.remaining} of {state.hosted.limit} carousels left on our engine{" "}
                {state.hosted.period}. Your own API key is always unlimited — add it under
                Options → API key.
              </p>
            )}
            <button className="btn w-full" onClick={() => void onClearLicense()}>
              Remove this licence from this device
            </button>
          </>
        ) : (
          <>
            {context && (
              <p className="rounded-[var(--r-md)] bg-[var(--color-brand-wash)] px-3 py-2.5 text-sm text-[var(--color-text)]">
                {upsellFor(context)}
              </p>
            )}

            <div className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="display text-[22px]">{maker.name}</span>
                <span className="display text-[28px]">{price?.display ?? maker.price}</span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-dim)]">{maker.tagline}</p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {maker.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span aria-hidden className="text-[var(--color-brand-strong)]">✓</span>
                    {perk}
                  </li>
                ))}
              </ul>
              {price && (
                <p
                  className={`mt-3 text-[11px] leading-relaxed ${
                    price.cohort === "founding" && price.seatsLeft <= SCARCITY_THRESHOLD
                      ? "text-[var(--color-brand-strong)]"
                      : "text-[var(--color-dim)]"
                  }`}
                >
                  {priceCaption(price)}
                </p>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Where should your licence key go?</span>
              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <button className="btn btn-primary w-full" disabled={busy !== null} onClick={() => void buy()}>
              {busy === "checkout" ? "Opening checkout…" : `Get the licence — ${price?.display ?? maker.price}`}
            </button>

            {showPaste ? (
              <div className="flex flex-col gap-2">
                <label className="eyebrow" htmlFor="licence-key">
                  Licence key
                </label>
                <textarea
                  id="licence-key"
                  className="field font-[family-name:var(--font-mono)] text-[12px]"
                  rows={3}
                  placeholder="cm1.…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button className="btn btn-brand w-full" disabled={busy !== null} onClick={() => void unlock()}>
                  {busy === "unlock" ? "Checking…" : "Unlock this device"}
                </button>
              </div>
            ) : (
              <button className="text-sm underline underline-offset-2" onClick={() => setShowPaste(true)}>
                I already have a licence
              </button>
            )}

            {process.env.NODE_ENV !== "production" && (
              <button className="btn w-full" disabled={busy !== null} onClick={() => void devUnlock()}>
                {busy === "dev" ? "Unlocking…" : "Dev unlock (local only)"}
              </button>
            )}
          </>
        )}

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <p className="text-[11px] leading-relaxed text-[var(--color-dim)]">
          Every feature is free — every template, every voice, Match a look and Brand Kit. The
          licence only lifts the weekly cap, and it&apos;s one payment, not a subscription.
        </p>
      </div>
    </Sheet>
  );
}
