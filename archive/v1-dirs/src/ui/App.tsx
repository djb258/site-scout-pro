import { lazy, Suspense } from "react";
import { Toaster } from "@/ui/components/ui/toaster";
import { Toaster as Sonner } from "@/ui/components/ui/sonner";
import { TooltipProvider } from "@/ui/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/ui/components/AppLayout";
import DiscoverPage from "@/ui/pages/DiscoverPage";
import Pass0Hub from "@/ui/pages/hub/Pass0Hub";
import Pass1Hub from "@/ui/pages/hub/Pass1Hub";
import Pass15Hub from "@/ui/pages/hub/Pass15Hub";
import Pass2Hub from "@/ui/pages/hub/Pass2Hub";
import Pass3Hub from "@/ui/pages/hub/Pass3Hub";
import Pass4Hub from "@/ui/pages/hub/Pass4Hub";
import Pass5Hub from "@/ui/pages/hub/Pass5Hub";
import CCAReconHub from "@/ui/pages/hub/CCAReconHub";
import SVABuilderPage from "@/ui/pages/SVABuilderPage";
import SVADetailPage from "@/ui/pages/SVADetailPage";
import SVAListPage from "@/ui/pages/SVAListPage";
import Pass0RadarPage from "@/ui/pages/Pass0RadarPage";
import SupplyDiscoveryPage from "@/ui/pages/SupplyDiscoveryPage";
import ZipSupplyDetailPage from "@/ui/pages/ZipSupplyDetailPage";
import JurisdictionScopePage from "@/ui/pages/JurisdictionScopePage";
import CountyCardBuilderPage from "@/ui/pages/CountyCardBuilderPage";
import ERDViewerPage from "@/ui/pages/ERDViewerPage";
import NotFound from "@/ui/pages/NotFound";

// Lazy load map to avoid react-leaflet React instance conflicts
const HiveMap = lazy(() => import("@/ui/pages/hive/Map"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DiscoverPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/sva" element={<SVAListPage />} />
            <Route path="/sva/create" element={<SVABuilderPage />} />
            <Route path="/sva/:svaId" element={<SVADetailPage />} />
            <Route path="/pass0/radar/:svaId" element={<Pass0RadarPage />} />
            <Route path="/pass0" element={<Pass0Hub />} />
            <Route path="/pass1" element={<Pass1Hub />} />
            <Route path="/pass15" element={<Pass15Hub />} />
            <Route path="/pass2" element={<Pass2Hub />} />
            <Route path="/pass3" element={<Pass3Hub />} />
            <Route path="/pass4" element={<Pass4Hub />} />
            <Route path="/pass5" element={<Pass5Hub />} />
            <Route path="/cca" element={<CCAReconHub />} />
            <Route path="/supply" element={<SupplyDiscoveryPage />} />
            <Route path="/supply/zip/:zipCode" element={<ZipSupplyDetailPage />} />
            <Route path="/supply/jurisdictions" element={<JurisdictionScopePage />} />
            <Route path="/supply/jurisdictions/:countyFips" element={<CountyCardBuilderPage />} />
            <Route path="/erd-viewer" element={<ERDViewerPage />} />
            <Route path="/map" element={<Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading map...</div>}><HiveMap /></Suspense>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
