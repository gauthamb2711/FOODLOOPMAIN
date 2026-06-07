import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import LandingPage from "./pages/LandingPage";
import CanteenLogin from "./pages/CanteenLogin";
import NgoLogin from "./pages/NgoLogin";
import CanteenRegister from "./pages/CanteenRegister";
import NgoRegister from "./pages/NgoRegister";
import CanteenDashboard from "./pages/CanteenDashboard";
import NgoDashboard from "./pages/NgoDashboard";
import NotFound from "./pages/NotFound";

import { initSeedData } from "./lib/store";
import { useEffect } from "react";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    initSeedData();

    // One-time migration: backfill expiresAt for any old items that are missing it
    const allSurplus = JSON.parse(localStorage.getItem('surplusFood') || '[]');
    let needsSave = false;
    const migrated = allSurplus.map((s: any) => {
      if (!s.expiresAt && s.expiryTime && s.createdAt) {
        const createdAt = new Date(s.createdAt);
        const [h, m] = s.expiryTime.split(':').map(Number);
        const expiry = new Date(createdAt);
        expiry.setHours(h, m, 0, 0);
        if (expiry <= createdAt) expiry.setDate(expiry.getDate() + 1);
        needsSave = true;
        return { ...s, expiresAt: expiry.toISOString() };
      }
      return s;
    });
    if (needsSave) {
      localStorage.setItem('surplusFood', JSON.stringify(migrated));
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner richColors position="top-right" />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/canteen/login" element={<CanteenLogin />} />
            <Route path="/ngo/login" element={<NgoLogin />} />
            <Route path="/canteen/register" element={<CanteenRegister />} />
            <Route path="/ngo/register" element={<NgoRegister />} />
            <Route path="/canteen" element={<CanteenDashboard />} />
            <Route path="/ngo" element={<NgoDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
