import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Loader2, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pass2ConstraintCard } from "@/components/Pass2ConstraintCard";
import { Pass2MissingFields } from "@/components/Pass2MissingFields";
import { Pass2BlockedFields } from "@/components/Pass2BlockedFields";
import { Pass2Prohibitions } from "@/components/Pass2Prohibitions";
import { Pass2NextActions } from "@/components/Pass2NextActions";
import { Pass2SchemaStatus } from "@/components/Pass2SchemaStatus";

/**
 * Pass 2 — Constraint Compiler Hub
 * 
 * DOCTRINE: This is a COCKPIT, not an ENGINE.
 * - Triggers Pass 2 execution via Edge Function
 * - Fetches Pass 2 results from Neon (via Edge Function relay)
 * - Displays constraint status and gaps
 * - Guides manual research
 * 
 * HARD RESTRICTIONS:
 * - No constraint logic
 * - No geometry or economics computation
 * - No guessing missing values
 * - No modifying jurisdiction cards
 * - No overriding Neon outputs
 * 
 * @version v2.0.0 · DOCTRINE LOCKED
 */

interface Pass2Response {
  status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO' | 'SCHEMA_INCOMPLETE';
  jurisdiction_card_complete: boolean;
  missing_required_fields: string[];
  blocked_fields: string[];
  fatal_prohibitions: string[];
  county_capability: {
    automation_viable: boolean;
    permit_system: string;
    zoning_model: string;
    county_name: string;
    state: string;
  } | null;
  next_actions: string[];
  zip_metadata: {
    zip: string;
    city: string | null;
    county: string | null;
    state: string | null;
    population: number | null;
  } | null;
  schema_status: {
    jurisdiction_cards_exists: boolean;
    jurisdiction_constraints_exists: boolean;
    jurisdiction_prohibitions_exists: boolean;
    ref_county_capability_exists: boolean;
  };
  timestamp: string;
}

const Pass2Hub = () => {
  const [zip, setZip] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Pass2Response | null>(null);

  const runConstraintCheck = async () => {
    if (!zip || zip.length !== 5) {
      toast.error("Please enter a valid 5-digit ZIP code");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('start_pass2', {
        body: { zip, asset_class: 'self_storage' },
      });

      if (error) {
        throw error;
      }

      setResult(data as Pass2Response);
      
      if (data.status === 'ELIGIBLE') {
        toast.success("Site is eligible for Pass 3");
      } else if (data.status === 'NO_GO') {
        toast.error("Site has fatal prohibitions");
      } else if (data.status === 'HOLD_INCOMPLETE') {
        toast.warning("Missing required data - research needed");
      } else {
        toast.info("Schema incomplete - check Neon tables");
      }
    } catch (error) {
      console.error('[Pass2Hub] Error:', error);
      toast.error("Failed to run constraint check");
    } finally {
      setIsLoading(false);
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
            <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
              <FileCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">Pass 2 — Constraint Compiler</h1>
                <Badge variant="outline" className="font-mono text-xs">v2.0.0 · FROZEN</Badge>
              </div>
              <p className="text-muted-foreground">Jurisdiction constraint validation • Neon relay only</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Doctrine Banner */}
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="secondary" className="font-mono">DOCTRINE</Badge>
              <span className="text-muted-foreground">
                Lovable.dev explains reality; it does not improve it. • No computation • No inference • No guessing
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Input & Status */}
          <div className="space-y-6">
            {/* ZIP Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Constraint Check
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zip">Target ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="e.g., 15522"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    maxLength={5}
                    className="font-mono"
                  />
                </div>
                <Button 
                  onClick={runConstraintCheck} 
                  disabled={isLoading || zip.length !== 5}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking Neon...
                    </>
                  ) : (
                    'Run Constraint Check'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Constraint Status Card */}
            <Pass2ConstraintCard
              status={result?.status || null}
              jurisdictionCardComplete={result?.jurisdiction_card_complete ?? false}
              countyCapability={result?.county_capability || null}
              zipMetadata={result?.zip_metadata || null}
            />

            {/* Schema Status */}
            <Pass2SchemaStatus schemaStatus={result?.schema_status || null} />
          </div>

          {/* Middle Column - Issues */}
          <div className="space-y-6">
            {/* Fatal Prohibitions (always first if present) */}
            <Pass2Prohibitions prohibitions={result?.fatal_prohibitions || []} />
            
            {/* Missing Fields */}
            <Pass2MissingFields missingFields={result?.missing_required_fields || []} />
            
            {/* Blocked Fields */}
            <Pass2BlockedFields blockedFields={result?.blocked_fields || []} />
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Next Actions */}
            <Pass2NextActions actions={result?.next_actions || []} />

            {/* Pass 3 Navigation (only if eligible) */}
            {result?.status === 'ELIGIBLE' && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-base text-green-500">Ready for Pass 3</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    All constraints validated. Site is eligible for detailed pro forma analysis.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/hub/pass3">
                      Proceed to Pass 3 →
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Timestamp */}
            {result?.timestamp && (
              <div className="text-xs text-muted-foreground text-center">
                Last checked: {new Date(result.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Pass2Hub;
