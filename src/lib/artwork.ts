import {
  CANVAS,
  generatePatternArt,
  hashString,
  keywordHits,
  MOTIF_LABELS,
  LAYOUT_LABELS,
  type MotifId,
} from "./patternArt";
import type { Artisan, ExperienceProject, Pattern, PatternCategory, Product } from "@/types/types";

/* ============================================================
 * 程序化配图
 *
 * 原先四个模块的配图取自一组外链 CDN 图片，45 条纹样只轮回了 12 张图，
 * 一眼就能看出重复，而且断网时全部变空白。这里改为**由代码按条目确定性生成**：
 *
 *  - 同一行数据在任何位置（列表 / 详情 / 首页轮播 / 相关推荐）都得到完全相同的图案；
 *  - 同类别内部靠"名称 + 寓意"的主题词与 id 派生的变体号拉开差异；
 *  - 配色沿用 AI 工坊那一套靛蓝体系（米白底 / 靛蓝纹 / 朱砂点缀 ≤5%），不引入新视觉语言；
 *  - 产物是紧凑的 SVG data URL，无网络依赖，也不写进 localStorage（在读取层解析）。
 * ============================================================ */

/** 旧演示配图的外链域名：命中它才替换，管理员自己上传的图一律保留 */
const LEGACY_CDN = "miaoda-site-img.cdn.bcebos.com";

/**
 * 生成图上的标记：写回数据层前据此剔除，避免十几 KB 的 data URL 占满 localStorage。
 * 属性统一用单引号（见 toDataUrl 的编码规则），所以标记也写成单引号形式。
 */
const ART_MARK = "data-wc='art'";

export function isLegacyStockImage(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes(LEGACY_CDN);
}

export function isGeneratedArtwork(url: string | null | undefined): boolean {
  if (typeof url !== "string" || !url.startsWith("data:image/svg+xml")) return false;
  try {
    return decodeURIComponent(url).includes(ART_MARK);
  } catch {
    return false;
  }
}

/**
 * 压缩 SVG：坐标取整、折叠空白、只做最小百分号编码。
 *
 * encodeURIComponent 会把空格 / 引号 / 冒号 / 斜杠全部转义，单幅从 25KB 涨到 47KB；
 * 这里按 data URI 的实际需要只编码 % # < > 与空格，单幅约 24KB
 * （45 幅合计 ~850KB，且只在读取层生成，不写进 localStorage）。
 *
 * 空格必须编码：URL 里的裸空格会让浏览器在空格处截断 src，
 * 实测表现为 naturalWidth = 0（图裂），所以这一步不能省。
 */
