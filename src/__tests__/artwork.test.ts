import { describe, it, expect, beforeEach } from "vitest";
import {
  artisanArtwork,
  artworkDescriptor,
  isLegacyStockImage,
  patternArtwork,
  productArtwork,
  projectArtwork,
  resolveArtwork,
} from "@/lib/artwork";
import { supabase } from "@/db/supabase";
import * as api from "@/lib/api";
import { MOCK_ARTISANS, MOCK_PATTERNS, MOCK_PRODUCTS, MOCK_PROJECTS } from "@/db/mockData";
import type { Pattern } from "@/types/types";

/* ============================================================
 * 任务包 B · 程序化配图
 *
 * 要证明三件事：张张不同、同一条永远相同、旧外链不再出现在前台。
 * ============================================================ */

const DATA_URL = /^data:image\/svg\+xml;charset=utf-8,/;

beforeEach(async () => {
  await supabase.auth.signOut();
  (window as unknown as { __wenzangMock: { reset: () => void } }).__wenzangMock.reset();
});

describe("程序化配图 · 确定性与唯一性", () => {
  it("同一条纹样重复生成完全一致（种子确定性）", () => {
    const p = MOCK_PATTERNS[0];
    expect(patternArtwork(p)).toBe(patternArtwork(p));
    // 详情页 / 首页轮播 / 相关推荐都走同一个函数 ⇒ 三处必然同图
    expect(patternArtwork({ ...p })).toBe(patternArtwork(p));
  });

  it("45 条纹样两两不同", () => {
    const urls = MOCK_PATTERNS.map((p) => patternArtwork(p));
    expect(urls).toHaveLength(45);
    expect(new Set(urls).size).toBe(45);
  });

  it("任意抽查 10 组卡片图片互不相同", () => {
    for (let i = 0; i < 10; i++) {
      const a = MOCK_PATTERNS[i];
      const b = MOCK_PATTERNS[i + 12];
      expect(patternArtwork(a), `${a.name} 与 ${b.name} 撞图`).not.toBe(patternArtwork(b));
    }
  });

  it("名称带真实意象时，基元跟着意象走（沿用关键词映射）", () => {
    const cases: [string, string][] = [
      ["蝴蝶妈妈绣", "蝴蝶"],
      ["铜鼓纹蜡染", "铜鼓"],
      ["石榴纹蜡染", "团花"],
      ["百鸟纹绣片", "蝴蝶"],
    ];
    for (const [name, motif] of cases) {
      const p = MOCK_PATTERNS.find((x) => x.name === name);
      if (!p) continue;
      expect(artworkDescriptor(p).motifs[0], `${name} 的主基元应为${motif}`).toContain(motif);
    }
  });

  it("生成的 data URL 不含裸空格（裸空格会让浏览器在空格处截断 src 导致图裂）", () => {
    for (const p of MOCK_PATTERNS.slice(0, 8)) {
      const url = patternArtwork(p);
      expect(url).not.toMatch(/ /);
      expect(url.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    }
  });

  it("解码后的 SVG 是合法 XML（压缩与套版都不能破坏标签结构）", () => {
    const samples: [string, string][] = [
      ...MOCK_PATTERNS.slice(0, 6).map((p) => [p.name, patternArtwork(p)] as [string, string]),
      ...MOCK_ARTISANS.slice(0, 3).map((a) => [a.name, artisanArtwork(a)] as [string, string]),
      ...MOCK_PRODUCTS.slice(0, 3).map((p) => [p.name, productArtwork(p)] as [string, string]),
      ...MOCK_PROJECTS.slice(0, 3).map((e) => [e.name, projectArtwork(e)] as [string, string]),
    ];
    for (const [label, url] of samples) {
      const svg = decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length));
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.querySelector("parsererror"), `${label} 的 SVG 解析失败`).toBeNull();
      expect(doc.documentElement.tagName).toBe("svg");
      // 属性引号后紧跟标签名，说明闭合符 > 被吞掉了
      expect(svg).not.toMatch(/['"]<[a-zA-Z]/);
    }
  });

  it("全部生成图都锁定靛蓝配色体系（不破坏整体视觉语言）", () => {
    for (const p of MOCK_PATTERNS.slice(0, 12)) {
      const svg = decodeURIComponent(patternArtwork(p));
      expect(svg).toContain("hsl(218, 51%, 37%)"); // 靛蓝主色，与站点 --primary 一致
      expect(svg).toContain("hsl(40, 30%, 96%)"); // 米白底
    }
  });

  it("名称里的意象会改变基元组合（不是同一张模板换色）", () => {
    const signatures = new Set(MOCK_PATTERNS.map((p) => artworkDescriptor(p).motifs.join("+")));
    expect(signatures.size).toBeGreaterThanOrEqual(4);

    const butterflyMama = MOCK_PATTERNS.find((p) => p.name.includes("蝴蝶妈妈"))!;
    expect(artworkDescriptor(butterflyMama).motifs[0]).toContain("蝴蝶");
  });
});

