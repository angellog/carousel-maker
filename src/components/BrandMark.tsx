/**
 * The maker's mark: a fairground carousel built from a carousel UI. The canopy
 * is a roof and a scalloped valance; beneath it, three slide cards — the
 * centre one active, the neighbours peeking — the way a swipe deck looks. Pure
 * geometry, like everything else the product draws.
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="32" cy="9" r="2.6" fill="currentColor" />
      <path d="M12 26 L32 12 L52 26 Z" fill="currentColor" />
      <path
        d="M12 26 a6.67 6.67 0 0 0 13.33 0 a6.67 6.67 0 0 0 13.34 0 a6.67 6.67 0 0 0 13.33 0 Z"
        fill="currentColor"
      />
      <rect x="14" y="37" width="9" height="15" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="41" y="37" width="9" height="15" rx="2" fill="currentColor" opacity="0.4" />
      <rect x="25.5" y="34" width="13" height="21" rx="2.5" fill="currentColor" />
    </svg>
  );
}

/** Mark + name, set the way the brand is always set: a quiet serif "The", a loud name. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-[var(--r-md)] bg-[var(--color-text)] text-[var(--color-brand)]">
        <BrandMark size={30} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-serif)] text-[13px] italic text-[var(--color-dim)]">The</span>
        <span className="display text-[24px] leading-[1.05]">Carousel Maker</span>
      </span>
    </span>
  );
}
