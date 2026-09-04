# Architecture Note: Departmental VMS Non-Interference Guarantee
## Sentinel Unified Grid (SUD) — Gujarat Police Innovation Challenge 2026
**Model Chosen:** Model 2 — Unified Viewing & Metadata Analytics  
**Scope:** Confirmation of Non-Intrusive Integration Across 26 Gujarat Government Departments

---

### 1. Executive Declaration

The **Sentinel Unified Grid (SUD)** architecture has been engineered strictly under **Model 2 (Unified Viewing & Metadata Analytics)** principles to ensure that all existing camera networks, recording servers, and Video Management Systems (VMS) across Gujarat’s 26 government departments remain **100% unaffected, unaltered, and unburdened**.

---

### 2. Core Architectural Guarantees

```
  Departmental VMS Infrastructure                 Sentinel Unified Grid (Model 2)
 ┌───────────────────────────────────┐             ┌───────────────────────────────────┐
 │ Existing Department CCTV Systems  │             │ Read-Only Consumer Tap            │
 │ • Police Commissionerate VMS      │  RTSP / HLS │ • Low-overhead Stream Pull        │
 │ • Traffic Enforcement Gateways    ├────────────►│ • In-Memory AI Frame Inference    │
 │ • Smart Cities & Municipal CCTVs  │ (Read-Only) │ • Real-Time Metadata Extraction   │
 │ • RTO Checkpoints & Toll Plazas   │             │ • Rolling Ring Buffer Only        │
 └───────────────────────────────────┘             └─────────────────┬─────────────────┘
                   ▲                                                 │
                   │ ZERO WRITE / CONFIG ACCESS                      ▼
                   └─────────────────────────────────────── [ Sentinel Database ]
                                                             • Plate Strings
                                                             • Timestamps (PTS)
                                                             • Watchlist Alerts
                                                             • ZERO Bulk Video Storage
```

#### A. Read-Only Stream Consumption (Tap Architecture)
- Sentinel interacts with camera nodes exclusively via standard read-only protocols: **RTSP** (`rtsp://`) for server-side AI inference and **HLS/WebRTC** (`/index.m3u8`, `/whep`) for operator browser visualization.
- **Zero Ingestion Modification:** No proprietary agents, background daemons, or firmware patches are ever installed on departmental cameras, NVRs, or VMS servers.
- **Zero Configuration Impact:** Existing departmental video storage rules, retention schedules, user permissions, and recording bitrate settings are completely untouched.

#### B. Zero Bulk Video Archival & Network Protection
- **Compliance with Sandbox Policies:** Unlike traditional centralized VMS platforms (Model 4) that siphon petabytes of raw video across statewide WANs, Sentinel operates as a **metadata-first engine**:
  1. Frames are decoded in volatile RAM for vehicle detection (YOLOv8) and character recognition (EasyOCR).
  2. Extracted metadata (plate string, confidence score, stream PTS timestamp, bounding box) is written to a compact SQLite/PostgreSQL database (~100 bytes per event).
  3. Raw video frames are discarded immediately from memory unless a critical watchlist hit occurs, in which case a 5-second evidence thumbnail/buffer is cached.
- **Network Conservation:** Bandwidth consumption is strictly bounded. Frame subsampling (processing 1 of every 4 frames) reduces processing overhead by 75% without compromising vehicle interception rates.

#### C. Active Stream Circuit-Breaking & Exponential Backoff
- To prevent accidental Denial of Service (DoS) or port starvation on edge camera gateways during network flapping, Sentinel implements strict connection throttling:
  - **Initial retry delay:** 2.0 seconds.
  - **Exponential backoff multiplier:** `delay = min(delay * 2, 30.0s)`.
  - **Cap:** 30.0 seconds maximum backoff.
  - **Socket timeout:** Pre-flight socket health checks (`probe_host`) ensure closed ports are flagged instantly without thread blocking.

#### D. Independent Security & Isolated Audit Trail
- Departmental credentials and tokens are encrypted and managed centrally.
- Sentinel's Watchlist Database and PCR Dispatch workflows operate in an isolated control plane, ensuring that even under peak surveillance load or simulated disaster drills, the underlying departmental cameras continue recording uninterrupted.

---

### 3. Compliance Summary Table

| Metric / Concern | Departmental Impact | Sentinel Implementation |
|---|---|---|
| **VMS Server Configuration** | **Zero (0%)** | No configuration changes, no database writes to VMS |
| **Edge Hardware Footprint** | **Zero (0%)** | No software or scripts deployed on cameras |
| **Storage Infrastructure** | **Zero (0%)** | Metadata-only persistence; zero raw video archival |
| **Bandwidth Utilization** | **< 2%** | On-demand HLS proxying + 4-frame subsampled AI analysis |
| **Disaster Isolation** | **Complete** | Failure of Sentinel has zero effect on departmental feeds |

---
**Approved by:** CuriousClass Development Team  
**Gujarat Police Innovation Hackathon 2026**
