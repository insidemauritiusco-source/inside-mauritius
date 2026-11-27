"""V3 review builder. Reuse V2 MP3s; generate only missing French/English titles."""
import argparse, datetime as dt, json, pathlib, re, subprocess, tempfile
from zoneinfo import ZoneInfo
from generate_headline_audio import ROOT, VOICES, PREFIX, read_data, entries, language, key, valid_mp3, synthesize
MUT = ZoneInfo("Indian/Mauritius")
BULLETIN_PREFIX = "window.INSIDE_MAURITIUS_AUDIO_BULLETINS = "
HEADLINE = re.compile(r"audio/headline-[a-f0-9]{32}\.mp3$")
BULLETIN = re.compile(r"audio/bulletin-(morning|evening)-\d{4}-\d{2}-\d{2}\.mp3$")
def write_js(path,prefix,records):
    tmp=path.with_suffix(".tmp")
    tmp.write_text(prefix+json.dumps(records,ensure_ascii=False,indent=2)+";\n",encoding="utf-8")
    tmp.replace(path)
def dated_rows(root):
    rows=read_data(root/"newsroom-data.js")+read_data(root/"world-news-data.js")["headlines"]
    stamps={}
    for row in rows:
        for k in ("sourceUrl","videoUrl","tiktokUrl","url"):
            u=row.get(k)
            if isinstance(u,str) and u.startswith("https://"):
                try:
                    s=row.get("publishedAt") or row.get("date") or ""
                    t=dt.datetime.fromisoformat(s.replace("Z","+00:00"))
                    if t.tzinfo is None: t=t.replace(tzinfo=MUT)
                    stamps.setdefault(u,t.timestamp())
                except (ValueError,TypeError): pass
                break
    return stamps
def build(root,limit=30,now=None):
    now=now or dt.datetime.now(MUT)
    manifest=root/"headline-audio-data.js"
    prior=read_data(manifest)
    out=root/"audio";out.mkdir(exist_ok=True)
    approved=[r for r in prior if r.get("approved") is True and r.get("voice")=="Tanguy"]
    previous={(r.get("sourceUrl"),r.get("title")):r for r in prior if r.get("engine")=="Kokoro"}
    current=[];pipelines={};errors=0;deferred=0;unsupported=0;created=0
    stamps=dated_rows(root)
    for title,url,explicit in sorted(entries(root),key=lambda r:stamps.get(r[1],0),reverse=True):
        old=previous.get((url,title))
        lang=language(title,explicit)
        if not lang and not explicit and old and old.get("language") in VOICES: lang=old["language"]
        if not lang: unsupported+=1;continue
        voice=VOICES[lang][1]
        rel="audio/headline-"+key(title,url,voice)+".mp3"
        path=root/rel
        if not valid_mp3(path):
            if created>=limit: deferred+=1;continue
            created+=1
            try: synthesize(title,lang,path,pipelines)
            except Exception as e: errors+=1;print("Generation failed:",type(e).__name__);continue
        current.append(dict(title=title,sourceUrl=url,audioUrl=rel,voice=voice,language=lang,engine="Kokoro",generated=True,lastSeen=now.date().isoformat()))
    if errors: raise RuntimeError(f"{errors} generation failures; previous manifest retained")
    if not current: raise RuntimeError("Empty audio registry; refusing replacement")
    # Retain inactive records for seven days, but never delete unmanaged V2 assets.
    active={(r["sourceUrl"],r["title"]) for r in current}
    cutoff=now.date()-dt.timedelta(days=7)
    retained=[];expired=[]
    for r in previous.values():
        if (r.get("sourceUrl"),r.get("title")) in active: continue
        if not HEADLINE.fullmatch(str(r.get("audioUrl",""))): continue
        try: seen=dt.date.fromisoformat(r.get("lastSeen",""))
        except ValueError: seen=now.date();r=dict(r,lastSeen=seen.isoformat(),legacyV2=True)
        if seen>=cutoff or r.get("legacyV2"): retained.append(r)
        else: expired.append(r)
    all_records=approved+current+retained
    bulletin_file=root/"audio-bulletins.js"
    bulletins=read_data(bulletin_file) if bulletin_file.exists() else []
    # Build a dated source-linked headline roundup, not an invented or live report.
    edition="morning" if now.hour<12 else "evening"
    today=now.date().isoformat()
    recent=[r for r in current if stamps.get(r["sourceUrl"],0)>=now.timestamp()-86400][:8]
    existing=next((b for b in bulletins if b.get("date")==today and b.get("edition")==edition and BULLETIN.fullmatch(str(b.get("audioUrl",""))) and valid_mp3(root/b["audioUrl"])),None)
    if recent and not existing:
        dest=out/f"bulletin-{edition}-{today}.mp3"
        with tempfile.TemporaryDirectory(dir=out) as d:
            listing=pathlib.Path(d)/"concat.txt"
            listing.write_text("".join("file '"+str((root/r["audioUrl"]).resolve()).replace("'","'\\''")+"'\n" for r in recent))
            temp=pathlib.Path(d)/"bulletin.mp3"
            subprocess.run(["ffmpeg","-nostdin","-v","error","-y","-f","concat","-safe","0","-i",str(listing),"-ac","1","-ar","44100","-b:a","96k",str(temp)],check=True,timeout=120)
            if not valid_mp3(temp): raise RuntimeError("Invalid bulletin")
            temp.replace(dest)
        bulletins=[b for b in bulletins if not (b.get("date")==today and b.get("edition")==edition)]
        bulletins.append(dict(date=today,edition=edition,audioUrl="audio/"+dest.name,headlines=[dict(title=r["title"],sourceUrl=r["sourceUrl"]) for r in recent],generatedAt=now.isoformat()))
    kept=[];old_bulletins=[]
    for b in bulletins:
        if not BULLETIN.fullmatch(str(b.get("audioUrl",""))): continue
        if dt.date.fromisoformat(b["date"])>=cutoff: kept.append(b)
        else: old_bulletins.append(b)
    # Validate every referenced local file before writing the manifests.
    for r in current+retained+kept:
        if not valid_mp3(root/r["audioUrl"]): raise RuntimeError("Invalid referenced MP3")
    write_js(manifest,PREFIX,all_records)
    write_js(bulletin_file,BULLETIN_PREFIX,kept)
    refs={r.get("audioUrl") for r in all_records+kept}
    for r in expired+old_bulletins:
        rel=r["audioUrl"]
        if rel not in refs and (HEADLINE.fullmatch(rel) or BULLETIN.fullmatch(rel)):
            (root/rel).unlink(missing_ok=True)
    print(json.dumps(dict(current=len(current),retained=len(retained),new_attempts=created,deferred=deferred,unsupported=unsupported,bulletins=len(kept),failures=0)))
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--limit",type=int,default=30);a=p.parse_args()
    build(ROOT,max(0,min(a.limit,150)))
