import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SystemOverview from "@/pages/SystemOverview";
import Pass0Hub from "@/pages/hub/Pass0Hub";
import Pass0Dashboard from "@/pages/Pass0Dashboard";
import Pass0Intake from "@/pages/Pass0Intake";
import Pass1Hub from "@/pages/hub/Pass1Hub";
import Pass15Hub from "@/pages/hub/Pass15Hub";
import Pass2Hub from "@/pages/hub/Pass2Hub";
import Viability from "@/pages/Viability";
import NotFound from "@/pages/NotFound";

// Lazy load map to avoid react-leaflet React instance conflicts
const HiveMap = lazy(() => import("@/pages/hive/Map"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SystemOverview />} />
          <Route path="/solver" element={<Viability />} />
          <Route path="/viability" element={<Viability />} />
          <Route path="/hub/pass0" element={<Pass0Hub />} />
          <Route path="/pass0" element={<Pass0Dashboard />} />
          <Route path="/pass0/intake" element={<Pass0Intake />} />
          <Route path="/hub/pass1" element={<Pass1Hub />} />
          <Route path="/hub/pass15" element={<Pass15Hub />} />
          <Route path="/hub/pass2" element={<Pass2Hub />} />
          <Route path="/map" element={<Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading map...</div>}><HiveMap /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
