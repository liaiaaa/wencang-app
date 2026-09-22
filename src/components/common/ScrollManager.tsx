import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/* ============================================================
 * 滚动编排
 *
 * 两种语义要分开处理：
 *  - PUSH / REPLACE（进入新页面）：滚到顶部；
 *  - POP（浏览器或 navigate(-1) 触发的后退 / 前进）：
 *    恢复该历史条目离开时的浏览位置——从图库点进详情再返回，
 *    应该回到原来那一屏，而不是被甩回顶部。
 *
 * 滚动容器是 window（布局里 <main> 只有 flex-1，没有任何 overflow 滚动容器）。
 * ============================================================ */

const STORE_KEY = "wenzang.scroll.v1";
/** 只保留最近若干条记录，避免长会话里 sessionStorage 无限增长 */
const MAX_ENTRIES = 50;

function readStore(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function savePosition(key: string, y: number): void {
  try {
    const store = readStore();
    store[key] = y;
    const keys = Object.keys(store);
    for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete store[stale];
    sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* 隐私模式等场景下忽略 */
  }
}

function savedPosition(key: string): number | null {
  const v = readStore()[key];
  return typeof v === "number" && v > 0 ? v : null;
}

/**
 * 恢复目标位置。
 * 详情页的数据是异步取的，刚进来时页面往往还不够高，
 * 一次 scrollTo 会被浏览器截断，因此逐帧重试直到页面长够（上限约 0.5 秒）。
 */
function restoreTo(y: number): void {
  let tries = 0;
  const step = () => {
    window.scrollTo(0, y);
    const reachable = document.documentElement.scrollHeight - window.innerHeight;
    if (y - window.scrollY > 2 && reachable >= y - 2 && tries < 30) {
      tries += 1;
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

export default function ScrollManager() {
  const { pathname, search, key } = useLocation();
  const navType = useNavigationType();
  const first = useRef(true);
  /** 当前这一屏的 (历史条目 key, 滚动位置)，滚动时只更新 ref，导航时才落存储 */
  const current = useRef({ key, y: 0 });

  useEffect(() => {
    // 交给我们统一决定后退时的位置，避免与浏览器自带的恢复互相抢
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const onScroll = () => {
      current.current.y = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.history.scrollRestoration = prev;
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      current.current = { key, y: 0 };
      return;
    }

    // 1) 先把刚离开的那一页的位置记下来
    savePosition(current.current.key, current.current.y);
    current.current = { key, y: 0 };

    // 2) 后退 / 前进 → 恢复；进入新页面 → 回顶
    const saved = navType === "POP" ? savedPosition(key) : null;
    if (saved !== null) {
      current.current.y = saved;
      restoreTo(saved);
    } else {
      window.scrollTo(0, 0);
    }
    // pathname / search 变化即视为一次换页（后台 ?tab= 也是整块内容替换）
  }, [`${pathname}${search}`, key, navType]);

  return null;
}
