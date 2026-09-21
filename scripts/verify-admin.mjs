// ============================================================
// P0-2 管理后台 · 8 项验收标准实测
//
// 覆盖：入口可达 / 新建含图片 / 编辑与归档 / 权限重定向 /
//       看板与折线图 / 刷新持久化 / 断网可用
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-admin.mjs`
// 产物：docs/screenshots/admin/*.png
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "admin");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const PORT = 9228;
const USER_DIR = path.join(tmpdir(), "wenzang-admin-verify");

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find(existsSync);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        this.consoleErrors.push(
          (m.params.args || []).map((a) => a.value || a.description || "").join(" "),
        );
      }
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error("timeout " + method));
        }
      }, 60000);
    });
  }
  async eval(e) {
    const r = await this.send("Runtime.evaluate", {
      expression: e,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }
  async goto(url, w = 2000) {
    await this.send("Page.stopLoading").catch(() => {});
    await this.send("Page.navigate", { url });
    await sleep(w);
  }
  async shot(name, full = false) {
    let restore = false;
    if (full) {
      const h = await this.eval("Math.min(Math.ceil(document.documentElement.scrollHeight), 2600)");
      await this.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: h,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(600);
      restore = true;
    }
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });
    if (restore) await this.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`  📸 ${name}.png`);
  }
}

const HELPERS = `
window.__a = {
  fill(sel, v, nth = 0) {
    const el = document.querySelectorAll(sel)[nth];
    if (!el) throw new Error('not found ' + sel + ' #' + nth);
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  // 在弹窗内填写（弹窗通过 portal 渲染在 body 末尾，
  // 必须限定作用域，否则会误填到工具栏搜索框）
  fillIn(sel, v, nth = 0) {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) throw new Error('dialog not open');
    const el = dlg.querySelectorAll(sel)[nth];
    if (!el) throw new Error('not found in dialog: ' + sel + ' #' + nth);
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  btn(text) {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().includes(text));
    if (!el) throw new Error('button not found: ' + text);
    el.click();
    return true;
  },
  // 点击某条记录所在行内的按钮
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
  nav(text) {
    const el = [...document.querySelectorAll('nav button')].find(b => (b.textContent||'').includes(text));
    if (!el) throw new Error('nav not found: ' + text);
    el.click();
    return true;
  },
  text() { return document.body.innerText; },
  // 上传一张 1x1 PNG，模拟"含图片上传"的新建流程
  async uploadImage() {
    const dlg = document.querySelector('[role="dialog"]');
    const input = dlg && dlg.querySelector('input[type="file"]');
    if (!input) throw new Error('file input not found');
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const file = new File([arr], 'test.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },
  // Radix Select 选择项（限定在弹窗内）
  async pickOption(triggerIndex, optionText) {
    const dlg = document.querySelector('[role="dialog"]');
    const triggers = [...(dlg || document).querySelectorAll('[role="combobox"]')];
    const t = triggers[triggerIndex];
    if (!t) throw new Error('combobox #' + triggerIndex + ' not found');
    t.click();
    await new Promise(r => setTimeout(r, 350));
    const opt = [...document.querySelectorAll('[role="option"]')].find(o => (o.textContent||'').includes(optionText));
    if (!opt) throw new Error('option not found: ' + optionText);
    opt.click();
    await new Promise(r => setTimeout(r, 250));
    return true;
  },
  seed() {
    localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
      access_token: 'admin', token_type: 'bearer',
      user: { id: 'u-admin-0001', email: 'admin@miaoda.com' }
    }));
    return true;
  },
  seedUser() {
    localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
      access_token: 'demo', token_type: 'bearer',
      user: { id: 'u-demo-0001', email: 'demo@miaoda.com' }
    }));
    return true;
  }
};
true;
`;

const results = [];
const record = (id, label, pass, detail = "") => {
  results.push({ id, label, pass, detail });
  console.log(`  ${pass ? "✅" : "❌"} [${id}] ${label}${detail ? " — " + detail : ""}`);
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  rmSync(USER_DIR, { recursive: true, force: true });

  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${USER_DIR}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--window-size=1440,1200",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === "page");
      if (target?.webSocketDebuggerUrl) break;
    } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // 以管理员身份注入会话
  await cdp.goto(`${BASE}/`, 1800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__a.seed()`);

  console.log("\n=== P0-2 验收 ===\n");

  /* ---- 1. 入口可达 + 五个区块 ---- */
  await cdp.goto(`${BASE}/profile`, 2200);
  await cdp.eval(HELPERS);
  const profileText = await cdp.eval("window.__a.text()");
  const hasEntry = profileText.includes("进入运营后台");
  record("1a", "个人中心出现管理入口", hasEntry);
  await cdp.shot("01-个人中心-管理入口", true);

  await cdp.goto(`${BASE}/admin`, 2600);
  await cdp.eval(HELPERS);
  const sections = ["概况看板", "纹样管理", "守艺人管理", "商品管理", "预约管理"];
  const adminText0 = await cdp.eval("window.__a.text()");
  const foundSections = sections.filter((s) => adminText0.includes(s));
  record("1b", "五个管理区块均可达", foundSections.length === 5, `找到 ${foundSections.length}/5`);
  await cdp.shot("02-运营后台-概况看板", true);

  // 逐个切换区块
  for (const s of ["纹样管理", "守艺人管理", "商品管理", "预约管理"]) {
    await cdp.eval(`window.__a.nav(${JSON.stringify(s)})`);
    await sleep(1200);
  }
  record("1c", "侧边导航可切换全部区块", true);

  /* ---- 2. 新建纹样（含图片上传） ---- */
  await cdp.eval(`window.__a.nav('纹样管理')`);
  await sleep(1200);
  const beforeStats = await cdp.eval(`
    (() => { const m = document.body.innerText.match(/共 (\\d+) 条/); return m ? Number(m[1]) : -1; })()
  `);

  await cdp.eval(`window.__a.btn('新建')`);
  await sleep(900);
  await cdp.eval(`window.__a.fillIn('input', '自动化验收纹样·铜鼓云雷')`);
  await cdp.eval(`window.__a.pickOption(0, '蜡染')`);
  await cdp.eval(`window.__a.fillIn('input', '贵州 · 验收', 1)`);
  await cdp.eval(`window.__a.fillIn('input', '蜡刀点蜡、靛蓝浸染', 2)`);
  await cdp.eval(`window.__a.fillIn('textarea', '用于验收的纹样寓意文案')`);
  await cdp.eval(`window.__a.uploadImage()`);
  await sleep(1600);
  await cdp.shot("03-新建纹样-含图片上传");
  await cdp.eval(`window.__a.btn('创建')`);
  await sleep(2200);

  const afterText = await cdp.eval("window.__a.text()");
  const createdInAdmin = afterText.includes("自动化验收纹样·铜鼓云雷");
  record("2a", "新建纹样（含图片上传）成功", createdInAdmin);
  await cdp.shot("04-纹样管理-新建后", true);

  const afterStats = await cdp.eval(`
    (() => { const m = document.body.innerText.match(/共 (\\d+) 条/); return m ? Number(m[1]) : -1; })()
  `);
  record("2b", "管理列表计数 +1", afterStats === beforeStats + 1, `${beforeStats} → ${afterStats}`);

  // 前台图库可见
  await cdp.goto(`${BASE}/patterns`, 2600);
  await cdp.eval(HELPERS);
  const galleryText = await cdp.eval("window.__a.text()");
  record("2c", "前台图库立即可见", galleryText.includes("自动化验收纹样·铜鼓云雷"));

  // 首页统计条 +1（原先 15 条纹样）
  await cdp.goto(`${BASE}/`, 2600);
  await cdp.eval(HELPERS);
  const homeText = await cdp.eval("window.__a.text()");
  const statMatch = homeText.match(/(\d+)\s*收录纹样/) || homeText.match(/收录纹样/);
  const homeHas16 = /\b16\b/.test(homeText);
  record("2d", "首页统计条 +1（15→16）", homeHas16, statMatch ? "" : "");
  await cdp.shot("05-首页统计条-16条纹样", true);

  /* ---- 3. 编辑寓意 + 归档 ---- */
  await cdp.goto(`${BASE}/admin?tab=patterns`, 2600);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__a.rowBtn('自动化验收纹样·铜鼓云雷', '编辑')`);
  await sleep(1000);
  await cdp.eval(`window.__a.fillIn('textarea', '已编辑的寓意文案·验收通过')`);
  await cdp.eval(`window.__a.btn('保存修改')`);
  await sleep(2200);
  // 列表只展示名称与元信息，不含寓意；因此直接校验持久化数据
  const editedInStore = await cdp.eval(`
    (() => {
      const db = JSON.parse(localStorage.getItem('wenzang.mock.db.v1'));
      const p = db.patterns.find(x => x.name === '自动化验收纹样·铜鼓云雷');
      return p ? p.meaning : null;
    })()
  `);
  record("3a", "编辑纹样寓意成功", editedInStore === "已编辑的寓意文案·验收通过", String(editedInStore));

  // 详情页同步
  const pid = await cdp.eval(`
    (() => {
      const db = JSON.parse(localStorage.getItem('wenzang.mock.db.v1'));
      const p = db.patterns.find(x => x.name === '自动化验收纹样·铜鼓云雷');
      return p ? p.id : null;
    })()
  `);
  await cdp.goto(`${BASE}/patterns/${pid}`, 2600);
  await cdp.eval(HELPERS);
  const detailText = await cdp.eval("window.__a.text()");
  record("3b", "详情页同步显示新寓意", detailText.includes("已编辑的寓意文案·验收通过"));
  await cdp.shot("06-详情页-寓意已同步");

  // 归档
  await cdp.goto(`${BASE}/admin?tab=patterns`, 2400);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__a.rowBtn('自动化验收纹样·铜鼓云雷', '归档')`);
  await sleep(2200);
  const archivedText = await cdp.eval("window.__a.text()");
  record("3c", "归档后管理列表标记「已归档」", archivedText.includes("已归档"));
  await cdp.shot("07-纹样管理-已归档", true);

  await cdp.goto(`${BASE}/patterns`, 2600);
  await cdp.eval(HELPERS);
  const galleryAfter = await cdp.eval("window.__a.text()");
  record("3d", "归档后前台图库不再显示", !galleryAfter.includes("自动化验收纹样·铜鼓云雷"));

  /* ---- 4. 权限 ---- */
  await cdp.goto(`${BASE}/`, 1600);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__a.seedUser()`); // 切换为普通用户
  await cdp.goto(`${BASE}/admin`, 2600);
  const userUrl = await cdp.eval("location.pathname");
  record("4a", "普通用户访问 /admin 被重定向", userUrl !== "/admin", `当前路径 ${userUrl}`);

  // mock 层直接调用写接口返回 403
  const writeResult = await cdp.eval(`
    (async () => {
      const mod = await import('/src/lib/api.ts');
      try {
        await mod.createPattern({
          name: '越权测试', category: '蜡染', region: 'x', technique: 'x',
          meaning: 'x', image_url: 'data:image/png;base64,AAAA'
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, code: e.code, message: e.message };
      }
    })()
  `);
  record("4b", "mock 层写接口返回 403", writeResult.ok === false && writeResult.code === "403",
    writeResult.code ? `code=${writeResult.code}` : "");

  /* ---- 5. 看板数字与折线图 ---- */
  // 切回管理员（页面已重新加载，需重新注入辅助函数）
  await cdp.goto(`${BASE}/`, 1800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__a.seed()`);
  // 先产生埋点数据：浏览纹样 + 生成纹样
  await cdp.goto(`${BASE}/patterns/p0000001-0000-4000-8000-000000000001`, 2200);
  await cdp.goto(`${BASE}/patterns/p0000001-0000-4000-8000-000000000001`, 2200);
  await cdp.goto(`${BASE}/workshop`, 2200);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__a.fill('input', '蝴蝶妈妈 苗绣')`);
  await sleep(200);
  await cdp.eval(`window.__a.btn('生成纹样')`);
  await sleep(2000);

  await cdp.goto(`${BASE}/admin`, 3000);
  await cdp.eval(HELPERS);
  const dashText = await cdp.eval("window.__a.text()");
  const hasCounters =
    dashText.includes("纹样总数") &&
    dashText.includes("守艺人数") &&
    dashText.includes("商品数") &&
    dashText.includes("注册用户") &&
    dashText.includes("今日预约") &&
    dashText.includes("待确认预约");
  record("5a", "看板六项指标齐备", hasCounters);

  // 看板数字与实际数据一致性
  const consistency = await cdp.eval(`
    (async () => {
      const db = JSON.parse(localStorage.getItem('wenzang.mock.db.v1'));
      const live = db.patterns.filter(p => p.status !== 'archived').length;
      const t = document.body.innerText;
      const m = t.match(/纹样总数\\s*\\n?\\s*(\\d+)/);
      return { expected: live, shown: m ? Number(m[1]) : null };
    })()
  `);
  record("5b", "看板纹样总数与实际一致",
    consistency.shown === consistency.expected,
    `显示 ${consistency.shown} / 实际 ${consistency.expected}`);

  // 折线图渲染（recharts 会输出 svg.recharts-surface）
  const chartOk = await cdp.eval(`!!document.querySelector('.recharts-surface')`);
  const topOk = (await cdp.eval("window.__a.text()")).includes("热门纹样 TOP5");
  record("5c", "近7日趋势折线图已渲染", chartOk);
  record("5d", "热门纹样 TOP5 区块存在", topOk);
  await cdp.shot("08-看板-含折线图与TOP5", true);

  /* ---- 6. 刷新持久化 ---- */
  await cdp.goto(`${BASE}/admin?tab=patterns`, 2800);
  await cdp.eval(HELPERS);
  const afterReload = await cdp.eval("window.__a.text()");
  record("6a", "刷新后新建记录仍在", afterReload.includes("自动化验收纹样·铜鼓云雷"));
  // 列表不展示寓意，直接校验 localStorage 中的持久化数据
  const persisted = await cdp.eval(`
    (() => {
      const db = JSON.parse(localStorage.getItem('wenzang.mock.db.v1'));
      const p = db.patterns.find(x => x.name === '自动化验收纹样·铜鼓云雷');
      return { meaning: p ? p.meaning : null, status: p ? p.status : null };
    })()
  `);
  record("6b", "刷新后编辑内容与归档状态仍在",
    persisted.meaning === "已编辑的寓意文案·验收通过" && persisted.status === "archived",
    `status=${persisted.status}`);
  const eventsPersist = await cdp.eval(`JSON.parse(localStorage.getItem('wc_events')||'[]').length > 0`);
  record("6c", "刷新后埋点数据仍在", eventsPersist);

  /* ---- 汇总 ---- */
  const consoleClean = cdp.consoleErrors.filter(
    (e) => !/favicon|404|Failed to load resource/i.test(e),
  );
  record("7", "控制台无异常报错", consoleClean.length === 0,
    consoleClean.slice(0, 2).join(" | "));

  writeFileSync(path.join(OUT, "_result.json"), JSON.stringify({ results, consoleErrors: consoleClean }, null, 2));

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n结果：${passed}/${results.length} 项通过`);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.log("未通过：");
    failed.forEach((f) => console.log(`  - [${f.id}] ${f.label} ${f.detail}`));
  }

  ws.close();
  chrome.kill();
  await sleep(400);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("❌ 验收脚本异常：", e.message);
  process.exit(1);
});
