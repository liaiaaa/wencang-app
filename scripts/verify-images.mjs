// ============================================================
// 任务包 B · 四模块程序化配图 · 验收实测
//
// 覆盖：45 纹样张张不同 / 同一条在图库·详情·首页三处一致 /
//       守艺人 10 · 商品 10 · 体验项目 7 互不相同 /
//       断网（屏蔽外链 CDN）后全部图片正常显示 / localStorage 体积
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-images.mjs`
// 产物：docs/screenshots/images/*.png
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "images");
const BASE = process.env.BASE_URL || "http://localhost:5173";

const UI = `
window.__i = {
  hash(s) {
    let x = 5381;
    for (let i = 0; i < s.length; i++) x = (((x << 5) + x) ^ s.charCodeAt(i)) >>> 0;
    return x.toString(16) + ":" + s.length;
  },
  /** 页面上所有 <img> 的 (归属标识, 图片指纹, 是否真的画出来了) */
  images(scopeSelector) {
    const root = scopeSelector ? document.querySelector(scopeSelector) : document;
    if (!root) return [];
    return [...root.querySelectorAll('img')]
      .filter(img => (img.getAttribute('src') || '').startsWith('data:') || (img.getAttribute('src') || '').startsWith('http'))
      .map(img => ({
        key: (img.closest('a') || {}).getAttribute ? ((img.closest('a').getAttribute('href') || '') + '#' + (img.alt || '')) : (img.alt || ''),
        href: img.closest('a') ? img.closest('a').getAttribute('href') : null,
        alt: img.alt || '',
        sig: window.__i.hash(img.currentSrc || img.src),
        dataUrl: (img.getAttribute('src') || '').startsWith('data:'),
        w: img.naturalWidth,
        h: img.naturalHeight,
      }));
  },
  text() { return document.body.innerText; },
  url() { return location.pathname; },
  dbSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += (k || '').length + (localStorage.getItem(k) || '').length;
    }
    return total;
  },
  pickOption(n) {
    const sel = [...document.querySelectorAll('[role="combobox"]')][n];
    if (!sel) throw new Error('combobox #' + n + ' not found');
    sel.click();
    return true;
  },
  async chooseNthOption(n) {
    const opts = [...document.querySelectorAll('[role="option"]')];
    const o = opts[n];
    if (!o) throw new Error('option #' + n + ' not found (共 ' + opts.length + ' 项)');
    o.click();
    await new Promise(r => setTimeout(r, 500));
    return (o.textContent || '').trim();
  },
};
true;
`;

/** 同一张图在页面上可能出现多次，按 href 归并 */
function uniqByHref(list) {
  const m = new Map();
  for (const it of list) {
    const k = it.href || it.alt;
    if (!k || !m.has(k)) m.set(k, it);
  }
  return [...m.values()];
}

async function main() {
  const b = await launch({ port: 9257, out: OUT, base: BASE });
  const { cdp, base, record, finish, sleep } = b;
  b.title("任务包B 程序化配图 · 实测（已屏蔽外链图片）");

  // 断网模拟：屏蔽演示配图 CDN 与任意外部图片域名，程序化图必须照常显示
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", {
    urls: ["*miaoda-site-img*", "*cdn.bcebos.com*", "*.unsplash.com*", "*picsum.photos*"],
  });

  /* ---- 1. 图库 45 张 ---- */
  await cdp.goto(`${base}/patterns`, 3200);
  await cdp.eval(UI);
  const gallery = uniqByHref(await cdp.eval(`window.__i.images()`)).filter((x) => /\/patterns\//.test(x.href || ""));
  const gSigs = new Set(gallery.map((x) => x.sig));
  record("1a", "图库渲染 45 张卡片图", gallery.length === 45, `实际 ${gallery.length} 张`);
  record("1b", "45 张配图两两不同", gSigs.size === gallery.length, `唯一指纹 ${gSigs.size} 个`);
  record("1c", "全部为 data URL 且已绘制出来（断网无外部请求）",
    gallery.every((x) => x.dataUrl && x.w > 0),
    `dataURL ${gallery.filter((x) => x.dataUrl).length} / 已加载 ${gallery.filter((x) => x.w > 0).length}`);
  await cdp.shot("01-图库45张配图");

  /* ---- 2. 同一条纹样：首页精选 / 图库 / 详情 三处一致 ---- */
  // 首页精选只取最新 5 条，因此从首页反向取目标，保证三处都一定有它
  await cdp.goto(`${base}/`, 2800);
  await cdp.eval(UI);
  const home = (await cdp.eval(`window.__i.images()`)).filter((x) => x.href && /\/patterns\//.test(x.href));
  const target = home[0];
  record("2a", `首页精选有 ${home.length} 条纹样可作比对`, home.length > 0, target ? target.alt : "");

  await cdp.goto(`${base}${target.href}`, 2600);
  await cdp.eval(UI);
  const detailHero = (await cdp.eval(`window.__i.images()`)).find((x) => x.alt === target.alt);
  record("2b", "详情页主图与首页精选为同一幅", !!detailHero && detailHero.sig === target.sig,
    `${target.alt}：${target.sig} vs ${detailHero ? detailHero.sig : "未找到"}`);

  await cdp.goto(`${base}/patterns`, 3200);
  await cdp.eval(UI);
  const card = uniqByHref(await cdp.eval(`window.__i.images()`)).find((x) => x.alt === target.alt);
  record("2c", "图库卡片与上述两处同为同一幅", !!card && card.sig === target.sig,
    `${target.alt}：${target.sig} vs ${card ? card.sig : "未找到"}`);
  await cdp.shot("02-详情主图");

  /* ---- 3. 守艺人 10 张头像 ---- */
  await cdp.goto(`${base}/artisans`, 2800);
  await cdp.eval(UI);
  const artisans = uniqByHref(await cdp.eval(`window.__i.images()`)).filter((x) => /\/artisans\//.test(x.href || ""));
  const aSigs = new Set(artisans.map((x) => x.sig));
  record("3", "守艺人 10 位头像互不相同且已绘制",
    artisans.length === 10 && aSigs.size === 10 && artisans.every((x) => x.w > 0),
    `${artisans.length} 张 / 唯一 ${aSigs.size}`);
  await cdp.shot("03-守艺人头像");

  /* ---- 4. 商品 10 张 ---- */
  await cdp.goto(`${base}/shop`, 2800);
  await cdp.eval(UI);
  const products = uniqByHref(await cdp.eval(`window.__i.images()`)).filter((x) => /\/shop\//.test(x.href || ""));
  const pSigs = new Set(products.map((x) => x.sig));
  record("4", "商品 10 张海报卡互不相同",
    products.length === 10 && pSigs.size === 10 && products.every((x) => x.w > 0),
    `${products.length} 张 / 唯一 ${pSigs.size}`);
  await cdp.shot("04-商品配图");

  /* ---- 5. 体验项目 7 张（逐个选择） ---- */
  await cdp.goto(`${base}/booking`, 2800);
  await cdp.eval(UI);
  const projectSigs = new Set();
  const picked = [];
  for (let i = 0; i < 7; i++) {
    await cdp.eval(`window.__i.pickOption(1)`); // 第 2 个下拉是体验项目
    await sleep(500);
    const name = await cdp.eval(`window.__i.chooseNthOption(${i})`);
    await sleep(700);
    const imgs = await cdp.eval(`window.__i.images()`);
    const thumb = imgs.find((x) => x.dataUrl && x.w > 0);
    if (thumb) {
      projectSigs.add(thumb.sig);
      picked.push(`${name}→${thumb.sig.slice(0, 6)}`);
    }
  }
  record("5", "7 个体验项目配图互不相同", projectSigs.size === 7, picked.join(" / "));
  await cdp.shot("05-体验项目配图");

  /* ---- 6. 页面不再引用外链图片 ---- */
  const stillReferencing = await cdp.eval(`
    [...document.querySelectorAll('img')].filter(i => (i.getAttribute('src')||'').includes('miaoda-site-img')).length
  `);
  record("6", "页面上不再残留旧外链图片地址", stillReferencing === 0, `残留 ${stillReferencing} 处`);

  /* ---- 7. 体积 ---- */
  await cdp.goto(`${base}/`, 2600);
  await cdp.eval(UI);
  const size = await cdp.eval(`window.__i.dbSize()`);
  record("7", `localStorage 体积 ${Math.round((size * 3) / 1024)} KB < 2MB（图片不落盘）`,
    size * 3 < 2 * 1024 * 1024, `UTF-16 ${size} 字符`);

  record("8", "控制台无异常报错", cdp.cleanErrors().length === 0, cdp.cleanErrors().slice(0, 2).join(" | "));
  finish("程序化配图验收");
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
