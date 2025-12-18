import { MapContainer, TileLayer, Circle, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Sample data for demonstration
const sampleFacilities = [
  { id: 1, lat: 39.0997, lng: -94.5786, name: "Kansas City Storage", sqft: 45000 },
  { id: 2, lat: 39.1155, lng: -94.6268, name: "Westside Self Storage", sqft: 32000 },
  { id: 3, lat: 39.0473, lng: -94.5885, name: "Midtown Mini Storage", sqft: 28000 },
];

const HiveMap = () => {
  const defaultCenter: [number, number] = [39.0997, -94.5786]; // Kansas City
  const defaultZoom = 11;

  return (
    <div className="h-full w-full">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Trade area circle */}
        <Circle
          center={defaultCenter}
          radius={8000}
          pathOptions={{
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5'
          }}
        />

        {/* Facility markers */}
        {sampleFacilities.map((facility) => (
          <CircleMarker
            key={facility.id}
            center={[facility.lat, facility.lng]}
            radius={8}
            pathOptions={{
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{facility.name}</strong>
                <br />
                {facility.sqft.toLocaleString()} sqft
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default HiveMap;
