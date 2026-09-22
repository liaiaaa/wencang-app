// ============================================================
// Bug 修复验收 · 路由切换后滚动位置复位
//
// 覆盖：多组"页面 A 下滑到底 → 跳转页面 B"B 从顶部开始 /
//       详情→详情（相关纹样）/ 后台 tab 切换 / 前进后退不报错
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-scroll.mjs`
//       对照旧版：BASE_URL=https://liaiaaa.github.io/wencang-app node scripts/verify-scroll.mjs
// 产物：docs/screenshots/scroll/*.png
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "scroll");
const BASE = process.env.BASE_URL || "http://localhost:5173";
/** 子路径部署时用于比对当前路径 */
const BASE_PATH = new URL(BASE).pathname.replace(/\/+$/, "");

const UI = `
window.__s = {
  y() { return Math.round(window.scrollY || document.documentElement.scrollTop || 0); },
  url() { return location.pathname + location.search; },
  // 滚动容器确认：谁在滚？window 还是内层容器
  scroller() {
    const doc = document.documentElement;
    const main = document.querySelector('main');
    const inner = [...document.querySelectorAll('body *')].filter(el => {
      const cs = getComputedStyle(el);
      return /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 20;
    }).map(el => el.tagName.toLowerCase() + (typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
    return {
      winScrollable: doc.scrollHeight > window.innerHeight,
      docOverflowY: getComputedStyle(doc).overflowY,
      mainOverflowY: main ? getComputedStyle(main).overflowY : null,
      innerScrollers: inner.slice(0, 5),
    };
  },
  async bottom() {
    // 等页面真正可滚（首屏数据是异步取的，太早量会得 0）
    for (let i = 0; i < 40; i++) {
      if (document.documentElement.scrollHeight > window.innerHeight + 200) break;
      await new Promise(r => setTimeout(r, 150));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(r => setTimeout(r, 260));
    return window.__s.y();
  },
  async clickNav(label) {
    const a = [...document.querySelectorAll('header a, nav a')].find(x => (x.textContent||'').trim().includes(label));
    if (!a) throw new Error('nav link not found: ' + label);
    a.click();
    return true;
  },
  async clickFirst(pattern) {
    const a = document.querySelector('a[href*="' + pattern + '"]');
    if (!a) throw new Error('link not found: ' + pattern);
    a.click();
    return a.getAttribute('href');
  },
  async clickTab(label) {
    const btn = [...document.querySelectorAll('nav button')].find(b => (b.textContent||'').includes(label));
    if (!btn) throw new Error('tab not found: ' + label);
    btn.click();
    return true;
  },
  topText() {
    const h = document.querySelector('h1');
    return h ? (h.textContent||'').trim() : null;
  },
  /** 滚到页面中段（等首屏数据真的把页面撑高） */
  async scrollToMid(fraction = 0.45) {
    for (let i = 0; i < 40; i++) {
      if (document.documentElement.scrollHeight > window.innerHeight + 400) break;
      await new Promise(r => setTimeout(r, 150));
    }
    const target = Math.round((document.documentElement.scrollHeight - window.innerHeight) * fraction);
    window.scrollTo(0, target);
    await new Promise(r => setTimeout(r, 300));
    return window.__s.y();
  },
  clickCardContaining(hay) {
    const a = [...document.querySelectorAll('a')].find(x =>
      (x.textContent||'').includes(hay) && /\\/(patterns|shop|artisans)\\//.test(x.getAttribute('href')||''));
    if (!a) throw new Error('card not found: ' + hay);
    a.click();
    return true;
  },
  clickBackButton() {
    const b = [...document.querySelectorAll('button')].find(x => /^返回/.test((x.textContent||'').trim()));
    if (!b) throw new Error('back button not found');
    b.click();
    return true;
  },
  fakeFirstHistoryEntry() {
    // 模拟"用户直接打开深链接、身后没有历史"的场景
    Object.defineProperty(window.history, 'state', { configurable: true, get: () => ({ idx: 0 }) });
    return true;
  },
  // 顶部内容是否真的在视口里（防止"scrollTop=0 但被 sticky 挡住"这类假通过）
  h1VisibleInViewport() {
    const h = document.querySelector('h1');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return r.top >= -2 && r.top < window.innerHeight;
  },
};
true;
`;

async function main() {
  const b = await launch({ port: 9254, out: OUT, base: BASE });
  const { cdp, base, record, finish, sleep } = b;
  b.title(`滚动复位与返回恢复 · 实测（${BASE.includes("localhost") ? "本地开发服务" : "线上部署版"}）`);

  /* ---- 0. 确认滚动容器（先滚起来，顺带作为组合 1 的起点） ---- */
  await cdp.goto(`${base}/patterns`, 2600);
  await cdp.eval(UI);
  const y1 = await cdp.eval(`window.__s.bottom()`);
  await sleep(200);
  const sc = await cdp.eval(`window.__s.scroller()`);
  record("0a", "滚动容器为 window（页面内没有 overflow 滚动容器）",
    sc.winScrollable === true && sc.innerScrollers.length === 0,
    JSON.stringify(sc));

  /* ---- 1. 图库下滑到底 → 导航到守艺人展厅 ---- */
  record("1a", "起点确已滚到页面深处", y1 > 500, `scrollY=${y1}`);
  await cdp.eval(`window.__s.clickNav('守艺人展厅')`);
  await sleep(2200);
  let y = await cdp.eval(`window.__s.y()`);
  record("1b", "图库 → 守艺人展厅：新页面从顶部开始", y === 0 && (await cdp.eval(`window.__s.h1VisibleInViewport()`)) === true,
    `scrollY=${y} · ${await cdp.eval("window.__s.topText()")}`);
  await cdp.shot("01-图库跳守艺人-已回顶");

  /* ---- 2. 详情页下滑 → 点相关纹样 → 新详情页顶部 ---- */
  await cdp.goto(`${base}/patterns/p0000001-0000-4000-8000-000000000001`, 2600);
  await cdp.eval(UI);
  const y2 = await cdp.eval(`window.__s.bottom()`);
  await sleep(200);
  const relTitleBefore = await cdp.eval(`window.__s.topText()`);
  await cdp.eval(`window.__s.clickFirst('/patterns/')`);
  await sleep(2400);
  y = await cdp.eval(`window.__s.y()`);
  const afterTitle = await cdp.eval(`window.__s.topText()`);
  record("2", `详情页下滑 → 点相关纹样：回到顶部且内容已切换（${relTitleBefore} → ${afterTitle}）`,
    y === 0 && afterTitle !== relTitleBefore, `scrollY=${y}`);
  await cdp.shot("02-相关纹样跳转-已回顶");

  /* ---- 3. 首页 → 文创商城 ---- */
  await cdp.goto(`${base}/`, 2600);
  await cdp.eval(UI);
  await cdp.eval(`window.__s.bottom()`);
  await sleep(200);
  await cdp.eval(`window.__s.clickNav('文创商城')`);
  await sleep(2200);
  y = await cdp.eval(`window.__s.y()`);
  record("3", "首页 → 文创商城：回到顶部", y === 0, `scrollY=${y}`);

  /* ---- 4. 守艺人列表 → 守艺人详情 ---- */
  await cdp.goto(`${base}/artisans`, 2600);
  await cdp.eval(UI);
  await cdp.eval(`window.__s.bottom()`);
  await sleep(200);
  await cdp.eval(`window.__s.clickFirst('/artisans/')`);
  await sleep(2200);
  y = await cdp.eval(`window.__s.y()`);
  record("4", "守艺人列表下滑 → 详情：回到顶部", y === 0, `scrollY=${y}`);

  /* ---- 5. 后台 tab 切换（?tab= 变化） ---- */
  const isLocal = BASE.includes("localhost");
  if (isLocal) {
    await cdp.eval(`localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({access_token:'admin',token_type:'bearer',user:{id:'u-admin-0001',email:'admin@miaoda.com'}}))`);
    await cdp.goto(`${base}/admin?tab=patterns`, 3000);
    await cdp.eval(UI);
    const yb = await cdp.eval(`window.__s.bottom()`);
    await sleep(200);
    await cdp.eval(`window.__s.clickTab('商品管理')`);
    await sleep(2200);
    y = await cdp.eval(`window.__s.y()`);
    record("5", `后台切 tab（?tab=）也回顶（切前 scrollY=${yb}）`, y === 0, `scrollY=${y} · ${await cdp.eval("window.__s.url()")}`);
    await cdp.shot("05-后台切tab-已回顶");
  }

  /* ---- 5b. 返回列表恢复原浏览位置（任务包 C） ---- */
  for (const t of [
    { list: "/patterns", label: "图库", item: "铜鼓纹蜡染", back: "返回图库" },
    { list: "/shop", label: "商城", item: "云纹扎染桌布", back: "返回商城" },
    { list: "/artisans", label: "守艺人展厅", item: "杨桂彩", back: "返回展厅" },
  ]) {
    await cdp.goto(`${base}${t.list}`, 2600);
    await cdp.eval(UI);
    const y0 = await cdp.eval(`window.__s.scrollToMid()`);
    await cdp.eval(`window.__s.clickCardContaining(${JSON.stringify(t.item)})`);
    await sleep(2400);
    const yDetail = await cdp.eval(`window.__s.y()`);
    await cdp.eval(`window.__s.clickBackButton()`);
    await sleep(2600);
    const y1 = await cdp.eval(`window.__s.y()`);
    record(`C-${t.label}`, `${t.label}：下滑 ${y0} → 进详情（顶部 ${yDetail}）→ ${t.back} → 恢复 ${y1}`,
      y0 > 200 && yDetail === 0 && Math.abs(y1 - y0) < 50, `y0=${y0} / 详情=${yDetail} / 返回后=${y1}`);
    await cdp.shot(`06-返回${t.label}-恢复位置`);
  }

  /* ---- 5c. 浏览器后退键同样恢复位置 ---- */
  await cdp.goto(`${base}/patterns`, 2600);
  await cdp.eval(UI);
  const yBefore = await cdp.eval(`window.__s.scrollToMid()`);
  await cdp.eval(`window.__s.clickCardContaining('鱼鸟纹蜡染')`);
  await sleep(2400);
  await cdp.eval(`history.back()`);
  await sleep(2600);
  const yAfterBack = await cdp.eval(`window.__s.y()`);
  record("C-后退键", `浏览器后退键恢复到 ${yAfterBack}（离开时 ${yBefore}）`,
    yBefore > 200 && Math.abs(yAfterBack - yBefore) < 50,
    `差值 ${Math.abs(yAfterBack - yBefore)}px`);

  /* ---- 5d. 无历史可退时 fallback 到列表顶部 ---- */
  await cdp.goto(`${base}/patterns/p0000001-0000-4000-8000-000000000001`, 2600);
  await cdp.eval(UI);
  await cdp.eval(`window.__s.fakeFirstHistoryEntry()`);
  await cdp.eval(`window.__s.clickBackButton()`);
  await sleep(2600);
  record("C-fallback", "身后无历史时点返回 → 落到图库路径且位于顶部",
    (await cdp.eval(`window.__s.url()`)).startsWith(`${BASE_PATH}/patterns`) &&
      (await cdp.eval(`window.__s.y()`)) === 0,
    `${await cdp.eval("window.__s.url()")} · scrollY=${await cdp.eval("window.__s.y()")}`);

  /* ---- 6. 前进 / 后退不得报错 ---- */
  const before = cdp.consoleErrors.length;
  await cdp.send("Page.navigateToHistoryEntry", { entryId: (await cdp.send("Page.getNavigationHistory")).entries[0].id });
  await sleep(1500);
  await cdp.send("Page.navigateToHistoryEntry", {
    entryId: (await cdp.send("Page.getNavigationHistory")).entries.slice(-1)[0].id,
  });
  await sleep(1500);
  const navErrors = cdp.consoleErrors.slice(before).filter((e) => !/favicon|404|Failed to load resource|net::ERR/i.test(e));
  record("6", "前进/后退导航不产生报错", navErrors.length === 0, navErrors.slice(0, 2).join(" | "));

  record("7", "全程控制台无异常报错", cdp.cleanErrors().length === 0, cdp.cleanErrors().slice(0, 2).join(" | "));
  finish("滚动复位验收");
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
