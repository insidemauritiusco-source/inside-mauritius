"""Generate missing post headlines, without altering V2/V3 registries."""
import argparse,hashlib,json,re,subprocess
from generate_headline_audio import ROOT,VOICES,read_data,valid_mp3,synthesize,language
from natural_voice_v3 import write_js
PREFIX="window.INSIDE_MAURITIUS_POST_AUDIO = "
PATH=re.compile(r"audio/post-[a-f0-9]{32}\.mp3$")
def build(root,limit):
    rows=json.loads(subprocess.check_output(["node","scripts/extract_voice_posts.js"],cwd=root,text=True))
    headlines=read_data(root/"headline-audio-data.js")
    known={(r.get("sourceUrl"),r.get("title")) for r in headlines if r.get("engine")=="Kokoro" and r.get("generated") is True and valid_mp3(root/r["audioUrl"])}
    kept=[r for r in read_data(root/"post-audio-data.js") if PATH.fullmatch(r.get("audioUrl","")) and valid_mp3(root/r["audioUrl"])]
    ids={(r["id"],r["title"]) for r in kept if r.get("id")}
    urls={(r["sourceUrl"],r["title"]) for r in kept if r.get("sourceUrl")}
    pipelines={}; created=0; unsupported=[]; deferred=[]; failures=[]; matched=0
    (root/"audio").mkdir(exist_ok=True)
    for row in rows:
        title=row["title"]; source=row.get("sourceUrl"); identity=row.get("id")
        if (source and ((source,title) in known or (source,title) in urls)) or (identity and (identity,title) in ids):
            matched+=1;continue
        lang=language(title,row.get("language"))
        if not lang and not row.get("language") and row.get("summary"):
            lang=language(title+" "+row["summary"])
        if not lang: unsupported.append(title);continue
        voice=VOICES[lang][1]
        k=hashlib.sha256(json.dumps([identity,source,title,voice,"post-v1"],ensure_ascii=False).encode()).hexdigest()[:32]
        rel="audio/post-"+k+".mp3"
        if not valid_mp3(root/rel):
            if created>=limit: deferred.append(title);continue
            try: synthesize(title,lang,root/rel,pipelines);created+=1
            except Exception as exc: failures.append([title,type(exc).__name__]);continue
        kept.append(dict(id=identity,title=title,sourceUrl=source,voice=voice,language=lang,engine="Kokoro",generated=True,audioUrl=rel))
        if identity: ids.add((identity,title))
        if source: urls.add((source,title))
        matched+=1
    report=dict(total=len(rows),matched=matched,new=created,post_records=len(kept),unsupported=unsupported,deferred=deferred,failures=failures)
    print(json.dumps(report,ensure_ascii=False))
    (root/"post-audio-review.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    if failures or deferred: raise RuntimeError("Generation incomplete")
    write_js(root/"post-audio-data.js",PREFIX,kept)
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--limit",type=int,default=150);a=p.parse_args();build(ROOT,max(0,min(a.limit,300)))
