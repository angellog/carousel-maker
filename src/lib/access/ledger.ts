/**
 * The licence ledger — the only state a one-time product actually needs.
 *
 * It answers two questions:
 *   1. **How many licences exist?** — which is what makes the founding-cohort
 *      counter a fact rather than a marketing flourish.
 *   2. **Have we already issued one for this payment?** — webhooks retry, and
 *      buyers refresh the callback page; without idempotency a single $9 could
 *      mint a dozen licences and burn a dozen seats.
 *
 * Two implementations, both tiny: in-memory (fine for dev and for a single
 * instance that can tolerate a restarted counter) and file-backed, which is
 * what production uses — a JSON-lines file on the Railway volume. Append-only,
 * flushed on write, and cheap to read at boot. When Postgres eventually lands,
 * it implements this same three-method interface.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { License } from "./license";

export interface LedgerEntry {
  id: string;
  seat: number;
  email: string;
  iat: number;
  txId?: string;
  amountUsd?: number;
}

export interface LicenseLedger {
  /** How many licences have been issued. */
  issued(): number;
  /** The entry for a payment, if one was already issued for it. */
  findByTx(txId: string): LedgerEntry | undefined;
  /** Append an issued licence. Returns the entry as recorded. */
  record(entry: LedgerEntry): LedgerEntry;
}

export class MemoryLedger implements LicenseLedger {
  protected entries: LedgerEntry[] = [];

  issued(): number {
    return this.entries.length;
  }

  findByTx(txId: string): LedgerEntry | undefined {
    return this.entries.find((e) => e.txId && e.txId === txId);
  }

  record(entry: LedgerEntry): LedgerEntry {
    this.entries.push(entry);
    return entry;
  }

  /** Test/inspection helper. */
  all(): readonly LedgerEntry[] {
    return this.entries;
  }
}

/**
 * JSON-lines file ledger. One line per licence, appended with `fsync`-ish
 * semantics (`appendFileSync`), so a crash can lose at most the line being
 * written — and the payment provider's own record is the backstop for that.
 */
export class FileLedger extends MemoryLedger {
  constructor(private readonly path: string) {
    super();
    this.load();
  }

  private load() {
    try {
      if (!existsSync(this.path)) return;
      for (const line of readFileSync(this.path, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          this.entries.push(JSON.parse(trimmed) as LedgerEntry);
        } catch {
          // A torn last line is survivable; skip it rather than refusing to boot.
        }
      }
    } catch {
      // An unreadable ledger must not take the app down: the counter starts at
      // zero and the file is repaired out of band.
    }
  }

  record(entry: LedgerEntry): LedgerEntry {
    super.record(entry);
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      appendFileSync(this.path, `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      // Keep serving: the in-memory copy is still correct for this process, and
      // the provider's transaction record remains the source of truth.
    }
    return entry;
  }
}

let ledger: LicenseLedger | undefined;

/** The process-wide ledger, built from env on first use. */
export function getLedger(env: Record<string, string | undefined> = process.env): LicenseLedger {
  if (!ledger) {
    const path = env.CAROUSEL_LICENSE_LEDGER?.trim();
    ledger = path ? new FileLedger(path) : new MemoryLedger();
  }
  return ledger;
}

export function setLedger(l: LicenseLedger | undefined): void {
  ledger = l;
}

/** The next seat number: licences are numbered from 1. */
export function nextSeat(l: LicenseLedger = getLedger()): number {
  return l.issued() + 1;
}

export function entryFor(license: License, amountUsd?: number): LedgerEntry {
  return {
    id: license.id,
    seat: license.seat,
    email: license.email,
    iat: license.iat,
    ...(license.txId ? { txId: license.txId } : {}),
    ...(amountUsd !== undefined ? { amountUsd } : {}),
  };
}
