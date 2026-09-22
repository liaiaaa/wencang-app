import type { PatternCategory } from "@/types/types";

/* ============================================================
 * 程序化纹样生成器（纯前端 · 原生 SVG）
 *
 * 把用户输入的主题词解析为纹样基元，按受约束的靛蓝色系与
 * 三种对称布局合成一幅矢量纹样，可导出为 PNG。
 *
 * 设计要点：
 *  1. 全程无外部依赖，仅使用字符串拼接生成 SVG；
 *  2. 随机数由「主题词 + 类别 + 变体号」哈希播种，同参数必然复现；
 *  3. 配色锁定靛蓝主色，朱砂仅作点缀且受面积上限约束。
 * ============================================================ */

/* ---------------- 种子与伪随机 ---------------- */

/** FNV-1a 字符串哈希，得到 32 位无符号整数种子 */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32：小而快的确定性伪随机数发生器 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** [min, max) 浮点数 */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/* ---------------- 基元与布局 ---------------- */

export type MotifId = "butterfly" | "drum" | "fish" | "flower" | "geo";
export type LayoutId = "center" | "axis" | "repeat";

export const MOTIF_LABELS: Record<MotifId, string> = {
  butterfly: "蝴蝶纹",
  drum: "铜鼓纹",
  fish: "鱼纹",
  flower: "团花纹",
  geo: "几何纹",
};

export const LAYOUT_LABELS: Record<LayoutId, string> = {
  center: "中心对称",
  axis: "轴对称",
  repeat: "四方连续",
};

/**
 * 关键词 → 基元。按顺序匹配，命中多个则叠层。
 *
 * 全部使用双字及以上的词，避免单字在描述性语句中误命中
 * （例如"随便写点什么"不应命中几何基元）。
 */
const KEYWORD_MAP: ReadonlyArray<{ motif: MotifId; words: readonly string[] }> = [
  { motif: "butterfly", words: ["蝴蝶", "妈妈", "凤凰", "百鸟", "飞鸟", "蝴蝶妈妈"] },
  { motif: "drum", words: ["铜鼓", "太阳", "鼓纹", "光芒", "星辰", "鼓面"] },
  { motif: "fish", words: ["鱼纹", "游鱼", "水波", "涡妥", "波浪", "漩涡", "双鱼"] },
  { motif: "flower", words: ["团花", "石榴", "花瓣", "莲花", "花卉", "八瓣", "花纹"] },
  { motif: "geo", words: ["几何", "点阵", "方格", "冰裂", "菱格", "方胜", "网格", "菱形"] },
];

/** 无关键词命中时，按类别取默认基元 */
const CATEGORY_DEFAULT: Record<PatternCategory, MotifId> = {
  蜡染: "drum",
  扎染: "geo",
  苗绣: "butterfly",
};

/**
 * 主基元的搭配基元。当主题词只命中一个基元时，
 * 取搭配基元作为辅纹叠层（如「蝴蝶妈妈」→ 蝴蝶 + 团花）。
 */
const SECONDARY_AFFINITY: Record<MotifId, MotifId> = {
  butterfly: "flower",
  drum: "geo",
  fish: "geo",
  flower: "butterfly",
  geo: "flower",
};

/**
 * 主题词命中的基元序列（不含搭配补位）。
 * 单独导出是为了让调用方能区分"真的命中了关键词"与"没命中、走了类别兜底"。
 */
export function keywordHits(theme: string): MotifId[] {
  const text = theme.trim();
  const hits: MotifId[] = [];
  for (const { motif, words } of KEYWORD_MAP) {
    if (words.some((w) => text.includes(w)) && !hits.includes(motif)) {
      hits.push(motif);
    }
  }
  return hits;
}

/**
 * 主题词 → 基元序列。
 * 返回 [主基元, 辅基元?]：命中多个关键词时取前两个叠层；
 * 只命中一个时补一个搭配基元；完全没命中时按类别取默认。
 */
