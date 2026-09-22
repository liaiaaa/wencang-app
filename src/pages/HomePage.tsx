import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Brush,
  Sparkles,
  Users,
  CalendarCheck,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPlatformStats, fetchFeaturedPatterns } from "@/lib/api";
import type { PlatformStats, Pattern } from "@/types/types";

const features = [
  {
    icon: Brush,
    title: "纹样图库",
    desc: "数字化收录蜡染、扎染、苗绣经典纹样，追溯每一道纹样的工艺与寓意。",
    path: "/patterns",
    no: "01",
  },
  {
    icon: Sparkles,
    title: "AI纹样工坊",
    desc: "输入主题词，AI 续写生成全新非遗风格纹样，并解读其命名与寓意。",
    path: "/workshop",
    no: "02",
  },
  {
    icon: Users,
    title: "守艺人展厅",
    desc: "走近非遗传承人，聆听他们与染织刺绣相伴一生的故事。",
    path: "/artisans",
    no: "03",
  },
  {
    icon: CalendarCheck,
    title: "体验预约",
    desc: "预约线下技艺体验，亲手触摸靛蓝与丝线之间的温度。",
    path: "/booking",
    no: "04",
  },
  {
    icon: ShoppingBag,
    title: "文创商城",
    desc: "选购守艺人手作文创作品，让非遗之美走进日常生活。",
    path: "/shop",
    no: "05",
  },
];

export default function HomePage() {
  const { session, username } = useAuth();
  const [stats, setStats] = useState<PlatformStats>({ patternCount: 0, artisanCount: 0, projectCount: 0 });
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPlatformStats(), fetchFeaturedPatterns(5)])
      .then(([s, p]) => {
        setStats(s);
        setPatterns(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const statItems = [
    { label: "收录纹样", value: stats.patternCount },
    { label: "守艺人", value: stats.artisanCount },
    { label: "体验项目", value: stats.projectCount },
  ];

  return (
    <div>
      {/* HERO */}
      <section id="hero" className="relative overflow-hidden border-b border-border bg-secondary/30">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <span className="num-label text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                非遗染织刺绣数字平台
              </span>
            </div>
            <h1 className="mt-6 font-serif-cn text-4xl font-bold leading-[1.05] text-primary md:text-6xl text-balance">
              让每一道纹样，
              <br />
              都被看见。
            </h1>
            <p className="mt-6 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
              纹藏聚焦蜡染、扎染、苗绣等非物质文化遗产，以数字化档案记录经典纹样，以 AI 续写创新纹样，连接守艺人，传承千年技艺之美。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/patterns">
                  探索纹样
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/workshop">进入AI工坊</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative"
          >
            <div className="aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted md:aspect-[4/4]">
              {patterns[0] ? (
                <img src={patterns[0].image_url} alt={patterns[0].name} className="h-full w-full object-cover duotone-img" />
              ) : (
                <div className="h-full w-full animate-pulse bg-muted" />
              )}
            </div>
            {patterns[0] && (
              <div className="absolute -bottom-4 -left-4 hidden rounded-md border border-border bg-card p-4 shadow-lg md:block">
                <p className="num-label text-xs text-muted-foreground">N° 001</p>
                <p className="mt-1 font-serif-cn text-base font-bold text-primary">{patterns[0].name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{patterns[0].region}</p>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* STATS BAR */}
      <section id="stats" className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-border px-4 md:px-8">
          {statItems.map((item) => (
            <div key={item.label} className="px-3 py-8 text-center md:px-8 md:py-10">
              <p className="num-label text-3xl font-bold text-primary md:text-5xl">
                {loading ? "—" : item.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground md:text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="accent-dot" />
              <span className="num-label text-xs font-semibold uppercase tracking-[0.2em] text-accent">平台功能</span>
            </div>
            <h2 className="mt-4 font-serif-cn text-2xl font-bold text-primary md:text-4xl text-balance">
              数字化传承，全链路体验
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">
            从纹样档案到 AI 创作，从守艺人到文创商城，纹藏构建非遗传承的完整闭环。
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.path}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
            >
              <Link
                to={f.path}
                className="group flex h-full flex-col rounded-lg border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <span className="num-label text-sm font-semibold text-muted-foreground">{f.no}</span>
                </div>
                <h3 className="mt-5 font-serif-cn text-lg font-bold text-primary">{f.title}</h3>
                <p className="mt-2 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-accent">
                  进入
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" className="bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="accent-dot" />
                <span className="num-label text-xs font-semibold uppercase tracking-[0.2em] text-accent">精选纹样</span>
              </div>
              <h2 className="mt-4 font-serif-cn text-2xl font-bold text-primary md:text-4xl text-balance">
                靛蓝与丝线，千年纹样档案
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/patterns">
                查看全部
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {patterns.slice(1, 4).map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              >
                <Link
                  to={`/patterns/${p.id}`}
                  className="group block overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:shadow-lg"
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
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
        <div className="overflow-hidden rounded-xl bg-primary px-6 py-12 text-center md:px-12 md:py-16">
          <p className="num-label text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
            {session ? "欢迎回来" : "加入纹藏"}
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-serif-cn text-2xl font-bold leading-tight text-primary-foreground md:text-4xl text-balance">
            {session ? "继续你的非遗探索之旅" : "注册账号，开启你的非遗探索之旅"}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-sm text-primary-foreground/80">
            {session
              ? `${username ? `${username}，` : ""}你保存的 AI 纹样、提交的预约与订单都在个人中心，随时继续。`
              : "保存你创作的 AI 纹样，预约线下体验，收藏心仪的文创作品。"}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to={session ? "/profile" : "/login"}>{session ? "进入我的纹藏" : "立即注册"}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="border border-primary-foreground/60 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/workshop">体验AI工坊</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}