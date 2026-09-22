// ============================================================
// Bug 修复验收 · 注册与登录全链路（全新浏览器 / 等效隐身模式）
//
// 覆盖：注册→自动登录→刷新会话恢复→退出→重新登录→
//       错误凭据有明确提示→重复注册被拒→profiles 建档→管理员/普通用户权限
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-auth.mjs`
// 产物：docs/screenshots/auth/*.png
// ============================================================

import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "auth");
const BASE = process.env.BASE_URL || "http://localhost:5173";
// 线上产物没有 dev server 的模块图，数据层探针只能在本地跑
const IS_DEV = /localhost|127.0.0.1/.test(BASE);
// 子路径部署时 pathname 带 /wencang-app 前缀，剥掉后再断言路由
const PREFIX = new URL(BASE).pathname.replace(/\/+$/, "");

const UI = `
window.__t = {
  text() { return document.body.innerText; },
  url() {
    const p = location.pathname.startsWith(${JSON.stringify(PREFIX)})
      ? location.pathname.slice(${JSON.stringify(PREFIX)}.length) || "/"
      : location.pathname;
    return p + location.search;
  },
  set(sel, v) {
    const el = document.querySelector(sel);
    if (!el) throw new Error('not found ' + sel);
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  clickText(t) {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().includes(t));
    if (!el) throw new Error('button not found: ' + t);
    el.click();
    return true;
  },
  agree() {
    const c = document.querySelector('[role="checkbox"]');
    if (!c) throw new Error('checkbox not found');
    if (c.getAttribute('data-state') !== 'checked') c.click();
    return c.getAttribute('data-state');
  },
  async submit(kind) {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === kind);
    if (!el) throw new Error('submit button not found: ' + kind);
    el.click();
    return true;
  },
  async form(username, password, kind) {
    window.__t.set('#username', username);
    window.__t.set('#password', password);
    window.__t.agree();
    await new Promise(r => setTimeout(r, 120));
    return window.__t.submit(kind);
  },
  db() { return JSON.parse(localStorage.getItem('wenzang.mock.db.v1') || 'null'); },
  session() { return JSON.parse(localStorage.getItem('wenzang.mock.session.v1') || 'null'); },
};
true;
`;

async function main() {
  const b = await launch({ port: 9250, out: OUT, base: BASE });
  const { cdp, base, record, finish, sleep } = b;

  /** 已登录时 /login 会自动跳走，所以每次进登录页前先退出（未登录则忽略） */
  const logout = async () => {
    await cdp.goto(`${base}/profile`, 1600);
    await cdp.eval(UI);
    try {
      await cdp.eval(`window.__t.clickText('退出登录')`);
    } catch {
      /* 本就未登录 */
    }
    await sleep(1200);
  };

  await cdp.goto(`${base}/`, 1500);
  await cdp.eval(UI);
  b.title("Bug2 注册与登录 · 全新浏览器实测");

  // 全新环境：localStorage 里没有任何会话
  record("0", "全新浏览器初始为未登录", (await cdp.eval(`window.__t.session()`)) === null);

  /* ---- 1. 注册 ---- */
  await cdp.goto(`${base}/login`, 1800);
  await cdp.eval(UI);
  await cdp.eval(`window.__t.clickText('立即注册')`);
  await sleep(500);
  await cdp.eval(`window.__t.form('qa_newuser', 'qa123456', '注册并登录')`);
  await sleep(2200);

  let url = await cdp.eval(`window.__t.url()`);
  let body = await cdp.eval(`window.__t.text()`);
  record("1a", "注册成功并自动登录（离开登录页）", url !== "/login", `当前 ${url}`);
  record("1b", "注册成功有明确提示", body.includes("注册成功"), "");

  await cdp.goto(`${base}/profile`, 2000);
  await cdp.eval(UI);
  body = await cdp.eval(`window.__t.text()`);
  record("1c", "个人中心正常显示新账号", body.includes("qa_newuser") && body.includes("当前账号"));
  await cdp.shot("01-注册后个人中心", true);

  /* ---- 2. 刷新保持登录 ---- */
  await cdp.goto(`${base}/profile`, 2200);
  await cdp.eval(UI);
  body = await cdp.eval(`window.__t.text()`);
  url = await cdp.eval(`window.__t.url()`);
  record("2", "刷新页面后仍保持登录", url.startsWith("/profile") && body.includes("qa_newuser"), `当前 ${url}`);

  /* ---- 3. 退出 ---- */
  await cdp.eval(`window.__t.clickText('退出登录')`);
  await sleep(1800);
  url = await cdp.eval(`window.__t.url()`);
  record("3", "退出登录后回到登录页", url.startsWith("/login"), `当前 ${url}`);

  /* ---- 4. 重新登录（核心：新账号必须能在刷新后继续登录） ---- */
  await cdp.eval(UI);
  await cdp.eval(`window.__t.form('qa_newuser', 'qa123456', '登录')`);
  await sleep(2200);
  url = await cdp.eval(`window.__t.url()`);
  body = await cdp.eval(`window.__t.text()`);
  const reloginOk = url !== "/login";
  record("4", "新注册账号退出后可重新登录", reloginOk, reloginOk ? `当前 ${url}` : `仍停在 ${url}：${body.slice(0, 60)}`);
  await cdp.shot("02-重新登录结果", true);

  /* ---- 5. 错误凭据必须有明确提示 ---- */
  await logout();
  await cdp.goto(`${base}/login`, 1800);
  await cdp.eval(UI);
  await cdp.eval(`window.__t.form('qa_newuser', 'wrong-password', '登录')`);
  await sleep(1600);
  body = await cdp.eval(`window.__t.text()`);
  url = await cdp.eval(`window.__t.url()`);
  record("5a", "密码错误时不静默失败（有 toast 提示）",
    url === "/login" && /用户名或密码错误|密码错误/.test(body), body.match(/用户名或密码错误|密码错误/) ? "" : "无提示");

  await cdp.eval(`window.__t.form('qa_newuser', 'qa123456', '登录')`);
  await sleep(2000);
  record("5b", "改回正确密码后可登录", (await cdp.eval(`window.__t.url()`)) !== "/login");

  /* ---- 6. 重复注册被拒（先退出，否则 /login 会自动跳走） ---- */
  await logout();
  await cdp.goto(`${base}/login`, 1800);
  await cdp.eval(UI);
  await cdp.eval(`window.__t.clickText('立即注册')`);
  await sleep(400);
  await cdp.eval(`window.__t.form('qa_newuser', 'qa123456', '注册并登录')`);
  await sleep(1600);
  body = await cdp.eval(`window.__t.text()`);
  url = await cdp.eval(`window.__t.url()`);
  record("6", "重复用户名注册被拒且有提示",
    url === "/login" && /已注册|已存在|已被/.test(body),
    /已注册|已存在/.test(body) ? "" : `当前 ${url} / ${body.slice(0, 60)}`);

  /* ---- 7. profiles 建档（运营看板的注册用户数依赖它） ---- */
  if (IS_DEV) {
  const probe = await cdp.eval(`
    (async () => {
      // 演示模式别名把 @/db/supabase 指向 mock 文件，按真实路径 import 得到同一模块实例
      const { supabase } = await import('/src/db/supabase.mock.ts');
      const api = await import('/src/lib/api.ts');
      const { data } = await supabase.from('profiles').select('id, email');
      const emails = (data || []).map(r => r.email);
      await supabase.auth.signInWithPassword({ email: 'admin@miaoda.com', password: 'wencang2026' });
      const ov = await api.fetchAdminOverview();
      return { total: emails.length, emails, board: ov.userCount };
    })()
  `);
  record("7a", "注册用户已同步进 profiles 表",
    Array.isArray(probe?.emails) && probe.emails.includes("qa_newuser@miaoda.com"),
    `profiles ${probe?.total} 条`);
  record("7b", "看板注册用户数与 profiles 同源",
    probe?.total === probe?.board, `profiles ${probe?.total} / 看板 ${probe?.board}`);
  }

  /* ---- 8. 演示账号与权限 ---- */
  await logout();
  await cdp.goto(`${base}/login`, 1800);
  await cdp.eval(UI);
  await cdp.eval(`window.__t.form('demo', 'demo123456', '登录')`);
  await sleep(2000);
  const demoOk = (await cdp.eval(`window.__t.url()`)) !== "/login";
  record("8a", "内置演示账号 demo 仍可登录", demoOk);

  await cdp.goto(`${base}/admin`, 2200);
  await cdp.eval(UI);
  url = await cdp.eval(`window.__t.url()`);
  record("8b", "普通用户访问 /admin 被重定向", !url.startsWith("/admin"), `当前 ${url}`);

  await logout();
  await cdp.goto(`${base}/login`, 1800);
  await cdp.eval(UI);
  await cdp.eval(`window.__t.form('admin', 'wencang2026', '登录')`);
  await sleep(2200);
  await cdp.goto(`${base}/admin`, 2600);
  await cdp.eval(UI);
  body = await cdp.eval(`window.__t.text()`);
  record("8c", "管理员 admin 可进运营后台",
    (await cdp.eval(`window.__t.url()`)).startsWith("/admin") && body.includes("运营后台"));
  await cdp.shot("03-管理员后台", true);

  /* ---- 9. 刷新后管理员会话仍在 ---- */
  await cdp.goto(`${base}/admin`, 2600);
  await cdp.eval(UI);
  record("9", "刷新后管理员会话与权限保持", (await cdp.eval(`window.__t.text()`)).includes("运营后台"));

  record("10", "控制台无异常报错", cdp.cleanErrors().length === 0, cdp.cleanErrors().slice(0, 2).join(" | "));
  finish("注册登录验收");
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
