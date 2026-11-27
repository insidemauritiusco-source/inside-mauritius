"""Generate cached MP3 headline audio; no network speech API or deployment."""
import argparse, hashlib, json, pathlib, re, subprocess, tempfile
from urllib.parse import urlsplit
ROOT = pathlib.Path(__file__).resolve().parents[1]
VOICES = {"fr": ("f", "ff_siwis"), "en": ("b", "bm_george")}
PREFIX = "window.INSIDE_MAURITIUS_HEADLINE_AUDIO = "
def read_data(path):
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw.split("=", 1)[1].strip().rstrip(";"))
def valid_url(url):
    if not isinstance(url, str): return False
    try:
        p = urlsplit(url)
        return p.scheme == "https" and bool(p.hostname) and not p.username and not p.password
    except ValueError: return False
def entries(root):
    local = read_data(root / "newsroom-data.js")
    world = read_data(root / "world-news-data.js")["headlines"]
    seen = set()
    for row in local + world:
        title = row.get("title")
        url = next((row.get(k) for k in ("sourceUrl","videoUrl","tiktokUrl","url") if valid_url(row.get(k))), None)
        if not isinstance(title,str) or not title.strip() or not url or url in seen: continue
        seen.add(url)
        yield title, url, row.get("language") or row.get("lang")
def language(title, explicit=None):
    if explicit:
        lang = explicit.lower().split("-")[0].split("_")[0]
        return lang if lang in VOICES else None
    from langdetect import detect_langs, DetectorFactory
    DetectorFactory.seed = 0
    try:
        candidates = detect_langs(title)
        if candidates and candidates[0].prob >= .80 and candidates[0].lang in VOICES:
            return candidates[0].lang
    except Exception:
        pass
    return None
def key(title,url,voice):
    return hashlib.sha256(json.dumps([title,url,voice,"kokoro-v1-speed-0.95"],ensure_ascii=False).encode()).hexdigest()[:32]
def valid_mp3(path):
    if not path.is_file() or path.stat().st_size < 1024: return False
    try:
        result = subprocess.run(["ffprobe","-v","error","-select_streams","a:0","-show_entries","stream=codec_name:format=duration","-of","json",str(path)],capture_output=True,text=True,check=True,timeout=15)
        info = json.loads(result.stdout)
        return info["streams"][0]["codec_name"] == "mp3" and float(info["format"]["duration"]) > .2
    except (OSError,ValueError,KeyError,IndexError,subprocess.SubprocessError): return False
def synthesize(title,lang,output,pipelines):
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    code,voice = VOICES[lang]
    if lang not in pipelines: pipelines[lang] = KPipeline(lang_code=code,device="cpu")
    chunks = [audio for _,_,audio in pipelines[lang](title,voice=voice,speed=.95) if audio is not None]
    if not chunks: raise RuntimeError("No synthesized audio")
    signal = np.concatenate([np.asarray(a) for a in chunks])
    if not np.isfinite(signal).all() or np.max(np.abs(signal)) < .001: raise RuntimeError("Silent/invalid audio")
    with tempfile.TemporaryDirectory(dir=output.parent) as d:
        wav = pathlib.Path(d)/"clip.wav"
        mp3 = pathlib.Path(d)/"clip.mp3"
        sf.write(wav,signal,24000)
        subprocess.run(["ffmpeg","-nostdin","-v","error","-y","-i",str(wav),"-ac","1","-ar","44100","-codec:a","libmp3lame","-b:a","96k",str(mp3)],check=True,timeout=90)
        if not valid_mp3(mp3): raise RuntimeError("Invalid MP3")
        mp3.replace(output)
def run(root,limit):
    out = root/"audio"
    out.mkdir(exist_ok=True)
    manifest = root/"headline-audio-data.js"
    previous = read_data(manifest) if manifest.exists() else []
    approved = [r for r in previous if r.get("approved") is True and r.get("voice") == "Tanguy"]
    records = []
    pipelines = {}
    failures = 0
    for title,url,explicit in entries(root):
        lang = language(title,explicit)
        if not lang: continue
        voice = VOICES[lang][1]
        path = out/("headline-"+key(title,url,voice)+".mp3")
        if not valid_mp3(path):
            if limit <= 0: continue
            limit -= 1
            try: synthesize(title,lang,path,pipelines)
            except Exception as e:
                failures += 1
                print("Generation failed:",type(e).__name__)
                continue
        records.append(dict(title=title,sourceUrl=url,audioUrl="audio/"+path.name,voice=voice,language=lang,engine="Kokoro",generated=True))
    temp = manifest.with_suffix(".tmp")
    temp.write_text(PREFIX+json.dumps(approved+records,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    temp.replace(manifest)
    print(f"Validated {len(records)} generated clips; {failures} failures")
    if failures: raise SystemExit(1)
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit",type=int,default=150)
    args = parser.parse_args()
    run(ROOT,max(0,args.limit))
