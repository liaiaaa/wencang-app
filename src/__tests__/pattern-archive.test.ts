import { describe, it, expect } from "vitest";
import { MOCK_PATTERNS } from "@/db/mockData";
import { PATTERN_ARCHIVE } from "@/db/patternArchive";
import { pickRelatedPatterns, cleanList } from "@/lib/related";
import type { Pattern } from "@/types/types";

/* ============================================================
 * P0-3 纹样档案深化：字段兼容 / 种子完整性 / 推荐逻辑
 * ============================================================ */

describe("纹样档案 · 老数据字段兼容", () => {
  it("缺失全部深化字段时不抛错，且各区块判定为空", () => {
    const legacy: Pattern = {
      id: "legacy-1",
      name: "老数据纹样",
      category: "蜡染",
      region: "贵州 · 某地",
      technique: "蜡刀点蜡",
      meaning: "只有基础字段的旧记录",
      image_url: "data:image/png;base64,AAAA",
      created_at: "2024-01-01T00:00:00.000Z",
    };

    // 详情页用这些判定决定是否渲染区块，均应为空
    const steps = legacy.process_steps?.filter(Boolean) ?? [];
    const scenes = legacy.usage_scenes?.filter(Boolean) ?? [];
    const story = legacy.story?.trim() ?? "";
    const related = pickRelatedPatterns([legacy], legacy.id);

    expect(steps).toEqual([]);
    expect(scenes).toEqual([]);
    expect(story).toBe("");
    expect(related).toEqual([]);
    // 不存在任何字段时，整块档案区不渲染
    expect(steps.length + scenes.length + story.length + related.length).toBe(0);
  });

  it("字段为 null / 空数组 / 空白字符串时同样安全", () => {
    const partial: Pattern = {
      id: "partial-1",
      name: "半数字段纹样",
      category: "扎染",
      region: "云南 · 大理",
      technique: "扎结",
      meaning: "部分字段为空",
      image_url: "data:image/png;base64,AAAA",
      created_at: "2024-01-01T00:00:00.000Z",
      process_steps: [],
      usage_scenes: ["", "  "],
      story: "   ",
      related_patterns: [],
    };

    const steps = cleanList(partial.process_steps);
    const scenes = cleanList(partial.usage_scenes);
    const story = partial.story?.trim() ?? "";

    expect(steps).toEqual([]);
    expect(scenes).toEqual([]);
    expect(story).toBe("");

    // 推荐逻辑对空 related_patterns 不抛错
    expect(() => pickRelatedPatterns([partial], partial.id)).not.toThrow();
  });

  it("缺失 related_patterns 时可按同类别回落到真实存在的纹样", () => {
    const a: Pattern = {
      id: "a",
      name: "甲",
      category: "苗绣",
      region: "贵州 · 凯里",
      technique: "平绣",
      meaning: "x",
      image_url: "x",
      created_at: "2024-01-01T00:00:00.000Z",
    };
    // 乙：同类别但地区不同；丙：不同类别且地区不同
    const b: Pattern = { ...a, id: "b", name: "乙", region: "贵州 · 台江" };
    const c: Pattern = { ...a, id: "c", name: "丙", category: "蜡染", region: "云南 · 大理" };

    // 无显式指定 → 落到同类别（乙）；丙既不同类别也不同地区，不应入选
    expect(pickRelatedPatterns([a, b, c], "a").map((p) => p.id)).toEqual(["b"]);
  });
});

