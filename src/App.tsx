import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { HiveLayout } from "@/components/hive/HiveLayout";
import Landing from "@/pages/hive/Landing";
import Cockpit from "@/pages/hive/Cockpit";
import Screener from "@/pages/hive/Screener";
import HiveMap from "@/pages/hive/Map";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AdminModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<HiveLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/cockpit" element={<Cockpit />} />
              <Route path="/screener" element={<Screener />} />
              <Route path="/map" element={<HiveMap />} />
              <Route path="/report" element={<Landing />} />
              <Route path="/dashboard" element={<Landing />} />
              <Route path="/jurisdictions" element={<Landing />} />
              <Route path="/calculator" element={<Landing />} />
              <Route path="/admin" element={<Landing />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AdminModeProvider>
  </QueryClientProvider>
);

export default App;
