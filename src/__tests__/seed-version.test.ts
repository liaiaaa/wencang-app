import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
 * 任务包 4 · 种子版本化与演示数据重置
 *
 * 每次 boot() 都 resetModules() 重新求值 mock 模块，
 * 等价于"关掉页面重新打开"——版本判定就发生在这一步。
 * ============================================================ */

const DB_KEY = "wenzang.mock.db.v1";
const SEED_KEY = "wenzang.mock.seed.v1";

async function boot() {
  vi.resetModules();
  const api = await import("@/lib/api.ts");
  const mock = await import("@/db/supabase.mock.ts");
  return { api, mock, supabase: mock.supabase };
}

const fakePattern = (n: number) => ({
  id: `old-${n}`,
  name: `旧纹样${n}`,
  category: "蜡染",
  region: "贵州 · 丹寨",
  technique: "蜡刀点蜡",
  meaning: "升级前的存量记录",
  image_url: "data:image/png;base64,AAAA",
  created_at: "2024-01-01T00:00:00.000Z",
});

/** 构造一份"上个版本"的存量库：内容表只有几条旧记录，另有用户与预约 */
function plantLegacyDb() {
  localStorage.setItem(
    DB_KEY,
    JSON.stringify({
      patterns: [fakePattern(1), fakePattern(2)],
      artisans: [
        {
          id: "old-a1",
          name: "旧守艺人",
          title: "示例",
          region: "贵州",
          craft: "蜡染",
          works: "x",
          bio: "x",
          image_url: "x",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      products: [],
      experience_projects: [{ id: "old-p1", name: "旧体验", artisan_id: null, description: "x", duration: "半天", created_at: "2024-01-01T00:00:00.000Z" }],
      bookings: [
        {
          id: "keep-b1",
          user_id: "u-demo-0001",
          artisan_id: "gone-artisan",
          project_id: "gone-project",
          artisan_name: "已不存在的守艺人",
          project_name: "已下架的体验项目",
          book_date: "2025-04-01",
          time_slot: "上午",
          contact_name: "老用户",
          contact_phone: "13800000009",
          status: "待确认",
          created_at: "2025-03-01T00:00:00.000Z",
        },
      ],
      orders: [],
      ai_patterns: [],
      profiles: [{ id: "u-old-0001", email: "old@miaoda.com", role: "user", created_at: "2024-01-01T00:00:00.000Z" }],
    }),
  );
}

const readDb = () => JSON.parse(localStorage.getItem(DB_KEY) || "null");

describe("种子版本化 · 存量数据自动升级", () => {
  beforeEach(() => localStorage.clear());

  it("版本号落后时重建内容表，用户账号与预约原样保留", async () => {
    plantLegacyDb();
    localStorage.setItem(SEED_KEY, "1"); // 上个版本

    const { supabase } = await boot();
    const db = readDb();

    expect(await supabase.from("patterns").select("id").then((r: any) => r.data.length)).toBe(45);
    expect(db.patterns.length).toBe(45);
    expect(db.artisans.length).toBe(10);
    expect(db.products.length).toBe(10);
    expect(db.experience_projects.length).toBe(7);
    expect(db.patterns.some((p: { id: string }) => p.id === "old-1")).toBe(false);

    // 用户数据不动
    expect(db.bookings.map((b: { id: string }) => b.id)).toEqual(["keep-b1"]);
    expect(db.profiles.map((p: { id: string }) => p.id)).toEqual(["u-old-0001"]);
    // 版本已推进
    expect(Number(localStorage.getItem(SEED_KEY))).toBe((await import("@/db/mockData.ts")).SEED_VERSION);
  });

  it("本地从未记版本（老构建留下的数据）同样按落后处理", async () => {
    plantLegacyDb();
    expect(localStorage.getItem(SEED_KEY)).toBeNull();

    await boot();
    expect(readDb().patterns.length).toBe(45);
  });

  it("版本一致时不重建：管理员改过的内容仍然算数", async () => {
    const { SEED_VERSION } = await import("@/db/mockData.ts");
    plantLegacyDb();
    localStorage.setItem(SEED_KEY, String(SEED_VERSION));

    await boot();
    const db = readDb();
    expect(db.patterns.map((p: { id: string }) => p.id)).toEqual(["old-1", "old-2"]);
    expect(db.artisans.length).toBe(1);
  });

  it("升级后的老数据预约仍能显示（引用已不存在的项目时靠冗余名称降级）", async () => {
    plantLegacyDb();
    localStorage.setItem(SEED_KEY, "1");

    const { supabase, api } = await boot();
    await supabase.auth.signInWithPassword({ email: "demo@miaoda.com", password: "demo123456" });
    const rows = await api.fetchMyBookings();
    const kept = rows.find((b: { id: string }) => b.id === "keep-b1");
    expect(kept).toBeTruthy();
    // 项目与守艺人都已不在新种子里，但预约本身与展示名称完好
    expect(kept?.project_name).toBe("已下架的体验项目");
    expect(kept?.artisan_name).toBe("已不存在的守艺人");
    expect(kept?.status).toBe("待确认");
  });
});

describe("演示数据重置 · 运营后台「重置演示数据」", () => {
  beforeEach(() => localStorage.clear());

  it("管理员重置后内容回到初始种子，账号与预约保留", async () => {
    const { supabase, api } = await boot();
    await supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });

    // 先制造脏数据：改一条纹样、新建一条纹样、注册一个新用户、提一条预约
    const list = await api.fetchAllPatternsAdmin();
    const victim = list.find((p: { name: string }) => p.name === "蝶恋花靛蓝纹")!;
    await api.updatePattern(victim.id, { meaning: "被改过的寓意" });
    await api.createPattern({
      name: "脏数据纹样",
      category: "蜡染",
      region: "测试",
      technique: "测试",
      meaning: "测试",
      image_url: "data:image/png;base64,AAAA",
    });
    await supabase.auth.signUp({ email: "qa_reset@miaoda.com", password: "qa123456" });
    await api.createBooking({
      artisan_id: "a0000002-0000-4000-8000-000000000002",
      artisan_name: "韦小凤",
      project_id: "e0000002-0000-4000-8000-000000000002",
      project_name: "蜡染工艺体验：蜡刀点蜡与靛染",
      book_date: "2025-05-01",
      time_slot: "全天 09:00-16:00",
      contact_name: "重置测试",
      contact_phone: "13800000008",
    });
    expect((await api.fetchAllPatternsAdmin()).some((p: { name: string }) => p.name === "脏数据纹样")).toBe(true);

    // 重置
    await supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });
    await api.resetDemoContent();

    const after = await api.fetchAllPatternsAdmin();
    expect(after).toHaveLength(45);
    expect(after.some((p: { name: string }) => p.name === "脏数据纹样")).toBe(false);
    const restored = after.find((p: { name: string }) => p.name === "蝶恋花靛蓝纹")!;
    expect(restored.meaning).not.toBe("被改过的寓意");

    // 用户与预约保留
    const profiles = await supabase.from("profiles").select("email");
    expect((profiles.data as { email: string }[]).some((p) => p.email === "qa_reset@miaoda.com")).toBe(true);
    const bookings = readDb().bookings;
    expect(bookings.some((b: { contact_name: string }) => b.contact_name === "重置测试")).toBe(true);

    // 注册账号重置后依然能登录
    const relogin = await supabase.auth.signInWithPassword({
      email: "qa_reset@miaoda.com",
      password: "qa123456",
    });
    expect(relogin.error).toBeNull();
  });

  it("重置会立刻落盘，刷新页面后仍是干净的种子数据", async () => {
    const { supabase, api } = await boot();
    await supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });
    await api.createPattern({
      name: "刷新测试纹样",
      category: "扎染",
      region: "测试",
      technique: "测试",
      meaning: "测试",
      image_url: "data:image/png;base64,AAAA",
    });
    await api.resetDemoContent();

    expect(readDb().patterns.some((p: { name: string }) => p.name === "刷新测试纹样")).toBe(false);

    // 重新载入（模拟刷新）
    const again = await boot();
    expect(await again.api.fetchAllPatternsAdmin().then((l: unknown[]) => l.length)).toBe(45);
  });

  it("普通用户调用重置接口被拒绝（403），数据不受影响", async () => {
    const { supabase, api } = await boot();
    await supabase.auth.signInWithPassword({ email: "demo@miaoda.com", password: "demo123456" });
    const before = readDb().patterns.length;

    await expect(api.resetDemoContent()).rejects.toMatchObject({ code: "403" });
    expect(readDb().patterns.length).toBe(before);
  });

  it("未登录调用重置接口被拒绝（401）", async () => {
    const { supabase, api } = await boot();
    await supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });
    await supabase.auth.signOut();
    await expect(api.resetDemoContent()).rejects.toMatchObject({ code: "401" });
  });

  it("全部种子写入 localStorage 后体积远低于 2MB 上限", async () => {
    await boot();
    const size = (localStorage.getItem(DB_KEY) || "").length;
    // 中文按 UTF-16 计，实际字节数更高，这里按 3 倍保守估算仍留足余量
    expect(size * 3).toBeLessThan(2 * 1024 * 1024);
    expect(size).toBeGreaterThan(1024);
  });
});

