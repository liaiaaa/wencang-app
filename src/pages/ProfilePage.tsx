import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Sparkles,
  CalendarCheck,
  ShoppingBag,
  Trash2,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  fetchMyAiPatterns,
  deleteAiPattern,
  fetchMyBookings,
  fetchMyOrders,
} from "@/lib/api";
import type { AiPattern, Booking, Order } from "@/types/types";
import { cn } from "@/lib/utils";
import { fetchUserRole, type UserRole } from "@/lib/role";
import AdminBookingsPage from "@/pages/AdminBookingsPage";

const statusStyle = (status: string) => {
  if (status.includes("已确认") || status.includes("已发货")) return "bg-accent/10 text-accent";
  if (status.includes("已完成")) return "bg-muted text-muted-foreground";
  return "bg-secondary text-secondary-foreground";
};

export default function ProfilePage() {
  const { session, user, username, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "patterns");
  const [patterns, setPatterns] = useState<AiPattern[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("user");

  // 等鉴权状态确定后再决定是否跳转，否则直接访问 /profile?tab=x
  // 会在会话恢复前被误判为未登录，导致丢失 tab 参数
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      const from = `/profile${searchParams.get("tab") ? `?tab=${searchParams.get("tab")}` : ""}`;
      navigate("/login", { state: { from }, replace: true });
    }
  }, [session, authLoading, navigate, searchParams]);

  // 角色判定：管理员可见「预约管理」入口
  useEffect(() => {
    let active = true;
    if (!user) return;
    fetchUserRole(user.id, user.email).then((r) => {
      if (active) setRole(r);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const isAdmin = role === "admin";

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchMyAiPatterns(), fetchMyBookings(), fetchMyOrders()])
      .then(([p, b, o]) => {
        setPatterns(p);
        setBookings(b);
        setOrders(o);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (session) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAiPattern(id);
      setPatterns((prev) => prev.filter((p) => p.id !== id));
      toast.success("已删除");
    } catch {
      toast.error("删除失败");
    }
  };

  // 鉴权未确定时先显示加载态，避免刷新页面时闪烁或误跳转
  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-12">
        <Skeleton className="h-28 w-full rounded-lg bg-muted" />
        <Skeleton className="mt-8 h-10 w-full rounded-lg bg-muted" />
        <Skeleton className="mt-6 h-64 w-full rounded-lg bg-muted" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-12">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <UserIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="num-label text-xs text-muted-foreground">当前账号</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="font-serif-cn text-xl font-bold text-primary">{username}</p>
              {isAdmin && (
                <Badge className="num-label gap-1 bg-accent/10 text-accent">
                  <ShieldCheck className="h-3 w-3" />
                  管理员
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <Button asChild>
              <Link to="/admin">
                <ShieldCheck className="mr-2 h-4 w-4" />
                进入运营后台
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className={cn("grid w-full", isAdmin ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="patterns" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">我的纹样</span>
            <span className="sm:hidden">纹样</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <CalendarCheck className="h-4 w-4" />
            <span className="hidden sm:inline">我的预约</span>
            <span className="sm:hidden">预约</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">我的订单</span>
            <span className="sm:hidden">订单</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">预约管理</span>
              <span className="sm:hidden">管理</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* 我的纹样 */}
        <TabsContent value="patterns" className="mt-6">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-lg bg-muted" />
              ))}
            </div>
          ) : patterns.length === 0 ? (
            <EmptyState icon={Sparkles} text="你还没有保存任何 AI 纹样" ctaText="去AI工坊创作" ctaTo="/workshop" />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {patterns.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="aspect-square w-full overflow-hidden bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
                        <Wand2 className="h-8 w-8 text-muted-foreground/40" />
                        <p className="num-label text-xs text-muted-foreground">文字模式 · 暂无配图</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="num-label text-xs">{p.category}</Badge>
                      <span className="num-label text-xs text-muted-foreground">{p.theme}</span>
                    </div>
                    <h3 className="mt-2 font-serif-cn text-base font-bold text-primary">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.meaning}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                      className="mt-3 h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 我的预约 */}
        <TabsContent value="bookings" className="mt-6">
          {isAdmin && !loading && bookings.length > 0 && (
            <p className="mb-4 rounded-md bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              当前为管理员账号，此处显示平台全部预约；状态流转请前往「预约管理」。
            </p>
          )}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg bg-muted" />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <EmptyState icon={CalendarCheck} text="你还没有预约记录" ctaText="去预约体验" ctaTo="/booking" />
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-serif-cn text-base font-bold text-primary">{b.project_name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">守艺人 · {b.artisan_name}</p>
                    </div>
                    <Badge className={cn("num-label shrink-0", statusStyle(b.status))}>{b.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                    <div><span className="text-foreground/60">日期</span><br />{b.book_date}</div>
                    <div><span className="text-foreground/60">时段</span><br />{b.time_slot}</div>
                    <div><span className="text-foreground/60">联系人</span><br />{b.contact_name}</div>
                    <div><span className="text-foreground/60">电话</span><br />{b.contact_phone}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 我的订单 */}
        <TabsContent value="orders" className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg bg-muted" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} text="你还没有订单记录" ctaText="去逛商城" ctaTo="/shop" />
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-serif-cn text-base font-bold text-primary">{o.product_name}</p>
                      <p className="mt-1 num-label text-xs text-muted-foreground">订单号 · {o.order_number}</p>
                    </div>
                    <Badge className={cn("num-label shrink-0", statusStyle(o.status))}>{o.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                    <div><span className="text-foreground/60">金额</span><br />¥{o.price}</div>
                    <div><span className="text-foreground/60">收件人</span><br />{o.contact_name}</div>
                    <div><span className="text-foreground/60">电话</span><br />{o.contact_phone}</div>
                    <div className="col-span-2 sm:col-span-1"><span className="text-foreground/60">地址</span><br />{o.address}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 预约管理（仅管理员） */}
        {isAdmin && (
          <TabsContent value="admin" className="mt-6">
            <AdminBookingsPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  ctaText,
  ctaTo,
}: {
  icon: typeof Sparkles;
  text: string;
  ctaText: string;
  ctaTo: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <p className="mt-4 text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to={ctaTo}>{ctaText}</Link>
      </Button>
    </div>
  );
}