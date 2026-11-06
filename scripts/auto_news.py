#!/usr/bin/env python3
"""Refresh credited Mauritius headline links and authorized platform video embeds.

This is a LINK AGGREGATOR, not a reporter. Headlines are publisher-supplied and
not independently verified. Never copy full news articles or video files.
Only display remotely hosted feed image previews with clear source attribution.
"""
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
import os
import pathlib
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "newsroom-data.js"
TZ = ZoneInfo("Indian/Mauritius")
NOW = dt.datetime.now(dt.timezone.utc)
MAX_AGE_DAYS = 3
MAX_TOTAL = 32
MAX_EACH_SOURCE = 9
USER_AGENT = "InsideMauritiusHeadlineLinks/1.0 (news aggregation; mr.insidemauritius.com)"
MEDIA_NS = "{http://search.yahoo.com/mrss/}"
ATOM_NS = "{http://www.w3.org/2005/Atom}"
YT_NS = "{http://www.youtube.com/xml/schemas/2015}"
SOURCE_SITES = {
    "Top FM": "topfm.mu",
    "Le Défi Media / Radio Plus": "defimedia.info",
    "L'Express": "lexpress.mu",
    "ION News": "ionnews.mu",
    "Mauritius Times": "mauritiustimes.com",
}
SOURCES = [
    # Aggregated publisher headlines, using Google News' publicly documented RSS format.
    ("Top FM", "https://news.google.com/rss/search?q=site%3Atopfm.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    ("Le Défi Media / Radio Plus", "https://news.google.com/rss/search?q=site%3Adefimedia.info%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    ("L'Express", "https://news.google.com/rss/search?q=site%3Alexpress.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    # Direct publisher feeds: failures do not stop the other sources.
    ("ION News", "https://ionnews.mu/feed/"),
    ("Mauritius Times", "https://www.mauritiustimes.com/feed/"),
]
VIDEO_CHANNELS = [
    # Public channel ID linked from Top FM's online station listings.
    ("Top FM video", "UCMBUbBnzxmpemB9h9p8HQxA"),
]

def clean(s, limit=200):
    s = html.unescape(re.sub(r"<[^>]*>", " ", str(s or "")))
    return re.sub(r"\s+", " ", s).strip()[:limit]

def valid_url(s, allowed=()):
    try:
        url = urllib.parse.urlsplit(str(s or "").strip())
        host = (url.hostname or "").lower()
        if url.scheme != "https" or not host or url.username or url.password:
            return ""
        if not any(host == d or host.endswith("." + d) for d in allowed):
            return ""
        return urllib.parse.urlunsplit(("https", url.netloc, url.path or "/", url.query, ""))
    except (ValueError, TypeError):
        return ""

def fetch_xml(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/atom+xml,application/rss+xml,application/xml,text/xml,*/*;q=0.5"})
    with urllib.request.urlopen(req, timeout=16) as response:
        raw = response.read(1_500_001)
        if len(raw) > 1_500_000:
            raise ValueError("Feed too large")
        return ET.fromstring(raw)

def pub_date(raw):
    if not raw:
        return None
    try:
        from email.utils import parsedate_to_datetime
        val = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            val = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    if val.tzinfo is None:
        val = val.replace(tzinfo=dt.timezone.utc)
    val = val.astimezone(dt.timezone.utc)
    if val < NOW - dt.timedelta(days=MAX_AGE_DAYS) or val > NOW + dt.timedelta(hours=2):
        return None
    return val

def image_from_feed(node, source, link):
    # External image preview only (no image download or rehosting).
    # The original publisher owns the image; news feed inclusion is not a license.
    hosts = [SOURCE_SITES[source], "googleusercontent.com", "ytimg.com"]
    for child in node:
        tag = child.tag.lower()
        if tag.endswith("thumbnail") or tag.endswith("content") or tag.endswith("enclosure"):
            typ = (child.get("type") or "").lower()
            medium = (child.get("medium") or "").lower()
            if tag.endswith("content") and medium and medium != "image":
                continue
            if tag.endswith("enclosure") and not typ.startswith("image/"):
                continue
            img = valid_url(child.get("url", ""), hosts)
            if img:
                return img
    return ""

def item_to_story(node, source, via_google):
    title = clean(node.findtext("title"), 190)
    link = clean(node.findtext("link"), 2000)
    publication = pub_date(node.findtext("pubDate") or node.findtext("published") or node.findtext(ATOM_NS+"published"))
    if not title or len(title) < 12 or not publication:
        return None
    # Google's RSS links redirect readers to publishers; never imply the feed is our own reporting.
    allowed_hosts = ("news.google.com",) if via_google else (SOURCE_SITES[source],)
    link = valid_url(link, allowed_hosts)
    if not link:
        return None
    source_element = node.find("source")
    if via_google and source_element is not None:
        source_home = valid_url(source_element.get("url", ""), (SOURCE_SITES[source],))
        if not source_home:
            return None
        # Strip the source suffix added by Google News, if present.
        if " - " in title and title.rsplit(" - ", 1)[1].strip().lower() in (
            source_element.text or "").strip().lower():
            title = title.rsplit(" - ", 1)[0]
    local_date = publication.astimezone(TZ).date().isoformat()
    digest = hashlib.sha256(link.encode("utf-8")).hexdigest()[:16]
    img = image_from_feed(node, source, link) if not via_google else ""
    story = {
        "id": "source-" + digest,
        "category": "Mauritius",
        "label": "SOURCE HEADLINE",
        "title": title,
        "summary": "Latest headline from " + source + ". Read the publisher's original report for the full details.",
        "date": local_date,
        "author": source + " (external report)",
        "image": img or "cover-mauritius.svg",
        "imageAlt": ("Image preview supplied by " + source + "; copyright remains with its owner") if img else "Inside Mauritius generic illustration, not event footage",
        "content": [
            "This headline was automatically collected from a news feed attributed to " + source + ". It is not independent reporting or a verified breaking-news alert from Inside Mauritius.",
            "Published by the source on " + publication.astimezone(TZ).strftime("%d %B %Y at %H:%M") + " Mauritius time. Please visit the original publisher to read the report and check subsequent updates."
        ],
        "sourceName": source + (" (via Google News)" if via_google else ""),
        "sourceUrl": link,
        "_published": publication.isoformat(),
        "_publisher": source
    }
    if img:
        story.update({
            "photoSourceUrl": link, "photoAuthor": source,
            "photoCaption": "Source-provided external thumbnail from " + source + ". Copyright remains with the publisher; this is not an Inside Mauritius photograph.",
            "photoIllustrative": False
        })
    return story

def collect_source(source, url):
    root = fetch_xml(url)
    nodes = root.findall(".//item")
    if not nodes:
        raise ValueError("Feed did not contain RSS items")
    via_google = urllib.parse.urlsplit(url).hostname == "news.google.com"
    result = []
    for item in nodes[:35]:
        entry = item_to_story(item, source, via_google)
        if entry:
            result.append(entry)
    return result

def youtube_stories(name, channel_id):
    url = "https://www.youtube.com/feeds/videos.xml?channel_id=" + channel_id
    root = fetch_xml(url)
    if not root.findall(ATOM_NS+"entry"):
        raise ValueError("YouTube channel feed has no videos")
    stories = []
    for item in root.findall(ATOM_NS+"entry")[:20]:
        video_id = clean(item.findtext(YT_NS+"videoId"), 25)
        title = clean(item.findtext(ATOM_NS+"title"), 190)
        published = pub_date(item.findtext(ATOM_NS+"published"))
        if not re.fullmatch(r"[a-zA-Z0-9_-]{11}", video_id) or not title or not published:
            continue
        link = "https://www.youtube.com/watch?v=" + video_id
        stories.append({
            "id": "video-" + video_id,
            "category": "Video",
            "label": "REAL VIDEO · TOP FM",
            "title": title,
            "summary": "Watch the original video published by " + name + " on YouTube.",
            "date": published.astimezone(TZ).date().isoformat(),
            "image": "https://i.ytimg.com/vi/" + video_id + "/hqdefault.jpg",
            "imageAlt": "Official YouTube thumbnail supplied by " + name + " for this video",
            "photoSourceUrl": link,
            "photoAuthor": name,
            "photoCaption": "Original YouTube video thumbnail by " + name + ". Video remains hosted by YouTube.",
            "photoIllustrative": False,
            "author": name + " (official external video)",
            "content": ["This is an externally hosted video from " + name + ". Inside Mauritius does not own, download or republish the footage. Play it using YouTube's official embedded player below or follow the source link."],
            "sourceName": name + " on YouTube",
            "sourceUrl": link,
            "video": link,
            "_published": published.isoformat(),
            "_publisher": name
        })
    return stories

def main():
    all_items = []
    failures = []
    success = 0
    for source, url in SOURCES:
        try:
            items = collect_source(source, url)
            success += 1
            all_items.extend(items)
            print(source, "feed read:", len(items), "eligible recent headlines")
        except Exception as exc:
            failures.append(source + ": " + str(exc)[:150])
    for name, channel in VIDEO_CHANNELS:
        try:
            items = youtube_stories(name, channel)
            success += 1
            all_items.extend(items)
            print(name, "feed read:", len(items), "eligible videos")
        except Exception as exc:
            failures.append(name + ": " + str(exc)[:150])
    for failure in failures:
        print("FEED UNAVAILABLE:", failure)
    if not success or not all_items:
        print("No fresh eligible source posts. Keeping previous newsroom-data.js unchanged.")
        return
    # Sort by source publication time, not crawl time. Deduplicate cross-syndicated links.
    all_items.sort(key=lambda x: x["_published"], reverse=True)
    selected, seen_urls, counts = [], set(), {}
    for item in all_items:
        url = item["sourceUrl"]
        key = item["_publisher"]
        if url in seen_urls or counts.get(key, 0) >= MAX_EACH_SOURCE:
            continue
        seen_urls.add(url)
        counts[key] = counts.get(key, 0) + 1
        selected.append(item)
        if len(selected) >= MAX_TOTAL:
            break
    # Remove internal sorting metadata before publishing.
    for item in selected:
        item.pop("_published")
        item.pop("_publisher")
    payload = "// Automated source-linked headlines and original YouTube videos. Not independently verified.\n"
    payload += "window.INSIDE_MAURITIUS_NEWSROOM_ARTICLES = "
    payload += json.dumps(selected, ensure_ascii=True, indent=2) + ";\n"
    old = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
    if old != payload:
        OUTPUT.write_text(payload, encoding="utf-8")
        print("Wrote", len(selected), "current sourced links to newsroom-data.js")
    else:
        print("No data changes")

if __name__ == "__main__":
    main()
