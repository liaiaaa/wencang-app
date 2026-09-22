// ============================================================
// 零依赖浏览器验收脚本的公共外壳
//
// 用 Node 内置能力驱动本机 Chrome / Edge 的 CDP 协议，不引入 puppeteer/playwright。
// 已有的 verify-*.mjs 各自内嵌了一份同构实现（历史原因，保持不动），
// 新增脚本一律从这里复用。
//
// 用法：
//   const browser = await launch({ port: 9250, out: OUT });
//   await browser.goto(url); await browser.eval("..."); await browser.shot("名称");
//   browser.finish([{ id, label, pass, detail }]);   // 打印汇总 + 写 _result.json + 退出码
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

/** 控制台里可以忽略的噪音：外部图片在断网下必然 404、DevTools 提示等 */
const NOISE = /favicon|404|Failed to load resource|net::ERR|ERR_|Download the React DevTools|ERR_INTERNET_DISCONNECTED/i;

export class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        this.consoleErrors.push(
          (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" "),
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

  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error("timeout " + method));
        }
      }, timeoutMs);
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

  /** 轮询等待条件成立，超时则抛出可读错误（比固定 sleep 稳得多） */
  async waitFor(expression, { timeout = 8000, interval = 200, label = expression } = {}) {
    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
      last = await this.eval(`(() => { try { return (${expression}) ? true : false; } catch (e) { return String(e); } })()`);
      if (last === true) return true;
      await sleep(interval);
    }
    throw new Error(`等待超时：${label}（最后状态 ${last}）`);
  }

  async goto(url, waitMs = 0) {
    await this.send("Page.stopLoading").catch(() => {});
    await this.send("Page.navigate", { url });
    if (waitMs) await sleep(waitMs);
  }

  /**
   * 截图（只截可视区）。
   *
   * 不用 setDeviceMetricsOverride / captureBeyondViewport 拼整页：本机 headless 实测，
   * 页面高度到 2400px 以上时截帧必然超时，而且**一旦设过这个覆盖，之后连普通截图都拍不出来**
   * （清掉覆盖并等待数秒也不恢复），会把整条验收链卡死。
   * 需要看长页面时分段滚动截图，参数 full 仅表示「先滚回顶部」。
   */
  async shot(name, full = false) {
    if (full) {
      await this.eval("window.scrollTo(0, 0)");
      await sleep(300);
    }
    const t0 = Date.now();
    let data;
    for (let i = 0; ; i++) {
      try {
        ({ data } = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, 20000));
        break;
      } catch (e) {
        if (i >= 1) throw e;
        await sleep(600);
      }
    }
    void t0;
    writeFileSync(path.join(this.outDir, `${name}.png`), Buffer.from(data, "base64"));
    console.log(`  📸 ${name}.png`);
  }

  /**
   * 用真实鼠标事件点击元素。
   *
   * 合成事件（el.click() / dispatchEvent）打不开 Radix DropdownMenu——它监听的是
   * pointerdown 并会校验按钮与指针类型，因此菜单类交互必须走 CDP 的输入通道。
   * @param {string} expression 求值结果为 HTMLElement 的表达式
   */
  async clickAt(expression) {
    const box = await this.eval(`(() => {
      const el = (${expression});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!box) throw new Error("找不到要点击的元素：" + expression);
    await sleep(120);
    const rect = await this.eval(`(() => {
      const el = (${expression});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    const { x, y } = rect || box;
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed", x, y, button: "left", clickCount: 1,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased", x, y, button: "left", clickCount: 1,
    });
    return true;
  }

  cleanErrors() {
    return this.consoleErrors.filter((e) => !NOISE.test(e));
  }

  close() {
    this.ws.close();
  }
}

/**
 * 启动一个干净的无头浏览器（独立 user-data-dir ⇒ 全新 localStorage，等同隐身模式）。
 * @param {{port:number, out:string, base?:string}} opts
 */
export async function launch(opts) {
  const { port, out, base = "http://localhost:5173" } = opts;
  mkdirSync(out, { recursive: true });
  const userDir = path.join(tmpdir(), `wenzang-verify-${port}`);
  rmSync(userDir, { recursive: true, force: true });

  const exe = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error("未找到本机 Chrome / Edge，无法运行浏览器验收脚本");

  const chrome = spawn(
    exe,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
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
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page");
      if (target?.webSocketDebuggerUrl) break;
    } catch {
      /* 浏览器还没起来 */
    }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error("CDP 连接失败：浏览器未就绪");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r);
    ws.addEventListener("error", j);
  });

  const cdp = new CDP(ws);
  cdp.outDir = out;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const title = (t) => console.log(`\n=== ${t} ===\n`);
  const results = [];
  const record = (id, label, pass, detail = "") => {
    results.push({ id, label, pass: !!pass, detail });
    console.log(`  ${pass ? "✅" : "❌"} [${id}] ${label}${detail ? " — " + detail : ""}`);
  };

  /** 汇总并结束进程：有未通过项时退出码为 1 */
  const finish = (summaryLabel = "验收") => {
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${summaryLabel}：${results.length - failed.length}/${results.length} 项通过`);
    if (failed.length) {
      console.log("未通过：");
      failed.forEach((f) => console.log(`  - [${f.id}] ${f.label} ${f.detail}`));
    }
    writeFileSync(path.join(out, "_result.json"), JSON.stringify({ results, consoleErrors: cdp.cleanErrors() }, null, 2));
    cdp.close();
    chrome.kill();
    setTimeout(() => process.exit(failed.length ? 1 : 0), 400);
  };

  return { cdp, base, title, record, finish, results, sleep };
}
