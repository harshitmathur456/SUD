# Sentinel Unified Grid (SUD) — Gujarat CCTV & Vehicle Intelligence Platform

> **Gujarat Police Innovation Hackathon 2026**  
> *Team CuriousClass | Harshit Mathur & Arin Harwani*

Sentinel Unified Grid is a high-performance, vendor-neutral CCTV integration and AI-driven vehicle intelligence command platform designed for the Gujarat State CCTV Grid. It addresses the challenge of unifying disparate Video Management Systems (VMS) across government departments into an interactive GIS registry with real-time ANPR inference, automated watchlist alerts, and multi-camera route reconstruction.

---

## Key Features Built (Checklist Fulfillment)

### P0 — Non-Negotiable Core Submissions
1. **YOLO + OCR Pipeline (`pipeline/yolo_ocr_pipeline.py`)**:
   - Ingests surveillance video feeds or CCTV streams.
   - High-precision morphological plate localization and character segmentation.
   - OCR reading with Indian license plate syntax validation (`GJ` + 2 digits + series + 4 digits).
   - Character confusion normalization (`0/O`, `1/I`, `8/B`, `5/S`).
   - Exports forensic detection logs to `output/detections.json` and `output/anpr_audit_log.csv`.
2. **Watchlist DB & Instant Cross-Referencing (`pipeline/watchlist_db.py` & Web UI)**:
   - Dynamic O(1) dictionary lookup for flagged vehicles (Stolen, Wanted, Hit & Run, Smuggling).
   - Triggers instantaneous visual alarm banner and synthesizer audio siren.
   - Computes nearest Gujarat police station via Haversine distance with estimated police dispatch ETA.
   - 1-Click Automated PCR Dispatch alert trigger.
3. **Government Sandbox Stream Ingestion (`pipeline/gov_feed_pipeline.py` & Web UI)**:
   - Connects to official Gujarat Government CCTV Sandbox endpoints (RTSP `:8554` & HLS).
   - Exponential backoff auto-reconnect logic (2s → 30s cap) complying with PRD Section 9.
   - Zero bulk archival footprint — stores rolling detection ring-buffer only.
   - Generates official `output/GOV_FEED_DETECTION_REPORT.md`.
4. **Multi-Camera Route Reconstruction & Replay**:
   - Traces any vehicle across 2 to 8+ cameras with chronological PTS timestamps.
   - Interactive waypoint scrubber with 1x, 2x, 4x speed replay and auto-camera tracking.
   - Inferred dashed paths across non-adjacent cameras to handle surveillance blind spots.
   - Average speed estimation, corridor travel time, and speed violation indicators.
5. **Built-in Screen Demo Recorder (P0 Item 5)**:
   - Direct 1-click 1080p screen recording (`MediaRecorder` API) directly from the dashboard header.
   - Automatic download of demo recordings for hackathon submission evidence.

### P1 — High Priority Platform Experience
6. **Command Dashboard (UI)**:
   - Camera fleet directory with live search and status filters (🟢 Live, 🟡 Degraded).
   - License plate search bar with instant autocomplete, fuzzy matching tolerance (Levenshtein ≤ 1), and quick-evaluation presets.
   - Synchronized CCTV evidence card rendering surveillance scanlines, OSD, and bounding boxes.
7. **GIS Map Foundation (Leaflet GIS)**:
   - Strictly bounded Gujarat state boundary with dark exterior focus mask.
   - 30 Sandbox CCTV Cameras geocoded to verified real-world Gujarat coordinates.
   - 313 Gujarat Police Stations mapped across 20 districts.
   - Resolution-tiered coverage circles (50m for 1080p, 35m for 720p, 25m conservative default) with mandatory PRD disclaimer.
   - Directional FOV Cones and 5km x 5km coverage gap analysis grid.
   - Multiple basemaps: Dark Surveillance, Street Map, and Satellite Imagery.

---

## Quick Start Guide

