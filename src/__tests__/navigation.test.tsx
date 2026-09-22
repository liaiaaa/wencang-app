import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import ScrollManager from "@/components/common/ScrollManager";
import useGoBack from "@/hooks/use-go-back";
import PatternDetailPage from "@/pages/PatternDetailPage";
import { supabase } from "@/db/supabase";
import { pickRelatedPatterns } from "@/lib/related";
import { MOCK_PATTERNS } from "@/db/mockData";
import type { Pattern } from "@/types/types";

/* ============================================================
 * Bug 修复回归 · 滚动编排（进入新页面回顶 / 返回列表恢复位置）
 * 与详情页切换 id 时的重挂载
 * ============================================================ */

const A = "p0000001-0000-4000-8000-000000000001"; // 蝶恋花靛蓝纹
const B = "p0000004-0000-4000-8000-000000000004"; // 铜鼓纹蜡染

/** jsdom 里 window.scrollY 恒为 0，用可写的假值模拟"用户滚到了某处" */
let fakeY = 0;
let scrollTo: MockInstance;

const scrollWindowTo = (y: number) => {
  fakeY = y;
  fireEvent.scroll(window);
};

function ListPage() {
  return (
    <div>
      图库页
      <Link to="/artisans">去守艺人</Link>
      <Link to="/patterns?tab=archive">改查询参数</Link>
      <Link to="/detail/a1">进详情</Link>
    </div>
  );
}

function DetailPage() {
  const navigate = useNavigate();
  const goBack = useGoBack("/list-missing");
  return (
    <div>
      详情页
      {/* 模拟浏览器后退键：这是一次 POP 导航 */}
      <button onClick={() => navigate(-1)}>浏览器后退</button>
      <button onClick={goBack}>返回按钮</button>
    </div>
  );
}

function Nav({ initial = "/patterns" }: { initial?: string }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <ScrollManager />
      <Routes>
        <Route path="/patterns" element={<ListPage />} />
        <Route path="/artisans" element={<div>守艺人页</div>} />
        <Route path="/detail/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  fakeY = 0;
  sessionStorage.clear();
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => fakeY });
  scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((_x?: unknown, y?: number) => {
    if (typeof y === "number") fakeY = y;
  });
});

afterEach(() => {
  scrollTo.mockRestore();
  cleanup();
});

