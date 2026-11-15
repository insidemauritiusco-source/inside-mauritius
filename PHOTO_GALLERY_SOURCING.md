# Regional gallery — image sourcing and approval

The hourly workflow refreshes the feed from `photo-gallery-approved.json`. It **does not automatically grant image rights** or publish scraped images.

## Candidate discovery
- Wikimedia Commons is a candidate discovery source, not a news verification service.
- Region searches: Mauritius, Réunion, Rodrigues, and international news topics.
- Collect the file description URL, photographer/creator, license name and URL, image URL, original publication date, and caption.
- Verify the actual Commons file page, source provenance, and that its license allows commercial reuse; comply with attribution and share-alike terms where applicable.
- Do not imply a photograph depicts a current event solely because its filename or category matches a news topic.
- Verify news-event claims against an original reporting source independently of image licensing.
- Do not scrape or republish copyrighted images from media websites, Facebook or other social networks without permission.

## Editorial approval
Only add images to `photo-gallery-approved.json` after verifying rights and accuracy. Every item requires `approved: true`, region, title, image_url, source_url, alt, credit, license, published_at. Preserve a link to the license in the credit or license text when required. Never add unverified or placeholder photographs.

## Remaining implementation before merge
1. Build a candidate discovery script that produces a **review queue** separate from approved feed, with Wikimedia API metadata and conservative licensing filters.
2. Add tests for malformed URLs, license exclusions, duplicate entries and stale captions.
3. Integrate gallery navigation into homepage after checking existing markup and responsive styling.
4. Verify workflow permissions, schedule behavior and site rendering in a preview.
5. Request explicit approval before merge or publishing.

The current hourly schedule only regenerates an approved-image feed. It does not discover or automatically approve new images.
