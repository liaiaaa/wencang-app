import type { ReactNode } from "react";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import PatternsPage from "@/pages/PatternsPage";
import PatternDetailPage from "@/pages/PatternDetailPage";
import WorkshopPage from "@/pages/WorkshopPage";
import ArtisansPage from "@/pages/ArtisansPage";
import ArtisanDetailPage from "@/pages/ArtisanDetailPage";
import BookingPage from "@/pages/BookingPage";
import ShopPage from "@/pages/ShopPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminBookingsPage from "@/pages/AdminBookingsPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
  children?: RouteConfig[];
}

const routes: RouteConfig[] = [
  { name: "首页", path: "/", element: <HomePage /> },
  { name: "登录", path: "/login", element: <LoginPage /> },
  { name: "纹样图库", path: "/patterns", element: <PatternsPage /> },
  { name: "纹样详情", path: "/patterns/:id", element: <PatternDetailPage /> },
  { name: "AI纹样工坊", path: "/workshop", element: <WorkshopPage /> },
  { name: "守艺人展厅", path: "/artisans", element: <ArtisansPage /> },
  { name: "守艺人详情", path: "/artisans/:id", element: <ArtisanDetailPage /> },
  { name: "体验预约", path: "/booking", element: <BookingPage /> },
  { name: "文创商城", path: "/shop", element: <ShopPage /> },
  { name: "商品详情", path: "/shop/:id", element: <ProductDetailPage /> },
  { name: "个人中心", path: "/profile", element: <ProfilePage /> },
  { name: "预约管理", path: "/admin/bookings", element: <AdminBookingsPage /> },
  { name: "运营后台", path: "/admin", element: <AdminDashboardPage /> },
];

export default routes;
export { routes };