export function resolveMotifs(theme: string, category: PatternCategory): MotifId[] {
  const hits = keywordHits(theme);

  if (hits.length === 0) {
    const fallback = CATEGORY_DEFAULT[category];
    return [fallback, SECONDARY_AFFINITY[fallback]];
  }
  if (hits.length === 1) {
    return [hits[0], SECONDARY_AFFINITY[hits[0]]];
  }
  return [hits[0], hits[1]];
}

/* ---------------- 配色 ---------------- */

export interface Palette {
  bg: string;
  indigoDark: string;
  indigo: string;
  indigoMid: string;
  indigoLight: string;
  accent: string;
}

/** 靛蓝主色（与站点主题 --primary 一致） */
export const INDIGO_HUE = 218;
export const INDIGO_SAT = 51;
export const INDIGO_LIGHT = 37;

const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

/**
 * 受约束配色：主色恒为靛蓝 hsl(218,51%,37%)，
 * 其余为同色相的明度衍生；底色为米白；朱砂仅用于点缀。
 */
export function buildPalette(rng: Rng): Palette {
  const drift = rng.int(-4, 4);
  return {
    bg: hsl(40, 30, 96),
    indigoDark: hsl(INDIGO_HUE, INDIGO_SAT, 20 + drift),
    indigo: hsl(INDIGO_HUE, INDIGO_SAT, INDIGO_LIGHT),
    indigoMid: hsl(INDIGO_HUE, INDIGO_SAT, INDIGO_LIGHT + 14 + drift),
    indigoLight: hsl(INDIGO_HUE, INDIGO_SAT, INDIGO_LIGHT + 30 + drift),
    accent: hsl(8, 72, 45),
  };
}

/* ---------------- 绘制辅助 ---------------- */

interface MotifArt {
  svg: string;
  /** 朱砂元素在基元局部坐标系中的面积，用于约束点缀占比 */
  accentArea: number;
}

interface Ctx {
  p: Palette;
  rng: Rng;
}

const n = (v: number) => Math.round(v * 100) / 100;

/** 阿基米德螺线，用于水波漩涡 */
function spiralPath(turns: number, rMax: number, steps = 64): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = rMax * t;
    pts.push(`${n(Math.cos(a) * r)},${n(Math.sin(a) * r)}`);
  }
  return "M" + pts.join(" L");
}

function polar(cx: number, cy: number, radius: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
}

/* ---------------- 五组基元 ---------------- */

/** 蝴蝶：对称双翼 + 卷草触须 + 花纹点缀 + 边框装饰 */
function motifButterfly(ctx: Ctx): MotifArt {
  const { p, rng } = ctx;
  const wingFill = rng.next() < 0.5 ? p.indigo : p.indigoMid;
  const spot = p.bg;
  
  // 翅膀主轮廓（粗线条）
  const mainWing = `
    <path d="M0,-18 C 30,-58 76,-66 94,-40 C 106,-22 86,-2 56,3 C 32,6 12,-2 0,-18 Z"
          fill="${wingFill}" stroke="${p.indigoDark}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M0,6 C 26,28 62,42 68,64 C 72,82 52,90 34,80 C 18,71 6,46 0,30 Z"
          fill="${p.indigoMid}" stroke="${p.indigoDark}" stroke-width="4" stroke-linejoin="round"/>`;
  
  // 翅膀内部纹理（点状/斜线填充）
  const wingTexture = rng.next() < 0.5 
    ? `<circle cx="58" cy="-34" r="11" fill="${spot}" opacity="0.9"/><circle cx="40" cy="52" r="7" fill="${spot}" opacity="0.85"/>`
    : `<line x1="50" y1="-30" x2="70" y2="-40" stroke="${p.indigoLight}" stroke-width="2" opacity="0.6"/>
       <line x1="45" y1="45" x2="55" y2="55" stroke="${p.indigoLight}" stroke-width="2" opacity="0.6"/>`;
  
  // 触须卷草（带螺旋细节）
  const antenna = `
    <path d="M-4,-56 C -16,-80 -36,-92 -54,-88 C -66,-85 -68,-72 -58,-67"
          fill="none" stroke="${p.indigoDark}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="-58" cy="-67" r="4" fill="${p.indigoDark}"/>
    <circle cx="-62" cy="-70" r="2" fill="${p.accent}"/>`;
  
  // 边框装饰（四角小花）
  const borderDecor = `
    <circle cx="90" cy="-90" r="6" fill="${p.indigoLight}" opacity="0.7"/>
    <circle cx="90" cy="90" r="6" fill="${p.indigoLight}" opacity="0.7"/>
    <circle cx="-90" cy="-90" r="6" fill="${p.indigoLight}" opacity="0.7"/>
    <circle cx="-90" cy="90" r="6" fill="${p.indigoLight}" opacity="0.7"/>`;

  return {
    svg: `
      <g>
        ${mainWing}
        <g transform="scale(-1,1)">${mainWing}</g>
        ${wingTexture}
        <g transform="scale(-1,1)">${wingTexture}</g>
        <g>${antenna}<g transform="scale(-1,1)">${antenna}</g></g>
        <ellipse cx="0" cy="-2" rx="7" ry="48" fill="${p.indigoDark}"/>
        <circle cx="0" cy="-56" r="9" fill="${p.indigoDark}"/>
        <circle cx="0" cy="-56" r="4.5" fill="${p.accent}"/>
        <circle cx="0" cy="10" r="4" fill="${p.bg}"/>
        ${borderDecor}
      </g>`,
    accentArea: Math.PI * 4.5 * 4.5 + Math.PI * 2 * 2,
  };
}

