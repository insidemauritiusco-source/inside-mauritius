"""Temporary static test server for a trusted private LAN."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import socket, ipaddress
ROOT=Path(__file__).resolve().parent
addresses=[]
for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
    try:
        addr=ipaddress.ip_address(ip)
        if addr.version==4 and addr.is_private and not addr.is_loopback and not addr.is_link_local:
            addresses.append(ip)
    except ValueError:
        pass
print("Local laptop: http://127.0.0.1:8765/")
for ip in sorted(set(addresses)):
    print("Samsung on same trusted Wi-Fi: http://"+ip+":8765/")
if not addresses:
    print("No private LAN address detected. Connect both devices to trusted Wi-Fi and restart.")
    raise SystemExit(1)
print("Choose the Wi-Fi address shown above; bind only to that private interface.")
selected=input("Enter the printed private IP address: ").strip()
if selected not in addresses:
    raise SystemExit("Address not in private interface list")
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)
    def list_directory(self,path):
        self.send_error(403,"Directory listing disabled")
        return None
    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        super().end_headers()
print("Open http://"+selected+":8765/ on the phone. Ctrl+C stops the server.")
with ThreadingHTTPServer((selected,8765),Handler) as server:
    try: server.serve_forever()
    except KeyboardInterrupt: pass
