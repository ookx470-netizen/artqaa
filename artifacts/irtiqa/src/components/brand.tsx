
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="orb w-[55vw] h-[55vw] -top-[20vw] -right-[15vw] bg-[hsl(168_45%_30%/.35)]" style={{ animation: "drift 22s ease-in-out infinite" }} />
      <div className="orb w-[45vw] h-[45vw] top-[40%] -left-[15vw] bg-[hsl(38_60%_45%/.18)]" style={{ animation: "drift2 28s ease-in-out infinite" }} />
      <div className="orb w-[35vw] h-[35vw] bottom-[-15vw] right-[25%] bg-[hsl(210_50%_35%/.25)]" style={{ animation: "drift 34s ease-in-out infinite" }} />
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]">
        <defs>
          <pattern id="g" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M56 0H0V56" fill="none" stroke="hsl(40 40% 90%)" strokeWidth=".6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
    </div>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect x="1" y="1" width="38" height="38" rx="12" stroke="hsl(40 62% 68% / .5)" />
        <path d="M11 28 L20 12 L29 28" stroke="url(#lg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 28 L20 20 L24.5 28" stroke="hsl(168 42% 58%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="lg" x1="11" y1="12" x2="29" y2="28">
            <stop stopColor="hsl(42 72% 80%)" /><stop offset="1" stopColor="hsl(36 56% 56%)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight gold-text">ارتقاء</span>
    </div>
  );
}

export function PageHead({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs tracking-[0.2em] text-accent mb-2">{eyebrow}</p>
        <h1 className="font-display break-words text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">{title}</h1>
        {desc && <p className="mt-2 max-w-xl text-muted-foreground leading-relaxed">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[hsl(200_24%_16%/.6)] ${className}`} />;
}

export function ErrorBox({ onRetry, text = "تعذر تحميل البيانات" }: { onRetry: () => void; text?: string }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <p className="text-muted-foreground mb-4">{text}</p>
      <button data-testid="button-retry" onClick={onRetry} className="btn-ghost px-5 py-2 text-sm">إعادة المحاولة</button>
    </div>
  );
}
