import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/layouts/Header";
import Footer from "@/components/layouts/Footer";
import routes from "@/routes";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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