import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Brush,
  Users,
  ShoppingBag,
  CalendarCheck,
  TrendingUp,
  Archive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserRole, type UserRole } from "@/lib/role";
import EntityManager, { type FieldDef } from "@/components/admin/EntityManager";
import AdminBookingsPage from "@/pages/AdminBookingsPage";
import {
  fetchAdminOverview,
  fetchAllPatternsAdmin,
  fetchAllArtisansAdmin,
  fetchAllProductsAdmin,
  createPattern,
  updatePattern,
  archivePattern,
  restorePattern,
  createArtisan,
  updateArtisan,
  archiveArtisan,
  restoreArtisan,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  resetDemoContent,
  type AdminOverview,
  type PatternInput,
  type ArtisanInput,
  type ProductInput,
} from "@/lib/api";
import { getDailyTrend, getTopPatterns, getDemoEventRatio } from "@/lib/analytics";
import { resolveArtisanLink } from "@/lib/productLink";
import type { Pattern, Artisan, Product, PatternCategory } from "@/types/types";
import { cn } from "@/lib/utils";

const CATEGORIES: readonly PatternCategory[] = ["蜡染", "扎染", "苗绣"];
const CRAFTS = ["蜡染", "扎染", "苗绣"] as const;

/* ---------------- 字段定义 ---------------- */

const PATTERN_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "纹样名称", type: "text", required: true, placeholder: "如：蝶恋花靛蓝纹" },
  { key: "category", label: "类别", type: "select", options: CATEGORIES, required: true },
  { key: "region", label: "所属地区", type: "text", placeholder: "如：贵州 · 丹寨" },
  { key: "technique", label: "工艺技法", type: "text", placeholder: "如：蜡刀点蜡、靛蓝浸染" },
  { key: "meaning", label: "纹样寓意", type: "textarea", placeholder: "描述该纹样的文化寓意" },
  { key: "image_url", label: "纹样图片", type: "image" },
  // ---- 档案深化字段（均为可选） ----
  {
    key: "process_steps",
    label: "工艺流程",
    type: "list",
    placeholder: "每行一个步骤，如：\n布料褪浆\n融蜡保温\n点蜡绘纹",
    hint: "每行一条，按真实工序顺序填写",
  },
  { key: "story", label: "文化故事", type: "textarea", placeholder: "150~250 字的文化背景叙述" },
  {
    key: "usage_scenes",
    label: "传统应用场景",
    type: "list",
    placeholder: "每行一个场景，如：\n盛装衣袖\n背扇",
    hint: "每行一条",
  },
  {
    key: "related_patterns",
    label: "相关纹样",
    type: "multiselect",
    hint: "点击选择；留空时详情页自动按同类别/同地区推荐",
  },
];

const ARTISAN_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "姓名", type: "text", required: true },
  { key: "title", label: "称号", type: "text", placeholder: "如：省级非遗传承人" },
  { key: "craft", label: "擅长工艺", type: "select", options: CRAFTS, required: true },
  { key: "region", label: "所属地区", type: "text", placeholder: "如：贵州 · 凯里" },
  { key: "works", label: "代表作品", type: "text", placeholder: "多件作品用、分隔" },
  { key: "bio", label: "个人简介", type: "textarea" },
  { key: "image_url", label: "肖像图片", type: "image" },
];

const PRODUCT_FIELDS: readonly FieldDef[] = [
  { key: "name", label: "商品名称", type: "text", required: true },
  { key: "price", label: "价格（元）", type: "number", required: true, placeholder: "如：368" },
  {
    key: "artisan_id",
    label: "关联守艺人",
    type: "select",
    allowEmpty: true,
    placeholder: "暂不关联",
    hint: "选择后商品详情页可跳转到该守艺人档案",
  },
  { key: "craft_description", label: "工艺说明", type: "textarea" },
  { key: "image_url", label: "商品图片", type: "image" },
];

type SectionId = "overview" | "patterns" | "artisans" | "products" | "bookings";

const NAV: ReadonlyArray<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "概况看板", icon: LayoutDashboard },
  { id: "patterns", label: "纹样管理", icon: Brush },
  { id: "artisans", label: "守艺人管理", icon: Users },
  { id: "products", label: "商品管理", icon: ShoppingBag },
  { id: "bookings", label: "预约管理", icon: CalendarCheck },
];

