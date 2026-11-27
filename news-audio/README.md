# Natural news audio — review edition

The website defaults to matching, approved MP3 recordings. If no matching audio exists, it displays an unavailable message; users can explicitly choose the best device voice. This avoids silently falling back to robotic speech or playing an unrelated old headline.

## Editorial workflow

- Free dry run: `python3 scripts/generate_news_audio.py`.
- Optional AI narration with the selected HeyGen Tanguy voice: only with explicit cost approval, configure a server-side `HEYGEN_API_KEY` through your authorized secret manager (ffmpeg required; verify API access and costs with an authorized account holder), never in the website or repository. Run `python3 scripts/generate_news_audio.py --generate` in a private trusted environment. This sends up to five public headline texts and publisher names to the HeyGen speech service; no full articles or visitor data.
- Listen to every MP3, verify pronunciation, exact wording, source attribution and freshness. Only then copy `manifest.review.json` to `manifest.json` and include the corresponding MP3s in an editorially approved publication.
- For human-recorded narration, use the same manifest with MP3s you have permission to publish. The optional intro and outro fields may point to a reviewed Kreol Morisien recording. Do not assume synthetic Kreol pronunciation is accurate.
- MP3 paths must be within news-audio/ and use ASCII letters, digits, underscores or hyphens. Track title, source and category must exactly match the live card. A refreshed or filtered headline without a matching track requires explicit device fallback.
- AI audio must be labeled as AI-generated. No automated publishing or recurring billable jobs are enabled by this branch.

Test on Android Chrome and desktop: play, pause, resume, stop, speed, per-headline selection, missing audio, blocked playback, and changing headlines. Confirm that the live site is unaffected until review and deployment.