/** 铜鼓：同心圆 + 太阳芒纹 + 翔鹭纹 + 云雷纹边饰 */
function motifDrum(ctx: Ctx): MotifArt {
  const { p, rng } = ctx;
  const rayCount = rng.pick([12, 16]);
  const birdCount = rng.pick([8, 10, 12]);

  // 同心圆（不同粗细）
  const concentricCircles = `
    <circle cx="0" cy="0" r="98" fill="none" stroke="${p.indigoDark}" stroke-width="6"/>
    <circle cx="0" cy="0" r="92" fill="none" stroke="${p.indigo}" stroke-width="3"/>
    <circle cx="0" cy="0" r="66" fill="none" stroke="${p.indigoDark}" stroke-width="5"/>
    <circle cx="0" cy="0" r="42" fill="${p.indigo}"/>
    <circle cx="0" cy="0" r="24" fill="${p.bg}"/>`;

  // 太阳芒纹（带渐变效果）
  let rays = "";
  for (let i = 0; i < rayCount; i++) {
    const angle = (360 / rayCount) * i;
    rays += `<path d="M0,-46 L${n(6 * Math.cos((angle - 90) * Math.PI / 180))},${n(-62)} 
             L0,-70 L${n(-6 * Math.cos((angle - 90) * Math.PI / 180))},${n(-62)} Z" 
             fill="${rng.next() < 0.5 ? p.indigo : p.indigoMid}" 
             transform="rotate(${n(angle)})"/>`;
  }

  // 翔鹭纹（更精细的鸟形）
  let birds = "";
  for (let i = 0; i < birdCount; i++) {
    const a = (360 / birdCount) * i + 22.5;
    const size = rng.next() < 0.5 ? 12 : 14; // 大小变化
    birds += `<g transform="rotate(${n(a)}) translate(0,-84)">
      <path d="M-${size},0 Q0,-${size/2} ${size},0 Q0,${size/2} -${size},0 Z" 
            fill="${p.indigoDark}"/>
      <line x1="-${size/3}" y1="-${size/4}" x2="-${size}" y2="-${size*0.8}" 
            stroke="${p.indigoDark}" stroke-width="2" stroke-linecap="round"/>
      <line x1="${size/3}" y1="-${size/4}" x2="${size}" y2="-${size*0.8}" 
            stroke="${p.indigoDark}" stroke-width="2" stroke-linecap="round"/>
    </g>`;
  }

  // 云雷纹边饰（回纹装饰）
  const cloudThunder = `
    <path d="M0,-98 L14,-98 L14,-84 M14,-84 L-14,-84 L-14,-98" 
          fill="none" stroke="${p.indigoLight}" stroke-width="2" opacity="0.6"/>
    <path d="M0,98 L14,98 L14,84 M14,84 L-14,84 L-14,98" 
          fill="none" stroke="${p.indigoLight}" stroke-width="2" opacity="0.6"/>
    <path d="M-98,0 L-98,14 L-84,14 M-84,14 L-84,-14 L-98,-14" 
          fill="none" stroke="${p.indigoLight}" stroke-width="2" opacity="0.6"/>
    <path d="M98,0 L98,14 L84,14 M84,14 L84,-14 L98,-14" 
          fill="none" stroke="${p.indigoLight}" stroke-width="2" opacity="0.6"/>`;

  return {
    svg: `
      <g>
        ${concentricCircles}
        ${rays}
        ${birds}
        ${cloudThunder}
        <circle cx="0" cy="0" r="11" fill="${p.accent}"/>
      </g>`,
    accentArea: Math.PI * 11 * 11,
  };
}

