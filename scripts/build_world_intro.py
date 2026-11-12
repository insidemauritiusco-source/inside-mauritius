#!/usr/bin/env python3
"""Generate and decode-test browser-friendly original silent World News intro."""
from pathlib import Path
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
MEDIA.mkdir(exist_ok=True)

def command(args):
    subprocess.run(args, check=True)

for tool in ("ffmpeg", "ffprobe"):
    if not shutil.which(tool):
        raise RuntimeError(f"{tool} is required for video generation")

# Original branded illustration, not event footage. This six-second intro is silent.
filter_expr = (
    "drawgrid=w=80:h=80:t=1:c=0x1c5478@0.45,"
    "drawbox=x=28:y=35:w=900:h=460:color=0x154267@0.35:t=3,"
    "drawtext=text='INSIDE MAURITIUS':fontcolor=0x69e5d4:fontsize=34:x=60:y=80,"
    "drawtext=text='WORLD NEWS':fontcolor=white:fontsize=94:x=60:y=185,"
    "drawtext=text='GLOBAL PERSPECTIVE':fontcolor=0x73dfd2:fontsize=50:x=60:y=310,"
    "drawtext=text='Mauritius first. The world in view.':fontcolor=white:fontsize=25:x=60:y=420"
)
source = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
          "color=c=0x081b33:s=960x540:r=15:d=6", "-vf", filter_expr,
          "-pix_fmt", "yuv420p", "-an"]
variants = [
    ("global-perspective.mp4", ["-c:v", "libx264", "-profile:v", "baseline", "-level:v", "3.1",
                                "-preset", "medium", "-crf", "25", "-movflags", "+faststart"], "h264"),
    ("global-perspective.webm", ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "4",
                                 "-b:v", "240k"], "vp8"),
]
for filename, encoding, codec in variants:
    output = MEDIA / filename
    command(source + encoding + [str(output)])
    data = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,pix_fmt:format=duration",
        "-of", "json", str(output)
    ], text=True))
    video = data["streams"][0]
    duration = float(data["format"]["duration"])
    if not (video["codec_name"] == codec and video["pix_fmt"] == "yuv420p"
            and video["width"] == 960 and video["height"] == 540 and 5.8 <= duration <= 6.2):
        raise RuntimeError(f"Video format is invalid: {filename}, {data}")
    command(["ffmpeg", "-hide_banner", "-v", "error", "-xerror", "-i", str(output), "-f", "null", "-"])
    print(f"Validated {filename}: {codec}, {duration:.2f}s, {output.stat().st_size} bytes")
