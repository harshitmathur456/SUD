import cv2
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from pipeline.yolo_ocr_pipeline import YOLOVehiclePlateDetector, EasyOCRReader
from pipeline.watchlist_db import check_watchlist

def scan_segment(ts_path='output/test_cam01_decrypted.ts'):
    print(f"Scanning sandbox video: {ts_path}")
    detector = YOLOVehiclePlateDetector()
    ocr = EasyOCRReader()

    cap = cv2.VideoCapture(ts_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    print(f"Total frames: {total}, FPS: {fps:.1f}")

    frame_idx = 0
    detected_events = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1

        # Process every 10th frame
        if frame_idx % 10 != 0:
            continue

        candidates = detector.detect_plate_crops(frame)
        for cand in candidates:
            crop = cand['crop']
            plate, conf = ocr.read(crop)
            if plate and len(plate) >= 4:
                wl = check_watchlist(plate)
                hit_str = f" [ALERT: {wl['reason']}]" if wl else ""
                print(f"Frame {frame_idx:03d} (t={frame_idx/fps:.2f}s) | Plate: {plate} | Conf: {conf:.1f}%{hit_str}")
                detected_events.append({
                    "frame": frame_idx,
                    "time_sec": round(frame_idx / fps, 2),
                    "plate": plate,
                    "conf": conf,
                    "watchlist_hit": wl is not None,
                    "watchlist_info": wl
                })

    cap.release()
    print(f"\nFinished scan: {len(detected_events)} plate readings found.")
    return detected_events

if __name__ == "__main__":
    scan_segment()
