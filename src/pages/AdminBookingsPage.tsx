import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarCheck, CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchMyBookings, updateBookingStatus } from "@/lib/api";
import type { Booking, BookingStatus } from "@/types/types";
import { cn } from "@/lib/utils";

const statusStyle = (status: string) => {
  if (status.includes("已确认")) return "bg-accent/10 text-accent";
  if (status.includes("已完成")) return "bg-muted text-muted-foreground";
  return "bg-secondary text-secondary-foreground";
};

/** 预约管理（管理员视角）：查看全部预约并流转状态 */
export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchMyBookings()
      .then(setBookings)
      .catch(() => toast.error("预约列表加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const changeStatus = async (booking: Booking, status: BookingStatus) => {
    setPendingId(booking.id);
    try {
      await updateBookingStatus(booking.id, status);
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
      toast.success(`已更新为「${status}」`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    } finally {
      setPendingId(null);
    }
  };

  const counts = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "待确认").length,
    confirmed: bookings.filter((b) => b.status === "已确认").length,
    done: bookings.filter((b) => b.status === "已完成").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent" />
        <p className="num-label text-xs font-semibold uppercase tracking-wider text-accent">管理员 · 全部预约</p>
      </div>

      {/* 概览 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "全部预约", value: counts.total },
          { label: "待确认", value: counts.pending },
          { label: "已确认", value: counts.confirmed },
          { label: "已完成", value: counts.done },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="num-label text-2xl font-bold text-primary">{loading ? "—" : s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg bg-muted" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20 text-center">
          <CalendarCheck className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">暂无预约记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="rounded-lg border border-border bg-card p-5"
            >
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

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  size="sm"
                  variant={b.status === "已确认" ? "default" : "outline"}
                  disabled={b.status === "已确认" || pendingId === b.id}
                  onClick={() => changeStatus(b, "已确认")}
                >
                  {pendingId === b.id ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  确认预约
                </Button>
                <Button
                  size="sm"
                  variant={b.status === "已完成" ? "default" : "outline"}
                  disabled={b.status === "已完成" || pendingId === b.id}
                  onClick={() => changeStatus(b, "已完成")}
                >
                  <Clock className="mr-1.5 h-4 w-4" />
                  标记完成
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-xs text-muted-foreground">
        当前为管理员视角，可查看并处理全部用户的预约 ·{" "}
        <Link to="/booking" className="text-primary hover:underline">前往预约页</Link>
      </p>
    </div>
  );
}
