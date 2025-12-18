import { useEffect, useState } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { supabase } from '@/integrations/supabase/client';
import { RADIUS_MILES } from './RadiusCircle';

interface DemandLayerProps {
  center: [number, number];
  visible: boolean;
}

interface ZipDemandData {
  zip: string;
  lat: number;
  lng: number;
  city: string | null;
  county_name: string | null;
  population: number | null;
  density: number | null;
  income_household_median: number | null;
  home_value: number | null;
  demandScore: number;
  scores: {
    population: number;
    density: number;
    income: number;
    housing: number;
  };
}

// Haversine distance calculation in miles
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate individual scores (capped at 100)
const calculateScores = (zip: {
  population: number | null;
  density: number | null;
  income_household_median: number | null;
  home_value: number | null;
}) => {
  const populationScore = Math.min(100, Math.round(((zip.population || 0) / 50000) * 100));
  const densityScore = Math.min(100, Math.round(((zip.density || 0) / 5000) * 100));
  const incomeScore = Math.min(100, Math.round(((zip.income_household_median || 0) / 100000) * 100));
  const housingScore = Math.min(100, Math.round(((zip.home_value || 0) / 300000) * 100));
  
  return {
    population: populationScore,
    density: densityScore,
    income: incomeScore,
    housing: housingScore,
  };
};

// Calculate weighted demand score
const calculateDemandScore = (scores: { population: number; density: number; income: number; housing: number }) => {
  // Weighted: Pop (25%), Density (20%), Income (25%), Housing (15%), Base (15%)
  const weighted = 
    scores.population * 0.25 +
    scores.density * 0.20 +
    scores.income * 0.25 +
    scores.housing * 0.15 +
    15; // Base score of 15
  return Math.round(weighted);
};

// Get color based on demand score
const getDemandColor = (score: number): string => {
  if (score >= 80) return '#dc2626'; // Red - High demand
  if (score >= 60) return '#f97316'; // Orange
  if (score >= 40) return '#eab308'; // Yellow
  if (score >= 20) return '#22c55e'; // Green
  return '#3b82f6'; // Blue - Low demand
};

// Get demand label
const getDemandLabel = (score: number): string => {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Below Avg';
  return 'Low';
};

const DemandLayer = ({ center, visible }: DemandLayerProps) => {
  const [zips, setZips] = useState<ZipDemandData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setZips([]);
      return;
    }

    const fetchZips = async () => {
      setLoading(true);
      
      // Calculate bounding box
      const latBuffer = 2.5;
      const lngBuffer = 3.0;
      
      const { data, error } = await supabase
        .from('us_zip_codes')
        .select('zip, lat, lng, city, county_name, population, density, income_household_median, home_value')
        .gte('lat', center[0] - latBuffer)
        .lte('lat', center[0] + latBuffer)
        .gte('lng', center[1] - lngBuffer)
        .lte('lng', center[1] + lngBuffer)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) {
        console.error('Failed to fetch ZIP codes for demand layer:', error);
        setLoading(false);
        return;
      }

      // Filter by haversine distance and calculate demand scores
      const processed = (data || [])
        .filter((zip) => {
          if (!zip.lat || !zip.lng) return false;
          const distance = haversineDistance(center[0], center[1], zip.lat, zip.lng);
          return distance <= RADIUS_MILES;
        })
        .map((zip) => {
          const scores = calculateScores(zip);
          const demandScore = calculateDemandScore(scores);
          return {
            ...zip,
            lat: zip.lat!,
            lng: zip.lng!,
            demandScore,
            scores,
          };
        });

      setZips(processed);
      setLoading(false);
    };

    fetchZips();
  }, [center, visible]);

  if (!visible || loading) return null;

  return (
    <>
      {zips.map((zip) => (
        <CircleMarker
          key={zip.zip}
          center={[zip.lat, zip.lng]}
          radius={8}
          pathOptions={{
            color: getDemandColor(zip.demandScore),
            fillColor: getDemandColor(zip.demandScore),
            fillOpacity: 0.75,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <div className="text-xs min-w-[180px]">
              <div className="font-bold text-sm border-b pb-1 mb-1">
                {zip.zip} - {zip.city || 'Unknown'}
              </div>
              <div className="text-muted-foreground mb-1">{zip.county_name || 'Unknown'} County</div>
              
              <div className="space-y-0.5 border-t pt-1 mt-1">
                <div className="flex justify-between">
                  <span>Population:</span>
                  <span className="font-mono">{zip.population?.toLocaleString() || 'N/A'} ({zip.scores.population})</span>
                </div>
                <div className="flex justify-between">
                  <span>Density:</span>
                  <span className="font-mono">{zip.density?.toLocaleString() || 'N/A'}/mi² ({zip.scores.density})</span>
                </div>
                <div className="flex justify-between">
                  <span>Income:</span>
                  <span className="font-mono">${zip.income_household_median?.toLocaleString() || 'N/A'} ({zip.scores.income})</span>
                </div>
                <div className="flex justify-between">
                  <span>Home Value:</span>
                  <span className="font-mono">${zip.home_value?.toLocaleString() || 'N/A'} ({zip.scores.housing})</span>
                </div>
              </div>
              
              <div className="border-t pt-1 mt-1 flex justify-between font-bold">
                <span>Demand Score:</span>
                <span style={{ color: getDemandColor(zip.demandScore) }}>
                  {zip.demandScore} ({getDemandLabel(zip.demandScore)})
                </span>
              </div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
};

export default DemandLayer;
