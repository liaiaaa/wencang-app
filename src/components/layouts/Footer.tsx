import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-serif-cn text-lg font-bold">
                纹
              </span>
              <span className="font-serif-cn text-xl font-bold text-primary">纹藏</span>
            </div>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              纹藏致力于蜡染、扎染、苗绣等非物质文化遗产的数字化记录、传承与创新推广，让每一道纹样都被看见。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="num-label text-xs font-semibold uppercase tracking-wider text-primary">探索</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/patterns" className="hover:text-primary">纹样图库</Link></li>
                <li><Link to="/workshop" className="hover:text-primary">AI纹样工坊</Link></li>
                <li><Link to="/artisans" className="hover:text-primary">守艺人展厅</Link></li>
              </ul>
            </div>
            <div>
              <p className="num-label text-xs font-semibold uppercase tracking-wider text-primary">体验</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/booking" className="hover:text-primary">体验预约</Link></li>
                <li><Link to="/shop" className="hover:text-primary">文创商城</Link></li>
                <li><Link to="/profile" className="hover:text-primary">个人中心</Link></li>
              </ul>
            </div>
            <div>
              <p className="num-label text-xs font-semibold uppercase tracking-wider text-primary">关于</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>数字化传承</li>
                <li>守艺人连接</li>
                <li>文创创新</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 hairline" />
        <p className="mt-6 text-xs text-muted-foreground">© 2026 纹藏 · 非遗染织刺绣数字平台</p>
      </div>
    </footer>
  );
}