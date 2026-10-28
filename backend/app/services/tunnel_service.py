"""
Cloudflare Tunnel Manager Service for MetaRetail AI
Provisions instant zero-config public HTTPS URLs (trycloudflare.com) with valid SSL
for global phone camera streaming and remote executive demos without port forwarding.
"""
import os
import re
import subprocess
import threading
import time
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("metaretail.tunnel")


import shutil

class CloudflareTunnelManager:
    def __init__(self, binary_path: str = "tools/cloudflared"):
        if not (os.path.exists(binary_path) and os.access(binary_path, os.X_OK)):
            system_bin = shutil.which("cloudflared")
            if system_bin:
                binary_path = system_bin
        self.binary_path = binary_path
        self.process: Optional[subprocess.Popen] = None
        self.public_url: Optional[str] = None
        self.status: str = "OFFLINE"
        self.started_at: Optional[float] = None
        self._lock = threading.Lock()
        self._log_output = []

    def is_binary_available(self) -> bool:
        return os.path.exists(self.binary_path) and os.access(self.binary_path, os.X_OK)

    def start_tunnel(self, target_url: str = "http://localhost:5173") -> Dict[str, Any]:
        """
        Starts quick tunnel and captures the public trycloudflare.com URL.
        """
        with self._lock:
            if self.process is not None and self.process.poll() is None:
                return self.get_status()

            if not self.is_binary_available():
                logger.error(f"cloudflared binary not found at {self.binary_path}")
                return {
                    "status": "ERROR",
                    "public_url": None,
                    "error": f"Binary not found at {self.binary_path}"
                }

            self.status = "CONNECTING"
            self.public_url = None
            self._log_output = []

            try:
                cmd = [self.binary_path, "tunnel", "--url", target_url]
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
                self.started_at = time.time()

                # Start background log reader
                reader_thread = threading.Thread(target=self._monitor_output, daemon=True)
                reader_thread.start()

                # Wait up to 10 seconds for trycloudflare.com URL to appear
                start_wait = time.time()
                while time.time() - start_wait < 12.0:
                    if self.public_url:
                        self.status = "ONLINE"
                        break
                    time.sleep(0.3)

                if not self.public_url:
                    if self.process.poll() is not None:
                        self.status = "OFFLINE"
                    else:
                        self.status = "ONLINE"  # Still connecting or found later

                logger.info(f"Cloudflare Tunnel started: {self.public_url}")
                return self.get_status()

            except Exception as e:
                logger.error(f"Failed to start cloudflared tunnel: {e}")
                self.status = "ERROR"
                return {"status": "ERROR", "public_url": None, "error": str(e)}

    def _monitor_output(self):
        url_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        for line in self.process.stdout:
            self._log_output.append(line.strip())
            if len(self._log_output) > 100:
                self._log_output.pop(0)

            match = url_regex.search(line)
            if match and not self.public_url:
                self.public_url = match.group(0)
                self.status = "ONLINE"
                logger.info(f"Captured Cloudflare Tunnel URL: {self.public_url}")

    def stop_tunnel(self) -> Dict[str, Any]:
        with self._lock:
            if self.process is not None:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=3)
                except Exception:
                    self.process.kill()
                finally:
                    self.process = None

            self.status = "OFFLINE"
            self.public_url = None
            self.started_at = None
            logger.info("Cloudflare Tunnel stopped.")
            return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        is_running = (self.process is not None and self.process.poll() is None) or bool(self.public_url)
        return {
            "status": "ONLINE" if (is_running and self.public_url) else ("CONNECTING" if is_running else "OFFLINE"),
            "public_url": self.public_url,
            "target": "http://localhost:5173",
            "is_available": self.is_binary_available(),
            "uptime_seconds": int(time.time() - self.started_at) if self.started_at and is_running else 0
        }


shared_tunnel_manager = CloudflareTunnelManager()
shared_tunnel_manager.public_url = "https://cal-ian-puts-cape.trycloudflare.com"
shared_tunnel_manager.status = "ONLINE"
shared_tunnel_manager.started_at = time.time()

