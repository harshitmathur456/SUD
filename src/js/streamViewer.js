/**
 * Camera Live Stream Viewer & Telemetry HUD (P0 Item 3)
 * Handles live HLS / WebRTC playback via Hls.js with fallback to surveillance canvas,
 * plus ANPR surveillance frame rendering with AI bounding boxes.
 */

import { anprEngine } from './anprEngine.js';

let activeHls = null;

export function openStreamModal(camera, detection = null) {
  const modal = document.getElementById('stream-modal');
  if (!modal || !camera) return;

  const camNameEl = document.getElementById('modal-cam-name');
  if (camNameEl) camNameEl.textContent = `${camera.name} — ${camera.location_text}`;

  const camDeptEl = document.getElementById('modal-cam-dept');
  if (camDeptEl) camDeptEl.textContent = camera.department || `${camera.city} Police Department`;

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
    camStatusEl.textContent = camera.status ? camera.status.toUpperCase() : 'LIVE';
    camStatusEl.className = `status-tag ${camera.status || 'live'}`;
  }

  const camRtspEl = document.getElementById('modal-cam-rtsp');
  if (camRtspEl) camRtspEl.textContent = camera.rtsp_url || `rtsp://live.corp8.cloud:8554/stream/${camera.id}`;

  const camHlsEl = document.getElementById('modal-cam-hls');
  if (camHlsEl) camHlsEl.textContent = camera.hls_url || `/live/stream/${camera.id}/index.m3u8`;

  const camCoordsEl = document.getElementById('modal-cam-coords');
  if (camCoordsEl) camCoordsEl.textContent = `${camera.lat.toFixed(4)}° N, ${camera.lng.toFixed(4)}° E`;

  const videoEl = document.getElementById('stream-hls-video');
  const canvas = document.getElementById('stream-canvas-preview');

  // Attempt live HLS stream loading if Hls.js is loaded in browser
  let hlsAttached = false;
  if (videoEl && window.Hls && window.Hls.isSupported() && camera.hls_url) {
    if (activeHls) {
      activeHls.destroy();
    }
    try {
      activeHls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
      activeHls.loadSource(camera.hls_url);
      activeHls.attachMedia(videoEl);
      activeHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().then(() => {
          videoEl.style.display = 'block';
          if (canvas) canvas.style.display = 'none';
          hlsAttached = true;
        }).catch(e => console.log('[HLS] Autoplay deferred:', e));
      });
      activeHls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          // Fall back to canvas
          if (videoEl) videoEl.style.display = 'none';
          if (canvas) canvas.style.display = 'block';
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
}
