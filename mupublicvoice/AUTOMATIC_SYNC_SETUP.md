# MUPublicVoice — future authorised automatic TikTok comment sync

**Status as of 11 November 2026: NOT CONNECTED, NOT ENABLED.** This branch is for review only. Its GitHub Actions workflow will not execute until explicitly enabled after a separate authorisation and security review. Your Personal TikTok account `@mupublicvoice` does NOT need to be changed for the existing manual CSV counter.

## Current working website
https://mr.insidemauritius.com/mupublicvoice/

The live site remains **local CSV mode**, with vote data stored only in that browser. Your TikTok short link is `https://vt.tiktok.com/ZSpmNBwtk/` but its final numerical video ID has **not** been independently verified.

## What this branch includes
- Read-only integration scaffold with TikTok's Accounts API owned-video comment-list endpoint (subject to actual grant and current endpoint contract verification). It does **not** scrape comments, post comments, or send replies.
- Vote parsing and deterministic earliest-one-vote-per-account counting, skipping non-public, owner and duplicate comments.
- Exports **only aggregate counts**, percentages, numeric video identifier and update time to `mupublicvoice/results.json`. No usernames, IDs of commenters, comment texts, access tokens or raw data should be committed.
- A disabled-by-default GitHub Actions workflow to run every 30 minutes **only if explicitly activated** using repository variable `MUPV_ENABLE_TIKTOK_SYNC=approved-and-enabled`. Until then, nothing happens.
- Unit tests under `mupublicvoice/scripts/test_sync_tiktok.py`.

## Dependencies before activating
1. TikTok developer approval for the relevant **Accounts API** owned-video public comment-list permission. It is **not** included in ordinary Display API permissions, nor guaranteed for Personal accounts. TikTok Business Registration is also separate from API approval. Do not register a false country.
2. Verify the API request/response parameters with current TikTok documentation in the approved developer app. The provided request is a **scaffold**, not a verified end-to-end connection.
3. Confirm the exact numeric TikTok video ID (the short URL is insufficient).
4. Set GitHub Actions secret `MUPV_TIKTOK_ACCESS_TOKEN` and `MUPV_TIKTOK_BUSINESS_ID` and repository variable `MUPV_TIKTOK_VIDEO_ID`. Never commit credentials. Ensure token renewal and limited permissions.
5. Review the handling of removed/hidden comments, reply exclusion, ownership markers, pagination, and the completeness of the comment collection. Error => no result publication.
6. Add a public dashboard that reads the safe aggregate JSON **read-only** and distinguishes it clearly from local-only results.
7. After testing in a non-production branch, explicitly approve release. Only then enable workflow. GitHub Actions generally does not execute scheduled workflows from nondefault branches.

## Current limitations
- No approved TikTok API credentials have been provided or accessed.
- No automatic collection has happened; no real vote totals have been generated.
- An API failure must leave previous aggregate unchanged, not invent results.
- The code does not deliver a public shared dashboard, admin login or private audit logs.
- A username is not a verified TikTok identity; the planned API-only mode requires TikTok's commenter unique identifier (or user_id).

Test locally: `python -m unittest discover -s mupublicvoice/scripts -p 'test_*.py'`.

The goal is a non-scientific public-comment poll, not a representative survey of Mauritius.
