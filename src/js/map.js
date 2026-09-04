import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMERAS } from '../data/cameras.js';
import { POLICE_STATIONS } from '../data/stations.js';
import { GUJARAT_GEOJSON } from '../data/gujaratBoundary.js';
import { openStreamModal } from './streamViewer.js';
import { findNearestPoliceStation } from './dispatch.js';

export class SentinelMap {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;

    // Strict Gujarat Geographic Bounds
    this.gujaratBounds = L.latLngBounds([20.0, 68.1], [24.75, 74.45]);

    // Layer Groups
    this.cameraLayer = L.layerGroup();
    this.coverageCircleLayer = L.layerGroup();
    this.coverageConeLayer = L.layerGroup();
    this.stationLayer = L.layerGroup();
    this.routePolylineLayer = L.layerGroup();
    this.routeWaypointLayer = L.layerGroup();
    this.gapAnalysisLayer = L.layerGroup();
    this.gujaratBoundaryLayer = L.layerGroup();
    this.gujaratMaskLayer = L.layerGroup();

    // Clean Tile Layers (100% Free, High Resolution, ZERO "API Key" Watermarks)
    const esriDarkBase = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri, HERE, DeLorme, MapmyIndia', maxZoom: 18 }
    );

    const esriDarkRef = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      { attribution: '', maxZoom: 18 }
    );

    this.darkLayerGroup = L.layerGroup([esriDarkBase, esriDarkRef]);

    this.streetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri & OpenStreetMap contributors', maxZoom: 18 }
    );

    this.satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri & Maxar', maxZoom: 18 }
    );

    this.currentTileMode = 'dark';
    this.showCoverageCircles = true;
    this.showCoverageCones = false;
    this.showPoliceStations = true;
    this.showGapAnalysis = false;
    this.showGujaratMask = true;
    this.activeVehicleRoute = null;

    this.initMap();
  }

  initMap() {
    // Initialize map locked strictly to the State of Gujarat
    this.map = L.map(this.containerId, {
      center: [22.45, 71.85],
      zoom: 7.5,
      minZoom: 7.0,
      maxZoom: 18,
      maxBounds: this.gujaratBounds.pad(0.08), // Prevents user from panning outside Gujarat
      maxBoundsViscosity: 1.0,               // Hard rubber-band boundary stop
      zoomControl: false,
      layers: [this.darkLayerGroup]
    });

    // Custom Top-Right Zoom Control
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Initial fit to Gujarat state
    this.fitGujarat();

    // Add default layers
    this.gujaratMaskLayer.addTo(this.map);
    this.gujaratBoundaryLayer.addTo(this.map);
    this.cameraLayer.addTo(this.map);
    this.coverageCircleLayer.addTo(this.map);
    this.stationLayer.addTo(this.map);
    this.routePolylineLayer.addTo(this.map);
    this.routeWaypointLayer.addTo(this.map);

    // Render Gujarat Borders and Inverse Mask
    this.renderGujaratBoundaryAndMask();

    // Render datasets
    this.renderCameras();
    this.renderPoliceStations();
    this.initMapInteractions();
  }

  fitGujarat() {
    this.map.fitBounds(this.gujaratBounds, {
      padding: [30, 30],
      animate: true
    });
  }

  /**
   * Builds the official Gujarat boundary outline and an inverted outer mask
   * to dim and shadow everything outside Gujarat, spotlighting the state.
   */
  renderGujaratBoundaryAndMask() {
    this.gujaratBoundaryLayer.clearLayers();
    this.gujaratMaskLayer.clearLayers();

    // 1. Neon glowing cyan outline of Gujarat border
    const boundary = L.geoJSON(GUJARAT_GEOJSON, {
      style: {
        color: '#38bdf8',
        weight: 2.5,
        opacity: 0.9,
        fillColor: 'transparent',
        dashArray: null
      }
    });
    this.gujaratBoundaryLayer.addLayer(boundary);

    // 2. Inverted Outer Mask:
    // Outer polygon covers the world, inner rings are Gujarat boundary parts (holes).
    try {
      const outerWorldRing = [
        [-85, -180],
        [-85, 180],
        [85, 180],
        [85, -180]
      ];

      const gujaratHoles = [];
      const coords = GUJARAT_GEOJSON.geometry.coordinates;

      coords.forEach(part => {
        const ring = part[0]; // [lng, lat]
        const latLngRing = ring.map(pt => [pt[1], pt[0]]);
        gujaratHoles.push(latLngRing);
      });

      const maskPolygon = L.polygon([outerWorldRing, ...gujaratHoles], {
        fillColor: '#050811',
        fillOpacity: 0.88,
        stroke: false,
        interactive: false
      });

      this.gujaratMaskLayer.addLayer(maskPolygon);
    } catch (err) {
      console.warn('Could not construct inverted mask polygon:', err);
    }
  }

  initMapInteractions() {
    window.handleViewStream = (camId) => {
      const cam = CAMERAS.find(c => c.id === camId);
      if (cam) openStreamModal(cam);
    };

    window.handleDispatchFromCam = (camId) => {
      const cam = CAMERAS.find(c => c.id === camId);
      if (!cam) return;
      const res = findNearestPoliceStation(cam.lat, cam.lng);
      if (res && res.station) {
        alert(`🚓 NEAREST DISPATCH UNIT:\nStation: ${res.station.name}\nDistrict: ${res.station.district}\nContact: ${res.station.phone}\nDistance: ${res.distanceKm} km\nEstimated Response: ${res.etaMinutes} mins`);
      }
    };

    window.handleStationDial = (phone, name) => {
      alert(`📞 CONNECTING TO CONTROL ROOM:\nCalling: ${name}\nDirect Line: ${phone}`);
    };
  }

  setTileLayer(layerKey) {
    if (this.map.hasLayer(this.darkLayerGroup)) this.map.removeLayer(this.darkLayerGroup);
    if (this.map.hasLayer(this.streetLayer)) this.map.removeLayer(this.streetLayer);
    if (this.map.hasLayer(this.satelliteLayer)) this.map.removeLayer(this.satelliteLayer);

    this.currentTileMode = layerKey;

    if (layerKey === 'dark') {
      this.darkLayerGroup.addTo(this.map);
    } else if (layerKey === 'street') {
      this.streetLayer.addTo(this.map);
    } else if (layerKey === 'satellite') {
      this.satelliteLayer.addTo(this.map);
    }
  }

  renderCameras(statusFilter = 'all', searchQuery = '') {
    this.cameraLayer.clearLayers();
    this.coverageCircleLayer.clearLayers();
    this.coverageConeLayer.clearLayers();

    const query = searchQuery.toLowerCase().trim();

    CAMERAS.forEach(cam => {
      if (statusFilter !== 'all' && cam.status !== statusFilter) return;
      if (query && !cam.name.toLowerCase().includes(query) && !cam.location_text.toLowerCase().includes(query) && !cam.city.toLowerCase().includes(query)) {
        return;
      }

      // Camera Marker
      const markerHtml = `<div class="custom-camera-pin ${cam.status}" title="${cam.name} (${cam.status})">
        <i class="fas fa-video"></i>
      </div>`;

      const icon = L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const popupContent = `
        <div style="min-width: 250px; font-family: 'Outfit', sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 14px; color: #fff;">${cam.name}</strong>
            <span class="status-tag ${cam.status}">${cam.status}</span>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
            <i class="fas fa-map-marker-alt" style="color: #3b82f6; margin-right: 4px;"></i>
            ${cam.location_text}
          </p>
          <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
            <div>RES: <span style="color:#fff;">${cam.width && cam.height ? `${cam.width}x${cam.height}` : '0x0 (Degraded)'}</span></div>
            <div>CODEC: <span style="color:#fff;">${cam.codec ? cam.codec.toUpperCase() : 'N/A'}</span></div>
            <div>FPS: <span style="color:#fff;">${cam.fps || '0.0'}</span></div>
            <div>EST. RADIUS: <span style="color:#10b981;">${cam.coverage_radius_m}m</span></div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button onclick="window.handleViewStream(${cam.id})" style="flex: 1; padding: 6px 10px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
              <i class="fas fa-play"></i> Live Stream
            </button>
            <button onclick="window.handleDispatchFromCam(${cam.id})" style="padding: 6px 10px; background: rgba(255,255,255,0.08); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; font-size: 11px; cursor: pointer;">
              <i class="fas fa-shield-alt"></i> Dispatch
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([cam.lat, cam.lng], { icon }).bindPopup(popupContent);
      this.cameraLayer.addLayer(marker);

      // Coverage Circles (PRD Section 4.2)
      const circle = L.circle([cam.lat, cam.lng], {
        radius: cam.coverage_radius_m,
        color: cam.status === 'live' ? '#10b981' : cam.status === 'degraded' ? '#f59e0b' : '#ef4444',
        fillColor: cam.status === 'live' ? '#10b981' : cam.status === 'degraded' ? '#f59e0b' : '#ef4444',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: cam.status === 'degraded' ? '3, 4' : null
      }).bindTooltip(`Assumed Coverage: ${cam.coverage_radius_m}m (Estimated)`, { direction: 'top' });

      this.coverageCircleLayer.addLayer(circle);

      // Directional Cones (PRD Section 4.2)
      if (cam.heading_deg !== undefined) {
        const conePolygon = this.createFovConePolygon([cam.lat, cam.lng], cam.coverage_radius_m * 1.6, cam.heading_deg, 60);
        const cone = L.polygon(conePolygon, {
          color: '#06b6d4',
          fillColor: '#06b6d4',
          fillOpacity: 0.22,
          weight: 1.2
        }).bindTooltip(`Directional FOV: ${cam.heading_deg}°`, { direction: 'top' });
        this.coverageConeLayer.addLayer(cone);
      }
    });
  }

  createFovConePolygon(center, radiusMeters, headingDegrees, fovDegrees) {
    const lat = center[0];
    const lng = center[1];
    const coords = [[lat, lng]];

    const startAngle = headingDegrees - fovDegrees / 2;
    const endAngle = headingDegrees + fovDegrees / 2;
    const steps = 10;

    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (i / steps) * (endAngle - startAngle);
      const rad = (angle * Math.PI) / 180;
      const dLat = (radiusMeters * Math.cos(rad)) / 111320;
      const dLng = (radiusMeters * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
      coords.push([lat + dLat, lng + dLng]);
    }
    coords.push([lat, lng]);
    return coords;
  }

  renderPoliceStations(districtFilter = 'all') {
    this.stationLayer.clearLayers();

    POLICE_STATIONS.forEach(st => {
      if (districtFilter !== 'all' && st.district.toLowerCase() !== districtFilter.toLowerCase()) {
        return;
      }

      const markerHtml = `<div class="custom-police-pin" title="${st.name} (${st.district})">
        <i class="fas fa-building-shield"></i>
      </div>`;

      const icon = L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const precisionNotice = st.location_precision === 'city'
        ? `<div style="color: #fbbf24; font-size: 10px; margin-top: 4px;"><i class="fas fa-info-circle"></i> City-level geocoded (${st.location_precision} precision)</div>`
        : `<div style="color: #fda4af; font-size: 10px; margin-top: 4px;"><i class="fas fa-exclamation-triangle"></i> District-level fallback precision</div>`;

      const popupContent = `
        <div style="min-width: 240px; font-family: 'Outfit', sans-serif;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <i class="fas fa-shield-alt" style="color: #3b82f6;"></i>
            <strong style="font-size: 13px; color: #fff;">${st.name}</strong>
          </div>
          <p style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">${st.address}</p>
          <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 6px;">
            District: <strong style="color: #fff;">${st.district}</strong>
          </div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #38bdf8; margin-bottom: 8px;">
            <i class="fas fa-phone-alt"></i> ${st.phone || '100'}
          </div>
          ${precisionNotice}
          <div style="margin-top: 8px;">
            <button onclick="window.handleStationDial('${st.phone}', '${st.name}')" style="width: 100%; padding: 5px 8px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #93c5fd; border-radius: 4px; font-size: 11px; cursor: pointer;">
              <i class="fas fa-phone-volume"></i> Call Station Dispatch
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([st.lat, st.lng], { icon }).bindPopup(popupContent);
      this.stationLayer.addLayer(marker);
    });
  }

  plotVehicleRoute(vehicle) {
    this.routePolylineLayer.clearLayers();
    this.routeWaypointLayer.clearLayers();
    this.activeVehicleRoute = vehicle;

    if (!vehicle || !vehicle.detections || vehicle.detections.length === 0) return;

    const latLngs = [];
    const waypoints = [];

    vehicle.detections.forEach((det, idx) => {
      const cam = CAMERAS.find(c => c.id === det.camera_id);
      if (cam) {
        const point = [cam.lat, cam.lng];
        latLngs.push(point);
        waypoints.push({ ...det, lat: cam.lat, lng: cam.lng, index: idx + 1 });
      }
    });

    if (latLngs.length === 0) return;

    // Draw route segments
    for (let i = 0; i < latLngs.length - 1; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[i + 1];
      const isGap = waypoints[i].is_gap_hop;

      const polyline = L.polyline([p1, p2], {
        color: isGap ? '#f59e0b' : '#8b5cf6',
        weight: isGap ? 3 : 4,
        dashArray: isGap ? '6, 8' : null,
        opacity: 0.9
      });

      this.routePolylineLayer.addLayer(polyline);
    }

    // Numbered Waypoint Badges
    waypoints.forEach(wp => {
      const icon = L.divIcon({
        html: `<div class="custom-waypoint-pin" title="Waypoint ${wp.index}: ${wp.location_name}">
          ${wp.index}
        </div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const popup = `
        <div style="font-family: 'Outfit', sans-serif; min-width: 220px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="color: #c084fc; font-size: 13px;">HOP #${wp.index}</strong>
            <span style="font-family: 'JetBrains Mono'; font-size: 11px; color: #10b981;">${wp.confidence}% Match</span>
          </div>
          <div style="font-size: 12px; color: #fff; margin-bottom: 4px;">${wp.location_name}</div>
          <div style="font-family: 'JetBrains Mono'; font-size: 11px; color: #94a3b8; margin-bottom: 4px;">
            Time: ${wp.timestamp_utc}
          </div>
          <div style="font-size: 11px; color: #cbd5e1;">Speed Est: ${wp.speed_est_kmh} km/h</div>
          ${wp.is_gap_hop ? '<div style="color: #f59e0b; font-size: 10px; margin-top: 4px;">⚠️ Inferred transit gap across non-adjacent cameras</div>' : ''}
        </div>
      `;

      const marker = L.marker([wp.lat, wp.lng], { icon }).bindPopup(popup);
      this.routeWaypointLayer.addLayer(marker);
    });

    // Fit map bounds to route with a smooth camera movement
    const bounds = L.latLngBounds(latLngs);
    this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
  }

  panToWaypoint(lat, lng, zoomLevel = 15) {
    this.map.flyTo([lat, lng], zoomLevel, {
      animate: true,
      duration: 1.2
    });
  }

  toggleCoverageCircles(visible) {
    this.showCoverageCircles = visible;
    if (visible) {
      this.coverageCircleLayer.addTo(this.map);
    } else {
      this.map.removeLayer(this.coverageCircleLayer);
    }
  }

  toggleCoverageCones(visible) {
    this.showCoverageCones = visible;
    if (visible) {
      this.coverageConeLayer.addTo(this.map);
    } else {
      this.map.removeLayer(this.coverageConeLayer);
    }
  }

  togglePoliceStations(visible) {
    this.showPoliceStations = visible;
    if (visible) {
      this.stationLayer.addTo(this.map);
    } else {
      this.map.removeLayer(this.stationLayer);
    }
  }

  toggleGujaratMask(visible) {
    this.showGujaratMask = visible;
    if (visible) {
      this.gujaratMaskLayer.addTo(this.map);
      this.gujaratBoundaryLayer.addTo(this.map);
    } else {
      this.map.removeLayer(this.gujaratMaskLayer);
      this.map.removeLayer(this.gujaratBoundaryLayer);
    }
  }

  toggleGapAnalysis(visible) {
    this.showGapAnalysis = visible;
    this.gapAnalysisLayer.clearLayers();

    if (!visible) {
      this.map.removeLayer(this.gapAnalysisLayer);
      return;
    }

    const centerZones = [
      { lat: 23.05, lng: 72.58, name: "Ahmedabad Urban Grid" },
      { lat: 21.52, lng: 70.45, name: "Junagadh Sector Grid" },
      { lat: 20.76, lng: 72.96, name: "Navsari / Bilimora Corridor" }
    ];

    centerZones.forEach(zone => {
      const step = 0.045; // ~5km
      for (let x = -2; x <= 2; x++) {
        for (let y = -2; y <= 2; y++) {
          const cellBounds = [
            [zone.lat + y * step, zone.lng + x * step],
            [zone.lat + (y + 1) * step, zone.lng + (x + 1) * step]
          ];

          const cellCenterLat = zone.lat + (y + 0.5) * step;
          const cellCenterLng = zone.lng + (x + 0.5) * step;
          const camerasInCell = CAMERAS.filter(c => 
            Math.abs(c.lat - cellCenterLat) <= step / 2 && Math.abs(c.lng - cellCenterLng) <= step / 2
          );

          const isMonitored = camerasInCell.length > 0;
          const coveragePct = isMonitored ? Math.min(100, camerasInCell.length * 28) : 0;

          const rect = L.rectangle(cellBounds, {
            color: isMonitored ? '#10b981' : '#f43f5e',
            weight: 1,
            fillColor: isMonitored ? '#10b981' : '#f43f5e',
            fillOpacity: isMonitored ? 0.12 : 0.06,
            dashArray: isMonitored ? null : '4, 4'
          }).bindTooltip(`<strong>${zone.name} Cell</strong><br>Coverage: ${coveragePct}%<br>CCTV Count: ${camerasInCell.length}`, { sticky: true });

          this.gapAnalysisLayer.addLayer(rect);
        }
      }
    });

    this.gapAnalysisLayer.addTo(this.map);
  }
}
