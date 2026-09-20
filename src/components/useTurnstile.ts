"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * On-demand Cloudflare Turnstile token, used to shield the paid /api/generate
 * path. Completely inert unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set: with no
 * site key, `getToken()` resolves "" and the server (which also skips when it
 * has no secret) never challenges. So local dev and BYOK are unaffected.
 *
 * Renders one hidden, execute-on-demand widget and returns a fresh token each
 * time the user generates.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __cmTurnstile?: Promise<void>;
  }
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__cmTurnstile) return window.__cmTurnstile;
  window.__cmTurnstile = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile-script-failed"));
    document.head.appendChild(s);
  });
  return window.__cmTurnstile;
}

export function useTurnstile() {
  const widgetId = useRef<string | null>(null);
  const pending = useRef<((token: string) => void) | null>(null);

  useEffect(() => {
    if (!SITE_KEY || typeof window === "undefined") return;
    let cancelled = false;
    const el = document.createElement("div");
    el.style.display = "none";
    document.body.appendChild(el);

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId.current = window.turnstile.render(el, {
          sitekey: SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => {
            pending.current?.(token);
            pending.current = null;
          },
          "error-callback": () => {
            pending.current?.("");
            pending.current = null;
          },
          "expired-callback": () => {
            pending.current?.("");
            pending.current = null;
          },
        });
      })
      .catch(() => {
        /* script blocked — getToken will resolve "" and the server decides */
      });

    return () => {
      cancelled = true;
      try {
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      } catch {
        /* ignore */
      }
      el.remove();
    };
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    if (!SITE_KEY || typeof window === "undefined" || !window.turnstile || widgetId.current == null) {
      return "";
    }
    try {
      window.turnstile.reset(widgetId.current);
    } catch {
      /* ignore */
    }
    return new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        if (pending.current) {
          pending.current = null;
          resolve("");
        }
      }, 15000);
      pending.current = (token: string) => {
        clearTimeout(timeout);
        resolve(token);
      };
      try {
        window.turnstile!.execute(widgetId.current!);
      } catch {
        clearTimeout(timeout);
        pending.current = null;
        resolve("");
      }
    });
  }, []);

  return { enabled: !!SITE_KEY, getToken };
}
