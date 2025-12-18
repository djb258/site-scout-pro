// ============================================================================
// PASS 1 — MARKET SIZING PIPELINE CARD (FROZEN)
// DOCTRINE LOCKED — v1.0.0
// Read-only display, no mutations, no controls
// ============================================================================

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Lock, Circle, CheckCircle2, XCircle, Database } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================
interface RadiusData {
  zipCount: number;
  originZip: string;
}

interface CensusData {
  zipCount: number;
  vintageYear: number;
}

interface DemandData {
  totalSqft: number;
  bands: Array<{
    band: string;
    population: number;
    demandSqft: number;
  }>;
}

interface SupplySnapshotData {
  facilityCount: number;
  source: string;
  confidence: "low" | "medium";
}

interface SupplyGapData {
  netGapSqft: number;
  bands: Array<{
    band: string;
    demandSqft: number;
    supplySqft: number;
    gapSqft: number;
    confidence: "low" | "medium";
  }>;
}

interface Pass1PipelineCardProps {
  runId: string | null;
  radiusData: RadiusData | null;
  censusData: CensusData | null;
  demandData: DemandData | null;
  supplySnapshotData: SupplySnapshotData | null;
  supplyGapData: SupplyGapData | null;
  error: string | null;
  isRunning: boolean;
}

// ============================================================================
// STATUS HELPERS
// ============================================================================
type StepStatus = "completed" | "failed" | "not_run" | "running";

const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case "completed":
      return <span className="text-emerald-500">🟢</span>;
    case "failed":
      return <span className="text-red-500">🔴</span>;
    case "not_run":
      return <span className="text-muted-foreground">⚪</span>;
    case "running":
      return <span className="text-amber-500 animate-pulse">🟡</span>;
  }
};

const getStatusLabel = (status: StepStatus) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "not_run":
      return "Not Run";
    case "running":
      return "Running";
  }
};

