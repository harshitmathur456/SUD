"""
Sentinel Unified Grid — Authenticated HLS Stream Proxy
Proxies live HLS streams from cctv.corp8.cloud to the web browser and CV workers,
handling Cloudflare session cookies, AES-128 decryption keys, and CORS headers.
"""

import os
import time
import re
import requests
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse

stream_router = APIRouter(prefix="/api/stream", tags=["stream"])

# Sentinel Sandbox Credentials
AUTH_EMAIL = os.getenv("SENTINEL_AUTH_EMAIL", "olly2015aarav@gmail.com")
AUTH_CODE = os.getenv("SENTINEL_AUTH_CODE", "RW5U-WGXD-VR4X")
BASE_URL = "https://cctv.corp8.cloud"

class StreamProxySession:
    def __init__(self):
        self.session = requests.Session()
        self.last_login_time = 0
        self.login_ttl = 3600  # 1 hour
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://cctv.corp8.cloud/",
            "Origin": "https://cctv.corp8.cloud",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Accept": "*/*"
        }

    def ensure_authenticated(self):
        """Authenticates with the CCTV portal if expired or not yet logged in."""
        now = time.time()
        if now - self.last_login_time < self.login_ttl and "sentinel" in self.session.cookies:
            return True

        try:
            print("[PROXY] Authenticating with Sentinel Sandbox (cctv.corp8.cloud)...")
            login_url = f"{BASE_URL}/auth/login"
            resp = self.session.post(
                login_url,
                data={"email": AUTH_EMAIL, "password": AUTH_CODE},
                headers={"User-Agent": self.headers["User-Agent"]},
                timeout=8
            )
            if resp.status_code in (200, 302) and "sentinel" in self.session.cookies:
                self.last_login_time = now
                print("[PROXY] Authentication successful! Session established.")
                return True
            else:
                print(f"[PROXY] Login failed with status {resp.status_code}")
                return False
        except Exception as e:
            print(f"[PROXY] Auth error: {e}")
            return False

proxy_manager = StreamProxySession()

def format_cam_slug(cam_id: str) -> str:
    """Standardizes camera identifiers (e.g. 1 -> cam01, cam1 -> cam01, cam01 -> cam01)."""
    raw = str(cam_id).lower().strip()
    digits = "".join(c for c in raw if c.isdigit())
    if digits:
        num = int(digits)
        return f"cam{num:02d}"
    return raw

@stream_router.get("/{cam_id}/index.m3u8")
def get_hls_manifest(cam_id: str):
    """
    Fetches and rewrites the HLS manifest for a given camera,
    redirecting AES-128 key requests to the local authenticated proxy.
    """
    if not proxy_manager.ensure_authenticated():
        raise HTTPException(status_code=503, detail="Sandbox stream authentication unavailable")

    slug = format_cam_slug(cam_id)
    manifest_url = f"{BASE_URL}/{slug}/index.m3u8"

    try:
        r = proxy_manager.session.get(manifest_url, headers=proxy_manager.headers, timeout=6)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=f"Remote feed returned {r.status_code}")

        content = r.text

        # Rewrite URI="/enc.key" to point to local proxy endpoint
        # e.g. URI="/enc.key" -> URI="/api/stream/enc.key"
        content = re.sub(
            r'URI="(/enc\.key|enc\.key)"',
            rf'URI="/api/stream/{slug}/enc.key"',
            content
        )

        return Response(
            content=content,
            media_type="application/vnd.apple.mpegurl",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        )
    except Exception as e:
        print(f"[PROXY] Manifest fetch error for {slug}: {e}")
        raise HTTPException(status_code=502, detail=str(e))

@stream_router.get("/{cam_id}/enc.key")
def get_encryption_key(cam_id: str):
    """Serves the AES-128 key needed by Hls.js to decrypt surveillance segments."""
    if not proxy_manager.ensure_authenticated():
        raise HTTPException(status_code=503, detail="Sandbox authentication unavailable")

    try:
        key_url = f"{BASE_URL}/enc.key"
        r = proxy_manager.session.get(key_url, headers=proxy_manager.headers, timeout=5)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Key fetch error")

        return Response(
            content=r.content,
            media_type="application/octet-stream",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@stream_router.get("/{cam_id}/{segment_file}")
def get_video_segment(cam_id: str, segment_file: str):
    """Streams .ts video chunks to the browser player with full CORS support."""
    if not proxy_manager.ensure_authenticated():
        raise HTTPException(status_code=503, detail="Sandbox authentication unavailable")

    slug = format_cam_slug(cam_id)
    seg_url = f"{BASE_URL}/{slug}/{segment_file}"

    try:
        r = proxy_manager.session.get(seg_url, headers=proxy_manager.headers, stream=True, timeout=8)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Segment fetch error")

        return StreamingResponse(
            r.iter_content(chunk_size=65536),
            media_type="video/mp2t",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
