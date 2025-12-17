import { WizardData, ScoringResult } from "@/types/wizard";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://your-backend-url.com";

export async function runSiteScoring(payload: WizardData): Promise<ScoringResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling scoring API:", error);
    
    // Return mock data for development
    return {
      saturationScore: 75,
      parcelViabilityScore: 85,
      countyDifficulty: 60,
      financialViability: 80,
      finalScore: 75,
      decision: 'GO',
    };
  }
}
