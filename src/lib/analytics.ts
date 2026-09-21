// ============================================================
// 轻量运营埋点
//
// 仅写入 localStorage（键 `wc_events`），采用环形缓冲保留最近
// MAX_EVENTS 条，不引入任何第三方 SDK，断网可用。
//
// 事件类型：
//   pattern_view      浏览纹样详情
//   pattern_search    纹样图库搜索/筛选
//   workshop_generate AI 工坊生成（含主题词 / 基元 / 种子）
//   booking_submit    提交预约
//   shop_order        商城下单
// ============================================================

export type AnalyticsEventName =
  | "pattern_view"
  | "pattern_search"
  | "workshop_generate"
  | "booking_submit"
  | "shop_order";

export interface AnalyticsEvent {
  id: string;
  event: AnalyticsEventName;
  /** 事件发生时间（ISO 字符串） */
  at: string;
  /** 事件附加数据，均为可 JSON 序列化的简单值 */
  payload: Record<string, string | number | boolean | null>;
  /** 是否为预置的演示数据（区别于真实操作产生的事件） */
  demo?: boolean;
}

const STORAGE_KEY = "wc_events";

/** 环形缓冲上限：仅保留最近 2000 条 */
export const MAX_EVENTS = 2000;

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

let seq = 0;
const nextId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** 读取全部事件（按时间升序，即写入顺序） */
export function getEvents(): AnalyticsEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is AnalyticsEvent =>
        !!e && typeof e === "object" && typeof e.event === "string" && typeof e.at === "string",
    );
  } catch {
    return [];
  }
}

function save(events: AnalyticsEvent[]) {
  if (!isBrowser()) return;
  try {
    // 环形缓冲：超出上限时丢弃最旧的
    const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // 存储配额不足等情况静默忽略，埋点不应影响主流程
  }
}

/** 记录一个事件 */
export function track(
  event: AnalyticsEventName,
  payload: Record<string, string | number | boolean | null> = {},
): void {
  if (!isBrowser()) return;
  try {
    const events = getEvents();
    events.push({ id: nextId(), event, at: new Date().toISOString(), payload });
    save(events);
  } catch {
    // 埋点失败不得影响业务流程
  }
}

/** 清空埋点数据 */
export function clearEvents(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}

/* ---------------- 预置演示数据 ---------------- */

/**
 * 生成近 7 天的演示埋点，使运营看板首次进入即有内容。
 *
 * 仅在「从未产生过任何埋点」时写入，因此不会覆盖真实操作数据；
 * 所有预置事件都带 `demo: true` 标记，看板会注明"含演示数据"。
 */
export function seedDemoEvents(now = new Date()): number {
  if (!isBrowser()) return 0;
  try {
    if (getEvents().length > 0) return 0; // 已有数据（真实或已预置），不重复写入

    // 每日的预约/生成次数（近 7 天，最后一天为今天）
    const bookingsByDay = [1, 0, 2, 1, 3, 2, 2];
    const generatesByDay = [2, 3, 1, 4, 3, 5, 3];
    // 各纹样的浏览热度（用于「热门纹样 TOP5」）
    const views: Array<[string, number]> = [
      ["蝶恋花靛蓝纹", 9],
      ["蝴蝶妈妈绣", 8],
      ["云纹扎染布", 6],
      ["铜鼓纹蜡染", 5],
      ["百鸟纹绣片", 4],
      ["植物染扎染布", 2],
    ];
    const searches: Array<[string, number]> = [
      ["蜡染", 3],
      ["苗绣", 3],
      ["扎染", 2],
    ];

    const out: AnalyticsEvent[] = [];
    const push = (
      event: AnalyticsEventName,
      daysAgo: number,
      payload: Record<string, string | number | boolean | null>,
    ) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      // 打散到工作时间，避免全部落在同一秒
      d.setHours(9 + (out.length % 9), (out.length * 7) % 60, (out.length * 13) % 60, 0);
      out.push({ id: `demo-${out.length}`, event, at: d.toISOString(), payload, demo: true });
    };

    const days = bookingsByDay.length;
    for (let i = 0; i < days; i++) {
      const daysAgo = days - 1 - i;
      for (let k = 0; k < bookingsByDay[i]; k++) {
        push("booking_submit", daysAgo, { artisan: "韦祖英", project: "蜡染工艺体验" });
      }
      for (let k = 0; k < generatesByDay[i]; k++) {
        push("workshop_generate", daysAgo, {
          theme: "蝴蝶妈妈 苗绣",
          category: "苗绣",
          motif: "butterfly",
          seed: "DEMO",
        });
      }
    }
    for (const [name, count] of views) {
      for (let k = 0; k < count; k++) push("pattern_view", k % days, { name });
    }
    for (const [keyword, count] of searches) {
      for (let k = 0; k < count; k++) push("pattern_search", k % days, { keyword });
    }

    save(out);
    return out.length;
  } catch {
    return 0;
  }
}

/** 预置演示事件占比（用于看板标注） */
export function getDemoEventRatio(): { demo: number; total: number } {
  const events = getEvents();
  return { demo: events.filter((e) => e.demo).length, total: events.length };
}

/* ---------------- 聚合 ---------------- */

/** 本地日期键 YYYY-MM-DD（按浏览器本地时区） */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface DailyPoint {
  date: string;
  /** 展示用短标签 MM-DD */
  label: string;
  booking: number;
  generate: number;
}

/**
 * 近 N 日「预约提交」与「纹样生成」趋势。
 * 返回按日期升序的数组，缺失日期补 0，保证折线图连续。
 */
export function getDailyTrend(days = 7, now = new Date()): DailyPoint[] {
  const events = getEvents();
  const buckets = new Map<string, { booking: number; generate: number }>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(dayKey(d), { booking: 0, generate: 0 });
  }

  for (const e of events) {
    const key = dayKey(new Date(e.at));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (e.event === "booking_submit") bucket.booking += 1;
    if (e.event === "workshop_generate") bucket.generate += 1;
  }

  return [...buckets.entries()].map(([date, v]) => ({
    date,
    label: date.slice(5),
    booking: v.booking,
    generate: v.generate,
  }));
}

export interface TopPattern {
  name: string;
  count: number;
}

/**
 * 热门纹样 TOP N。
 * 来源：pattern_view（按纹样名）与 pattern_search（按搜索词）合并计数。
 */
export function getTopPatterns(limit = 5): TopPattern[] {
  const counter = new Map<string, number>();
  for (const e of getEvents()) {
    let key: string | null = null;
    if (e.event === "pattern_view" && typeof e.payload.name === "string") {
      key = e.payload.name;
    } else if (e.event === "pattern_search" && typeof e.payload.keyword === "string") {
      key = e.payload.keyword;
    }
    if (!key) continue;
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** 按事件名统计总数 */
export function countByEvent(event: AnalyticsEventName): number {
  return getEvents().filter((e) => e.event === event).length;
}
