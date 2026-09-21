// 最终验收：逐路由真实浏览器检查（标题 / 正文非空 / 无错误）
import { spawn } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = "http://localhost:5173";
const PORT = 9224;
const USER_DIR = path.join(tmpdir(), "wenzang-verify");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find(existsSync);

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = [];
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        this.logs.push((m.params.args || []).map((a) => a.value || a.description || "").join(" "));
      }
      if (m.method === "Runtime.exceptionThrown") {
        this.logs.push("EXCEPTION: " + (m.params.exceptionDetails?.exception?.description || ""));
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error("timeout " + method)); } }, 45000);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async goto(url, w = 1800) { await this.send("Page.navigate", { url }); await sleep(w); }
}

rmSync(USER_DIR, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${USER_DIR}`, "--headless=new",
  "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
  "--window-size=1440,1000", "about:blank",
], { stdio: "ignore" });

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
await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
const cdp = new CDP(ws);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");

// 以管理员身份注入会话（验证 /profile 与 /admin/bookings 需登录的路由）
await cdp.goto(`${BASE}/`, 1500);
await cdp.eval(`
  localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
    access_token: 'verify', token_type: 'bearer',
    user: { id: 'u-admin-0001', email: 'admin@miaoda.com' }
  })); true
`);

const checks = [
  ["/", "让每一道纹样"],
  ["/patterns", "纹样图库"],
  ["/patterns/p0000001-0000-4000-8000-000000000001", "蝶恋花靛蓝纹"],
  ["/workshop", "AI纹样工坊"],
  ["/artisans", "示例档案"],
  ["/artisans/a0000001-0000-4000-8000-000000000001", "本档案为平台示例数据"],
  ["/booking", "体验预约"],
  ["/shop", "文创商城"],
  ["/shop/g0000001-0000-4000-8000-000000000001", "工艺说明"],
  ["/login", "纹藏"],
  ["/profile?tab=bookings", "我的预约"],
  ["/profile?tab=admin", "管理员 · 全部预约"],
  ["/admin/bookings", "管理员 · 全部预约"],
];

let pass = 0, fail = 0;
console.log("路由验收（管理员会话）：\n");
for (const [route, expect] of checks) {
  cdp.logs.length = 0;
  await cdp.goto(BASE + route, 2000);
  const text = await cdp.eval("document.body.innerText");
  const url = await cdp.eval("location.pathname + location.search");
  const ok = text.includes(expect);
  const hasErr = cdp.logs.filter((l) => !/favicon|404|Failed to load resource/i.test(l));
  const status = ok && hasErr.length === 0 ? "✅" : "❌";
  if (ok && hasErr.length === 0) pass++; else fail++;
  console.log(`${status} ${route.padEnd(50)} → ${url}`);
  if (!ok) console.log(`     缺少预期文本：「${expect}」`);
  if (hasErr.length) console.log(`     控制台错误：${hasErr.slice(0, 2).join(" | ")}`);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败（共 ${checks.length} 条路由）`);
ws.close(); chrome.kill();
process.exit(fail ? 1 : 0);