describe("程序化配图 · 守艺人 / 商品 / 体验项目", () => {
  it("10 位守艺人头像互不相同，且带姓氏首字与工艺角标", () => {
    const urls = MOCK_ARTISANS.map((a) => artisanArtwork(a));
    expect(urls).toHaveLength(10);
    expect(new Set(urls).size).toBe(10);

    for (const a of MOCK_ARTISANS) {
      const svg = decodeURIComponent(artisanArtwork(a));
      expect(svg).toContain(a.name.charAt(0)); // 姓氏圆牌
      expect(svg).toContain(a.craft); // 工艺角标
      expect(svg).toContain("hsl(218, 51%, 37%)"); // 靛蓝体系
    }
  });

  it("10 件商品海报互不相同", () => {
    const urls = MOCK_PRODUCTS.map((p) =>
      productArtwork({ ...p, category: (MOCK_ARTISANS.find((a) => a.id === p.artisan_id)?.craft ?? "苗绣") as Pattern["category"] }),
    );
    expect(urls).toHaveLength(10);
    expect(new Set(urls).size).toBe(10);
  });

  it("7 个体验项目配图互不相同", () => {
    const urls = MOCK_PROJECTS.map((e) => projectArtwork(e));
    expect(urls).toHaveLength(7);
    expect(new Set(urls).size).toBe(7);
  });
});

describe("程序化配图 · 旧外链替换与上传优先", () => {
  it("识别旧演示外链", () => {
    expect(isLegacyStockImage("https://miaoda-site-img.cdn.bcebos.com/images/x.jpg")).toBe(true);
    expect(isLegacyStockImage("data:image/png;base64,AAAA")).toBe(false);
    expect(isLegacyStockImage("https://example.com/mine.png")).toBe(false);
    expect(isLegacyStockImage(undefined)).toBe(false);
  });

  it("旧外链被换成程序化 SVG，自定义 / 上传的图原样保留", () => {
    const legacy = resolveArtwork(
      { id: "x", image_url: "https://miaoda-site-img.cdn.bcebos.com/images/x.jpg" },
      () => "data:image/svg+xml;charset=utf-8,GEN",
    );
    expect(legacy.image_url).toBe("data:image/svg+xml;charset=utf-8,GEN");

    const uploaded = resolveArtwork(
      { id: "y", image_url: "data:image/png;base64,UPLOADED" },
      () => "should-not-be-used",
    );
    expect(uploaded.image_url).toBe("data:image/png;base64,UPLOADED");
  });

  it("前台读取的四个模块都不再出现旧外链", async () => {
    const patterns = await api.fetchPatterns();
    const artisans = await api.fetchArtisans();
    const products = await api.fetchProducts();
    const projects = await api.fetchExperienceProjects();

    for (const list of [patterns, artisans, products, projects]) {
      expect(list.length).toBeGreaterThan(0);
      for (const row of list) {
        expect(row.image_url, "仍有旧外链").toMatch(DATA_URL);
        expect(row.image_url).not.toContain("miaoda-site-img");
      }
    }
    expect(patterns).toHaveLength(45);
  });

  it("按 id 单条读取同样拿到生成图（详情页走的就是这条路）", async () => {
    const p = MOCK_PATTERNS[3];
    const a = MOCK_ARTISANS[0];
    const prod = MOCK_PRODUCTS[0];
    const [pattern, artisan, product] = await Promise.all([
      api.fetchPatternById(p.id),
      api.fetchArtisanById(a.id),
      api.fetchProductById(prod.id),
    ]);
    for (const row of [pattern, artisan, product]) {
      expect(row, "记录未找到").toBeTruthy();
      expect(row!.image_url).toMatch(DATA_URL);
      expect(row!.image_url).not.toContain("miaoda-site-img");
    }
    // 与列表读取结果一致：同一条在列表与详情必然同图
    expect((await api.fetchPatterns()).find((x) => x.id === p.id)?.image_url).toBe(pattern?.image_url);
  });

  it("管理后台列表同样拿到生成图，便于直接预览", async () => {
    await supabase.auth.signInWithPassword({ email: "admin@miaoda.com", password: "wencang2026" });
    const rows = await api.fetchAllPatternsAdmin();
    expect(rows.every((p) => DATA_URL.test(p.image_url))).toBe(true);
  });

  it("数据层里存的仍是原始短地址：图片不落 localStorage", async () => {
    await api.fetchPatterns();
    const stored = JSON.parse(localStorage.getItem("wenzang.mock.db.v1") || "{}");
    const first = (stored.patterns ?? [])[0];
    expect(first?.image_url ?? "").toContain("miaoda-site-img");
  });
});

describe("程序化配图 · 体积", () => {
  it("45 条纹样的 data URL 总量足够紧凑", () => {
    const total = MOCK_PATTERNS.reduce((sum, p) => sum + patternArtwork(p).length, 0);
    // 单幅约 3~6KB，45 幅合计应在数百 KB 级；留出余量但必须远低于 2MB
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
    // eslint-disable-next-line no-console
    console.log(`[体积] 45 条纹样 data URL 合计 ${(total / 1024).toFixed(0)} KB，平均 ${(total / 45 / 1024).toFixed(1)} KB`);
  });
});
