import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/layouts/Header";
import HomePage from "@/pages/HomePage";
import { supabase } from "@/db/supabase";

/* ============================================================
 * 任务包 A · 登录态 UI 一致性
 *
 * Header 与首页 CTA 都必须跟着会话状态走：
 * 注册/登录后不能还写着"登录/注册"，退出后要立刻变回去。
 * ============================================================ */

const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

const renderHeader = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Header />
      </AuthProvider>
    </MemoryRouter>,
  );

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  );

/**
 * 打开 Header 的用户下拉。
 * jsdom 下 Radix DropdownMenu 不响应 pointerdown / mousedown（实测打不开），
 * 只认键盘的 ArrowDown / Enter —— 这也正是它无障碍交互本来的键位。
 */
const openUserMenu = async (name: string) => {
  const trigger = (await screen.findByText(name)).closest("button");
  if (!trigger) throw new Error(`找不到用户菜单触发器（${name}）`);
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
  await waitFor(() => expect(screen.getByText("个人中心")).toBeTruthy());
  return trigger;
};

beforeEach(async () => {
  await supabase.auth.signOut();
  (window as unknown as { __wenzangMock: { reset: () => void } }).__wenzangMock.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Header · 会话状态", () => {
  it("未登录时显示「登录 / 注册」，不出现用户菜单", async () => {
    renderHeader();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: "登录 / 注册" })).toBeTruthy();
    });
    expect(screen.queryByText("退出登录")).toBeNull();
  });

  it("普通用户登录后显示用户名，菜单里有个人中心与退出登录", async () => {
    await signIn("demo@miaoda.com", "demo123456");
    renderHeader();
    await waitFor(() => {
      expect(screen.getByText("demo")).toBeTruthy();
    });
    expect(screen.queryByRole("link", { name: "登录 / 注册" })).toBeNull();

    await openUserMenu("demo");
    expect(screen.getByText("退出登录")).toBeTruthy();
    expect(screen.queryByText("运营后台")).toBeNull(); // 普通用户不给后台入口
  });

  it("管理员登录后菜单出现「运营后台」入口", async () => {
    await signIn("admin@miaoda.com", "wencang2026");
    renderHeader();
    await waitFor(() => {
      expect(screen.getByText("admin")).toBeTruthy();
    });
    await openUserMenu("admin");
    await waitFor(() => {
      expect(screen.getByText("运营后台")).toBeTruthy();
    });
    expect(screen.getByText("个人中心")).toBeTruthy();
  });

  it("点菜单里的退出登录后，Header 立刻回到未登录态（无需刷新）", async () => {
    await signIn("demo@miaoda.com", "demo123456");
    renderHeader();
    await waitFor(() => expect(screen.getByText("demo")).toBeTruthy());

    await openUserMenu("demo");
    fireEvent.click(screen.getByText("退出登录"));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "登录 / 注册" })).toBeTruthy();
    });
    expect(screen.queryByText("demo")).toBeNull();
  });
});

describe("首页 CTA · 会话状态", () => {
  it("未登录：注册引导文案 + 主按钮指向登录页", async () => {
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("注册账号，开启你的非遗探索之旅")).toBeTruthy();
    });
    expect(screen.getByText("加入纹藏")).toBeTruthy();
    const cta = screen.getByRole("link", { name: "立即注册" });
    expect(cta.getAttribute("href")).toBe("/login");
    expect(screen.queryByText("进入我的纹藏")).toBeNull();
  });

  it("已登录：欢迎语 + 主按钮变为「进入我的纹藏」指向 /profile，副按钮保留", async () => {
    await signIn("demo@miaoda.com", "demo123456");
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("继续你的非遗探索之旅")).toBeTruthy();
    });
    const cta = screen.getByRole("link", { name: "进入我的纹藏" });
    expect(cta.getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("link", { name: "体验AI工坊" })).toBeTruthy();
    // 副标题带出用户名，且不再出现注册引导
    expect(screen.getByText(/demo，你保存的 AI 纹样/)).toBeTruthy();
    expect(screen.queryByText("注册账号，开启你的非遗探索之旅")).toBeNull();
  });

  it("退出登录后首页 CTA 立即退回未登录文案", async () => {
    await signIn("demo@miaoda.com", "demo123456");
    renderHome();
    await waitFor(() => expect(screen.getByText("继续你的非遗探索之旅")).toBeTruthy());

    await supabase.auth.signOut();
    await waitFor(() => {
      expect(screen.getByText("注册账号，开启你的非遗探索之旅")).toBeTruthy();
    });
    expect(screen.queryByText("继续你的非遗探索之旅")).toBeNull();
  });
});
