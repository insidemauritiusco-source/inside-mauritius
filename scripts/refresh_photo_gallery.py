"""Validate editor-approved images. No scraping or automatic licensing assumptions."""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'photo-gallery-approved.json').read_text(encoding='utf-8'))
regions = {'mauritius', 'reunion', 'rodrigues', 'world'}
required = ('region', 'title', 'image_url', 'source_url', 'alt', 'credit', 'license', 'published_at')
items = []
for item in source.get('items', []):
    if item.get('approved') is not True or item.get('region') not in regions:
        continue
    if not all(isinstance(item.get(k), str) and item[k].strip() for k in required):
        continue
    if not all(urlparse(item[k]).scheme == 'https' and urlparse(item[k]).netloc for k in ('image_url', 'source_url')):
        continue
    # Preserve archival dates, creator credit and explicit licence links.
    extra = ('license_url', 'photo_date', 'approved_at', 'usage', 'modification_note')
    if item.get('archive') is True:
        if not all(isinstance(item.get(k), str) and item[k].strip() for k in ('license_url','photo_date','modification_note')):
            continue
        if urlparse(item['license_url']).scheme != 'https' or not urlparse(item['license_url']).netloc:
            continue
    items.append({k: item[k] for k in required} | {k: item[k] for k in extra if k in item} | {'approved': True, 'archive': item.get('archive') is True})
items.sort(key=lambda x: x['published_at'], reverse=True)
output = {'generated_at': datetime.now(timezone.utc).isoformat(), 'items': items[:120]}
(ROOT / 'photo-gallery-feed.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Validated {len(items)} approved photos; no unapproved images published')