describe("ScrollManager · 进入新页面滚回顶部", () => {
  it("首次挂载不抢浏览器的滚动恢复", () => {
    render(<Nav />);
    expect(screen.getByText("图库页")).toBeDefined();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("pathname 变化时把窗口滚回 (0,0)", () => {
    render(<Nav />);
    scrollWindowTo(800);
    fireEvent.click(screen.getByText("去守艺人"));
    expect(screen.getByText("守艺人页")).toBeDefined();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(fakeY).toBe(0);
  });

  it("只改查询参数（后台 / 个人中心切 tab）同样复位", () => {
    render(<Nav />);
    scrollWindowTo(400);
    fireEvent.click(screen.getByText("改查询参数"));
    expect(screen.getByText("图库页")).toBeDefined();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("同一地点重复渲染不会反复滚动页面", () => {
    const { rerender } = render(<Nav />);
    fireEvent.click(screen.getByText("去守艺人"));
    const calls = scrollTo.mock.calls.length;
    rerender(<Nav />);
    expect(scrollTo).toHaveBeenCalledTimes(calls);
  });
});

describe("ScrollManager · 返回列表恢复原浏览位置", () => {
  it("下滑 → 进详情 → 后退：恢复到离开时的位置，而不是顶部", async () => {
    render(<Nav />);
    scrollWindowTo(1234);
    fireEvent.click(screen.getByText("进详情"));
    expect(screen.getByText("详情页")).toBeDefined();
    expect(fakeY).toBe(0); // 进入新页面仍然回顶

    fireEvent.click(screen.getByText("浏览器后退"));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 1234));
    expect(fakeY).toBe(1234);
  });

  it("点详情页的「返回」按钮（内部即 navigate(-1)）同样恢复位置", async () => {
    // BrowserRouter 会维护 history.state.idx；这里补上，让 useGoBack 走真正的历史后退
    Object.defineProperty(window.history, "state", { configurable: true, value: { idx: 2 } });
    render(<Nav />);
    scrollWindowTo(777);
    fireEvent.click(screen.getByText("进详情"));
    fireEvent.click(screen.getByText("返回按钮"));
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 777));
    Object.defineProperty(window.history, "state", { configurable: true, value: null });
  });

  it("没有可退的历史时，返回按钮 fallback 到列表路径并滚到顶部", () => {
    // MemoryRouter 不维护 history.state.idx，这里显式给出 idx=0 表示"这就是第一条历史"
    Object.defineProperty(window.history, "state", { configurable: true, value: { idx: 0 } });
    render(
      <MemoryRouter initialEntries={["/detail/x9"]}>
        <ScrollManager />
        <Routes>
          <Route path="/detail/:id" element={<DetailPage />} />
          <Route path="/list-missing" element={<div>兜底列表页</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("返回按钮"));
    expect(screen.getByText("兜底列表页")).toBeDefined();
    expect(screen.queryByText("详情页")).toBeNull();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    Object.defineProperty(window.history, "state", { configurable: true, value: null });
  });
});

describe("纹样详情页 · 切换 id 时不残留上一篇", () => {
  /** 单个 Router 实例内部做 A→B 跳转，才能真正复现"组件被复用"的场景 */
  function Inner() {
    const nav = useNavigate();
    return (
      <>
        <button onClick={() => nav(`/patterns/${B}`)}>跳到B</button>
        <Routes>
          <Route path="/patterns/:id" element={<PatternDetailPage />} />
        </Routes>
      </>
    );
  }

  beforeEach(async () => {
    await supabase.auth.signOut();
    (window as unknown as { __wenzangMock: { reset: () => void } }).__wenzangMock.reset();
  });

  afterEach(() => cleanup());

  it("从 A 跳到 B 后主内容换成 B，且相关纹样无重复条目", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={[`/patterns/${A}`]}>
        <Inner />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toContain("蝶恋花靛蓝纹");
    });

    fireEvent.click(screen.getByText("跳到B"));
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toContain("铜鼓纹蜡染");
    });
    // 主内容必须整体换成 B：只要还留着 A 的标题，就是"组件复用导致旧 state 残留"
    expect(container.querySelector("h1")?.textContent).not.toContain("蝶恋花靛蓝纹");

    const hrefs = [...container.querySelectorAll('a[href^="/patterns/"]')].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length); // 相关纹样卡片不重复
    expect(hrefs).not.toContain(`/patterns/${B}`); // 不推荐自己
  });
});

describe("种子数据 · related_patterns 自检", () => {
  it("每条纹样的显式关联都不含自身、不重复、且指向存在的纹样", () => {
    const ids = new Set(MOCK_PATTERNS.map((x) => x.id));
    const bad: string[] = [];
    for (const item of MOCK_PATTERNS) {
      const rel = item.related_patterns ?? [];
      if (rel.includes(item.id)) bad.push(`${item.name} 自指`);
      if (new Set(rel).size !== rel.length) bad.push(`${item.name} 有重复 id`);
      for (const r of rel) if (!ids.has(r)) bad.push(`${item.name} 指向不存在的 ${r}`);
    }
    expect(bad).toEqual([]);
  });

  it("全量纹样两两推荐结果都满足不变量", () => {
    const all = MOCK_PATTERNS as Pattern[];
    for (const item of all) {
      const got = pickRelatedPatterns(all, item.id, 3);
      const gotIds = got.map((x) => x.id);
      expect(gotIds).not.toContain(item.id);
      expect(new Set(gotIds).size).toBe(gotIds.length);
      expect(gotIds.length).toBeLessThanOrEqual(3);
    }
  });
});
