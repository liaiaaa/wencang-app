import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/db/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

/**
 * 认证失败的中文提示。
 * 数据层（含云端 supabase-js）返回的是英文错误信息，直接抛给用户只会让人以为功能坏了，
 * 因此这里统一翻译；取不到 message 时也给出可读文案，绝不静默失败。
 */
export function authErrorMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : ((err as { message?: string } | null)?.message ?? "");
  if (/invalid login credentials/i.test(raw)) return "用户名或密码错误";
  if (/already registered|already exists|user already/i.test(raw)) return "该用户名已被注册";
  return raw || "操作失败，请稍后重试";
}

export default function LoginPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string })?.from || "/";

  // 已登录则跳回来源页；等鉴权状态确定后再跳，避免刷新时误判
  useEffect(() => {
    if (authLoading) return;
    if (session) navigate(from, { replace: true });
  }, [session, authLoading, navigate, from]);

  if (authLoading || session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!USERNAME_RE.test(username)) {
      toast.error("用户名仅支持字母、数字和下划线");
      return;
    }
    if (password.length < 6) {
      toast.error("密码至少需要 6 位");
      return;
    }
    if (!agree) {
      toast.error("请先阅读并同意用户协议与隐私政策");
      return;
    }
    const email = `${username.toLowerCase()}@miaoda.com`;
    setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("注册成功，已自动登录");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("登录成功");
      }
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground font-serif-cn text-2xl font-bold">
            纹
          </span>
          <span className="font-serif-cn text-2xl font-bold text-primary">纹藏</span>
        </Link>
        <p className="mt-4 text-sm text-muted-foreground">
          {mode === "login" ? "登录后管理你的纹样、预约与订单" : "注册账号，开启非遗探索之旅"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            autoComplete="username"
            className="px-3"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">密码</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码（至少 6 位）"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="px-3"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="agree" checked={agree} onCheckedChange={(v: boolean) => setAgree(v)} className="mt-0.5" />
          <Label htmlFor="agree" className="text-xs font-normal leading-relaxed text-muted-foreground">
            我已阅读并同意
            <span className="text-primary">《用户协议》</span>与
            <span className="text-primary">《隐私政策》</span>
          </Label>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "login" ? "登录" : "注册并登录"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="ml-1 font-medium text-primary hover:underline"
          >
            {mode === "login" ? "立即注册" : "去登录"}
          </button>
        </p>
      </form>
    </div>
  );
}