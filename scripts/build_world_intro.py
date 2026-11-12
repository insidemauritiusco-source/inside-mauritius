#!/usr/bin/env python3
"""Build a visibly animated, six-second, silent World News intro.

An earlier intro showed the *same* image in every frame. It looked frozen
even while playing, particularly because it intentionally has no audio.
Export MP4 H.264 Constrained Baseline + WebM VP8 for browser compatibility.
These are original graphics; they do not represent a current news event.
"""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
MEDIA.mkdir(exist_ok=True)
MP4 = MEDIA / "global-perspective.mp4"
WEBM = MEDIA / "global-perspective.webm"

if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
    raise RuntimeError("FFmpeg and ffprobe are required")

# The gold indicator and cyan ticker genuinely move as time (t) advances.
# Keep this original Inside Mauritius wording; do not use third-party footage.
filter_expr = (
    "drawgrid=w=80:h=80:t=1:c=0x1c5478@0.45,"
    "drawbox=x=28:y=35:w=900:h=460:color=0x154267@0.35:t=3,"
    "drawtext=text='INSIDE MAURITIUS':fontcolor=0x69e5d4:fontsize=34:x=60:y=80,"
    "drawtext=text='WORLD NEWS':fontcolor=white:fontsize=94:x=60:y=185,"
    "drawtext=text='GLOBAL PERSPECTIVE':fontcolor=0x73dfd2:fontsize=50:x=60:y=310,"
    "drawtext=text='Mauritius first. The world in view.':fontcolor=white:fontsize=25:x=60:y=420,"
    "drawtext=text='●':fontcolor=0xffd65a:fontsize=48:x='50+140*t':y=464,"
    "drawtext=text='▶  LIVE WORLD UPDATES':fontcolor=0x69e5d4:fontsize=19:x='960-175*t':y=495"
)

def run(command):
    subprocess.run(command, check=True)

run([
    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=0x081b33:s=960x540:r=15:d=6",
    "-vf", filter_expr,
    "-c:v", "libx264", "-profile:v", "baseline", "-level:v", "3.1",
    "-preset", "medium", "-crf", "29", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", str(MP4),
])
run([
    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(MP4), "-an",
    "-c:v", "libvpx", "-deadline", "good", "-cpu-used", "4",
    "-b:v", "0", "-crf", "30", str(WEBM),
])

for video, codec in ((MP4, "h264"), (WEBM, "vp8")):
    if video.stat().st_size < 10000:
        raise RuntimeError(f"{video} is unexpectedly small")
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1", str(video)
        ],
        check=True, capture_output=True, text=True
    )
    if probe.stdout.strip() != codec:
        raise RuntimeError(f"{video} has wrong codec: {probe.stdout.strip()}")
    print(f"{video.relative_to(ROOT)}: {video.stat().st_size} bytes ({codec})")
