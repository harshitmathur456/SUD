#!/usr/bin/env python3
"""
Sentinel Unified Grid — ANPR Video Inference & OCR Pipeline
Author: Sentinel Core Team (Gujarat Police Innovation Hackathon 2026)

Uses Ultralytics YOLOv8 for vehicle localization + Deep Learning EasyOCR for text extraction.
NO hardcoded fallback: Only records genuinely read and recognized license plates.
Cross-references with Watchlist DB and writes structured audit logs.
"""

import os
import sys
import json
import time
import argparse
import datetime
import csv
import re
import cv2
import numpy as np

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from watchlist_db import check_watchlist, WATCHLIST_DATABASE

# Indian License Plate Regex pattern (e.g., GJ01AB1234, GJ05WL9999, MH12DE1432)
INDIAN_PLATE_REGEX = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$')

def normalize_plate_string(text: str) -> str:
    """
    Cleans OCR artifacts and enforces standard alphanumeric characters.
    Handles common visual OCR confusions: 0 vs O, 1 vs I, 8 vs B, 5 vs S.
    """
    if not text:
        return ""
    
    clean = re.sub(r'[^A-Za-z0-9]', '', text).upper()
    if len(clean) < 4:
        return ""
    
    chars = list(clean)
    
    # State Code (first 2 chars): Must be letters (e.g., 0J -> GJ)
    for i in range(min(2, len(chars))):
        if chars[i] == '0': chars[i] = 'G' if i == 0 else 'J'
        elif chars[i] == '1': chars[i] = 'I'
        elif chars[i] == '8': chars[i] = 'B'
        elif chars[i] == '5': chars[i] = 'S'
    
    # District digits (chars 2 to 4): Must be digits (e.g., O1 -> 01)
    if len(chars) >= 4:
        for i in range(2, min(4, len(chars))):
            if chars[i] in ('O', 'D', 'Q'): chars[i] = '0'
            elif chars[i] in ('I', 'L'): chars[i] = '1'
            elif chars[i] == 'Z': chars[i] = '2'
            elif chars[i] == 'S': chars[i] = '5'
            elif chars[i] == 'B': chars[i] = '8'

    # Suffix 4 digits (last 4 chars if length >= 8): Must be digits
    if len(chars) >= 8:
        for i in range(len(chars) - 4, len(chars)):
            if chars[i] in ('O', 'D', 'Q'): chars[i] = '0'
            elif chars[i] in ('I', 'L'): chars[i] = '1'
            elif chars[i] == 'Z': chars[i] = '2'
            elif chars[i] == 'S': chars[i] = '5'
            elif chars[i] == 'B': chars[i] = '8'

    return "".join(chars)

class YOLOVehiclePlateDetector:
    """
    Two-stage detector:
    Stage 1: Pretrained YOLOv8 detects vehicles (car, truck, bus, motorcycle)
    Stage 2: High-contrast morphological localization pinpoints plate region within vehicle bbox
    """
    def __init__(self):
        self.yolo = None
        try:
            from ultralytics import YOLO
            print("[INFO] Loading pretrained YOLOv8n object detection model...")
            self.yolo = YOLO('yolov8n.pt')
            print("[OK] YOLOv8n model initialized.")
        except Exception as e:
            print(f"[WARN] YOLOv8 could not be loaded ({e}). Falling back to full-frame morphological detector.")

    def detect_plate_crops(self, frame):
        """
        Returns list of candidate plate crops with coordinates:
        [{ 'crop': np.ndarray, 'bbox': (x, y, w, h), 'parent_vehicle': (vx, vy, vw, vh) }]
        """
        h, w = frame.shape[:2]
        plate_candidates = []

        vehicle_boxes = []
        if self.yolo is not None:
            try:
                results = self.yolo.predict(frame, conf=0.35, classes=[2, 3, 5, 7], verbose=False) # car, motorcycle, bus, truck
                for r in results:
                    for box in r.boxes:
                        bx1, by1, bx2, by2 = map(int, box.xyxy[0].tolist())
                        vehicle_boxes.append((bx1, by1, bx2 - bx1, by2 - by1))
            except Exception as e:
                pass

        # If YOLO found vehicles, search for plates inside each vehicle region
        search_regions = vehicle_boxes if vehicle_boxes else [(0, int(h * 0.2), w, int(h * 0.8))]

        for (rx, ry, rw, rh) in search_regions:
            rx = max(0, rx); ry = max(0, ry)
            rw = min(w - rx, rw); rh = min(h - ry, rh)
            if rw < 60 or rh < 40:
                continue

            roi = frame[ry:ry+rh, rx:rx+rw]
            gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            blur = cv2.bilateralFilter(gray_roi, 11, 17, 17)

            # Sobel horizontal gradient
            grad_x = cv2.Sobel(blur, cv2.CV_16S, 1, 0, ksize=3)
            abs_grad_x = cv2.convertScaleAbs(grad_x)

            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (17, 3))
            closed = cv2.morphologyEx(abs_grad_x, cv2.MORPH_CLOSE, kernel)
            _, thresh = cv2.threshold(closed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            clean_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 3))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, clean_kernel)

            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                cx, cy, cw, ch = cv2.boundingRect(cnt)
                aspect = float(cw) / max(ch, 1)
                area = cw * ch

                if 2.0 <= aspect <= 6.5 and area > 1000 and cw > 50 and ch > 12:
                    global_x = rx + cx
                    global_y = ry + cy
                    pad_w = int(cw * 0.08)
                    pad_h = int(ch * 0.08)

                    x1 = max(0, global_x - pad_w)
                    y1 = max(0, global_y - pad_h)
                    x2 = min(w, global_x + cw + pad_w)
                    y2 = min(h, global_y + ch + pad_h)

                    crop = frame[y1:y2, x1:x2]
                    plate_candidates.append({
                        "crop": crop,
                        "bbox": (global_x, global_y, cw, ch),
                        "aspect": aspect,
                        "area": area
                    })

        # Sort by area descending
        plate_candidates.sort(key=lambda c: c["area"], reverse=True)
        return plate_candidates

