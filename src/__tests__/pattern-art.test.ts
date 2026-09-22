import { describe, it, expect } from "vitest";
import {
  generatePatternArt,
  resolveMotifs,
  hashString,
  Rng,
  buildPalette,
  INDIGO_HUE,
  INDIGO_SAT,
  INDIGO_LIGHT,
} from "@/lib/patternGen";
import type { PatternCategory } from "@/types/types";

const CATEGORIES: PatternCategory[] = ["蜡染", "扎染", "苗绣"];

describe("程序化纹样生成器 · 基元映射", () => {
  it("「蝴蝶妈妈」命中蝴蝶基元", () => {
    expect(resolveMotifs("蝴蝶妈妈", "苗绣")[0]).toBe("butterfly");
  });

  it("「铜鼓」命中铜鼓基元", () => {
    expect(resolveMotifs("铜鼓", "蜡染")[0]).toBe("drum");
  });

  it("「游鱼」「水波」「涡妥」均命中鱼纹基元", () => {
    expect(resolveMotifs("游鱼", "蜡染")[0]).toBe("fish");
    expect(resolveMotifs("水波纹", "蜡染")[0]).toBe("fish");
    expect(resolveMotifs("涡妥纹", "蜡染")[0]).toBe("fish");
    expect(resolveMotifs("双鱼", "蜡染")[0]).toBe("fish");
  });

  it("「石榴花」命中团花基元", () => {
    expect(resolveMotifs("石榴花", "苗绣")[0]).toBe("flower");
  });

  it("「冰裂纹」命中几何基元", () => {
    expect(resolveMotifs("冰裂纹", "扎染")[0]).toBe("geo");
  });

  it("多个关键词时主基元 + 辅基元叠层", () => {
    const motifs = resolveMotifs("蝴蝶妈妈", "苗绣");
    expect(motifs).toHaveLength(2);
    expect(motifs[0]).toBe("butterfly");
    expect(motifs[1]).toBe("flower");

    const multi = resolveMotifs("铜鼓与游鱼", "蜡染");
    expect(multi[0]).toBe("drum");
    expect(multi[1]).toBe("fish");
  });

  it("无匹配词时按类别取默认基元", () => {
    expect(resolveMotifs("远方", "蜡染")[0]).toBe("drum");
    expect(resolveMotifs("远方", "扎染")[0]).toBe("geo");
    expect(resolveMotifs("远方", "苗绣")[0]).toBe("butterfly");
    expect(resolveMotifs("xyz", "蜡染")[0]).toBe("drum");
    expect(resolveMotifs("云", "扎染")[0]).toBe("geo");
  });

  it("描述性语句不会因单字误命中基元（关键词已收窄为双字词）", () => {
    // 这些句子含「点」「格」「花」「鱼」等单字，但均非关键词，应走类别默认
    expect(resolveMotifs("随便写点什么", "蜡染")[0]).toBe("drum");
    expect(resolveMotifs("这个格子不错", "苗绣")[0]).toBe("butterfly");
    expect(resolveMotifs("花钱买不到", "扎染")[0]).toBe("geo");
    expect(resolveMotifs("我想做一条鱼", "蜡染")[0]).toBe("drum");
    expect(resolveMotifs("你好世界", "苗绣")[0]).toBe("butterfly");
  });

  it("双字关键词按规格生效", () => {
    expect(resolveMotifs("点阵", "苗绣")[0]).toBe("geo");
    expect(resolveMotifs("方格", "苗绣")[0]).toBe("geo");
    expect(resolveMotifs("菱格", "苗绣")[0]).toBe("geo");
    expect(resolveMotifs("冰裂", "苗绣")[0]).toBe("geo");
    expect(resolveMotifs("游鱼", "苗绣")[0]).toBe("fish");
    expect(resolveMotifs("花瓣", "苗绣")[0]).toBe("flower");
    expect(resolveMotifs("太阳", "扎染")[0]).toBe("drum");
  });

  it("空主题词不报错，回落到类别默认基元", () => {
    expect(() => resolveMotifs("", "苗绣")).not.toThrow();
    expect(resolveMotifs("", "苗绣")[0]).toBe("butterfly");
    expect(() => generatePatternArt("", "蜡染", 0)).not.toThrow();
  });

  it("单基元命中时会补一个搭配基元用于叠层", () => {
    expect(resolveMotifs("蝴蝶", "苗绣")).toHaveLength(2);
  });
});

