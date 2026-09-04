import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import cv2
import tempfile
import os

session = requests.Session()
login_res = session.post(
    'https://cctv.corp8.cloud/auth/login',
    data={'email': 'harshitmathur456@gmail.com', 'password': 'PTCB-MR9Z-U9UW'},
    headers={'User-Agent': 'Mozilla/5.0'}
)
print("Login HTTP status:", login_res.status_code)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Referer': 'https://cctv.corp8.cloud/',
    'Accept': '*/*'
}

# 1. Fetch key
key_res = session.get('https://cctv.corp8.cloud/enc.key', headers=headers)
aes_key = key_res.content
print(f"AES key obtained: {len(aes_key)} bytes, hex: {aes_key.hex()}")

# 2. Fetch segment seg00000.ts for cam01
seg_url = 'https://cctv.corp8.cloud/cam01/seg00000.ts'
seg_res = session.get(seg_url, headers=headers)
print(f"Segment downloaded: status {seg_res.status_code}, size: {len(seg_res.content)} bytes")

# 3. Decrypt AES-128-CBC
iv = bytes.fromhex('00000000000000000000000000000000')
cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
decryptor = cipher.decryptor()
decrypted_data = decryptor.update(seg_res.content) + decryptor.finalize()

print(f"Decrypted data size: {len(decrypted_data)} bytes")

# Save to temp file and read with OpenCV
out_ts_path = 'output/test_cam01_decrypted.ts'
with open(out_ts_path, 'wb') as f:
    f.write(decrypted_data)
print(f"Saved decrypted TS to {out_ts_path}")

cap = cv2.VideoCapture(out_ts_path)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"OpenCV Inspection: {frame_count} frames, {fps:.2f} FPS, resolution {width}x{height}")

success, frame = cap.read()
if success:
    print(f"Successfully read first frame! Frame shape: {frame.shape}")
    sample_frame_path = 'output/gov_cam01_frame0.jpg'
    cv2.imwrite(sample_frame_path, frame)
    print(f"Saved first frame to {sample_frame_path}")
else:
    print("Failed to read frame from decrypted video")
cap.release()
