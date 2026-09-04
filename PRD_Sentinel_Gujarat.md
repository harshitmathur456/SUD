# Product Requirements Document
## Sentinel Unified Grid — CCTV Integration & Vehicle Intelligence Platform
### Gujarat Police Innovation Hackathon 2026

**Version:** 1.0
**Status:** Draft for Hackathon Submission
**Owner:** Harshit Mathur / Arin Harwani (CuriousClass Team)

---

## 1. Overview

Gujarat operates ~80,000 CCTV cameras across 26 government departments, each running independent, incompatible Video Management Systems (VMS). There is no unified way to visualize camera coverage, search for a vehicle across the network, or automatically alert on watchlist matches.

This PRD defines a **PoC platform** (scoped to the ~30-50 sandbox cameras provided for evaluation) that:
1. Visualizes all cameras on an interactive GIS map of Gujarat, with an estimated coverage-area overlay.
2. Lets an operator search by vehicle number plate and see every place/time it was detected, with supporting footage clips.
3. Overlays police stations on the same map for operational context (fire stations planned as a Phase 2 addition once a data source is finalized).
4. Reconstructs and displays a vehicle's movement path (route) across multiple cameras over time.

The system must be architected so that scaling from 30 cameras to 80,000 requires configuration changes, not redesign (per hackathon Model 1 + Model 2 hybrid requirements).

---

## 2. Goals

| Goal | Description |
|---|---|
| G1 | Give command-center operators a single map-based view of all onboarded cameras and their live status |
| G2 | Make ANY vehicle traceable across the camera network in under 10 seconds of search time |
| G3 | Surface nearby police response assets alongside camera data for faster incident response (fire stations to follow in Phase 2) |
| G4 | Produce a defensible, demoable "route reconstruction" for a judge-supplied vehicle number during evaluation |
| G5 | Keep the architecture modular/vendor-neutral so new cameras/departments onboard without re-engineering |

### Out of Scope (for hackathon PoC)
- Centralized video storage/archival of the full state grid (Model 4 scope — explicitly not attempted)
- Face recognition / AFIS-NAFIS integration (mentioned as future roadmap only)
- Statewide 80,000-camera load — PoC targets the ~30-50 sandbox cameras
- Mobile app (web dashboard only for PoC)

---

## 3. Users & Personas

| Persona | Need |
|---|---|
| **Control Room Operator** | Wants a live map view, quick vehicle search, and instant alerts |
| **Field Investigating Officer** | Wants to trace a specific vehicle's route and pull footage as evidence |
| **Department Admin** | Wants to see camera health/coverage gaps in their jurisdiction |
| **Hackathon Evaluator** | Wants to input a test vehicle number and see the full trace + watchlist alert demo |

---

## 4. Feature 1 — Interactive GIS Map of Gujarat with Camera Coverage

### 4.1 Functional Requirements
- Render a map of Gujarat (Leaflet/Mapbox, base layer: OpenStreetMap or satellite toggle).
- Plot every camera from `/api/ingest` catalogue as a marker, color-coded by status:
  - 🟢 Green = live/online
  - 🔴 Red = offline
  - 🟡 Yellow = degraded (e.g., codec/resolution metadata missing, as seen in several sandbox cameras)
- Clicking a marker opens a popup: camera ID, name, location text, resolution, codec, fps, live status, "View Live" (HLS preview), "View on Street" (optional).
- Department/category filter (Police, RTO, Municipal, etc.) once department metadata is available; default all cameras shown for sandbox.
- Search/filter by location name or camera ID.

### 4.2 Coverage-Area Overlay (Assumption Layer)
Since the sandbox catalogue does not provide camera FOV/orientation/mounting-height, coverage must be **assumption-based and clearly labeled as such** on the map (a legend disclaimer is mandatory — never present estimated coverage as measured fact).

**Assumption model:**
- Each camera is represented as a **coverage circle** (simplification of a directional cone) with a default radius derived from resolution tier:
  | Resolution tier | Assumed effective monitoring radius |
  |---|---|
  | ≥1920x1080 (Full HD) | 50 m |
  | 1280x720–1280x960 | 35 m |
  | Unknown / 0x0 metadata | 25 m (conservative default) |
- Circles rendered at ~15–20% opacity so overlapping coverage is visually distinguishable.
- A toggle lets the operator switch between "Coverage Circles" (simple) and "Coverage Cones" (directional wedge, if/when heading data becomes available from department onboarding forms).
- **Gap analysis**: compute a rough "% of a 5 km × 5 km grid cell covered" for any selected area, to visually flag monitoring gaps — this directly supports the hackathon's Model 1 "gap-analysis reports" requirement.
- All coverage numbers ship with a visible disclaimer: *"Estimated coverage, not measured — based on resolution-derived assumption, pending real FOV data from camera owners."*

