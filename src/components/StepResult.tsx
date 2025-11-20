import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, Building2, Landmark, DollarSign } from "lucide-react";
import { ScoringResult } from "@/types/wizard";

interface StepResultProps {
  result: ScoringResult;
  onStartNew: () => void;
}

export function StepResult({ result, onStartNew }: StepResultProps) {
  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case "GO":
        return "text-success";
      case "MAYBE":
        return "text-warning";
      case "NO-GO":
        return "text-destructive";
      default:
        return "text-foreground";
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case "GO":
        return <CheckCircle2 className="h-16 w-16 text-success" />;
      case "MAYBE":
        return <AlertCircle className="h-16 w-16 text-warning" />;
      case "NO-GO":
        return <XCircle className="h-16 w-16 text-destructive" />;
      default:
        return null;
    }
  };

  const getDecisionBg = (decision: string) => {
    switch (decision) {
      case "GO":
        return "bg-success/10 border-success/20";
      case "MAYBE":
        return "bg-warning/10 border-warning/20";
      case "NO-GO":
        return "bg-destructive/10 border-destructive/20";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div className="space-y-6">
      <Card className={`border-2 ${getDecisionBg(result.decision)}`}>
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            {getDecisionIcon(result.decision)}
          </div>
          <CardTitle className={`text-4xl font-bold ${getDecisionColor(result.decision)}`}>
            {result.decision}
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Final Score: {result.finalScore}/100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={result.finalScore} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Saturation Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{result.saturationScore}/100</span>
              </div>
              <Progress value={result.saturationScore} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Parcel Viability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{result.parcelViabilityScore}/100</span>
              </div>
              <Progress value={result.parcelViabilityScore} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Landmark className="h-5 w-5 text-primary" />
              County Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{result.countyDifficulty}/100</span>
              </div>
              <Progress value={result.countyDifficulty} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-primary" />
              Financial Viability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold">{result.financialViability}/100</span>
              </div>
              <Progress value={result.financialViability} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Build-Out Phases</CardTitle>
          <CardDescription>Recommended development timeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-step-complete text-success-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <span className="font-medium">Phase 1</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">Initial units & infrastructure</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-step-indicator text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <span className="font-medium">Phase 2</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">Expansion & optimization</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-step-pending text-muted-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <span className="font-medium">Phase 3</span>
              </div>
              <p className="text-sm text-muted-foreground ml-10">Full build-out potential</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-4">
        <Button onClick={onStartNew} size="lg" variant="outline">
          Evaluate Another Site
        </Button>
      </div>
    </div>
  );
}
