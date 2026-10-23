/** `compact` hides the wordmark on phones, leaving only the icon. */
export function Logo({ small = false, compact = false }: { small?: boolean; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center font-display font-semibold tracking-[-0.04em] text-fg ${
        small ? "gap-2.5 text-lg" : "gap-3 text-3xl sm:text-4xl"
      }`}
    >
      <LogoMark className={small ? "h-7 w-7" : "h-9 w-9 sm:h-10 sm:w-10"} />
      <span className={compact ? "hidden sm:inline" : undefined}>
        Guessdrawing<span className="text-accent">!</span>
      </span>
    </span>
  );
}

/** A glowing scribble on an accent tile. */
function LogoMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={`shrink-0 drop-shadow-[0_0_14px_rgba(109,139,255,0.55)] ${className}`}>
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fa6ff" />
          <stop offset="1" stopColor="#5b5cff" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#logo-tile)" />
      <path
        d="M9 26c3-7 6.5-10.5 8.5-8.5s-3.5 8.5-.5 9.5 6.5-10 9.5-8.5-.5 6 3.5 5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
