import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gavel, Loader2 } from "lucide-react";

type DecisionType = 'GO' | 'HOLD' | 'NO_GO';
type ScopeType = 'PHASE_1' | 'FULL_BUILD' | 'PARTIAL';
type TimingType = 'IMMEDIATE' | 'CONTINGENT' | 'DEFERRED';
type ConfidenceType = 'HIGH' | 'MEDIUM' | 'LOW';

interface DecisionData {
  decision: DecisionType;
  scope: ScopeType;
  timing: TimingType;
  confidence: ConfidenceType;
  rationale: string;
}

interface SolverDecisionFormProps {
  artifactId: string;
  onCommit: (data: DecisionData) => Promise<void>;
  isCommitting: boolean;
  disabled?: boolean;
}

export const SolverDecisionForm = ({ artifactId, onCommit, isCommitting, disabled }: SolverDecisionFormProps) => {
  const [decision, setDecision] = useState<DecisionType>('HOLD');
  const [scope, setScope] = useState<ScopeType>('PHASE_1');
  const [timing, setTiming] = useState<TimingType>('CONTINGENT');
  const [confidence, setConfidence] = useState<ConfidenceType>('MEDIUM');
  const [rationale, setRationale] = useState('');

  const handleSubmit = async () => {
    await onCommit({ decision, scope, timing, confidence, rationale });
  };

  const canCommit = rationale.trim().length >= 10 && !isCommitting && !disabled;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />
          Decision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Decision Type */}
        <div className="space-y-2">
          <Label className="text-xs">Verdict</Label>
          <RadioGroup
            value={decision}
            onValueChange={(v) => setDecision(v as DecisionType)}
            className="flex gap-2"
            disabled={disabled}
          >
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="GO" id="go" />
              <Label htmlFor="go" className="text-xs cursor-pointer text-green-600 dark:text-green-400 font-medium">GO</Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="HOLD" id="hold" />
              <Label htmlFor="hold" className="text-xs cursor-pointer text-amber-600 dark:text-amber-400 font-medium">HOLD</Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="NO_GO" id="nogo" />
              <Label htmlFor="nogo" className="text-xs cursor-pointer text-destructive font-medium">NO-GO</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <Label className="text-xs">Scope</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as ScopeType)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PHASE_1">Phase 1 Only</SelectItem>
              <SelectItem value="FULL_BUILD">Full Build-Out</SelectItem>
              <SelectItem value="PARTIAL">Partial Development</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timing */}
        <div className="space-y-2">
          <Label className="text-xs">Timing</Label>
          <Select value={timing} onValueChange={(v) => setTiming(v as TimingType)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMMEDIATE">Immediate</SelectItem>
              <SelectItem value="CONTINGENT">Contingent</SelectItem>
              <SelectItem value="DEFERRED">Deferred</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence */}
        <div className="space-y-2">
          <Label className="text-xs">Confidence</Label>
          <Select value={confidence} onValueChange={(v) => setConfidence(v as ConfidenceType)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
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
          <Label className="text-xs">Rationale (required)</Label>
          <Textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why this decision? What are the key factors?"
            className="text-xs h-20 resize-none"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            {rationale.length}/10 min characters
          </p>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!canCommit}
          className="w-full gap-2"
          variant={decision === 'GO' ? 'default' : decision === 'HOLD' ? 'secondary' : 'destructive'}
        >
          {isCommitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Committing...
            </>
          ) : (
            <>
              <Gavel className="h-4 w-4" />
              Commit Decision
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
