"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/BrandMark";
import { storeLicense } from "@/lib/useAccess";

/**
 * Where Flutterwave sends a buyer back to.
 *
 * The page does one job and does it carefully: swap the transaction reference
 * for a licence, store it on this device, and — this is the part people get
 * wrong — show the key itself, big, with a copy button and an instruction to
 * keep it. A one-time purchase with no account means the key *is* the
 * receipt; if the email fails and the page didn't show it, the buyer has paid
 * for nothing they can hold.
 */
export default function UnlockPage() {
  return (
    <Suspense fallback={<Shell><p className="text-sm text-[var(--color-dim)]">Loading…</p></Shell>}>
      <Unlock />
    </Suspense>
  );
}

function Unlock() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"working" | "done" | "failed">("working");
  const [token, setToken] = useState("");
  const [seat, setSeat] = useState<number | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ran = useRef(false);

  const transactionId = params.get("transaction_id") ?? params.get("transactionId");
  const flwStatus = params.get("status");

  const redeem = useCallback(async () => {
    if (!transactionId) {
      setStatus("failed");
      setError(
        flwStatus === "cancelled"
          ? "The payment was cancelled — nothing was charged."
          : "This page needs a payment reference. If you've paid, check your email for the licence key.",
      );
      return;
    }
    try {
      const res = await fetch("/api/license/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const body = (await res.json()) as { token?: string; seat?: number; emailed?: boolean; error?: string };
      if (!res.ok || !body.token) {
        setStatus("failed");
        setError(body.error ?? "We couldn't confirm that payment.");
        return;
      }
      storeLicense(body.token);
      setToken(body.token);
      setSeat(body.seat ?? null);
      setEmailed(!!body.emailed);
      setStatus("done");
    } catch {
      setStatus("failed");
      setError("We couldn't reach the server. Your payment is safe — reload this page to retry.");
    }
  }, [transactionId, flwStatus]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void redeem();
  }, [redeem]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (status === "working") {
    return (
      <Shell>
        <h1 className="display text-[26px]">Confirming your payment…</h1>
        <p className="text-sm text-[var(--color-dim)]">This takes a second. Don&apos;t close the tab.</p>
      </Shell>
    );
  }

  if (status === "failed") {
    return (
      <Shell>
        <h1 className="display text-[26px]">That didn&apos;t go through</h1>
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
        <p className="text-sm text-[var(--color-dim)]">
          If you were charged, nothing is lost — reply to your Flutterwave receipt and we&apos;ll
          issue the licence by hand.
        </p>
        <Link className="btn btn-primary w-full" href="/">
          Back to the app
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="display text-[26px]">You&apos;re licence #{seat}</h1>
      <p className="text-sm text-[var(--color-dim)]">
        The cap is off on this device already. Save this key — it unlocks any other device you
        paste it into, and it never expires.
      </p>

      <div className="card flex flex-col gap-2 p-3">
        <span className="eyebrow">Your licence key</span>
        <code className="break-all font-[family-name:var(--font-mono)] text-[12px] leading-relaxed">
          {token}
        </code>
        <button className="btn btn-brand w-full" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy key"}
        </button>
      </div>

      <p className="text-sm text-[var(--color-dim)]">
        {emailed
          ? "A copy is on its way to your inbox."
          : "Copy it somewhere safe now — we couldn't email it automatically."}
      </p>

      <Link className="btn btn-primary w-full" href="/">
        Start making carousels
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-4 px-4 py-10">
      <Wordmark />
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </main>
  );
}
