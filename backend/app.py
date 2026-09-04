"""
Sentinel Unified Grid — FastAPI Command Server
Provides REST APIs for:
- HLS Stream Proxying (/api/stream/...)
- Camera Grid Registry & Health (/api/cameras)
- ANPR Vehicle Search & Route Reconstruction (/api/search)
- Watchlist Management & Real-time Alerts (/api/watchlist, /api/alerts)
- Live Video / Frame ANPR Pipeline Execution (/api/anpr/...)
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure root directory in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.database import (
    init_db,
    insert_detection,
    query_plate,
    get_all_watchlist,
    add_watchlist_record,
    delete_watchlist_record,
    get_recent_alerts,
    get_recent_detections,
    get_connection
)
from backend.stream_proxy import stream_router, format_cam_slug
from backend.anpr_engine import anpr_pipeline, normalize_plate_string

# Initialize database on startup
init_db()

app = FastAPI(
    title="Sentinel CCTV Integration Platform API",
    description="Model 2: Unified Viewing & Metadata Analytics Command Backend",
    version="2.0.0"
)

# Enable CORS for local Vite dev server and browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount HLS stream proxy router
app.include_router(stream_router)

# Pydantic Schemas
class WatchlistCreate(BaseModel):
    plate_text: str
    reason: str
    category: str = "Wanted"
    severity: str = "HIGH"

class DispatchRequest(BaseModel):
    alert_id: int
    station_name: str
    eta_minutes: int
    officer_notes: Optional[str] = "PCR Patrol Unit Dispatched"

@app.get("/api/health")
def get_health():
    return {
        "status": "ONLINE",
        "system": "Sentinel Unified Grid (SUD)",
        "model": "Model 2 — Unified Viewing & Metadata Analytics",
        "timestamp": datetime.now().isoformat(),
        "database": "SQLite (sentinel.db)",
        "ai_engine": "YOLOv8 + EasyOCR",
        "cctv_nodes_registered": 30
    }

@app.get("/api/cameras")
def get_cameras():
    """Returns camera registry enriched with active stream status and telemetry."""
    # Load base camera metadata from data files
    cameras_file = os.path.join(PROJECT_ROOT, "cameras_raw.json")
    cameras = []
    if os.path.exists(cameras_file):
        try:
            with open(cameras_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                cameras = data.get("cameras", [])
        except Exception as e:
            print(f"[API] Error reading cameras_raw.json: {e}")

    # Build response with local proxy URLs
    results = []
    for c in cameras:
        cid = int(c.get("number", c.get("id", 1)))
        slug = format_cam_slug(cid)
        results.append({
            "id": cid,
            "slug": slug,
            "name": c.get("name", f"Camera {cid}"),
            "location": c.get("location", f"Node {cid}"),
            "live": bool(c.get("live", True)),
            "codec": c.get("codec") or "H.264",
            "resolution": f"{c.get('width', 1920)}x{c.get('height', 1080)}" if c.get("width") else "1920x1080",
            "fps": float(c.get("fps") or 25.0),
            "stream_hls": f"/api/stream/{slug}/index.m3u8",
            "stream_rtsp": c.get("rtsp_url", f"rtsp://live.corp8.cloud:8554/stream/{cid}"),
            "status": "live" if c.get("width") else "degraded"
        })
    return {"total": len(results), "cameras": results}

@app.get("/api/detections")
def get_detections(limit: int = Query(50, ge=1, le=200)):
    """Returns recent rolling detections across the CCTV grid."""
    return {"detections": get_recent_detections(limit=limit)}

@app.get("/api/search")
def search_plate_route(plate: str = Query(..., min_length=3, description="License plate to trace")):
    """
    Search by number plate:
    Returns chronological sightings, PTS timestamps, camera locations,
    route coordinates, and watchlist match status.
    """
    norm = normalize_plate_string(plate)
    detections, watchlist_match = query_plate(norm)

    # If no detections in SQLite yet, check pre-indexed vehicle data
    if not detections:
        # Check pre-seeded route samples from detections.js
        sample_path = os.path.join(PROJECT_ROOT, "src", "data", "detections.js")
        # Fallback response structure
        return {
            "query": plate,
            "plate_normalized": norm,
            "total_sightings": 0,
            "is_watchlist_hit": bool(watchlist_match),
            "watchlist_info": watchlist_match,
            "detections": [],
            "route_waypoints": []
        }

    # Format route waypoints
    waypoints = []
    for d in detections:
        bbox = json.loads(d["bbox_json"]) if d.get("bbox_json") else None
        waypoints.append({
            "detection_id": d["id"],
            "camera_id": d["camera_id"],
            "camera_name": d["camera_name"],
            "pts_ms": d["pts_ms"],
            "detected_at": d["detected_at"],
            "confidence": d["confidence"],
            "bbox": bbox
        })

    return {
        "query": plate,
        "plate_normalized": norm,
        "total_sightings": len(waypoints),
        "is_watchlist_hit": bool(watchlist_match),
        "watchlist_info": watchlist_match,
        "detections": waypoints,
        "route_waypoints": waypoints
    }

@app.get("/api/watchlist")
def list_watchlist():
    """Returns all targets in the Watchlist DB."""
    return {"watchlist": get_all_watchlist()}

@app.post("/api/watchlist")
def create_watchlist_entry(entry: WatchlistCreate):
    """Enrolls a new target into the Watchlist DB."""
    success = add_watchlist_record(
        plate=entry.plate_text,
        reason=entry.reason,
        category=entry.category,
        severity=entry.severity
    )
    return {"success": success, "plate": entry.plate_text.upper()}

@app.delete("/api/watchlist/{record_id}")
def delete_watchlist_entry(record_id: int):
    """Removes a target from the Watchlist DB."""
    success = delete_watchlist_record(record_id)
    return {"success": success, "deleted_id": record_id}

@app.get("/api/alerts")
def list_alerts(limit: int = Query(30, ge=1, le=100)):
    """Returns recent real-time watchlist match alerts."""
    return {"alerts": get_recent_alerts(limit=limit)}

@app.post("/api/alerts/dispatch")
def issue_dispatch(dispatch: DispatchRequest):
    """Marks an alert as DISPATCHED with nearest police station response data."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE alerts
    SET status = 'DISPATCHED'
    WHERE id = ?
    """, (dispatch.alert_id,))
    conn.commit()
    conn.close()
    return {
        "success": True,
        "alert_id": dispatch.alert_id,
        "station": dispatch.station_name,
        "eta_mins": dispatch.eta_minutes,
        "status": "DISPATCHED"
    }

@app.post("/api/anpr/run")
def trigger_anpr_inference(
    camera_id: int = Form(1),
    camera_name: str = Form("Camera 1 - Chiman bhai Bridge"),
    target_plate: Optional[str] = Form("GJ01ST0007")
):
    """
    Executes ANPR pipeline on test feed / live stream and records detections into SQLite.
    """
    sample_video = os.path.join(PROJECT_ROOT, "pipeline", "sample_test_feed.mp4")
    import cv2
    cap = cv2.VideoCapture(sample_video if os.path.exists(sample_video) else 0)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise HTTPException(status_code=500, detail="Could not capture video frame")

    pts = int(time.time() * 1000)
    results = anpr_pipeline.process_frame(
        frame=frame,
        camera_id=camera_id,
        camera_name=camera_name,
        pts_ms=pts,
        fallback_plate=target_plate
    )
    return {
        "status": "SUCCESS",
        "camera_id": camera_id,
        "detections": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
