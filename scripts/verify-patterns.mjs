// ============================================================
// 程序化纹样生成 · 视觉与交互验收
//
// 驱动真实浏览器打开 /workshop，逐条生成并截取图案区，
// 同时校验「重新生成产生新变体」与「种子可复现」。
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-patterns.mjs`
// 产物：docs/screenshots/patterns/*.png
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "screenshots", "patterns");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const PORT = 9225;
const USER_DIR = path.join(tmpdir(), "wenzang-pattern-verify");

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
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
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
          rej(new Error("CDP timeout: " + method));
        }
      }, 60000);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }
  async goto(url, w = 1800) {
    await this.send("Page.stopLoading").catch(() => {});
    await this.send("Page.navigate", { url });
    await sleep(w);
  }
}

const HELPERS = `
window.__p = {
  fill(sel, value) {
    const el = document.querySelector(sel);
    if (!el) throw new Error('input not found: ' + sel);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },
  clickBtn(text) {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes(text));
    if (!el) throw new Error('button not found: ' + text);
    el.click();
    return true;
  },
  clickCategory(text) {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === text);
    if (!el) throw new Error('category not found: ' + text);
    el.click();
    return true;
  },
  // 结果卡上的元信息文本（种子/基元/布局）
  // 注意：必须限定在「结果面板」内读取，否则会误匹配输入区的示例词
  meta() {
    const box = document.querySelector('.aspect-square');
    const panel = box && box.closest('.space-y-6');
    const t = panel ? panel.innerText : '';
    const seed = (t.match(/种子([0-9A-F]{4})/) || [])[1] || null;
    const motif = (t.match(/(蝴蝶纹|铜鼓纹|鱼纹|团花纹|几何纹)(?: \\+ (蝴蝶纹|铜鼓纹|鱼纹|团花纹|几何纹))?/) || [])[0] || null;
    const layout = (t.match(/(中心对称|轴对称|四方连续)/) || [])[1] || null;
    return { seed, motif, layout, panelText: t };
  },
  imgBox() {
    const img = document.querySelector('img[alt]');
    const box = img && img.closest('.aspect-square');
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
};
true;
`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
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
  if (!target) throw new Error("无法连接浏览器");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.goto(`${BASE}/workshop`, 2200);
  await cdp.eval(HELPERS);

  const shotPattern = async (name, scale = 2) => {
    const box = await cdp.eval("JSON.stringify(window.__p.imgBox())");
    const b = JSON.parse(box);
    if (!b) throw new Error("找不到图案区域");
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: b.x, y: b.y, width: b.width, height: b.height, scale },
      captureBeyondViewport: true,
    });
    writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`  📸 ${name}.png`);
  };

  const generate = async (theme, category) => {
    await cdp.eval(`window.__p.fill('input', ${JSON.stringify(theme)})`);
    await cdp.eval(`window.__p.clickCategory(${JSON.stringify(category)})`);
    await sleep(250);
    await cdp.eval(`window.__p.clickBtn('生成纹样')`);
    await sleep(1600);
    return JSON.parse(await cdp.eval("JSON.stringify(window.__p.meta())"));
  };

  const cases = [
    ["01-蝴蝶妈妈-苗绣", "蝴蝶妈妈 苗绣", "苗绣"],
    ["02-铜鼓-蜡染", "铜鼓 蜡染", "蜡染"],
    ["03-鱼水-蜡染", "鱼水 蜡染", "蜡染"],
    ["04-石榴花-苗绣", "石榴花 苗绣", "苗绣"],
    ["05-冰裂纹-扎染", "冰裂纹 扎染", "扎染"],
    ["06-无匹配词-扎染", "远方", "扎染"],
    ["07-无匹配词-蜡染", "远方", "蜡染"],
  ];

  const results = [];
  console.log("生成验收：\n");
  for (const [file, theme, category] of cases) {
    const meta = await generate(theme, category);
    await shotPattern(file);
    results.push({ file, theme, category, ...meta });
    console.log(
      `     ${theme} / ${category}  →  基元=${meta.motif}  布局=${meta.layout}  种子=${meta.seed}`,
    );
  }

  /* ---- 可复现性：同主题词再生成一次，种子应一致 ---- */
  console.log("\n可复现性校验：");
  const first = await generate("蝴蝶妈妈 苗绣", "苗绣");
  const second = await generate("蝴蝶妈妈 苗绣", "苗绣");
  const reproducible = first.seed === second.seed && first.layout === second.layout;
  console.log(`  同主题词两次生成：${first.seed} vs ${second.seed} → ${reproducible ? "✅ 一致" : "❌ 不一致"}`);

  /* ---- 变体：点「重新生成」应产生新种子 ---- */
  await cdp.eval(`window.__p.clickBtn('生成纹样')`); // 先确保有结果
  await sleep(1500);
  const before = JSON.parse(await cdp.eval("JSON.stringify(window.__p.meta())"));
  // 结果卡右侧的图标按钮即「重新生成」
  const clicked = await cdp.eval(`
    (() => {
      const btns = [...document.querySelectorAll('button')];
      const regen = btns.find(b => b.querySelector('svg.lucide-refresh-cw') || b.title === '生成新变体');
      if (!regen) return false;
      regen.click();
      return true;
    })()
  `);
  await sleep(1700);
  const after = JSON.parse(await cdp.eval("JSON.stringify(window.__p.meta())"));
  await shotPattern("08-重新生成变体");
  const variantOk = clicked && before.seed !== after.seed;
  console.log(`  重新生成：${before.seed} → ${after.seed} → ${variantOk ? "✅ 产生新变体" : "❌ 未变化"}`);

  /* ---- 汇总 ---- */
  const summary = { generated: results, reproducible, variantOk, before, after };
  writeFileSync(path.join(OUT_DIR, "_result.json"), JSON.stringify(summary, null, 2));

  console.log("\n结论：");
  console.log(`  出图：${results.length}/${cases.length} 张`);
  console.log(`  可复现：${reproducible ? "✅" : "❌"}`);
  console.log(`  新变体：${variantOk ? "✅" : "❌"}`);

  ws.close();
  chrome.kill();
  await sleep(400);
  process.exit(reproducible && variantOk ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ 失败：", e.message);
  process.exit(1);
});
