# Inside Mauritius — 17 November 2026 review-only update

This PR stages editorial data in `editorial-drafts/` only. It intentionally does **not** modify the homepage, existing feeds, branding, CNAME, deployment workflows, media playback, or main branch. Publication requires separate review and approval.

## Duplicate check
- Existing `news-2026-11-15.js` already covers the Bank of Mauritius 5% key rate and Monseigneur Leen road diversion. Do not republish these as new stories.
- `newsroom-data.js` is an automated feed and already contains current 17 November entries. Avoid copying its RSS content or externally hosted photographs into local assets.
- Before integration, check these four draft IDs and titles against all feed sources and editorial files; this preliminary check is not exhaustive.

## Media and dashboard implementation plan
- Photos: retain existing original `cover-*.svg` illustrations as clearly labeled placeholders. Replace only with documented licensed or permission-cleared photos. No copying third-party photos from RSS feeds.
- Videos: keep existing video player and MP4/WebM files unchanged; add only rights-cleared or official embeddable video links after testing playback. Never claim preview videos are footage of the story.
- Dashboard: preserve the logo, navigation, mobile layout, date/time components and accessibility. In a follow-up integration commit, show source attribution and publication dates, distinguish externally sourced feed headlines, and provide fallbacks for empty photo feeds.
- Existing `photo-gallery-feed.json` currently has zero items; avoid rendering a misleading populated gallery.

## Verification required before approval
1. Validate `nov17-news.json` as JSON; check unique IDs, source URLs and date values.
2. Confirm official source links and publication dates, and check whether any article already exists in live feeds.
3. Test desktop/mobile dashboard and news cards; verify logo and responsive layout remain unchanged.
4. Test video playback and photo fallbacks on Android and desktop.
5. Run repository CI and review diff/mergeability. No merge, deployment or publication.
