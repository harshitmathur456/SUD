/**
 * ANPR Extraction Storage Database — Sentinel Unified Grid
 * Manages local persistence, plate indexing, multi-camera route tracking,
 * and querying for extracted vehicle detections across Gujarat CCTV network.
 */

import { VEHICLE_DATABASE } from '../data/detections.js';

const STORAGE_KEY = 'sentinel_anpr_grid_db_v2';
const STATS_KEY = 'sentinel_anpr_stats_v2';

class ANPRStorageManager {
  constructor() {
    this.vehicles = {};
    this.lastScanStats = null;
    this.init();
  }

  init() {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      const savedStats = localStorage.getItem(STATS_KEY);

      if (savedData) {
        this.vehicles = JSON.parse(savedData);
      } else {
        // Seed with baseline vehicle database
        this.vehicles = JSON.parse(JSON.stringify(VEHICLE_DATABASE));
        this.persist();
      }

      if (savedStats) {
        this.lastScanStats = JSON.parse(savedStats);
      }
    } catch (err) {
      console.warn('LocalStorage error, falling back to in-memory store:', err);
      this.vehicles = JSON.parse(JSON.stringify(VEHICLE_DATABASE));
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.vehicles));
      if (this.lastScanStats) {
        localStorage.setItem(STATS_KEY, JSON.stringify(this.lastScanStats));
      }
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  /**
   * Returns all stored vehicle records
   */
  getAllVehicles() {
    return Object.values(this.vehicles);
  }

  /**
   * Get vehicle by plate number (normalized)
   */
  getVehicle(plateNumber) {
    if (!plateNumber) return null;
    const clean = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    for (const key in this.vehicles) {
      if (key.toUpperCase().replace(/[^A-Z0-9]/g, '') === clean) {
        return this.vehicles[key];
      }
    }
    return null;
  }

  /**
   * Save or update a vehicle record
   */
  saveVehicle(vehicle) {
    if (!vehicle || !vehicle.plate_number) return;
    const key = vehicle.plate_number.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.vehicles[key] = vehicle;
    this.persist();
  }

  /**
   * Add a detection record to a vehicle's multi-camera history
   */
  addDetection(plateNumber, detection) {
    const key = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!this.vehicles[key]) {
      this.vehicles[key] = {
        plate_number: plateNumber,
        vehicle_desc: detection.vehicle_desc || 'Unregistered Vehicle',
        owner: detection.owner || 'Standard Fleet Registration',
        color: detection.color || '#94a3b8',
        detections: []
      };
    }

    const v = this.vehicles[key];
    // Check if detection already exists
    const exists = v.detections.some(d => d.camera_id === detection.camera_id && d.timestamp_pts === detection.timestamp_pts);
    if (!exists) {
      v.detections.push(detection);
      // Sort chronologically by timestamp
      v.detections.sort((a, b) => a.timestamp_pts - b.timestamp_pts);
      this.persist();
    }
  }

  /**
   * Records completed scan stats
   */
  setScanStats(stats) {
    this.lastScanStats = {
      ...stats,
      scanned_at: new Date().toISOString()
    };
    this.persist();
  }

  getScanStats() {
    return this.lastScanStats;
  }

  /**
   * Returns summary counts
   */
  getSummary() {
    const totalVehicles = Object.keys(this.vehicles).length;
    let totalDetections = 0;
    const camerasSpotted = new Set();
    let watchlistHits = 0;

    Object.values(this.vehicles).forEach(v => {
      if (v.is_watchlist_hit) watchlistHits++;
      if (Array.isArray(v.detections)) {
        totalDetections += v.detections.length;
        v.detections.forEach(d => camerasSpotted.add(d.camera_id));
      }
    });

    return {
      totalVehicles,
      totalDetections,
      uniqueCameras: camerasSpotted.size,
      watchlistHits
    };
  }

  /**
   * Reset database to seed
   */
  resetToSeed() {
    this.vehicles = JSON.parse(JSON.stringify(VEHICLE_DATABASE));
    this.lastScanStats = null;
    this.persist();
  }
}

export const anprStorage = new ANPRStorageManager();
