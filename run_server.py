"""
Dual HTTP (8000) & HTTPS (8443) Server Runner for MetaRetail AI
Ensures both local web dashboard and secure mobile phone cameras connect to the same backend instance.
"""
import asyncio
import os
import signal
import sys
import uvicorn
from backend.app.main import app

async def run_servers():
    loop = asyncio.get_running_loop()
    
    # 1. HTTP Server (Port 8000)
    config_http = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )
    server_http = uvicorn.Server(config_http)
    servers = [server_http]

    # 2. HTTPS Server (Port 8443) for Secure Mobile Camera Streaming
    cert_file = "certs/cert.pem"
    key_file = "certs/key.pem"
    if os.path.exists(cert_file) and os.path.exists(key_file):
        config_https = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=8443,
            ssl_keyfile=key_file,
            ssl_certfile=cert_file,
            log_level="info",
            access_log=True
        )
        server_https = uvicorn.Server(config_https)
        servers.append(server_https)
        print("🔒 [HTTPS Enabled] Secure streaming active on https://0.0.0.0:8443")
    else:
        print("⚠️ [HTTPS Disabled] certs/cert.pem not found. Mobile camera requires HTTPS.")

    tasks = [asyncio.create_task(s.serve()) for s in servers]

    def stop():
        for s in servers:
            s.should_exit = True

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop)
        except NotImplementedError:
            pass

    print("🚀 [MetaRetail AI] HTTP running on http://0.0.0.0:8000")
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    try:
        asyncio.run(run_servers())
    except (KeyboardInterrupt, SystemExit):
        pass
