---
name: 靛蓝画廊式
source_draft: 2
fonts:
  heading: "SourceHanSerifCN"
  body: "JiangChengHei"
tokens:
  radius: "0.5rem"
  background: "40 30% 96%"
  foreground: "218 45% 15%"
  card: "0 0% 100%"
  card-foreground: "218 45% 15%"
  primary: "218 51% 37%"
  primary-foreground: "40 30% 96%"
  secondary: "218 25% 90%"
  secondary-foreground: "218 51% 28%"
  muted: "40 18% 90%"
  muted-foreground: "218 15% 42%"
  accent: "8 72% 45%"
  accent-foreground: "40 30% 96%"
  destructive: "0 72% 48%"
  destructive-foreground: "40 30% 96%"
  border: "218 20% 84%"
  input: "218 20% 84%"
  ring: "218 51% 37%"
  popover: "0 0% 100%"
  popover-foreground: "218 45% 15%"
custom_tokens:
  cinnabar: "8 72% 45%"
  ink: "218 45% 15%"
section_blueprint:
  hero: "relative"
  features: "max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20"
  gallery: "bg-secondary/30"
---

## Overview
靛蓝画廊式以杂志编辑的克制与民族工艺的厚重为基调。主色蜡染靛蓝承载非遗的庄重感，米白纸感底色营造画廊般的留白，朱砂红仅作点睛。Signature 元素为等宽数字编号、发丝引线与双色调图片，让信息呈现像博物馆展签。

## Colors
- 60% 表面：米白背景 + 白色卡片 + 浅靛蓝次级面。
- 30% 内容：靛蓝正文与标题，柔和灰辅助文字，浅靛蓝边框。
- 10% 强调：朱砂红用于关键数字、强调点、CTA 与品牌焦点。
- 主色仅用于标题、关键按钮、品牌标识；次级按钮用次级面；卡片悬浮时边框转主色并加阴影。

## Typography
- 标题：思源宋体（SourceHanSerifCN）粗体，营造东方木版画厚重感。
- 正文与数字：江城黑体（JiangChengHei），数字用 tabular-nums 等宽对齐。
- 字阶：hero 标题 5xl→7xl，区块标题 3xl→4xl，卡片标题 xl，正文 sm/base。
- 行高：标题 0.95–1.05，正文 1.5–1.6。

## Layout
- 容器 max-w-7xl，水平内边距 px-4 md:px-8。
- 断点只用 md（≥768px），移动优先单列，桌面多列网格。
- 区块纵向间距 py-16 md:py-20，卡片间距 gap-6。
- 导航：顶部 sticky 透明栏，桌面横向链接，移动端汉堡菜单。

## Components
- button-primary：bg-primary text-primary-foreground，圆角 md，hover 淡化。
- button-outline：border border-border，hover 转主色。
- card：bg-card border border-border rounded-lg，hover:border-primary hover:shadow-lg。
- accent-dot：朱砂红小圆点，用于 eyebrow 标签前。
- hairline：发丝引线，主色 25% 透明，用于分隔与强调。
- num-label：等宽数字编号，用于序号与日期。

## Do's and Don'ts
- 禁渐变文字、禁紫粉蓝激进渐变。
- 禁 emoji 作图标，一律用 lucide-react。
- 禁圆角卡片 + 左粗彩色 border accent。
- 禁大面积纯色铺底做核心视觉。
- 每个区块至少一处朱砂红点睛，但保持克制。