import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CalendarCheck, Lock } from "lucide-react";
import PageHero from "@/components/common/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchArtisans, fetchExperienceProjects, createBooking } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { Artisan, ExperienceProject } from "@/types/types";

const timeSlots = ["上午 09:00-12:00", "下午 13:00-16:00", "全天 09:00-16:00"];

export default function BookingPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [projects, setProjects] = useState<ExperienceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [artisanId, setArtisanId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [bookDate, setBookDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  useEffect(() => {
    Promise.all([fetchArtisans(), fetchExperienceProjects()])
      .then(([a, p]) => {
        setArtisans(a);
        setProjects(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedArtisan = artisans.find((a) => a.id === artisanId);
  const selectedProject = projects.find((p) => p.id === projectId);
  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    if (!session) {
      navigate("/login", { state: { from: "/booking" } });
      return;
    }
    if (!artisanId || !projectId || !bookDate || !timeSlot || !contactName.trim() || !contactPhone.trim()) {
      toast.error("请填写完整的预约信息");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(contactPhone.trim())) {
      toast.error("联系电话格式有误，请输入正确的手机号");
      return;
    }
    setSubmitting(true);
    try {
      await createBooking({
        artisan_id: artisanId,
        artisan_name: selectedArtisan?.name || "",
        project_id: projectId,
        project_name: selectedProject?.name || "",
        book_date: bookDate,
        time_slot: timeSlot,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
      });
      toast.success("预约提交成功，可在「我的预约」中查看状态");
      // 运营埋点：预约提交（后台看板趋势数据来源）
      track("booking_submit", {
        artisan: selectedArtisan?.name || "",
        project: selectedProject?.name || "",
      });
      navigate("/profile?tab=bookings");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHero
        eyebrow="Experience Booking"
        title="体验预约"
        subtitle="选择守艺人与体验项目，预约线下非遗技艺体验，亲手触摸靛蓝与丝线之间的温度。"
      />

      <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-12">
        <div className="space-y-6 rounded-lg border border-border bg-card p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">选择守艺人</Label>
              <Select value={artisanId} onValueChange={setArtisanId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="请选择守艺人" /></SelectTrigger>
                <SelectContent>
                  {artisans.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} · {a.craft}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">体验项目</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="请选择体验项目" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProject && (
            <div className="rounded-md bg-secondary/50 p-4">
              <p className="text-sm text-foreground">{selectedProject.description}</p>
              <p className="mt-2 num-label text-xs text-muted-foreground">时长：{selectedProject.duration}</p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">预约日期</Label>
              <Input type="date" min={today} value={bookDate} onChange={(e) => setBookDate(e.target.value)} className="px-3" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">时段</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger><SelectValue placeholder="请选择时段" /></SelectTrigger>
                <SelectContent>
                  {timeSlots.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">联系人</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="请输入联系人姓名" className="px-3" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">联系电话</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="请输入手机号" className="px-3" />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full" size="lg" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />提交中…</>
            ) : (
              <><CalendarCheck className="mr-2 h-4 w-4" />{session ? "提交预约" : "登录后提交"}</>
            )}
          </Button>

          {!session && (
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              提交预约需要先登录
            </p>
          )}
        </div>
      </section>
    </div>
  );
}