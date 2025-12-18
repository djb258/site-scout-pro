import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { RADIUS_MILES } from './RadiusCircle';

interface CountyLayerProps {
  center: [number, number];
  visible: boolean;
  showLabels: boolean;
  onCountyCount: (count: number) => void;
}

interface CountyGeoJSON {
  type: 'FeatureCollection';
  features: Feature<Geometry, GeoJsonProperties>[];
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

// Calculate centroid of a polygon (simplified for GeoJSON)
const getPolygonCentroid = (geometry: Geometry): [number, number] => {
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  
  const extractCoords = (coords: number[][]) => {
    coords.forEach((coord) => {
      totalLng += coord[0];
      totalLat += coord[1];
      count++;
    });
  };

  if (geometry.type === 'Polygon' && geometry.coordinates) {
    extractCoords(geometry.coordinates[0] as number[][]);
  } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
    (geometry.coordinates as number[][][][]).forEach((polygon) => {
      extractCoords(polygon[0] as number[][]);
    });
  }
  
  return count > 0 ? [totalLat / count, totalLng / count] : [0, 0];
};

const COUNTY_GEOJSON_URL = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

const CountyLayer = ({ center, visible, showLabels, onCountyCount }: CountyLayerProps) => {
  const [geoData, setGeoData] = useState<CountyGeoJSON | null>(null);
  const [filteredData, setFilteredData] = useState<CountyGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch county GeoJSON data once
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(COUNTY_GEOJSON_URL);
        const data = await response.json();
        setGeoData(data);
      } catch (error) {
        console.error('Failed to fetch county GeoJSON:', error);
      }
      setLoading(false);
    };

    if (!geoData) {
      fetchData();
    }
  }, [geoData]);

  // Filter counties within radius when center changes
  useEffect(() => {
    if (!geoData || !visible) {
      setFilteredData(null);
      onCountyCount(0);
      return;
    }

    const filtered = geoData.features.filter((feature) => {
      const centroid = getPolygonCentroid(feature.geometry);
      const distance = haversineDistance(center[0], center[1], centroid[0], centroid[1]);
      return distance <= RADIUS_MILES;
    });

    setFilteredData({
      type: 'FeatureCollection',
      features: filtered,
    });
    onCountyCount(filtered.length);
  }, [geoData, center, visible, onCountyCount]);

  if (!visible || !filteredData || loading) return null;

  const style = () => ({
    color: '#3b82f6',
    weight: 1.5,
    fillColor: '#3b82f6',
    fillOpacity: 0.1,
  });

  const onEachFeature = (feature: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => {
    if (showLabels && feature.properties?.NAME) {
      layer.bindTooltip(feature.properties.NAME, {
        permanent: true,
        direction: 'center',
        className: 'county-label',
      });
    }
  };

  return (
    <GeoJSON
      key={`${center[0]}-${center[1]}-${showLabels}`}
      data={filteredData} 
      style={style}
      onEachFeature={showLabels ? onEachFeature : undefined}
    />
  );
};

export default CountyLayer;
