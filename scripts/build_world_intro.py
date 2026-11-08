#!/usr/bin/env python3
"""Render an original silent 6-second world news brand intro with FFmpeg."""
from pathlib import Path
import shutil, subprocess
root=Path(__file__).resolve().parent.parent
out=root/"media"/"global-perspective.mp4"
out.parent.mkdir(exist_ok=True)
if not shutil.which("ffmpeg"):
    raise RuntimeError("FFmpeg is required")
filter_expr=("drawgrid=w=80:h=80:t=1:c=0x1c5478@0.45,"
 "drawbox=x=28:y=35:w=900:h=460:color=0x154267@0.35:t=3,"
 "drawtext=text='INSIDE MAURITIUS':fontcolor=0x69e5d4:fontsize=34:x=60:y=80,"
 "drawtext=text='WORLD NEWS':fontcolor=white:fontsize=94:x=60:y=185,"
 "drawtext=text='GLOBAL PERSPECTIVE':fontcolor=0x73dfd2:fontsize=50:x=60:y=310,"
 "drawtext=text='Mauritius first. The world in view.':fontcolor=white:fontsize=25:x=60:y=420")
subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i",
"color=c=0x081b33:s=960x540:r=15:d=6","-vf",filter_expr,"-c:v","libx264",
"-preset","medium","-crf","31","-pix_fmt","yuv420p","-movflags","+faststart",
"-an",str(out)],check=True)
print(out, out.stat().st_size)
