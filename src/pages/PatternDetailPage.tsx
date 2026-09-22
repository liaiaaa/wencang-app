import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  MapPin,
  Wrench,
  CalendarDays,
  Sparkles,
  ListOrdered,
  BookOpen,
  Layers,
  Compass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useGoBack from "@/hooks/use-go-back";
import { fetchPatternById, fetchPatterns } from "@/lib/api";
import { track } from "@/lib/analytics";
import { pickRelatedPatterns, cleanList } from "@/lib/related";
import type { Pattern } from "@/types/types";

export default function PatternDetailPage() {
  const { id } = useParams<{ id: string }>();
  // 路由参数从 :id=A 变成 :id=B 时，React 复用同一个组件实例（元素类型与位置都没变），
  // 于是上一篇的 state 会短暂留在新页面上——相关纹样里"多出"一条看着像重复的纹样就是这么来的。
  // 用 id 作 key 强制重挂载，切换纹样必然从干净状态开始取数。
  return <PatternDetail key={id ?? ""} id={id} />;
}

function PatternDetail({ id }: { id?: string }) {
  // 返回图库走历史后退，列表页才能恢复到离开前的浏览位置
  const goBackToList = useGoBack("/patterns");
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [related, setRelated] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setRelated([]);
    fetchPatternById(id)
      .then((p) => {
        setPattern(p);
        // 运营埋点：纹样浏览（后台「热门纹样 TOP5」数据来源）
        if (p) track("pattern_view", { id: p.id, name: p.name, category: p.category });
        // 相关纹样：按 id 取；缺失或不足时用同类别 / 同地区补足
        return p ? fetchPatterns() : null;
      })
      .then((all) => {
        if (all) setRelated(pickRelatedPatterns(all, id));
      })
      .catch(() => {
        // 相关纹样属增强内容，取不到时静默降级，不影响主内容渲染
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        <Skeleton className="mb-8 h-8 w-40 bg-muted" />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-lg bg-muted" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48 bg-muted" />
            <Skeleton className="h-4 w-full bg-muted" />
            <Skeleton className="h-4 w-2/3 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center md:px-8">
        <p className="text-muted-foreground">纹样不存在或已被移除</p>
        <Button variant="outline" className="mt-4" onClick={goBackToList}>
          返回图库
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <Button
        variant="ghost"
        size="sm"
        onClick={goBackToList}
        className="mb-6 -ml-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回图库
      </Button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-lg border border-border bg-muted"
        >
          <img src={pattern.image_url} alt={pattern.name} className="h-full w-full object-cover duotone-img" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <Badge variant="secondary" className="num-label">{pattern.category}</Badge>
          <h1 className="mt-4 font-serif-cn text-3xl font-bold leading-tight text-primary md:text-4xl text-balance">
            {pattern.name}
          </h1>

          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="num-label text-xs text-muted-foreground">所属地区</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{pattern.region}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="num-label text-xs text-muted-foreground">工艺技法</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{pattern.technique}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="num-label text-xs text-muted-foreground">收录时间</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {new Date(pattern.created_at).toLocaleDateString("zh-CN")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 hairline" />

          <div className="mt-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">纹样寓意</p>
            </div>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-foreground">{pattern.meaning}</p>
          </div>

          <Button asChild className="mt-8">
            <Link to="/workshop">
              用此主题创作新纹样
              <Sparkles className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* ============ 档案深化区块 ============
          四个区块均为可选：老数据缺字段时整块不渲染，
          不会出现空标题或空容器。 */}
      <PatternArchiveSections pattern={pattern} related={related} />
    </div>
  );
}

/** 工艺流程 / 文化故事 / 应用场景 / 相关纹样 */
function PatternArchiveSections({
  pattern,
  related,
}: {
  pattern: Pattern;
  related: Pattern[];
}) {
  const steps = cleanList(pattern.process_steps);
  const scenes = cleanList(pattern.usage_scenes);
  const story = pattern.story?.trim() ?? "";

  const hasAnything = steps.length > 0 || scenes.length > 0 || story.length > 0 || related.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 md:px-8">
      {/* 工艺流程 */}
      {steps.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-accent" />
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">工艺流程</p>
          </div>
          <div className="mt-6 rounded-lg border border-border bg-card p-5 md:p-6">
            {/* 移动端纵向、≥sm 横向步进 */}
            <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0">
              {steps.map((step, i) => (
                <li key={i} className="relative flex flex-1 gap-3 sm:flex-col sm:gap-0">
                  <div className="flex items-center sm:w-full">
                    <span className="num-label z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary bg-background text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {i < steps.length - 1 && (
                      <span className="ml-3 hidden h-px flex-1 bg-border sm:ml-0 sm:block" />
                    )}
                  </div>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground sm:mt-3 sm:pr-3">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* 文化故事 */}
      {story && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-accent" />
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">文化故事</p>
          </div>
          <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-6 md:p-8">
            <p className="font-serif-cn text-pretty text-base leading-loose text-foreground md:text-lg">
              {story}
            </p>
          </div>
        </section>
      )}

      {/* 传统应用场景 */}
      {scenes.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-accent" />
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">
              传统应用场景
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {scenes.map((s) => (
              <Badge key={s} variant="outline" className="num-label px-3 py-1 text-xs font-normal">
                {s}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* 相关纹样 */}
      {related.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-accent" />
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">相关纹样</p>
          </div>
          {/* 横向滚动，复用图库卡片样式 */}
          <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-3">
            {related.map((r) => (
              <Link
                key={r.id}
                to={`/patterns/${r.id}`}
                className="group block w-56 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:shadow-lg"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  <img
                    src={r.image_url}
                    alt={r.name}
                    className="h-full w-full object-cover duotone-img transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="num-label shrink-0 text-xs">{r.category}</Badge>
                    <span className="num-label truncate text-xs text-muted-foreground">{r.region}</span>
                  </div>
                  <h3 className="mt-2 truncate font-serif-cn text-base font-bold text-primary">{r.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}