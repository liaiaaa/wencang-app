import { describe, it, expect, beforeEach, vi } from "vitest";
import { authErrorMessage } from "@/pages/LoginPage";

/* ============================================================
 * Bug 修复回归 · 演示模式注册与登录
 *
 * 每次 boot() 都 resetModules() 重新求值 mock 模块，
 * 等价于"关掉页面重新打开"：模块级状态全部重建，只剩 localStorage。
 * 这正是这个 Bug 的复现条件——账号只活在内存里时，重载后就没了。
 * ============================================================ */

async function boot() {
  vi.resetModules();
  const api = await import("@/lib/api.ts");
  const role = await import("@/lib/role.ts");
  const { supabase } = await import("@/db/supabase");
  return { supabase, api, role };
}

const USERS_KEY = "wenzang.mock.users.v1";
const SESSION_KEY = "wenzang.mock.session.v1";

const signIn = (s: any, email: string, password: string) =>
  s.auth.signInWithPassword({ email, password });

const profiles = async (s: any) => {
  const { data } = await s.from("profiles").select("id, email");
  return (data ?? []) as { id: string; email: string }[];
};

beforeEach(() => {
  localStorage.clear();
});

describe("演示模式 · 注册", () => {
  it("注册成功即自动登录，并同步创建 profiles 档案", async () => {
    const { supabase } = await boot();
    const { data, error } = await supabase.auth.signUp({
      email: "qa_register@miaoda.com",
      password: "qa123456",
    });
    expect(error).toBeNull();
    expect(data.session).toBeTruthy();
    expect(data.user?.email).toBe("qa_register@miaoda.com");

    const rows = await profiles(supabase);
    expect(rows.some((r) => r.email === "qa_register@miaoda.com")).toBe(true);
  });

  it("重复注册被拒绝，错误可被识别为「该用户名已被注册」", async () => {
    const { supabase } = await boot();
    const first = await supabase.auth.signUp({ email: "qa_dup@miaoda.com", password: "qa123456" });
    expect(first.error).toBeNull();

    const second = await supabase.auth.signUp({ email: "qa_dup@miaoda.com", password: "other12345" });
    expect(second.data.session).toBeNull();
    expect(second.error).toBeInstanceOf(Error);
    expect(authErrorMessage(second.error)).toBe("该用户名已被注册");
  });

  it("注册账号写入 localStorage，重载页面后依然存在", async () => {
    const { supabase } = await boot();
    await supabase.auth.signUp({ email: "qa_persist@miaoda.com", password: "qa123456" });

    const stored = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    expect(stored.some((u: { email: string }) => u.email === "qa_persist@miaoda.com")).toBe(true);

    // 重载：模块状态全部重建，只剩 localStorage
    const again = await boot();
    const login = await signIn(again.supabase, "qa_persist@miaoda.com", "qa123456");
    expect(login.error).toBeNull();
    expect(login.data.session?.user.email).toBe("qa_persist@miaoda.com");
  });
});

describe("演示模式 · 登录与会话", () => {
  it("密码错误返回可识别的失败原因，不静默", async () => {
    const { supabase } = await boot();
    const { data, error } = await signIn(supabase, "demo@miaoda.com", "wrong-password");
    expect(data.session).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(authErrorMessage(error)).toBe("用户名或密码错误");
  });

  it("不存在的账号同样返回明确的凭据错误", async () => {
    const { supabase } = await boot();
    const { error } = await signIn(supabase, "nobody@miaoda.com", "whatever123");
    expect(authErrorMessage(error)).toBe("用户名或密码错误");
  });

  it("登录态在重载后由 localStorage 恢复，退出后不再恢复", async () => {
    const { supabase } = await boot();
    await signIn(supabase, "demo@miaoda.com", "demo123456");
    expect(localStorage.getItem(SESSION_KEY)).toBeTruthy();

    const reloaded = await boot();
    const restored = await reloaded.supabase.auth.getSession();
    expect(restored.data.session?.user.email).toBe("demo@miaoda.com");

    await reloaded.supabase.auth.signOut();
    const afterOut = await boot();
    expect((await afterOut.supabase.auth.getSession()).data.session).toBeNull();
  });

  it("内置演示账号 admin / demo 始终可用，且角色判定正确", async () => {
    const { supabase, role } = await boot();

    const admin = await signIn(supabase, "admin@miaoda.com", "wencang2026");
    expect(admin.error).toBeNull();
    expect(await role.fetchUserRole("u-admin-0001", "admin@miaoda.com")).toBe("admin");

    const demo = await signIn(supabase, "demo@miaoda.com", "demo123456");
    expect(demo.error).toBeNull();
    expect(await role.fetchUserRole("u-demo-0001", "demo@miaoda.com")).toBe("user");

    // 新注册用户不是管理员
    await supabase.auth.signUp({ email: "qa_plain@miaoda.com", password: "qa123456" });
    expect(await role.fetchUserRole("any", "qa_plain@miaoda.com")).toBe("user");
  });

  it("种子账号不会被本地注册记录覆盖（改密随代码生效）", async () => {
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify([{ id: "x", email: "admin@miaoda.com", password: "hijacked", role: "admin" }]),
    );
    const { supabase } = await boot();
    const ok = await signIn(supabase, "admin@miaoda.com", "wencang2026");
    expect(ok.error).toBeNull();
    const bad = await signIn(supabase, "admin@miaoda.com", "hijacked");
    expect(bad.error).toBeInstanceOf(Error);
  });
});

describe("演示模式 · 错误文案映射", () => {
  it("英文原始错误翻成中文，未知错误也有可读兜底", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe("用户名或密码错误");
    expect(authErrorMessage({ message: "User already registered" })).toBe("该用户名已被注册");
    expect(authErrorMessage(new Error("Fetched but failed"))).toBe("Fetched but failed");
    expect(authErrorMessage(null)).toBe("操作失败，请稍后重试");
    expect(authErrorMessage(undefined)).toBe("操作失败，请稍后重试");
    expect(authErrorMessage("boom")).toBe("boom");
  });
});
