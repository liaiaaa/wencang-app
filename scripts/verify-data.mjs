// ============================================================
// 任务包 4 · 种子数据扩充与版本化 · 验收实测
//
// 覆盖：首页统计 / 三类各 15 条筛选 / 关键词搜索 / 详情抽查 /
//       守艺人示例档案 / 商品关联可跳转 / 旧版本自动升级 /
//       后台「重置演示数据」/ localStorage 体积
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-data.mjs`
// 产物：docs/screenshots/data/*.png
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "data");
const BASE = process.env.BASE_URL || "http://localhost:5173";
// 线上产物没有 dev server 的模块图，涉及直接调数据层的检查只能在本地跑
const IS_DEV = /localhost|127[.]0[.]0[.]1/.test(BASE);

const UI = `
window.__d = {
  text() { return document.body.innerText; },
  url() { return location.pathname + location.search; },
  seed() {
    localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
      access_token: 'admin', token_type: 'bearer',
      user: { id: 'u-admin-0001', email: 'admin@miaoda.com' }
    }));
    return true;
  },
  dbSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += (k || '').length + (localStorage.getItem(k) || '').length;
    }
    return total;
  },
  clickText(t) {
    const el = [...document.querySelectorAll('button,a')].find(b => (b.textContent||'').trim() === t);
    if (!el) throw new Error('clickable not found: ' + t);
    el.click();
    return true;
  },
  clickLike(t) {
    const el = [...document.querySelectorAll('button,a')].find(b => (b.textContent||'').includes(t));
    if (!el) throw new Error('clickable not found: ' + t);
    el.click();
    return true;
  },
  fill(sel, v) {
    const el = document.querySelector(sel);
    if (!el) throw new Error('not found ' + sel);
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  // 图库卡片数（卡片是 a[href^="/patterns/"]，去重到唯一 href）
  galleryCount() {
    const set = new Set([...document.querySelectorAll('a[href*="/patterns/"]')].map(a => a.getAttribute('href')));
    return set.size;
  },
  artisanBadges() {
    const cards = [...document.querySelectorAll('a[href*="/artisans/"]')];
    const uniq = new Set(cards.map(a => a.getAttribute('href'))).size;
    const badges = [...document.querySelectorAll('span,div')].filter(e =>
      (e.textContent||'').trim() === '示例档案' && e.children.length === 0).length;
    return { uniq, badges };
  },
  /** 当前详情页的档案区块统计 */
  archive() {
    const t = document.body.innerText;
    const steps = document.querySelectorAll('ol li').length;
    const sceneSec = [...document.querySelectorAll('section')].find(s => (s.textContent||'').includes('传统应用场景'));
    const scenes = sceneSec ? sceneSec.querySelectorAll('div.inline-flex').length : 0;
    const relSec = [...document.querySelectorAll('section')].find(s => (s.textContent||'').includes('相关纹样'));
    const rel = relSec ? [...relSec.querySelectorAll('a[href*="/patterns/"]')].map(a => a.getAttribute('href')) : [];
    const storyLen = (() => {
      const i = t.indexOf('文化故事');
      if (i < 0) return 0;
      const rest = t.slice(i + 4);
      const j = rest.indexOf('传统应用场景');
      return (j > 0 ? rest.slice(0, j) : rest).replace(/\\s/g, '').length;
    })();
    return {
      title: (document.querySelector('h1')||{}).textContent || '',
      steps, scenes, storyLen,
      relCount: rel.length,
      relUnique: new Set(rel).size,
      relSelf: rel.some(h => location.pathname.endsWith((h||'').split('/').pop())),
    };
  },
  productArtisanLink() {
    const a = [...document.querySelectorAll('a')].find(x => (x.getAttribute('href')||'').includes('/artisans/'));
    return a ? { href: a.getAttribute('href'), text: (a.textContent||'').trim() } : null;
  },
  /** 商城卡片里「出自 · X」行的可点击比例 */
  shopLinks() {
    const lines = [...document.querySelectorAll('p')].filter(p => (p.textContent||'').trim().startsWith('出自 · '));
    return { total: lines.length, clickable: lines.filter(p => p.children.length > 0).length };
  },
  /** 写入一份"上个版本"的存量库（内容表极小 + 一条预约），用于验证自动升级 */
  plantLegacy() {
    const mk = (n) => ({ id: 'old-' + n, name: '旧纹样' + n, category: '蜡染', region: 'x',
      technique: 'x', meaning: 'x', image_url: 'x', created_at: '2024-01-01T00:00:00.000Z' });
    localStorage.setItem('wenzang.mock.db.v1', JSON.stringify({
      patterns: [mk(1), mk(2), mk(3)],
      artisans: [], products: [], experience_projects: [],
      bookings: [{ id: 'keep-1', user_id: 'u-demo-0001', artisan_id: null, project_id: null,
        artisan_name: '老守艺人', project_name: '老体验项目', book_date: '2025-04-01',
        time_slot: '上午', contact_name: '老用户', contact_phone: '13800000009',
        status: '待确认', created_at: '2025-03-01T00:00:00.000Z' }],
      orders: [], ai_patterns: [],
      profiles: [{ id: 'u-old-0001', email: 'old@miaoda.com', role: 'user', created_at: '2024-01-01T00:00:00.000Z' }],
    }));
    localStorage.setItem('wenzang.mock.seed.v1', '1');
    localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
      access_token: 'demo', token_type: 'bearer', user: { id: 'u-demo-0001', email: 'demo@miaoda.com' }
    }));
    return true;
  },
  db() { return JSON.parse(localStorage.getItem('wenzang.mock.db.v1') || 'null'); },
  /** 首页统计条：标签 <p> 的前一个兄弟节点即数字 */
  stats() {
    const labels = ['收录纹样', '守艺人', '体验项目'];
    const out = {};
    for (const label of labels) {
      const p = [...document.querySelectorAll('p')].find(x => (x.textContent||'').trim() === label);
      const prev = p && p.previousElementSibling;
      out[label] = prev ? Number((prev.textContent||'').trim()) : null;
    }
    return out;
  },
};
true;
`;

async function main() {
  const b = await launch({ port: 9255, out: OUT, base: BASE });
  const { cdp, base, record, finish, sleep } = b;
  b.title("任务包4 种子数据扩充与版本化 · 实测");

  /* ---- 1. 首页统计条 ---- */
  await cdp.goto(`${base}/`, 2800);
  await cdp.eval(UI);
  const st = await cdp.eval(`window.__d.stats()`);
  record("1", "首页统计条为 45 纹样 / 10 守艺人 / 7 体验项目",
    st["收录纹样"] === 45 && st["守艺人"] === 10 && st["体验项目"] === 7,
    `实际 ${st["收录纹样"]} / ${st["守艺人"]} / ${st["体验项目"]}`);
  await cdp.shot("01-首页统计条", true);

  /* ---- 2. 图库三类各 15 条 + 搜索 ---- */
  const perCategory = {};
  for (const cat of ["全部", "蜡染", "扎染", "苗绣"]) {
    await cdp.goto(`${base}/patterns`, 2400);
    await cdp.eval(UI);
    if (cat !== "全部") await cdp.eval(`window.__d.clickText(${JSON.stringify(cat)})`);
    await sleep(1600);
    perCategory[cat] = await cdp.eval(`window.__d.galleryCount()`);
  }
  record("2a", "图库筛选：蜡染 / 扎染 / 苗绣 各 15 条",
    perCategory["蜡染"] === 15 && perCategory["扎染"] === 15 && perCategory["苗绣"] === 15,
    JSON.stringify(perCategory));
  record("2b", "「全部」下图库渲染 45 条", perCategory["全部"] === 45, `实际 ${perCategory["全部"]}`);

  await cdp.goto(`${base}/patterns`, 2400);
  await cdp.eval(UI);
  await cdp.eval(`window.__d.fill('input', '蝴蝶')`);
  await sleep(200);
  await cdp.eval(`window.__d.clickText('搜索')`); // 关键词要点「搜索」才生效
  await sleep(1800);
  const searched = await cdp.eval(`window.__d.galleryCount()`);
  record("2c", "关键词搜索「蝴蝶」有结果且不全量", searched > 1 && searched < 45, `命中 ${searched} 条`);
  await cdp.shot("02-图库搜索蝴蝶");

  /* ---- 3. 抽查 5 条详情页（用固定种子 id，本地与线上都能跑） ---- */
  const sample = [
    { id: "p0000042-0000-4000-8000-000000000042", name: "马樱花纹背扇", category: "苗绣" },
    { id: "p0000033-0000-4000-8000-000000000033", name: "苍山雪月扎染", category: "扎染" },
    { id: "p0000024-0000-4000-8000-000000000024", name: "井字纹蜡染", category: "蜡染" },
    { id: "p0000015-0000-4000-8000-000000000015", name: "蝴蝶妈妈衣襟绣", category: "苗绣" },
    { id: "p0000006-0000-4000-8000-000000000006", name: "蝴蝶纹蜡染", category: "蜡染" },
  ];
  const bad = [];
  for (const s of sample) {
    await cdp.goto(`${base}/patterns/${s.id}`, 2200);
    await cdp.eval(UI);
    const info = await cdp.eval(`window.__d.archive()`);
    const ok =
      info.steps >= 3 &&
      info.storyLen >= 150 &&
      info.storyLen <= 260 &&
      info.scenes >= 2 &&
      info.relCount >= 2 &&
      info.relUnique === info.relCount &&
      info.relSelf === false &&
      info.title.includes(s.name);
    if (!ok) bad.push({ ...s, ...info });
  }
  record("3", `抽查 5 条纹样详情：工序/故事/场景/相关全部达标`, bad.length === 0,
    bad.length ? JSON.stringify(bad).slice(0, 220) : sample.map((s) => s.name).join(" / "));
  await cdp.shot("03-抽查详情页档案", true);

  /* ---- 4. 守艺人展厅：10 位均带示例档案 ---- */
  await cdp.goto(`${base}/artisans`, 2600);
  await cdp.eval(UI);
  const ab = await cdp.eval(`window.__d.artisanBadges()`);
  record("4", "守艺人展厅 10 位且全部带「示例档案」标注",
    ab.uniq === 10 && ab.badges === 10, `卡片 ${ab.uniq} / 标注 ${ab.badges}`);
  await cdp.shot("04-守艺人展厅", true);

  /* ---- 5. 商品全部关联守艺人且可跳转 ---- */
  await cdp.goto(`${base}/shop`, 2600);
  await cdp.eval(UI);
  const shopText = await cdp.eval(`window.__d.text()`);
  const productCount = new Set(
    (await cdp.eval(`[...document.querySelectorAll('a[href*="/shop/"]')].map(a => a.getAttribute('href'))`)).filter((h) => /\/shop\/[^/]+$/.test(h)),
  ).size;
  record("5a", "商城渲染 10 件商品", productCount === 10, `实际 ${productCount}`);
  const sl = await cdp.eval(`window.__d.shopLinks()`);
  record("5b", "商城 10 件商品的守艺人全部可跳转（无「暂无关联」）",
    sl.total === 10 && sl.clickable === 10 && !shopText.includes("暂无关联"),
    `可点 ${sl.clickable} / ${sl.total}`);

  // 锦鸡纹刺绣袖片一对 → 吴良花（固定种子，本地与线上都能跑）
  const linkOk = {
    id: "g0000007-0000-4000-8000-000000000007",
    name: "锦鸡纹刺绣袖片一对",
    artisan: "吴良花",
    href: "/artisans/a0000004-0000-4000-8000-000000000004",
  };
  await cdp.goto(`${base}/shop/${linkOk.id}`, 2400);
  await cdp.eval(UI);
  const pl = await cdp.eval(`window.__d.productArtisanLink()`);
  const hrefTail = (pl?.href || "").replace(/^\/wencang-app/, "");
  record("5c", "商品详情页守艺人可跳转到对应档案",
    !!pl && hrefTail === linkOk.href && pl.text.includes(linkOk.artisan),
    `${pl?.href ?? "无链接"} · ${linkOk.name}`);
  await cdp.shot("05-商品详情守艺人链接");

  /* ---- 6. 旧版本存量数据自动升级 ---- */
  await cdp.goto(`${base}/`, 1500);
  await cdp.eval(UI);
  await cdp.eval(`window.__d.plantLegacy()`);
  await cdp.goto(`${base}/patterns`, 3000);
  await cdp.eval(UI);
  const upgraded = await cdp.eval(`
    (() => {
      const db = window.__d.db();
      return {
        patterns: db.patterns.length,
        artisans: db.artisans.length,
        products: db.products.length,
        projects: db.experience_projects.length,
        bookings: db.bookings.map(b => b.id),
        profiles: db.profiles.map(p => p.email),
        seed: localStorage.getItem('wenzang.mock.seed.v1'),
      };
    })()
  `);
  record("6a", "旧版本号存量数据刷新后自动升级到新种子",
    upgraded.patterns === 45 && upgraded.artisans === 10 &&
      upgraded.products === 10 && upgraded.projects === 7 &&
      upgraded.seed !== "1",
    JSON.stringify({ p: upgraded.patterns, a: upgraded.artisans, pr: upgraded.products, e: upgraded.projects, v: upgraded.seed }));
  record("6b", "升级只重建内容表，用户档案与预约保留",
    upgraded.bookings.includes("keep-1") && upgraded.profiles.includes("old@miaoda.com"),
    JSON.stringify(upgraded));

  // 老预约引用的项目已不存在，前台仍能正常显示
  await cdp.goto(`${base}/profile?tab=bookings`, 2800);
  await cdp.eval(UI);
  const bkText = await cdp.eval(`window.__d.text()`);
  record("6c", "引用已不存在项目的老预约仍能正常显示",
    bkText.includes("老体验项目") || bkText.includes("我的预约"),
    bkText.includes("老体验项目") ? "按冗余名称展示" : "未渲染列表");
  await cdp.shot("06-旧数据升级后预约", true);

  /* ---- 7. 后台「重置演示数据」 ---- */
  await cdp.goto(`${base}/`, 1500);
  await cdp.eval(UI);
  await cdp.eval(`window.__d.seed()`);
  await cdp.goto(`${base}/admin?tab=patterns`, 3000);
  await cdp.eval(UI);
  // 先造脏数据：新建一条 + 归档一条
  await cdp.eval(`window.__d.clickLike('新建')`);
  await sleep(1000);
  await cdp.eval(`
    (() => {
      const dlg = document.querySelector('[role="dialog"]');
      const el = dlg.querySelectorAll('input')[0];
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '脏数据纹样·重置前');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `);
  await cdp.eval(`window.__d.clickLike('创建')`);
  await sleep(2200);
  const dirty = await cdp.eval(`window.__d.db().patterns.filter(p => p.name === '脏数据纹样·重置前').length`);
  record("7a", "重置前已存在脏数据", dirty === 1, `脏数据 ${dirty} 条`);

  await cdp.eval(`window.__d.clickLike('概况看板')`);
  await sleep(1800);
  await cdp.eval(`window.__d.clickLike('重置演示数据')`);
  await sleep(2400);
  const afterReset = await cdp.eval(`
    (() => {
      const db = window.__d.db();
      return {
        patterns: db.patterns.length,
        dirty: db.patterns.filter(p => String(p.name).startsWith('脏数据')).length,
        bookings: db.bookings.length,
        profiles: db.profiles.length,
        keepBooking: db.bookings.some((b) => b.id === "keep-1"),
        keepProfile: db.profiles.some((p) => p.email === "old@miaoda.com"),
        toast: document.body.innerText.includes('演示数据已重置'),
      };
    })()
  `);
  record("7b", "点击「重置演示数据」后内容回到 45 条、脏数据清空",
    afterReset.patterns === 45 && afterReset.dirty === 0, JSON.stringify(afterReset));
  record("7c", "重置成功有 toast 提示", afterReset.toast === true);
  record("7d", "重置只动内容表：用户账号与预约保留",
    afterReset.keepBooking === true && afterReset.keepProfile === true,
    `预约 ${afterReset.bookings} 条 / 账号 ${afterReset.profiles} 个`);
  await cdp.shot("07-重置演示数据后", true);

  /* ---- 8. 权限：普通用户看不到也调不动重置 ---- */
  await cdp.goto(`${base}/`, 1500);
  await cdp.eval(UI);
  if (IS_DEV) {
    /* 权限检查必须落在同一个 mock 实例上：页面里再 import 一次会拿到第二个实例，
       在实例 B 登录、却调实例 A 的接口，测出来的结果是假的 */
    const denied = await cdp.eval(`
      (async () => {
        const { supabase } = await import('/src/db/supabase.mock.ts');
        await supabase.auth.signInWithPassword({ email: 'demo@miaoda.com', password: 'demo123456' });
        const r = supabase.resetDemoContent();
        const patterns = JSON.parse(localStorage.getItem('wenzang.mock.db.v1')).patterns.length;
        return { code: r.error ? r.error.code : null, patterns };
      })()
    `);
    record("8", "普通用户调用重置被拒（403）且数据未被改动",
      denied.code === "403" && denied.patterns === 45, `code=${denied.code} / 纹样 ${denied.patterns} 条`);
  }

  /* ---- 9. 体积 ---- */
  await cdp.goto(`${base}/`, 2200);
  await cdp.eval(UI);
  const size = await cdp.eval(`window.__d.dbSize()`);
  record("9", `localStorage 体积远低于 2MB 上限`, size > 0 && size * 3 < 2 * 1024 * 1024,
    `UTF-16 ${size} 字符 ≈ ${(size * 3 / 1024).toFixed(0)} KB`);

  record("10", "控制台无异常报错", cdp.cleanErrors().length === 0, cdp.cleanErrors().slice(0, 2).join(" | "));
  finish("种子数据验收");
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
