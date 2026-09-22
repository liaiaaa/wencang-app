interface PageHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export default function PageHero({ eyebrow, title, subtitle }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
        <div className="flex items-center gap-3">
          <span className="accent-dot" />
          <span className="num-label text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</span>
        </div>
        <h1 className="mt-5 max-w-3xl font-serif-cn text-3xl font-bold leading-tight text-primary md:text-5xl text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            {subtitle}
          </p>
        )}
        <div className="mt-8 hairline w-24 animate-line-grow" />
      </div>
    </section>
  );
}