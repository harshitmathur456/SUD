#!/usr/bin/env python3
"""
Generates a realistic CCTV surveillance test video with an approaching vehicle
and high-contrast Gujarat license plate for testing the ANPR pipeline.
"""

import os
import cv2
import numpy as np

def generate_test_video(filename="pipeline/sample_test_feed.mp4", duration_seconds=4, fps=25, plate_text="GJ01AB1234"):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    width, height = 1280, 720
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(filename, fourcc, fps, (width, height))

    total_frames = duration_seconds * fps
    print(f"[*] Generating {duration_seconds}s sample surveillance video: {filename} ({total_frames} frames)...")

    for f in range(total_frames):
        # Create road surveillance background
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Asphalt road surface
        cv2.rectangle(frame, (0, int(height * 0.4)), (width, height), (40, 42, 45), -1)
        
        # Road lane markings (dashed)
        lane_y = int(height * 0.72)
        for lx in range(0, width, 100):
            cv2.line(frame, (lx, lane_y), (lx + 50, lane_y), (200, 200, 200), 4)

        # Distant horizon & urban road barrier
        cv2.rectangle(frame, (0, int(height * 0.38)), (width, int(height * 0.42)), (70, 75, 80), -1)

        # Moving vehicle approaching CCTV camera (scaling up)
        progress = f / float(total_frames)
        scale = 0.5 + progress * 0.8  # vehicle grows as it approaches
        
        car_w = int(320 * scale)
        car_h = int(190 * scale)
        car_x = int((width - car_w) / 2 + np.sin(f * 0.1) * 20)
        car_y = int(height * 0.45 + progress * (height * 0.25))

        # Vehicle Body (Dark Navy Metallic SUV)
        cv2.rectangle(frame, (car_x, car_y), (car_x + car_w, car_y + car_h), (25, 30, 45), -1)
        cv2.rectangle(frame, (car_x, car_y), (car_x + car_w, car_y + car_h), (60, 70, 90), 2)
        
        # Windshield / Rear Glass
        glass_w = int(car_w * 0.8)
        glass_h = int(car_h * 0.35)
        glass_x = car_x + int((car_w - glass_w) / 2)
        glass_y = car_y + int(car_h * 0.08)
        cv2.rectangle(frame, (glass_x, glass_y), (glass_x + glass_w, glass_y + glass_h), (10, 15, 20), -1)

        # Taillights / Headlights
        light_w = int(car_w * 0.14)
        light_h = int(car_h * 0.12)
        cv2.rectangle(frame, (car_x + 10, car_y + int(car_h * 0.45)), (car_x + 10 + light_w, car_y + int(car_h * 0.45) + light_h), (0, 0, 220), -1)
        cv2.rectangle(frame, (car_x + car_w - 10 - light_w, car_y + int(car_h * 0.45)), (car_x + car_w - 10, car_y + int(car_h * 0.45) + light_h), (0, 0, 220), -1)

        # Bumper & Number Plate Mounting Area
        bumper_y = car_y + int(car_h * 0.68)
        cv2.rectangle(frame, (car_x + 20, bumper_y), (car_x + car_w - 20, car_y + car_h - 10), (15, 18, 22), -1)

        # HIGH-CONTRAST LICENSE PLATE (White plate, black border, black bold letters)
        plate_w = int(car_w * 0.42)
        plate_h = int(car_h * 0.20)
        plate_x = car_x + int((car_w - plate_w) / 2)
        plate_y = bumper_y + 4

        # Plate background (white with IND blue strip on left)
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (245, 248, 250), -1)
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + plate_w, plate_y + plate_h), (0, 0, 0), 2)
        
        # IND blue strip
        ind_strip_w = max(6, int(plate_w * 0.1))
        cv2.rectangle(frame, (plate_x, plate_y), (plate_x + ind_strip_w, plate_y + plate_h), (180, 60, 20), -1)

        # Registration Text
        font_scale = 0.5 * scale
        text_thickness = max(1, int(1.8 * scale))
        (tw, th), _ = cv2.getTextSize(plate_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_thickness)
        text_x = plate_x + ind_strip_w + int((plate_w - ind_strip_w - tw) / 2)
        text_y = plate_y + int((plate_h + th) / 2)
        cv2.putText(frame, plate_text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), text_thickness, cv2.LINE_AA)

        # CCTV OSD HUD (Timestamp, Camera Name, Bitrate)
        cv2.putText(frame, "CAM 01 - CHIMAN BHAI BRIDGE [AHMEDABAD POLICE]", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.putText(frame, f"LIVE REC [25 FPS] | FRAME: {f:04d} | PTS: {1725437415000 + f * 40}", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 1)

        out.write(frame)

    out.release()
    print(f"[OK] Sample surveillance video generated successfully at {filename}")

if __name__ == "__main__":
    generate_test_video()
