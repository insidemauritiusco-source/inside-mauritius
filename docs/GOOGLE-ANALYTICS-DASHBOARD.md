# Inside Mauritius — Google Analytics reporting dashboard

This guide configures a **private dashboard inside the owner's existing Google Analytics account**, without adding any publicly accessible reporting page.

## Quick setup in GA4 on Lenovo or Android Chrome

1. Sign in to https://analytics.google.com and select **Inside Mauritius Website**.
2. Open **Reports → Realtime overview** to view active users and recent `page_view`, `video_start`, `video_progress` and `video_complete` events.
3. Open **Reports → Realtime pages** to inspect the pages people are currently viewing.
4. For historical data, open **Explore → Free form** (use the Explore icon in the left navigation).
5. Name the exploration **Inside Mauritius — News & Video**.
6. Choose a date range such as **Last 7 days**.
7. Add dimensions such as **Event name**, **Page title**, **Page location**, **Date** and **Video title** (custom event parameters may require registration as event-scoped custom dimensions).
8. Add metrics **Event count**, **Views**, and **Active users**.
9. Build separate tabs:
   - **Overview:** Date × Active users, Views.
   - **News:** Page title / Page location × Views, filter `page_view` and article URL fragments.
   - **Videos:** Event name × Event count, filter to `video_start`, `video_progress`, `video_complete`.
   - **Video by title:** only after registering the `video_title` event parameter as a custom dimension; custom dimensions are generally not retroactive.
10. Save the exploration. GA4 reports may take 24–48 hours to fully populate.

**Note:** The existing `video_progress` event fires at 25%, 50%, and 75%. One video playback may create three progress events. `video_start` is a count of playback starts, **not** unique viewers; `video_complete` counts completed playbacks. TikTok/YouTube outbound clicks are not confirmed watches.

## Custom dimensions to consider

Under **Admin → Custom definitions → Create custom dimension**, create **event-scoped** dimensions for `video_title`, `video_provider`, `video_percent` and `content_group`, using matching parameter names. These improve per-video and news grouping in Explorations.

## Privacy and access

GA4's dashboard is already private to authorized Google Analytics users. Do not embed private reports on the public GitHub Pages website or publish GA4 Data API credentials. Share access only with approved users via GA4's account/property access controls.

## Verification checklist

- [ ] Realtime shows `page_view`.
- [ ] Play a hosted World News video; Realtime shows `video_start`.
- [ ] Finish the video; Realtime shows `video_complete`.
- [ ] The GA4 date range is correct for Mauritius reporting.
- [ ] Explore tabs show meaningful event counts once reporting has processed.
- [ ] No report is made publicly accessible.

The Google Analytics configuration is managed in the Google Analytics interface, **not** by merging this documentation-only PR. No changes to the live website are required for this part.
