import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, User as UserIcon, LogOut, LayoutGrid, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserRole, type UserRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "纹样图库", path: "/patterns" },
  { label: "AI纹样工坊", path: "/workshop" },
  { label: "守艺人展厅", path: "/artisans" },
  { label: "体验预约", path: "/booking" },
  { label: "文创商城", path: "/shop" },
];

export default function Header() {
  const { session, username, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("user");

  /* 「运营后台」入口只对管理员出现；会话变化（登录/退出）时重新判定，不依赖手动刷新 */
  useEffect(() => {
    if (!session) {
      setRole("user");
      return;
    }
    let active = true;
    fetchUserRole(session.user.id, session.user.email).then((r) => {
      if (active) setRole(r);
    });
    return () => {
      active = false;
    };
  }, [session]);

  const isAdmin = role === "admin";
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-serif-cn text-lg font-bold">
            纹
          </span>
          <span className="font-serif-cn text-xl font-bold tracking-wide text-primary">纹藏</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "num-label text-sm transition-colors hover:text-primary",
                isActive(item.path) ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="max-w-24 truncate">{username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    个人中心
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      运营后台
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">登录 / 注册</Link>
            </Button>
          )}
        </div>

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-primary">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <SheetTitle className="font-serif-cn text-lg text-primary">导航菜单</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center rounded-md px-3 text-sm transition-colors",
                      isActive(item.path) ? "bg-secondary text-primary font-semibold" : "text-foreground hover:bg-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="my-3 hairline" />
                {session ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center rounded-md px-3 text-sm text-foreground hover:bg-muted"
                    >
                      个人中心
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setOpen(false)}
                        className="flex min-h-12 items-center gap-2 rounded-md px-3 text-sm text-foreground hover:bg-muted"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        运营后台
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setOpen(false);
                        signOut();
                      }}
                      className="flex min-h-12 items-center rounded-md px-3 text-sm text-destructive hover:bg-muted"
                    >
                      退出登录
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                  >
                    登录 / 注册
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}