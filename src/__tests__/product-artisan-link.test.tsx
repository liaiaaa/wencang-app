import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { render, fireEvent, waitFor, cleanup, type RenderResult } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { supabase } from "@/db/supabase";
import {
  createProduct,
  updateProduct,
  fetchProducts,
  fetchProductById,
  fetchAllArtisansAdmin,
  fetchAllProductsAdmin,
  type ProductInput,
} from "@/lib/api";
import {
  resolveArtisanLink,
  backfillArtisanLinks,
  keepLiveArtisanLinks,
} from "@/lib/productLink";
import ShopPage from "@/pages/ShopPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import type { Artisan, Product } from "@/types/types";

/* ============================================================
 * P1：商品「关联守艺人」下拉联动 artisan_id
 *
 * 三层断言：
 *  1) 关联纯函数 —— 下拉只产出 id，name 由列表派生；老数据按 name 反查
 *  2) 数据层     —— 管理员写入后两列一致；无效 id 不进前台
 *  3) 前台渲染   —— 有 id 才可点，无 id / 无效 id 保持纯文本且不报错
 * ============================================================ */

const A_MIAO = "a0000001-0000-4000-8000-000000000001"; // 苗绣 · 潘阿秀
const A_WAX = "a0000002-0000-4000-8000-000000000002"; // 蜡染 · 韦小凤
const PRODUCT_OF_A_MIAO = "g0000002-0000-4000-8000-000000000002"; // 蝴蝶妈妈绣片摆件

const asAdmin = () =>
  supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });

const resetMockDb = () =>
  (window as unknown as { __wenzangMock: { reset: () => void } }).__wenzangMock.reset();

/** 直接写库，用于构造「只有 artisan_name 的老数据」「无效 id」等异常形态 */
const insertRawProduct = async (row: Record<string, unknown>): Promise<string> => {
  const { error, data } = await supabase.from("products").insert(row);
  if (error) throw error;
  const created = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (!created?.id) throw new Error("商品插入失败");
  return created.id;
};

const baseProduct = {
  name: "验收商品·靛蓝绣片",
  price: 388,
  craft_description: "用于 P1 验收的商品工艺说明",
  image_url: "data:image/png;base64,AAAA",
};

/* ---------------- 1. 关联纯函数 ---------------- */

describe("P1 · 守艺人关联派生", () => {
  const artisans = [
    { id: A_MIAO, name: "潘阿秀" },
    { id: A_WAX, name: "韦小凤" },
  ];

  it("下拉选中守艺人后同时产出 artisan_id 与一致的 artisan_name", () => {
    expect(resolveArtisanLink(A_MIAO, artisans)).toEqual({
      artisan_id: A_MIAO,
      artisan_name: "潘阿秀",
    });
  });

  it("未选择（空串/空白/null）即未关联，两列一并清空", () => {
    for (const raw of ["", "   ", null, undefined]) {
      expect(resolveArtisanLink(raw, artisans, "旧名字")).toEqual({
        artisan_id: null,
        artisan_name: "",
      });
    }
  });

  it("守艺人不在列表（已归档/被删）时保留原有名字，不静默丢数据", () => {
    expect(resolveArtisanLink("a-gone", artisans, "韦小凤")).toEqual({
      artisan_id: "a-gone",
      artisan_name: "韦小凤",
    });
  });

  it("老数据按 artisan_name 反查补齐 id，查不到的保持原样且不报错", () => {
    const rows: { artisan_id?: string | null; artisan_name?: string }[] = [
      { artisan_id: null, artisan_name: "韦小凤" }, // 可反查
      { artisan_id: null, artisan_name: "查无此人" }, // 不可反查
      { artisan_id: A_MIAO, artisan_name: "" }, // 反向补名字
      {}, // 两列皆缺
    ];
    expect(() => backfillArtisanLinks(rows, artisans)).not.toThrow();
    expect(rows[0].artisan_id).toBe(A_WAX);
    expect(rows[1].artisan_id).toBeNull();
    expect(rows[1].artisan_name).toBe("查无此人");
    expect(rows[2].artisan_name).toBe("潘阿秀");
    expect(rows[3]).toEqual({});
  });

  it("前台只保留指向在架守艺人的关联，无效 id 清空为未关联", () => {
    const live = new Set<string>([A_MIAO]);
    const rows: Pick<Product, "id" | "artisan_id" | "artisan_name">[] = [
      { id: "1", artisan_id: A_MIAO, artisan_name: "潘阿秀" },
      { id: "2", artisan_id: "a-not-exist", artisan_name: "已消失的守艺人" },
      { id: "3", artisan_id: null, artisan_name: "老数据守艺人" },
    ];
    const out = keepLiveArtisanLinks(rows, live);
    expect(out[0].artisan_id).toBe(A_MIAO);
    expect(out[1].artisan_id).toBeNull();
    expect(out[1].artisan_name).toBe("已消失的守艺人"); // 只断链，不丢名字
    expect(out[2].artisan_id).toBeNull();
    expect(out[0]).toBe(rows[0]); // 有效行原样返回，不做多余拷贝
  });
});

