import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ZipCodeMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isTokenSet, setIsTokenSet] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || !isTokenSet || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', async () => {
      // Fetch ZIP code data
      const { data: zipData, error } = await supabase
        .from('us_zip_codes')
        .select('zip, lat, lng, population, density')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .not('density', 'is', null);

      if (error) {
        console.error('Error fetching ZIP data:', error);
        return;
      }

      if (!zipData || zipData.length === 0) return;

      // Prepare GeoJSON for heatmap
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: zipData.map((zip) => ({
          type: 'Feature',
          properties: {
            density: zip.density || 0,
            population: zip.population || 0,
            zip: zip.zip,
          },
          geometry: {
            type: 'Point',
            coordinates: [zip.lng as number, zip.lat as number],
          },
        })),
      };

      // Add source
      map.current?.addSource('zip-codes', {
        type: 'geojson',
        data: geojson,
      });

      // Add heatmap layer
      map.current?.addLayer({
        id: 'zip-heatmap',
        type: 'heatmap',
        source: 'zip-codes',
        paint: {
          // Increase weight as density increases
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'density'],
            0, 0,
            1000, 1,
          ],
          // Increase intensity as zoom level increases
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 1,
            9, 3,
          ],
          // Color ramp for heatmap
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)',
          ],
          // Adjust radius based on zoom
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, 2,
            9, 20,
          ],
          // Transition from heatmap to circle layer by zoom level
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 1,
            9, 0,
          ],
        },
      });

      // Add circle layer for higher zoom levels
      map.current?.addLayer({
        id: 'zip-points',
        type: 'circle',
        source: 'zip-codes',
        minzoom: 7,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 1,
            16, 5,
          ],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'density'],
            0, 'rgb(33,102,172)',
            500, 'rgb(103,169,207)',
            1000, 'rgb(209,229,240)',
            2000, 'rgb(253,219,199)',
            5000, 'rgb(239,138,98)',
            10000, 'rgb(178,24,43)',
          ],
          'circle-stroke-color': 'white',
          'circle-stroke-width': 1,
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7, 0,
            8, 1,
          ],
        },
      });

      // Add popup on click
      map.current?.on('click', 'zip-points', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const { zip, density, population } = feature.properties as {
          zip: string;
          density: number;
          population: number;
        };

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `
            <div style="color: black; padding: 8px;">
              <strong>ZIP: ${zip}</strong><br/>
              Population: ${population?.toLocaleString() || 'N/A'}<br/>
              Density: ${density?.toFixed(2) || 'N/A'} per sq mi
            </div>
            `
          )
          .addTo(map.current!);
      });

      // Change cursor on hover
      map.current?.on('mouseenter', 'zip-points', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current?.on('mouseleave', 'zip-points', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [isTokenSet, mapboxToken]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mapboxToken.trim()) {
      setIsTokenSet(true);
    }
  };

  if (!isTokenSet) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-foreground">ZIP Code Population Density Map</h1>
          <p className="text-sm text-muted-foreground">
            Enter your Mapbox public token to view the map. Get your token from{' '}
            <a
              href="https://mapbox.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              mapbox.com
            </a>
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div>
              <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
              <Input
                id="mapbox-token"
                type="text"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                placeholder="pk.eyJ1..."
                className="mt-1"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load Map
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-xs">
        <h2 className="text-lg font-bold text-foreground mb-2">US ZIP Codes</h2>
        <p className="text-sm text-muted-foreground">
          Heat map showing population density across ZIP codes. Zoom in to see individual points.
        </p>
        <div className="mt-3 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(33,102,172)' }}></div>
            <span className="text-muted-foreground">Low density</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(239,138,98)' }}></div>
            <span className="text-muted-foreground">Medium density</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(178,24,43)' }}></div>
            <span className="text-muted-foreground">High density</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZipCodeMap;
