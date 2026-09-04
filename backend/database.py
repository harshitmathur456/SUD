"""
Sentinel Unified Grid — SQLite Persistence Layer
Manages persistent storage for:
- Detections (camera_id, plate_text, confidence, pts_ms, timestamp, bbox)
- Watchlist (plate_text, reason, category, severity, added_at)
- Alerts (detection_id, watchlist_id, camera_id, plate_text, alerted_at, status)
"""

import sqlite3
import os
import json
import time
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "sentinel.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and seeds representative watchlist records."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Detections Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_id INTEGER NOT NULL,
        camera_name TEXT,
        plate_text TEXT NOT NULL,
        plate_normalized TEXT NOT NULL,
        confidence REAL NOT NULL,
        pts_ms INTEGER NOT NULL,
        detected_at TEXT NOT NULL,
        bbox_json TEXT,
        thumbnail_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Watchlist Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_text TEXT UNIQUE NOT NULL,
        reason TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        added_at TEXT NOT NULL
    );
    """)

    # 3. Alerts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        detection_id INTEGER,
        watchlist_id INTEGER,
        camera_id INTEGER NOT NULL,
        camera_name TEXT,
        plate_text TEXT NOT NULL,
        reason TEXT NOT NULL,
        severity TEXT NOT NULL,
        alerted_at TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING_DISPATCH',
        FOREIGN KEY (detection_id) REFERENCES detections(id),
        FOREIGN KEY (watchlist_id) REFERENCES watchlist(id)
    );
    """)

    # Indices for high-speed lookups
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_det_plate ON detections(plate_normalized);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_det_pts ON detections(pts_ms);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_wl_plate ON watchlist(plate_text);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_cam ON alerts(camera_id);")

    # Seed 15 representative Watchlist targets across Gujarat
    sample_watchlist = [
        ("GJ01ST0007", "Stolen Hyundai Creta — FIR #8812/2026 Navrangpura PS", "Stolen", "CRITICAL"),
        ("GJ05WL9999", "Contraband Mahindra Thar — Highway Interception Notice #501", "Wanted", "HIGH"),
        ("GJ27HR4040", "Hit & Run Fatal Accident — Ring Road SG Highway FIR #1102", "Hit and Run", "CRITICAL"),
        ("GJ03GH3322", "High-Value Smuggling Convoy Lead Vehicle", "Wanted", "HIGH"),
        ("GJ18CR1122", "Extortion & Kidnapping Suspect Vehicle", "Wanted", "CRITICAL"),
        ("GJ06AB5544", "Vehicle Registration Suspended — High Speed Toll Evasion", "Suspension", "MEDIUM"),
        ("GJ12CD9090", "Inter-State Smuggling Transporter (Kachchh Border Alert)", "Wanted", "HIGH"),
        ("GJ10EF8877", "Stolen Maruti Brezza — Jamnagar City FIR #449", "Stolen", "HIGH"),
        ("GJ02MN3311", "Organized Cargo Theft Ring — Mehsana Highway", "Wanted", "HIGH"),
        ("GJ09KL7766", "Unpaid Traffic Penalty & Fake Number Plate Impersonation", "Suspension", "MEDIUM"),
        ("GJ11CD9876", "Routine Surveillance Flag — Junagadh Sector Checkpoint", "Monitoring", "MEDIUM"),
        ("GJ21EF4521", "Navsari Diamond Merchant Robbery Escort Car", "Wanted", "CRITICAL"),
        ("GJ04XY1290", "Fuel Theft Tanker — Bhavnagar Port Corridor", "Wanted", "HIGH"),
        ("GJ16ZZ6655", "Gold Smuggling Transit Vehicle — Bharuch Patrol Alert", "Wanted", "CRITICAL"),
        ("GJ23AB9900", "Armed Robbery Getaway Vehicle — Anand City", "Wanted", "CRITICAL")
    ]

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    for plate, reason, cat, sev in sample_watchlist:
        cursor.execute("""
        INSERT OR IGNORE INTO watchlist (plate_text, reason, category, severity, added_at)
        VALUES (?, ?, ?, ?, ?)
        """, (plate, reason, cat, sev, now_str))

    conn.commit()
    conn.close()

def insert_detection(camera_id, camera_name, plate_text, confidence, pts_ms, bbox=None, thumb_path=None):
    """Inserts a detection and automatically checks the watchlist for matches."""
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    plate_norm = "".join(c for c in plate_text.upper() if c.isalnum())
    bbox_json = json.dumps(bbox) if bbox else None

    cursor.execute("""
    INSERT INTO detections (camera_id, camera_name, plate_text, plate_normalized, confidence, pts_ms, detected_at, bbox_json, thumbnail_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (camera_id, camera_name, plate_text.upper(), plate_norm, confidence, pts_ms, now_str, bbox_json, thumb_path))
    detection_id = cursor.lastrowid

    # Check Watchlist
    cursor.execute("SELECT * FROM watchlist WHERE plate_text = ?", (plate_norm,))
    wl_row = cursor.fetchone()

    alert_info = None
    if wl_row:
        cursor.execute("""
        INSERT INTO alerts (detection_id, watchlist_id, camera_id, camera_name, plate_text, reason, severity, alerted_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_DISPATCH')
        """, (detection_id, wl_row["id"], camera_id, camera_name, plate_norm, wl_row["reason"], wl_row["severity"], now_str))
        alert_id = cursor.lastrowid
        alert_info = {
            "alert_id": alert_id,
            "detection_id": detection_id,
            "camera_id": camera_id,
            "camera_name": camera_name,
            "plate_text": plate_norm,
            "reason": wl_row["reason"],
            "severity": wl_row["severity"],
            "alerted_at": now_str
        }

    conn.commit()
    conn.close()
    return detection_id, alert_info

def query_plate(plate_query):
    """Retrieves all detections for a plate ordered by PTS timestamp."""
    conn = get_connection()
    cursor = conn.cursor()
    norm = "".join(c for c in plate_query.upper() if c.isalnum())

    cursor.execute("""
    SELECT * FROM detections
    WHERE plate_normalized = ?
    ORDER BY pts_ms ASC
    """, (norm,))
    rows = cursor.fetchall()
    results = [dict(r) for r in rows]

    cursor.execute("SELECT * FROM watchlist WHERE plate_text = ?", (norm,))
    wl = cursor.fetchone()

    conn.close()
    return results, dict(wl) if wl else None

def get_all_watchlist():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM watchlist ORDER BY severity DESC, id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_watchlist_record(plate, reason, category="Wanted", severity="HIGH"):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    norm = "".join(c for c in plate.upper() if c.isalnum())
    cursor.execute("""
    INSERT OR REPLACE INTO watchlist (plate_text, reason, category, severity, added_at)
    VALUES (?, ?, ?, ?, ?)
    """, (norm, reason, category, severity, now_str))
    conn.commit()
    conn.close()
    return True

def delete_watchlist_record(record_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM watchlist WHERE id = ?", (record_id,))
    conn.commit()
    conn.close()
    return True

def get_recent_alerts(limit=30):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_recent_detections(limit=50):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM detections ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
