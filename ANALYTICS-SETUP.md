# Inside Mauritius — Google Analytics 4 setup (Android + GitHub)

Website: https://mr.insidemauritius.com
Repository: insidemauritiusco-source/inside-mauritius

## 1. Create a GA4 property and Web stream on Android

1. Open Chrome on Android and visit https://analytics.google.com.
2. Sign in with your Google account. If this is your first property, choose **Start measuring**. Otherwise go to **Admin → Create → Account** (if needed) or **Admin → Create → Property**.
3. Suggested account name: **Inside Mauritius**.
4. Suggested property name: **Inside Mauritius — Website**.
5. Select **Mauritius** reporting time zone and **Mauritian Rupee (MUR)** currency; complete the prompts and accept the terms.
6. Choose **Web** as the data stream type.
7. Website URL: **https://mr.insidemauritius.com**. Stream name: **Inside Mauritius News Website**.
8. Create the stream. Open its details and copy the **Measurement ID**, beginning with **G-** (e.g. G-XXXXXXXXXX is an example, NOT a valid ID).
9. If the mobile layout hides Admin or Data streams, use Chrome ⋮ → **Desktop site**.

Do not paste or store private Google account passwords, API secrets, service-account keys, or downloaded admin files in GitHub. The GA4 Measurement ID itself is a public website identifier.

## 2. Prevent duplicate page counts

Inside **Admin → Data streams → your Web stream → Enhanced measurement → settings gear**, under **Page views → Show advanced settings**, disable **Page changes based on browser history events**, then save. Our custom tracker manually emits `page_view` on `#article/...` routes and on initial page load.

Our JavaScript uses `gtag('config', ..., { send_page_view: false })` to suppress the initial automatic page view, but the history-based Enhanced Measurement option *must* also be disabled to avoid double-counting. Consider disabling Enhanced Measurement's separate **Video engagement** option when counting videos in custom events, especially when YouTube embeds are present. Other desired Enhanced Measurement features can remain enabled.

## 3. Activate GA4 safely (separate approval)

This pull request intentionally includes an empty `measurementId` in `analytics-config.js` and collects **no data** as-is.

After you supply your actual G- ID, change only:

```js
window.INSIDE_MAURITIUS_ANALYTICS = Object.freeze({
  measurementId: "G-YOUR-REAL-ID"
});
```

Use your actual ID, not the example. Create a separate GitHub commit or PR for this configuration change. Do not install a second Google tag manually — it could double count.

Once deployed, the visitor sees a privacy choice. No Google Analytics script is requested until the visitor chooses **Allow analytics**. A persistent **Privacy & analytics choices** button lets them change their choice later. Visitors who decline or block tracking won't be counted in GA4.

This is a starter consent implementation. Review your public privacy notice and applicable cookie/data-protection obligations before publishing the enabled tracker.

## 4. How events work

| Measurement | Event | Important limitation |
| --- | --- | --- |
| Homepage and World News views | `page_view` | Manual route-aware counts, no URL query strings |
| Each news article | `page_view` | Uses its `#article/...` route and article title |
| Native MP4/WebM playback begins | `video_start` | Fires on actual playback, not decorative play-icon clicks |
| 25%, 50%, 75% played | `video_progress` | Custom `video_percent` event parameter |
| Native video finishes | `video_complete` | Custom 100% milestone |
| TikTok / YouTube link clicked | `video_outbound_click` | **Not** a confirmed external watch or TikTok view |

The full YouTube and TikTok viewing metrics remain available on those platforms. This code does not claim access to their private playback statistics.

## 5. Verify from Android

1. After the ID is added and approved/merged, open https://mr.insidemauritius.com in Chrome.
2. Select **Allow analytics** in the website's privacy panel.
3. Open a news article, then go back to Home.
4. Play a self-hosted World News intro video.
5. On another browser tab, sign in to https://analytics.google.com → **Reports → Realtime**. You should see yourself among users active during the last 30 minutes and events including `page_view`, `video_start`, `video_progress`, `video_complete`.
6. Visit **Reports → Engagement → Pages and screens** for per-article views, and **Reports → Engagement → Events** for video events (report layout and labels may vary). Standard reports can take 24–48 hours to finish processing.

If nothing appears, verify the actual Measurement ID, that the consent choice is "Allow analytics", that your web stream is correct, and that tracking blockers are disabled for this test. Google Analytics may take up to 30 minutes initially.

**Never interpret missing GA4 visitors as proof that no one visited:** ad blocking, visitor consent refusal, and browser restrictions can reduce observed counts.
