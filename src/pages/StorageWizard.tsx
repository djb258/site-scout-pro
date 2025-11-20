import { useState } from "react";
import { WizardLayout } from "@/components/WizardLayout";
import { StepLocation } from "@/components/StepLocation";
import { StepDemand } from "@/components/StepDemand";
import { StepRent } from "@/components/StepRent";
import { StepReview } from "@/components/StepReview";
import { StepResult } from "@/components/StepResult";
import { WizardData, LocationData, DemandData, RentData } from "@/types/wizard";
import { saveLocationData, saveDemandData, saveRentData, saveResultData } from "@/services/storageFormHelpers";
import { runSiteScoring } from "@/services/storageScoringService";
import { toast } from "sonner";

const TOTAL_STEPS = 5;

export default function StorageWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [isLoading, setIsLoading] = useState(false);

  // Generate a simple user ID for tracking (in production, use proper auth)
  const userId = `user_${Date.now()}`;

  const handleLocationNext = async (data: LocationData) => {
    try {
      const result = await saveLocationData(data, userId);
      setWizardData({ ...wizardData, location: data, siteIntakeId: result.id });
      setCurrentStep(1);
      toast.success("Location data saved");
    } catch (error) {
      console.error("Error saving location data:", error);
      toast.error("Failed to save location data");
    }
  };

  const handleDemandNext = async (data: DemandData) => {
    try {
      if (wizardData.siteIntakeId) {
        await saveDemandData(data, wizardData.siteIntakeId, userId);
        setWizardData({ ...wizardData, demand: data });
        setCurrentStep(2);
        toast.success("Demand data saved");
      }
    } catch (error) {
      console.error("Error saving demand data:", error);
      toast.error("Failed to save demand data");
    }
  };

  const handleRentNext = async (data: RentData) => {
    try {
      if (wizardData.siteIntakeId) {
        await saveRentData(data, wizardData.siteIntakeId, userId);
        setWizardData({ ...wizardData, rent: data });
        setCurrentStep(3);
        toast.success("Rent data saved");
      }
    } catch (error) {
      console.error("Error saving rent data:", error);
      toast.error("Failed to save rent data");
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await runSiteScoring(wizardData);
      
      if (wizardData.siteIntakeId) {
        await saveResultData(result, wizardData.siteIntakeId, userId);
      }
      
      setWizardData({ ...wizardData, result });
      setCurrentStep(4);
      toast.success("Analysis complete!");
    } catch (error) {
      console.error("Error running analysis:", error);
      toast.error("Failed to complete analysis");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNew = () => {
    setWizardData({});
    setCurrentStep(0);
  };

  const handleBack = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  return (
    <WizardLayout currentStep={currentStep} totalSteps={TOTAL_STEPS}>
      {currentStep === 0 && (
        <StepLocation data={wizardData.location} onNext={handleLocationNext} />
      )}
      {currentStep === 1 && (
        <StepDemand data={wizardData.demand} onNext={handleDemandNext} onBack={handleBack} />
      )}
      {currentStep === 2 && (
        <StepRent data={wizardData.rent} onNext={handleRentNext} onBack={handleBack} />
      )}
      {currentStep === 3 && (
        <StepReview
          data={wizardData}
          onBack={handleBack}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      )}
      {currentStep === 4 && wizardData.result && (
        <StepResult result={wizardData.result} onStartNew={handleStartNew} />
      )}
    </WizardLayout>
  );
}
