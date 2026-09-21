"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional sticky footer inside the sheet. */
  footer?: React.ReactNode;
}

/** Bottom sheet — the mobile stand-in for a side panel. */
export default function Sheet({ open, title, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep the latest onClose without making it an effect dependency. Callers pass
  // a fresh inline arrow every render; if the effect below re-ran on that, it
  // would call ref.focus() on every keystroke and steal focus from the fields
  // inside the sheet.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the sheet from scrolling on touch.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the dialog once when it opens, not on every re-render.
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet-grip" />
        <div className="flex flex-none items-center justify-between px-4 py-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">
            Done
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? <div className="flex-none border-t border-[var(--color-edge)] p-3">{footer}</div> : null}
      </div>
    </>
  );
}
