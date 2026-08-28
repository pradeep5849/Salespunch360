const EARTH_RADIUS_METERS = 6_371_000;

export type Coordinate = { latitude: number; longitude: number };

export function haversineDistanceMeters(a: Coordinate, b: Coordinate) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitude1 = radians(a.latitude);
  const latitude2 = radians(b.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value));
}

export function calculateRouteDistanceMeters(points: Coordinate[]) {
  return points.slice(1).reduce((total, point, index) => total + haversineDistanceMeters(points[index], point), 0);
}
