import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

type DecisionType = 'GO' | 'HOLD' | 'NO_GO';
type PhaseScope = 'PHASE_1_ONLY' | 'FULL_BUILD' | 'LAND_BANK';
type TimingIntent = 'IMMEDIATE' | 'WITHIN_6_MO' | 'WITHIN_12_MO' | 'OPPORTUNISTIC';
type ConfidenceClass = 'HIGH' | 'MEDIUM' | 'LOW';

interface Pass3DecisionFormProps {
  artifactValid: boolean;
  onSubmit: (decision: {
    decision: DecisionType;
    phase_scope: PhaseScope;
    timing_intent: TimingIntent;
    confidence_class: ConfidenceClass;
    rationale: string;
  }) => void;
  isSubmitting: boolean;
}

export function Pass3DecisionForm({ artifactValid, onSubmit, isSubmitting }: Pass3DecisionFormProps) {
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [phaseScope, setPhaseScope] = useState<PhaseScope | ''>('');
  const [timingIntent, setTimingIntent] = useState<TimingIntent | ''>('');
  const [confidenceClass, setConfidenceClass] = useState<ConfidenceClass | ''>('');
  const [rationale, setRationale] = useState('');

  const canSubmit = 
    decision && 
    phaseScope && 
    timingIntent && 
    confidenceClass && 
    rationale.trim().length >= 10 &&
    artifactValid;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      decision: decision as DecisionType,
      phase_scope: phaseScope as PhaseScope,
      timing_intent: timingIntent as TimingIntent,
      confidence_class: confidenceClass as ConfidenceClass,
      rationale: rationale.trim(),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Decision Parameters</CardTitle>
        <CardDescription>
          No numeric fields are editable. Decision only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Decision Type */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Decision *</Label>
          <RadioGroup
            value={decision}
            onValueChange={(v) => setDecision(v as DecisionType)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="GO" id="go" />
              <Label htmlFor="go" className="flex items-center gap-1 cursor-pointer">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>GO</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="HOLD" id="hold" />
              <Label htmlFor="hold" className="flex items-center gap-1 cursor-pointer">
                <Clock className="h-4 w-4 text-amber-500" />
                <span>HOLD</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="NO_GO" id="no_go" />
              <Label htmlFor="no_go" className="flex items-center gap-1 cursor-pointer">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>NO-GO</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Phase Scope */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Phase Scope *</Label>
          <Select value={phaseScope} onValueChange={(v) => setPhaseScope(v as PhaseScope)}>
            <SelectTrigger>
              <SelectValue placeholder="Select phase scope" />
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
          <Label className="text-sm font-medium">Timing Intent *</Label>
          <Select value={timingIntent} onValueChange={(v) => setTimingIntent(v as TimingIntent)}>
            <SelectTrigger>
              <SelectValue placeholder="Select timing intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMMEDIATE">Immediate</SelectItem>
              <SelectItem value="WITHIN_6_MO">Within 6 Months</SelectItem>
              <SelectItem value="WITHIN_12_MO">Within 12 Months</SelectItem>
              <SelectItem value="OPPORTUNISTIC">Opportunistic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Class */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Confidence Class *</Label>
          <Select value={confidenceClass} onValueChange={(v) => setConfidenceClass(v as ConfidenceClass)}>
            <SelectTrigger>
              <SelectValue placeholder="Select confidence level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HIGH">High Confidence</SelectItem>
              <SelectItem value="MEDIUM">Medium Confidence</SelectItem>
              <SelectItem value="LOW">Low Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rationale - REQUIRED */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Rationale * <span className="text-muted-foreground font-normal">(min 10 chars)</span>
          </Label>
          <Textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Explain the decision. No silent approvals allowed."
            rows={4}
            className={rationale.trim().length > 0 && rationale.trim().length < 10 ? "border-destructive" : ""}
          />
          <p className="text-xs text-muted-foreground">
            {rationale.trim().length}/10 minimum characters
          </p>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t">
          {!artifactValid && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-4">
              <AlertTriangle className="h-4 w-4" />
              <span>Cannot submit: Artifact validation failed</span>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? "Recording Decision..." : "Record Decision"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Decision will be recorded with lifecycle status: ACTIVE
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