export default function AdminDashboardPage() {
  const { session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get("tab") as SectionId) || "overview";

  const [role, setRole] = useState<UserRole | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  /* 权限：非管理员重定向到登录页 */
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      navigate("/login", { state: { from: "/admin" }, replace: true });
      return;
    }
    let active = true;
    fetchUserRole(session.user.id, session.user.email).then((r) => {
      if (!active) return;
      setRole(r);
      if (r !== "admin") {
        toast.error("无权访问管理后台");
        navigate("/login", { state: { from: "/admin" }, replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [session, authLoading, navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [o, p, a, pr] = await Promise.all([
        fetchAdminOverview(),
        fetchAllPatternsAdmin(),
        fetchAllArtisansAdmin(),
        fetchAllProductsAdmin(),
      ]);
      setOverview(o);
      setPatterns(p);
      setArtisans(a);
      setProducts(pr);
    } catch {
      toast.error("数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === "admin") loadAll();
  }, [role, loadAll]);

  /* 重置演示内容：答辩前一键回到干净的种子数据（用户账号与预约保留） */
  const [resetting, setResetting] = useState(false);
  const handleResetDemo = useCallback(async () => {
    setResetting(true);
    try {
      await resetDemoContent();
      toast.success("演示数据已重置为初始状态");
      await loadAll();
    } catch (err) {
      const e = err as Error & { code?: string };
      toast.error(e.code === "403" ? "仅管理员可执行该操作" : e.message || "重置失败");
    } finally {
      setResetting(false);
    }
  }, [loadAll]);

  const trend = getDailyTrend(7);
  const topPatterns = getTopPatterns(5);
  const trendTotal = trend.reduce((s, d) => s + d.booking + d.generate, 0);
  // 预置演示事件占比：用于在看板上诚实标注数据来源
  const { demo: demoCount, total: eventTotal } = getDemoEventRatio();

  // 「相关纹样」的可选项来自实时纹样列表（排除已归档）
  const patternFields = useMemo<readonly FieldDef[]>(() => {
    const candidates = patterns.filter((p) => p.status !== "archived");
    return PATTERN_FIELDS.map((f) =>
      f.key === "related_patterns"
        ? {
            ...f,
            options: candidates.map((p) => p.id),
            optionLabels: Object.fromEntries(candidates.map((p) => [p.id, p.name])),
          }
        : f,
    );
  }, [patterns]);

  // 「关联守艺人」的可选项来自实时守艺人列表（排除已归档）
  const productFields = useMemo<readonly FieldDef[]>(() => {
    const candidates = artisans.filter((a) => a.status !== "archived");
    return PRODUCT_FIELDS.map((f) =>
      f.key === "artisan_id"
        ? {
            ...f,
            options: candidates.map((a) => a.id),
            optionLabels: Object.fromEntries(candidates.map((a) => [a.id, a.name])),
          }
        : f,
    );
  }, [artisans]);

  // 下拉只产出 artisan_id，提交时派生 artisan_name，保证两列一致
  const createProductLinked = useCallback(
    (input: ProductInput) =>
      createProduct({ ...input, ...resolveArtisanLink(input.artisan_id, artisans) }),
    [artisans],
  );

  const updateProductLinked = useCallback(
    (id: string, patch: Partial<ProductInput>) => {
      const existing = products.find((p) => p.id === id);
      return updateProduct(id, {
        ...patch,
        ...resolveArtisanLink(patch.artisan_id, artisans, existing?.artisan_name),
      });
    },
    [artisans, products],
  );

  if (authLoading || role !== "admin") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <Skeleton className="h-10 w-64 bg-muted" />
        <Skeleton className="mt-6 h-64 w-full rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
      {/* 页头 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="accent-dot" />
            <span className="num-label text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Admin Console
            </span>
          </div>
          <h1 className="mt-3 font-serif-cn text-2xl font-bold text-primary md:text-3xl">运营后台</h1>
        </div>
        <Badge className="num-label gap-1 bg-accent/10 text-accent">
          管理员 · {user?.email?.split("@")[0]}
        </Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[200px_1fr] lg:gap-8">
        {/* 侧边导航 */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSearchParams({ tab: item.id })}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors lg:w-full",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-primary",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="num-label whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 内容区 */}
        <div className="min-w-0">
          {section === "overview" && (
            <OverviewSection
              overview={overview}
              loading={loading}
              trend={trend}
              trendTotal={trendTotal}
              topPatterns={topPatterns}
              demoCount={demoCount}
              eventTotal={eventTotal}
              resetting={resetting}
              onReset={handleResetDemo}
            />
          )}

          {section === "patterns" && (
            <EntityManager<Pattern, PatternInput>
              title="纹样管理"
              noun="纹样"
              fields={patternFields}
              items={patterns}
              loading={loading}
              reload={loadAll}
              create={createPattern}
              update={updatePattern}
              archive={archivePattern}
              restore={restorePattern}
              searchKeys={["name", "region", "technique"]}
              renderThumb={(p) => p.image_url}
              renderMeta={(p) => (
                <p className="truncate text-xs text-muted-foreground">
                  {p.category} · {p.region || "未填写地区"}
                </p>
              )}
            />
          )}

          {section === "artisans" && (
            <EntityManager<Artisan, ArtisanInput>
              title="守艺人管理"
              noun="守艺人"
              fields={ARTISAN_FIELDS}
              items={artisans}
              loading={loading}
              reload={loadAll}
              create={createArtisan}
              update={updateArtisan}
              archive={archiveArtisan}
              restore={restoreArtisan}
              searchKeys={["name", "craft", "region"]}
              renderThumb={(a) => a.image_url}
              renderMeta={(a) => (
                <p className="truncate text-xs text-muted-foreground">
                  {a.title} · {a.craft} · {a.region || "未填写地区"}
                </p>
              )}
            />
          )}

          {section === "products" && (
            <EntityManager<Product, ProductInput>
              title="商品管理"
              noun="商品"
              fields={productFields}
              items={products}
              loading={loading}
              reload={loadAll}
              create={createProductLinked}
              update={updateProductLinked}
              archive={archiveProduct}
              restore={restoreProduct}
              searchKeys={["name", "artisan_name"]}
              renderThumb={(p) => p.image_url}
              renderMeta={(p) => (
                <p className="truncate text-xs text-muted-foreground">
                  ¥{p.price} · 出自 {p.artisan_name || "未关联守艺人"}
                </p>
              )}
            />
          )}

          {section === "bookings" && <AdminBookingsPage />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 概况看板 ---------------- */

function OverviewSection({
  overview,
  loading,
  trend,
  trendTotal,
  topPatterns,
  demoCount,
  eventTotal,
  resetting,
  onReset,
}: {
  overview: AdminOverview | null;
  loading: boolean;
  trend: ReturnType<typeof getDailyTrend>;
  trendTotal: number;
  topPatterns: ReturnType<typeof getTopPatterns>;
  demoCount: number;
  eventTotal: number;
  resetting: boolean;
  onReset: () => void;
}) {
  const cards = [
    { label: "纹样总数", value: overview?.patternCount, icon: Brush },
    { label: "守艺人数", value: overview?.artisanCount, icon: Users },
    { label: "商品数", value: overview?.productCount, icon: ShoppingBag },
    { label: "注册用户", value: overview?.userCount, icon: Users },
    { label: "今日预约", value: overview?.todayBookings, icon: CalendarCheck },
    { label: "待确认预约", value: overview?.pendingBookings, icon: CalendarCheck },
  ];

  return (
    <div className="space-y-6">
      {/* 演示数据维护：只重建内容表，账号与预约保留 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          概况数字均来自本地数据层，与各管理列表同源
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={resetting}
          title="按当前版本重新播种纹样 / 守艺人 / 商品 / 体验项目；用户账号与预约、订单保留"
          className="shrink-0"
        >
          {resetting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          重置演示数据
        </Button>
      </div>

      {/* 指标卡 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="num-label text-xs text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="num-label mt-2 text-2xl font-bold text-primary">
              {loading || c.value === undefined ? "—" : c.value}
            </p>
          </div>
        ))}
      </div>

      {overview && overview.archivedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-2">
          <Archive className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            已归档 {overview.archivedCount} 条记录（不在前台展示，可在各管理页恢复）
          </p>
        </div>
      )}

      {/* 趋势图 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">
              近 7 日趋势
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              近 7 日共 {trendTotal} 次行为（预约提交 + 纹样生成）
            </p>
            {demoCount > 0 && (
              <Badge
                variant="outline"
                className="num-label px-1.5 text-[10px] font-normal text-muted-foreground"
                title={`共 ${eventTotal} 条埋点，其中 ${demoCount} 条为预置演示数据`}
              >
                含演示数据
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4 h-64 w-full">
          {trendTotal === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无行为数据</p>
              <p className="text-xs text-muted-foreground/70">
                在前台提交预约或使用 AI 工坊生成纹样后，这里会出现趋势
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(218 20% 84%)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(218 15% 42%)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(218 15% 42%)" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(218 20% 84%)",
                    background: "#fff",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="booking"
                  name="预约提交"
                  stroke="hsl(218 51% 37%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="generate"
                  name="纹样生成"
                  stroke="hsl(8 72% 45%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 热门纹样 TOP5 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">
          热门纹样 TOP5
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          来源：纹样详情浏览与图库搜索的埋点聚合
        </p>

        {topPatterns.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-center">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            ) : (
              <p className="text-sm text-muted-foreground">暂无浏览数据</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {topPatterns.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3"
              >
                <span
                  className={cn(
                    "num-label flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    i === 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-primary",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{t.name}</span>
                <span className="num-label shrink-0 text-xs text-muted-foreground">{t.count} 次</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
