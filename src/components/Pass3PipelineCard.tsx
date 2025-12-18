import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  FileCheck,
  Shield,
  AlertTriangle,
  Hash
} from "lucide-react";

// Types
type DecisionType = 'GO' | 'HOLD' | 'NO_GO';
type PhaseScope = 'PHASE_1_ONLY' | 'FULL_BUILD' | 'LAND_BANK';
type TimingIntent = 'IMMEDIATE' | 'WITHIN_6_MO' | 'WITHIN_12_MO' | 'OPPORTUNISTIC';
type ConfidenceClass = 'HIGH' | 'MEDIUM' | 'LOW';

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

interface DecisionRecord {
  pass3_run_id: string;
  artifact_id: string;
  zip: string;
  decision: DecisionType;
  phase_scope: string;
  timing_intent: string;
  confidence_class: string;
  rationale: string;
  lifecycle_status: string;
  created_at: string;
  payload_for_neon: object;
}

interface Pass3PipelineProps {
  artifactData: ArtifactData | null;
  artifactId: string;
  zip: string;
  artifactValid: boolean;
  validationErrors: string[];
  onDecisionSubmit: (decision: {
    decision: DecisionType;
    phase_scope: PhaseScope;
    timing_intent: TimingIntent;
    confidence_class: ConfidenceClass;
    rationale: string;
  }) => void;
  decisionRecord: DecisionRecord | null;
  isSubmitting: boolean;
  previousDecisions?: Array<{
    run_id: string;
    decision: string;
    created_at: string;
    status: string;
  }>;
}

const formatNumber = (num: number | null): string => {
  if (num === null) return '—';
  return num.toLocaleString();
};

const formatCurrency = (num: number | null): string => {
  if (num === null) return '—';
  return `$${num.toFixed(2)}`;
};

// Gate computation (no math, just boolean checks)
const computeGates = (data: ArtifactData | null) => {
  if (!data) {
    return {
      demand_gate: { pass: false, reason: 'No artifact data' },
      rent_gate: { pass: false, reason: 'No artifact data' },
      feasibility_gate: { pass: false, reason: 'No artifact data' },
      phase1_gate: { pass: false, reason: 'No artifact data' },
    };
  }

  return {
    demand_gate: {
      pass: (data.pass1_demand_gap_sqft ?? 0) > 0,
      reason: (data.pass1_demand_gap_sqft ?? 0) > 0 
        ? `Gap: ${formatNumber(data.pass1_demand_gap_sqft)} sqft`
        : 'No demand gap detected'
    },
    rent_gate: {
      pass: data.pass15_confidence !== null && data.pass15_confidence !== 'LOW',
      reason: data.pass15_confidence 
        ? `Confidence: ${data.pass15_confidence}`
        : 'No rent data available'
    },
    feasibility_gate: {
      pass: data.pass2_feasibility_flag === true,
      reason: data.pass2_feasibility_flag === true 
        ? 'Feasibility passed'
        : data.pass2_feasibility_flag === false 
          ? 'Feasibility failed'
          : 'Feasibility not evaluated'
    },
    phase1_gate: {
      pass: (data.pass2_dscr ?? 0) >= 1.0,
      reason: data.pass2_dscr !== null 
        ? `DSCR: ${data.pass2_dscr.toFixed(2)}`
        : 'DSCR not calculated'
    },
  };
};

