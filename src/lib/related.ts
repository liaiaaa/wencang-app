import type { Pattern } from "@/types/types";

/**
 * 过滤掉空串与纯空白项，避免详情页渲染出空标签 / 空区块。
 * 老数据里数组字段可能含空值，这里统一收口。
 */
export function cleanList(v?: string[]): string[] {
  return (v ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * 相关纹样推荐。
 *
 * 规则（按优先级）：
 *   1. 优先取该纹样 `related_patterns` 中显式指定的 id（保持声明顺序）；
 *   2. 不足时用「同类别」的纹样补足；
 *   3. 仍不足时用「同地区」的纹样补足。
 *
 * 不变量：
 *   - 结果中不包含纹样自身；
 *   - 结果中不出现重复条目；
 *   - 推荐条数不超过 `limit`。
 */
export function pickRelatedPatterns(
  all: Pattern[],
  currentId: string | undefined,
  limit = 3,
): Pattern[] {
  if (!currentId) return [];
  const current = all.find((p) => p.id === currentId);
  if (!current) return [];

  const others = all.filter((p) => p.id !== currentId);
  const byId = new Map(others.map((p) => [p.id, p]));
  const picked: Pattern[] = [];
  const seen = new Set<string>([currentId]);

  const take = (p: Pattern | undefined) => {
    if (!p || seen.has(p.id) || picked.length >= limit) return;
    seen.add(p.id);
    picked.push(p);
  };

  // 1) 显式指定
  for (const rid of current.related_patterns ?? []) {
    take(byId.get(rid));
  }

  // 2) 同类别补足
  if (picked.length < limit) {
    for (const p of others) {
      if (picked.length >= limit) break;
      if (p.category === current.category) take(p);
    }
  }

  // 3) 同地区补足
  if (picked.length < limit && current.region) {
    for (const p of others) {
      if (picked.length >= limit) break;
      if (p.region === current.region) take(p);
    }
  }

  return picked;
}
