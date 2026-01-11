// Pass 2 Calculator Module - Client-side calculations from Pass 2 JSON

export interface Pass2Data {
  zoning: any;
  permit_intel: any;
  industrial_deep: any;
  housing_pipeline: any;
  fusion_model: any;
  feasibility: any;
  reverse_feasibility: any;
  rent_benchmarks: any;
  verdict: any;
}

export interface CalculatorInputs {
  metalBuildingCostPerSqft: number;  // $22-24
  concreteCostPerYard: number;
  finishLaborCost: number;           // $2.50/sqft
  landCost: number;
  capRateTarget: number;             // e.g., 0.065 for 6.5%
  marketRent10x10: number;
  marketRent10x20: number;
  acreageAvailable: number;
}

export interface ZoningResult {
  classification: 'favorable' | 'conditional' | 'challenging' | 'prohibited';
  score: number;
  requirements: string[];
  risks: string[];
}

export interface PermitResult {
  complexityScore: number;
  estimatedTimeline: string;
  estimatedCost: number;
  criticalPath: string[];
}

export interface IndustrialDeepResult {
  growthScore: number;
  employerStrength: number;
  logisticsIndex: number;
  overallScore: number;
}

export interface HousingPipelineResult {
  newUnitsImpact: number;
  densityTrend: string;
  demandProjection: number;
  timelineAlignment: string;
}

export interface FusionDemandResult {
  demandScore: number;
  supplyGap: number;
  marketTiming: string;
  competitionIntensity: string;
  overallScore: number;
}

export interface FeasibilityResult {
  totalDevelopmentCost: number;
  landCost: number;
  constructionCost: number;
  softCosts: number;
  projectedNOI: number;
  capRate: number;
  stabilizedValue: number;
  roi5Year: number;
  cashOnCash: number;
  isViable: boolean;
}

export interface ReverseFeasibilityResult {
  requiredRentPSF: number;
  breakEvenOccupancy: number;
  targetOccupancy: number;
  stabilizationMonths: number;
  marketGap: number; // difference from market rents
  isAchievable: boolean;
}

export interface RentBenchmarkResult {
  climate10x10: number;
  standard10x10: number;
  outdoor10x20: number;
  marketPosition: 'premium' | 'competitive' | 'discount';
  avgPSF: number;
}

export interface FinalVerdictResult {
  decision: 'PROCEED' | 'EVALUATE' | 'WALK';
  confidence: number;
  keyFactors: string[];
  risks: string[];
  recommendation: string;
}

/**
 * Calculate zoning classification and feasibility
 */
export function calculateZoningClassification(pass2Data: Pass2Data): ZoningResult {
  const zoning = pass2Data.zoning || {};
  const requirements: string[] = [];
  const risks: string[] = [];
  let score = 100;
  
  // Check if storage is allowed
  if (!zoning.storage_allowed) {
    return {
      classification: 'prohibited',
      score: 0,
      requirements: ['Rezoning required'],
      risks: ['Storage not permitted in current zone']
    };
  }
  
  // Variance requirements
  if (zoning.variance_needed) {
    score -= 25;
    requirements.push('Variance application required');
    risks.push('Variance approval uncertainty');
  }
  
  // Setback requirements
  if (zoning.setback_requirements) {
    requirements.push(`Setbacks: ${zoning.setback_requirements}`);
  }
  
  // Height limits
  if (zoning.height_limit) {
    const heightNum = parseInt(zoning.height_limit);
    if (heightNum < 30) {
      score -= 15;
      risks.push('Height restriction may limit multi-story');
    }
    requirements.push(`Height limit: ${zoning.height_limit}`);
  }
  
  // Lot coverage
  if (zoning.lot_coverage_max) {
    requirements.push(`Max lot coverage: ${zoning.lot_coverage_max}`);
  }
  
  let classification: 'favorable' | 'conditional' | 'challenging' | 'prohibited';
  if (score >= 80) classification = 'favorable';
  else if (score >= 60) classification = 'conditional';
  else classification = 'challenging';
  
  return { classification, score, requirements, risks };
}

/**
 * Calculate permit pipeline complexity
 */
