export interface LocationData {
  state: string;
  county: string;
  zipCode: string;
  acreage: number;
  parcelShape: string;
  slopePercent: number;
  floodplain: boolean;
  accessQuality: string;
  nearbyRoadType: string;
}

export interface DemandData {
  population: number;
  households: number;
  uhaulMigrationScore: string;
  trafficCount: number;
  competitionCount: number;
}

export interface RentData {
  lowRent: number;
  mediumRent: number;
  highRent: number;
}

export interface ScoringResult {
  saturationScore: number;
  parcelViabilityScore: number;
  countyDifficulty: number;
  financialViability: number;
  finalScore: number;
  decision: 'GO' | 'NO-GO' | 'MAYBE';
}

export interface WizardData {
  location?: LocationData;
  demand?: DemandData;
  rent?: RentData;
  result?: ScoringResult;
  siteIntakeId?: string;
}
