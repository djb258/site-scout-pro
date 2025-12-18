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
import { Pass3ArtifactDisplay } from "@/components/Pass3ArtifactDisplay";
import { Pass3DecisionForm } from "@/components/Pass3DecisionForm";
import { Pass3DecisionRecord } from "@/components/Pass3DecisionRecord";

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
        title: "Decision Recorded", 
        description: `${decision.decision} decision saved with ID: ${data.pass3_run_id.slice(0, 12)}...` 
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
        <div className="container mx-auto px-6 py-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">Pass 3 — Decision Shell</h1>
                <Badge variant="outline">Commitment</Badge>
              </div>
              <p className="text-muted-foreground">No math · No recalculation · Decision only</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Doctrine Banner */}
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Pass 3 Doctrine: Cockpit Only
                </p>
                <p className="text-muted-foreground mt-1">
                  This shell consumes immutable artifacts from Pass 1, 1.5, and 2.
                  No numeric fields are editable. Decision parameters only.
                  Rationale is required — no silent approvals.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Input & Artifact Display */}
          <div className="space-y-6">
            {/* Artifact Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Load Artifact</CardTitle>
                <CardDescription>
                  Enter a compiled artifact ID from upstream passes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Artifact ID *</Label>
                  <Input
                    value={artifactId}
                    onChange={(e) => setArtifactId(e.target.value)}
                    placeholder="e.g., zip_run_id or pass2_result_id"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ZIP (optional)</Label>
                  <Input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="e.g., 15522"
                    maxLength={5}
                  />
                </div>
                <Button 
                  onClick={fetchArtifact} 
                  disabled={loading || !artifactId.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    "Fetch Artifact"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Artifact Display */}
            {artifactResponse && (
              <Pass3ArtifactDisplay
                artifactId={artifactResponse.artifact_id}
                zip={artifactResponse.zip}
                artifactData={artifactResponse.artifact_data}
                artifactValid={artifactResponse.artifact_valid}
                validationErrors={artifactResponse.validation_errors}
              />
            )}
          </div>

          {/* Right Column: Decision Form & Record */}
          <div className="space-y-6">
            {/* Decision Form */}
            {artifactResponse && !decisionRecord && (
              <Pass3DecisionForm
                artifactValid={artifactResponse.artifact_valid}
                onSubmit={submitDecision}
                isSubmitting={submitting}
              />
            )}

            {/* Decision Record */}
            {artifactResponse && (
              <Pass3DecisionRecord
                decision={decisionRecord}
                previousDecisions={artifactResponse.previous_decisions}
              />
            )}

            {/* Empty State */}
            {!artifactResponse && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No Artifact Loaded</p>
                  <p className="text-sm mt-1">
                    Enter an artifact ID to view upstream data and record a decision
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pass3Hub;
