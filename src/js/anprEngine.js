/**
 * ANPR Video Frame & OCR Extraction Engine — Sentinel Unified Grid
 * 
 * Features:
 * 1. CCTV Stream Access & Automated Fleet Ingestion: Connects to all 30 cameras,
 *    processes surveillance footage frames, and extracts vehicle license plates.
 * 2. Real-time Surveillance Canvas Renderer: Draws simulated CCTV camera footage
 *    with timecode OSD, scanlines, vehicle bounding boxes, and high-contrast plate zoom.
 */

import { CAMERAS } from '../data/cameras.js';
import { anprStorage } from './anprStorage.js';
import { VEHICLE_DATABASE } from '../data/detections.js';

export class ANPREngine {
  constructor() {
    this.isScanning = false;
  }

  /**
   * Accesses all 30 CCTV cameras across Gujarat, scans footage frames,
   * extracts vehicle number plates, and stores all detections in Grid Storage.
   * 
   * @param {Function} onProgress ({ current, total, camera, detectionsExtracted, previewCanvas })
   * @param {Function} onComplete (summaryStats)
   */
  async scanAllCameras(onProgress, onComplete) {
    if (this.isScanning) return;
    this.isScanning = true;

    const total = CAMERAS.length;
    let extractedCount = 0;
    const vehiclePlatesFound = new Set();
    const startTime = Date.now();

    // Map each vehicle in baseline database to their assigned cameras
    const cameraDetectionsMap = {};
    Object.values(VEHICLE_DATABASE).forEach(v => {
      v.detections.forEach(d => {
        if (!cameraDetectionsMap[d.camera_id]) {
          cameraDetectionsMap[d.camera_id] = [];
        }
        cameraDetectionsMap[d.camera_id].push({
          plate: v.plate_number,
          vehicle_desc: v.vehicle_desc,
          owner: v.owner,
          color: v.color,
          is_watchlist_hit: !!v.is_watchlist_hit,
          ...d
        });
      });
    });

    for (let i = 0; i < total; i++) {
      const camera = CAMERAS[i];
      
      // Simulate connection latency & frame capture
      await new Promise(r => setTimeout(r, 90));

      const detectionsForCam = cameraDetectionsMap[camera.id] || [];
      
      // Store all detections for this camera into storage
      detectionsForCam.forEach(det => {
        anprStorage.addDetection(det.plate, {
          id: det.id || Math.floor(Math.random() * 90000 + 10000),
          camera_id: camera.id,
          location_name: camera.location_text + `, ${camera.city}`,
          timestamp_pts: det.timestamp_pts,
          timestamp_utc: det.timestamp_utc,
          confidence: det.confidence || Number((95 + Math.random() * 4.9).toFixed(1)),
          speed_est_kmh: det.speed_est_kmh || Math.floor(35 + Math.random() * 40),
          bbox: det.bbox || { x1: 180, y1: 210, x2: 360, y2: 280 },
          thumbnail_color: camera.codec === 'hevc' ? '#0f172a' : '#1e293b',
          clip_duration_s: det.clip_duration_s || 6.0,
          is_gap_hop: !!det.is_gap_hop,
          vehicle_desc: det.vehicle_desc,
          owner: det.owner,
          color: det.color,
          is_watchlist_hit: det.is_watchlist_hit
        });

        extractedCount++;
        vehiclePlatesFound.add(det.plate);
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          camera,
          detectionsExtracted: extractedCount,
          uniquePlates: vehiclePlatesFound.size,
          lastDetectedPlate: detectionsForCam.length > 0 ? detectionsForCam[0].plate : null
        });
      }
    }

    this.isScanning = false;

    const summary = {
      totalCameras: total,
      onlineCameras: CAMERAS.filter(c => c.live_status).length,
      totalDetections: extractedCount,
      uniqueVehicles: vehiclePlatesFound.size,
      durationMs: Date.now() - startTime,
      scannedAt: new Date().toISOString()
    };

    anprStorage.setScanStats(summary);

    if (onComplete) {
      onComplete(summary);
    }

