// Pass 1 Calculator Module - Client-side calculations from Pass 1 JSON

export interface Pass1Data {
  zip_metadata: any;
  radius_counties: any[];
  competitors: any[];
  housing_signals: any;
  anchors: any[];
  rv_lake_signals: any;
  industrial_signals: any;
  analysis_summary: any;
}

export interface Pass1Flags {
  urban_exclude: boolean;
  multifamily_priority: boolean;
  recreation_load: boolean;
  industrial_momentum: boolean;
  analysis_mode: string;
}

export interface RadiusResult {
  totalCounties: number;
  totalPopulation: number;
  avgPopulation: number;
  counties: string[];
}

export interface CompetitorDensityResult {
  count: number;
  totalSqft: number;
  avgDistance: number;
  densityScore: number; // 0-100, lower is better (less competition)
}

export interface MultifamilyResult {
  influence: 'high' | 'moderate' | 'low';
  score: number;
  homeOwnershipRate: number;
  rentMedian: number;
}

export interface IndustrialResult {
  score: number;
  distributionCenters: number;
  manufacturingPresence: string;
  momentum: 'strong' | 'moderate' | 'weak';
}

export interface RecreationResult {
  rvPotential: string;
  lakeProximity: boolean;
  campgroundNearby: boolean;
  score: number;
}

export interface Pass1SummaryResult {
  viabilityScore: number;
  recommendation: string;
  keyFactors: string[];
  riskFactors: string[];
  tier: 'A' | 'B' | 'C' | 'D';
}

/**
 * Calculate radius enumeration - counties within 120-mile radius
 */
export function calculateRadiusEnumeration(pass1Data: Pass1Data): RadiusResult {
  const counties = pass1Data.radius_counties || [];
  const totalPopulation = counties.reduce((sum: number, c: any) => sum + (c.population || 0), 0);
  
  return {
    totalCounties: counties.length,
    totalPopulation,
    avgPopulation: counties.length > 0 ? Math.round(totalPopulation / counties.length) : 0,
    counties: counties.map((c: any) => c.county || c.name).filter(Boolean)
  };
}

/**
 * Calculate competitor density score
 */
export function calculateCompetitorDensity(pass1Data: Pass1Data): CompetitorDensityResult {
  const competitors = pass1Data.competitors || [];
  const totalSqft = competitors.reduce((sum: number, c: any) => sum + (c.estimated_sqft || 0), 0);
  const avgDistance = competitors.length > 0 
    ? competitors.reduce((sum: number, c: any) => sum + (c.distance_miles || 0), 0) / competitors.length 
    : 0;
  
  // Density score: fewer competitors + further away = higher score (better)
  // 0-3 competitors within 5mi = low density (score 80-100)
  // 4-6 competitors = moderate (score 50-79)
  // 7+ competitors = high density (score 0-49)
  let densityScore = 100;
  if (competitors.length >= 7) {
    densityScore = Math.max(0, 50 - (competitors.length - 7) * 5);
  } else if (competitors.length >= 4) {
    densityScore = 80 - (competitors.length - 4) * 10;
  } else {
    densityScore = 100 - competitors.length * 7;
  }
  
  // Adjust for average distance (closer = worse)
  if (avgDistance < 3) densityScore -= 15;
  else if (avgDistance < 5) densityScore -= 5;
  else if (avgDistance > 10) densityScore += 10;
  
  return {
    count: competitors.length,
    totalSqft,
    avgDistance: Math.round(avgDistance * 10) / 10,
    densityScore: Math.max(0, Math.min(100, densityScore))
  };
}

/**
 * Calculate multifamily influence on storage demand
 */
export function calculateMultifamilyInfluence(pass1Data: Pass1Data): MultifamilyResult {
  const housing = pass1Data.housing_signals || {};
  const homeOwnership = housing.home_ownership_rate || 0;
  const rentMedian = housing.rent_median || 0;
  
  // Higher renter population = higher multifamily influence = higher storage demand
  const renterRate = 1 - homeOwnership;
  let score = 0;
  let influence: 'high' | 'moderate' | 'low' = 'low';
  
  if (renterRate > 0.5) {
    influence = 'high';
    score = 80 + (renterRate - 0.5) * 40;
  } else if (renterRate > 0.3) {
    influence = 'moderate';
    score = 50 + (renterRate - 0.3) * 150;
  } else {
    influence = 'low';
    score = renterRate * 166;
  }
  
  // Bonus for higher rent areas (indicates transient population)
  if (rentMedian > 1500) score += 10;
  if (rentMedian > 2000) score += 10;
  
  return {
    influence,
    score: Math.min(100, Math.round(score)),
    homeOwnershipRate: homeOwnership,
    rentMedian
  };
}

/**
 * Calculate industrial quick score
 */
export function calculateIndustrialQuickScore(pass1Data: Pass1Data): IndustrialResult {
  const industrial = pass1Data.industrial_signals || {};
  const distCenters = industrial.distribution_centers_nearby || 0;
  const mfgPresence = industrial.manufacturing_presence || 'low';
  
  let score = 0;
  
  // Distribution centers are key demand drivers
  score += Math.min(40, distCenters * 15);
  
  // Manufacturing presence
  if (mfgPresence === 'high') score += 35;
  else if (mfgPresence === 'moderate') score += 20;
  else score += 5;
  
  // Industrial momentum flag bonus
  if (industrial.industrial_momentum) score += 15;
  
  let momentum: 'strong' | 'moderate' | 'weak' = 'weak';
  if (score >= 70) momentum = 'strong';
  else if (score >= 40) momentum = 'moderate';
  
  return {
    score: Math.min(100, score),
    distributionCenters: distCenters,
    manufacturingPresence: mfgPresence,
    momentum
  };
}

