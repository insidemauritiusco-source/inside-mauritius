# Inside Mauritius — Website Package

**Destination:** https://mr.insidemauritius.com  
**GitHub repository:** https://github.com/insidemauritiusco-source/inside-mauritius  
**Hosting:** GitHub Pages (branch `main`, folder `/ (root)`)

This is a full **static news website**. There are no paid libraries, databases, trackers, API keys, or build commands. The clock updates automatically in Mauritius time. News items do **not** auto-update; you publish them through `articles.js`.

## Files in this package

- `index.html` — complete accessible website, navigation, SEO, article layout
- `styles.css` — responsive desktop and mobile design
- `app.js` — Mauritius clock, stories, filters, search, article pages, sharing, navigation
- `articles.js` — **edit this file to add news and contact details**
- `logo.png` — existing Inside Mauritius brand logo used in this design
- `cover-*.svg` — included original editorial illustration placeholders
- `favicon.svg` — browser-tab icon
- `social-cover.png` — social media sharing preview
- `CNAME` — the existing custom domain, `mr.insidemauritius.com`
- `robots.txt`, `sitemap.xml` — basic site discovery
- `.nojekyll` — prevents GitHub Pages from ignoring underscore-prefixed resources

## Publish on GitHub Pages from a laptop

1. Download `Inside_Mauritius_Professional_Website.zip` and **extract/unzip** it.
2. Open `https://github.com/insidemauritiusco-source/inside-mauritius` and sign in.
3. Make sure the branch selector shows **main**.
4. Click **Add file → Upload files**.
5. Drag **the files inside the extracted folder** into GitHub (not the ZIP file and not the folder itself). These are all intended to be at the repository **root**, next to `index.html`.
6. Confirm GitHub's list includes `index.html`, `styles.css`, `app.js`, `articles.js`, `logo.png`, the `.svg` files, and `CNAME`.
7. Under **Commit changes**, write `Upgrade Inside Mauritius website` and commit directly to `main`.
8. GitHub Pages should deploy the update automatically. Open `https://mr.insidemauritius.com` and refresh. If you still see the old page, perform a hard refresh (`Ctrl+Shift+R` on Windows) or open a private/incognito tab.

**Important:** You already connected DNS and enabled HTTPS. **Do not change the GoDaddy DNS record.** Keep the `CNAME` file's content exactly `mr.insidemauritius.com`.

## How to publish a news story

Open `articles.js` in GitHub, click the **pencil/Edit** icon, and add a new object at the start of `window.INSIDE_MAURITIUS_ARTICLES` (before the first story):

```javascript
{
  id: "my-first-news-report",
  category: "Mauritius",
  label: "NEWS",
  title: "Write your verified headline here",
  summary: "A brief, factual summary of the report.",
  date: "2026-11-05",
  image: "news-photo.jpg",
  imageAlt: "Description of the photo",
  author: "Inside Mauritius",
  content: [
    "First paragraph of the report.",
    "Second paragraph, with additional verified details."
  ]
},
```

Change `id` for every story. Use categories **Mauritius**, **World**, **Community**, or **Video** exactly as shown. Save/commit the file; the updated article will appear on the website after GitHub Pages publishes it.

### Add photos or videos

- Upload `news-photo.jpg` to the **same repository root folder** as `index.html`. Enter its filename under `image`.
- For videos hosted on YouTube, add `video: "https://www.youtube.com/watch?v=XXXXXXXXXXX",` with the real video ID to a story.
- For short MP4 videos hosted in the repository, upload e.g. `report.mp4` and use `video: "report.mp4",`. Large videos are better hosted externally because GitHub repositories have file-size limits.
- You may replace `logo.png` with your preferred Inside Mauritius logo, keeping the same filename.

### Add your contact email

In the top part of `articles.js`, set `contactEmail: "your-real-email@example.com"`. The contact button then opens an email to that address. Leave it blank until you have a verified address; no fictitious contact information is displayed.

### Change the breaking news ticker

Set `breakingHeadline` to your verified headline. Set `breakingIsBreaking: true` only when it is genuine breaking news, otherwise keep `false`. Commit the changes.

## Notes

- The six included articles introduce the publication and its planned coverage. **They are starter editorial copy, not reporting about real breaking events.** Replace or supplement them with verified articles before publicly promoting the website as a live news source.
- Dates and the live clock use `Indian/Mauritius` (UTC+4); no external clock service is required.
- Site search/filter runs in the browser. There is no automated news feed, back-end contact form, login, editorial CMS, or automatic publishing service.
- If your existing repository contains extra files, you do not need to delete them unless they conflict with this design.
