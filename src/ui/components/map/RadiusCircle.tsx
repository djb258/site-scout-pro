import { Circle } from 'react-leaflet';

interface RadiusCircleProps {
  center: [number, number];
  visible: boolean;
}

// 120 miles in meters = 120 * 1609.34 = 193,121 meters
const RADIUS_MILES = 120;
const RADIUS_METERS = RADIUS_MILES * 1609.34;

const RadiusCircle = ({ center, visible }: RadiusCircleProps) => {
  if (!visible) return null;

  return (
    <Circle
      center={center}
      radius={RADIUS_METERS}
      pathOptions={{
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '8, 8',
      }}
    />
  );
};

export default RadiusCircle;
export { RADIUS_MILES, RADIUS_METERS };