/**
 * Calculate recreation/RV/lake proximity score
 */
export function calculateRecreationProximity(pass1Data: Pass1Data): RecreationResult {
  const rv = pass1Data.rv_lake_signals || {};
  
  let score = 0;
  
  if (rv.rv_potential === 'high') score += 40;
  else if (rv.rv_potential === 'moderate') score += 20;
  
  if (rv.lake_proximity) score += 25;
  if (rv.campground_nearby) score += 20;
  if (rv.recreation_load) score += 15;
  
  return {
    rvPotential: rv.rv_potential || 'low',
    lakeProximity: rv.lake_proximity || false,
    campgroundNearby: rv.campground_nearby || false,
    score: Math.min(100, score)
  };
}

/**
 * Apply urban exclusion filter
 */
export function applyUrbanExclusion(pass1Data: Pass1Data, flags: Pass1Flags): { excluded: boolean; reason: string; density: number } {
  const density = pass1Data.zip_metadata?.density || 0;
  
  if (!flags.urban_exclude) {
    return { excluded: false, reason: 'Urban exclusion disabled', density };
  }
  
  // High density threshold (urban area)
  const URBAN_THRESHOLD = 3000; // people per sq mile
  
  if (density > URBAN_THRESHOLD) {
    return { 
      excluded: true, 
      reason: `Density ${density.toFixed(0)}/sqmi exceeds urban threshold (${URBAN_THRESHOLD})`,
      density 
    };
  }
  
  return { excluded: false, reason: 'Passes urban exclusion filter', density };
}

/**
 * Compile comprehensive Pass 1 summary
 */
export function compilePass1Summary(pass1Data: Pass1Data, flags: Pass1Flags): Pass1SummaryResult {
  const radius = calculateRadiusEnumeration(pass1Data);
  const competitors = calculateCompetitorDensity(pass1Data);
  const multifamily = calculateMultifamilyInfluence(pass1Data);
  const industrial = calculateIndustrialQuickScore(pass1Data);
  const recreation = calculateRecreationProximity(pass1Data);
  const urbanCheck = applyUrbanExclusion(pass1Data, flags);
  
  const population = pass1Data.zip_metadata?.population || 0;
  const keyFactors: string[] = [];
  const riskFactors: string[] = [];
  
  // Calculate weighted viability score
  let viabilityScore = 0;
  
  // Population factor (20% weight)
  if (population > 50000) {
    viabilityScore += 20;
    keyFactors.push(`Strong population base (${population.toLocaleString()})`);
  } else if (population > 20000) {
    viabilityScore += 15;
    keyFactors.push(`Moderate population (${population.toLocaleString()})`);
  } else if (population > 10000) {
    viabilityScore += 10;
  } else {
    riskFactors.push(`Low population (${population.toLocaleString()})`);
  }
  
  // Competitor density (25% weight)
  viabilityScore += (competitors.densityScore / 100) * 25;
  if (competitors.densityScore > 70) {
    keyFactors.push(`Low competition (${competitors.count} facilities)`);
  } else if (competitors.densityScore < 40) {
    riskFactors.push(`High competition (${competitors.count} facilities)`);
  }
  
  // Industrial factor (15% weight, boosted if flag set)
  const industrialWeight = flags.industrial_momentum ? 20 : 15;
  viabilityScore += (industrial.score / 100) * industrialWeight;
  if (industrial.momentum === 'strong') {
    keyFactors.push('Strong industrial presence');
  }
  
  // Multifamily factor (15% weight, boosted if flag set)
  const multifamilyWeight = flags.multifamily_priority ? 20 : 15;
  viabilityScore += (multifamily.score / 100) * multifamilyWeight;
  if (multifamily.influence === 'high') {
    keyFactors.push('High multifamily demand driver');
  }
  
  // Recreation factor (10% weight, boosted if flag set)
  const recreationWeight = flags.recreation_load ? 15 : 10;
  viabilityScore += (recreation.score / 100) * recreationWeight;
  if (recreation.score > 50) {
    keyFactors.push('Recreation/RV storage opportunity');
  }
  
  // Regional coverage (15% weight)
  if (radius.totalCounties > 10) {
    viabilityScore += 15;
    keyFactors.push(`${radius.totalCounties} counties in market radius`);
  } else if (radius.totalCounties > 5) {
    viabilityScore += 10;
  } else {
    viabilityScore += 5;
    riskFactors.push('Limited regional market');
  }
  
  // Urban exclusion penalty
  if (urbanCheck.excluded) {
    viabilityScore = Math.max(0, viabilityScore - 30);
    riskFactors.push(urbanCheck.reason);
  }
  
  viabilityScore = Math.round(Math.min(100, viabilityScore));
  
  // Determine tier
  let tier: 'A' | 'B' | 'C' | 'D';
  let recommendation: string;
  
  if (viabilityScore >= 75) {
    tier = 'A';
    recommendation = 'Strong candidate - proceed to Pass 2 deep dive';
  } else if (viabilityScore >= 55) {
    tier = 'B';
    recommendation = 'Moderate potential - Pass 2 recommended for validation';
  } else if (viabilityScore >= 35) {
    tier = 'C';
    recommendation = 'Marginal opportunity - review risks before proceeding';
  } else {
    tier = 'D';
    recommendation = 'Poor fit - consider alternative locations';
  }
  
  return {
    viabilityScore,
    recommendation,
    keyFactors,
    riskFactors,
    tier
  };
}