describe("种子数据 · 规模与合规", () => {
  beforeEach(() => localStorage.clear());

  it("守艺人 10 位覆盖三类工艺与多地区，商品全部关联到在架守艺人", async () => {
    const { supabase, api } = await boot();
    await supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });

    const artisans = await api.fetchAllArtisansAdmin();
    expect(artisans).toHaveLength(10);
    const crafts = new Set(artisans.map((a) => a.craft));
    expect([...crafts].sort()).toEqual(["扎染", "苗绣", "蜡染"]);
    const regions = new Set(artisans.map((a) => a.region));
    expect(regions.size).toBeGreaterThanOrEqual(7);

    const products = await api.fetchAllProductsAdmin();
    expect(products).toHaveLength(10);
    const byId = new Map(artisans.map((a) => [a.id, a]));
    for (const p of products) {
      const maker = byId.get(p.artisan_id as string);
      expect(maker, `${p.name} 未关联到守艺人`).toBeDefined();
      expect(p.artisan_name).toBe(maker?.name);
      expect(p.price).toBeGreaterThanOrEqual(198);
      expect(p.price).toBeLessThanOrEqual(880);
    }

    const projects = await api.fetchExperienceProjects();
    expect(projects.length).toBeGreaterThanOrEqual(6);
    expect(projects.length).toBeLessThanOrEqual(8);
    const durations = new Set(projects.map((e) => e.duration));
    expect(durations).toEqual(new Set(["半天", "全天", "两天"]));
  });

  it("守艺人姓名均为虚构示例名，不与已知真实传承人重名", async () => {
    const { MOCK_ARTISANS } = await import("@/db/mockData.ts");
    // 双盲与肖像权红线：真实可考的非遗传承人姓名一律不得出现在示例档案里
    // 已知真实传承人 / 常被报道的姓名，示例档案一律不得复用
    const realInheritors = ["杨阿妮", "韦祖英", "段树坤", "段银开", "张琴", "文良友", "赵永敏", "潘玉洁", "石丽平", "邰摩西"];
    const names = MOCK_ARTISANS.map((a) => a.name);
    for (const n of names) expect(realInheritors).not.toContain(n);
    // 档案文案里自带「示例档案」免责口径
    for (const a of MOCK_ARTISANS) expect(a.bio.endsWith("（示例档案）"), `${a.name} 缺示例标注`).toBe(true);
  });
});