/** 鱼纹：鱼形 + 水波漩涡（涡妥纹）+ 鳞片纹理 */
function motifFish(ctx: Ctx): MotifArt {
  const { p, rng } = ctx;

  // 涡妥纹：两侧对称的阿基米德螺线（更复杂）
  const swirl = (mirror: boolean) => `
    <g transform="${mirror ? "scale(-1,1)" : ""}">
      <path d="${spiralPath(2.3, 35)}" transform="translate(-108 0)"
            fill="none" stroke="${p.indigoMid}" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="-108" cy="0" r="6" fill="${p.indigoDark}"/>
      <circle cx="-112" cy="0" r="3" fill="${p.accent}"/>`;

  // 鱼鳞纹理（点状/网格变化）
  const scales = rng.next() < 0.5
    ? `<circle cx="-50" cy="-20" r="3" fill="${p.indigoLight}" opacity="0.7"/>
       <circle cx="-50" cy="20" r="3" fill="${p.indigoLight}" opacity="0.7"/>
       <circle cx="50" cy="-20" r="3" fill="${p.indigoLight}" opacity="0.7"/>
       <circle cx="50" cy="20" r="3" fill="${p.indigoLight}" opacity="0.7"/>`
    : `<line x1="-60" y1="-30" x2="-40" y2="-20" stroke="${p.indigoLight}" stroke-width="2" opacity="0.5"/>
       <line x1="-60" y1="30" x2="-40" y2="20" stroke="${p.indigoLight}" stroke-width="2" opacity="0.5"/>
       <line x1="60" y1="-30" x2="40" y2="-20" stroke="${p.indigoLight}" stroke-width="2" opacity="0.5"/>
       <line x1="60" y1="30" x2="40" y2="20" stroke="${p.indigoLight}" stroke-width="2" opacity="0.5"/>`;

  return {
    svg: `
      <g>
        ${swirl(false)}
        ${swirl(true)}
        <path d="M-74,0 C -52,-42 24,-48 62,-17 C 72,-8 76,0 76,0 C 76,0 72,8 62,17
                 C 24,48 -52,42 -74,0 Z"
              fill="${p.indigo}" stroke="${p.indigoDark}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M66,0 L100,-30 L88,0 L100,30 Z"
              fill="${p.indigoMid}" stroke="${p.indigoDark}" stroke-width="3.5" stroke-linejoin="round"/>
        ${scales}
        <path d="M-30,-26 C -6,-34 18,-26 30,-8" fill="none" stroke="${p.indigoDark}"
              stroke-width="3.5" opacity="0.7"/>
        <path d="M-34,-4 C -10,-12 16,-4 30,12" fill="none" stroke="${p.indigoDark}"
              stroke-width="3.5" opacity="0.7"/>
        <circle cx="-42" cy="-11" r="9" fill="${p.bg}"/>
        <circle cx="-42" cy="-11" r="4.5" fill="${p.indigoDark}"/>
        <circle cx="34" cy="0" r="6" fill="${p.accent}"/>
      </g>`,
    accentArea: Math.PI * 6 * 6 + Math.PI * 3 * 3,
  };
}

