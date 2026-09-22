import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/layouts/Header";
import Footer from "@/components/layouts/Footer";
import ScrollManager from "@/components/common/ScrollManager";
import routes from "@/routes";

export default function App() {
  return (
    <AuthProvider>
      {/* basename 跟随构建 base：根路径部署（Vercel/本地）为 "/"，
          Gitee Pages 子路径部署（--base=/wencang-app/）为 "/wencang-app/" */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ScrollManager />
        <div className="flex min-h-screen w-full flex-col">
          <Header />
          <main className="flex-1 min-w-0">
            <Routes>
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}