export function calculatePermitPipeline(pass2Data: Pass2Data): PermitResult {
  const permit = pass2Data.permit_intel || {};
  const criticalPath: string[] = [];
  
  let complexityScore = 50; // Start neutral
  
  // Complexity adjustment
  if (permit.complexity === 'low') complexityScore = 25;
  else if (permit.complexity === 'moderate') complexityScore = 50;
  else if (permit.complexity === 'high') complexityScore = 75;
  else if (permit.complexity === 'very_high') complexityScore = 90;
  
  // Key requirements
  const reqs = permit.key_requirements || [];
  reqs.forEach((req: string) => {
    criticalPath.push(req);
    if (req.toLowerCase().includes('traffic')) complexityScore += 5;
    if (req.toLowerCase().includes('environmental')) complexityScore += 10;
    if (req.toLowerCase().includes('hearing')) complexityScore += 8;
  });
  
  return {
    complexityScore: Math.min(100, complexityScore),
    estimatedTimeline: permit.estimated_timeline || '90-120 days',
    estimatedCost: permit.total_fees || 15000,
    criticalPath
  };
}

/**
 * Calculate industrial deep dive metrics
 */
export function calculateIndustrialDeepDive(pass2Data: Pass2Data): IndustrialDeepResult {
  const industrial = pass2Data.industrial_deep || {};
  
  // Parse growth rate
  const growthRateStr = industrial.growth_rate || '0%';
  const growthRate = parseFloat(growthRateStr.replace('%', '')) || 0;
  const growthScore = Math.min(100, growthRate * 15 + 40);
  
  // Employer strength based on major employers count
  const employers = industrial.major_employers || [];
  const employerStrength = Math.min(100, employers.length * 20 + 20);
  
  // Logistics score
  const logisticsIndex = industrial.logistics_score || 50;
  
  // Overall industrial score
  const overallScore = Math.round((growthScore + employerStrength + logisticsIndex) / 3);
  
  return {
    growthScore: Math.round(growthScore),
    employerStrength,
    logisticsIndex,
    overallScore
  };
}

/**
 * Calculate housing pipeline impact
 */
export function calculateHousingPipeline(pass2Data: Pass2Data): HousingPipelineResult {
  const housing = pass2Data.housing_pipeline || {};
  
  const newUnits = housing.new_units_planned || 0;
  const densityTrend = housing.density_trend || 'stable';
  const timeline = housing.construction_timeline || 'unknown';
  
  // New units impact on storage demand
  // ~10 sqft storage demand per new housing unit
  const demandProjection = newUnits * 10;
  
  // Score based on new units
  let newUnitsImpact = 0;
  if (newUnits > 500) newUnitsImpact = 90;
  else if (newUnits > 200) newUnitsImpact = 70;
  else if (newUnits > 100) newUnitsImpact = 50;
  else if (newUnits > 50) newUnitsImpact = 30;
  else newUnitsImpact = 10;
  
  // Timeline alignment
  let timelineAlignment = 'neutral';
  if (timeline.includes('2024') || timeline.includes('2025')) {
    timelineAlignment = 'favorable';
    newUnitsImpact += 10;
  } else if (timeline.includes('2027') || timeline.includes('2028')) {
    timelineAlignment = 'delayed';
  }
  
  return {
    newUnitsImpact: Math.min(100, newUnitsImpact),
    densityTrend,
    demandProjection,
    timelineAlignment
  };
}

/**
 * Calculate fusion demand model (mirrors server-side)
 */
export function calculateFusionDemand(pass2Data: Pass2Data): FusionDemandResult {
  const fusion = pass2Data.fusion_model || {};
  
  return {
    demandScore: fusion.demand_score || 50,
    supplyGap: fusion.supply_gap || 0,
    marketTiming: fusion.market_timing || 'neutral',
    competitionIntensity: fusion.competition_intensity || 'moderate',
    overallScore: fusion.overall_score || 50
  };
}

/**
 * Calculate feasibility from inputs
 */