### 4.3 Data Source
- Primary: `cameras.json` / `cameras.csv` from `/api/ingest` (id, name, location, lat/long once geocoded, codec, resolution, fps, live status, stream URLs).
- Note: current sandbox catalogue provides **location as text, not lat/long** — a geocoding step (Google Geocoding API or manual mapping against known Gujarat place names) is required before plotting. This is a **P0 dependency** for Feature 1.

---

## 5. Feature 2 — Vehicle Search by Number Plate

### 5.1 Functional Requirements
- A prominent search bar: operator types/pastes a vehicle registration number (e.g., `GJ01AB1234`).
- System returns a **timeline of detections**: for each match —
  - Camera ID + location name
  - Timestamp (from stream PTS, not wall-clock arrival time — per sandbox integration rules)
  - Confidence score of the plate read
  - A short auto-recorded clip (5–10 seconds) centered on the detection
  - Thumbnail frame with bounding box drawn around the plate
- Results sorted chronologically, plotted as numbered pins on the map, connected by a route line (see Feature 4).
- Fuzzy match tolerance: OCR misreads are common (e.g., `0` vs `O`, `1` vs `I`) — search should support approximate matching (edit-distance ≤1) and show "possible matches" separately from "exact matches."
- Export option: download the detection timeline + clips as a PDF/zip evidence packet (useful for the "share footage" requirement and for investigating officers).

### 5.2 Footage Handling (Important Constraint)
The sandbox explicitly **disallows downloading or archiving full camera footage** ("no seeking, no byte-range fetching... don't plan around obtaining copies of the footage"). Therefore:
- The platform does **not** pull historical footage from the grid on demand.
- Instead, the platform's own AI pipeline **records short local clips only at the moment of a detection event** (a rolling few-second buffer flushed to storage only when a plate match or watchlist hit occurs). This is the system's own evidence capture, not a re-download of the source grid.
- Only these self-captured, detection-triggered clips are what "search → share footage" actually serves. This must be clearly stated in the HLD submission to avoid any appearance of violating the sandbox's no-download rule.

### 5.3 Data Model (Detections Table)
```
detections (
  id, plate_number, plate_number_normalized, confidence,
  camera_id, timestamp_pts, timestamp_utc_estimate,
  bbox_x1, bbox_y1, bbox_x2, bbox_y2,
  clip_path, thumbnail_path, created_at
)
```

---

## 6. Feature 3 — Police Station Layer (Phase 1) → Fire Station Layer (Phase 2)

> **Current scope decision**: Police stations are being built first since a usable dataset already exists. Fire stations are explicitly **deferred** — the schema and UI are designed so the fire layer can be switched on later without rework, but it is not part of the current build.

### 6.1 Functional Requirements (Police — Active Scope)
- A togglable map layer plotting 🚓 police stations across Gujarat.
- Clicking a station shows: name, address, jurisdiction/district, station type (police / railway police), contact number, and distance/travel-time from the currently selected camera or detected vehicle location.
- When a watchlist alert fires (Feature 4), the platform auto-suggests the **nearest police station** to the alert's camera location, to support fast dispatch.
- Map legend must disclose location precision per pin (see 6.3) — never present a jittered/approximate point as an exact address match.

### 6.2 Functional Requirements (Fire — Deferred, Phase 2)
- Same layer mechanics as police (toggle, popup, nearest-station suggestion), plotted as 🚒 icons.
- Not built in the current phase. `type` field in the schema already supports a `fire` value so this is a data-population task later, not a redesign.

### 6.3 Data Source & Current Dataset Status
- **Police stations**: 313 stations extracted from an official Gujarat Police station directory, covering 20 districts/commissionerates (Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar, Bhavnagar, Kachchh, Jamnagar, Devbhumi Dwarka, Patan, Surendranagar, Mehsana, Navsari, Anand, Kheda, Panchmahal, Gir Somnath, Junagadh, Banaskantha, plus Western Railway Police).
- **Geocoding pipeline** (built and run): station name + address → OpenStreetMap Nominatim (free, no API key) → 3-step fallback:
  1. Full address query (in practice, 0/313 matched — Nominatim's parser doesn't handle the "PS + landmark + locality" address format well)
  2. City/town-level query extracted from the address (312/313 matched)
  3. District-level fallback borrowed from a sibling station in the same district (1/313 — Shapar Veraval PS)
