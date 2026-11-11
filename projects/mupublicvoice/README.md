# 🇲🇺 MUPublicVoice – TikTok public vote counter

**Status: standalone static prototype on an isolated development branch. Not published, not connected to TikTok.**

This folder is intentionally separate from the Inside Mauritius production website. The feature branch has NOT been merged into main. Moving this folder to its own `mupublicvoice` repository later is recommended. To run, download `index.html` and open it in a desktop or mobile browser; it uses no server or build tools. This same HTML could be deployed to GitHub Pages in a dedicated repository.

## Question

What should the Mauritian Government prioritise right now?
- A – 💧 Water supply
- B – 💰 Cost of living
- C – 👷 Jobs and employment
- D – 🏥 Healthcare

## What currently works

- Import a CSV of legitimately obtained **public comments** on a **specific** TikTok video.
- Recognise clear single-letter votes, optionally with "I vote A", "I choose B", or "my vote is C" forms.
- Exclude hidden/non-public records and comments marked as made by the video owner.
- One vote per commenter identifier: prefer `unique_identifier`, fallback `user_id`, then `username` with an **approximate identity** warning. Earliest valid comment wins (by `create_time`, then comment ID); repeated imports don't multiply votes.
- Show A–D totals and percentages; download aggregate CSV.
- Store imported vote records in the user's *own browser localStorage* only. There is no data synchronisation with other devices.

CSV headers: `unique_identifier,text,comment_id,create_time,status,owner`. Optional compatible headers: `user_id`, `username`, `comment`, `created_at`, `is_owner`.

## NOT implemented — do not claim these work

- Automatic retrieval of TikTok video comments, real-time refresh or a public **shared** result board.
- Secure administrator login, database, encrypted durable vote storage, verified identity of commenters, cross-device data synchronisation.
- Automatic replies or posts (intentionally prohibited by design).

**Do not put access tokens, private comment exports, or personal identifiers in this public GitHub repository.**

## Android quick start

1. Publish your TikTok question on **@mupublicvoice**, allowing public comments.
2. Copy the exact video link (not just `tiktok.com/@mupublicvoice`).
3. Open the HTML page; paste the video link.
4. Provide an authorised/public comment CSV, and press **Import and count**.
5. Download aggregate voting results CSV. If changing polls, clear saved local data first.

## To make automatic and public

Set up a separate backend (e.g. server functions + database), approved TikTok API for Business app and owned-video comment-read permission. The server would call `GET https://business-api.tiktok.com/open_api/v1.3/business/comment/list/` with protected `Access-Token`, `business_id`, `video_id`, `status=PUBLIC` and paginate using the API cursor. Securely store full comment data and restrict it to an authorised admin; publish *only aggregated counts* to read-only public endpoints. Deduplicate commenter `unique_identifier` and comment ID and account for removals/hiding of comments. Provide token rotation and rate-limit controls. Do not scrape TikTok or implement reply/post endpoints.

Official references:
- https://business-api.tiktok.com/gateway/docs/index?doc_id=1760232109619202
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

This is a comment participation poll, **not** a representative survey of Mauritian public opinion.