### 1. Launching Web Command Dashboard
```bash
# Install dependencies
npm install

# Start local development server
npm run dev
# Dashboard opens at http://localhost:5173
```

### 2. Running Standalone Python ANPR Pipeline
```bash
# Ingest and detect plates from test surveillance video
python pipeline/yolo_ocr_pipeline.py --video pipeline/sample_test_feed.mp4

# Run against watchlist target vehicle to test automated alert
python pipeline/yolo_ocr_pipeline.py --video pipeline/sample_test_feed.mp4 --plate GJ01ST0007

# Run Government Sandbox Stream Ingestion
python pipeline/gov_feed_pipeline.py --camera-id 1 --duration 5
```

---

## Test Evaluation Vehicles

| Registration No. | Scenario / Route | Cameras Traversed | Watchlist Status |
|---|---|---|---|
| `GJ01AB1234` | Ahmedabad Urban Corridor | 8 Cameras (Cam 1 &rarr; Cam 8) | Cleared |
| `GJ11CD9876` | Junagadh Sector Transit | 5 Cameras (Cam 12 &rarr; Cam 16) | Cleared |
| `GJ21EF4521` | Navsari & Bilimora Highway | 7 Cameras (Cam 22 &rarr; Cam 28) | Cleared |
| `GJ01ST0007` | Stolen Hyundai Creta (FIR #8812) | 4 Cameras (Navrangpura Area) | 🚨 CRITICAL WATCHLIST HIT |
| `GJ05WL9999` | Contraband Mahindra Thar | 3 Cameras (Surat Ring Road) | ⚠️ HIGH WATCHLIST HIT |
| `GJO1AB1234` | Optical Typo Tolerance Test | Fuzzy Match to `GJ01AB1234` | Cleared (Fuzzy Match) |

---

## Project Structure
```
├── pipeline/
│   ├── yolo_ocr_pipeline.py    # Python ANPR video detection & OCR pipeline
│   ├── gov_feed_pipeline.py    # Government sandbox RTSP/HLS stream runner
│   ├── watchlist_db.py         # Watchlist dictionary & lookup logic
│   └── create_sample_video.py  # Synthetic test surveillance video generator
├── src/
│   ├── data/
│   │   ├── cameras.js          # 30 Geocoded Sandbox CCTV nodes with coverage radii
│   │   ├── stations.js         # 313 Gujarat Police Stations across 20 districts
│   │   ├── detections.js       # Pre-indexed vehicle routes & watchlist seed
│   │   └── gujaratBoundary.js  # GeoJSON borders of Gujarat
│   ├── js/
│   │   ├── map.js              # Leaflet GIS engine, coverage layers & route drawing
│   │   ├── search.js           # ANPR search, fuzzy Levenshtein, & dossier generator
│   │   ├── replay.js           # Scrubber playback controller
│   │   ├── watchlist.js        # Real-time alert triggers, sirens & dispatch
│   │   ├── videoAnprModal.js   # Test video upload & canvas ANPR processor
│   │   ├── screenRecorder.js   # Browser 1080p demo video recorder
│   │   ├── streamViewer.js     # Live HLS & surveillance preview modal
│   │   └── dispatch.js         # Haversine nearest police station calculator
│   └── styles/
│       └── main.css            # Dark surveillance theme & HUD UI
├── output/                     # Generated detection JSON, CSV logs, & reports
├── PRD_Sentinel_Gujarat.md     # Product Requirements Document
└── index.html                  # Main Web Application Entrypoint
```

---

## Evaluation Compliance Note
- **Compliance with Sandbox Rules:** Complies with sandbox streaming policies (zero bulk archival storage; rolling detection ring-buffer only).
- **PTS Timestamp Integrity:** All cross-camera transit comparisons utilize stream PTS timestamps to prevent teleportation artifacts.
- **Coverage Assumptions:** Clearly disclaimed assumption-based coverage circles derived from resolution tiers.