/* ---------------- 2. 数据层写入与读取 ---------------- */

describe("P1 · 数据层关联一致性", () => {
  let admins: Artisan[] = [];

  beforeEach(async () => {
    await supabase.auth.signOut();
    resetMockDb();
    await asAdmin();
    admins = await fetchAllArtisansAdmin();
  });

  afterEach(() => cleanup());

  /** 与 AdminDashboardPage 的提交链路一致：表单只给 artisan_id，name 由列表派生 */
  const submitFromDropdown = (artisan_id: string | null, staleName = "") => {
    // staleName 模拟编辑态残留的旧名字，派生值必须覆盖它
    const form: ProductInput = { ...baseProduct, artisan_id, artisan_name: staleName };
    return createProduct({ ...form, ...resolveArtisanLink(form.artisan_id, admins) });
  };

  it("管理员创建商品时 artisan_id 与 artisan_name 一并正确写入", async () => {
    // 表单里残留的旧名字会被下拉选中的守艺人覆盖，两列不可能各说各话
    const created = await submitFromDropdown(A_MIAO, "手填的旧名字");
    expect(created.artisan_id).toBe(A_MIAO);
    expect(created.artisan_name).toBe("潘阿秀");

    const row = (await fetchProducts()).find((p) => p.id === created.id);
    expect(row?.artisan_id).toBe(A_MIAO);
    expect(row?.artisan_name).toBe(admins.find((a) => a.id === A_MIAO)?.name);
  });

  it("不关联守艺人也能建商品，两列落空且不报错", async () => {
    const created = await submitFromDropdown(null);
    expect(created.artisan_id).toBeNull();
    expect(created.artisan_name).toBe("");
    const row = (await fetchProducts()).find((p) => p.id === created.id);
    expect(row?.artisan_id).toBeNull();
  });

  it("仅有 artisan_name 的老数据：后台可反查补齐 id，但读取不擅自写库", async () => {
    const id = await insertRawProduct({ ...baseProduct, artisan_name: "韦小凤" });

    const adminRow = (await fetchAllProductsAdmin()).find((p) => p.id === id);
    expect(adminRow?.artisan_id).toBe(A_WAX); // 后台下拉能正确回显

    // 补齐只发生在读取层，前台仍视为未关联
    const publicRow = (await fetchProducts()).find((p) => p.id === id);
    expect(publicRow?.artisan_id ?? null).toBeNull();
    expect(publicRow?.artisan_name).toBe("韦小凤");

    // 管理员保存后 id 才真正落库
    await updateProduct(id, resolveArtisanLink(adminRow?.artisan_id, admins));
    expect((await fetchProductById(id))?.artisan_id).toBe(A_WAX);
  });

  it("名字反查不到时 artisan_id 保持 null，前后端都不报错", async () => {
    const id = await insertRawProduct({ ...baseProduct, artisan_name: "查无此人" });

    const adminRow = (await fetchAllProductsAdmin()).find((p) => p.id === id);
    expect(adminRow?.artisan_id ?? null).toBeNull();
    expect(adminRow?.artisan_name).toBe("查无此人");
    expect((await fetchProductById(id))?.artisan_id ?? null).toBeNull();
  });

  it("无效 artisan_id 不会流到前台；后台保留原值以便修正", async () => {
    const id = await insertRawProduct({
      ...baseProduct,
      artisan_id: "a-not-exist",
      artisan_name: "已消失的守艺人",
    });

    expect((await fetchProductById(id))?.artisan_id).toBeNull();
    expect((await fetchProducts()).find((p) => p.id === id)?.artisan_id).toBeNull();

    const adminRow = (await fetchAllProductsAdmin()).find((p) => p.id === id);
    expect(adminRow?.artisan_id).toBe("a-not-exist"); // 原值仍在，管理员可改回正确守艺人
    expect(adminRow?.artisan_name).toBe("已消失的守艺人");
  });

  it("守艺人归档后，其商品在前台回落为纯文本", async () => {
    const id = await insertRawProduct({
      ...baseProduct,
      artisan_id: A_MIAO,
      artisan_name: "潘阿秀",
    });
    expect((await fetchProductById(id))?.artisan_id).toBe(A_MIAO);

    await supabase.from("artisans").update({ status: "archived" }).eq("id", A_MIAO);
    const after = await fetchProductById(id);
    expect(after?.artisan_id).toBeNull();
    expect(after?.artisan_name).toBe("潘阿秀"); // 名字保留，仅去掉跳转
  });
});