// ============================================================================
// COMPONENT
// ============================================================================
export const Pass1PipelineCard = ({
  runId,
  radiusData,
  censusData,
  demandData,
  supplySnapshotData,
  supplyGapData,
  error,
  isRunning,
}: Pass1PipelineCardProps) => {
  // Derive step statuses
  const getRadiusStatus = (): StepStatus => {
    if (!runId) return "not_run";
    if (isRunning && !radiusData) return "running";
    if (error && !radiusData) return "failed";
    if (radiusData) return "completed";
    return "not_run";
  };

  const getCensusStatus = (): StepStatus => {
    if (!runId || getRadiusStatus() !== "completed") return "not_run";
    if (isRunning && !censusData) return "running";
    if (error && !censusData) return "failed";
    if (censusData) return "completed";
    return "not_run";
  };

  const getDemandStatus = (): StepStatus => {
    if (!runId || getCensusStatus() !== "completed") return "not_run";
    if (isRunning && !demandData) return "running";
    if (error && !demandData) return "failed";
    if (demandData) return "completed";
    return "not_run";
  };

  const getSupplySnapshotStatus = (): StepStatus => {
    if (!runId || getDemandStatus() !== "completed") return "not_run";
    // Supply is optional - check if it was run
    if (supplySnapshotData) return "completed";
    if (error && !supplySnapshotData && supplyGapData === null) return "failed";
    return "not_run";
  };

  const getSupplyGapStatus = (): StepStatus => {
    if (!runId || getDemandStatus() !== "completed") return "not_run";
    // Gap requires both demand and supply
    if (!supplySnapshotData) return "not_run";
    if (supplyGapData) return "completed";
    if (error) return "failed";
    return "not_run";
  };

  const radiusStatus = getRadiusStatus();
  const censusStatus = getCensusStatus();
  const demandStatus = getDemandStatus();
  const supplySnapshotStatus = getSupplySnapshotStatus();
  const supplyGapStatus = getSupplyGapStatus();

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-500" />
            Pass 1 — Market Sizing Pipeline
            <Badge variant="outline" className="text-xs border-muted-foreground/30 ml-2">
              <Lock className="h-3 w-3 mr-1" />
              Frozen
            </Badge>
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Directional analysis only · No scoring · No decisions
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <Accordion type="multiple" className="w-full">
          {/* Step 1: Radius Builder */}
          <AccordionItem value="radius" className="border-border/50">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3 text-sm">
                {getStatusIcon(radiusStatus)}
                <span className="font-medium">Radius (120 mi)</span>
                {radiusStatus === "completed" && radiusData && (
                  <Badge variant="secondary" className="text-xs ml-auto mr-2">
                    {radiusData.zipCount} ZIPs
                  </Badge>
                )}
                {radiusStatus === "failed" && (
                  <Badge variant="destructive" className="text-xs ml-auto mr-2">
                    Error
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="pl-7 space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Source:</span> hub1_pass1_radius</p>
                {radiusData && (
                  <>
                    <p><span className="font-medium text-foreground">Origin ZIP:</span> {radiusData.originZip}</p>
                    <p><span className="font-medium text-foreground">Radius:</span> 120 miles</p>
                    <p><span className="font-medium text-foreground">ZIPs included:</span> {radiusData.zipCount}</p>
                  </>
                )}
                <p><span className="font-medium text-foreground">Output:</span> pass1_radius_zip</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 2: Census Snapshot */}
          <AccordionItem value="census" className="border-border/50">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3 text-sm">
                {getStatusIcon(censusStatus)}
                <span className="font-medium">Census Snapshot</span>
                {censusStatus === "completed" && censusData && (
                  <Badge variant="secondary" className="text-xs ml-auto mr-2">
                    {censusData.zipCount} ZIPs · {censusData.vintageYear}
                  </Badge>
                )}
                {censusStatus === "failed" && (
                  <Badge variant="destructive" className="text-xs ml-auto mr-2">
                    Hard Gate
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="pl-7 space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Source:</span> hub1_pass1_census</p>
                {censusData && (
                  <>
                    <p><span className="font-medium text-foreground">Vintage Year:</span> {censusData.vintageYear}</p>
                    <p><span className="font-medium text-foreground">ZIPs snapshotted:</span> {censusData.zipCount}</p>
                  </>
                )}
                <p><span className="font-medium text-foreground">Output:</span> pass1_census_snapshot</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 3: Demand Math */}
          <AccordionItem value="demand" className="border-border/50">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3 text-sm">
                {getStatusIcon(demandStatus)}
                <span className="font-medium">Baseline Demand</span>
                {demandStatus === "completed" && demandData && (
                  <Badge variant="secondary" className="text-xs ml-auto mr-2">
                    {demandData.totalSqft.toLocaleString()} sqft
                  </Badge>
                )}
                {demandStatus === "failed" && (
                  <Badge variant="destructive" className="text-xs ml-auto mr-2">
                    Hard Gate
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="pl-7 space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Source:</span> hub1_pass1_demand</p>
                <p><span className="font-medium text-foreground">Formula:</span> population × 6 sqft</p>
                <p><span className="font-medium text-foreground">Bands:</span> 0–30 / 30–60 / 60–120</p>
                {demandData && demandData.bands.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {demandData.bands.map((band) => (
                      <div key={band.band} className="flex justify-between font-mono text-xs">
                        <span>{band.band} mi</span>
                        <span>{band.demandSqft.toLocaleString()} sqft</span>
                      </div>
                    ))}
                  </div>
                )}
                <p><span className="font-medium text-foreground">Output:</span> pass1_demand_agg</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 4: Supply Snapshot (Optional) */}
          <AccordionItem value="supply-snapshot" className="border-border/50">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3 text-sm">
                {getStatusIcon(supplySnapshotStatus)}
                <span className="font-medium">Existing Supply</span>
                {supplySnapshotStatus === "not_run" && (
                  <Badge variant="outline" className="text-xs ml-auto mr-2 text-muted-foreground">
                    Optional / Not Executed
                  </Badge>
                )}
                {supplySnapshotStatus === "completed" && supplySnapshotData && (
                  <Badge variant="secondary" className="text-xs ml-auto mr-2">
                    {supplySnapshotData.facilityCount} facilities
                  </Badge>
                )}
                {supplySnapshotStatus === "failed" && (
                  <Badge variant="destructive" className="text-xs ml-auto mr-2">
                    Supply Gate
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="pl-7 space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Source:</span> hub1_pass1_supply</p>
                {supplySnapshotData && (
                  <>
                    <p><span className="font-medium text-foreground">Data Source:</span> {supplySnapshotData.source}</p>
                    <p><span className="font-medium text-foreground">Confidence:</span> {supplySnapshotData.confidence} only</p>
                  </>
                )}
                <p><span className="font-medium text-foreground">Output:</span> pass1_supply_snapshot</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Step 5: Supply Gap */}
          <AccordionItem value="supply-gap" className="border-b-0">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3 text-sm">
                {getStatusIcon(supplyGapStatus)}
                <span className="font-medium">Demand − Supply Gap</span>
                {supplyGapStatus === "not_run" && (
                  <Badge variant="outline" className="text-xs ml-auto mr-2 text-muted-foreground">
                    Supply not computed
                  </Badge>
                )}
                {supplyGapStatus === "completed" && supplyGapData && (
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ml-auto mr-2 ${supplyGapData.netGapSqft >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {supplyGapData.netGapSqft >= 0 ? "+" : ""}{supplyGapData.netGapSqft.toLocaleString()} sqft
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="pl-7 space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Derived From:</span> pass1_demand_agg + pass1_supply_agg</p>
                <p><span className="font-medium text-foreground">Formula:</span> baseline_demand − supply_sqft</p>
                <p><span className="font-medium text-foreground">Note:</span> Negative allowed (oversupply)</p>
                {supplyGapData && supplyGapData.bands.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {supplyGapData.bands.map((band) => (
                      <div key={band.band} className="flex justify-between font-mono text-xs">
                        <span>{band.band} mi</span>
                        <span className={band.gapSqft >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {band.gapSqft >= 0 ? "+" : ""}{band.gapSqft.toLocaleString()} sqft
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p><span className="font-medium text-foreground">Output:</span> pass1_supply_agg</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>

      <CardFooter className="pt-0 border-t border-border/50 mt-2">
        <div className="w-full pt-3 space-y-1 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Pass 1 Purpose:</span> Directional market sizing</p>
          <p><span className="font-medium text-foreground">Non-Goals:</span> pricing, competition scoring, pass/fail decisions</p>
          <p><span className="font-medium text-foreground">Next Stage:</span> Pass 2 — Site-level feasibility</p>
        </div>
      </CardFooter>
    </Card>
  );
};

export default Pass1PipelineCard;
