#!/usr/bin/env python3
"""Prepare up to five source-linked news recordings for editorial review.
Never commits, deploys, or schedules itself. Default mode is a free dry run.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import urllib.request
import urllib.parse
import subprocess
import tempfile
import shutil

VOICE_ID = "341b4807e5e6455fa88f34bda5d6eeea"
VOICE_NAME = "Tanguy"

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "news-audio"

def load_assignment(name, marker):
    raw = (ROOT / name).read_text(encoding="utf-8")
    return json.JSONDecoder().raw_decode(raw.split(marker, 1)[1].lstrip())[0]

def stamp(value):
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=dt.timezone.utc if len(value)==10 else dt.datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo).timestamp()
    except (ValueError, TypeError, AttributeError):
        return 0

def tracks():
    local = load_assignment("newsroom-data.js", "window.INSIDE_MAURITIUS_NEWSROOM_ARTICLES =")
    world = load_assignment("world-news-data.js", "window.INSIDE_MAURITIUS_WORLD_NEWS =")["headlines"]
    rows, seen = [], set()
    for items, is_world in ((local, False), (world, True)):
        for item in items:
            url = item.get("url") if is_world else next((item.get(k) for k in ("sourceUrl","videoUrl","tiktokUrl") if str(item.get(k,"")).startswith("https://")), None)
            title = item.get("title")
            if not isinstance(title,str) or not title or not isinstance(url,str) or not url.startswith("https://") or url in seen:
                continue
            seen.add(url)
            source = str(item.get("source") if is_world else item.get("sourceName") or item.get("author") or "External publisher").removesuffix(" (external report)")
            category = "World" if is_world or item.get("category") == "World" else "Video" if item.get("category") == "Video" else "Mauritius"
            rows.append((stamp(item.get("publishedAt") or item.get("date") or ""), {"title": title, "source": source, "category": category}))
    return [row for _,row in sorted(rows,key=lambda pair:pair[0],reverse=True)[:5]]

def generate(text, path, key, voice):
    if path.exists() and path.stat().st_size > 1024:
        return
    payload = {"voice_id":voice,"text":text,"seed":27,"speed":0.95}
    request = urllib.request.Request("https://api.heygen.com/v3/models/audio/tts", data=json.dumps(payload).encode(), headers={"X-Api-Key":key,"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=160) as response:
        result = json.loads(response.read(500_001))
    url = result.get("data", {}).get("audio_url", "")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Missing valid HTTPS audio URL")
    # No authentication header is forwarded to the audio download.
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read(20_000_001)
    if len(data) < 1024 or len(data) > 20_000_000:
        raise ValueError("Unexpected audio response size")
    with tempfile.TemporaryDirectory() as folder:
        raw = Path(folder) / "source.audio"
        mp3 = Path(folder) / "output.mp3"
        raw.write_bytes(data)
        subprocess.run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-i",str(raw),"-vn","-c:a","libmp3lame","-b:a","128k","-ar","44100","-ac","1",str(mp3)],check=True,timeout=60)
        subprocess.run(["ffmpeg","-nostdin","-v","error","-xerror","-i",str(mp3),"-f","null","-"],check=True,timeout=60)
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(mp3.read_bytes())
        tmp.replace(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true", help="Explicitly authorize up to five billable speech requests")
    args = parser.parse_args()
    rows = tracks()
    if not rows:
        raise SystemExit("No matching news headlines")
    if not args.generate:
        print(f"Dry run: {len(rows)} headline recordings planned with Tanguy. No API requests.")
        return
    key = os.environ.get("HEYGEN_API_KEY")
    if not key:
        raise SystemExit("Missing server-side HEYGEN_API_KEY; no requests made.")
    if not shutil.which("ffmpeg"):
        raise SystemExit("Install ffmpeg before generating audio; no requests made.")
    voice = VOICE_ID
    OUT.mkdir(exist_ok=True)
    for row in rows:
        digest = hashlib.sha256(json.dumps([voice,row],ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:24]
        file = OUT / (digest+".mp3")
        generate(row["title"]+". Source: "+row["source"]+".",file,key,voice)
        row["file"] = "news-audio/"+file.name
    # Do not replace the active manifest: editor must review each recording.
    (OUT / "manifest.review.json").write_text(json.dumps({"version":1,"voice":"Tanguy","tracks":rows},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Review MP3s and exact headline attribution before approving manifest.review.json.")
if __name__ == "__main__":
    main()
