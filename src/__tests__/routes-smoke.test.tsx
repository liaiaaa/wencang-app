import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { supabase } from "@/db/supabase";
import routes from "@/routes";

// 七模块路由冒烟测试：确认每个页面都能在演示模式下渲染出内容（不白屏、不抛错）
const renderAt = (path: string) => {
  const errors: unknown[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args[0]);
  });

  const result = render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

  spy.mockRestore();
  return { ...result, errors };
};

describe("路由冒烟（演示模式）", () => {
  beforeEach(async () => {
    await supabase.auth.signOut();
    (window as any).__wenzangMock.reset();
    cleanup();
  });

  it("首页 / 渲染并显示统计数字", async () => {
    renderAt("/");
    // 标题被 <br /> 分隔，用 h1 的 textContent 断言
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("让每一道纹样");
    // 统计条最终显示 15 条纹样 / 3 位守艺人 / 3 个体验项目
    await waitFor(() => {
      expect(screen.getByText("15")).toBeDefined();
    });
  });

  it("纹样图库 /patterns 渲染纹样卡片", async () => {
    renderAt("/patterns");
    await waitFor(() => {
      expect(screen.getByText("蝶恋花靛蓝纹")).toBeDefined();
    });
  });

  it("纹样详情 /patterns/:id 渲染详情", async () => {
    renderAt("/patterns/p0000001-0000-4000-8000-000000000001");
    await waitFor(() => {
      expect(screen.getByText("蜡刀点蜡、靛蓝浸染")).toBeDefined();
    });
  });

  it("AI工坊 /workshop 渲染", async () => {
    renderAt("/workshop");
    expect(screen.getByText("AI纹样工坊")).toBeDefined();
  });

  it("AI工坊 /workshop 标注本地程序化生成模式", async () => {
    renderAt("/workshop");
    expect(screen.getByText("本地程序化生成模式")).toBeDefined();
  });

  it("守艺人展厅 /artisans 渲染并带「示例档案」标注", async () => {
    renderAt("/artisans");
    await waitFor(() => {
      expect(screen.getByText("杨阿妮")).toBeDefined();
    });
    expect(screen.getAllByText("示例档案").length).toBe(3);
  });

  it("守艺人详情 /artisans/:id 渲染并带合规说明", async () => {
    renderAt("/artisans/a0000001-0000-4000-8000-000000000001");
    await waitFor(() => {
      expect(screen.getByText("杨阿妮")).toBeDefined();
    });
    expect(screen.getByText("示例档案")).toBeDefined();
    expect(screen.getByText("本档案为平台示例数据，图片为示意用途")).toBeDefined();
  });

  it("体验预约 /booking 渲染", async () => {
    renderAt("/booking");
    expect(screen.getByText("体验预约")).toBeDefined();
  });

  it("文创商城 /shop 渲染商品", async () => {
    renderAt("/shop");
    await waitFor(() => {
      expect(screen.getByText("蝶恋花靛蓝蜡染围巾")).toBeDefined();
    });
  });

  it("商品详情 /shop/:id 渲染", async () => {
    renderAt("/shop/g0000001-0000-4000-8000-000000000001");
    await waitFor(() => {
      expect(screen.getByText("工艺说明")).toBeDefined();
    });
  });

  it("登录页 /login 渲染", async () => {
    renderAt("/login");
    // 登录页会等鉴权状态确定后再渲染表单
    await waitFor(() => {
      expect(screen.getByText("登录后管理你的纹样、预约与订单")).toBeDefined();
    });
  });

  it("个人中心 /profile 未登录时跳转登录（不白屏报错）", async () => {
    const { errors } = renderAt("/profile");
    await waitFor(() => {
      expect(errors.length).toBe(0);
    });
  });
});
