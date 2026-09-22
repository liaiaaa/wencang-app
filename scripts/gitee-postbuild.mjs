// Gitee Pages 部署后处理：
// 把 index.html 复制为 404.html —— Gitee Pages 对未命中的路径返回仓库中的 404.html，
// 复制后 SPA 深链接（如 /wencang-app/patterns）刷新时仍能正确加载应用。
import { copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "dist-gitee");

copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
console.log("gitee-postbuild: dist-gitee/404.html 已生成（SPA 深链接兜底）");
