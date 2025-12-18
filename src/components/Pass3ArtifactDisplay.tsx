import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, TrendingUp, Building2, Scale, AlertTriangle, Lock } from "lucide-react";

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

interface Pass3ArtifactDisplayProps {
  artifactId: string;
  zip: string | null;
  artifactData: ArtifactData;
  artifactValid: boolean;
  validationErrors: string[];
}

const formatNumber = (num: number | null): string => {
  if (num === null) return '—';
  return num.toLocaleString();
};

const formatCurrency = (num: number | null): string => {
  if (num === null) return '—';
  return `$${num.toFixed(2)}`;
};

export function Pass3ArtifactDisplay({
  artifactId,
  zip,
  artifactData,
  artifactValid,
  validationErrors,
}: Pass3ArtifactDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <Card className="border-2 border-muted bg-muted/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Immutable Artifact Data</CardTitle>
            </div>
            <Badge variant={artifactValid ? "default" : "destructive"}>
              {artifactValid ? "Valid" : "Incomplete"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Read-only · No edits allowed · Source: Pass 1 → 1.5 → 2
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Artifact ID:</span>{" "}
              <code className="text-xs bg-muted px-1 rounded">{artifactId.slice(0, 12)}...</code>
            </div>
            <div>
              <span className="text-muted-foreground">ZIP:</span>{" "}
              <span className="font-medium">{zip || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm text-destructive">Validation Issues</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="text-sm space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i} className="text-destructive/80">• {err}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pass 1 Data */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm">Pass 1 — Market Sizing</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Demand Gap</p>
              <p className="font-medium">{formatNumber(artifactData.pass1_demand_gap_sqft)} sqft</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Existing Supply</p>
              <p className="font-medium">{formatNumber(artifactData.pass1_supply_sqft)} sqft</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Population</p>
              <p className="font-medium">{formatNumber(artifactData.pass1_population)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">ZIP Count</p>
              <p className="font-medium">{formatNumber(artifactData.pass1_zip_count)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pass 1.5 Data */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">Pass 1.5 — Rent Benchmarks</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Low Rent (10×10)</p>
              <p className="font-medium">{formatCurrency(artifactData.pass15_rent_low)}/mo</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Medium Rent</p>
              <p className="font-medium">{formatCurrency(artifactData.pass15_rent_medium)}/mo</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">High Rent</p>
              <p className="font-medium">{formatCurrency(artifactData.pass15_rent_high)}/mo</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Confidence</p>
              <Badge variant="outline" className="text-xs">
                {artifactData.pass15_confidence || 'N/A'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pass 2 Data */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Pass 2 — Constraints & Feasibility</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge 
                variant={
                  artifactData.pass2_status === 'ELIGIBLE' ? 'default' :
                  artifactData.pass2_status === 'HOLD_INCOMPLETE' ? 'secondary' :
                  'destructive'
                }
              >
                {artifactData.pass2_status || 'UNKNOWN'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Feasibility</p>
              <Badge variant={artifactData.pass2_feasibility_flag ? "default" : "secondary"}>
                {artifactData.pass2_feasibility_flag ? "Viable" : "Not Viable"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">DSCR</p>
              <p className="font-medium">
                {artifactData.pass2_dscr ? artifactData.pass2_dscr.toFixed(2) : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Zoning</p>
              <Badge variant="outline" className="text-xs">
                {artifactData.pass2_zoning_status || 'N/A'}
              </Badge>
            </div>
          </div>

          {/* Prohibitions */}
          {artifactData.pass2_prohibitions.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-destructive font-medium mb-1">Fatal Prohibitions</p>
                <ul className="text-xs space-y-1">
                  {artifactData.pass2_prohibitions.map((p, i) => (
                    <li key={i} className="text-destructive/80">🚫 {p}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Missing Fields */}
          {artifactData.pass2_missing_fields.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-amber-600 font-medium mb-1">Missing Fields</p>
                <ul className="text-xs space-y-1">
                  {artifactData.pass2_missing_fields.map((f, i) => (
                    <li key={i} className="text-amber-600/80">⚠ {f}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
