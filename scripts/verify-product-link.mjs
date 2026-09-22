// ============================================================
// P1 商品「关联守艺人」下拉联动 · 验收实测
//
// 覆盖：后台下拉控件形态 / 选项来自在架守艺人 / artisan_id+artisan_name 一致落库 /
//       前台商城与详情页可点击跳转 / 老数据反查补齐 / 不可反查与无效 id 降级为纯文本
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-product-link.mjs`
// 产物：docs/screenshots/product-link/*.png
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "product-link");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const PORT = 9240;
const USER_DIR = path.join(tmpdir(), "wenzang-product-link-verify");

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
      if (m.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(
          "EXCEPTION: " + (m.params.exceptionDetails?.exception?.description || ""),
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
  async goto(url, w = 2200) {
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
window.__p = {
  text() { return document.body.innerText; },
  url() { return location.pathname; },
  db() { return JSON.parse(localStorage.getItem('wenzang.mock.db.v1') || 'null'); },
  // 守艺人一律通过真实数据层读取：演示库要到首次写入后才落 localStorage，
  // 直接读 storage 会在建商品之前拿到 null。
  async artisans() {
    const m = await import('/src/lib/api.ts');
    const list = await m.fetchAllArtisansAdmin();
    return list.map(a => ({ id: a.id, name: a.name, status: a.status || 'published' }));
  },
  async product(name) {
    const m = await import('/src/lib/api.ts');
    const p = (await m.fetchAllProductsAdmin()).find(x => x.name === name) || null;
    return p ? { id: p.id, artisan_id: p.artisan_id ?? null, artisan_name: p.artisan_name } : null;
  },
  nav(text) {
    const el = [...document.querySelectorAll('nav button')].find(b => (b.textContent||'').includes(text));
    if (!el) throw new Error('nav not found: ' + text);
    el.click();
    return true;
  },
  btn(text) {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().includes(text));
    if (!el) throw new Error('button not found: ' + text);
    el.click();
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
  fillIn(v, nth) {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) throw new Error('dialog not open');
    const el = dlg.querySelectorAll('input')[nth];
    if (!el) throw new Error('dialog input #' + nth + ' not found');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  // 读出「关联守艺人」这一项实际渲染出的控件形态
  fieldControl(label) {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const lab = [...dlg.querySelectorAll('label')].find(l => (l.textContent||'').includes(label));
    if (!lab) return null;
    const c = lab.parentElement.querySelector('[role="combobox"]') || lab.parentElement.querySelector('input,textarea');
    return c ? { tag: c.tagName, role: c.getAttribute('role'), type: c.getAttribute('type') } : null;
  },
  comboboxCount() {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? dlg.querySelectorAll('[role="combobox"]').length : -1;
  },
  comboboxLabel() {
    const dlg = document.querySelector('[role="dialog"]');
    const t = dlg && dlg.querySelector('[role="combobox"]');
    return t ? (t.textContent || '').trim() : null;
  },
  async openOptions() {
    const dlg = document.querySelector('[role="dialog"]');
    const t = dlg && dlg.querySelector('[role="combobox"]');
    if (!t) throw new Error('combobox not found');
    t.click();
    await new Promise(r => setTimeout(r, 400));
    return [...document.querySelectorAll('[role="option"]')].map(o => (o.textContent||'').trim());
  },
  async pickOption(optionText) {
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
  findProduct(name) {
    const db = window.__p.db();
    if (!db) throw new Error('演示库尚未落盘，无法直读 localStorage');
    const p = db.products.find(x => x.name === name) || null;
    return p ? { id: p.id, artisan_id: p.artisan_id ?? null, artisan_name: p.artisan_name } : null;
  },
  /** 商城卡片里「出自 · X」那一行的形态：是否已转为可点击、有没有嵌套 <a> */
  shopLine(name) {
    const ps = [...document.querySelectorAll('p')].filter(p => (p.textContent||'').trim() === '出自 · ' + name);
    if (!ps.length) return null;
    return {
      count: ps.length,
      clickables: ps.map(p => p.children.length > 0),
      tag: ps[0].firstElementChild ? ps[0].firstElementChild.tagName : null,
      hasNestedAnchor: ps.some(p => !!p.querySelector('a')),
    };
  },
  clickShopArtisan(name) {
    const p = [...document.querySelectorAll('p')]
      .find(x => (x.textContent||'').trim() === '出自 · ' + name && x.children.length);
    if (!p) throw new Error('clickable line not found: ' + name);
    p.firstElementChild.click();
    return true;
  },
  artisanLink() {
    const a = [...document.querySelectorAll('a')].find(x => /^\\/artisans\\//.test(x.getAttribute('href') || ''));
    return a ? { href: a.getAttribute('href'), text: (a.textContent || '').trim() } : null;
  },
  /** 构造三种历史形态：可反查的老数据 / 反查不到的老数据 / 指向不存在守艺人的无效 id */
  plantRows() {
    const db = window.__p.db();
    if (!db) throw new Error('演示库尚未落盘');
    // 只清掉本脚本植入的三条，不动后台界面真实创建的那条（它还要用于刷新持久化校验）
    const planted = ['g-p1-legacy', 'g-p1-unknown', 'g-p1-ghost'];
    db.products = db.products.filter(p => !planted.includes(p.id));
    const mk = (id, name, extra) => Object.assign({
      id, name, price: 388, craft_description: 'P1 验收用商品',
      image_url: 'data:image/png;base64,AAAA', created_at: new Date().toISOString(),
    }, extra);
    db.products.push(mk('g-p1-legacy', 'P1验收-老数据', { artisan_name: '韦小凤' }));
    db.products.push(mk('g-p1-unknown', 'P1验收-查无此人', { artisan_name: '查无此人的守艺人' }));
    db.products.push(mk('g-p1-ghost', 'P1验收-失效关联', {
      artisan_id: 'a0000099-0000-4000-8000-000000000099', artisan_name: '已消失的守艺人',
    }));
    localStorage.setItem('wenzang.mock.db.v1', JSON.stringify(db));
    return true;
  },
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

  await cdp.goto(`${BASE}/`, 1800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__p.seed()`);

  console.log("\n=== P1 商品「关联守艺人」下拉联动 · 验收 ===\n");

  /* ---- 1. 后台字段形态与选项来源 ---- */
  await cdp.goto(`${BASE}/admin?tab=products`, 2800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__p.btn('新建')`);
  await sleep(1000);

  const control = await cdp.eval(`window.__p.fieldControl('关联守艺人')`);
  record(
    "1a",
    "「关联守艺人」为下拉控件而非文本框",
    control?.role === "combobox",
    control ? `${control.tag}[role=${control.role}]` : "未找到控件",
  );
  record("1b", "新建弹窗只有 1 个下拉控件", (await cdp.eval(`window.__p.comboboxCount()`)) === 1);

  const opts = await cdp.eval(`window.__p.openOptions()`);
  const allArtisans = await cdp.eval(`window.__p.artisans()`);
  const liveNames = allArtisans.filter((a) => a.status !== "archived").map((a) => a.name);
  record(
    "1c",
    "选项来自在架守艺人且显示姓名",
    Array.isArray(opts) && liveNames.every((n) => opts.includes(n)),
    `选项 ${JSON.stringify(opts)}`,
  );
  await cdp.shot("01-后台-关联守艺人下拉");

  /* ---- 2. 选定后创建：两列一致落库 ---- */
  const yang = allArtisans.find((a) => a.name === "潘阿秀");
  await cdp.eval(`window.__p.pickOption('潘阿秀')`);
  await sleep(300);
  record("2a", "选择后触发器回显守艺人姓名", (await cdp.eval(`window.__p.comboboxLabel()`)) === "潘阿秀");

  await cdp.eval(`window.__p.fillIn('P1验收-下拉商品', 0)`);
  await cdp.eval(`window.__p.fillIn('458', 1)`);
  await cdp.eval(`window.__p.btn('创建')`);
  await sleep(2400);

  const created = await cdp.eval(`window.__p.product('P1验收-下拉商品')`);
  record(
    "2b",
    "创建后 artisan_id 与 artisan_name 一致写入",
    !!created && created.artisan_id === yang?.id && created.artisan_name === "潘阿秀",
    created ? `id=${created.artisan_id} name=${created.artisan_name}` : "未找到记录",
  );
  await cdp.shot("02-后台-商品管理列表", true);

  /* ---- 3. 前台商城：可点击跳转 ---- */
  await cdp.goto(`${BASE}/shop`, 2800);
  await cdp.eval(HELPERS);
  const line = await cdp.eval(`window.__p.shopLine('潘阿秀')`);
  record(
    "3a",
    "商城卡片守艺人为可点击节点，且未嵌套 <a>",
    !!line && line.clickables.every(Boolean) && line.hasNestedAnchor === false,
    line ? `${line.count} 处 / 子节点=${line.tag}` : "未找到",
  );

  await cdp.eval(`window.__p.clickShopArtisan('潘阿秀')`);
  await sleep(1800);
  const url = await cdp.eval(`window.__p.url()`);
  record("3b", "点击后跳转到对应守艺人详情页", url === `/artisans/${yang?.id}`, `当前 ${url}`);
  record("3c", "落地页为该守艺人档案", (await cdp.eval(`window.__p.text()`)).includes("潘阿秀"));
  await cdp.shot("03-前台-守艺人档案页", true);

  /* ---- 4. 商品详情页链接 ---- */
  await cdp.goto(`${BASE}/shop/${created.id}`, 2600);
  await cdp.eval(HELPERS);
  const dlink = await cdp.eval(`window.__p.artisanLink()`);
  record(
    "4",
    "详情页「出自 · 姓名」为 /artisans/:id 链接",
    dlink?.href === `/artisans/${yang?.id}` && String(dlink?.text).includes("潘阿秀"),
    dlink ? `${dlink.href} · ${dlink.text}` : "无链接",
  );
  await cdp.shot("04-前台-商品详情带守艺人链接");

  /* ---- 5. 归档守艺人不出现在选项中 ---- */
  await cdp.goto(`${BASE}/admin?tab=artisans`, 2800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__p.rowBtn('莫朝秀', '归档')`);
  await sleep(2200);
  await cdp.eval(`window.__p.nav('商品管理')`);
  await sleep(1500);
  await cdp.eval(`window.__p.btn('新建')`);
  await sleep(1000);
  const optsAfterArchive = await cdp.eval(`window.__p.openOptions()`);
  record(
    "5",
    "归档守艺人不进下拉选项",
    Array.isArray(optsAfterArchive) &&
      !optsAfterArchive.includes("莫朝秀") &&
      optsAfterArchive.includes("潘阿秀"),
    `选项 ${JSON.stringify(optsAfterArchive)}`,
  );
  await cdp.eval(`window.__p.btn('取消')`);
  await sleep(800);
  await cdp.eval(`window.__p.nav('守艺人管理')`);
  await sleep(1500);
  await cdp.eval(`window.__p.rowBtn('莫朝秀', '恢复')`);
  await sleep(2200);

  /* ---- 6. 老数据与无效 id ---- */
  await cdp.goto(`${BASE}/`, 1600);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__p.plantRows()`);

  await cdp.goto(`${BASE}/shop`, 2800);
  await cdp.eval(HELPERS);
  const waxLine = await cdp.eval(`window.__p.shopLine('韦小凤')`);
  const unknown = await cdp.eval(`window.__p.shopLine('查无此人的守艺人')`);
  const ghost = await cdp.eval(`window.__p.shopLine('已消失的守艺人')`);
  const shopText = await cdp.eval(`window.__p.text()`);

  record(
    "6a",
    "可反查的老数据：按 artisan_name 补齐 id 后可跳转",
    !!waxLine && waxLine.clickables.every(Boolean) && waxLine.count >= 2,
    waxLine ? `${waxLine.count} 处全部可点` : "未找到",
  );
  record(
    "6b",
    "反查不到的老数据：保持纯文本、不报错",
    !!unknown && unknown.clickables.some((c) => c === false) && unknown.hasNestedAnchor === false,
    unknown ? `${unknown.count} 处` : "未找到",
  );
  record(
    "6c",
    "无效 artisan_id：前台不渲染链接",
    !!ghost && ghost.clickables[0] === false && ghost.hasNestedAnchor === false,
    ghost ? `clickable=${JSON.stringify(ghost.clickables)}` : "未找到",
  );
  record(
    "6d",
    "三种老数据均正常出现在商城列表",
    ["P1验收-老数据", "P1验收-查无此人", "P1验收-失效关联"].every((n) => shopText.includes(n)),
  );
  await cdp.shot("05-前台-老数据与无效关联降级", true);

  await cdp.goto(`${BASE}/shop/g-p1-ghost`, 2600);
  await cdp.eval(HELPERS);
  const ghostLink = await cdp.eval(`window.__p.artisanLink()`);
  const ghostText = await cdp.eval(`window.__p.text()`);
  record(
    "6e",
    "无效 id 的商品详情页正常渲染且无守艺人链接",
    ghostLink === null && ghostText.includes("已消失的守艺人") && ghostText.includes("工艺说明"),
    ghostLink ? `仍有链接 ${ghostLink.href}` : "",
  );
  await cdp.shot("06-前台-无效关联详情页");

  await cdp.goto(`${BASE}/admin?tab=products`, 2800);
  await cdp.eval(HELPERS);
  const ghostRow = await cdp.eval(`window.__p.findProduct('P1验收-失效关联')`);
  record(
    "6f",
    "数据层保留无效 id 与名字，管理员可修正",
    ghostRow?.artisan_id === "a0000099-0000-4000-8000-000000000099" &&
      ghostRow?.artisan_name === "已消失的守艺人",
    ghostRow ? `id=${ghostRow.artisan_id}` : "未找到",
  );

  await cdp.eval(`window.__p.rowBtn('P1验收-老数据', '编辑')`);
  await sleep(1300);
  record(
    "6g",
    "老数据在后台下拉中已回显守艺人",
    (await cdp.eval(`window.__p.comboboxLabel()`)) === "韦小凤",
  );
  await cdp.shot("07-后台-老数据下拉回显");

  await cdp.eval(`window.__p.openOptions()`);
  await cdp.eval(`window.__p.pickOption('潘阿秀')`);
  await sleep(400);
  await cdp.eval(`window.__p.btn('保存修改')`);
  await sleep(2400);
  const legacySaved = await cdp.eval(`window.__p.product('P1验收-老数据')`);
  record(
    "6h",
    "后台改选守艺人后 id 与 name 一并更新",
    legacySaved?.artisan_id === yang?.id && legacySaved?.artisan_name === "潘阿秀",
    legacySaved ? `id=${legacySaved.artisan_id} name=${legacySaved.artisan_name}` : "未找到",
  );

  /* ---- 7. 持久化与控制台 ---- */
  await cdp.goto(`${BASE}/admin?tab=products`, 2800);
  await cdp.eval(HELPERS);
  const persisted = await cdp.eval(`window.__p.findProduct('P1验收-下拉商品')`);
  record("7a", "刷新后新建商品的关联仍在", persisted?.artisan_name === "潘阿秀" && !!persisted?.artisan_id);

  const consoleClean = cdp.consoleErrors.filter(
    (e) => !/favicon|404|Failed to load resource|Download the React DevTools/i.test(e),
  );
  record("7b", "控制台无异常报错", consoleClean.length === 0, consoleClean.slice(0, 2).join(" | "));

  writeFileSync(
    path.join(OUT, "_result.json"),
    JSON.stringify({ results, consoleErrors: consoleClean }, null, 2),
  );

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
