import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import LayerControls, { LayerState } from '@/components/map/LayerControls';
import RadiusCircle from '@/components/map/RadiusCircle';
import CountyLayer from '@/components/map/CountyLayer';
import ZipLayer from '@/components/map/ZipLayer';

// Component to handle map recenter
const MapRecenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const HiveMap = () => {
  const [centerZip, setCenterZip] = useState('15522'); // Bedford, PA
  const [center, setCenter] = useState<[number, number]>([40.0168, -78.5036]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [layers, setLayers] = useState<LayerState>({
    radius: true,
    countyLines: true,
    countyLabels: false,
    zipPoints: false,
    zipLabels: false,
  });

  const [stats, setStats] = useState({
    countiesInRadius: 0,
    zipsInRadius: 0,
  });

  // Lookup ZIP coordinates from database
  const handleCenterChange = async (zip: string) => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('us_zip_codes')
      .select('lat, lng')
      .eq('zip', zip)
      .single();

    if (data?.lat && data?.lng) {
      setCenterZip(zip);
      setCenter([data.lat, data.lng]);
    } else {
      console.error('ZIP not found:', zip, error);
    }
    
    setIsLoading(false);
  };

  const handleLayerToggle = (layer: keyof LayerState) => {
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  const handleCountyCount = useCallback((count: number) => {
    setStats((prev) => ({ ...prev, countiesInRadius: count }));
  }, []);

  const handleZipCount = useCallback((count: number) => {
    setStats((prev) => ({ ...prev, zipsInRadius: count }));
  }, []);

  return (
    <div className="h-screen w-full flex bg-background">
      {/* Sidebar */}
      <LayerControls
        centerZip={centerZip}
        onCenterChange={handleCenterChange}
        layers={layers}
        onLayerToggle={handleLayerToggle}
        stats={stats}
        isLoading={isLoading}
      />

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          minZoom={5}
          maxZoom={18}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapRecenter center={center} />
          
          {/* Layers in proper z-order */}
          <RadiusCircle center={center} visible={layers.radius} />
          
          <CountyLayer
            center={center}
            visible={layers.countyLines}
            showLabels={layers.countyLabels}
            onCountyCount={handleCountyCount}
          />
          
          <ZipLayer
            center={center}
            visible={layers.zipPoints}
            showLabels={layers.zipLabels}
            onZipCount={handleZipCount}
          />
        </MapContainer>
      </div>
    </div>
  );
};

export default HiveMap;
