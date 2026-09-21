import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import PageHero from "@/components/common/PageHero";
import { fetchProducts } from "@/lib/api";
import type { Product } from "@/types/types";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHero
        eyebrow="Cultural Shop"
        title="文创商城"
        subtitle="选购守艺人手作的非遗文创作品，让蜡染、扎染、苗绣之美走进日常生活。"
      />

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="aspect-square w-full animate-pulse bg-muted" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {products.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <Link
                  to={`/shop/${p.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:shadow-lg"
                >
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover duotone-img transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-serif-cn text-lg font-bold text-primary">{p.name}</h3>
                    {/* 卡片整体已是 <a>，守艺人再用 <a> 会嵌套出非法 HTML，故以点击跳转实现同一效果 */}
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      出自 ·{" "}
                      {p.artisan_id ? (
                        <span
                          className="cursor-pointer text-primary transition-colors hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/artisans/${p.artisan_id}`);
                          }}
                        >
                          {p.artisan_name}
                        </span>
                      ) : (
                        p.artisan_name || "暂无关联"
                      )}
                    </p>
                    <div className="mt-4 flex items-end justify-between">
                      <p className="num-label text-xl font-bold text-accent">¥{p.price}</p>
                      <span className="inline-flex items-center text-sm font-medium text-primary">
                        查看
                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">暂无商品</p>
          </div>
        )}
      </section>
    </div>
  );
}