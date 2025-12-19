import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PipelineDocPanel } from "@/components/PipelineDocPanel";
import { ToolGovernanceCard } from "@/components/ToolGovernanceCard";
import { Pass0StatusPanel } from "@/components/Pass0StatusPanel";
import { Radio, Info } from "lucide-react";

/**
 * Pass0Hub - Read-Only Doctrine-Compliant UI
 * 
 * This component is an OBSERVER ONLY. It cannot trigger or modify
 * Pass 0 behavior in any way. All mutations are handled by backend
 * orchestration (Claude Code, scheduled jobs, etc.)
 * 
 * Data flow: Backend → UI (read-only)
 */
const Pass0Hub = () => {
  return (
    <div className="flex-1 bg-background">
      {/* Page Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <Radio className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground font-mono">Hub 0 — Radar Pipeline</h1>
                <p className="text-muted-foreground">Waterfall Intake • News → Permits → Geo Output</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
              Ephemeral / Cloud-Only
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Backend Control Notice */}
        <Alert className="bg-muted/50 border-border">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-muted-foreground">
            <span className="font-medium">Controls disabled</span> — This pipeline is managed by backend orchestration. 
            The UI displays status only and cannot trigger or modify Pass 0 behavior.
          </AlertDescription>
        </Alert>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Status Panel + Documentation */}
          <div className="col-span-8 space-y-6">
            {/* Read-Only Status Panel */}
            <Pass0StatusPanel />
            
            {/* Pipeline Documentation (read-only) */}
            <PipelineDocPanel passNumber={0} />
          </div>

          {/* Right Column: Governance */}
          <div className="col-span-4">
            <ToolGovernanceCard passNumber={0} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pass0Hub;
