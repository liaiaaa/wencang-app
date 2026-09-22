import { describe, it, expect } from "vitest";
import { pickRelatedPatterns } from "@/lib/related";
import type { Pattern } from "@/types/types";

/* ============================================================
 * Bug 修复回归 · 相关纹样推荐不变量
 *
 * 「相关纹样里出现重复条目 / 出现当前纹样本身」的三条根因分别对应：
 *   自身排除、列表去重、归档过滤。
 * 这里全部用手工构造的脏数据来打，不依赖种子是否恰好干净。
 * ============================================================ */

const p = (
  id: string,
  extra: Partial<Pattern> = {},
): Pattern => ({
  id,
  name: `纹样${id}`,
  category: "蜡染",
  region: "贵州 · 丹寨",
  technique: "蜡刀点蜡",
  meaning: "测试寓意",
  image_url: "data:image/png;base64,AAAA",
  created_at: "2024-01-01T00:00:00.000Z",
  ...extra,
});

describe("相关纹样 · 自身排除", () => {
  it("显式声明里写了自身 id 也不会推荐自己", () => {
    const all = [p("A", { related_patterns: ["A", "B", "A"] }), p("B"), p("C")];
    const got = pickRelatedPatterns(all, "A", 3).map((x) => x.id);
    expect(got).not.toContain("A");
    // 重复的 B 只留一条，剩下一个名额由同类别补位补上 C
    expect(got).toEqual(["B", "C"]);
  });

  it("同类别 / 同地区补位时同样排除自身", () => {
    const all = [p("A", { related_patterns: [] }), p("B"), p("C")];
    const got = pickRelatedPatterns(all, "A", 5);
    expect(got.map((x) => x.id)).toEqual(["B", "C"]);
  });

  it("currentId 缺失或查无此纹样时返回空数组而不抛错", () => {
    const all = [p("A"), p("B")];
    expect(pickRelatedPatterns(all, undefined)).toEqual([]);
    expect(pickRelatedPatterns(all, "")).toEqual([]);
    expect(pickRelatedPatterns(all, "不存在")).toEqual([]);
  });
});

describe("相关纹样 · 去重", () => {
  it("显式列表内重复的 id 只出现一次", () => {
    const all = [p("A", { related_patterns: ["B", "B", "B"] }), p("B")];
    expect(pickRelatedPatterns(all, "A", 3).map((x) => x.id)).toEqual(["B"]);
  });

  it("显式指定与补位结果重叠时不产生重复条目", () => {
    // B 既被显式指定，又是同类别的补位候选
    const all = [p("A", { related_patterns: ["B"] }), p("B"), p("C"), p("D")];
    const got = pickRelatedPatterns(all, "A", 3).map((x) => x.id);
    expect(new Set(got).size).toBe(got.length);
    expect(got).toEqual(["B", "C", "D"]);
  });

  it("条数恒不超过 limit，且结果里不含空位", () => {
    const all = [p("A", { related_patterns: ["B", "C", "D", "E"] }), p("B"), p("C"), p("D"), p("E")];
    const got = pickRelatedPatterns(all, "A", 2);
    expect(got).toHaveLength(2);
    expect(got.every(Boolean)).toBe(true);
  });
});

describe("相关纹样 · 归档过滤", () => {
  it("已归档纹样即使被显式引用也不进入推荐", () => {
    const all = [
      p("A", { related_patterns: ["GONE", "B"] }),
      p("GONE", { status: "archived" }),
      p("B"),
    ];
    const got = pickRelatedPatterns(all, "A", 3);
    expect(got.map((x) => x.id)).not.toContain("GONE");
  });

  it("补位候选里的归档纹样同样被跳过", () => {
    const all = [p("A"), p("X", { status: "archived" }), p("B"), p("C")];
    const got = pickRelatedPatterns(all, "A", 3).map((x) => x.id);
    expect(got).toEqual(["B", "C"]);
    expect(got).not.toContain("X");
  });

  it("全部候选都已归档时返回空数组（详情页据此整块不渲染）", () => {
    const all = [p("A"), p("B", { status: "archived" })];
    expect(pickRelatedPatterns(all, "A", 3)).toEqual([]);
  });
});
