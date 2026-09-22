import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

// 演示模式（mock）开关：
//   - `pnpm dev`（--mode mock）→ 启用
//   - `pnpm dev:cloud`（--mode cloud）→ 强制关闭，即使 .env.local 里写了 VITE_USE_MOCK=1
//   - 其他 mode → 由 .env 中的 VITE_USE_MOCK=1 决定
// 启用后把 "@/db/supabase" 指向本地内存实现，业务代码零改动
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMock = mode === "cloud" ? false : mode === "mock" || env.VITE_USE_MOCK === "1";

  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          icon: true,
          exportType: "named",
          namedExport: "ReactComponent",
        },
      }),
    ],
    resolve: {
      alias: [
        ...(useMock
          ? [
              {
                find: /^@\/db\/supabase$/,
                replacement: path.resolve(__dirname, "./src/db/supabase.mock.ts"),
              },
            ]
          : []),
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: {
      watch: {
        // 只监听源码与静态资源，避免编辑器/工具的临时文件
        // （如 .README.md.<pid>.tmpdir/*.tmp）触发 EBUSY 导致 dev server 崩溃
        ignored: [
          "**/.*.tmpdir/**",
          "**/*.tmp",
          "**/dev-server.log",
          "**/docs/screenshots/**",
          "**/dist/**",
        ],
      },
    },
  };
});