class EasyOCRReader:
    """
    Real EasyOCR text extraction without hardcoded fallbacks
    """
    def __init__(self):
        import easyocr
        print("[INFO] Initializing EasyOCR Reader (English)...")
        self.reader = easyocr.Reader(['en'], gpu=False)
        print("[OK] EasyOCR Reader ready.")

    def read(self, crop):
        if crop is None or crop.size == 0:
            return "", 0.0

        # Standardize height
        target_h = 64
        scale = target_h / crop.shape[0]
        new_w = max(int(crop.shape[1] * scale), 64)
        resized = cv2.resize(crop, (new_w, target_h), interpolation=cv2.INTER_CUBIC)

        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        norm = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(norm)

        # Run EasyOCR
        results = self.reader.readtext(enhanced)
        if not results:
            # Try on original crop
            results = self.reader.readtext(crop)

        if not results:
            return "", 0.0

        # Sort detections left-to-right and combine
        results.sort(key=lambda r: r[0][0][0])
        raw_text = "".join([r[1] for r in results])
        confidences = [float(r[2]) for r in results]
        avg_conf = (sum(confidences) / len(confidences)) * 100.0 if confidences else 0.0

        cleaned = normalize_plate_string(raw_text)
        return cleaned, round(avg_conf, 1)

class ANPRVideoPipeline:
    def __init__(self, video_source, camera_id=1, camera_name="Camera 1 - Chiman bhai Bridge, Ahmedabad", output_dir="output"):
        self.video_source = video_source
        self.camera_id = int(camera_id)
        self.camera_name = camera_name
        self.output_dir = output_dir

        self.detector = YOLOVehiclePlateDetector()
        self.ocr = EasyOCRReader()

        self.thumbs_dir = os.path.join(self.output_dir, "thumbnails")
        os.makedirs(self.thumbs_dir, exist_ok=True)

        self.detections = []
        self.watchlist_hits = []

    def run(self, max_frames=None, sample_step=3):
        print("=" * 70)
        print("  SENTINEL UNIFIED GRID — REAL YOLO + EasyOCR ANPR PIPELINE")
        print("=" * 70)
        print(f"[*] Ingesting Feed: {self.video_source}")
        print(f"[*] Camera Node:    [#{self.camera_id}] {self.camera_name}")
        print(f"[*] Output Dir:     {self.output_dir}")
        print(f"[*] Watchlist Pool: {len(WATCHLIST_DATABASE)} Targets")
        print("-" * 70)

        cap = cv2.VideoCapture(self.video_source)
        if not cap.isOpened():
            print(f"[ERROR] Could not open video source: {self.video_source}")
            return []

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"[*] Stream Metadata: {width}x{height} @ {fps:.1f} FPS, Total Frames: {total_frames}")

        frame_idx = 0
        detections_count = 0
        watchlist_hits_count = 0
        start_pts = int(time.time() * 1000)

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if max_frames and frame_idx > max_frames:
                break

            if frame_idx % sample_step != 0:
                continue

            pts_timestamp = start_pts + int((frame_idx / fps) * 1000)
            utc_time = datetime.datetime.fromtimestamp(pts_timestamp / 1000.0).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

            candidates = self.detector.detect_plate_crops(frame)
            for cand in candidates[:2]: # Evaluate top 2 candidate crops
                crop = cand["crop"]
                plate_text, conf = self.ocr.read(crop)

                # Require minimum 5 characters and reasonable confidence
                if plate_text and len(plate_text) >= 5 and conf >= 40.0:
                    detections_count += 1
                    x, y, cw, ch = cand["bbox"]

                    wl_info = check_watchlist(plate_text)
                    is_hit = wl_info is not None

                    box_color = (0, 0, 255) if is_hit else (0, 255, 0)
                    cv2.rectangle(frame, (x, y), (x + cw, y + ch), box_color, 2)

                    label = f"{plate_text} ({conf}%)"
                    if is_hit:
                        label += " [WATCHLIST HIT]"
                        watchlist_hits_count += 1
                        print("\n" + "!" * 70)
                        print(f"[ALERT] [WATCHLIST INTERCEPT] Genuine Plate Read: {plate_text}")
                        print(f"   Reason:    {wl_info['reason']}")
                        print(f"   Severity:  {wl_info['severity']}")
                        print(f"   Camera:    #{self.camera_id} — {self.camera_name}")
                        print(f"   Timestamp: {utc_time} (PTS: {pts_timestamp})")
                        print("!" * 70 + "\n")

                    cv2.putText(frame, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

                    thumb_filename = f"det_cam{self.camera_id}_{plate_text}_{frame_idx}.jpg"
                    thumb_path = os.path.join(self.thumbs_dir, thumb_filename)
                    cv2.imwrite(thumb_path, crop)

                    det_record = {
                        "id": f"DET-LIVE-{self.camera_id}-{frame_idx}",
                        "plate_number": plate_text,
                        "confidence": conf,
                        "camera_id": self.camera_id,
                        "camera_name": self.camera_name,
                        "frame_index": frame_idx,
                        "timestamp_pts": pts_timestamp,
                        "timestamp_utc": utc_time,
                        "bbox": {"x": x, "y": y, "width": cw, "height": ch},
                        "thumbnail_file": thumb_filename,
                        "is_watchlist_hit": is_hit,
                        "watchlist_info": wl_info,
                        "is_real_pipeline_output": True
                    }

                    self.detections.append(det_record)
                    if is_hit:
                        self.watchlist_hits.append(det_record)

                    print(f"[{utc_time}] Cam #{self.camera_id} | Read: {plate_text:12} | Conf: {conf:4.1f}% | Hit: {is_hit}")
                    break

        cap.release()

        # Write to JSON
        json_path = os.path.join(self.output_dir, "detections.json")
        with open(json_path, "w") as f:
            json.dump(self.detections, f, indent=2)

        # Write to CSV
        csv_path = os.path.join(self.output_dir, "anpr_audit_log.csv")
        with open(csv_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Detection_ID", "Plate_Number", "Confidence", "Camera_ID", "Camera_Name", "Timestamp_PTS", "Timestamp_UTC", "Watchlist_Flag", "Reason"])
            for d in self.detections:
                reason = d["watchlist_info"]["reason"] if d["watchlist_info"] else "NONE"
                writer.writerow([d["id"], d["plate_number"], d["confidence"], d["camera_id"], d["camera_name"], d["timestamp_pts"], d["timestamp_utc"], d["is_watchlist_hit"], reason])

        print("-" * 70)
        print("  GENUINE PIPELINE INFERENCE COMPLETE")
        print(f"  Processed Frames:      {frame_idx}")
        print(f"  Genuinely Read Plates: {detections_count}")
        print(f"  Watchlist Hits:        {watchlist_hits_count}")
        print(f"  Saved JSON:            {json_path}")
        print(f"  Saved CSV:             {csv_path}")
        print("=" * 70)

        return self.detections

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sentinel Unified Grid Real YOLO+EasyOCR Pipeline")
    parser.add_argument("--video", type=str, default="", help="Path to video file or stream URL")
    parser.add_argument("--camera-id", type=int, default=1, help="CCTV Camera ID")
    parser.add_argument("--camera-name", type=str, default="Camera 1 - Chiman bhai Bridge, Ahmedabad", help="CCTV Camera Name")
    parser.add_argument("--output-dir", type=str, default="output", help="Output directory")
    args = parser.parse_args()

    video_path = args.video
    if not video_path:
        default_sample = os.path.join("pipeline", "sample_test_feed.mp4")
        if not os.path.exists(default_sample):
            import subprocess
            subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "create_sample_video.py")])
        video_path = default_sample

    pipeline = ANPRVideoPipeline(video_source=video_path, camera_id=args.camera_id, camera_name=args.camera_name, output_dir=args.output_dir)
    pipeline.run()