function toDataUrl(svg: string): string {
  const compact = svg
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/(\d+\.\d+)/g, (m) => {
      const n = Number(m);
      return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 100) / 100);
    })
    .replace("<svg ", `<svg ${ART_MARK} `);
  const encoded = compact
    .replace(/%/g, "%25")
    .replace(/#/g, "%23")
    .replace(/</g, "%3C")
    .replace(/>/g, "%3E")
    .replace(/"/g, "'")
    .replace(/ /g, "%20");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/** 由稳定字符串派生一个小整数变体号（同一输入恒定） */
function variantOf(seedText: string, modulus: number): number {
  return Math.abs(hashString(seedText)) % modulus;
}

/* 只用不含空格的字体名：属性定界符会在编码时被统一成单引号，带空格的字体名必须加引号，加了就会把属性截断 */
/**
 * 字体栈只用不含空格的字体名。
 * 编码阶段会把属性定界符统一换成单引号，带空格的字体名必须加引号包裹，
 * 一旦加引号就会在属性里嵌套引号、把属性提前截断（实测 SVG 解析失败）。
 */
const SERIF = "SimSun,STSong,STZhongsong,serif";
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 把一幅纹样作为底图，叠一张海报卡。
 *
 * 底图用**内联嵌套 <svg>**，不用 `<image href="data:...">`：
 * 后者要把已编码的 data URL 再塞进外层属性，内层属性定界符会提前终结外层属性，
 * 浏览器直接解析失败（实测 naturalWidth = 0）。嵌套 <svg> 合法，且整份文档只需编码一次。
 *
 * 文字用内联 serif 字体——SVG 走 <img> 渲染时不继承页面 CSS，必须自带。
 */
function poster(opts: {
  /** 底图：未编码的完整 SVG 源码 */
  baseSvg: string;
  title: string;
  subtitle?: string;
  /** 角标（如工艺类别、姓氏） */
  corner?: string;
  /** 中央大字（守艺人徽章用姓氏） */
  monogram?: string;
  /** 工艺工具图标（绣绷/蜡刀/扎结） */
  toolIcon?: string | null;
}): string {
  const w = CANVAS;
  const h = CANVAS;
  const title = escapeXml(opts.title);
  const subtitle = opts.subtitle ? escapeXml(opts.subtitle) : "";
  const corner = opts.corner ? escapeXml(opts.corner) : "";

  const parts = [
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    opts.baseSvg,
  ];

  if (opts.monogram) {
    // 守艺人徽记：中央一枚米白圆牌 + 姓氏首字 + 工艺纹理背景
    parts.push(
      `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.round(w * 0.29)}" fill="hsl(40, 30%, 96%)" opacity="0.94"/>`,
      `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.round(w * 0.29)}" fill="none" stroke="hsl(218, 51%, 37%)" stroke-width="${Math.round(w * 0.012)}"/>`,
      `<text x="${w / 2}" y="${h / 2}" dy="0.36em" text-anchor="middle" font-family='${SERIF}' font-size="${Math.round(
        w * 0.3,
      )}" font-weight="700" fill="hsl(218, 51%, 37%)">${escapeXml(opts.monogram)}</text>`,
    );
    
    // 工艺工具图标（右上角）
    if (opts.toolIcon) {
      parts.push(opts.toolIcon);
    }
  } else {
    // 商品 / 项目海报：底部一条米白题签，标题压在题签上
    const bandH = Math.round(h * 0.22);
    parts.push(
      `<rect x="0" y="${h - bandH}" width="${w}" height="${bandH}" fill="hsl(40, 30%, 96%)" opacity="0.93"/>`,
      `<rect x="0" y="${h - bandH}" width="${w}" height="3" fill="hsl(8, 72%, 45%)" opacity="0.8"/>`,
      `<text x="${Math.round(w * 0.06)}" y="${h - bandH * 0.58}" font-family='${SERIF}' font-size="${Math.round(
        w * 0.062,
      )}" font-weight="700" fill="hsl(218, 51%, 37%)">${title}</text>`,
    );
    if (subtitle) {
      parts.push(
        `<text x="${Math.round(w * 0.06)}" y="${h - bandH * 0.22}" font-family='${SERIF}' font-size="${Math.round(
          w * 0.034,
        )}" fill="hsl(218, 15%, 42%)">${subtitle}</text>`,
      );
    }
  }

  if (corner) {
    parts.push(
      `<rect x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.06)}" width="${Math.round(w * 0.3)}" height="${Math.round(
        h * 0.075,
      )}" rx="6" fill="hsl(218, 51%, 37%)" opacity="0.9"/>`,
      `<text x="${Math.round(w * 0.06 + w * 0.15)}" y="${Math.round(h * 0.06 + h * 0.05)}" text-anchor="middle" font-family='${SERIF}' font-size="${Math.round(
        w * 0.036,
      )}" fill="hsl(40, 30%, 96%)">${corner}</text>`,
    );
  }

  parts.push("</svg>");
  return toDataUrl(parts.join(""));
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

/** 类别 → 主基元，与 AI 工坊的关键词映射保持同一套语义 */
const CATEGORY_MOTIF: Record<PatternCategory, MotifId> = {
  蜡染: "drum",
  扎染: "geo",
  苗绣: "butterfly",
};

export function motifOf(category: PatternCategory): MotifId {
  return CATEGORY_MOTIF[category];
}

/** 能稳定触发各基元的关键词（与 patternArt 的 KEYWORD_MAP 同一套双字口径） */
const MOTIF_ORDER: MotifId[] = ["butterfly", "drum", "fish", "flower", "geo"];
const MOTIF_TRIGGER: Record<MotifId, string> = {
  butterfly: "蝴蝶妈妈",
  drum: "铜鼓",
  fish: "游鱼水波",
  flower: "团花石榴",
  geo: "几何点阵",
};

/**
 * 交给生成器的主题词。
 *
 * 名称与寓意里带真实意象时（如"蝴蝶妈妈""铜鼓"）直接沿用关键词映射；
 * 完全没命中关键词时 patternArt 会回落到"该类别的默认基元"，
 * 于是同类 15 条会共用同一组基元——这里按 id 稳定地补一组把差异拉开，
 * 同一行永远补同一组，因此图案仍然确定可复现。
 */
function themeFor(name: string, meaning: string, id: string): string {
  const base = `${name} ${meaning}`.trim();
  if (keywordHits(base).length > 0) return base;

  const v = Math.abs(hashString(id));
  const primary = MOTIF_ORDER[v % MOTIF_ORDER.length];
  const secondary = MOTIF_ORDER[(v * 7 + 3) % MOTIF_ORDER.length];
  const picks = primary === secondary ? [primary] : [primary, secondary];
  return `${base} ${picks.map((m) => MOTIF_TRIGGER[m]).join(" ")}`;
}

/** 一行数据 → 一幅确定性纹样 */
function buildArt(name: string, meaning: string, category: PatternCategory, id: string, modulus = 9) {
  return generatePatternArt(themeFor(name, meaning, id), category, variantOf(id, modulus));
}

type PatternLike = Pick<Pattern, "id" | "name" | "category" | "technique" | "meaning">;

/**
 * 纹样配图：主题词取「名称 + 寓意」，基元由关键词映射决定，
 * 变体号由 id 派生——保证 45 条各自不同，且同一条永远相同。
 */
export function patternArtwork(p: PatternLike): string {
  return toDataUrl(buildArt(p.name, p.meaning ?? "", p.category, p.id).svg);
}

type ArtisanLike = Pick<Artisan, "id" | "name" | "craft" | "region">;

/** 守艺人头像：类别基元做底 + 姓氏首字圆牌 + 工艺工具图标，10 位各不相同 */
export function artisanArtwork(a: ArtisanLike): string {
  const craft = asCategory(a.craft);
  const baseSvg = buildArt(craft, a.region ?? "", craft, a.id, 7).svg;
  
  // 工艺工具图标（绣绷/蜡刀/扎结）
  const toolIcon = getToolIcon(craft);
  
  return poster({
    baseSvg,
    title: a.name,
    monogram: a.name.trim().charAt(0) || "?",
    corner: craft,
    toolIcon,
  });
}

/** 按工艺返回工具图标 SVG（已转义 XML 特殊字符） */
function getToolIcon(craft: PatternCategory): string | null {
  switch (craft) {
    case "苗绣":
      // 绣绷 + 针线
      return `<g transform="translate(800, 80)">
        <circle cx="0" cy="0" r="45" fill="none" stroke="hsl(218,51%,37%)" stroke-width="3"/>
        <circle cx="0" cy="0" r="38" fill="none" stroke="hsl(218,51%,37%)" stroke-width="2" opacity="0.6"/>
        <line x1="-30" y1="-30" x2="30" y2="30" stroke="hsl(218,51%,37%)" stroke-width="2" opacity="0.5"/>
        <line x1="30" y1="-30" x2="-30" y2="30" stroke="hsl(218,51%,37%)" stroke-width="2" opacity="0.5"/>
        <circle cx="0" cy="0" r="3" fill="hsl(8,72%,45%)"/>
      </g>`;
    case "蜡染":
      // 蜡刀 + 蜡壶
      return `<g transform="translate(800, 80)">
        <path d="M-20,-10 L-10,-30 L10,-30 L20,-10 Z" fill="hsl(218,51%,37%)" opacity="0.7"/>
        <line x1="-10" y1="-30" x2="-10" y2="10" stroke="hsl(218,51%,37%)" stroke-width="3"/>
        <line x1="10" y1="-30" x2="10" y2="10" stroke="hsl(218,51%,37%)" stroke-width="3"/>
        <rect x="-15" y="10" width="30" height="15" rx="3" fill="hsl(218,51%,37%)" opacity="0.6"/>
        <circle cx="0" cy="0" r="3" fill="hsl(8,72%,45%)"/>
      </g>`;
    case "扎染":
      // 扎结绳 + 板蓝根叶
      return `<g transform="translate(800, 80)">
        <circle cx="0" cy="0" r="25" fill="none" stroke="hsl(218,51%,37%)" stroke-width="3" stroke-dasharray="8,4"/>
        <ellipse cx="-20" cy="-15" rx="8" ry="15" fill="hsl(40,30%,96%)" stroke="hsl(218,51%,37%)" stroke-width="2"/>
        <ellipse cx="20" cy="15" rx="8" ry="15" fill="hsl(40,30%,96%)" stroke="hsl(218,51%,37%)" stroke-width="2"/>
        <circle cx="0" cy="0" r="3" fill="hsl(8,72%,45%)"/>
      </g>`;
    default:
      return null;
  }
}

type ProductLike = Pick<Product, "id" | "name" | "artisan_name" | "craft_description"> & {
  category?: PatternCategory;
};

/** 商品海报卡：以关联守艺人的工艺基元为底，底部题签写商品名 */
export function productArtwork(p: ProductLike): string {
  const category = p.category ?? guessCategory(p.craft_description, p.artisan_name);
  const baseSvg = buildArt(p.name, p.craft_description ?? "", category, p.id, 11).svg;
  return poster({
    baseSvg,
    title: p.name,
    subtitle: p.artisan_name ? `出自 · ${p.artisan_name}` : undefined,
    corner: category,
  });
}

type ProjectLike = Pick<ExperienceProject, "id" | "name" | "description" | "duration"> & {
  category?: PatternCategory;
};

/** 体验项目配图：按工艺类别出底纹，叠一行项目名与时长 */
export function projectArtwork(e: ProjectLike): string {
  const category = e.category ?? guessCategory(e.name, e.description);
  const baseSvg = buildArt(e.name, e.description ?? "", category, e.id, 8).svg;
  return poster({
    baseSvg,
    title: e.name.length > 14 ? `${e.name.slice(0, 14)}…` : e.name,
    subtitle: e.duration ? `时长 · ${e.duration}` : undefined,
    corner: category,
  });
}

/** 从文案里猜工艺类别（商品 / 项目表本身不存类别字段） */
function guessCategory(...text: (string | undefined | null)[]): PatternCategory {
  const t = text.filter(Boolean).join(" ");
  if (t.includes("蜡染") || t.includes("点蜡") || t.includes("靛染")) return "蜡染";
  if (t.includes("扎染") || t.includes("捆扎") || t.includes("缝扎")) return "扎染";
  return "苗绣";
}

/** artisans.craft 是自由文本，收敛到三类之一 */
function asCategory(craft: string | null | undefined): PatternCategory {
  const t = (craft ?? "").trim();
  if (t === "蜡染" || t === "扎染" || t === "苗绣") return t;
  return guessCategory(t);
}

/**
 * 统一解析：旧外链换成程序化图，自定义 / 已上传的图原样保留。
 * 只读时生成，不写回数据层，因此 localStorage 不会因为图片变大。
 */
export function resolveArtwork<T extends { image_url?: string }>(
  row: T,
  make: (row: T) => string,
): T {
  if (!row.image_url || isLegacyStockImage(row.image_url)) return { ...row, image_url: make(row) };
  return row;
}

export function resolveArtworks<T extends { image_url?: string }>(
  rows: T[],
  make: (row: T) => string,
): T[] {
  // 已经是自定义 / 生成图的行不动；只有"缺图"或"旧外链"两类需要生成
  if (!rows.some((r) => !r.image_url || isLegacyStockImage(r.image_url))) return rows;
  return rows.map((r) => resolveArtwork(r, make));
}

/** 供测试与调试使用：某条纹样实际会用到哪一组基元与布局 */
export function artworkDescriptor(p: PatternLike): { motifs: string[]; layout: string } {
  const art = buildArt(p.name, p.meaning ?? "", p.category, p.id);
  return {
    motifs: art.motifs.map((m) => MOTIF_LABELS[m]),
    layout: LAYOUT_LABELS[art.layout],
  };
}
