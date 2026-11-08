#!/usr/bin/env python3
"""Collect recent external world headline links for a source-attributed directory.
No copied article bodies, licensed images, or automatic original editorial posts.
"""
import datetime as dt
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "world-news-data.js"
NOW = dt.datetime.now(dt.timezone.utc)
MAX_AGE = dt.timedelta(days=3)
# Google News RSS topic searches provide cross-publisher discovery without
# assuming unrestricted republishing rights or requiring commercial API keys.
REGIONS = {
    "Africa": "Africa",
    "Europe": "Europe",
    "Asia": "Asia",
    "Middle East": "Middle East",
    "Americas": "Americas",
    "Oceania": "Australia OR New Zealand OR Pacific islands",
}
def get_feed(region, query):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({
        "q": query + " when:3d", "hl": "en", "gl": "MU", "ceid": "MU:en"
    })
    req = urllib.request.Request(url,headers={"User-Agent":"InsideMauritiusWorldHeadlines/1.0","Accept":"application/rss+xml"})
    with urllib.request.urlopen(req,timeout=20) as response:
        raw=response.read(1_000_001)
        if len(raw)>1_000_000: raise ValueError("RSS response too large")
    root=ET.fromstring(raw)
    entries=[]
    for node in root.findall(".//item")[:30]:
        title=" ".join((node.findtext("title") or "").split())[:195]
        link=(node.findtext("link") or "").strip()
        publisher=node.find("source")
        source=" ".join((publisher.text or "").split())[:90] if publisher is not None else "External publisher"
        if not title or len(title)<12 or not link.startswith("https://news.google.com/"):
            continue
        try:
            when=parsedate_to_datetime(node.findtext("pubDate"))
            if when.tzinfo is None: when=when.replace(tzinfo=dt.timezone.utc)
            when=when.astimezone(dt.timezone.utc)
            if not NOW-MAX_AGE <= when <= NOW+dt.timedelta(hours=2): continue
        except (TypeError,ValueError,OverflowError): continue
        # Google News RSS title often appends publisher name.
        if title.endswith(" - "+source): title=title[:-(len(source)+3)]
        entries.append({"id":hashlib.sha256(link.encode()).hexdigest()[:16],
                        "title":title,"region":region,"source":source,
                        "url":link,"publishedAt":when.isoformat()})
    return entries
def main():
    collected=[]
    successes=0
    for region,query in REGIONS.items():
        try:
            found=get_feed(region,query)
            print(region,len(found),"eligible items")
            if found: successes+=1
            collected.extend(found[:15])
        except Exception as exc:
            print("Feed unavailable",region,str(exc)[:130])
    if not successes:
        print("No successful region feeds; leaving previous data intact")
        return
    seen=set()
    selected=[]
    for x in sorted(collected,key=lambda x:x["publishedAt"],reverse=True):
        if x["id"] not in seen:
            seen.add(x["id"])
            selected.append(x)
    selected=selected[:90]
    payload={"generatedAt":NOW.isoformat(),"headlines":selected}
    old=OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
    # Keep the prior full feed on temporary partial outages to avoid
    # replacing a populated output with an empty list.
    if not selected: return
    output="// External source-linked headlines, not independently verified.\nwindow.INSIDE_MAURITIUS_WORLD_NEWS = "+json.dumps(payload,ensure_ascii=True,indent=2)+";\n"
    if output != old:
        OUTPUT.write_text(output,encoding="utf-8")
        print("Updated",len(selected),"world headlines")
if __name__=="__main__":main()
