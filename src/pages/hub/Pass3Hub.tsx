import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileCheck, Loader2, AlertTriangle, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Pass3PipelineCard } from "@/components/Pass3PipelineCard";

interface ArtifactData {
  pass1_demand_gap_sqft: number | null;
  pass1_supply_sqft: number | null;
  pass1_population: number | null;
  pass1_zip_count: number | null;
  pass15_rent_low: number | null;
  pass15_rent_medium: number | null;
  pass15_rent_high: number | null;
  pass15_confidence: string | null;
  pass2_status: string | null;
  pass2_feasibility_flag: boolean | null;
  pass2_dscr: number | null;
  pass2_zoning_status: string | null;
  pass2_civil_status: string | null;
  pass2_prohibitions: string[];
  pass2_missing_fields: string[];
}

interface ArtifactResponse {
  artifact_id: string;
  zip: string | null;
  artifact_data: ArtifactData;
  artifact_valid: boolean;
  validation_errors: string[];
  previous_decisions: Array<{
    run_id: string;
    decision: string;
    created_at: string;
    status: string;
  }>;
}

interface DecisionRecord {
  pass3_run_id: string;
  artifact_id: string;
  zip: string;
  decision: 'GO' | 'HOLD' | 'NO_GO';
  phase_scope: string;
  timing_intent: string;
  confidence_class: string;
  rationale: string;
  lifecycle_status: string;
  created_at: string;
  payload_for_neon: object;
}

const Pass3Hub = () => {
  const [artifactId, setArtifactId] = useState("");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [artifactResponse, setArtifactResponse] = useState<ArtifactResponse | null>(null);
  const [decisionRecord, setDecisionRecord] = useState<DecisionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchArtifact = async () => {
    if (!artifactId.trim()) {
      toast({ title: "Artifact ID required", variant: "destructive" });
      return;
    }

    setLoading(true);
    setError(null);
    setArtifactResponse(null);
    setDecisionRecord(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('start_pass3', {
        body: {
          action: 'fetch_artifact',
          artifact_id: artifactId.trim(),
          zip: zip.trim() || undefined,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setArtifactResponse(data);
      if (zip.trim() === '' && data.zip) {
        setZip(data.zip);
      }

      toast({ title: "Artifact loaded", description: `Valid: ${data.artifact_valid}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch artifact';
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitDecision = async (decision: {
    decision: 'GO' | 'HOLD' | 'NO_GO';
    phase_scope: string;
    timing_intent: string;
    confidence_class: string;
    rationale: string;
  }) => {
    if (!artifactResponse) return;

    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('start_pass3', {
        body: {
          action: 'submit_decision',
          artifact_id: artifactResponse.artifact_id,
          zip: artifactResponse.zip || zip.trim(),
          ...decision,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setDecisionRecord(data);
      toast({ 
        title: "Decision Committed", 
        description: `${decision.decision} recorded: ${data.pass3_run_id.slice(0, 12)}...` 
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit decision';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <Button variant="ghost" asChild className="mb-2">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Pass 3 — Decision Pipeline</h1>
                <Badge variant="outline">Commitment</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Inputs → Locks → Decision → Memory</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Doctrine Banner */}
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Pass 3 Doctrine: Courtroom, Not Spreadsheet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  No numeric fields editable · Decision only · Rationale required · Supersede-only lifecycle
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Artifact Loader */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Load Artifact</CardTitle>
            <CardDescription className="text-xs">
              Enter a compiled artifact ID from upstream passes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Artifact ID *</Label>
                <Input
                  value={artifactId}
                  onChange={(e) => setArtifactId(e.target.value)}
                  placeholder="e.g., zip_run_id or pass2_result_id"
                  className="h-9"
                />
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs">ZIP</Label>
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="15522"
                  maxLength={5}
                  className="h-9"
                />
              </div>
              <Button 
                onClick={fetchArtifact} 
                disabled={loading || !artifactId.trim()}
                className="h-9"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Fetch"
                )}
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm mt-3">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline View */}
        {artifactResponse ? (
          <Pass3PipelineCard
            artifactData={artifactResponse.artifact_data}
            artifactId={artifactResponse.artifact_id}
            zip={artifactResponse.zip || zip}
            artifactValid={artifactResponse.artifact_valid}
            validationErrors={artifactResponse.validation_errors}
            onDecisionSubmit={submitDecision}
            decisionRecord={decisionRecord}
            isSubmitting={submitting}
            previousDecisions={artifactResponse.previous_decisions}
          />
        ) : (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">No Artifact Loaded</p>
              <p className="text-sm mt-1">
                Enter an artifact ID above to view the decision pipeline
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Pass3Hub;