- **Precision handling**: because most matches are city-level, many stations in the same city share one raw coordinate. A deterministic per-station "jitter" (~2 km spread, hashed from the station name so it's stable across re-runs) is applied for **map display only**. The dataset keeps both:
  - `latitude, longitude` — jittered, for visual separation of pins
  - `city_center_latitude, city_center_longitude` — the real geocoded point
  - `location_precision` — `"city"` or `"district_fallback"`, so the UI/legend can always be honest about accuracy.
- **Fire stations**: no dataset yet. Candidate sources for Phase 2: Google Places API, or a state Fire Prevention Services directory if one gets published in a structured form.
- Stored locally in a `stations` table so the map does not depend on a live external call for every render (schema below).

---

## 7. Feature 4 — Vehicle Tracking (Route Reconstruction)

### 7.1 Functional Requirements
- Given a plate number (from Feature 2 search, or the evaluator's live test case), draw the vehicle's **path across cameras** as a connected, time-ordered polyline on the GIS map.
- Each waypoint labeled with camera name + time (e.g., "Camera 13 — 14:32:07").
- Playback control: a scrubber/slider lets the operator "replay" the route waypoint-by-waypoint (map pans/zooms to each point in sequence) — this is the core demo moment for evaluators.
- Handle gaps gracefully: if the vehicle is not seen for a stretch (camera gap, occlusion, unreadable plate), show a dotted/inferred line between last-known and next-known points rather than failing.
- Live-tracking mode: if a watchlist-flagged plate is detected in real time, the map auto-centers on the new detection and raises an alert banner + optional sound.

### 7.2 Technical Notes (per sandbox constraints)
- All cross-camera timestamp comparisons must use **PTS-based timestamps**, not frame-arrival wall-clock time, to avoid impossible-looking "vehicle teleportation" caused by buffering/keyframe-replay artifacts noted in the integration guide.
- Track continuity logic (re-identifying the "same" vehicle across non-overlapping cameras) is plate-number-based matching, not visual re-ID — this is the reliable, judge-defensible approach for the PoC (visual re-ID without plate confirmation is explicitly a stretch/bonus item, not core).
- System must tolerate a camera's feed looping/cutting (scene discontinuity) without corrupting an in-progress track — per sandbox §3 guidance.

---

## 8. System Architecture (High-Level)

```
┌─────────────────────────┐
│   Sandbox Camera Grid   │  (RTSP :8554 / HLS live)
│   ~30-50 cameras         │
└───────────┬─────────────┘
            │ live streams only (no archival pull)
            ▼
┌─────────────────────────┐
│  Ingestion & AI Workers  │  OpenCV/FFmpeg → YOLOv8 (plate detect)
│  (per-camera process,    │  → EasyOCR/PaddleOCR (plate read)
│   auto-reconnect+backoff)│  → local clip buffer on detection
└───────────┬─────────────┘
            │ writes
            ▼
┌─────────────────────────┐        ┌──────────────────────┐
│   PostgreSQL + PostGIS   │◄──────►│  Watchlist DB (sample)│
│  cameras, detections,    │        │  plate → flag reason  │
│  stations, tracks        │        └──────────────────────┘
└───────────┬─────────────┘
            │ REST API (FastAPI)
            ▼
┌─────────────────────────┐
│   React + Leaflet UI     │  GIS map, coverage layer,
│   (Operator Dashboard)   │  search bar, route replay,
│                          │  police station layer, alerts
└─────────────────────────┘
```

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Scalability | Camera onboarding must be config/API-driven (no code redeploy per camera) so the same architecture scales toward 80,000 cameras |
| Reliability | Auto-reconnect with exponential backoff (2s → 30s cap) on every stream; decoder warnings on join are logged, not fatal |
| Security | Role-based access control per department; watchlist DB access logged/audited |
| Performance | Search results returned in <3s for the sandbox-scale dataset |
| Interoperability | No vendor lock-in; adapters/connectors pattern for future VMS federation (Model 3 readiness) |
| Data integrity | All timestamps stored with source (PTS vs. estimated UTC) explicitly tagged, never conflated |

---

## 10. AI/ML Pipeline Summary

1. **Frame acquisition**: OpenCV/FFmpeg via HLS (primary, network-friendly) with RTSP as the preferred protocol where the network allows it (per sandbox guidance, RTSP is intended for AI inference).
2. **Vehicle/plate detection**: YOLOv8 pretrained plate-detector model.
3. **OCR**: EasyOCR/PaddleOCR on cropped plate region.
4. **Normalization**: strip whitespace, fix common OCR confusions (0/O, 1/I) before DB match.
5. **Watchlist match**: simple dictionary/DB lookup — deliberately kept non-ML, reliable-first.
6. **Alert dispatch**: on match, push to dashboard (WebSocket) + nearest police station lookup.

---

## 11. Alignment with Hackathon Evaluation Criteria

| Evaluation Area | How this PRD addresses it |
|---|---|
| Successful test case | Feature 4 (route reconstruction) is built specifically to demo the judge-supplied vehicle number |
| Solution architecture | Section 8, modular/vendor-neutral, Model 1 (registry+GIS) + Model 2 (unified viewing+analytics) hybrid |
| Video analytics output | ANPR pipeline (Section 10) with timestamped, location-tagged output reports |
| Scalability & PoC readiness | Section 9, config-driven onboarding |
| Bonus consideration | Coverage-gap analysis (4.2), nearest-police-station dispatch suggestion (6.1), route-replay UX (7.1) |

---

## 12. Key Assumptions & Risks

| Assumption/Risk | Mitigation |
|---|---|
| Camera catalogue lacks lat/long, FOV, and heading | Geocode location text manually for the 30-50 sandbox cameras; clearly label coverage circles as estimates |
| Police station addresses don't geocode to exact points via free tools (confirmed: 0/313 exact-address matches with Nominatim, only city-level) | Use city-level coordinates with a documented, deterministic per-station jitter for visual separation; expose true precision via `location_precision` so no pin overstates its accuracy |
| OCR accuracy will vary with camera angle/lighting/resolution (several sandbox cameras report 0x0 metadata) | Show confidence scores; support fuzzy plate matching; caveat accuracy openly in the demo |
| No footage download permitted from sandbox | Self-capture short clips only at detection time (Section 5.2) — never bulk-archive the grid |
| Network may block RTSP (port 8554) on some networks (observed during testing) | Fall back to HLS for both preview and AI ingestion; document this trade-off in the HLD |
| Cross-camera identity continuity depends on plate visibility at every hop | Treat gaps as expected; render inferred/dotted path rather than breaking the track |

---

## 13. Milestone Plan (Hackathon Timeline)

| Milestone | Target |
|---|---|
| Camera registry + GIS map (Feature 1, no coverage layer yet) | Day 2-3 |
| YOLO+OCR pipeline validated on sandbox HLS feed | Day 3-4 |
| Detections DB + basic search bar (Feature 2) | Day 5-6 |
| Coverage-area overlay + police station layer (Features 1.2 and 3) | Day 6-7 |
| Route reconstruction + replay UI (Feature 4) | Day 7-8 |
| Watchlist + alerts wired end-to-end | Day 8 |
| Submission assets: HLD doc, PPT, own-feed demo, gov-feed demo | Day 8-9 |

---

## 14. Appendix — Data Schemas

```sql
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    external_id INT,
    name TEXT,
    location_text TEXT,
    latitude FLOAT,
    longitude FLOAT,
    codec TEXT,
    width INT,
    height INT,
    fps FLOAT,
    live_status BOOLEAN,
    rtsp_url TEXT,
    webrtc_url TEXT,
    hls_url TEXT,
    department TEXT,
    coverage_radius_m INT
);

CREATE TABLE detections (
    id SERIAL PRIMARY KEY,
    plate_number TEXT,
    plate_number_normalized TEXT,
    confidence FLOAT,
    camera_id INT REFERENCES cameras(id),
    timestamp_pts BIGINT,
    timestamp_utc_estimate TIMESTAMP,
    bbox_x1 INT, bbox_y1 INT, bbox_x2 INT, bbox_y2 INT,
    clip_path TEXT,
    thumbnail_path TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    plate_number TEXT UNIQUE,
    reason TEXT,       -- stolen / wanted / missing-linked
    added_by TEXT,
    added_at TIMESTAMP DEFAULT now()
);

CREATE TABLE stations (
    id SERIAL PRIMARY KEY,
    type TEXT CHECK (type IN ('police','railway_police','fire')),  -- 'fire' reserved for Phase 2
    name TEXT,
    address TEXT,
    district TEXT,
    contact_number TEXT,
    latitude FLOAT,              -- display coordinate (jittered if location_precision != 'exact')
    longitude FLOAT,
    city_center_latitude FLOAT,  -- true geocoded point, no jitter
    city_center_longitude FLOAT,
    location_precision TEXT CHECK (location_precision IN ('exact','city','district_fallback'))
);
```

---

*End of Document*
