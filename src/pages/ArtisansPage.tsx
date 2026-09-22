import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import PageHero from "@/components/common/PageHero";
import { Badge } from "@/components/ui/badge";
import { fetchArtisans } from "@/lib/api";
import type { Artisan } from "@/types/types";

export default function ArtisansPage() {
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtisans()
      .then(setArtisans)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHero
        eyebrow="Artisan Hall"
        title="守艺人展厅"
        subtitle="走近蜡染、扎染、苗绣的非遗传承人，聆听他们与染织刺绣相伴一生的故事。"
      />

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="aspect-[4/5] w-full animate-pulse bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {artisans.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <Link
                  to={`/artisans/${a.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden bg-muted">
                    <img
                      src={a.image_url}
                      alt={a.name}
                      className="h-full w-full object-cover duotone-img transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate font-serif-cn text-xl font-bold text-primary">{a.name}</h3>
                        <Badge variant="outline" className="num-label shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
                          示例档案
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="num-label shrink-0 text-xs">{a.craft}</Badge>
                    </div>
                    <p className="mt-1 num-label text-xs text-accent">{a.title}</p>
                    <p className="mt-3 flex-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{a.bio}</p>
                    <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                      查看详情
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}