describe("程序化纹样生成器 · 种子与可复现性", () => {
  it("hashString 对同一输入稳定，对不同输入区分", () => {
    expect(hashString("蝴蝶妈妈|苗绣|0")).toBe(hashString("蝴蝶妈妈|苗绣|0"));
    expect(hashString("蝴蝶妈妈|苗绣|0")).not.toBe(hashString("铜鼓|蜡染|0"));
    expect(hashString("")).toBeTypeOf("number");
  });

  it("Rng 由同一种子产生相同序列", () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("Rng.int 落在闭区间内", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("同一主题词两次生成结果完全一致（可复现）", () => {
    const a = generatePatternArt("蝴蝶妈妈", "苗绣", 0);
    const b = generatePatternArt("蝴蝶妈妈", "苗绣", 0);
    expect(a.seed).toBe(b.seed);
    expect(a.seedLabel).toBe(b.seedLabel);
    expect(a.svg).toBe(b.svg);
    expect(a.dataUrl).toBe(b.dataUrl);
    expect(a.layout).toBe(b.layout);
  });

  it("递增变体号产生不同图形（重新生成有新变体）", () => {
    const v0 = generatePatternArt("蝴蝶妈妈", "苗绣", 0);
    const v1 = generatePatternArt("蝴蝶妈妈", "苗绣", 1);
    expect(v0.seed).not.toBe(v1.seed);
    expect(v0.svg).not.toBe(v1.svg);
  });

  it("不同类别即使主题词相同也会产生不同结果", () => {
    const a = generatePatternArt("云纹", "扎染", 0);
    const b = generatePatternArt("云纹", "苗绣", 0);
    expect(a.svg).not.toBe(b.svg);
  });
});

describe("程序化纹样生成器 · 配色约束", () => {
  it("buildPalette 直接调用也满足靛蓝约束", () => {
    for (let s = 0; s < 20; s++) {
      const p = buildPalette(new Rng(s));
      expect(p.indigo).toBe(`hsl(${INDIGO_HUE}, ${INDIGO_SAT}%, ${INDIGO_LIGHT}%)`);
      expect(p.bg).toMatch(/^hsl\(40, 30%, 9[0-9]%\)$/);
    }
  });

  it("调色板主色恒为靛蓝 hsl(218,51%,37%)", () => {
    const expected = `hsl(${INDIGO_HUE}, ${INDIGO_SAT}%, ${INDIGO_LIGHT}%)`;
    for (let v = 0; v < 30; v++) {
      const { palette } = generatePatternArt(`主题${v}`, "蜡染", v);
      expect(palette.indigo).toBe(expected);
    }
  });

  it("除朱砂点缀外，其余颜色均属靛蓝色相（218）或米白底", () => {
    for (let v = 0; v < 30; v++) {
      const { palette } = generatePatternArt(`主题${v}`, "苗绣", v);
      for (const key of ["indigoDark", "indigo", "indigoMid", "indigoLight"] as const) {
        expect(palette[key]).toMatch(new RegExp(`^hsl\\(${INDIGO_HUE}, ${INDIGO_SAT}%,`));
      }
      // 米白底：低饱和暖色
      expect(palette.bg).toMatch(/^hsl\(40, 30%, 9[0-9]%\)$/);
      // 朱砂点缀
      expect(palette.accent).toBe("hsl(8, 72%, 45%)");
    }
  });

  it("朱砂点缀面积占比不超过 5%", () => {
    const themes = ["蝴蝶妈妈", "铜鼓", "鱼水", "石榴花", "冰裂纹", "随便", ""];
    for (const theme of themes) {
      for (const category of CATEGORIES) {
        for (let v = 0; v < 5; v++) {
          const art = generatePatternArt(theme, category, v);
          expect(art.accentRatio).toBeGreaterThanOrEqual(0);
          expect(art.accentRatio).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });
});

describe("程序化纹样生成器 · 输出结构", () => {
  it("产出合法 SVG 与可用的 data URL", () => {
    const art = generatePatternArt("蝴蝶妈妈", "苗绣", 0);
    expect(art.svg.startsWith("<svg")).toBe(true);
    expect(art.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(art.svg.trim().endsWith("</svg>")).toBe(true);
    expect(art.dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
  });

  it("标签闭合平衡（无残缺元素）", () => {
    for (const theme of ["蝴蝶妈妈", "铜鼓", "鱼", "花", "几何", "无匹配词"]) {
      const { svg } = generatePatternArt(theme, "蜡染", 0);
      const open = (svg.match(/<g[\s>]/g) || []).length;
      const close = (svg.match(/<\/g>/g) || []).length;
      expect(open).toBe(close);
    }
  });

  it("布局限定在三种之一", () => {
    const seen = new Set<string>();
    for (let v = 0; v < 40; v++) {
      const art = generatePatternArt(`主题${v}`, "蜡染", v);
      expect(["center", "axis", "repeat"]).toContain(art.layout);
      seen.add(art.layout);
    }
    // 随机应能覆盖到全部三种布局
    expect(seen.size).toBe(3);
  });

  it("种子标签为 4 位十六进制，便于展示", () => {
    for (let v = 0; v < 20; v++) {
      const { seedLabel } = generatePatternArt(`主题${v}`, "苗绣", v);
      expect(seedLabel).toMatch(/^[0-9A-F]{4}$/);
    }
  });

  it("画布尺寸与 viewBox 一致", () => {
    const { svg } = generatePatternArt("蝴蝶妈妈", "苗绣", 0);
    expect(svg).toContain('width="1024" height="1024" viewBox="0 0 1024 1024"');
  });
});
