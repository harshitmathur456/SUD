/**
 * Sentinel Unified Grid — Camera Wall & Clickable Multi-Feed Viewer (Phase A)
 * Renders the responsive 30-camera surveillance grid (/wall),
 * manages multi-stream simultaneous HLS playback (2x2, 3x3, 30-tile),
 * and connects directly to the shared Unified Stream Viewer.
 */

import { CAMERAS } from '../data/cameras.js';
import { openStreamModal } from './streamViewer.js';
import { anprEngine } from './anprEngine.js';
import Hls from 'hls.js';

export class CameraWall {
  constructor(containerId = 'camera-wall-grid') {
    this.containerId = containerId;
    this.container = null;
    this.currentMode = 'wall'; // '4up', '9up', 'wall'
    this.activeFilter = { query: '', status: 'all', dept: 'all' };
    this.activeHlsInstances = [];
    this.animationFrameIds = [];
  }

  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;
    this.render();
  }

  setLayoutMode(mode) {
    this.currentMode = mode;
    this.cleanupActiveFeeds();
    this.render();
  }

  setFilter(filterUpdates) {
    this.activeFilter = { ...this.activeFilter, ...filterUpdates };
    this.cleanupActiveFeeds();
    this.render();
  }

  cleanupActiveFeeds() {
    this.activeHlsInstances.forEach(hls => {
      try {
        hls.destroy();
      } catch (e) {}
    });
    this.activeHlsInstances = [];

    this.animationFrameIds.forEach(id => cancelAnimationFrame(id));
    this.animationFrameIds = [];
  }

  getFilteredCameras() {
    const q = this.activeFilter.query.toLowerCase().trim();
    return CAMERAS.filter(cam => {
      if (this.activeFilter.status !== 'all' && cam.status !== this.activeFilter.status) {
        return false;
      }
      if (this.activeFilter.dept !== 'all' && !(cam.department || '').toLowerCase().includes(this.activeFilter.dept.toLowerCase())) {
        return false;
      }
      if (q) {
        const matchName = cam.name.toLowerCase().includes(q);
        const matchLoc = cam.location_text.toLowerCase().includes(q);
        const matchCity = (cam.city || '').toLowerCase().includes(q);
        const matchDept = (cam.department || '').toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchCity && !matchDept) return false;
      }
      return true;
    });
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const cameras = this.getFilteredCameras();
    let displayList = cameras;

    // Apply layout slicing if in 4up or 9up focus mode
    if (this.currentMode === '4up') {
      displayList = cameras.slice(0, 4);
      this.container.className = 'camera-wall-grid mode-4up';
    } else if (this.currentMode === '9up') {
      displayList = cameras.slice(0, 9);
      this.container.className = 'camera-wall-grid mode-9up';
    } else {
      this.container.className = 'camera-wall-grid mode-wall';
    }

    if (displayList.length === 0) {
      this.container.innerHTML = `
        <div class="wall-empty-state">
          <i class="fas fa-video-slash" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <h3>No Camera Feeds Match Criteria</h3>
          <p style="color: var(--text-muted); font-size: 13px;">Adjust filters or search query to display grid feeds.</p>
        </div>
      `;
      return;
    }

    displayList.forEach((cam, index) => {
      const tile = this.createCameraTile(cam, index);
      this.container.appendChild(tile);
    });
  }

  createCameraTile(cam, index) {
    const tile = document.createElement('div');
    tile.className = `camera-tile ${cam.status || 'live'}`;
    tile.dataset.camId = cam.id;

    const padId = String(cam.id).padStart(2, '0');
    const deptName = cam.department || `${cam.city || 'Gujarat'} Police`;
    const resText = cam.width && cam.height ? `${cam.width}x${cam.height}` : '1080p HD';
    const fpsText = cam.fps ? `${cam.fps} FPS` : '25.0 FPS';
    const statusLabel = (cam.status || 'LIVE').toUpperCase();

    // HLS Stream Source URL (prefers local proxy /api/stream/camXX/index.m3u8)
    const hlsSource = `/api/stream/cam${padId}/index.m3u8`;

    tile.innerHTML = `
      <div class="tile-header">
        <div class="tile-title-group">
          <span class="tile-cam-id">CAM #${padId}</span>
          <span class="tile-cam-name" title="${cam.location_text}">${cam.name}</span>
        </div>
        <div class="tile-badge-group">
          <span class="status-indicator-pill ${cam.status || 'live'}">
            <span class="pulse-dot"></span>
            ${statusLabel}
          </span>
        </div>
      </div>

      <div class="tile-video-viewport">
        <!-- Live Video Element for HLS Playback -->
        <video class="tile-video-el" id="wall-video-${cam.id}" autoplay muted playsinline loop style="display: none;"></video>
        
        <!-- Synthetic Surveillance Radar Canvas Fallback -->
        <canvas class="tile-canvas-preview" id="wall-canvas-${cam.id}" width="400" height="225"></canvas>
        
        <div class="tile-crt-scanlines"></div>
        
        <!-- Live OSD Timestamp Overlay -->
        <div class="tile-osd-bar">
          <span class="tile-osd-clock" id="wall-clock-${cam.id}">--:--:-- IST</span>
          <span class="tile-osd-tag">PTS SYNC</span>
        </div>

        <div class="tile-watermark-corner">
          <span>${deptName}</span>
        </div>

        <div class="tile-hover-action">
          <button class="btn-inspect-feed" title="Open Stream Viewer & Mini-Map">
            <i class="fas fa-expand"></i> INSPECT FEED
          </button>
        </div>
      </div>

      <div class="tile-footer">
        <div class="tile-location" title="${cam.location_text}">
          <i class="fas fa-location-dot" style="color: var(--accent-cyan);"></i>
          <span>${cam.location_text}</span>
        </div>
        <div class="tile-meta-strip">
          <span class="meta-item"><i class="fas fa-microchip"></i> ${cam.codec ? cam.codec.toUpperCase() : 'H.264'}</span>
          <span class="meta-item"><i class="fas fa-display"></i> ${resText}</span>
          <span class="meta-item"><i class="fas fa-gauge-high"></i> ${fpsText}</span>
        </div>
      </div>
    `;

    // Click handler to open Unified Stream Viewer Modal
    tile.addEventListener('click', (e) => {
      // Don't trigger twice if button clicked
      openStreamModal(cam);
    });

    const inspectBtn = tile.querySelector('.btn-inspect-feed');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStreamModal(cam);
      });
    }

    // Attach stream or animated surveillance canvas
    setTimeout(() => {
      this.attachFeedToTile(tile, cam, hlsSource);
    }, index * 40);

    return tile;
  }

  attachFeedToTile(tile, cam, hlsSource) {
    const videoEl = tile.querySelector('.tile-video-el');
    const canvas = tile.querySelector('.tile-canvas-preview');
    const clockEl = tile.querySelector('.tile-osd-clock');

    // Update real-time clock OSD
    const updateClock = () => {
      if (clockEl) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
        clockEl.textContent = `${timeStr}.${String(Math.floor(now.getMilliseconds() / 100)).padStart(2, '0')} IST`;
      }
    };
    setInterval(updateClock, 200);

    let streamStarted = false;

    // For 4up or 9up layout, actively stream HLS feeds simultaneously (P0 & Phase A Deliverable)
    if (this.currentMode === '4up' || this.currentMode === '9up' || cam.id <= 4) {
      if (videoEl && Hls.isSupported()) {
        try {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 4,
            manifestLoadingTimeOut: 4000
          });

          hls.loadSource(hlsSource);
          hls.attachMedia(videoEl);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoEl.play().then(() => {
              videoEl.style.display = 'block';
              if (canvas) canvas.style.display = 'none';
              streamStarted = true;
            }).catch(e => {
              // Autoplay error, keep canvas
            });
          });

          hls.on(Hls.Events.ERROR, (e, data) => {
            if (data.fatal) {
              // Fallback to canvas
              videoEl.style.display = 'none';
              if (canvas) canvas.style.display = 'block';
            }
          });

          this.activeHlsInstances.push(hls);
        } catch (err) {
          console.warn(`[CameraWall] HLS attach failed for Camera ${cam.id}:`, err);
        }
      }
    }

    // If stream not playing yet, render the high-fidelity surveillance canvas
    if (!streamStarted && canvas) {
      anprEngine.renderSurveillanceFrame(canvas, cam, null, true);
    }
  }
}

export const cameraWall = new CameraWall();
