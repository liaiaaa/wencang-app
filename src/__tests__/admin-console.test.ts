import { describe, it, expect, beforeEach } from "vitest";
import { supabase } from "@/db/supabase";
import {
  createPattern,
  updatePattern,
  archivePattern,
  restorePattern,
  fetchAllPatternsAdmin,
  fetchPatterns,
  fetchPlatformStats,
  createArtisan,
  archiveArtisan,
  createProduct,
  archiveProduct,
  fetchProducts,
  fetchAdminOverview,
} from "@/lib/api";
import {
  track,
  getEvents,
  clearEvents,
  getDailyTrend,
  getTopPatterns,
  countByEvent,
  dayKey,
  MAX_EVENTS,
} from "@/lib/analytics";

const login = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

const asAdmin = () => login("admin@miaoda.com", "wencang2026");
const asUser = () => login("demo@miaoda.com", "demo123456");

const newPattern = {
  name: "测试纹样·铜鼓云雷",
  category: "蜡染" as const,
  region: "贵州 · 测试",
  technique: "蜡刀点蜡",
  meaning: "用于自动化测试的纹样寓意",
  image_url: "data:image/png;base64,AAAA",
};

describe("管理后台 · 权限校验", () => {
  beforeEach(async () => {
    await supabase.auth.signOut();
    (window as any).__wenzangMock.reset();
  });

  it("普通用户调用写接口被拒绝（403）", async () => {
    await asUser();
    await expect(createPattern(newPattern)).rejects.toMatchObject({ code: "403" });
  });

  it("未登录调用写接口被拒绝（401）", async () => {
    await supabase.auth.signOut();
    await expect(createPattern(newPattern)).rejects.toMatchObject({ code: "401" });
  });

  it("管理员可正常写入", async () => {
    await asAdmin();
    const created = await createPattern(newPattern);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe(newPattern.name);
  });
});

describe("管理后台 · 纹样 CRUD", () => {
  beforeEach(async () => {
    await supabase.auth.signOut();
    (window as any).__wenzangMock.reset();
    await asAdmin();
  });

  it("新建纹样后出现在前台图库与统计中", async () => {
    const before = await fetchPlatformStats();
    await createPattern(newPattern);

    const adminList = await fetchAllPatternsAdmin();
    expect(adminList.some((p) => p.name === newPattern.name)).toBe(true);

    // 前台图库可见（未归档）
    const publicList = await fetchPatterns();
    expect(publicList.some((p) => p.name === newPattern.name)).toBe(true);

    // 首页统计条 +1
    const after = await fetchPlatformStats();
    expect(after.patternCount).toBe(before.patternCount + 1);
  });

  it("编辑纹样寓意后详情数据同步更新", async () => {
    const created = await createPattern(newPattern);
    await updatePattern(created.id, { meaning: "修改后的寓意文案" });

    const list = await fetchAllPatternsAdmin();
    const found = list.find((p) => p.id === created.id);
    expect(found?.meaning).toBe("修改后的寓意文案");
  });

  it("归档后前台图库不再展示，管理列表仍可见且可恢复", async () => {
    const created = await createPattern(newPattern);
    await archivePattern(created.id);

    const publicList = await fetchPatterns();
    expect(publicList.some((p) => p.id === created.id)).toBe(false);

    const adminList = await fetchAllPatternsAdmin();
    const archived = adminList.find((p) => p.id === created.id);
    expect(archived?.status).toBe("archived");

    await restorePattern(created.id);
    const afterRestore = await fetchPatterns();
    expect(afterRestore.some((p) => p.id === created.id)).toBe(true);
  });

  it("守艺人与商品同样支持新建与归档", async () => {
    const artisan = await createArtisan({
      name: "测试守艺人",
      title: "测试称号",
      region: "测试地区",
      craft: "扎染",
      works: "测试作品",
      bio: "测试简介",
      image_url: "data:image/png;base64,AAAA",
    });
    expect(artisan.id).toBeTruthy();
    await archiveArtisan(artisan.id);

    const product = await createProduct({
      name: "测试商品",
      price: 199,
      craft_description: "测试工艺说明",
      artisan_id: artisan.id,
      artisan_name: "测试守艺人",
      image_url: "data:image/png;base64,AAAA",
    });
    expect(product.id).toBeTruthy();
    await archiveProduct(product.id);

    const products = await fetchProducts();
    expect(products.some((p) => p.id === product.id)).toBe(false);
  });

  it("看板统计与实际数据一致", async () => {
    const before = await fetchAdminOverview();
    await createPattern(newPattern);
    const after = await fetchAdminOverview();

    expect(after.patternCount).toBe(before.patternCount + 1);

    const list = await fetchAllPatternsAdmin();
    const live = list.filter((p) => p.status !== "archived").length;
    expect(after.patternCount).toBe(live);
  });
});

describe("运营埋点 · 记录与聚合", () => {
  beforeEach(() => {
    clearEvents();
  });

  it("记录事件并可按事件名计数", () => {
    expect(getEvents()).toHaveLength(0);

    track("pattern_view", { name: "蝶恋花靛蓝纹" });
    track("pattern_view", { name: "蝶恋花靛蓝纹" });
    track("booking_submit", { artisan: "韦祖英" });

    expect(getEvents()).toHaveLength(3);
    expect(countByEvent("pattern_view")).toBe(2);
    expect(countByEvent("booking_submit")).toBe(1);
    expect(countByEvent("shop_order")).toBe(0);
  });

  it("环形缓冲不超过 2000 条，保留最新记录", () => {
    for (let i = 0; i < MAX_EVENTS + 50; i++) {
      track("pattern_search", { keyword: `关键词${i}` });
    }
    const events = getEvents();
    expect(events).toHaveLength(MAX_EVENTS);
    // 最旧的 50 条被丢弃，最后一条仍在
    expect(events[events.length - 1].payload.keyword).toBe(`关键词${MAX_EVENTS + 49}`);
    expect(events[0].payload.keyword).toBe("关键词50");
  });

  it("趋势聚合返回连续 7 天并正确分桶", () => {
    const now = new Date();
    track("booking_submit", {});
    track("workshop_generate", { theme: "蝴蝶妈妈" });
    track("workshop_generate", { theme: "铜鼓" });

    const trend = getDailyTrend(7, now);
    expect(trend).toHaveLength(7);
    // 日期连续升序
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].date > trend[i - 1].date).toBe(true);
    }
    const today = trend.find((d) => d.date === dayKey(now));
    expect(today?.booking).toBe(1);
    expect(today?.generate).toBe(2);
  });

  it("热门纹样 TOP5 由浏览与搜索聚合，按次数降序", () => {
    track("pattern_view", { name: "蝴蝶妈妈绣" });
    track("pattern_view", { name: "蝴蝶妈妈绣" });
    track("pattern_view", { name: "蝴蝶妈妈绣" });
    track("pattern_view", { name: "云纹扎染布" });
    track("pattern_search", { keyword: "云纹扎染布" });
    track("pattern_search", { keyword: "铜鼓纹" });

    const top = getTopPatterns(5);
    expect(top[0]).toEqual({ name: "蝴蝶妈妈绣", count: 3 });
    expect(top[1]).toEqual({ name: "云纹扎染布", count: 2 });
    expect(top[2]).toEqual({ name: "铜鼓纹", count: 1 });
    expect(top.length).toBeLessThanOrEqual(5);
  });

  it("空数据时聚合不报错", () => {
    expect(getDailyTrend(7)).toHaveLength(7);
    expect(getTopPatterns(5)).toEqual([]);
    expect(getEvents()).toEqual([]);
  });
});
