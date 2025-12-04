import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { HiveLayout } from "@/components/hive/HiveLayout";
import Landing from "@/pages/hive/Landing";
import Cockpit from "@/pages/hive/Cockpit";
import Screener from "@/pages/hive/Screener";
import HiveMap from "@/pages/hive/Map";
import NotFound from "./pages/NotFound";
import EngineHome from "./pages/engine/Home";
import EngineScreener from "./pages/engine/Screener";
import Pass1Results from "./pages/engine/Pass1Results";
import Pass2Results from "./pages/engine/Pass2Results";
import Vault from "./pages/engine/Vault";
import VaultDeepDive from "./pages/engine/VaultDeepDive";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AdminModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Engine Routes (Primary) */}
            <Route path="/" element={<Navigate to="/engine" replace />} />
            <Route path="/engine" element={<EngineHome />} />
            <Route path="/engine/screener" element={<EngineScreener />} />
            <Route path="/engine/pass1/:runId" element={<Pass1Results />} />
            <Route path="/engine/pass2/:runId" element={<Pass2Results />} />
            <Route path="/engine/vault" element={<Vault />} />
            <Route path="/engine/vault/:id" element={<VaultDeepDive />} />
            
            {/* Hive UI Routes */}
            <Route element={<HiveLayout />}>
              <Route path="/hive" element={<Landing />} />
              <Route path="/hive/cockpit" element={<Cockpit />} />
              <Route path="/hive/screener" element={<Screener />} />
              <Route path="/hive/map" element={<HiveMap />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AdminModeProvider>
  </QueryClientProvider>
);

export default App;
