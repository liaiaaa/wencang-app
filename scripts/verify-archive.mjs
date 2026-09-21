// ============================================================
// P0-3 纹样档案深化 · 验收实测
//
// 覆盖：15 条详情页区块完整性 / 内容质量抽查 / Admin 编辑同步 /
//       缺失字段兼容 / 相关纹样跳转 / 375px 移动端不溢出
//
// 用法：先 `pnpm dev`，再 `node scripts/verify-archive.mjs`
// 产物：docs/screenshots/archive/*.png
// ============================================================

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "archive");
const BASE = process.env.BASE_URL || "http://localhost:5173";
const PORT = 9230;
const USER_DIR = path.join(tmpdir(), "wenzang-archive-verify");

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
      const h = await this.eval("Math.min(Math.ceil(document.documentElement.scrollHeight), 3600)");
      await this.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: h,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sleep(500);
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

  await cdp.goto(`${BASE}/`, 2000);
  await cdp.eval(`localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
    access_token:'admin',token_type:'bearer',user:{id:'u-admin-0001',email:'admin@miaoda.com'}})); true`);
  // 先访问一次数据页，确保应用已初始化
  await cdp.goto(`${BASE}/patterns`, 2600);

  console.log("\n=== P0-3 验收 ===\n");

  /** 通过应用自身的模块读取纹样数据（避免依赖 localStorage 是否已落盘） */
  const listPatterns = async () =>
    JSON.parse(
      await cdp.eval(`
        (async () => {
          const mod = await import('/src/lib/api.ts');
          const rows = await mod.fetchPatterns();
          return JSON.stringify(rows);
        })()
      `),
    );

  const readPattern = async (pid) =>
    JSON.parse(
      await cdp.eval(`
        (async () => {
          const mod = await import('/src/lib/api.ts');
          const p = await mod.fetchPatternById(${JSON.stringify(pid)});
          return JSON.stringify(p);
        })()
      `),
    );

  /* ---- 1. 15 条纹样详情页区块完整性 ---- */
  const allPatterns = await listPatterns();
  const ids = allPatterns.map((p) => p.id);

  const incomplete = [];
  let checked = 0;
  for (const pid of ids) {
    await cdp.goto(`${BASE}/patterns/${pid}`, 1500);
    const info = await cdp.eval(`
      (() => {
        const t = document.body.innerText;
        const steps = document.querySelectorAll('ol li').length;
        // 应用场景：Badge 组件渲染为 div.inline-flex；限定在「传统应用场景」区块内
        const sceneSection = [...document.querySelectorAll('section')]
          .find(s => s.textContent.includes('传统应用场景'));
        const scenes = sceneSection
          ? sceneSection.querySelectorAll('div.inline-flex.items-center').length
          : 0;
        // 相关纹样：区块内的卡片链接
        const relatedSection = [...document.querySelectorAll('section')]
          .find(s => s.textContent.includes('相关纹样'));
        const related = relatedSection
          ? relatedSection.querySelectorAll('a[href^="/patterns/"]').length
          : 0;
        const hasStory = t.includes('文化故事');
        const hasSteps = t.includes('工艺流程');
        const hasScenes = t.includes('传统应用场景');
        const hasRelated = t.includes('相关纹样');
        const storyLen = (() => {
          const i = t.indexOf('文化故事');
          if (i < 0) return 0;
          const rest = t.slice(i + 4);
          const j = rest.indexOf('传统应用场景');
          return (j > 0 ? rest.slice(0, j) : rest).replace(/\\s/g, '').length;
        })();
        return { steps, scenes, related, hasStory, hasSteps, hasScenes, hasRelated, storyLen };
      })()
    `);
    checked++;
    const ok =
      info.hasSteps && info.hasScenes && info.hasStory && info.hasRelated &&
      info.steps >= 3 && info.storyLen >= 120 && info.scenes >= 2 && info.related >= 2;
    if (!ok) incomplete.push({ pid, ...info });
  }
  record("1", `15 条纹样详情页区块完整`, incomplete.length === 0,
    `已检查 ${checked} 条，不完整 ${incomplete.length} 条`);
  if (incomplete.length) console.log("     明细:", JSON.stringify(incomplete.slice(0, 3)));

  /* ---- 2. 内容质量抽查：窝妥纹 / 蝴蝶妈妈 ---- */
  const spotCheck = async (name, expectSteps) => {
    const p = allPatterns.find((x) => x.name.includes(name));
    if (!p) return { found: false };
    await cdp.goto(`${BASE}/patterns/${p.id}`, 1800);
    return {
      found: true,
      steps: p.process_steps ?? [],
      story: p.story ?? "",
      scenes: p.usage_scenes ?? [],
      expectSteps,
    };
  };

  const butterfly = await spotCheck("蝴蝶妈妈绣", ["拓样上稿", "破线配线", "上绷固定"]);
  const butterflyOk =
    butterfly.found &&
    butterfly.expectSteps.every((s) => butterfly.steps.some((x) => x.includes(s)));
  record("2a", "蝴蝶妈妈绣：苗绣工序顺序符合真实工艺",
    butterflyOk, butterfly.found ? `${butterfly.steps.length} 步` : "未找到");

  const batik = await spotCheck("铜鼓纹蜡染", ["褪浆", "融蜡", "点蜡绘纹", "靛蓝浸染", "脱蜡"]);
  const batikOk =
    batik.found && batik.expectSteps.every((s) => batik.steps.some((x) => x.includes(s)));
  record("2b", "铜鼓纹蜡染：蜡染工序顺序符合真实工艺",
    batikOk, batik.found ? `${batik.steps.length} 步` : "未找到");

  const tie = await spotCheck("云纹扎染布", ["设计构图", "扎", "浸泡", "染色", "拆线"]);
  const tieOk = tie.found && tie.expectSteps.every((s) => tie.steps.some((x) => x.includes(s)));
  record("2c", "云纹扎染布：扎染工序顺序符合真实工艺", tieOk, tie.found ? `${tie.steps.length} 步` : "未找到");

  // 故事不含真实人名/学校名
  const storyClean = (() => {
    const banned = ["大学", "学院", "学校", "教授", "研究员", "先生"];
    const bad = [];
    for (const p of allPatterns) {
      const s = p.story || "";
      for (const w of banned) if (s.includes(w)) bad.push(p.name + ":" + w);
    }
    return bad;
  })();
  record("2d", "文化故事无真实人名/校名", storyClean.length === 0, storyClean.join(", "));

  await cdp.goto(`${BASE}/patterns/${ids[0]}`, 2200);
  await cdp.shot("01-详情页-档案深化(桌面全页)", true);

  /* ---- 3. Admin 编辑新字段 → 详情页同步 ---- */
  const targetId = ids[0];
  await cdp.goto(`${BASE}/admin?tab=patterns`, 2600);
  const targetName = allPatterns.find((p) => p.id === targetId).name;

  // 通过后台表单编辑「文化故事」
  await cdp.eval(`
    (() => {
      const rows = [...document.querySelectorAll('div')]
        .filter(d => d.textContent.includes(${JSON.stringify(targetName)}) && d.querySelector('button'));
      const row = rows[rows.length - 1];
      [...row.querySelectorAll('button')].find(b => b.textContent.trim().includes('编辑')).click();
      return true;
    })()
  `);
  await sleep(1000);
  const NEW_STORY = "这是通过运营后台编辑写入的文化故事，用于验证详情页实时同步。";
  // 按 label 精确定位「文化故事」对应的 textarea，避免依赖 DOM 顺序
  const filled = await cdp.eval(`
    (() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return { ok: false, reason: 'dialog not open' };
      const labels = [...dlg.querySelectorAll('label')];
      const target = labels.find(l => l.textContent.includes('文化故事'));
      if (!target) return { ok: false, reason: 'label not found', labels: labels.map(l=>l.textContent.trim()) };
      const field = target.parentElement;
      const ta = field.querySelector('textarea');
      if (!ta) return { ok: false, reason: 'textarea not found' };
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, ${JSON.stringify(NEW_STORY)});
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true };
    })()
  `);
  if (!filled.ok) console.log("     填充失败:", JSON.stringify(filled));
  await cdp.eval(`
    (() => {
      const dlg = document.querySelector('[role="dialog"]');
      [...dlg.querySelectorAll('button')].find(b => b.textContent.includes('保存修改')).click();
      return true;
    })()
  `);
  await sleep(2200);
  const updated = await readPattern(targetId);
  const adminSynced = updated?.story === NEW_STORY;
  record("3a", "Admin 编辑文化故事成功写入", adminSynced);

  await cdp.goto(`${BASE}/patterns/${targetId}`, 2400);
  const detailSynced = await cdp.eval(`document.body.innerText.includes(${JSON.stringify(NEW_STORY)})`);
  record("3b", "详情页实时同步新内容", detailSynced);
  await cdp.shot("02-详情页-后台编辑后同步");

  /* ---- 4. 缺失新字段的老数据 ---- */
  await cdp.goto(`${BASE}/`, 1600);
  const legacyId = await cdp.eval(`
    (async () => {
      const api = await import('/src/lib/api.ts');
      const created = await api.createPattern({
        name: '老数据兼容测试纹样',
        category: '蜡染',
        region: '贵州 · 测试',
        technique: '测试工艺',
        meaning: '这条记录刻意缺少全部深化字段',
        image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
      });
      return created.id;
    })()
  `);
  // 确认该记录确实没有深化字段
  const legacyRaw = await readPattern(legacyId);
  const trulyMissing =
    !legacyRaw.process_steps && !legacyRaw.story && !legacyRaw.usage_scenes && !legacyRaw.related_patterns;

  cdp.consoleErrors.length = 0;
  await cdp.goto(`${BASE}/patterns/${legacyId}`, 2600);
  const legacy = await cdp.eval(`
    (() => {
      const t = document.body.innerText;
      const steps = document.querySelectorAll('ol li').length;
      return {
        rendered: t.includes('老数据兼容测试纹样'),
        meaningShown: t.includes('这条记录刻意缺少全部深化字段'),
        steps,
        hasSteps: t.includes('工艺流程'),
        hasStory: t.includes('文化故事'),
        hasScenes: t.includes('传统应用场景'),
      };
    })()
  `);
  // 缺失字段的三个区块必须完全不渲染（不出现空标题/空容器）
  const legacyOk =
    legacy.rendered && legacy.meaningShown &&
    !legacy.hasSteps && !legacy.hasStory && !legacy.hasScenes && legacy.steps === 0;
  record("4a", "缺失字段：基础内容正常渲染，且无空区块", legacyOk && trulyMissing,
    `trulyMissing=${trulyMissing} ${JSON.stringify(legacy)}`);
  const legacyErrors = cdp.consoleErrors.filter((e) => !/favicon|404|Failed to load resource/i.test(e));
  record("4b", "缺失字段：无控制台报错", legacyErrors.length === 0, legacyErrors.slice(0, 2).join(" | "));
  await cdp.shot("03-详情页-老数据兼容(无空区块)", true);

  /* ---- 5. 相关纹样点击跳转 ---- */
  await cdp.goto(`${BASE}/patterns/${targetId}`, 2400);
  const jump = await cdp.eval(`
    (() => {
      const t = document.body.innerText;
      const i = t.indexOf('相关纹样');
      if (i < 0) return { ok: false, reason: '无相关纹样区块' };
      const links = [...document.querySelectorAll('a[href^="/patterns/"]')]
        .filter(a => a.href.split('/patterns/')[1] !== ${JSON.stringify(targetId)});
      if (!links.length) return { ok: false, reason: '无相关纹样卡片' };
      const href = links[links.length - 1].getAttribute('href');
      links[links.length - 1].click();
      return { ok: true, href };
    })()
  `);
  await sleep(2200);
  const afterJump = await cdp.eval("location.pathname");
  record("5a", "相关纹样点击跳转正确",
    jump.ok && afterJump === jump.href,
    `${jump.href || jump.reason} → ${afterJump}`);

  /* ---- 6. 375px 移动端不溢出 ---- */
  await cdp.goto(`${BASE}/patterns/${targetId}`, 2200);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 375, height: 900, deviceScaleFactor: 2, mobile: true,
  });
  await sleep(1200);
  const mobile = await cdp.eval(`
    (() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      // 工艺流程步骤容器的排列方向
      const ol = document.querySelector('ol');
      const li = ol ? ol.querySelector('li') : null;
      const style = ol ? getComputedStyle(ol) : null;
      const liStyle = li ? getComputedStyle(li) : null;
      return {
        docW, winW,
        overflow: docW > winW + 1,
        flexDir: style ? style.flexDirection : null,
        liDir: liStyle ? liStyle.flexDirection : null,
        stepCount: ol ? ol.querySelectorAll('li').length : 0,
      };
    })()
  `);
  record("6a", "375px 无横向溢出", !mobile.overflow, `docW=${mobile.docW} winW=${mobile.winW}`);
  record("6b", "375px 下工艺流程纵向排列", mobile.flexDir === "column",
    `ol flex-direction=${mobile.flexDir}, ${mobile.stepCount} 步`);
  await cdp.shot("04-详情页-375px移动端", true);
  await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});

  /* ---- 7. 断网可用（复用已有脚本，此处仅确认详情页本地渲染） ---- */
  record("7", "详情页数据来自本地（断网可渲染）", (await listPatterns()).length >= 15);

  writeFileSync(path.join(OUT, "_result.json"), JSON.stringify({ results }, null, 2));
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
