/*
  Inside Mauritius — TikTok video news articles
  -------------------------------------------------
  Each entry becomes a shareable article under:
    https://mr.insidemauritius.com/#article/<id>
  and appears in the "Video" filter in Latest Stories.

  IMPORTANT: Only add a PUBLIC Inside Mauritius TikTok post after publishing it.
  Use the FULL video URL copied from TikTok, for example:
    https://www.tiktok.com/@insidemauritius/video/1234567890123456789
  The numeric video ID above is ONLY a placeholder, not a real post.
  A full video URL is needed for an in-page player. A vt.tiktok.com short link
  can be listed as a click-through post until its real numeric ID is available.

  To add one video, copy this sample object into the array below and
  replace EVERY example/placeholder field before saving. Do not add
  unverified headlines or imply that a story is original reporting
  if it summarizes another news publisher.

  {
    id: "tiktok-PASTE_REAL_VIDEO_ID",
    category: "Video",
    label: "TIKTOK NEWS",
    title: "Paste the verified headline",
    summary: "Write a concise factual summary.",
    date: "YYYY-MM-DD",
    publishedAt: "YYYY-MM-DDTHH:MM:00+04:00",
    author: "Inside Mauritius",
    image: "cover-video.svg",
    imageAlt: "Generic Inside Mauritius video illustration, not footage of the event",
    content: ["Provide verified details and credit original reporting sources."],
    tiktokUrl: "https://www.tiktok.com/@insidemauritius/video/PASTE_REAL_VIDEO_ID"
  }

  Separate multiple entries with commas. The file must remain valid JS.
  Add verified titles/details when available; use neutral descriptions otherwise.
*/
window.INSIDE_MAURITIUS_TIKTOK_POSTS = [
  {
    id: "tiktok-ZSprY5DKX",
    category: "Video",
    label: "FEATURED TIKTOK",
    title: "Featured TikTok video",
    summary: "Watch this featured TikTok post. Open the original video for the creator's caption and details.",
    date: "2026-11-07",
    author: "Inside Mauritius",
    image: "cover-video.svg",
    imageAlt: "Generic Inside Mauritius video illustration, not footage from the TikTok video",
    content: [
      "This video was shared with Inside Mauritius. View the original post on TikTok for its full caption, creator attribution and playback.",
      "An in-page TikTok player can be enabled once the full video URL containing its numeric post ID is available."
    ],
    tiktokUrl: "https://vt.tiktok.com/ZSprY5DKX/"
  }
];