/* ---------------- 3. 前台渲染 ---------------- */

describe("P1 · 前台守艺人跳转", () => {
  let consoleErrors: string[] = [];
  let spy: MockInstance;

  const watchConsoleError = () => {
    spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      consoleErrors.push(String(args[0]));
    });
  };
  /** 未包在 act() 里的异步 setState 告警属测试环境问题，不代表页面报错 */
  const realErrors = () => consoleErrors.filter((e) => !/not wrapped in act/.test(e));

  const renderAt = (path: string): RenderResult =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/shop/:id" element={<ProductDetailPage />} />
            <Route path="/artisans/:id" element={<div>守艺人档案页</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

  /** 商城卡片里的「出自 · X」那一行 */
  const artisanLines = (container: HTMLElement, name: string) =>
    Array.from(container.querySelectorAll("p")).filter((p) => p.textContent === `出自 · ${name}`);

  /** React 的 onClick 不体现在 DOM 上；渲染出独立节点即为可点击，纯文本则无子节点 */
  const isClickable = (line: Element) => line.children.length > 0;

  beforeEach(async () => {
    await supabase.auth.signOut();
    resetMockDb();
    consoleErrors = [];
  });

  afterEach(() => {
    spy.mockRestore();
    cleanup();
  });

  it("商品详情页的守艺人姓名渲染为跳转链接", async () => {
    watchConsoleError();
    const { container } = renderAt(`/shop/${PRODUCT_OF_A_MIAO}`);
    const href = `a[href="/artisans/${A_MIAO}"]`;
    await waitFor(() => {
      expect(container.querySelector(href)).toBeTruthy();
    });
    expect(container.querySelector(href)?.textContent).toContain("潘阿秀");
    expect(realErrors()).toHaveLength(0);
  });

  it("商城卡片点击守艺人姓名跳转到其档案页，而不是商品详情页", async () => {
    watchConsoleError();
    const { container } = renderAt("/shop");
    await waitFor(() => {
      expect(artisanLines(container, "韦小凤")).toHaveLength(1);
    });
    const line = artisanLines(container, "韦小凤")[0];
    expect(isClickable(line)).toBe(true);

    fireEvent.click(line.firstElementChild as Element);
    await waitFor(() => {
      expect(container.textContent).toContain("守艺人档案页");
    });
    // 守艺人链接生效，未顺带跳到商品详情
    expect(container.textContent).not.toContain("工艺说明");
    expect(realErrors()).toHaveLength(0);
  });

  it("老数据（只有 artisan_name）在商城与详情页均显示纯文本、不报错", async () => {
    await asAdmin();
    const id = await insertRawProduct({ ...baseProduct, artisan_name: "韦小凤" });
    watchConsoleError();

    const { container } = renderAt("/shop");
    await waitFor(() => {
      // 种子商品（已关联）+ 老数据（未关联）同名同行出现，仅前者可点
      expect(artisanLines(container, "韦小凤")).toHaveLength(2);
    });
    const lines = artisanLines(container, "韦小凤");
    expect(lines.filter(isClickable)).toHaveLength(1);
    expect(lines.filter((l) => !isClickable(l))).toHaveLength(1);

    const detail = renderAt(`/shop/${id}`);
    await waitFor(() => {
      expect(detail.container.textContent).toContain("验收商品·靛蓝绣片");
    });
    expect(detail.container.textContent).toContain("出自 · 韦小凤");
    expect(detail.container.querySelector('a[href^="/artisans/"]')).toBeNull();
    expect(realErrors()).toHaveLength(0);
  });

  it("无效 artisan_id 不渲染链接，保持纯文本且页面正常", async () => {
    await asAdmin();
    const id = await insertRawProduct({
      ...baseProduct,
      artisan_id: "a-not-exist",
      artisan_name: "已消失的守艺人",
    });
    watchConsoleError();

    const { container } = renderAt(`/shop/${id}`);
    await waitFor(() => {
      expect(container.textContent).toContain("验收商品·靛蓝绣片");
    });
    expect(container.textContent).toContain("出自 · 已消失的守艺人");
    expect(container.querySelector('a[href^="/artisans/"]')).toBeNull();
    expect(realErrors()).toHaveLength(0);
  });
});
