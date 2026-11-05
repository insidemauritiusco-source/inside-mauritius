#!/usr/bin/env python3
"""Extract PUBLIC metadata for at most two news links; never bypass paywalls.
Outputs a newsroom DRAFT for human fact checking, not an auto-published story.
"""
import datetime, html, ipaddress, json, os, re, socket, sys, urllib.error, urllib.parse, urllib.request
from html.parser import HTMLParser

MAX_BYTES = 450_000
USER_AGENT = "InsideMauritiusNewsroom/1.0 (editorial metadata preview; contact via mr.insidemauritius.com)"
META_KEYS = ("og:title", "twitter:title", "og:description", "twitter:description",
             "description", "og:site_name", "article:published_time", "article:modified_time",
             "datepublished", "pubdate", "og:image", "twitter:image")
def clean(s, limit=500):
    return re.sub(r"\s+", " ", html.unescape(str(s or ""))).strip()[:limit]

def safe_url(value):
    u = urllib.parse.urlsplit(str(value or "").strip())
    if u.scheme != "https" or not u.hostname or u.username or u.password or u.port not in (None, 443):
        raise ValueError("Only public HTTPS links without credentials are supported")
    host = u.hostname.lower().rstrip(".")
    if host in ("localhost", "127.0.0.1") or host.endswith((".local", ".internal", ".localhost", ".test")):
        raise ValueError("Private and local addresses are not supported")
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError("Link does not resolve to a public address")
    return urllib.parse.urlunsplit(("https", u.netloc, u.path or "/", u.query, ""))

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

OPENER = urllib.request.build_opener(NoRedirect)
def get_html(url):
    for _ in range(4):
        url = safe_url(url)
        req = urllib.request.Request(url, headers={
            "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.7,fr;q=0.7"})
        try:
            response = OPENER.open(req, timeout=14)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                url = urllib.parse.urljoin(url, e.headers["Location"])
                continue
            raise RuntimeError("Source HTTP error " + str(e.code))
        with response as r:
            typ = r.headers.get("Content-Type", "").lower()
            if "html" not in typ:
                raise RuntimeError("Link is not a public HTML news page")
            binary = r.read(MAX_BYTES + 1)
            if len(binary) > MAX_BYTES:
                binary = binary[:MAX_BYTES]
            charset = r.headers.get_content_charset() or "utf-8"
            return url, binary.decode(charset, errors="replace")
    raise RuntimeError("Too many redirects")

class Tags(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.page_title, self.title_on, self.skip_title = {}, "", False, False
    def handle_starttag(self, tag, attrs):
        a = {k.lower(): v for k, v in attrs if k and v is not None}
        if tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            if key in META_KEYS and key not in self.meta: self.meta[key] = clean(a.get("content"), 1000)
        if tag == "title": self.title_on = True
    def handle_endtag(self, tag):
        if tag == "title": self.title_on = False
    def handle_data(self, data):
        if self.title_on: self.page_title += data

def article_metadata(url):
    try:
        resolved, raw = get_html(url)
        h = Tags(); h.feed(raw)
        meta = h.meta
        title = clean(meta.get("og:title") or meta.get("twitter:title") or h.page_title, 180)
        description = clean(meta.get("og:description") or meta.get("twitter:description") or meta.get("description"), 400)
        publication = meta.get("article:published_time") or meta.get("datepublished") or meta.get("pubdate")
        date = None
        if publication:
            m = re.search(r"\b(20\d{2}-\d\d-\d\d)\b", publication)
            if m:
                try: date = datetime.date.fromisoformat(m.group(1)).isoformat()
                except ValueError: pass
        image = meta.get("og:image") or meta.get("twitter:image") or ""
        if image:
            image = urllib.parse.urljoin(resolved, image)
            try:
                image = safe_url(image)
            except Exception:
                image = ""
        if not title: raise RuntimeError("No headline metadata found")
        return {"url": resolved, "publisher": clean(meta.get("og:site_name") or urllib.parse.urlsplit(resolved).hostname, 90),
                "title": title, "description": description, "publishedDate": date,
                "suggestedImage": image, "ok": True}
    except Exception as e:
        return {"url": url, "ok": False, "error": clean(e, 180)}

def compare_titles(a, b):
    stop = {"avec", "pour", "dans", "pour", "the", "and", "les", "des", "une", "sur", "qui", "aux",
            "more", "from", "news", "mauritius", "maurice", "apres", "après", "contre"}
    def tokens(v): return {s for s in re.findall(r"[^\W\d_]{4,}", (v or "").lower()) if s not in stop}
    left, right = tokens(a), tokens(b)
    if not left or not right: return False
    return len(left & right) / max(1, min(len(left),len(right))) >= 0.25

def main():
    with open("newsroom-import-request.json", encoding="utf8") as f:
        request = json.load(f)
    rid = clean(request.get("id"), 70)
    if not re.fullmatch(r"[A-Za-z0-9_-]{10,70}", rid):
        raise ValueError("Invalid request ID")
    urls = request.get("sources", [])
    if not isinstance(urls, list) or len(urls) not in (1,2) or any(not isinstance(x,str) or len(x)>2000 for x in urls):
        raise ValueError("Provide one or two news URLs")
    sources = [article_metadata(u) for u in urls]
    success = [x for x in sources if x["ok"]]
    result = {"id":rid, "sources":sources, "ok":bool(success),
              "automated":True,"reviewRequired":True,
              "warning":"Metadata is not independent verification. Review facts, wording and copyright before publishing.",
              "generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat()}
    if success:
        primary = success[0]
        secondary = success[1] if len(success)>1 else None
        same = compare_titles(primary["title"], secondary["title"]) if secondary else None
        result["sameTopicLikely"] = same
        result["headline"]=primary["title"]
        result["summary"]=primary["description"] or ""
        result["publishedDate"]=primary["publishedDate"] or ""
        result["suggestedImage"]=primary["suggestedImage"]
        # Notes are private to the editor; avoid making an unverified narrative look like finished reporting.
        result["editorialNotes"] = [
            "Automatic source preview; do not publish without checking the report against its original source.",
            *[f"{x['publisher']} — {x['title']}: {x['description'] or 'No public summary available'}" for x in success],
            *([] if secondary is None or same else ["WARNING: These URLs may describe different events; do not merge their claims."]),
        ]
    with open("newsroom-import-result.json", "w", encoding="utf8") as f:
        json.dump(result,f,ensure_ascii=False,indent=2)
        f.write("\n")
    print(json.dumps({"id":rid,"success":len(success),"total":len(urls)},ensure_ascii=False))

if __name__=="__main__":
    main()