export function Pass3PipelineCard({
  artifactData,
  artifactId,
  zip,
  artifactValid,
  validationErrors,
  onDecisionSubmit,
  decisionRecord,
  isSubmitting,
  previousDecisions = [],
}: Pass3PipelineProps) {
  // Decision form state
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [phaseScope, setPhaseScope] = useState<PhaseScope | ''>('');
  const [timingIntent, setTimingIntent] = useState<TimingIntent | ''>('');
  const [confidenceClass, setConfidenceClass] = useState<ConfidenceClass | ''>('');
  const [rationale, setRationale] = useState('');

  const gates = computeGates(artifactData);
  const allGatesPass = gates.demand_gate.pass && gates.rent_gate.pass && 
                       gates.feasibility_gate.pass && gates.phase1_gate.pass;

  const canSubmit = 
    decision && 
    phaseScope && 
    timingIntent && 
    confidenceClass && 
    rationale.trim().length >= 10 &&
    artifactValid &&
    !decisionRecord;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onDecisionSubmit({
      decision: decision as DecisionType,
      phase_scope: phaseScope as PhaseScope,
      timing_intent: timingIntent as TimingIntent,
      confidence_class: confidenceClass as ConfidenceClass,
      rationale: rationale.trim(),
    });
  };

  return (
    <div className="space-y-4">
      {/* Pipeline Flow Header */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> ARTIFACTS</span>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> GATES</span>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1 text-foreground font-medium">✏️ DECISION</span>
        <ArrowRight className="h-3 w-3" />
        <span className="flex items-center gap-1"><FileCheck className="h-3 w-3" /> OUTPUT</span>
      </div>

      {/* 4-Column Pipeline Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Column 1: Upstream Artifacts (LOCKED) */}
        <Card className="border-2 border-muted bg-muted/10">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Upstream Artifacts</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Read-only · Frozen</p>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* Identifiers */}
            <div className="space-y-1">
              <p className="text-muted-foreground">Artifact ID</p>
              <code className="block bg-muted px-2 py-1 rounded text-[10px] truncate">
                {artifactId || '—'}
              </code>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">ZIP</p>
              <p className="font-mono font-medium">{zip || '—'}</p>
            </div>

            <Separator />

            {/* Pass 1 */}
            <div>
              <Badge variant="outline" className="text-[10px] mb-2">Pass 1</Badge>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Demand Gap</span>
                  <span className="font-medium">{formatNumber(artifactData?.pass1_demand_gap_sqft ?? null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supply</span>
                  <span className="font-medium">{formatNumber(artifactData?.pass1_supply_sqft ?? null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Population</span>
                  <span className="font-medium">{formatNumber(artifactData?.pass1_population ?? null)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pass 1.5 */}
            <div>
              <Badge variant="outline" className="text-[10px] mb-2">Pass 1.5</Badge>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rent (Med)</span>
                  <span className="font-medium">{formatCurrency(artifactData?.pass15_rent_medium ?? null)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {artifactData?.pass15_confidence || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pass 2 */}
            <div>
              <Badge variant="outline" className="text-[10px] mb-2">Pass 2</Badge>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">DSCR</span>
                  <span className="font-medium">
                    {artifactData?.pass2_dscr?.toFixed(2) ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zoning</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {artifactData?.pass2_zoning_status || 'N/A'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge 
                    variant={artifactData?.pass2_status === 'ELIGIBLE' ? 'default' : 'secondary'}
                    className="text-[10px]"
                  >
                    {artifactData?.pass2_status || 'N/A'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Eligibility Gates (LOCKED) */}
        <Card className="border-2 border-muted bg-muted/10">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Eligibility Gates</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Checkpoints · No edits</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Gate Items */}
            {[
              { key: 'demand_gate', label: 'Demand > 0', gate: gates.demand_gate },
              { key: 'rent_gate', label: 'Rent Confidence OK', gate: gates.rent_gate },
              { key: 'feasibility_gate', label: 'Feasibility Pass', gate: gates.feasibility_gate },
              { key: 'phase1_gate', label: 'Phase-1 Self-Fund', gate: gates.phase1_gate },
            ].map(({ key, label, gate }) => (
              <div 
                key={key}
                className={`p-3 rounded-lg border ${
                  gate.pass 
                    ? 'border-green-500/30 bg-green-500/5' 
                    : 'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {gate.pass ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    gate.pass ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                  }`}>
                    {label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  {gate.reason}
                </p>
              </div>
            ))}

            <Separator />

            {/* Gate Summary */}
            <div className={`p-3 rounded-lg text-center ${
              allGatesPass 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-amber-500/10 border border-amber-500/30'
            }`}>
              <p className={`text-sm font-medium ${
                allGatesPass 
                  ? 'text-green-700 dark:text-green-400' 
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {allGatesPass ? 'All Gates Pass' : 'Gates Incomplete'}
              </p>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-2 bg-destructive/10 rounded border border-destructive/30">
                <div className="flex items-center gap-1 text-destructive text-xs font-medium mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  Validation Issues
                </div>
                <ul className="text-[10px] text-destructive/80 space-y-0.5">
                  {validationErrors.slice(0, 3).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {validationErrors.length > 3 && (
                    <li>...and {validationErrors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Decision Inputs (EDITABLE) */}
        <Card className={`border-2 ${
          decisionRecord 
            ? 'border-muted bg-muted/10' 
            : 'border-primary/50 bg-primary/5'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">✏️</span>
              <CardTitle className="text-sm">Decision Inputs</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              {decisionRecord ? 'Locked after commit' : 'YOU DECIDE HERE'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Decision Type */}
            <div className="space-y-2">
              <Label className="text-xs">Decision *</Label>
              <RadioGroup
                value={decision}
                onValueChange={(v) => setDecision(v as DecisionType)}
                className="flex gap-2"
                disabled={!!decisionRecord}
              >
                {[
                  { value: 'GO', icon: CheckCircle2, color: 'text-green-500' },
                  { value: 'HOLD', icon: Clock, color: 'text-amber-500' },
                  { value: 'NO_GO', icon: XCircle, color: 'text-red-500' },
                ].map(({ value, icon: Icon, color }) => (
                  <div key={value} className="flex items-center space-x-1">
                    <RadioGroupItem value={value} id={`dec-${value}`} />
                    <Label htmlFor={`dec-${value}`} className="flex items-center gap-1 cursor-pointer text-xs">
                      <Icon className={`h-3 w-3 ${color}`} />
                      {value.replace('_', '-')}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Phase Scope */}
            <div className="space-y-2">
              <Label className="text-xs">Phase Scope *</Label>
              <Select 
                value={phaseScope} 
                onValueChange={(v) => setPhaseScope(v as PhaseScope)}
                disabled={!!decisionRecord}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHASE_1_ONLY">Phase 1 Only</SelectItem>
                  <SelectItem value="FULL_BUILD">Full Build</SelectItem>
                  <SelectItem value="LAND_BANK">Land Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Timing Intent */}
            <div className="space-y-2">
              <Label className="text-xs">Timing *</Label>
              <Select 
                value={timingIntent} 
                onValueChange={(v) => setTimingIntent(v as TimingIntent)}
                disabled={!!decisionRecord}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select timing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                  <SelectItem value="WITHIN_6_MO">Within 6mo</SelectItem>
                  <SelectItem value="WITHIN_12_MO">Within 12mo</SelectItem>
                  <SelectItem value="OPPORTUNISTIC">Opportunistic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confidence */}
            <div className="space-y-2">
              <Label className="text-xs">Confidence *</Label>
              <Select 
                value={confidenceClass} 
                onValueChange={(v) => setConfidenceClass(v as ConfidenceClass)}
                disabled={!!decisionRecord}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rationale */}
            <div className="space-y-2">
              <Label className="text-xs">
                Rationale * <span className="text-muted-foreground">(min 10 chars)</span>
              </Label>
              <Textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="No silent approvals..."
                rows={3}
                className="text-xs resize-none"
                disabled={!!decisionRecord}
              />
              <p className="text-[10px] text-muted-foreground">
                {rationale.trim().length}/10 chars
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Column 4: Decision Output (COMPUTED) */}
        <Card className={`border-2 ${
          decisionRecord 
            ? 'border-green-500/50 bg-green-500/5' 
            : 'border-muted bg-muted/10'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Decision Output</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              {decisionRecord ? 'Committed' : 'Awaiting commit'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {decisionRecord ? (
              <>
                {/* Recorded Decision */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Run ID</p>
                    <code className="block bg-muted px-2 py-1 rounded text-[10px] truncate">
                      {decisionRecord.pass3_run_id}
                    </code>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Decision:</p>
                    <Badge 
                      variant={
                        decisionRecord.decision === 'GO' ? 'default' :
                        decisionRecord.decision === 'HOLD' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {decisionRecord.decision.replace('_', '-')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Status:</p>
                    <Badge variant="outline" className="text-[10px]">
                      {decisionRecord.lifecycle_status}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Bound</p>
                    <p className="text-xs font-mono">
                      ZIP: {decisionRecord.zip} → Artifact: {decisionRecord.artifact_id.slice(0, 8)}...
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Rationale</p>
                    <p className="text-xs italic bg-muted/50 p-2 rounded">
                      "{decisionRecord.rationale}"
                    </p>
                  </div>
                </div>

                {/* Previous Decisions */}
                {previousDecisions.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Superseded</p>
                      <div className="space-y-1">
                        {previousDecisions.map((pd) => (
                          <div 
                            key={pd.run_id}
                            className="text-[10px] flex justify-between text-muted-foreground"
                          >
                            <span>{pd.decision}</span>
                            <span>{pd.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Pending State */}
                <div className="text-center py-4 text-muted-foreground">
                  <Hash className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Run ID will be generated on commit</p>
                </div>

                <Separator />

                {/* Commit Button */}
                <div>
                  {!artifactValid && (
                    <div className="flex items-center gap-1 text-destructive text-[10px] mb-2">
                      <AlertTriangle className="h-3 w-3" />
                      Artifact validation failed
                    </div>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    className="w-full"
                    size="sm"
                  >
                    {isSubmitting ? "Committing..." : "Commit Decision"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Lifecycle: ACTIVE
                  </p>
                </div>

                {/* Previous Decisions (if any) */}
                {previousDecisions.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Previous ({previousDecisions.length})
                      </p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {previousDecisions.map((pd) => (
                          <div 
                            key={pd.run_id}
                            className="text-[10px] flex justify-between text-muted-foreground bg-muted/50 px-2 py-1 rounded"
                          >
                            <span>{pd.decision}</span>
                            <Badge variant="outline" className="text-[8px]">
                              {pd.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
