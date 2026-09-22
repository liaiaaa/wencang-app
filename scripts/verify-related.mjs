// ============================================================
// Bug 修复验收 · 相关纹样重复条目 / 跳转后数据不刷新
//
// 覆盖：自身排除、列表去重、归档过滤、A→B→C 连续跳转每步都干净、
//       跳转后主内容确为目标纹样（不是上一篇残留）
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-related.mjs`
//       复测线上：BASE_URL=https://liaiaaa.github.io/wencang-app/ node scripts/verify-related.mjs
// 产物：docs/screenshots/related/*.png
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "related");
const BASE = process.env.BASE_URL || "http://localhost:5173";
// 线上产物没有 dev server 的模块图，数据层探针只能在本地跑
const IS_DEV = /localhost|127\.0\.0\.1/.test(BASE);

const UI = `
window.__r = {
  url() { return location.pathname; },
  patternId() { const m = location.pathname.match(/\\/patterns\\/([^/?#]+)/); return m ? m[1] : null; },
  title() { const h = document.querySelector('h1'); return h ? (h.textContent||'').trim() : null; },
  // 相关纹样区块里的卡片
  related() {
    const sec = [...document.querySelectorAll('section')].find(s => (s.textContent||'').includes('相关纹样'));
    if (!sec) return null;
    const cards = [...sec.querySelectorAll('a[href*="/patterns/"]')].map(a => ({
      href: a.getAttribute('href'),
      id: (a.getAttribute('href')||'').replace(/^.*\\/patterns\\//, ''),
      name: ((a.querySelector('h3') || {}).textContent || '').trim(),
    }));
    return { count: cards.length, cards, text: (sec.textContent||'').replace(/\\s+/g,' ').slice(0, 400) };
  },
  clickRelated(n) {
    const sec = [...document.querySelectorAll('section')].find(s => (s.textContent||'').includes('相关纹样'));
    const a = sec && sec.querySelectorAll('a[href*="/patterns/"]')[n];
    if (!a) throw new Error('related card #' + n + ' not found');
    a.click();
    return a.getAttribute('href');
  },
  // 以管理员身份注入会话（内容表只有管理员可写）
  seed() {
    localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
      access_token: 'admin', token_type: 'bearer',
      user: { id: 'u-admin-0001', email: 'admin@miaoda.com' }
    }));
    return true;
  },
  rowBtn(name, btnText) {
    const rows = [...document.querySelectorAll('div')]
      .filter(d => d.textContent.includes(name) && d.querySelector('button'));
    if (!rows.length) throw new Error('row not found: ' + name);
    const row = rows[rows.length - 1];
    const btn = [...row.querySelectorAll('button')].find(b => b.textContent.trim().includes(btnText));
    if (!btn) throw new Error('row button not found: ' + btnText);
    btn.click();
    return true;
  },
  // 页面里所有指向纹样详情的链接（用于发现"整页重复渲染"）
  allPatternLinks() { return [...document.querySelectorAll('a[href*="/patterns/"]')].map(a => a.getAttribute('href')); },
};
true;
`;

/** 断言一个详情页的相关纹样区块是干净的 */
function checkClean(record, id, page, info, currentId) {
  if (!info) {
    record(id, `${page} 存在相关纹样区块`, false, "区块未渲染");
    return;
  }
  const ids = info.cards.map((c) => c.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  record(`${id}a`, `${page} 相关纹样不含自身`, !ids.includes(currentId),
    ids.includes(currentId) ? `出现自身 ${currentId}` : `${ids.length} 条`);
  record(`${id}b`, `${page} 相关纹样无重复`, dup.length === 0, dup.length ? `重复：${JSON.stringify(dup)}` : "");
  record(`${id}c`, `${page} 卡片名称不重复`,
    new Set(info.cards.map((c) => c.name)).size === info.cards.length,
    info.cards.map((c) => c.name).join(" / "));
}

async function main() {
  const b = await launch({ port: 9252, out: OUT, base: BASE });
  const { cdp, base, record, finish, sleep } = b;
  b.title("Bug3 相关纹样重复 / 跳转残留 · 实测");

  const start = `${base}/patterns/p0000001-0000-4000-8000-000000000001`;

  /* ---- 1. 首个详情页 ---- */
  await cdp.goto(start, 2600);
  await cdp.eval(UI);
  let cur = await cdp.eval(`window.__r.patternId()`);
  let info = await cdp.eval(`window.__r.related()`);
  checkClean(record, "1", "纹样 A", info, cur);
  const titleA = await cdp.eval(`window.__r.title()`);
  record("1d", "A 的主标题为纹样名", !!titleA, titleA || "");
  await cdp.shot("01-A-相关纹样", true);

  /* ---- 2. A → B ---- */
  const hrefB = await cdp.eval(`window.__r.clickRelated(0)`);
  await sleep(2000);
  cur = await cdp.eval(`window.__r.patternId()`);
  info = await cdp.eval(`window.__r.related()`);
  const titleB = await cdp.eval(`window.__r.title()`);
  record("2a", "点击相关纹样后 URL 与目标一致", hrefB?.endsWith(`/patterns/${cur}`), `${hrefB} → ${cur}`);
  record("2b", "B 的主内容已切换（非 A 残留）", !!titleB && titleB !== titleA, `A=「${titleA}」 B=「${titleB}」`);
  checkClean(record, "2", "纹样 B", info, cur);
  await cdp.shot("02-B-相关纹样", true);

  /* ---- 3. B → C → D 连续跳转，每步都要干净 ---- */
  let prevTitle = titleB;
  const visited = [titleA, titleB];
  for (let step = 0; step < 2; step++) {
    const label = step === 0 ? "C" : "D";
    const href = await cdp.eval(`window.__r.clickRelated(${step === 0 ? 1 : 0})`);
    await sleep(2000);
    const id = await cdp.eval(`window.__r.patternId()`);
    const t = await cdp.eval(`window.__r.title()`);
    const rel = await cdp.eval(`window.__r.related()`);
    record(`3${label}a`, `跳到 ${label} 后主内容切换`, !!t && t !== prevTitle, `前=「${prevTitle}」 现=「${t}」`);
    record(`3${label}b`, `${label} 的 URL 与点击目标一致`, href?.endsWith(`/patterns/${id}`), `${href} → ${id}`);
    checkClean(record, `3${label}`, `纹样 ${label}`, rel, id);
    visited.push(t);
    prevTitle = t;
    await cdp.eval(UI);
  }
  record("3e", "连续跳转链每页主内容都随 URL 切换（无上一篇残留）",
    visited.length === 4 && visited[0] !== visited[1] && visited[1] !== visited[2] && visited[2] !== visited[3],
    visited.join(" → "));
  await cdp.shot("03-连续跳转后", true);

  /* ---- 4. 整页不应出现重复的相关区块 ---- */
  const dupSections = await cdp.eval(`
    [...document.querySelectorAll('section')].filter(s => (s.textContent||'').includes('相关纹样')).length
  `);
  record("4a", "页面只有一个「相关纹样」区块", dupSections === 1, `实际 ${dupSections} 个`);

  const probe = IS_DEV
    ? await cdp.eval(`
    (async () => {
      const api = await import('/src/lib/api.ts');
      const { pickRelatedPatterns } = await import('/src/lib/related.ts');
      const all = await api.fetchPatterns();
      const live = new Set(all.map(p => p.id));
      const bad = [];
      for (const p of all) {
        const list = pickRelatedPatterns(all, p.id, 3);
        const ids = list.map(r => r.id);
        if (ids.includes(p.id)) bad.push(p.name + ' 含自身');
        if (new Set(ids).size !== ids.length) bad.push(p.name + ' 有重复');
        for (const r of list) if (!live.has(r.id)) bad.push(p.name + ' 指向不在架纹样');
      }
      return { bad, checked: all.length };
    })()
  `)
    : { bad: [], checked: 0, skipped: true };

  if (!probe.skipped) {
    record("4b", "推荐结果恒为在架、不含自身、不重复（数据层全量抽查）",
      probe.bad.length === 0, `抽查 ${probe.checked} 条；异常 ${JSON.stringify(probe.bad).slice(0, 160)}`);
  }

  /* ---- 4c. 归档 → 前台推荐不再包含它（走真实 UI） ----
     涉及写入的校验必须通过界面做：在页面里 `import('/src/db/supabase.mock.ts')`
     拿到的是**第二个模块实例**（应用自身是经别名 + HMR 时间戳加载的），
     两份内存库互不可见，自己 import 数据层写、再从界面读会得出假故障。 */
  const victimName = "鱼鸟纹蜡染"; // 蝶恋花靛蓝纹的 related_patterns 显式引用了它
  await cdp.eval(`window.__r.seed()`);
  await cdp.goto(`${base}/admin?tab=patterns`, 2600);
  await cdp.eval(UI);
  await cdp.eval(`window.__r.rowBtn(${JSON.stringify(victimName)}, '归档')`);
  await sleep(2200);
  await cdp.goto(`${base}/patterns/p0000001-0000-4000-8000-000000000001`, 2600);
  await cdp.eval(UI);
  const afterArchive = await cdp.eval(`window.__r.related()`);
  const leaked = afterArchive?.cards?.some((c) => c.name === victimName) ?? false;
  record("4c", "归档纹样不进入前台推荐（后台归档 → 详情页校验）", !leaked,
    leaked ? `仍推荐了已归档的「${victimName}」` : `推荐 ${(afterArchive?.cards || []).map((c) => c.name).join(" / ")}`);
  checkClean(record, "4", "归档后的 A", afterArchive, await cdp.eval(`window.__r.patternId()`));
  await cdp.shot("04-归档后推荐已剔除", true);

  // 恢复原状，避免影响后续脚本
  await cdp.eval(`window.__r.seed()`);
  await cdp.goto(`${base}/admin?tab=patterns`, 2600);
  await cdp.eval(UI);
  await cdp.eval(`window.__r.rowBtn(${JSON.stringify(victimName)}, '恢复')`);
  await sleep(2000);

  record("5", "控制台无异常报错", cdp.cleanErrors().length === 0, cdp.cleanErrors().slice(0, 2).join(" | "));
  finish("相关纹样验收");
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
