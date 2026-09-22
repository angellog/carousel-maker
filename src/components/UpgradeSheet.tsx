"use client";

import Sheet from "./Sheet";
import { PLANS, PLAN_ORDER, upsellFor, type Feature, type PlanId } from "@/lib/plan";

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
  const isPaid = plan !== "free";
  const current = PLANS[plan] ?? PLANS.free;

  return (
    <Sheet open={open} title={isPaid ? `You're on ${current.name}` : "Choose your plan"} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-1">
        {context && !isPaid && (
          <p className="rounded-[var(--r-md)] bg-[var(--color-brand-wash)] px-3 py-2.5 text-sm text-[var(--color-text)]">
            {upsellFor(context)}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            return (
              <PlanCard
                key={id}
                title={p.name}
                price={p.price}
                tagline={p.tagline}
                perks={p.perks}
                highlight={id === "pro"}
                current={id === plan}
              />
            );
          })}
        </div>

        {isPaid ? (
          <button className="btn w-full" onClick={onDowngrade}>
            Switch back to Free
          </button>
        ) : (
          <button className="btn btn-primary w-full" onClick={onUnlock}>
            Try Pro on this device
          </button>
        )}

        <p className="text-[11px] leading-relaxed text-[var(--color-dim)]">
          {isPaid
            ? `${current.name} is active on this device.`
            : "Paid checkout (Flutterwave) isn't live yet — this unlocks Pro on this device so you can try everything. See docs/launch-readiness.md."}
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
  current,
}: {
  title: string;
  price: string;
  tagline: string;
  perks: string[];
  highlight?: boolean;
  current?: boolean;
}) {
  return (
    <div
      className="card p-4"
      style={
        current
          ? { borderColor: "var(--color-brand-strong)", boxShadow: "var(--shadow-2)" }
          : highlight
            ? { borderColor: "var(--color-brand)", boxShadow: "var(--shadow-2)" }
            : undefined
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-base font-semibold">
          {title}
          {highlight && <span className="badge badge-pro">POPULAR</span>}
          {current && <span className="badge">Current</span>}
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