describe("纹样档案 · 种子数据完整性", () => {
  it("15 条纹样全部具备四项深化内容", () => {
    expect(MOCK_PATTERNS).toHaveLength(15);

    const incomplete: string[] = [];
    for (const p of MOCK_PATTERNS) {
      const steps = p.process_steps ?? [];
      const scenes = p.usage_scenes ?? [];
      const story = p.story ?? "";
      const related = p.related_patterns ?? [];

      if (steps.length < 3) incomplete.push(`${p.name}: 工艺步骤 ${steps.length} < 3`);
      if (story.length < 120) incomplete.push(`${p.name}: 故事 ${story.length} 字 < 120`);
      if (scenes.length < 2) incomplete.push(`${p.name}: 应用场景 ${scenes.length} < 2`);
      if (related.length < 2) incomplete.push(`${p.name}: 相关纹样 ${related.length} < 2`);
    }

    expect(incomplete).toEqual([]);
  });

  it("相关纹样 id 均指向真实存在的纹样，且不指向自身", () => {
    const ids = new Set(MOCK_PATTERNS.map((p) => p.id));
    const problems: string[] = [];

    for (const p of MOCK_PATTERNS) {
      for (const rid of p.related_patterns ?? []) {
        if (!ids.has(rid)) problems.push(`${p.name} → 不存在的 id ${rid}`);
        if (rid === p.id) problems.push(`${p.name} → 指向自身`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("archive 表与种子纹样一一对应，无孤儿条目", () => {
    const ids = new Set(MOCK_PATTERNS.map((p) => p.id));
    for (const key of Object.keys(PATTERN_ARCHIVE)) {
      expect(ids.has(key)).toBe(true);
    }
    // 每条种子都应有对应档案
    for (const p of MOCK_PATTERNS) {
      expect(PATTERN_ARCHIVE[p.id]).toBeDefined();
    }
  });

  it("文化故事不出现真实可考的个人姓名与学校名", () => {
    const banned = ["大学", "学院", "学校", "先生", "教授", "研究员"];
    for (const p of MOCK_PATTERNS) {
      const story = p.story ?? "";
      for (const word of banned) {
        expect(story.includes(word), `${p.name} 含敏感词「${word}」`).toBe(false);
      }
    }
  });
});

describe("纹样档案 · 相关纹样推荐逻辑", () => {
  const mk = (id: string, name: string, category: Pattern["category"], region: string): Pattern => ({
    id,
    name,
    category,
    region,
    technique: "x",
    meaning: "x",
    image_url: "x",
    created_at: "2024-01-01T00:00:00.000Z",
  });

  const all: Pattern[] = [
    { ...mk("p1", "甲", "蜡染", "贵州 · 丹寨"), related_patterns: ["p3"] },
    mk("p2", "乙", "蜡染", "贵州 · 丹寨"),
    mk("p3", "丙", "苗绣", "贵州 · 凯里"),
    mk("p4", "丁", "扎染", "云南 · 大理"),
    mk("p5", "戊", "蜡染", "贵州 · 黄平"),
  ];

  it("优先返回显式指定的相关纹样，并保持声明顺序", () => {
    const r = pickRelatedPatterns(all, "p1", 3);
    expect(r[0].id).toBe("p3"); // 显式指定
    expect(r.map((p) => p.id)).not.toContain("p1"); // 不含自身
  });

  it("数量不足时按同类别补足，且不超过上限", () => {
    const r = pickRelatedPatterns(all, "p1", 3);
    expect(r).toHaveLength(3);
    expect(r.map((p) => p.id)).toEqual(["p3", "p2", "p5"]); // 1 条指定 + 同类蜡染
    expect(new Set(r.map((p) => p.id)).size).toBe(r.length); // 无重复
  });

  it("同类别不足时用同地区补足；未知 id 返回空数组", () => {
    // p4 是唯一的扎染且地区独立 → 既无同类别也无同地区，应返回空
    expect(pickRelatedPatterns(all, "p4", 3)).toEqual([]);

    // 构造一个「无同类别、但同地区」的场景：p6 与 p4 同地区
    const withSibling: Pattern[] = [...all, mk("p6", "己", "苗绣", "云南 · 大理")];
    const r = pickRelatedPatterns(withSibling, "p4", 3);
    expect(r.map((p) => p.id)).toEqual(["p6"]);

    expect(pickRelatedPatterns(all, "not-exist")).toEqual([]);
    expect(pickRelatedPatterns(all, undefined)).toEqual([]);
  });
});
