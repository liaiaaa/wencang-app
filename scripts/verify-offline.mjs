import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots", "admin");
const BASE = "http://localhost:5173";
const PORT = 9229;
const USER_DIR = path.join(tmpdir(), "wenzang-offline");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);

class CDP {
  constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();
    ws.addEventListener("message",(ev)=>{const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){const{resolve,reject}=this.pending.get(m.id);
        this.pending.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}});}
  send(method,params={}){const id=++this.id;return new Promise((res,rej)=>{
    this.pending.set(id,{resolve:res,reject:rej});
    this.ws.send(JSON.stringify({id,method,params}));
    setTimeout(()=>{if(this.pending.has(id)){this.pending.delete(id);rej(new Error("timeout "+method));}},60000);});}
  async eval(e){const r=await this.send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
    return r.result.value;}
  async goto(url,w=2200){await this.send("Page.stopLoading").catch(()=>{});await this.send("Page.navigate",{url});await sleep(w);}
}

mkdirSync(OUT,{recursive:true});
rmSync(USER_DIR,{recursive:true,force:true});
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${USER_DIR}`,"--headless=new",
  "--no-first-run","--no-default-browser-check","--hide-scrollbars","--window-size=1440,1200","about:blank"],{stdio:"ignore"});

let target=null;
for(let i=0;i<40;i++){await sleep(300);
  try{const list=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target=list.find(t=>t.type==="page");if(target?.webSocketDebuggerUrl)break;}catch{}}
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.addEventListener("open",r);ws.addEventListener("error",j);});
const cdp=new CDP(ws);
await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Network.enable");

// 1) 先在联网状态加载应用（模拟已打开页面）
await cdp.goto(`${BASE}/`,2000);
await cdp.eval(`localStorage.setItem('wenzang.mock.session.v1', JSON.stringify({
  access_token:'admin',token_type:'bearer',user:{id:'u-admin-0001',email:'admin@miaoda.com'}})); true`);

// 2) 切断网络：仅允许 localhost（应用自身），阻断全部外网
// 仅阻断外网（图片 CDN / Supabase 等），保留本地开发服务器
await cdp.send("Network.setBlockedURLs", {
  urls: ["*://*.bcebos.com/*", "*://*.supabase.co/*", "*://*.bcebos.net/*", "*://fonts.googleapis.com/*"],
});
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
console.log("已阻断外网请求（仅保留本地服务）\n");

const check = async (label, fn) => {
  try { const ok = await fn(); console.log(`  ${ok?"✅":"❌"} ${label}`); return ok; }
  catch(e){ console.log(`  ❌ ${label} — ${e.message}`); return false; }
};

const HELPERS = `window.__o={
  fill(sel,v,nth=0){const d=document.querySelector('[role="dialog"]');
    const el=(d||document).querySelectorAll(sel)[nth];
    if(!el)throw new Error('not found '+sel);
    const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);
    el.dispatchEvent(new Event('input',{bubbles:true}));return true;},
  btn(t){const el=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().includes(t));
    if(!el)throw new Error('btn '+t);el.click();return true;},
  nav(t){const el=[...document.querySelectorAll('nav button')].find(b=>(b.textContent||'').includes(t));
    if(!el)throw new Error('nav '+t);el.click();return true;},
  text(){return document.body.innerText;}
};true;`;

const results=[];
// 后台可访问
await cdp.goto(`${BASE}/admin`,2600); await cdp.eval(HELPERS);
results.push(await check("断网下 /admin 可访问", async()=>(await cdp.eval("window.__o.text()")).includes("概况看板")));

// 断网下新建纹样
await cdp.eval(`window.__o.nav('纹样管理')`); await sleep(1200);
await cdp.eval(`window.__o.btn('新建')`); await sleep(800);
await cdp.eval(`window.__o.fill('input','断网验收纹样')`);
await cdp.eval(`window.__o.fill('input','贵州 · 离线',1)`);
await cdp.eval(`window.__o.fill('input','离线工艺',2)`);
await cdp.eval(`window.__o.btn('创建')`); await sleep(2200);
results.push(await check("断网下可新建纹样", async()=>(await cdp.eval("window.__o.text()")).includes("断网验收纹样")));

// 断网下前台图库可见
await cdp.goto(`${BASE}/patterns`,2600); await cdp.eval(HELPERS);
results.push(await check("断网下前台图库可见新纹样", async()=>(await cdp.eval("window.__o.text()")).includes("断网验收纹样")));

// 断网下生成纹样
await cdp.goto(`${BASE}/workshop`,2400); await cdp.eval(HELPERS);
await cdp.eval(`window.__o.fill('input','铜鼓 蜡染')`);
await sleep(250);
await cdp.eval(`window.__o.btn('生成纹样')`); await sleep(2200);
const genOk = await cdp.eval(`!!document.querySelector('img[alt]') && document.body.innerText.includes('算法生成')`);
results.push(await check("断网下程序化生成纹样出图", async()=>genOk));

await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true})
  .then(({data})=>writeFileSync(path.join(OUT,"09-断网-生成纹样.png"),Buffer.from(data,"base64")));
console.log("  📸 09-断网-生成纹样.png");

ws.close(); chrome.kill();
const pass=results.filter(Boolean).length;
console.log(`\n断网验收：${pass}/${results.length} 项通过`);
process.exit(pass===results.length?0:1);