export function calculateFeasibility(pass2Data: Pass2Data, inputs: CalculatorInputs): FeasibilityResult {
  // Calculate buildable sqft (assume 40% of acreage for building footprint)
  const buildableSqft = inputs.acreageAvailable * 43560 * 0.40;
  const netRentableSqft = buildableSqft * 0.85; // 85% efficiency
  
  // Construction costs
  const metalBuildingCost = buildableSqft * inputs.metalBuildingCostPerSqft;
  const concreteCost = (inputs.acreageAvailable * 200) * inputs.concreteCostPerYard; // 200 yards per acre estimate
  const finishCost = buildableSqft * inputs.finishLaborCost;
  const constructionCost = metalBuildingCost + concreteCost + finishCost;
  
  // Soft costs (15% of construction)
  const softCosts = constructionCost * 0.15;
  
  // Total development cost
  const totalDevelopmentCost = inputs.landCost + constructionCost + softCosts;
  
  // Revenue projection (blended rate)
  const blendedRentPSF = ((inputs.marketRent10x10 / 100) + (inputs.marketRent10x20 / 200)) / 2;
  const grossPotentialRent = netRentableSqft * blendedRentPSF * 12;
  const effectiveGrossIncome = grossPotentialRent * 0.88; // 88% occupancy
  
  // Operating expenses (35% of EGI)
  const operatingExpenses = effectiveGrossIncome * 0.35;
  const projectedNOI = effectiveGrossIncome - operatingExpenses;
  
  // Cap rate and value
  const capRate = projectedNOI / totalDevelopmentCost;
  const stabilizedValue = projectedNOI / inputs.capRateTarget;
  
  // 5-year ROI
  const appreciation = stabilizedValue - totalDevelopmentCost;
  const cashFlow5Year = projectedNOI * 5;
  const totalReturn5Year = appreciation + cashFlow5Year;
  const roi5Year = (totalReturn5Year / totalDevelopmentCost) * 100;
  
  // Cash on cash (Year 1)
  const debtService = totalDevelopmentCost * 0.7 * 0.07; // 70% LTV, 7% rate
  const cashOnCash = ((projectedNOI - debtService) / (totalDevelopmentCost * 0.3)) * 100;
  
  const isViable = capRate >= inputs.capRateTarget && roi5Year > 25;
  
  return {
    totalDevelopmentCost: Math.round(totalDevelopmentCost),
    landCost: inputs.landCost,
    constructionCost: Math.round(constructionCost),
    softCosts: Math.round(softCosts),
    projectedNOI: Math.round(projectedNOI),
    capRate: Math.round(capRate * 1000) / 10,
    stabilizedValue: Math.round(stabilizedValue),
    roi5Year: Math.round(roi5Year * 10) / 10,
    cashOnCash: Math.round(cashOnCash * 10) / 10,
    isViable
  };
}

/**
 * Calculate reverse feasibility (what rents are needed)
 */
export function calculateReverseFeasibility(pass2Data: Pass2Data, inputs: CalculatorInputs): ReverseFeasibilityResult {
  const reverse = pass2Data.reverse_feasibility || {};
  
  // Calculate required rent to hit target cap rate
  const buildableSqft = inputs.acreageAvailable * 43560 * 0.40;
  const netRentableSqft = buildableSqft * 0.85;
  
  const constructionCost = buildableSqft * inputs.metalBuildingCostPerSqft + 
                           (inputs.acreageAvailable * 200 * inputs.concreteCostPerYard) +
                           (buildableSqft * inputs.finishLaborCost);
  const totalDevCost = inputs.landCost + constructionCost * 1.15;
  
  // Required NOI for target cap rate
  const requiredNOI = totalDevCost * inputs.capRateTarget;
  
  // Back into required rent (assuming 35% expense ratio, 88% occupancy)
  const requiredEGI = requiredNOI / 0.65;
  const requiredGPR = requiredEGI / 0.88;
  const requiredRentPSF = requiredGPR / (netRentableSqft * 12);
  
  // Break-even occupancy at market rents
  const blendedMarketRent = ((inputs.marketRent10x10 / 100) + (inputs.marketRent10x20 / 200)) / 2;
  const marketGPR = netRentableSqft * blendedMarketRent * 12;
  const breakEvenOccupancy = (requiredEGI / marketGPR) * 100;
  
  const marketGap = ((requiredRentPSF - blendedMarketRent) / blendedMarketRent) * 100;
  const isAchievable = requiredRentPSF <= blendedMarketRent * 1.15; // Within 15% of market
  
  return {
    requiredRentPSF: Math.round(requiredRentPSF * 100) / 100,
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 10) / 10,
    targetOccupancy: reverse.target_occupancy || 88,
    stabilizationMonths: reverse.stabilization_months || 24,
    marketGap: Math.round(marketGap * 10) / 10,
    isAchievable
  };
}

