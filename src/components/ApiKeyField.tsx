"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "carousel.apiKey";

export function loadStoredKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Private mode or blocked storage — the app still works, just not sticky.
    return "";
  }
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Lets the user paste their own Anthropic key from a phone, with a real
 * connectivity test so a bad key or an empty balance is obvious immediately.
 *
 * The key is kept in this browser's localStorage and sent only to this app's
 * own server, which forwards it to api.anthropic.com and discards it. It is
 * never written to disk on the server and never appears in a log line.
 */
export default function ApiKeyField({ value, onChange }: Props) {
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(loadStoredKey() === value && value.length > 0);
  }, [value]);

  const persist = (v: string) => {
    try {
      if (v) localStorage.setItem(STORAGE_KEY, v);
      else localStorage.removeItem(STORAGE_KEY);
      setSaved(!!v);
    } catch {
      setResult({ ok: false, message: "This browser blocked storage, so the key won't persist." });
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      setResult((await res.json()) as { ok: boolean; message: string });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">
          API key
        </span>
        {saved && <span className="text-[11px] text-[var(--color-brand)]">saved on this device</span>}
      </div>

      <div className="mt-1 flex gap-2">
        <input
          className="field flex-1 font-mono text-sm"
          type={reveal ? "text" : "password"}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.trim());
            setResult(null);
          }}
        />
        <button className="btn btn-sm px-3" onClick={() => setReveal((r) => !r)}>
          {reveal ? "Hide" : "Show"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button className="btn btn-sm" onClick={() => void test()} disabled={!value || testing}>
          {testing ? "Testing…" : "Test key"}
        </button>
        <button className="btn btn-sm" onClick={() => persist(value)} disabled={!value || saved}>
          Save
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            onChange("");
            persist("");
            setResult(null);
          }}
          disabled={!value}
        >
          Clear
        </button>
      </div>

      {result && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-sm"
          style={{
            background: result.ok ? "rgba(110,231,183,0.12)" : "rgba(248,113,113,0.12)",
            color: result.ok ? "var(--color-brand)" : "#fca5a5",
          }}
          role="status"
        >
          {result.message}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-dim)]">
        Stored only in this browser and sent only to this app, which passes it to
        api.anthropic.com and keeps no copy. Leave it blank to use the server&apos;s own key.
        Over plain <code>http://</code> on a shared network it travels unencrypted — use
        localhost or HTTPS if that matters to you.
      </p>
    </div>
  );
}
