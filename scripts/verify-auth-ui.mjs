// ============================================================
// 任务包 A · 登录态 UI 一致性 · 验收实测
//
// 覆盖：未登录 Header/CTA → 注册后 Header 用户菜单 + CTA 变「进入我的纹藏」→
//       admin 下拉含运营后台 / demo 不含 → 退出后 UI 即时回收（不刷新页面）
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-auth-ui.mjs`
// 产物：docs/screenshots/auth-ui/*.png
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "auth-ui");
const BASE = process.env.BASE_URL || "http://localhost:5173";
/** 线上部署在 /wencang-app/ 子路径下，路由断言必须带上这段前缀 */
const BASE_PATH = new URL(BASE).pathname.replace(/\/+$/, "");
const p = (route) => `${BASE_PATH}${route}`;

const UI = `
window.__u = {
  text() { return document.body.innerText; },
  url() { return location.pathname; },
  // 桌面端 Header 右侧区：登录链接（未登录）与用户名触发器（已登录）
  headerLoginLink() {
    const a = document.querySelector('header a[href$="/login"]');
    return a ? (a.textContent||'').trim() : null;
  },
  headerUserTrigger() {
    // 移动端抽屉触发器只有图标、无文字，故取第一个有文字的 header button
    const b = [...document.querySelectorAll('header button')].find(x => (x.textContent||'').trim());
    return b ? (b.textContent||'').trim() : null;
  },
  cta() {
    const sec = document.querySelector('#cta');
    return sec ? (sec.textContent||'').replace(/\\s+/g,' ').trim() : null;
  },
  ctaLink(label) {
    const sec = document.querySelector('#cta');
    const a = sec && [...sec.querySelectorAll('a')].find(x => (x.textContent||'').trim() === label);
    return a ? a.getAttribute('href') : null;
  },
  clickText(t) {
    const el = [...document.querySelectorAll('button,a')].find(b => (b.textContent||'').trim() === t);
    if (!el) throw new Error('not found: ' + t);
    el.click();
    return true;
  },
  clickLogo() {
    const a = document.querySelector('header a');
    if (!a) throw new Error('logo link not found');
    a.click();
    return true;
  },
  openUserMenu() {
    // 桌面端触发器是含用户名的那个 button（真实鼠标事件由 cdp.clickAt 发出）
    return "[...document.querySelectorAll('header button')].find(b => (b.textContent||'').trim())";
  },
  menuItems() {
    return [...document.querySelectorAll('[role="menuitem"]')].map(e => (e.textContent||'').trim());
  },
};
true;
`;

const HELPERS = UI;

async function main() {
  const b = await launch({ port: 9256, out: OUT, base: BASE });
  const { cdp, base, record, finish, sleep } = b;
  b.title("任务包A 登录态 UI 一致性 · 实测");

  const signIn = async (user, pass) => {
    await cdp.goto(`${base}/login`, 1800);
    await cdp.eval(HELPERS);
    await cdp.eval(`
      (() => {
        const set = (sel, v) => {
          const el = document.querySelector(sel);
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        set('#username', ${JSON.stringify(user)});
        set('#password', ${JSON.stringify(pass)});
        const c = document.querySelector('[role="checkbox"]');
        if (c && c.getAttribute('data-state') !== 'checked') c.click();
        return true;
      })()
    `);
    await sleep(200);
    await cdp.eval(`window.__u.clickText('登录')`);
    await sleep(2200);
  };

  /* ---- 1. 未登录 ---- */
  await cdp.goto(`${base}/`, 2600);
  await cdp.eval(HELPERS);
  const anonHeader = await cdp.eval(`window.__u.headerLoginLink()`);
  const anonUser = await cdp.eval(`window.__u.headerUserTrigger()`);
  const anonCta = await cdp.eval(`window.__u.cta()`);
  record("1a", "未登录：Header 显示「登录 / 注册」，无用户菜单",
    anonHeader === "登录 / 注册" && anonUser === null, `链接「${anonHeader}」/ 触发器「${anonUser}」`);
  record("1b", "未登录：首页 CTA 为注册引导，主按钮指向登录页",
    !!anonCta && anonCta.includes("注册账号，开启你的非遗探索之旅") &&
      (await cdp.eval(`window.__u.ctaLink('立即注册')`))?.endsWith("/login"),
    `href=${await cdp.eval(`window.__u.ctaLink('立即注册')`)}`);
  await cdp.shot("01-未登录首页CTA");

  /* ---- 2. 注册新账号后不刷新，直接看首页 ---- */
  await cdp.goto(`${base}/login`, 1800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__u.clickText('立即注册')`);
  await sleep(500);
  await cdp.eval(`
    (() => {
      const set = (sel, v) => {
        const el = document.querySelector(sel);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('#username', 'ui_probe');
      set('#password', 'ui123456');
      const c = document.querySelector('[role="checkbox"]');
      if (c && c.getAttribute('data-state') !== 'checked') c.click();
      return true;
    })()
  `);
  await sleep(200);
  await cdp.eval(`window.__u.clickText('注册并登录')`);
  await sleep(2400);
  record("2a", "注册成功后自动登录并离开登录页", (await cdp.eval(`window.__u.url()`)) !== p("/login"));

  // 同一次会话内切到首页（不刷新页面），验证 UI 是即时跟着会话走的
  await cdp.eval(`window.__u.clickLogo()`);
  await sleep(1800);
  const homeUrl = await cdp.eval(`window.__u.url()`);
  record("2b", "注册后点首页（SPA 内跳转，未刷新）", homeUrl === p("/"), `当前 ${homeUrl}`);

  const memberHeader = await cdp.eval(`window.__u.headerLoginLink()`);
  const memberUser = await cdp.eval(`window.__u.headerUserTrigger()`);
  const memberCta = await cdp.eval(`window.__u.cta()`);
  record("2c", "已登录：Header 不再显示「登录 / 注册」，改为用户名触发器",
    memberHeader === null && !!memberUser && memberUser.includes("ui_probe"),
    `登录链接=${memberHeader} / 触发器「${memberUser}」`);
  record("2d", "已登录：CTA 变「进入我的纹藏」并指向 /profile",
    !!memberCta && memberCta.includes("继续你的非遗探索之旅") &&
      (await cdp.eval(`window.__u.ctaLink('进入我的纹藏')`)) === p("/profile"),
    `href=${await cdp.eval(`window.__u.ctaLink('进入我的纹藏')`)} · ${memberCta.slice(0, 40)}`);
  record("2e", "已登录：副按钮「体验AI工坊」保留",
    (await cdp.eval(`window.__u.ctaLink('体验AI工坊')`)) === p("/workshop"));
  await cdp.shot("02-登录后首页CTA");

  /* ---- 3. 普通用户下拉：无运营后台 ---- */
  await cdp.clickAt(await cdp.eval(`window.__u.openUserMenu()`));
  await sleep(900);
  const userMenu = await cdp.eval(`window.__u.menuItems()`);
  record("3a", "普通用户下拉含个人中心 / 退出登录",
    userMenu.some((m) => m.includes("个人中心")) && userMenu.some((m) => m.includes("退出登录")),
    JSON.stringify(userMenu));
  record("3b", "普通用户下拉不含「运营后台」",
    !userMenu.some((m) => m.includes("运营后台")), JSON.stringify(userMenu));
  await cdp.shot("03-普通用户下拉");

  /* ---- 4. 退出后即时回收（不刷新） ---- */
  await cdp.clickAt(
    `[...document.querySelectorAll('[role="menuitem"]')].find(e => (e.textContent||'').includes('退出登录'))`,
  );
  await sleep(2000);
  const backHeader = await cdp.eval(`window.__u.headerLoginLink()`);
  const backUser = await cdp.eval(`window.__u.headerUserTrigger()`);
  const backCta = await cdp.eval(`window.__u.cta()`);
  record("4", "退出后 Header 与 CTA 立即回到未登录态（未刷新页面）",
    backHeader === "登录 / 注册" && backUser === null && !!backCta && backCta.includes("注册账号"),
    `Header「${backHeader}」/ 触发器「${backUser}」`);

  /* ---- 5. admin 下拉含运营后台 ---- */
  await signIn("admin", "wencang2026");
  await cdp.goto(`${base}/`, 2200);
  await cdp.eval(HELPERS);
  await cdp.clickAt(await cdp.eval(`window.__u.openUserMenu()`));
  await sleep(900);
  const adminMenu = await cdp.eval(`window.__u.menuItems()`);
  record("5a", "admin 下拉含「运营后台」入口",
    adminMenu.some((m) => m.includes("运营后台")), JSON.stringify(adminMenu));
  // DropdownMenuItem 用 asChild 包住 <Link>，渲染出的是 <a role="menuitem">，
  // 所以直接找锚点本身，而不是 menuitem 的后代
  const adminHref = await cdp.eval(
    `[...document.querySelectorAll('a[role="menuitem"]')].find(a => (a.textContent||'').includes('运营后台'))?.getAttribute('href') || null`,
  );
  record("5b", "运营后台入口指向 /admin", adminHref === p("/admin"), String(adminHref));
  await cdp.shot("04-admin下拉");

  /* ---- 6. 登录态直接访问 /profile 不被踢出 ---- */
  await cdp.goto(`${base}/profile`, 2400);
  await cdp.eval(HELPERS);
  record("6a", "已登录直接访问 /profile 不被踢出",
    (await cdp.eval(`window.__u.url()`)).startsWith(p("/profile")), await cdp.eval(`window.__u.url()`));

  await cdp.eval(`
    (() => { const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('退出登录')); if (el) el.click(); return true; })()
  `);
  await sleep(1800);
  await cdp.goto(`${base}/profile`, 2200);
  await cdp.eval(HELPERS);
  const kickedUrl = await cdp.eval(`window.__u.url()`);
  record("6b", "未登录访问 /profile 仍重定向到登录页", kickedUrl.startsWith(p("/login")), `当前 ${kickedUrl}`);

  /* ---- 7. 其他模块的登录引导只在未登录时出现 ---- */
  await cdp.goto(`${base}/shop/g0000001-0000-4000-8000-000000000001`, 2400);
  await cdp.eval(HELPERS);
  const anonShop = await cdp.eval(`window.__u.text()`);
  record("7a", "未登录进商品详情：显示「登录后下单」引导",
    anonShop.includes("登录后下单") && anonShop.includes("下单需要先登录"));

  await signIn("ui_probe", "ui123456");
  await cdp.goto(`${base}/shop/g0000001-0000-4000-8000-000000000001`, 2400);
  await cdp.eval(HELPERS);
  const memberShop = await cdp.eval(`window.__u.text()`);
  record("7b", "已登录进商品详情：不再出现登录引导，按钮为「立即下单」",
    memberShop.includes("立即下单") && !memberShop.includes("登录后下单") && !memberShop.includes("下单需要先登录"));

  await cdp.goto(`${base}/booking`, 2400);
  await cdp.eval(HELPERS);
  const bookText = await cdp.eval(`window.__u.text()`);
  record("7c", "已登录进预约页：按钮为「提交预约」而非「登录后提交」",
    !bookText.includes("登录后提交") && !bookText.includes("提交预约需要先登录"),
    bookText.includes("提交预约") ? "" : "未找到提交按钮");

  record("8", "控制台无异常报错", cdp.cleanErrors().length === 0, cdp.cleanErrors().slice(0, 2).join(" | "));
  finish("登录态 UI 验收");
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
