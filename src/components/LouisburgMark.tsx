// Small Louisburg Strategies brand mark, adapted from brand-assets/export-logo-dark.html
// for a light background. The coral (#FF6F61) branch glyph + LOUISBURG / STRATEGIES
// wordmark. Used in the printed feasibility report footer ("A Louisburg Strategies brand").

export function LouisburgMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 24 32" width="20" height="27" fill="none" aria-hidden>
        <path d="M12 32 C12 28 11 24 11 20 C11 16 12 12 13 8 C13.5 6 13 4 12 2" stroke="#FF6F61" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M13 14 C15 12 18 10 20 8" stroke="#FF6F61" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 10 C18 8 20 7 22 6" stroke="#FF6F61" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M15 12 C16.5 11.5 18 12 19 11" stroke="#FF6F61" strokeWidth="1" strokeLinecap="round" />
        <path d="M12 18 C10 16 7 14 5 13" stroke="#FF6F61" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 14.5 C6 13 4 11 2 10" stroke="#FF6F61" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M9 15.5 C7.5 16 6 15.5 5 16" stroke="#FF6F61" strokeWidth="1" strokeLinecap="round" />
        <path d="M13 6 C15 4 17 3 19 2" stroke="#FF6F61" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M12.5 8 C10 6 8 5 6 5" stroke="#FF6F61" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M12 2 C11 0.5 10 0 9 0" stroke="#FF6F61" strokeWidth="0.8" strokeLinecap="round" />
        <circle cx="20" cy="8" r="0.8" fill="#FF6F61" />
        <circle cx="22" cy="6" r="0.6" fill="#FF6F61" />
        <circle cx="5" cy="13" r="0.8" fill="#FF6F61" />
        <circle cx="2" cy="10" r="0.6" fill="#FF6F61" />
        <circle cx="19" cy="2" r="0.6" fill="#FF6F61" />
        <circle cx="9" cy="0" r="0.5" fill="#FF6F61" />
        <circle cx="6" cy="5" r="0.6" fill="#FF6F61" />
      </svg>
      <span className="leading-tight">
        <span className="block font-serif text-sm tracking-[0.14em] text-piranha-charcoal">LOUISBURG</span>
        <span className="block text-[0.5rem] font-semibold uppercase tracking-[0.35em] text-piranha-charcoal/50">
          Strategies
        </span>
      </span>
    </span>
  )
}