/** 团花：八瓣团花 + 石榴花心 */
function motifFlower(ctx: Ctx): MotifArt {
  const { p, rng } = ctx;
  const petals = 8;
  const petalFill = rng.next() < 0.5 ? p.indigo : p.indigoMid;

  let petalsSvg = "";
  for (let i = 0; i < petals; i++) {
    petalsSvg += `<g transform="rotate(${n((360 / petals) * i)})">
      <path d="M0,0 C 17,-22 17,-56 0,-76 C -17,-56 -17,-22 0,0 Z"
            fill="${petalFill}" stroke="${p.indigoDark}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="0" cy="-50" r="5" fill="${p.bg}" opacity="0.9"/>
    </g>`;
  }

  let seeds = "";
  for (let i = 0; i < 6; i++) {
    const [x, y] = polar(0, 0, 20, (360 / 6) * i);
    seeds += `<circle cx="${n(x)}" cy="${n(y)}" r="4" fill="${p.accent}"/>`;
  }

  return {
    svg: `
      <g>
        ${petalsSvg}
        <circle cx="0" cy="0" r="26" fill="${p.indigoDark}"/>
        <circle cx="0" cy="0" r="16" fill="${p.bg}"/>
        ${seeds}
      </g>`,
    accentArea: 6 * Math.PI * 4 * 4,
  };
}

/** 几何：菱格 + 点阵 + 冰裂纹 */
function motifGeo(ctx: Ctx): MotifArt {
  const { p, rng } = ctx;

  let cracks = "";
  const branches = rng.int(5, 7);
  for (let b = 0; b < branches; b++) {
    let angle = rng.range(0, 360);
    let r = rng.range(18, 30);
    const pts: string[] = [`0,0`];
    while (r < 92) {
      const [x, y] = polar(0, 0, r, angle);
      pts.push(`${n(x)},${n(y)}`);
      angle += rng.range(-38, 38);
      r += rng.range(14, 26);
    }
    cracks += `<path d="M${pts.join(" L")}" fill="none" stroke="${p.indigoMid}"
                 stroke-width="2" stroke-linecap="round" opacity="0.75"/>`;
  }

  let dots = "";
  for (let i = 0; i < 8; i++) {
    const [x, y] = polar(0, 0, 74, (360 / 8) * i + 22.5);
    dots += `<circle cx="${n(x)}" cy="${n(y)}" r="5" fill="${p.indigoDark}"/>`;
  }

  return {
    svg: `
      <g>
        <path d="M0,-92 L92,0 L0,92 L-92,0 Z" fill="none" stroke="${p.indigoDark}" stroke-width="4"/>
        <path d="M0,-60 L60,0 L0,60 L-60,0 Z" fill="none" stroke="${p.indigo}" stroke-width="3"/>
        <path d="M0,-30 L30,0 L0,30 L-30,0 Z" fill="${p.indigoLight}" stroke="${p.indigoDark}" stroke-width="2.5"/>
        ${cracks}
        ${dots}
        <circle cx="0" cy="0" r="7" fill="${p.accent}"/>
      </g>`,
    accentArea: Math.PI * 7 * 7,
  };
}

const MOTIF_FNS: Record<MotifId, (ctx: Ctx) => MotifArt> = {
  butterfly: motifButterfly,
  drum: motifDrum,
  fish: motifFish,
  flower: motifFlower,
  geo: motifGeo,
};

/* ---------------- 合成 ---------------- */

function place(
  art: MotifArt,
  x: number,
  y: number,
  scale: number,
  rotate = 0,
  mirror = false,
): MotifArt {
  const sx = mirror ? -scale : scale;
  return {
    svg: `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotate)}) scale(${n(sx)} ${n(scale)})">${
      art.svg
    }</g>`,
    accentArea: art.accentArea * scale * scale,
  };
}

/** 画布边长：程序化配图（海报卡 / 头像）也按这个尺寸套版，故对外暴露 */
export const CANVAS = 1024;
const FRAME = 26;

export interface PatternArt {
  svg: string;
  dataUrl: string;
  seed: number;
  seedLabel: string;
  variant: number;
  motifs: MotifId[];
  primary: MotifId;
  secondary: MotifId | null;
  layout: LayoutId;
  palette: Palette;
  /** 朱砂点缀占画面面积比例（约束为 ≤ 0.05） */
  accentRatio: number;
}

