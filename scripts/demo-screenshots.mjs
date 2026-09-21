// ============================================================
// 演示截图脚本（零新增依赖，使用 Node 内置 fetch + WebSocket 驱动 Chrome CDP）
//
// 用法：
//   1) 另开终端启动本地服务： pnpm dev
//   2) 运行： node scripts/demo-screenshots.mjs
//
// 产物：docs/screenshots/*.png
// 脚本会真实走一遍「用户提交预约 → 管理员确认 → 用户端状态变化」闭环。
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "screenshots");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const PORT = 9222;
const USER_DIR = path.join(tmpdir(), "wenzang-shot-profile");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- CDP 客户端 ---------------- */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 90000);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        "Eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text),
      );
    }
    return r.result.value;
  }
  /**
   * 截图。默认只截视口（稳定、体积小）；
   * fullPage=true 时临时把视口拉高到整页高度，保证内容不被折叠裁掉。
   */
  async shot(name, { fullPage = false, maxHeight = 2400 } = {}) {
    // 等页面加载完成再截图，避免 CDP 卡住或截到半成品
    for (let i = 0; i < 30; i++) {
      const ready = await this.eval("document.readyState").catch(() => "loading");
      if (ready === "complete") break;
      await sleep(200);
    }
    await sleep(300);

    let restore = null;
    if (fullPage) {
      const h = await this.eval(
        "Math.min(Math.ceil(document.documentElement.scrollHeight), " + maxHeight + ")",
      );
      const prev = await this.send("Browser.getWindowBounds", { windowId: 1 }).catch(() => null);
      await this.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: h,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(700);
      restore = async () => {
        await this.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
        void prev;
      };
    }

    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });

    if (restore) await restore();

    const file = path.join(OUT_DIR, `${name}.png`);
    writeFileSync(file, Buffer.from(data, "base64"));
    console.log(`  📸 ${name}.png${fullPage ? "（整页）" : ""}`);
  }
  async goto(url, waitMs = 1400) {
    // 等待上一次导航彻底结束，避免 captureScreenshot 卡住
    await this.send("Page.stopLoading").catch(() => {});
    await this.send("Page.navigate", { url });
    await sleep(waitMs);
  }
}

/* ---------------- 页面交互辅助（注入到浏览器执行） ---------------- */
const HELPERS = `
window.__t = {
  byText(sel, text) {
    return [...document.querySelectorAll(sel)].find(e => (e.textContent || '').trim().includes(text));
  },
  click(sel, text) {
    const el = text ? this.byText(sel, text) : document.querySelector(sel);
    if (!el) throw new Error('not found: ' + sel + ' / ' + text);
    el.click();
    return true;
  },
  fill(sel, value, nth = 0) {
    const els = document.querySelectorAll(sel);
    const el = els[nth];
    if (!el) throw new Error('input not found: ' + sel + ' #' + nth);
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },
  // Radix Select：点开触发器后按文本选中选项
  async selectByIndex(triggerIndex, optionText) {
    const triggers = [...document.querySelectorAll('[role="combobox"]')];
    const t = triggers[triggerIndex];
    if (!t) throw new Error('combobox #' + triggerIndex + ' not found');
    t.click();
    await new Promise(r => setTimeout(r, 350));
    const opt = [...document.querySelectorAll('[role="option"]')]
      .find(o => (o.textContent || '').includes(optionText));
    if (!opt) throw new Error('option not found: ' + optionText);
    opt.click();
    await new Promise(r => setTimeout(r, 250));
    return true;
  },
  text() { return document.body.innerText; }
};
true;
`;

