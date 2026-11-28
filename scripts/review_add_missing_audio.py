"""Add only missing current headline audio on the review branch; never prune archives."""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo
from generate_headline_audio import ROOT, VOICES, PREFIX, entries, key, language, read_data, synthesize, valid_mp3
from natural_voice_v3 import write_js

NAMES = ("headline-audio-data.js", "post-audio-data.js", "summary-audio-data.js", "audio-bulletins.js")

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def run(root, report, limit=150):
    prior = {name: read_data(root / name) for name in NAMES}
    refs = {r["audioUrl"] for rows in prior.values() for r in rows}
    assert len(refs) >= 445, "Existing archive is incomplete"
    for rel in refs:
        assert re.fullmatch(r"audio/[A-Za-z0-9_-]+\.mp3", rel), rel
        assert (root / rel).is_file(), rel
    old_files = {p: digest(p) for p in (root / "audio").rglob("*") if p.is_file()}
    records = list(prior[NAMES[0]])
    covered = {(r.get("title"), r.get("sourceUrl")) for r in records if r.get("generated") is True or r.get("approved") is True}
    pipelines = {}
    added, skipped = [], []
    targets = list(entries(root))
    today = dt.datetime.now(ZoneInfo("Indian/Mauritius")).date().isoformat()
    for title, url, explicit in targets:
        if (title, url) in covered:
            continue
        lang = language(title, explicit)
        if not lang:
            skipped.append({"sourceUrl": url, "reason": "unsupported or uncertain language"})
            continue
        if len(added) >= limit:
            skipped.append({"sourceUrl": url, "reason": "generation limit"})
            continue
        voice = VOICES[lang][1]
        rel = "audio/headline-" + key(title, url, voice) + ".mp3"
        path = root / rel
        if path.exists():
            assert valid_mp3(path), "Existing invalid audio; refusing overwrite: " + rel
        else:
            synthesize(title, lang, path, pipelines)
        assert valid_mp3(path), rel
        added.append(dict(title=title, sourceUrl=url, audioUrl=rel, voice=voice, language=lang,
                          engine="Kokoro", generated=True, lastSeen=today, legacyV2=False))
        covered.add((title, url))
    records.extend(added)
    assert records[:len(prior[NAMES[0]])] == prior[NAMES[0]]
    assert all(p.is_file() and digest(p) == old for p, old in old_files.items())
    all_refs = refs | {r["audioUrl"] for r in added}
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert all(pool.map(lambda p: valid_mp3(root / p), sorted(all_refs))), "MP3 validation failed"
    write_js(root / NAMES[0], PREFIX, records)
    versions = {name: digest(root / name)[:16] for name in (NAMES[0], "world-news-data.js")}
    for name in ("index.html", "world-news.html", "live-updates.html"):
        page = root / name
        text = page.read_text(encoding="utf-8")
        for script, version in versions.items():
            pattern = r'(src="' + re.escape(script) + r')(?:\?v=[^"]*)?"'
            text = re.sub(pattern, lambda m: m.group(1) + "?v=" + version + '"', text)
        page.write_text(text, encoding="utf-8")
    result = dict(existing_files_preserved=len(old_files), registered_before=len(refs),
                  registered_after=len(all_refs), added=len(added), targets=len(targets),
                  covered=sum((t, u) in covered for t, u, _ in targets), skipped=skipped)
    report.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "skipped"}))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--report", type=pathlib.Path, required=True)
    p.add_argument("--limit", type=int, default=150)
    a = p.parse_args()
    run(ROOT, a.report, max(0, min(a.limit, 150)))
