#!/usr/bin/env python3
"""Aggregate authorised public TikTok comments. Never store user-level data in GitHub.

Requires approved TikTok Accounts API access on an owned video. No scraping.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/business/comment/list/"
LABELS = {
    "A": "Water supply",
    "B": "Cost of living",
    "C": "Jobs and employment",
    "D": "Healthcare",
}
MAX_PAGES = 2000
DIRECT = re.compile(r"^\s*([ABCD])[\s.,!?;:()\-\U0001f300-\U0001faff]*$", re.I)
EXPLAINED = re.compile(
    r"^\s*(?:i\s+vote(?:\s+for)?|i\s+choose|my\s+(?:vote|choice)\s+is|"
    r"vote(?:\s+for)?|choice)\s*[:=\-]?\s*([ABCD])[\s.,!?;:()\-\U0001f300-\U0001faff]*$",
    re.I,
)

def extract_vote(text):
    """Return an explicit A-D vote only; ignore ambiguous words and multiple votes."""
    if not isinstance(text, str):
        return None
    text = text.strip()
    m = DIRECT.fullmatch(text) or EXPLAINED.fullmatch(text)
    return m.group(1).upper() if m else None

def normalized_vote(comment, expected_video_id=None):
    """Return (author ID, vote, time, comment ID), or None."""
    if not isinstance(comment, dict):
        return None
    if str(comment.get("status", "")).upper() != "PUBLIC":
        return None
    if comment.get("owner") is True or str(comment.get("owner", "")).lower() == "true":
        return None
    if comment.get("parent_comment_id"):
        return None  # Only top-level comments on the video
    if expected_video_id and comment.get("video_id") and str(comment["video_id"]) != str(expected_video_id):
        return None
    author = comment.get("unique_identifier") or comment.get("user_id")
    comment_id = comment.get("comment_id")
    vote = extract_vote(comment.get("text"))
    if not author or not comment_id or not vote:
        return None
    try:
        created = int(comment.get("create_time", 0))
        if created <= 0:
            created = 2**62
    except (ValueError, TypeError):
        created = 2**62
    return (str(author), vote, created, str(comment_id))

def aggregate(comments, expected_video_id=None):
    """Rebuild from current public comment snapshot; one earliest vote per author."""
    voter_choices = {}
    seen_comment_ids = set()
    for comment in comments:
        row = normalized_vote(comment, expected_video_id)
        if row is None:
            continue
        user_id, vote, created, comment_id = row
        if comment_id in seen_comment_ids:
            continue
        seen_comment_ids.add(comment_id)
        candidate = (created, comment_id, vote)
        if user_id not in voter_choices or candidate < voter_choices[user_id]:
            voter_choices[user_id] = candidate
    counts = {key: 0 for key in LABELS}
    for _, _, vote in voter_choices.values():
        counts[vote] += 1
    return counts

def fetch_page(token, business_id, video_id, cursor):
    params = {
        "business_id": business_id,
        "video_id": video_id,
        "status": "PUBLIC",
        "max_count": 30,
        "sort_field": "create_time",
        "sort_order": "asc",
        "include_replies": "false",
        "cursor": cursor,
    }
    url = ENDPOINT + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(
        url,
        headers={"Access-Token": token, "Accept": "application/json", "User-Agent": "MUPublicVoicePoll/1.0"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                payload = json.load(response)
            if not isinstance(payload, dict) or payload.get("code") != 0:
                raise RuntimeError(
                    "TikTok rejected the request (code=%s). Check approval, permissions, token and video ownership."
                    % (payload.get("code") if isinstance(payload, dict) else "unknown")
                )
            data = payload.get("data", {})
            if not isinstance(data, dict) or not isinstance(data.get("comments"), list):
                raise RuntimeError("TikTok returned an unexpected response. No results published.")
            return data
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2**attempt)
                continue
            raise RuntimeError("TikTok API HTTP %s. No results published." % exc.code) from exc
        except urllib.error.URLError as exc:
            if attempt < 3:
                time.sleep(2**attempt)
                continue
            raise RuntimeError("TikTok API connection failed. No results published.") from exc
    raise RuntimeError("TikTok API retry limit exceeded.")

def fetch_all_comments(token, business_id, video_id):
    """Fetch a complete public snapshot; do NOT publish incomplete results."""
    comments = []
    cursor = 0
    seen_cursors = set()
    for _ in range(MAX_PAGES):
        if cursor in seen_cursors:
            raise RuntimeError("Pagination cursor loop; no results published.")
        seen_cursors.add(cursor)
        data = fetch_page(token, business_id, video_id, cursor)
        comments.extend(data["comments"])
        if not data.get("has_more"):
            return comments
        next_cursor = data.get("cursor")
        try:
            cursor = int(next_cursor)
        except (TypeError, ValueError):
            raise RuntimeError("Missing pagination cursor; no results published.")
    raise RuntimeError("Too many pages; no results published.")

def public_result(counts, video_id):
    total = sum(counts.values())
    return {
        "status": "synced",
        "source": "Authorised TikTok Accounts API (public comments only)",
        "video_id": str(video_id),
        "video_url": "https://vt.tiktok.com/ZSpmNBwtk/",
        "total": total,
        "counts": counts,
        "percentages": {k: round(100 * v / total, 1) if total else 0.0 for k, v in counts.items()},
        "updated_utc": datetime.now(timezone.utc).isoformat(),
        "method": "Earliest explicit top-level public comment per unique commenter; non-scientific poll",
    }

def main():
    token = os.environ.get("MUPV_TIKTOK_ACCESS_TOKEN", "")
    business_id = os.environ.get("MUPV_TIKTOK_BUSINESS_ID", "")
    video_id = os.environ.get("MUPV_TIKTOK_VIDEO_ID", "")
    if not token or not business_id or not video_id:
        raise RuntimeError("Approved TikTok token, business ID and numeric video ID are all required. No collection attempted.")
    if not re.fullmatch(r"\d{10,30}", video_id):
        raise RuntimeError("TikTok video ID must be numeric (not the short URL).")
    comments = fetch_all_comments(token, business_id, video_id)
    result = public_result(aggregate(comments, video_id), video_id)
    output = Path(__file__).resolve().parents[1] / "results.json"
    temporary = output.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print("Aggregated %d public comments: %d distinct valid votes. No identities exported." % (len(comments), result["total"]))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("MUPublicVoice sync stopped: %s" % exc, file=sys.stderr)
        sys.exit(1)
