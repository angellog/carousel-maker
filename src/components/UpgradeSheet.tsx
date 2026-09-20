"use client";

import Sheet from "./Sheet";
import { PLANS, upsellFor, type Feature, type PlanId } from "@/lib/plan";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The feature that triggered the sheet, for a targeted headline. */
  context?: Feature;
  plan: PlanId;
  /** Unlock Pro on this device (billing is wired separately — see PRODUCT.md). */
  onUnlock: () => void;
  onDowngrade: () => void;
}

export default function UpgradeSheet({ open, onClose, context, plan, onUnlock, onDowngrade }: Props) {
  const pro = PLANS.pro;
  const free = PLANS.free;
  const isPro = plan === "pro";

  return (
    <Sheet open={open} title={isPro ? "You're on Pro" : "Upgrade to Pro"} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-1">
        {context && !isPro && (
          <p className="rounded-[var(--r-md)] bg-[var(--color-brand-wash)] px-3 py-2.5 text-sm text-[var(--color-text)]">
            {upsellFor(context)}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3">
          <PlanCard
            title={pro.name}
            price={pro.price}
            tagline={pro.tagline}
            perks={pro.perks}
            highlight
          />
          <PlanCard title={free.name} price={free.price} tagline={free.tagline} perks={free.perks} />
        </div>

        {isPro ? (
          <button className="btn w-full" onClick={onDowngrade}>
            Switch back to Free
          </button>
        ) : (
          <button className="btn btn-primary w-full" onClick={onUnlock}>
            Start Pro
          </button>
        )}

        <p className="text-[11px] leading-relaxed text-[var(--color-dim)]">
          {isPro
            ? "Pro is active on this device."
            : "Billing isn't connected in this build, so Start Pro unlocks everything on this device so you can try it. See docs/PRODUCT.md for wiring Stripe + accounts."}
        </p>
      </div>
    </Sheet>
  );
}

function PlanCard({
  title,
  price,
  tagline,
  perks,
  highlight,
}: {
  title: string;
  price: string;
  tagline: string;
  perks: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className="card p-4"
      style={highlight ? { borderColor: "var(--color-brand)", boxShadow: "var(--shadow-2)" } : undefined}
    >
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-base font-semibold">
          {title}
          {highlight && <span className="badge badge-pro">PRO</span>}
        </span>
        <span className="tnum text-sm text-[var(--color-dim)]">{price}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-[var(--color-dim)]">{tagline}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm">
            <span aria-hidden style={{ color: "var(--color-brand-strong)" }}>✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