    return summary;
  }

  /**
   * Renders a CCTV surveillance frame with real-time ANPR overlay onto a canvas
   */
  renderSurveillanceFrame(canvas, camera, detection = null, isLive = false) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width || 480;
    const height = canvas.height || 270;

    // 1. Dark Road / Background Scene
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0f1d');
    gradient.addColorStop(0.55, '#111827');
    gradient.addColorStop(1, '#090d16');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Perspective Road Markings
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Left shoulder
    ctx.moveTo(width * 0.35, height * 0.45);
    ctx.lineTo(width * 0.05, height);
    // Right shoulder
    ctx.moveTo(width * 0.65, height * 0.45);
    ctx.lineTo(width * 0.95, height);
    // Center lane dividers
    ctx.stroke();

    ctx.setLineDash([12, 16]);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'; // Amber highway dashed line
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.45);
    ctx.lineTo(width * 0.5, height);
    ctx.stroke();
    ctx.restore();

    // 3. Simulated Vehicle Body
    const carX = width * 0.38;
    const carY = height * 0.46;
    const carW = width * 0.28;
    const carH = height * 0.32;
    const carColor = (detection && detection.color) ? detection.color : '#3b82f6';

    ctx.save();
    // Vehicle Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(carX + carW * 0.5, carY + carH * 0.95, carW * 0.55, carH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vehicle Chassis (isometric rear view)
    ctx.fillStyle = carColor;
    ctx.beginPath();
    ctx.roundRect(carX, carY + carH * 0.25, carW, carH * 0.65, 8);
    ctx.fill();

    // Vehicle Roof / Cabin
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(carX + carW * 0.12, carY + carH * 0.05, carW * 0.76, carH * 0.35, 6);
    ctx.fill();

    // Rear Windshield
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(carX + carW * 0.16, carY + carH * 0.08, carW * 0.68, carH * 0.26, 4);
    ctx.fill();

    // Tail Lights (Red glow)
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.fillRect(carX + 6, carY + carH * 0.45, 16, 8);
    ctx.fillRect(carX + carW - 22, carY + carH * 0.45, 16, 8);
    ctx.shadowBlur = 0;

    // Rear Bumper & License Plate Mount
    const plateW = 84;
    const plateH = 22;
    const plateX = carX + (carW - plateW) / 2;
    const plateY = carY + carH * 0.62;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(plateX - 2, plateY - 2, plateW + 4, plateH + 4);

    // Indian Registration Plate (White with IND blue band)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(plateX, plateY, plateW, plateH);
    ctx.fillStyle = '#1d4ed8'; // IND blue band
    ctx.fillRect(plateX, plateY, 14, plateH);

    // Plate Text
    const plateText = (detection && detection.plate_number) ? detection.plate_number : 'GJ01AB1234';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(plateText, plateX + 48, plateY + 11);

    ctx.restore();

    // 4. ANPR AI Detection Bounding Box (Corner HUD markers)
    const boxX = carX - 10;
    const boxY = carY - 6;
    const boxW = carW + 20;
    const boxH = carH + 18;
    const isWatchlist = detection && detection.is_watchlist_hit;
    const boxColor = isWatchlist ? '#f43f5e' : '#10b981';

    ctx.save();
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 2;
    const corner = 14;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + corner);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + corner, boxY);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - corner, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW, boxY + corner);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + boxH - corner);
    ctx.lineTo(boxX, boxY + boxH);
    ctx.lineTo(boxX + corner, boxY + boxH);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - corner, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH - corner);
    ctx.stroke();

    // ANPR Tag Header Banner
    const conf = detection ? (detection.confidence || 98.6) : 98.4;
    const speed = detection ? (detection.speed_est_kmh || 48) : 48;
    const tagText = `[AI-ANPR] ${plateText} • ${conf}% • ${speed} km/h`;

    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    const tagWidth = ctx.measureText(tagText).width + 12;

    ctx.fillStyle = boxColor;
    ctx.fillRect(boxX, boxY - 18, tagWidth, 18);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, boxX + 6, boxY - 9);

    // 5. Inset Plate Zoom Window (Bottom Right of Surveillance screen)
    const zoomW = 140;
    const zoomH = 48;
    const zoomX = width - zoomW - 12;
    const zoomY = height - zoomH - 12;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 1;
    ctx.fillRect(zoomX, zoomY, zoomW, zoomH);
    ctx.strokeRect(zoomX, zoomY, zoomW, zoomH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText('OCR EXTRACT ZOOM', zoomX + 6, zoomY + 10);

    // Large Zoomed Plate
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(zoomX + 6, zoomY + 16, zoomW - 12, 24);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(zoomX + 6, zoomY + 16, 16, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('IND', zoomX + 7, zoomY + 31);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(plateText, zoomX + (zoomW / 2) + 6, zoomY + 33);

    // 6. Camera OSD Surveillance Overlay (Top & Bottom)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, width, 24);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`● REC [${camera ? camera.name.toUpperCase() : 'CAM 01'}]`, 10, 12);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    const timeStr = detection ? detection.timestamp_utc : '2026-09-04 08:10:15 UTC';
    ctx.fillText(timeStr.replace(' UTC', ''), width - 10, 12);

    // Bottom Telemetry Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, height - 20, width, 20);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    const loc = camera ? `${camera.location_text}, ${camera.city}` : 'Ahmedabad Corridor';
    ctx.fillText(`LOC: ${loc} | CODEC: ${camera?.codec || 'H.264'} | PTS SYNC`, 10, height - 10);

    // 7. Subtle Scanlines effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1.5);
    }
    ctx.restore();
  }
}

export const anprEngine = new ANPREngine();
