import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { 
  CompetitorData, 
  calculateCompetitorMetrics, 
  AssetType, 
  ASSET_TYPE_LABELS, 
  ASSET_TYPE_COLORS 
} from "./CompetitorCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type RentTier = "low" | "medium" | "high" | "unknown";

function getRentTier(avgPricePerSqft: number | null): RentTier {
  if (avgPricePerSqft === null) return "unknown";
  if (avgPricePerSqft < 0.75) return "low";
  if (avgPricePerSqft < 1.25) return "medium";
  return "high";
}

function getTierColor(tier: RentTier): string {
  switch (tier) {
    case "low": return "#10b981";    // emerald
    case "medium": return "#f59e0b"; // amber
    case "high": return "#ef4444";   // red
    default: return "#6b7280";       // gray
  }
}

interface CompetitorMapProps {
  competitors: CompetitorData[];
  centerZip?: { lat: number; lng: number };
  mapboxToken?: string;
}

export function CompetitorMap({ 
  competitors, 
  centerZip, 
  mapboxToken: propToken
}: CompetitorMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  
  const [token, setToken] = useState(propToken || "");
  const [isTokenSet, setIsTokenSet] = useState(!!propToken);
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorData | null>(null);

  // Filter competitors with valid coordinates
  const mappableCompetitors = competitors.filter(c => c.lat !== null && c.lng !== null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !isTokenSet || !token) return;

    mapboxgl.accessToken = token;

    // Calculate center from competitors or use provided center
    let center: [number, number] = [-98.5795, 39.8283]; // Default: center of US
    if (centerZip?.lat && centerZip?.lng) {
      center = [centerZip.lng, centerZip.lat];
    } else if (mappableCompetitors.length > 0) {
      const avgLat = mappableCompetitors.reduce((sum, c) => sum + c.lat!, 0) / mappableCompetitors.length;
      const avgLng = mappableCompetitors.reduce((sum, c) => sum + c.lng!, 0) / mappableCompetitors.length;
      center = [avgLng, avgLat];
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: mappableCompetitors.length > 0 ? 10 : 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [isTokenSet, token]);

  // Add markers when map loads or competitors change
  useEffect(() => {
    if (!map.current || !isTokenSet) return;

    const addMarkers = () => {
      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      mappableCompetitors.forEach((competitor) => {
        const metrics = calculateCompetitorMetrics(competitor);
        const tier = getRentTier(metrics.avg_price_per_sqft);
        const color = getTierColor(tier);

        // Create custom marker element
        const el = document.createElement("div");
        el.className = "competitor-marker";
        el.style.cssText = `
          width: 24px;
          height: 24px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          transition: transform 0.2s;
        `;
        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.2)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([competitor.lng!, competitor.lat!])
          .addTo(map.current!);

        // Click handler
        el.addEventListener("click", () => {
          setSelectedCompetitor(competitor);
        });

        markersRef.current.push(marker);
      });
    };

    if (map.current.loaded()) {
      addMarkers();
    } else {
      map.current.on("load", addMarkers);
    }
  }, [mappableCompetitors, isTokenSet]);

  // Fit bounds to show all markers
  useEffect(() => {
    if (!map.current || mappableCompetitors.length < 2) return;

    const bounds = new mapboxgl.LngLatBounds();
    mappableCompetitors.forEach(c => {
      bounds.extend([c.lng!, c.lat!]);
    });

    map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
  }, [mappableCompetitors]);

  const handleSetToken = () => {
    if (token.trim()) {
      setIsTokenSet(true);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return `$${value.toFixed(2)}`;
  };

  if (!isTokenSet) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Competitor Map
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your Mapbox public token to display competitors on the map.
            Get one at{" "}
            <a 
              href="https://mapbox.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              mapbox.com
            </a>
          </p>
          <div className="space-y-2">
            <Label htmlFor="mapbox-token">Mapbox Public Token</Label>
            <div className="flex gap-2">
              <Input
                id="mapbox-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pk.eyJ1Ijoi..."
                className="font-mono text-xs"
              />
              <Button onClick={handleSetToken} disabled={!token.trim()}>
                Set Token
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Legend */}
      <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-md p-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Low Rent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Medium Rent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>High Rent</span>
        </div>
      </div>

      {/* Selected Competitor Popup */}
      {selectedCompetitor && (
        <div className="absolute bottom-3 left-3 right-3 bg-background/95 backdrop-blur-sm rounded-md p-3 border border-border">
          <button 
            onClick={() => setSelectedCompetitor(null)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{selectedCompetitor.name}</h4>
            <Badge 
              variant="outline" 
              className={`text-[10px] ${ASSET_TYPE_COLORS[selectedCompetitor.asset_type].bg} ${ASSET_TYPE_COLORS[selectedCompetitor.asset_type].text} ${ASSET_TYPE_COLORS[selectedCompetitor.asset_type].border}`}
            >
              {ASSET_TYPE_LABELS[selectedCompetitor.asset_type]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{selectedCompetitor.address}</p>
          <div className="flex gap-4 mt-2 text-xs">
            <span>ZIP: {selectedCompetitor.zip}</span>
            <span>
              Avg $/Sqft: {formatCurrency(calculateCompetitorMetrics(selectedCompetitor).avg_price_per_sqft)}
            </span>
            <span>Units: {selectedCompetitor.units.length}</span>
          </div>
        </div>
      )}

      {/* No data overlay */}
      {mappableCompetitors.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <p className="text-sm text-muted-foreground">No competitors with coordinates to display</p>
        </div>
      )}
    </div>
  );
}