/* ---------------- 主流程 ---------------- */
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  try {
    rmSync(USER_DIR, { recursive: true, force: true });
  } catch {}

  const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chromePath) throw new Error("未找到 Chrome / Edge 可执行文件");

  console.log("启动浏览器…");
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${USER_DIR}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--window-size=1440,1000",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  // 等待调试端口就绪
  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      target = list.find((t) => t.type === "page");
      if (target?.webSocketDebuggerUrl) break;
    } catch {}
  }
  if (!target) throw new Error("无法连接浏览器调试端口");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const inject = async () => {
    await cdp.eval(HELPERS);
  };

  const failures = [];
  const step = async (label, fn) => {
    process.stdout.write(`▶ ${label}\n`);
    try {
      await fn();
    } catch (err) {
      failures.push(`${label}: ${err.message}`);
      console.log(`  ⚠️  跳过（${err.message}）`);
    }
  };

  /* ---- 1. 首页 ---- */
  await step("首页 /", async () => {
    await cdp.goto(`${BASE}/`, 2200);
    await cdp.shot("01-首页");
  });

  /* ---- 2. 纹样图库 ---- */
  await step("纹样图库 /patterns", async () => {
    await cdp.goto(`${BASE}/patterns`, 2000);
    await cdp.shot("02-纹样图库");
  });

  /* ---- 3. 纹样详情 ---- */
  await step("纹样详情 /patterns/:id", async () => {
    await cdp.eval(`document.querySelector('a[href^="/patterns/"]').click(); true`);
    await sleep(1600);
    await cdp.shot("03-纹样详情");
  });

  /* ---- 4. 守艺人展厅（合规标注） ---- */
  await step("守艺人展厅 /artisans（示例档案标注）", async () => {
    await cdp.goto(`${BASE}/artisans`, 2000);
    // 卡片较高，需整页截图才能看到姓名旁的「示例档案」标签
    await cdp.shot("04-守艺人展厅-示例档案标注", { fullPage: true });
  });

  /* ---- 5. 守艺人详情（合规说明） ---- */
  await step("守艺人详情 /artisans/:id（合规说明）", async () => {
    await cdp.eval(`document.querySelector('a[href^="/artisans/"]').click(); true`);
    await sleep(1600);
    await cdp.shot("05-守艺人详情-合规说明");
  });

  /* ---- 6. AI 工坊（文字模式降级） ---- */
  await step("AI工坊 /workshop（生图失败降级为文字模式）", async () => {
    await cdp.goto(`${BASE}/workshop`, 1800);
    await inject();
    await cdp.eval(`window.__t.fill('input', '蝴蝶妈妈 苗绣')`);
    await cdp.eval(`window.__t.click('button', '生成纹样')`);
    await sleep(2500);
    await cdp.shot("06-AI工坊-文字模式降级");
  });

  /* ---- 7. 登录（普通用户） ---- */
  await step("登录普通用户 demo / demo123456", async () => {
    await cdp.goto(`${BASE}/login`, 1600);
    await inject();
    await cdp.eval(`window.__t.fill('#username', 'demo')`);
    await cdp.eval(`window.__t.fill('#password', 'demo123456')`);
    await cdp.eval(`window.__t.click('#agree')`);
    await sleep(200);
    await cdp.eval(`window.__t.click('button[type="submit"]')`);
    await sleep(2200);
    await cdp.shot("07-登录后首页");
  });

  /* ---- 8. 提交预约 ---- */
  await step("提交预约 /booking", async () => {
    await cdp.goto(`${BASE}/booking`, 2000);
    await inject();
    await cdp.eval(`window.__t.selectByIndex(0, '韦祖英')`);
    await cdp.eval(`window.__t.selectByIndex(1, '蜡染工艺体验')`);
    const d = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    await cdp.eval(`window.__t.fill('input[type="date"]', '${d}')`);
    await cdp.eval(`window.__t.selectByIndex(2, '上午')`);
    await cdp.eval(`window.__t.fill('input[placeholder="请输入联系人姓名"]', '演示用户')`);
    await cdp.eval(`window.__t.fill('input[placeholder="请输入手机号"]', '13800001234')`);
    await sleep(400);
    await cdp.shot("08-预约表单已填写");
    await cdp.eval(`window.__t.click('button', '提交预约')`);
    await sleep(2600);
    await cdp.shot("09-用户端-我的预约-待确认", { fullPage: true });
  });

  /* ---- 9. 管理员登录 ---- */
  await step("登录管理员 admin / wencang2026", async () => {
    await cdp.goto(`${BASE}/profile?tab=bookings`, 1800);
    await inject();
    // 退出当前用户
    await cdp.eval(`window.__t.click('button', '退出登录')`);
    await sleep(1500);
    await cdp.goto(`${BASE}/login`, 1600);
    await inject();
    await cdp.eval(`window.__t.fill('#username', 'admin')`);
    await cdp.eval(`window.__t.fill('#password', 'wencang2026')`);
    await cdp.eval(`window.__t.click('#agree')`);
    await sleep(200);
    await cdp.eval(`window.__t.click('button[type="submit"]')`);
    await sleep(2200);
  });

  /* ---- 10. 管理员预约管理 ---- */
  await step("个人中心 → 预约管理（管理员视角）", async () => {
    await cdp.goto(`${BASE}/profile?tab=admin`, 2400);
    await inject();
    await cdp.shot("10-管理员-预约管理", { fullPage: true });
  });

  /* ---- 11. 管理员确认预约 ---- */
  await step("管理员确认预约", async () => {
    await cdp.eval(`window.__t.click('button', '确认预约')`);
    await sleep(1800);
    await cdp.shot("11-管理员-已确认", { fullPage: true });
  });

  /* ---- 12. 用户端看到状态变化 ---- */
  await step("用户端状态变化", async () => {
    await cdp.goto(`${BASE}/profile?tab=bookings`, 1800);
    await inject();
    await cdp.eval(`window.__t.click('button', '退出登录')`);
    await sleep(1500);
    await cdp.goto(`${BASE}/login`, 1600);
    await inject();
    await cdp.eval(`window.__t.fill('#username', 'demo')`);
    await cdp.eval(`window.__t.fill('#password', 'demo123456')`);
    await cdp.eval(`window.__t.click('#agree')`);
    await sleep(200);
    await cdp.eval(`window.__t.click('button[type="submit"]')`);
    await sleep(2000);
    await cdp.goto(`${BASE}/profile?tab=bookings`, 2400);
    await cdp.shot("12-用户端-我的预约-已确认", { fullPage: true });
  });

  /* ---- 13. 文创商城 ---- */
  await step("文创商城 /shop", async () => {
    await cdp.goto(`${BASE}/shop`, 2000);
    await cdp.shot("13-文创商城");
  });

  ws.close();
  chrome.kill();
  await sleep(500);
  if (failures.length) {
    console.log(`\n⚠️  完成，但有 ${failures.length} 步失败：`);
    failures.forEach((f) => console.log("   - " + f));
  }
  console.log(`\n✅ 截图已输出到 ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("❌ 截图失败：", err.message);
  process.exit(1);
});
