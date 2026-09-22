import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { seedDemoEvents } from "./lib/analytics";
import "./index.css";

// 首次启动时预置近 7 天演示埋点，保证运营看板首次进入即有内容。
// 仅在完全没有埋点数据时写入，不会覆盖真实操作记录。
seedDemoEvents();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);