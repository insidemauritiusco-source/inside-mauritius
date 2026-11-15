"""Discover Wikimedia Commons candidates for editorial review, never auto-approve.

Usage: python scripts/discover_photo_candidates.py
Output: photo-gallery-candidates.json (NOT the public gallery feed).
"""
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEARCHES = {
    "mauritius": "Mauritius",
    "reunion": "Réunion island",
    "rodrigues": "Rodrigues island Mauritius",
    "world": "World geography",
}
API = "https://commons.wikimedia.org/w/api.php"
ALLOWED = {"cc-by-4.0", "cc-by-sa-4.0", "cc0", "public domain", "cc-by-3.0", "cc-by-sa-3.0"}

def plain(value):
    return re.sub(r"<[^>]*>", "", value or "").strip()

def query(region, term):
    params = urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": "filetype:bitmap " + term,
        "gsrnamespace": 6, "gsrlimit": 12, "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime", "iiurlwidth": 1200, "format": "json",
    })
    request = urllib.request.Request(API + "?" + params,
                                     headers={"User-Agent": "InsideMauritiusGallery/0.1 (editorial review)"})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    result = []
    for page in data.get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        license_name = plain(meta.get("LicenseShortName", {}).get("value", ""))
        license_code = plain(meta.get("License", {}).get("value", "")).lower()
        if license_code not in ALLOWED and license_name.lower() not in ALLOWED:
            continue
        url = info.get("thumburl") or info.get("url", "")
        source = info.get("descriptionurl", "")
        if not url.startswith("https://") or not source.startswith("https://"):
            continue
        if not info.get("mime", "").startswith("image/"):
            continue
        result.append({
            "region": region, "title": page.get("title", "").removeprefix("File:"),
            "image_url": url, "source_url": source,
            "credit": plain(meta.get("Artist", {}).get("value", "")),
            "license": license_name,
            "license_url": plain(meta.get("LicenseUrl", {}).get("value", "")),
            "description": plain(meta.get("ImageDescription", {}).get("value", ""))[:500],
            "approved": False,
            "review_note": "Verify photographer, license, depiction, event relevance and attribution before approval.",
        })
    return result

def main():
    candidates = []
    for region, term in SEARCHES.items():
        try:
            candidates.extend(query(region, term))
        except (OSError, ValueError) as exc:
            print(f"{region}: discovery unavailable: {exc}")
    unique = {item["source_url"]: item for item in candidates}
    output = {"generated_at": datetime.now(timezone.utc).isoformat(),
              "warning": "Unverified candidates. Not for publication.", "items": list(unique.values())}
    (ROOT / "photo-gallery-candidates.json").write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(unique)} candidates saved for editorial review; zero automatically approved")

if __name__ == "__main__":
    main()
