import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import { ArrowLeft, Layers } from "lucide-react";
import { WithId } from "@/components/hive/WithId";
import "leaflet/dist/leaflet.css";

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function HiveMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storedZip = localStorage.getItem("hive_current_zip");
  const zip = searchParams.get("zip") || storedZip || "15522";

  const [centerCoords, setCenterCoords] = useState<[number, number]>([40.0185, -78.5039]);
  const [mapZoom, setMapZoom] = useState(8);
  const [showRadius, setShowRadius] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);

  // Demo data
  const facilities = [
    { id: 1, name: "Storage Pro Bedford", lat: 40.0185, lng: -78.5039, rating: 4.2 },
    { id: 2, name: "U-Haul Moving & Storage", lat: 40.0285, lng: -78.4939, rating: 4.0 },
    { id: 3, name: "Extra Space Storage", lat: 39.9985, lng: -78.5239, rating: 4.5 },
  ];

  return (
    <WithId id="MAP-001" name="Map Page" className="flex-1 bg-background flex">
      {/* Sidebar */}
      <div className="w-72 bg-card border-r border-border p-4 overflow-y-auto flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/screener")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            New Search
          </button>
        </div>

        <div className="mb-6">
          <div className="text-xs font-semibold text-muted-foreground mb-1">ANALYZED ZIP</div>
          <div className="text-3xl font-bold text-primary">{zip}</div>
          <div className="text-muted-foreground">Bedford, PA</div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <div className="bg-secondary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">8</div>
            <div className="text-xs text-muted-foreground">Counties</div>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">42</div>
            <div className="text-xs text-muted-foreground">Facilities</div>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">156</div>
            <div className="text-xs text-muted-foreground">Housing</div>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">23</div>
            <div className="text-xs text-muted-foreground">Anchors</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
            <Layers className="w-4 h-4" />
            MAP LAYERS
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showRadius}
                onChange={() => setShowRadius(!showRadius)}
                className="rounded"
              />
              <span className="text-foreground/80">120mi Radius</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showFacilities}
                onChange={() => setShowFacilities(!showFacilities)}
                className="rounded"
              />
              <span className="text-foreground/80">Storage Facilities ({facilities.length})</span>
            </label>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={centerCoords}
          zoom={mapZoom}
          style={{ height: "100%", width: "100%" }}
        >
          <MapUpdater center={centerCoords} zoom={mapZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {showRadius && (
            <Circle
              center={centerCoords}
              radius={193000} // ~120 miles
              pathOptions={{
                color: "#f59e0b",
                fillColor: "#f59e0b",
                fillOpacity: 0.05,
                weight: 2,
                dashArray: "5, 10",
              }}
            />
          )}

          {showFacilities &&
            facilities.map((f) => (
              <CircleMarker
                key={f.id}
                center={[f.lat, f.lng]}
                radius={8}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#3b82f6",
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{f.name}</strong>
                    <br />
                    Rating: {f.rating}★
                  </div>
                </Popup>
              </CircleMarker>
            ))}
        </MapContainer>
      </div>
    </WithId>
  );
}
