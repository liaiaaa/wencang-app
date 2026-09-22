import type { Artisan } from "@/types/types";

/**
 * 商品 ↔ 守艺人关联的纯函数集合：
 * 表单只选 artisan_id，artisan_name 由这里从守艺人列表派生，
 * 保证两列永远一致，前台跳转不会出现「有名无 id」或「有 id 无名」。
 */

/** 关联计算只需要守艺人的 id 与 name 两列 */
export type ArtisanLite = Pick<Artisan, "id" | "name">;

/**
 * 商品行上与守艺人关联的两列。
 * 老数据可能整列缺失（早期只有 artisan_name 文本框），因此字段全部可选；
 * 数据层的行类型（Record<string, unknown>）也据此收敛到本接口。
 */
export interface ArtisanLink {
  artisan_id?: string | null;
  artisan_name?: string;
}

/** 写入数据层时的关联字段，两列必然同时存在 */
export interface ResolvedArtisanLink {
  artisan_id: string | null;
  artisan_name: string;
}

/**
 * 把表单里的守艺人下拉值归一化为待持久化的 (artisan_id, artisan_name)。
 *  - 空值 → 未关联（id 为 null、名字清空）
 *  - 未知 id（守艺人已归档/被删）→ 保留原有名字，不静默丢数据
 */
export function resolveArtisanLink(
  artisanIdRaw: string | null | undefined,
  artisans: readonly Partial<ArtisanLite>[],
  fallbackName = "",
): ResolvedArtisanLink {
  const id = artisanIdRaw?.trim() ? artisanIdRaw.trim() : null;
  if (!id) return { artisan_id: null, artisan_name: "" };
  const hit = artisans.find((a) => a.id === id);
  return { artisan_id: id, artisan_name: hit?.name ?? fallbackName };
}

/**
 * 老数据兼容：按 artisan_name 反查补齐 artisan_id（查不到保持 null，不报错）；
 * 反向也补：有 id 缺名字时用列表回填名字。原地修改并返回同一数组。
 */
export function backfillArtisanLinks<T extends ArtisanLink>(
  rows: T[],
  artisans: readonly Partial<ArtisanLite>[],
): T[] {
  for (const row of rows) {
    if (!row.artisan_id && row.artisan_name) {
      const hit = artisans.find((a) => a.name === row.artisan_name);
      if (hit?.id) row.artisan_id = hit.id;
    }
    if (row.artisan_id && !row.artisan_name) {
      const hit = artisans.find((a) => a.id === row.artisan_id);
      if (hit?.name) row.artisan_name = hit.name;
    }
  }
  return rows;
}

/**
 * 前台读取时校验关联：artisan_id 必须指向一位在架守艺人，否则清空关联。
 * 透传无效 id 会让前台渲染出「点开即 404」的死链，清空后自动回落为纯文本。
 */
export function keepLiveArtisanLinks<T extends ArtisanLink>(
  rows: T[],
  liveArtisanIds: ReadonlySet<string>,
): T[] {
  return rows.map((row) =>
    row.artisan_id && !liveArtisanIds.has(row.artisan_id) ? { ...row, artisan_id: null } : row,
  );
}