/**
 * 生成一幅纹样。
 * 相同 (主题词, 类别, 变体号) 必然产出完全相同的图形；
 * 变体号递增即可得到新变体（对应「重新生成」）。
 */
export function generatePatternArt(
  theme: string,
  category: PatternCategory,
  variant = 0,
): PatternArt {
  const key = `${theme.trim()}|${category}|${variant}`;
  const seed = hashString(key);
  const rng = new Rng(seed);
  const palette = buildPalette(rng);
  const ctx: Ctx = { p: palette, rng };

  const motifs = resolveMotifs(theme, category);
  const primary = motifs[0];
  const secondary = motifs[1] ?? null;
  const layout: LayoutId = rng.pick<LayoutId>(["center", "axis", "repeat"]);

  const cx = CANVAS / 2;
  const cy = CANVAS / 2;
  const pieces: MotifArt[] = [];

  if (layout === "center") {
    pieces.push(place(MOTIF_FNS[primary](ctx), cx, cy, rng.range(2.3, 2.8)));
    if (secondary) {
      const count = 8;
      const ring = rng.range(360, 392);
      const s = rng.range(0.55, 0.72);
      for (let i = 0; i < count; i++) {
        const deg = (360 / count) * i + rng.range(-7, 7);
        const [x, y] = polar(cx, cy, ring, deg);
        pieces.push(place(MOTIF_FNS[secondary](ctx), x, y, s, deg + 90));
      }
    }
  } else if (layout === "axis") {
    const s = rng.range(1.7, 2.0);
    pieces.push(place(MOTIF_FNS[primary](ctx), cx - 216, cy, s));
    pieces.push(place(MOTIF_FNS[primary](ctx), cx + 216, cy, s, 0, true));
    if (secondary) {
      const s2 = rng.range(0.8, 1.0);
      pieces.push(place(MOTIF_FNS[secondary](ctx), cx, cy - 318, s2, 180));
      pieces.push(place(MOTIF_FNS[secondary](ctx), cx, cy + 318, s2));
    }
  } else {
    const grid = 3;
    const spacing = 292;
    const s = rng.range(0.95, 1.15);
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const isPrimary = (row + col) % 2 === 0 || !secondary;
        const id = isPrimary ? primary : secondary!;
        const x = cx + (col - 1) * spacing;
        const y = cy + (row - 1) * spacing;
        pieces.push(
          place(MOTIF_FNS[id](ctx), x, y, s, rng.range(0, 90), (row + col) % 3 === 0),
        );
      }
    }
  }

  const accentArea = pieces.reduce((sum, piece) => sum + piece.accentArea, 0);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="${palette.bg}"/>
  <rect x="${FRAME}" y="${FRAME}" width="${CANVAS - FRAME * 2}" height="${
    CANVAS - FRAME * 2
  }" fill="none" stroke="${palette.indigoDark}" stroke-width="3"/>
  <rect x="${FRAME + 14}" y="${FRAME + 14}" width="${CANVAS - (FRAME + 14) * 2}" height="${
    CANVAS - (FRAME + 14) * 2
  }" fill="none" stroke="${palette.indigo}" stroke-width="1.5"/>
${pieces.map((piece) => piece.svg).join("\n")}
</svg>`;

  const seedLabel = seed.toString(16).toUpperCase().padStart(8, "0").slice(-4);

  return {
    svg,
    dataUrl: svgToDataUrl(svg),
    seed,
    seedLabel,
    variant,
    motifs,
    primary,
    secondary,
    layout,
    palette,
    accentRatio: accentArea / (CANVAS * CANVAS),
  };
}

/** SVG 源码 → 可直接用于 <img src> 的 data URL */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 把 SVG 光栅化为 PNG（用于上传保存）。
 * 仅在浏览器环境可用。
 */
export function rasterizeSvg(svg: string, size = 768): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("当前环境不支持图像导出"));
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建画布"));
          return;
        }
        ctx.fillStyle = "#F7F5F0";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("图像导出失败"))),
          "image/png",
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error("图像导出失败"));
      }
    };
    img.onerror = () => reject(new Error("纹样渲染失败"));
    img.src = svgToDataUrl(svg);
  });
}
