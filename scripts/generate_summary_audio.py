"""Create exact headline + published-summary audio; preserve existing audio files."""
import argparse, hashlib, json, re, subprocess, tempfile
from generate_headline_audio import ROOT, VOICES, read_data, valid_mp3, synthesize, language
from natural_voice_v3 import write_js
PREFIX="window.INSIDE_MAURITIUS_SUMMARY_AUDIO = "
PATH=re.compile(r"audio/summary-[a-f0-9]{32}\.mp3$")
def build(root,limit):
    rows=json.loads(subprocess.check_output(["node","scripts/extract_voice_posts.js"],cwd=root,text=True))
    base=read_data(root/"headline-audio-data.js")+read_data(root/"post-audio-data.js")
    manifest=root/"summary-audio-data.js"
    prior=read_data(manifest)
    by_id={(r.get("id"),r.get("title")):r for r in base if r.get("id") and r.get("engine")=="Kokoro"}
    by_url={(r.get("sourceUrl"),r.get("title")):r for r in base if r.get("sourceUrl") and r.get("engine")=="Kokoro"}
    current=[]; seen=set(); pipelines={}; created=0; errors=[]; deferred=[]; missing=[]; no_summary=0; mixed=0
    for row in rows:
        title=row["title"]; summary=row.get("summary") or ""; uid=row.get("id"); source=row.get("sourceUrl")
        if not summary.strip(): no_summary+=1;continue
        base_record=by_id.get((uid,title)) or by_url.get((source,title))
        if not base_record or not valid_mp3(root/base_record["audioUrl"]): missing.append(title);continue
        lang=base_record["language"]
        summary_lang=language(summary) or lang
        if summary_lang not in VOICES: summary_lang=lang
        if summary_lang!=lang: mixed+=1
        key=hashlib.sha256(json.dumps([uid,source,title,summary,base_record["audioUrl"],summary_lang,VOICES[summary_lang][1],"summary-v1"],ensure_ascii=False).encode()).hexdigest()[:32]
        if key in seen:continue
        seen.add(key)
        rel="audio/summary-"+key+".mp3"; out=root/rel
        if not valid_mp3(out):
            if created>=limit:deferred.append(title);continue
            try:
                with tempfile.TemporaryDirectory(dir=root/"audio") as tmp:
                    from pathlib import Path
                    d=Path(tmp); summary_file=d/"summary.mp3"; joined=d/"joined.mp3"
                    synthesize(summary,summary_lang,summary_file,pipelines)
                    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(root/base_record["audioUrl"]),"-i",str(summary_file),"-filter_complex","[0:a][1:a]concat=n=2:v=0:a=1","-ar","24000","-ac","1","-b:a","64k",str(joined)],check=True,timeout=120)
                    if not valid_mp3(joined): raise RuntimeError("Invalid combined audio")
                    joined.replace(out)
                created+=1
            except Exception as exc:errors.append([title,type(exc).__name__]);continue
        current.append(dict(id=uid,title=title,summary=summary,sourceUrl=source,audioUrl=rel,language=lang,summaryLanguage=summary_lang,engine="Kokoro",generated=True))
    report=dict(total=len(rows),with_summary=len(rows)-no_summary,matched=len(current),headline_only=no_summary,new=created,mixed_language=mixed,missing=missing,deferred=deferred,failures=errors)
    (root/"summary-audio-review.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
    if missing or deferred or errors or len(current)!=len(rows)-no_summary:raise RuntimeError("Summary generation incomplete")
    write_js(manifest,PREFIX,current)
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--limit",type=int,default=200);a=p.parse_args();build(ROOT,max(0,min(a.limit,300)))
