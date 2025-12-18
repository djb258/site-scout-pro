import { useEffect, useState } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { supabase } from '@/integrations/supabase/client';
import { RADIUS_MILES } from './RadiusCircle';

interface ZipLayerProps {
  center: [number, number];
  visible: boolean;
  showLabels: boolean;
  onZipCount: (count: number) => void;
}

interface ZipData {
  zip: string;
  lat: number;
  lng: number;
  city: string | null;
  county_name: string | null;
  population: number | null;
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

// Color based on population
const getPopulationColor = (population: number | null): string => {
  if (!population) return '#9ca3af';
  if (population > 50000) return '#dc2626';
  if (population > 20000) return '#f97316';
  if (population > 10000) return '#eab308';
  if (population > 5000) return '#22c55e';
  return '#3b82f6';
};

const ZipLayer = ({ center, visible, showLabels, onZipCount }: ZipLayerProps) => {
  const [zips, setZips] = useState<ZipData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setZips([]);
      onZipCount(0);
      return;
    }

    const fetchZips = async () => {
      setLoading(true);
      
      // Calculate bounding box (rough filter, ~2 degrees is ~140 miles at mid latitudes)
      const latBuffer = 2.5;
      const lngBuffer = 3.0;
      
      const { data, error } = await supabase
        .from('us_zip_codes')
        .select('zip, lat, lng, city, county_name, population')
        .gte('lat', center[0] - latBuffer)
        .lte('lat', center[0] + latBuffer)
        .gte('lng', center[1] - lngBuffer)
        .lte('lng', center[1] + lngBuffer)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) {
        console.error('Failed to fetch ZIP codes:', error);
        setLoading(false);
        return;
      }

      // Filter by actual haversine distance
      const filtered = (data || []).filter((zip) => {
        if (!zip.lat || !zip.lng) return false;
        const distance = haversineDistance(center[0], center[1], zip.lat, zip.lng);
        return distance <= RADIUS_MILES;
      });

      setZips(filtered as ZipData[]);
      onZipCount(filtered.length);
      setLoading(false);
    };

    fetchZips();
  }, [center, visible, onZipCount]);

  if (!visible || loading) return null;

  return (
    <>
      {zips.map((zip) => (
        <CircleMarker
          key={zip.zip}
          center={[zip.lat, zip.lng]}
          radius={showLabels ? 6 : 4}
          pathOptions={{
            color: getPopulationColor(zip.population),
            fillColor: getPopulationColor(zip.population),
            fillOpacity: 0.7,
            weight: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -5]}>
            <div className="text-xs">
              <div className="font-semibold">{zip.zip}</div>
              <div>{zip.city || 'Unknown'}, {zip.county_name || 'Unknown'}</div>
              <div>Pop: {zip.population?.toLocaleString() || 'N/A'}</div>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
};

export default ZipLayer;
