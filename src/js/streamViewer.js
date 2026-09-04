/**
 * Sentinel Unified Grid — Shared Unified Stream Viewer & Mini-Map (Phase A Deliverable)
 * Shared modal component used by both the Camera Wall (/wall) and GIS Map (/map).
 * Features:
 * - Live HLS playback via Hls.js with error fallback to surveillance canvas
 * - Embedded Leaflet mini-map centered on camera coordinates with coverage circle
 * - Camera telemetry: Department, Coordinates, Codec, Resolution, FPS, Bitrate
 * - Automated Nearest Gujarat Police Station computation with dispatch ETA
 * - Cross-linking actions: "Focus on Main GIS Map" & "1-Click Police Dispatch"
 */

import Hls from 'hls.js';
import L from 'leaflet';
import { anprEngine } from './anprEngine.js';
import { findNearestPoliceStation, issuePoliceDispatch } from './dispatch.js';

let activeHls = null;
let miniMap = null;
let miniMapMarker = null;
let miniMapCircle = null;
let activeCamera = null;

export function openStreamModal(camera, detection = null) {
  const modal = document.getElementById('stream-modal');
  if (!modal || !camera) return;

  activeCamera = camera;
  const padId = String(camera.id).padStart(2, '0');

  // 1. Populate Telemetry Header
  const camNameEl = document.getElementById('modal-cam-name');
  if (camNameEl) camNameEl.textContent = `${camera.name} — ${camera.location_text}`;

  const camDeptEl = document.getElementById('modal-cam-dept');
  if (camDeptEl) camDeptEl.textContent = camera.department || `${camera.city || 'Gujarat'} Police Department`;

  const camResEl = document.getElementById('modal-cam-res');
  if (camResEl) camResEl.textContent = camera.width && camera.height ? `${camera.width}x${camera.height}` : '1920x1080 (HD CCTV)';

  const camCodecEl = document.getElementById('modal-cam-codec');
  if (camCodecEl) camCodecEl.textContent = camera.codec ? camera.codec.toUpperCase() : 'H.264 (Auto)';

  const camFpsEl = document.getElementById('modal-cam-fps');
  if (camFpsEl) camFpsEl.textContent = camera.fps ? `${camera.fps} FPS` : '25.0 FPS';

  const camBitrateEl = document.getElementById('modal-cam-bitrate');
  if (camBitrateEl) camBitrateEl.textContent = camera.bitrate_kbps ? `${camera.bitrate_kbps} kbps` : '1920 kbps';

  const camStatusEl = document.getElementById('modal-cam-status');
  if (camStatusEl) {
    camStatusEl.textContent = (camera.status || 'LIVE').toUpperCase();
    camStatusEl.className = `status-tag ${camera.status || 'live'}`;
  }

  const camRtspEl = document.getElementById('modal-cam-rtsp');
  if (camRtspEl) camRtspEl.textContent = camera.rtsp_url || `rtsp://live.corp8.cloud:8554/stream/${camera.id}`;

  const camHlsEl = document.getElementById('modal-cam-hls');
  const hlsUrl = `/api/stream/cam${padId}/index.m3u8`;
  if (camHlsEl) camHlsEl.textContent = hlsUrl;

  const camCoordsEl = document.getElementById('modal-cam-coords');
  if (camCoordsEl) camCoordsEl.textContent = `${camera.lat.toFixed(4)}° N, ${camera.lng.toFixed(4)}° E`;

  // 2. Compute Nearest Police Station
  const stationInfo = findNearestPoliceStation(camera.lat, camera.lng);
  const stationEl = document.getElementById('modal-nearest-station');
  if (stationEl && stationInfo && stationInfo.station) {
    stationEl.innerHTML = `
      <strong>${stationInfo.station.name}</strong> (${stationInfo.station.district})
      <div style="color: var(--accent-emerald); margin-top: 2px;">
        <i class="fas fa-route"></i> ${stationInfo.distanceKm} km away • ETA: <strong>${stationInfo.etaMinutes} mins</strong>
      </div>
    `;
  }

  // 3. Embedded Leaflet Mini-Map Initialization
  initMiniMap(camera, stationInfo);

  // 4. Video Element / HLS Setup
  const videoEl = document.getElementById('stream-hls-video');
  const canvas = document.getElementById('stream-canvas-preview');

  let hlsAttached = false;
  if (videoEl && Hls.isSupported()) {
    if (activeHls) {
      activeHls.destroy();
      activeHls = null;
    }
    try {
      activeHls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 5000
      });
      activeHls.loadSource(hlsUrl);
      activeHls.attachMedia(videoEl);

      activeHls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().then(() => {
          videoEl.style.display = 'block';
          if (canvas) canvas.style.display = 'none';
          hlsAttached = true;
        }).catch(e => console.log('[HLS] Autoplay deferred:', e));
      });

      activeHls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          // Fallback to canvas
          if (videoEl) videoEl.style.display = 'none';
          if (canvas) {
            canvas.style.display = 'block';
            anprEngine.renderSurveillanceFrame(canvas, camera, detection, true);
          }
        }
      });
    } catch (e) {
      console.warn('[HLS] Stream init error:', e);
    }
  }

  if (!hlsAttached) {
    if (videoEl) videoEl.style.display = 'none';
    if (canvas) {
      canvas.style.display = 'block';
      anprEngine.renderSurveillanceFrame(canvas, camera, detection, true);
    }
  }

  modal.classList.add('active');
}

function initMiniMap(camera, stationInfo) {
  const mapContainer = document.getElementById('modal-mini-map');
  if (!mapContainer) return;

  // Destroy previous mini-map instance if exists
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }

  setTimeout(() => {
    try {
      miniMap = L.map('modal-mini-map', {
        center: [camera.lat, camera.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // Dark surveillance tile layer
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18
      }).addTo(miniMap);

      // Camera Pin Marker
      const camIcon = L.divIcon({
        html: `<div class="mini-cam-pin"><i class="fas fa-video"></i></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      miniMapMarker = L.marker([camera.lat, camera.lng], { icon: camIcon }).addTo(miniMap);

      // Assumed Coverage Radius Circle (PRD 4.2)
      const radius = camera.coverage_radius_m || 25;
      miniMapCircle = L.circle([camera.lat, camera.lng], {
        radius: radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        weight: 1.5
      }).addTo(miniMap);

      // Nearest Police Station Pin if available
      if (stationInfo && stationInfo.station) {
        const ps = stationInfo.station;
        const psIcon = L.divIcon({
          html: `<div class="mini-ps-pin" title="${ps.name}"><i class="fas fa-building-shield"></i></div>`,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        L.marker([ps.lat, ps.lng], { icon: psIcon }).addTo(miniMap);

        // Dotted connection line between camera and police station
        L.polyline([[camera.lat, camera.lng], [ps.lat, ps.lng]], {
          color: '#10b981',
          weight: 2,
          dashArray: '4, 4',
          opacity: 0.8
        }).addTo(miniMap);
      }

      miniMap.invalidateSize();
    } catch (err) {
      console.warn('[MiniMap] Error initializing Leaflet mini-map:', err);
    }
  }, 100);
}

export function closeStreamModal() {
  const modal = document.getElementById('stream-modal');
  if (modal) {
    modal.classList.remove('active');
  }

  const videoEl = document.getElementById('stream-hls-video');
  if (videoEl) {
    videoEl.pause();
    videoEl.src = '';
  }

  if (activeHls) {
    activeHls.destroy();
    activeHls = null;
  }

  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
}

export function getActiveModalCamera() {
  return activeCamera;
}
