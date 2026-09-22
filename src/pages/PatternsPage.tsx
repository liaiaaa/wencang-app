import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Search, X } from "lucide-react";
import PageHero from "@/components/common/PageHero";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchPatterns } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { Pattern, PatternCategory } from "@/types/types";
import { cn } from "@/lib/utils";

const categories: (PatternCategory | "all")[] = ["all", "蜡染", "扎染", "苗绣"];

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<PatternCategory | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPatterns({ category, keyword });
      setPatterns(data);
      // 运营埋点：搜索/筛选行为（后台「热门纹样 TOP5」数据来源）
      if (keyword.trim() || category !== "all") {
        track("pattern_search", {
          keyword: keyword.trim(),
          category: category === "all" ? "" : category,
          resultCount: data.length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [category, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => setKeyword(searchInput.trim());
  const clearFilters = () => {
    setCategory("all");
    setKeyword("");
    setSearchInput("");
  };

  return (
    <div>
      <PageHero
        eyebrow="Pattern Archive"
        title="纹样图库"
        subtitle="数字化收录蜡染、扎染、苗绣经典纹样，追溯每一道纹样的工艺技法与文化寓意。"
      />

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "num-label rounded-md border px-4 py-2 text-sm transition-colors",
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
                )}
              >
                {c === "all" ? "全部" : c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索纹样名称 / 工艺 / 地区"
                className="pl-9 pr-3"
              />
            </div>
            <Button onClick={handleSearch}>搜索</Button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : patterns.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">未找到匹配的纹样</p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              清空筛选
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {patterns.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
              >
                <Link
                  to={`/patterns/${p.id}`}
                  className="group block h-full overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover duotone-img transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="num-label text-xs">{p.category}</Badge>
                      <span className="num-label text-xs text-muted-foreground">{p.region}</span>
                    </div>
                    <h3 className="mt-3 font-serif-cn text-lg font-bold text-primary">{p.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.meaning}</p>
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