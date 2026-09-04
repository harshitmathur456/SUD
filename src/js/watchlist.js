import { WATCHLIST as BASE_WATCHLIST, VEHICLE_DATABASE } from '../data/detections.js';
import { findNearestPoliceStation } from './dispatch.js';
import { CAMERAS } from '../data/cameras.js';

let audioCtx = null;

// Dynamic In-Memory + LocalStorage Watchlist Database
let activeWatchlist = [...BASE_WATCHLIST];

export function getActiveWatchlist() {
  return activeWatchlist;
}

export function checkWatchlistHit(plateNumber) {
  if (!plateNumber) return null;
  const clean = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return activeWatchlist.find(w => w.plate_number.replace(/[^A-Z0-9]/g, '') === clean) || null;
}

export function addWatchlistTarget(target) {
  if (!target || !target.plate_number) return false;
  const cleanPlate = target.plate_number.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Check if exists
  const existing = activeWatchlist.find(w => w.plate_number.replace(/[^A-Z0-9]/g, '') === cleanPlate);
  if (existing) {
    Object.assign(existing, target);
  } else {
    activeWatchlist.unshift({
      plate_number: cleanPlate,
      reason: target.reason || "FLAGGED FOR POLICE INTERCEPTION",
      category: target.category || "Wanted",
      severity: target.severity || "HIGH",
      alert_sound: true,
      vehicle_desc: target.vehicle_desc || "Suspicious Vehicle",
      owner: target.owner || "Under Investigation",
      date_flagged: new Date().toISOString().split('T')[0]
    });
  }

  renderWatchlistItems();
  updateWatchlistBadge();
  return true;
}

export function removeWatchlistTarget(plateNumber) {
  const cleanPlate = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  activeWatchlist = activeWatchlist.filter(w => w.plate_number.replace(/[^A-Z0-9]/g, '') !== cleanPlate);
  renderWatchlistItems();
  updateWatchlistBadge();
}

export function updateWatchlistBadge() {
  const badge = document.querySelector('.metric-pill[title*="watchlist"] strong');
  if (badge) {
    badge.textContent = `${activeWatchlist.length} TARGETS`;
  }
}

/**
 * Play synthesizer surveillance alarm chime using Web Audio API
 */
export function playAlertSiren() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3); // A4
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    console.warn('Audio siren playback skipped:', e);
  }
}

/**
 * Trigger Watchlist Alert with specific vehicle and camera context
 */
export function triggerWatchlistAlertWithDetails(plate, info, camera, onFlyToCallback) {
  playAlertSiren();

  const cam = camera || CAMERAS[0];
  const nearestDispatch = findNearestPoliceStation(cam.lat, cam.lng);

  const alertPopup = document.getElementById('live-alert-popup');
  if (alertPopup) {
    const plateEl = document.getElementById('alert-plate-number');
    const reasonEl = document.getElementById('alert-reason');
    const locEl = document.getElementById('alert-location');
    const stationEl = document.getElementById('alert-station');

    if (plateEl) plateEl.textContent = plate;
    if (reasonEl) reasonEl.textContent = info ? info.reason : "CRITICAL: WATCHLIST INTERCEPT TRIGGERED";
    if (locEl) locEl.textContent = `${cam.name} — ${cam.location_text}, ${cam.city}`;
    if (stationEl) {
      stationEl.textContent = nearestDispatch
        ? `${nearestDispatch.station.name} (${nearestDispatch.distanceKm} km, ETA: ${nearestDispatch.etaMinutes} mins)`
        : "Navrangpura PS";
    }

    const dispatchBtn = document.getElementById('btn-dispatch-alert');
    if (dispatchBtn) {
      dispatchBtn.onclick = () => {
        alert(`🚨 DISPATCH ISSUED!\nTarget Vehicle: ${plate}\nDispatch Unit: ${nearestDispatch ? nearestDispatch.station.name : 'Local Police Unit'}\nETA: ${nearestDispatch ? nearestDispatch.etaMinutes : 5} minutes\nNotification sent to PCR Patrol & Nearest Station Dial: ${nearestDispatch ? nearestDispatch.station.phone : '100'}`);
      };
    }

    alertPopup.classList.add('active');

    if (typeof onFlyToCallback === 'function') {
      onFlyToCallback(cam.lat, cam.lng, 15);
    }
  }
}