/**
 * Calculate rent benchmarks
 */
export function calculateRentBenchmarks(pass2Data: Pass2Data): RentBenchmarkResult {
  const rents = pass2Data.rent_benchmarks || {};
  
  const climate = rents.climate_control_10x10 || 185;
  const standard = rents.standard_10x10 || 125;
  const outdoor = rents.outdoor_10x20 || 95;
  
  // Average price per sqft
  const avgPSF = ((climate / 100) + (standard / 100) + (outdoor / 200)) / 3;
  
  // Determine market position
  let marketPosition: 'premium' | 'competitive' | 'discount' = 'competitive';
  if (climate > 200 || standard > 150) marketPosition = 'premium';
  else if (climate < 150 || standard < 100) marketPosition = 'discount';
  
  return {
    climate10x10: climate,
    standard10x10: standard,
    outdoor10x20: outdoor,
    marketPosition,
    avgPSF: Math.round(avgPSF * 100) / 100
  };
}

/**
 * Calculate final verdict from all analyses
 */
export function calculateFinalVerdict(
  feasibility: FeasibilityResult,
  fusion: FusionDemandResult,
  zoning: ZoningResult,
  permit: PermitResult
): FinalVerdictResult {
  const keyFactors: string[] = [];
  const risks: string[] = [];
  let score = 0;
  
  // Feasibility weight (35%)
  if (feasibility.isViable) {
    score += 35;
    keyFactors.push(`${feasibility.roi5Year}% 5-year ROI`);
  } else {
    risks.push('Financial returns below threshold');
  }
  
  // Fusion demand weight (25%)
  score += (fusion.overallScore / 100) * 25;
  if (fusion.overallScore > 70) {
    keyFactors.push('Strong market demand');
  }
  if (fusion.supplyGap > 20000) {
    keyFactors.push(`${fusion.supplyGap.toLocaleString()} sqft supply gap`);
  }
  
  // Zoning weight (20%)
  score += (zoning.score / 100) * 20;
  if (zoning.classification === 'favorable') {
    keyFactors.push('Favorable zoning');
  } else if (zoning.classification === 'challenging') {
    risks.push('Challenging zoning requirements');
  }
  
  // Permit complexity weight (20%)
  const permitScore = 100 - permit.complexityScore;
  score += (permitScore / 100) * 20;
  if (permit.complexityScore > 70) {
    risks.push(`Complex permitting (${permit.estimatedTimeline})`);
  }
  
  // Determine verdict
  let decision: 'PROCEED' | 'EVALUATE' | 'WALK';
  let recommendation: string;
  
  if (score >= 70 && feasibility.isViable && zoning.classification !== 'prohibited') {
    decision = 'PROCEED';
    recommendation = 'Strong fundamentals support development. Recommend proceeding to due diligence.';
  } else if (score >= 45 || (feasibility.isViable && zoning.classification !== 'prohibited')) {
    decision = 'EVALUATE';
    recommendation = 'Mixed signals. Further analysis recommended before commitment.';
  } else {
    decision = 'WALK';
    recommendation = 'Significant challenges identified. Consider alternative sites.';
  }
  
  const confidence = Math.min(0.95, score / 100);
  
  return {
    decision,
    confidence,
    keyFactors,
    risks,
    recommendation
  };
}

/**
 * Default calculator inputs
 */
export const DEFAULT_CALCULATOR_INPUTS: CalculatorInputs = {
  metalBuildingCostPerSqft: 23,
  concreteCostPerYard: 150,
  finishLaborCost: 2.50,
  landCost: 500000,
  capRateTarget: 0.065,
  marketRent10x10: 125,
  marketRent10x20: 175,
  acreageAvailable: 3
};
