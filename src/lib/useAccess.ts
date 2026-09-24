"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccessState } from "./access/types";

const LICENSE_KEY = "cm-license";

/** The licence token this device holds, if any. */
export function storedLicense(): string {
  try {
    return localStorage.getItem(LICENSE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeLicense(token: string): void {
  try {
    if (token) localStorage.setItem(LICENSE_KEY, token);
    else localStorage.removeItem(LICENSE_KEY);
  } catch {
    /* private mode — the licence simply won't persist on this device */
  }
}

/** Headers that carry the licence (and nothing else) to our own API. */
export function licenseHeaders(token = storedLicense()): Record<string, string> {
  return token ? { "x-cm-license": token } : {};
}

/**
 * The server's view of what this visitor may do.
 *
 * The browser deliberately keeps no count of its own: it asks, it displays
 * what it's told, and it re-asks whenever something changes. A number the
 * client invents is a number the client can edit — and the whole model rests
 * on this one being true.
 */
export function useAccess(apiKey: string) {
  const [state, setState] = useState<AccessState | null>(null);
  const [license, setLicense] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async (token?: string) => {
      try {
        const res = await fetch("/api/access", {
          headers: licenseHeaders(token ?? storedLicense()),
          cache: "no-store",
        });
        if (res.ok) setState((await res.json()) as AccessState);
      } catch {
        // Offline or the API is down: keep whatever we last knew rather than
        // pretending the visitor has no allowance left.
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const token = storedLicense();
    setLicense(token);
    void refresh(token);
  }, [refresh]);

  // A bring-your-own key changes which identity the server sees, so the
  // allowance it reports changes with it.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const applyLicense = useCallback(
    async (token: string) => {
      storeLicense(token);
      setLicense(token);
      await refresh(token);
    },
    [refresh],
  );

  const clearLicense = useCallback(async () => {
    storeLicense("");
    setLicense("");
    await refresh("");
  }, [refresh]);

  return { state, setState, license, applyLicense, clearLicense, refresh, loading };
}