/**
 * Simulates a real-time live alert for a watchlist hit
 */
export function triggerLiveWatchlistAlert(onFlyToCallback) {
  const hitPlate = activeWatchlist.length > 0 ? activeWatchlist[0].plate_number : "GJ01ST0007";
  const vehicle = VEHICLE_DATABASE[hitPlate];
  let camera = CAMERAS[0];

  if (vehicle && vehicle.detections && vehicle.detections.length > 0) {
    const lastDetection = vehicle.detections[vehicle.detections.length - 1];
    camera = CAMERAS.find(c => c.id === lastDetection.camera_id) || CAMERAS[0];
  }

  const wlInfo = checkWatchlistHit(hitPlate) || {
    reason: "CRITICAL: STOLEN VEHICLE FLAGGED (FIR #2026-8812)"
  };

  triggerWatchlistAlertWithDetails(hitPlate, wlInfo, camera, onFlyToCallback);
}

export function closeLiveAlertPopup() {
  const alertPopup = document.getElementById('live-alert-popup');
  if (alertPopup) {
    alertPopup.classList.remove('active');
  }
}

/**
 * Renders all watchlist items into the Watchlist Tab
 */
export function renderWatchlistItems(onSelectPlateCallback, onFlyToCallback) {
  const container = document.getElementById('watchlist-scroll-list');
  if (!container) return;

  container.innerHTML = '';

  activeWatchlist.forEach((w) => {
    const card = document.createElement('div');
    card.className = 'list-item-card';
    card.style.borderLeft = w.severity === 'CRITICAL' ? '3px solid var(--accent-rose)' : '3px solid var(--accent-amber)';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: #fff; background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
            ${w.plate_number}
          </span>
          <span class="status-tag ${w.severity === 'CRITICAL' ? 'offline' : 'degraded'}" style="margin-left: 6px; font-size: 10px;">
            ${w.severity}
          </span>
        </div>
        <button class="btn-item-action danger btn-test-wl-hit" title="Test Live Alert Trigger for this Vehicle" style="padding: 2px 8px; font-size: 11px;">
          <i class="fas fa-siren"></i> Alert
        </button>
      </div>
      <div style="font-size: 11px; color: #fca5a5; margin-top: 6px; line-height: 1.3;">
        ${w.reason}
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; justify-content: space-between;">
        <span>${w.vehicle_desc || 'Vehicle Target'}</span>
        <span>Flagged: ${w.date_flagged}</span>
      </div>
      <div style="margin-top: 6px; display: flex; gap: 6px;">
        <button class="btn-item-action btn-trace-wl-plate" style="flex: 1; justify-content: center; font-size: 11px; padding: 4px;">
          <i class="fas fa-route"></i> Trace Route
        </button>
        <button class="btn-item-action btn-remove-wl" style="color: var(--text-muted); font-size: 11px; padding: 4px 8px;" title="Remove from Watchlist">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Alert trigger button
    card.querySelector('.btn-test-wl-hit').addEventListener('click', (e) => {
      e.stopPropagation();
      const vehicle = VEHICLE_DATABASE[w.plate_number];
      const cam = vehicle && vehicle.detections ? CAMERAS.find(c => c.id === vehicle.detections[0].camera_id) : CAMERAS[0];
      triggerWatchlistAlertWithDetails(w.plate_number, w, cam, onFlyToCallback);
    });

    // Trace button
    card.querySelector('.btn-trace-wl-plate').addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onSelectPlateCallback === 'function') {
        onSelectPlateCallback(w.plate_number);
      }
    });

    // Remove button
    card.querySelector('.btn-remove-wl').addEventListener('click', (e) => {
      e.stopPropagation();
      removeWatchlistTarget(w.plate_number);
    });

    container.appendChild(card);
  });
}
