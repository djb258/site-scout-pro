import { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { Building2 } from "lucide-react";

interface WizardLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
}

const stepLabels = [
  "Location Basics",
  "Demand Indicators",
  "Rent Bands",
  "Review",
  "Results"
];

export function WizardLayout({ children, currentStep, totalSteps }: WizardLayoutProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Storage Site Go/No-Go Engine</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {stepLabels.map((label, index) => (
              <div
                key={index}
                className={`text-sm font-medium ${
                  index < currentStep
                    ? "text-step-complete"
                    : index === currentStep
                    ? "text-step-indicator"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {stepLabels.map((_, index) => (
              <div
                key={index}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  index < currentStep
                    ? "bg-step-complete text-success-foreground"
                    : index === currentStep
                    ? "bg-step-indicator text-primary-foreground"
                    : "bg-step-pending text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
