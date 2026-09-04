import { POLICE_STATIONS } from '../data/stations.js';

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the nearest police station from given coordinates
 * Returns nearest station object, distance in km, and estimated dispatch response time (minutes)
 */
export function findNearestPoliceStation(lat, lng) {
  if (!lat || !lng || !POLICE_STATIONS.length) return null;

  let nearest = null;
  let minDistance = Infinity;

  for (const station of POLICE_STATIONS) {
    const dist = calculateDistanceKm(lat, lng, station.lat, station.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = station;
    }
  }

  // Estimate response time assuming average 40 km/h urban emergency response + 3 min dispatch latency
  const estimatedResponseMinutes = Math.max(3, Math.round((minDistance / 40) * 60) + 3);

  return {
    ...nearest,
    station: nearest,
    name: nearest?.name || 'Nearest Police Unit',
    district: nearest?.district || 'Jurisdiction PS',
    distance_km: parseFloat(minDistance.toFixed(2)),
    distanceKm: parseFloat(minDistance.toFixed(2)),
    eta_minutes: estimatedResponseMinutes,
    etaMinutes: estimatedResponseMinutes
  };
}

/**
 * Issue police dispatch alert to station
 */
export function issuePoliceDispatch(stationName, plateNumber) {
  return {
    success: true,
    dispatch_id: `DISP-GUJ-${Date.now()}`,
    target_plate: plateNumber,
    dispatched_station: stationName,
    timestamp: new Date().toISOString()
  };
}
