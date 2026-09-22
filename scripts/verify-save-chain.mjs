// ============================================================
// 离线全链路验收：登录 → 程序化生成 → 保存 → 「我的纹样」可见
//
// 关键验证点：本地生成的 SVG 能光栅化为 PNG 并成功入库展示。
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-save-chain.mjs`
// 产物：docs/screenshots/patterns/09-保存后我的纹样.png
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "screenshots", "patterns");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const PORT = 9226;
const USER_DIR = path.join(tmpdir(), "wenzang-save-verify");

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
  async goto(url, w = 1900) {
    await this.send("Page.stopLoading").catch(() => {});
    await this.send("Page.navigate", { url });
    await sleep(w);
  }
}

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
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const HELPERS = `
  window.__s = {
    fill(sel, v) {
      const el = document.querySelector(sel);
      if (!el) throw new Error('not found ' + sel);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    },
    btn(text) {
      const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes(text));
      if (!el) throw new Error('button not found: ' + text);
      el.click();
      return true;
    },
    cat(text) {
      const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === text);
      if (!el) throw new Error('category not found: ' + text);
      el.click();
      return true;
    },
    // 「我的纹样」中已保存的卡片图片（data URL / blob / http 均可）
    savedWithImage() {
      const imgs = [...document.querySelectorAll('img')];
      return imgs.map(i => ({
        alt: i.alt,
        scheme: (i.src || '').split(':')[0],
        w: i.naturalWidth,
        h: i.naturalHeight,
      }));
    }
  };
  true;
  `;

  console.log("离线全链路验收（生成 → 保存 → 我的纹样）：\n");

  // 1) 登录
  await cdp.goto(`${BASE}/login`, 1800);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__s.fill('#username', 'demo')`);
  await cdp.eval(`window.__s.fill('#password', 'demo123456')`);
  await cdp.eval(`document.querySelector('#agree').click()`);
  await sleep(200);
  await cdp.eval(`window.__s.btn('登录')`);
  await sleep(2200);
  console.log("  ✅ 已登录 demo");

  // 2) 生成
  await cdp.goto(`${BASE}/workshop`, 2000);
  await cdp.eval(HELPERS);
  await cdp.eval(`window.__s.fill('input', '蝴蝶妈妈 苗绣')`);
  await cdp.eval(`window.__s.cat('苗绣')`);
  await sleep(250);
  await cdp.eval(`window.__s.btn('生成纹样')`);
  await sleep(1800);

  const generated = await cdp.eval(`
    (() => {
      const img = document.querySelector('img[alt]');
      return img ? { src: img.src.slice(0, 40), w: img.naturalWidth, h: img.naturalHeight } : null;
    })()
  `);
  if (!generated) throw new Error("未生成图案");
  console.log(`  ✅ 已生成图案（naturalSize ${generated.w}x${generated.h}）`);

  // 3) 保存
  await cdp.eval(`window.__s.btn('保存到我的纹样')`);
  await sleep(3000);
  const toastText = await cdp.eval("document.body.innerText");
  const saveOk = toastText.includes("已保存到「我的纹样」");
  console.log(`  ${saveOk ? "✅" : "❌"} 保存动作：${saveOk ? "已保存到「我的纹样」" : "未见成功提示"}`);

  // 4) 我的纹样可见
  await cdp.goto(`${BASE}/profile?tab=patterns`, 2600);
  await cdp.eval(HELPERS); // 页面已重新加载，需重新注入辅助函数
  const saved = JSON.parse(await cdp.eval(`JSON.stringify(window.__s.savedWithImage())`));
  // 只关心「我的纹样」里真正加载成功的图片（宽高 > 0）
  const loaded = saved.filter((s) => s.w > 0 && s.h > 0);
  const visible = loaded.length > 0;
  console.log(
    `  ${visible ? "✅" : "❌"} 我的纹样：${loaded.length} 张图片加载成功` +
      (loaded.length ? `（${loaded.map((s) => `${s.alt}:${s.w}x${s.h}`).join(", ")}）` : ""),
  );
  if (saved.length && !visible) {
    console.log(`     调试信息：${JSON.stringify(saved)}`);
  }

  await sleep(400);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(
    path.join(OUT_DIR, "09-保存后我的纹样.png"),
    Buffer.from(data, "base64"),
  );
  console.log("  📸 09-保存后我的纹样.png");

  ws.close();
  chrome.kill();
  await sleep(400);

  const pass = saveOk && visible;
  console.log(`\n结论：离线全链路 ${pass ? "✅ 通过" : "❌ 未通过"}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ 失败：", e.message);
  process.exit(1);
});
