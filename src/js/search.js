import { VEHICLE_DATABASE } from '../data/detections.js';
import { anprStorage } from './anprStorage.js';
import { CAMERAS } from '../data/cameras.js';

/**
 * Normalizes vehicle registration plates:
 * Removes whitespaces, dashes, dots, and converts to uppercase
 */
export function normalizePlate(plate) {
  if (!plate) return '';
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Computes Levenshtein edit distance between two strings
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Checks fuzzy similarity taking common OCR confusions into account:
 * 0 <-> O, 1 <-> I, 8 <-> B, 5 <-> S, 2 <-> Z
 */
function isOcrFuzzyMatch(queryNorm, targetNorm) {
  if (queryNorm === targetNorm) return true;
  if (Math.abs(queryNorm.length - targetNorm.length) > 1) return false;

  // Basic Levenshtein check
  if (levenshteinDistance(queryNorm, targetNorm) <= 1) return true;

  // OCR phonetic / visual character replacement test
  const ocrReplacements = [
    [/0/g, 'O'],
    [/1/g, 'I'],
    [/8/g, 'B'],
    [/5/g, 'S'],
    [/2/g, 'Z']
  ];

  let simQuery = queryNorm;
  let simTarget = targetNorm;

  for (const [pattern, replacement] of ocrReplacements) {
    simQuery = simQuery.replace(pattern, replacement);
    simTarget = simTarget.replace(pattern, replacement);
  }

  return levenshteinDistance(simQuery, simTarget) <= 1;
}

/**
 * Calculates haversine distance between two coordinates in km
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
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
 * Augments vehicle data with rich multi-camera route statistics
 */
function enrichVehicleRouteStats(vehicle) {
  if (!vehicle || !vehicle.detections || vehicle.detections.length === 0) {
    return vehicle;
  }

  const dets = vehicle.detections;
  const uniqueCamIds = new Set(dets.map(d => d.camera_id));
  const cameraLocations = [];
  const districts = new Set();
  let totalDistanceKm = 0;
  let totalSpeed = 0;

  for (let i = 0; i < dets.length; i++) {
    const d = dets[i];
    totalSpeed += (d.speed_est_kmh || 40);
    const cam = CAMERAS.find(c => c.id === d.camera_id);
    if (cam) {
      cameraLocations.push({
        camera_id: cam.id,
        name: cam.name,
        location: cam.location_text,
        city: cam.city,
        district: cam.district,
        lat: cam.lat,
        lng: cam.lng,
        timestamp: d.timestamp_utc
      });
      if (cam.district) districts.add(cam.district);
    }

    // Distance between sequential hops
    if (i > 0) {
      const prevCam = CAMERAS.find(c => c.id === dets[i - 1].camera_id);
      if (cam && prevCam) {
        totalDistanceKm += calculateDistanceKm(prevCam.lat, prevCam.lng, cam.lat, cam.lng);
      }
    }
  }

  // Calculate elapsed time
  const firstPts = dets[0].timestamp_pts || 0;
  const lastPts = dets[dets.length - 1].timestamp_pts || 0;
  const durationMs = Math.max(0, lastPts - firstPts);
  const durationMin = Math.round(durationMs / 60000);

  vehicle.routeStats = {
    totalHops: dets.length,
    uniqueCamerasCount: uniqueCamIds.size,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    durationMinutes: durationMin,
    avgSpeedKmh: Math.round(totalSpeed / dets.length),
    firstSeen: dets[0].timestamp_utc,
    lastSeen: dets[dets.length - 1].timestamp_utc,
    firstCamera: cameraLocations[0] || null,
    lastCamera: cameraLocations[cameraLocations.length - 1] || null,
    districtsTraversed: Array.from(districts),
    cameraLocations
  };

  return vehicle;
}

/**
 * Search vehicles by plate number supporting exact, fuzzy, and partial matches
 * against both dynamic Grid Storage and baseline database.
 */
export function searchVehicle(plateQuery) {
  const query = normalizePlate(plateQuery);
  if (!query) return null;

  // Merge dynamic storage vehicles with baseline database
  const storageVehicles = anprStorage.getAllVehicles();
  const allVehicles = {};

  // Baseline database
  for (const key in VEHICLE_DATABASE) {
    allVehicles[normalizePlate(key)] = JSON.parse(JSON.stringify(VEHICLE_DATABASE[key]));
  }

  // Overlay dynamic storage
  storageVehicles.forEach(v => {
    if (v && v.plate_number) {
      allVehicles[normalizePlate(v.plate_number)] = v;
    }
  });

  // 1. Exact Match Check
  if (allVehicles[query]) {
    return {
      isMatch: true,
      isFuzzy: false,
      matchedPlate: allVehicles[query].plate_number,
      vehicle: enrichVehicleRouteStats(allVehicles[query])
    };
  }

  // 2. Fuzzy Match Check (OCR misreads: 0/O, 1/I, 8/B)
  for (const normKey in allVehicles) {
    if (isOcrFuzzyMatch(query, normKey)) {
      return {
        isMatch: true,
        isFuzzy: true,
        matchedPlate: allVehicles[normKey].plate_number,
        vehicle: enrichVehicleRouteStats(allVehicles[normKey])
      };
    }
  }

  // 3. Substring / Prefix match if query length >= 4
  if (query.length >= 4) {
    for (const normKey in allVehicles) {
      if (normKey.includes(query) || query.includes(normKey)) {
        return {
          isMatch: true,
          isFuzzy: true,
          matchedPlate: allVehicles[normKey].plate_number,
          vehicle: enrichVehicleRouteStats(allVehicles[normKey])
        };
      }
    }
  }

  return {
    isMatch: false,
    query
  };
}

/**
 * Auto-suggest vehicle plates matching user typed input
 */
export function getVehicleSuggestions(prefix) {
  const query = normalizePlate(prefix);
  if (!query || query.length < 2) return [];

  const storageVehicles = anprStorage.getAllVehicles();
  const suggestions = [];
  const seen = new Set();

  storageVehicles.forEach(v => {
    const norm = normalizePlate(v.plate_number);
    if ((norm.includes(query) || isOcrFuzzyMatch(query, norm.slice(0, query.length))) && !seen.has(norm)) {
      seen.add(norm);
      suggestions.push({
        plate_number: v.plate_number,
        vehicle_desc: v.vehicle_desc,
        detections_count: v.detections ? v.detections.length : 0,
        is_watchlist: !!v.is_watchlist_hit
      });
    }
  });

  return suggestions.slice(0, 5);
}

/**
 * Generate formal evidence packet metadata report
 */
export function generateEvidencePacket(vehicle) {
  if (!vehicle) return null;

  const packet = {
    report_id: `EVID-SENTINEL-${Date.now()}`,
    generated_at: new Date().toISOString(),
    organization: "Gujarat Police Unified Surveillance Grid - ANPR Division",
    vehicle_registration: vehicle.plate_number,
    vehicle_description: vehicle.vehicle_desc,
    registered_owner: vehicle.owner,
    watchlist_flag: vehicle.is_watchlist_hit ? "CRITICAL INTERCEPT FLAGGED" : "CLEAR / UNRESTRICTED",
    detection_count: vehicle.detections.length,
    first_seen: vehicle.detections[0].timestamp_utc,
    last_seen: vehicle.detections[vehicle.detections.length - 1].timestamp_utc,
    route_metrics: vehicle.routeStats || null,
    timeline: vehicle.detections.map((d, idx) => ({
      hop_number: idx + 1,
      hop_id: d.id,
      camera_id: d.camera_id,
      location: d.location_name,
      pts_timestamp: d.timestamp_pts,
      utc_timestamp: d.timestamp_utc,
      ocr_confidence_score: `${d.confidence}%`,
      speed_estimate: `${d.speed_est_kmh} km/h`,
      evidence_buffer_status: `Local detection clip captured (${d.clip_duration_s}s)`
    })),
    legal_compliance_notice: "Evidence clips captured via detection-triggered rolling buffer per PRD Section 5.2. Verified PTS timecodes."
  };

  return packet;
}
