# Inside Mauritius — private analytics dashboard design

**Status:** Design / security review only. **No private dashboard is deployed by this PR.**

## Existing system audit (2026-11-12)

- Public site: `https://mr.insidemauritius.com` hosted on GitHub Pages.
- GA4 Web stream Measurement ID: `G-19XMD3N3ED` (public identifier).
- Existing opt-in tracking: `analytics.js` and `analytics-config.js`.
- Existing events: `page_view`, `video_start`, `video_progress` (25/50/75%), `video_complete`, `video_outbound_click`.
- News articles use `#article/...` fragments, so report by GA4 `page_location` or `page_path` with fragment-aware handling.
- Repository has **no implemented admin authentication**, no private analytics API, no verified backend or Google Analytics Data API credentials.
- **GitHub Pages is public static hosting**. Adding `admin.html`, a client-side password, or hiding a route is **not access control**.

## Proposed private admin interface (NOT IMPLEMENTED)

**Location:** Separate authenticated admin service on a controlled host (e.g. Vercel server-side functions, or another host approved by the owner), on an admin-specific domain/subdomain after DNS review. Keep the existing public news website and DNS untouched until owner approval.

**Dashboard layout (mobile-first):**
- Header: Inside Mauritius logo, 'Analytics', selected reporting period, last refreshed timestamp, account sign-out.
- Date ranges: Today, Yesterday, Last 7 days, Last 30 days, custom dates. Reporting timezone: Indian/Mauritius (UTC+04).
- KPI row: active users, views, video starts, completed video plays, video completion ratio.
- News table: article title, views, active users, link to original article. Filter to `#article/...` route; don't include homepage views.
- Video table: video title, `video_start` count, `video_complete` count, completion rate, 25/50/75% milestones.
- Traffic sources and devices (optional).
- Realtime panel: active users in last 30 minutes and events; label it as a near-realtime estimate.
- Empty state, loading/error states, accessible labels, and responsive 360px–desktop layout.
- Display counts as **events**, not unique viewers, unless a distinct-user metric is explicitly requested.
- Respect GA4 consent gaps, blockers, reporting delay and thresholding.

## Server-side design

```text
Authenticated admin browser
   |
   | HTTPS + session cookie (Secure, HttpOnly, SameSite)
   v
Protected admin server / API
   |-- Verify session and allowlisted admin identity on EVERY request
   |-- Enforce authorization before data fetch
   |-- Apply rate limits and response caching
   |-- Read GA4 property data using server-side Google credentials
   v
Google Analytics Data API (GA4 property ID, NOT G- Measurement ID)
```

**Required inputs before implementation:**
1. Preferred private hosting/authentication platform (a separate Vercel admin project is one option).
2. Approved administrator Google account identity / email address (never hard-code a guess).
3. **Numeric GA4 property ID**, found in Google Analytics Admin → Property details; this is **different** from `G-19XMD3N3ED`.
4. Owner-controlled Google Cloud project with Analytics Data API enabled, and server-side service-account credentials / access to the GA4 property, or a secure OAuth authorization flow.
5. A privacy notice and data retention review.

**Security invariants:**
- Never place service account JSON, OAuth client secrets, access tokens, private keys, or API credentials in GitHub, static JS, HTML, build output, or browser localStorage.
- Store secrets only in the approved host's encrypted server environment / secret manager.
- Require identity-provider authentication and an exact administrator allowlist; implement session expiry, CSRF protection for mutations, HTTPS, and rate limiting.
- Default-deny all data endpoints; do not return analytics data to anonymous visitors.
- Separate admin service and public website deployment. Do not change the existing GitHub Pages CNAME or live news routes.
- Read-only analytics API; no access to user-specific raw tracking records unless explicitly needed and approved.
- Never treat GA4 `G-` measurement ID as a secret or as permission to access reports.
- Do not create an insecure public client-side dashboard as a placeholder.

## Proposed API contract (for later implementation)

- `GET /api/analytics/summary?range=7d` → `{ activeUsers, pageViews, videoStarts, videoCompletes, completionRate, lastUpdated }`
- `GET /api/analytics/news?range=7d` → `{ articles: [{ title, url, views, activeUsers }] }`
- `GET /api/analytics/videos?range=7d` → `{ videos: [{ title, videoUrl, starts, completes, progress25, progress50, progress75 }] }`
- `GET /api/analytics/realtime` → `{ activeUsers30Min, events: [{ name, count }], lastUpdated }`

All endpoints must return `401` for unauthenticated requests and `403` for non-admin users. Metrics must be mapped against the actual GA4 event and custom dimension schema, and integration-tested with a real property before release.

## Approval gates

- **This PR:** architecture + reporting instructions only; safe to review without changing public website.
- **Future PR:** authenticated private admin application, Google Analytics Data API integration and tests, **after** the owner chooses hosting/auth and supplies the numeric GA4 property ID via secure channels.
- **Deployment:** separate explicit approval after security review and login tests.

## Acceptance criteria for future admin dashboard

1. Anonymous visitor receives `401` and no metrics.
2. Signed-in non-admin receives `403`.
3. Approved admin can view daily visitors, news views and video events.
4. Server-side API credentials never appear in downloaded JS, source maps, or GitHub.
5. Existing public Inside Mauritius site remains functional and unchanged.
6. Counts are labeled as consent-limited and distinguish video starts from unique people.
7. Dashboard works on Android Chrome and Lenovo Windows Chrome.
