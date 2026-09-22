import type { PatternCategory } from "@/types/types";

// 根据主题词与类别，本地生成纹样命名与寓意文案（确定性，无需额外 API）
const namePrefixes = ["灵", "韵", "彩", "锦", "华", "幽", "瑞", "繁", "素", "绮"];
const nameSuffixes = ["纹", "锦", "绣", "染", "图", "华", "韵", "境", "影", "章"];
const meaningTemplates: Record<PatternCategory, string[]> = {
  蜡染: [
    "靛蓝为底，白纹流转，{kw}化作点蜡笔下的图腾，寓意以蓝为信、以纹传情，寄托对自然万物的敬意。",
    "铜刀蘸蜡，靛水浸染，{kw}在蓝白之间凝固成永恒的图景，象征族群对天地和谐的祈愿。",
    "一抹靛蓝，万千纹样，{kw}以蜡为笔绘就生命循环之美，寓意生生不息、万物相生。",
  ],
  扎染: [
    "板蓝根染就的蓝白之间，{kw}如云气氤氲，寓意风调雨顺、吉祥如意。",
    "扎结成纹，浸染成画，{kw}在晕染中舒展，象征白族崇尚自然、天人合一的审美境界。",
    "蓝白相映，{kw}如流水行云，寓意以柔克刚、顺时而动的生命智慧。",
  ],
  苗绣: [
    "五彩丝线交织，{kw}绣于衣襟之上，寓意族群繁衍、子孙绵延的神性祝福。",
    "平绣与堆绣相映，{kw}色彩浓烈、构图饱满，象征百鸟朝凤、吉祥纳福。",
    "一针一线，{kw}绣出蝴蝶妈妈的传说，寓意蜕变与重生、生命循环的哲思。",
  ],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function generateNameAndMeaning(theme: string, category: PatternCategory): { name: string; meaning: string } {
  const kw = theme.trim() || "万物";
  const seed = Array.from(kw).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const prefix = pick(namePrefixes, seed);
  const suffix = pick(nameSuffixes, seed + 3);
  const core = kw.length <= 4 ? kw : kw.slice(0, 4);
  const name = `${prefix}${core}${suffix}`;
  const templates = meaningTemplates[category];
  const meaning = pick(templates, seed).replace("{kw}", `「${kw}」`);
  return { name, meaning };
}

// 构造英文生成提示词
export function buildPrompt(theme: string, category: PatternCategory): string {
  const styleMap: Record<PatternCategory, string> = {
    蜡染: "traditional Chinese batik pattern, indigo blue and white, wax resist dyeing, intricate ornamental motifs",
    扎染: "traditional Chinese tie-dye pattern, blue and white cloud-like organic shapes, soft natural dye gradients",
    苗绣: "traditional Chinese Miao ethnic embroidery pattern, colorful silk threads, symmetrical ornate motifs",
  };
  const themeEn = theme.trim() || "nature and life";
  return `A ${styleMap[category]}, inspired by the theme of ${themeEn}, symmetrical decorative composition, rich cultural symbolism, centered, isolated on a solid light cream background, high quality, detailed, 8k`;
}

// ============ 程序化纹样生成 ============
// 实现见 ./patternArt.ts（纯前端原生 SVG，无外部依赖）。
// 在此统一导出，作为纹样生成的公共入口。
export {
  generatePatternArt,
  resolveMotifs,
  hashString,
  Rng,
  buildPalette,
  svgToDataUrl,
  rasterizeSvg,
  MOTIF_LABELS,
  LAYOUT_LABELS,
  INDIGO_HUE,
  INDIGO_SAT,
  INDIGO_LIGHT,
} from "./patternArt";
export type { MotifId, LayoutId, Palette, PatternArt } from "./patternArt";