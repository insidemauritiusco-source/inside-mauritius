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
MAX_TOTAL = 60
MAX_EACH_SOURCE = 13
USER_AGENT = "InsideMauritiusHeadlineLinks/1.0 (news aggregation; mr.insidemauritius.com)"
MEDIA_NS = "{http://search.yahoo.com/mrss/}"
ATOM_NS = "{http://www.w3.org/2005/Atom}"
YT_NS = "{http://www.youtube.com/xml/schemas/2015}"
SOURCE_SITES = {
    "INFORMUS": "informus.mu",
    "Mopays.com": "mopays.com",
    "GIS Mauritius": "gis.govmu.org",
    "5-Plus dimanche": "5plus.mu",
    "MNews": "mnews.mu",
    "Inside News": "inside.news",
    "Radio Mo Pep": "radiomopep.mu",
    "Top FM": "topfm.mu",
    "Le Défi Media / Radio Plus": "defimedia.info",
    "L'Express": "lexpress.mu",
    "ION News": "ionnews.mu",
    "Le Mauricien": "lemauricien.com",
    "Mauritius Times": "mauritiustimes.com",
}
SOURCES = [
    # Aggregated publisher headlines, using Google News' publicly documented RSS format.
    ("Top FM", "https://news.google.com/rss/search?q=site%3Atopfm.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    ("Le Défi Media / Radio Plus", "https://news.google.com/rss/search?q=site%3Adefimedia.info%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    ("L'Express", "https://news.google.com/rss/search?q=site%3Alexpress.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    # Source-linked Google News metadata; no rehosting or copying full publisher content.
    ("Mopays.com", "https://news.google.com/rss/search?q=site%3Amopays.com%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    ("GIS Mauritius", "https://news.google.com/rss/search?q=site%3Agis.govmu.org%20when%3A3d&hl=en&gl=MU&ceid=MU%3Aen"),
    ("5-Plus dimanche", "https://news.google.com/rss/search?q=site%3A5plus.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr"),
    # Direct publisher feeds: failures do not stop the other sources.
    ("INFORMUS", "https://informus.mu/feed/"),
    ("MNews", "https://www.mnews.mu/feed/"),
    ("Inside News", "https://www.inside.news/feed/"),
    ("Radio Mo Pep", "https://radiomopep.mu/feed/"),
    ("ION News", "https://ionnews.mu/feed/"),
    ("Le Mauricien", "https://www.lemauricien.com/feed/"),
    ("Mauritius Times", "https://www.mauritiustimes.com/feed/"),
]
# Direct feeds may fail or be stale. Use a publisher-scoped metadata fallback.
SOURCE_FALLBACKS = {
    "INFORMUS": "https://news.google.com/rss/search?q=site%3Ainformus.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr",
    "MNews": "https://news.google.com/rss/search?q=site%3Amnews.mu%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr",
    "Inside News": "https://news.google.com/rss/search?q=site%3Ainside.news%20when%3A3d&hl=fr&gl=MU&ceid=MU%3Afr",
}

VIDEO_CHANNELS = [
    # No channel feed is enabled until its ID and video RSS availability are verified.
    # Readers can access original Top FM / TOP TV videos from the website video desk.
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

def publisher_thumbnail(article_url, publisher):
    """Read an article's publicly declared OpenGraph/Twitter image metadata.

    Only accept images from the same publishing domain or its known CDN. No
    rehosting, downloading, resizing or transformation of publisher photography.
    """
    if not valid_url(article_url, (SOURCE_SITES[publisher],)):
        return ""
    try:
        req = urllib.request.Request(article_url, headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml"
        })
        with urllib.request.urlopen(req, timeout=6) as r:
            if "html" not in (r.headers.get("Content-Type") or "").lower():
                return ""
            raw = r.read(130_000).decode("utf-8", errors="replace")
        # HTML meta attributes can appear in any order; parse rather than
        # relying on an over-escaped regular expression.
        class MetaImages(HTMLParser):
            def __init__(self):
                super().__init__()
                self.urls = []
            def handle_starttag(self, tag, attrs):
                if tag.lower() != "meta":
                    return
                attributes = dict(attrs)
                key = (attributes.get("property") or attributes.get("name") or "").lower()
                if key in ("og:image", "og:image:url", "twitter:image", "twitter:image:src"):
                    value = attributes.get("content", "")
                    if value:
                        self.urls.append(value)
        parser = MetaImages()
        parser.feed(raw)
        if not parser.urls:
            return ""
        image_value = parser.urls[0]
        candidate = urllib.parse.urljoin(article_url, html.unescape(image_value))
        # Be conservative: disallow unfamiliar third-party image servers.
        return valid_url(candidate, (SOURCE_SITES[publisher], "cloudinary.com", "wp.com"))
    except Exception:
        return ""

def classify_category(title):
    """Conservative headline-only categorisation; ambiguous items stay Mauritius."""
    t = clean(title, 500).casefold()
    world_terms = (
        "ukraine", "ucrânia", "zelensky", "zelenski", "trump",
        "washington", "white house", "maison-blanche", "etats-unis",
        "états-unis", "usa", "russie", "russia", "poutine", "putin",
        "gaza", "israël", "israel", "palestine", "liban", "lebanon",
        "macron", "france", "royaume-uni", "united kingdom",
        "chine", "china", "inde", "india", "bangladesh",
        "élections américaines", "elections americaines",
        "melania", "mélania", "onu ", "nations unies"
    )
    local_terms = ("maurice", "mauritius", "rodrigues", "port-louis",
                   "plaine-des-papayes", "grand-baie", "curepipe",
                   "vacoas", "quatre-bornes", "moka", "flacq")
    # Explicit local context takes priority; avoids labelling Mauritius
    # coverage of foreign nationals as World.
    if any(word in t for word in local_terms):
        return "Mauritius"
    if any(word in t for word in world_terms):
        return "World"
    return "Mauritius"

def publisher_excerpt(node, title, source):
    """Use a short, clearly attributed RSS excerpt, never the full article.

    Only direct publisher feeds are passed here. A missing or repetitive feed
    description must not be presented as Inside Mauritius reporting.
    """
    description = clean(node.findtext("description"), 2200)
    if not description:
        return ""
    description = re.sub(
        r"\\bThe post .{0,240}? appeared first on .*$", "", description,
        flags=re.IGNORECASE
    ).strip()
    if description.casefold().startswith(title.casefold()):
        description = description[len(title):].lstrip(" :–—.-")
    if len(description) < 35 or description.casefold() == title.casefold():
        return ""
    words = description.split()
    if len(words) < 7:
        return ""
    excerpt = " ".join(words[:24]).rstrip(" ,;:.")
    if len(words) > 24:
        excerpt += "…"
    return "Short excerpt from " + source + " RSS feed: " + excerpt

def video_from_feed(node):
    """Extract only original YouTube links supplied in the publisher RSS item.

    Media stays on YouTube; no downloading, copying or rehosting.
    """
    parts = [
        node.findtext("description") or "",
        node.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or "",
    ]
    pattern = re.compile(
        r"https://(?:www\\.)?(?:youtube\\.com/(?:watch\\?v=|embed/)|youtu\\.be/)"
        r"([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])", re.IGNORECASE
    )
    for part in parts:
        content = html.unescape(part).replace("\\/", "/")
        match = pattern.search(content)
        if match:
            return "https://www.youtube.com/watch?v=" + match.group(1)
    return ""


def item_to_story(node, source, via_google):
    title = clean(node.findtext("title"), 190)
    link = clean(node.findtext("link"), 2000)
    publication = pub_date(node.findtext("pubDate") or node.findtext("published") or node.findtext(ATOM_NS+"published"))
    if not title or len(title) < 12 or not publication:
        return None
    if title.casefold().strip(" .:!?-") in {"blog", "actualités", "actualites", "news", "accueil", "home", "vidéos", "videos"}:
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
    excerpt = publisher_excerpt(node, title, source) if not via_google else ""
    if source == "ION News":
        summary = excerpt or (
            "ION News published this report on "
            + publication.astimezone(TZ).strftime("%d %B %Y")
            + ". Read the original publisher report for full details."
        )
    else:
        summary = excerpt or (
            "Latest headline from " + source
            + ". Read the publisher's original report for the full details."
        )
    digest = hashlib.sha256(link.encode("utf-8")).hexdigest()[:16]
    img = image_from_feed(node, source, link)
    video = "" if via_google else video_from_feed(node)
    if video and not img:
        vid = urllib.parse.parse_qs(urllib.parse.urlsplit(video).query)["v"][0]
        img = "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg"
    story = {
        "id": "source-" + digest,
        "category": "Video" if video else classify_category(title),
        "label": "SOURCE VIDEO" if video else "SOURCE HEADLINE",
        "title": title,
        "summary": summary,
        "date": local_date,
        "publishedAt": publication.isoformat(),
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
    if video:
        story["video"] = video
        story["content"].append("This publisher included a YouTube link. The video stays on YouTube and playback depends on the publisher's settings.")
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
            "label": "REAL VIDEO · TOPTV",
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
            if not items and source in SOURCE_FALLBACKS:
                items = collect_source(source, SOURCE_FALLBACKS[source])
            success += 1
            all_items.extend(items)
            print(source, "feed read:", len(items), "eligible recent headlines")
        except Exception as exc:
            if source in SOURCE_FALLBACKS:
                try:
                    items = collect_source(source, SOURCE_FALLBACKS[source])
                    success += 1
                    all_items.extend(items)
                    print(source, "fallback read:", len(items), "eligible recent headlines")
                except Exception as fallback_exc:
                    failures.append(source + ": " + str(exc)[:110] + "; fallback: " + str(fallback_exc)[:110])
            else:
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
    # Enrich direct publisher articles with declared images.
    # Google News intermediate links aren't treated as direct publisher URLs.
    image_candidates = 0
    for item in all_items:
        if image_candidates >= 28:
            break
        if item.get("image") != "cover-mauritius.svg":
            continue
        publisher = item.get("_publisher")
        if publisher not in SOURCE_SITES or not valid_url(item["sourceUrl"], (SOURCE_SITES[publisher],)):
            continue
        image_candidates += 1
        thumb = publisher_thumbnail(item["sourceUrl"], publisher)
        if thumb:
            item["image"] = thumb
            item["imageAlt"] = "Source-provided photograph preview, credited to " + publisher + "; rights remain with the publisher"
            item["photoSourceUrl"] = item["sourceUrl"]
            item["photoAuthor"] = publisher
            item["photoCaption"] = "Photo preview linked from " + publisher + ". Copyright remains with the original publisher."
            item["photoIllustrative"] = False
    print("Checked", image_candidates, "publisher articles for media previews")
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
