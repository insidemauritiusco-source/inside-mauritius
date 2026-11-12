# Inside Mauritius — Private Analytics Dashboard (owner setup)

**Status: preview, not activated.** This branch adds a Google-authenticated, read-only reporting interface. The public site and existing GA4 tag are not changed. Do not merge until you review this PR.

## Security review

- Existing site: static GitHub Pages, publicly downloadable HTML/CSS/JavaScript. There is no server-side admin session or dedicated analytics login in this repository.
- Existing newsroom editor: uses a manually entered GitHub token for article publishing; this is **not** a login system and is **not** reused.
- Proposed dashboard: static route `/admin/analytics/` is public HTML, but **no private report data is embedded**. Reports are requested from the Google Analytics Data API only after Google OAuth consent. Google checks the signed-in account's GA4 property permissions.
- Google OAuth access token is stored in memory only, never in GitHub, cookies, localStorage, sessionStorage or URL. Disconnect revokes the token. The browser tab must be refreshed/reconnected after expiry.
- This is **not** a server-protected admin area. Anyone can download the empty dashboard HTML. They cannot retrieve your GA4 private reports without permission. If you need the *page itself* hidden, deploy it behind an identity-aware access gateway or a protected backend, not public GitHub Pages.
- No Google OAuth client secret, service-account JSON, Analytics API key, GitHub token, or other secret belongs in the public repo.
- The dashboard does not include an owner list; GA4's own Viewer/Administrator permissions are the access control.

## Before it works: obtain two different identifiers

You already have **Web Measurement ID** `G-19XMD3N3ED` used by the public tracker. **Do not** put this in the numeric Property ID field.

1. Open [Google Analytics](https://analytics.google.com/) in Chrome. Select **Inside Mauritius Website**.
2. Click **Admin** (gear) → **Property details**. Copy the **numeric Property ID** (digits only). This is not the `G-` measurement ID.
3. In [Google Cloud Console](https://console.cloud.google.com/), select or create a Google Cloud project you control.
4. Under **APIs & Services → Library**, enable **Google Analytics Data API**. Verify any quota or billing requirements shown by Google before accepting.
5. Under **Google Auth Platform / OAuth consent screen**, configure an app and audience appropriate to your account. If External + Testing, add your Google email as a **test user**. Request only the `https://www.googleapis.com/auth/analytics.readonly` scope. Google may require consent screen verification for broader public use.
6. Under **Clients / Credentials**, create an **OAuth client ID → Web application**. Add **Authorized JavaScript origin** `https://mr.insidemauritius.com` (origin only; no trailing slash/path). No redirect URI is required for the Google Identity Services JavaScript token client used here.
7. Copy the OAuth **Client ID** ending in `.apps.googleusercontent.com`. The OAuth client ID is public. **Never copy the client secret into GitHub**.
8. In `admin/analytics/config.js`, replace the two empty strings:
   ```js
   window.IM_DASHBOARD_CONFIG = Object.freeze({
     measurementId: "G-19XMD3N3ED",
     propertyId: "YOUR_NUMERIC_GA4_PROPERTY_ID",
     oauthClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
   });
   ```
9. Confirm the Google account has **Viewer** (or higher) permission on the Inside Mauritius GA4 property.
10. Review the configuration commit in a separate PR or the current PR **before merging**. The existing public site remains unchanged until approved and merged.

## Google Analytics dashboard

Your existing [Google Analytics reports](https://analytics.google.com/) already show Realtime users and event names. In Google Analytics, use:
- **Reports → Realtime overview**: active visitors and event activity for the last 30 minutes.
- **Reports → Realtime pages**: recent pages.
- **Reports → Engagement / Events** (names may differ): `video_start`, `video_complete`, `video_progress`, `page_view`.
- **Reports → Engagement / Pages and screens**: news page performance.
- **Explore → Free form**: create an optional custom table using Event name, Page title, Event count, Views, and Active users. Do not mistake `video_progress` for unique video plays.

## Private dashboard after approval

Visit `https://mr.insidemauritius.com/admin/analytics/` after deployment, choose **Connect with Google**, grant the read-only Analytics permission, and inspect:
- Realtime active users (last 30 minutes).
- Active users and page views for Today / 7 days / 30 days.
- News article page views (requires the custom `content_group` dimension to be registered in GA4).
- Video starts, video completions, video progress milestones, and TikTok/YouTube outbound clicks.
- Most-read pages by title.

**Important GA4 configuration:** For the news article views card, GA4 may require **Admin → Custom definitions → Create custom dimension**, scope **Event**, event parameter `content_group`, dimension name `Content group`. Custom definitions only apply from their creation onward. Until registered/available, this card may show unavailable while the other metrics work.

GA4 standard reporting can lag by 24–48 hours. GA4 reports exclude some visitors due to opt-out, ad blockers or consent. A video start is a playback event, not a unique viewer. A completion is an ended playback event, not a unique person. Video progress is three events per full play (25%, 50%, 75%).

## Owner test checklist

1. Confirm no OAuth client secret or service-account key is committed.
2. Verify Google OAuth is restricted to the intended origin and only `analytics.readonly`.
3. Confirm a Google account **without** GA4 property access cannot view statistics.
4. Confirm authorized account can load Realtime and last-7-days reports.
5. Confirm Disconnect clears the display and revokes access.
6. Confirm mobile layout on Android and desktop layout on Lenovo.
7. Confirm public site news, images, logo, CNAME and existing consent-based tracking remain unchanged.

This PR prepares the implementation; **live authentication and API tests require the two identifiers and a permitted Google sign-in**.
