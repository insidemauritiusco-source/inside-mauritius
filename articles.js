/*
  INSIDE MAURITIUS — CONTENT FILE
  Edit the stories below, then upload the updated articles.js to GitHub.
  These are STARTER/INTRODUCTION stories, not live breaking-news reports.
  To publish an actual report, replace the title, summary, content, date and image.

  Each article can have:
    id: unique URL-friendly slug
    category: "Mauritius", "World", "Community" or "Video"
    label: e.g. "EDITORIAL", "EXPLAINER", "NEWS", "BREAKING"
    title, summary, date (YYYY-MM-DD), image, imageAlt, author
    content: array of paragraphs
    video: optional .mp4 URL or YouTube URL (only displayed in article)
  Upload new images or mp4 files next to index.html in your GitHub repository.
*/
window.INSIDE_MAURITIUS_CONFIG = {
  contactEmail: "", // e.g. news@yourdomain.com (only enter an address you own)
  breakingHeadline: "Inside Mauritius is now online — local stories, community voices and world perspectives.",
  breakingIsBreaking: false, // set to true only for verified breaking news
  siteName: "Inside Mauritius"
};

window.INSIDE_MAURITIUS_ARTICLES = [
  {
    id: "welcome-inside-mauritius",
    category: "Mauritius",
    label: "FROM THE EDITOR",
    title: "Welcome to a new chapter for Inside Mauritius",
    summary: "A new space for Mauritius stories, community voices and a wider view of the world.",
    date: "2026-11-05",
    image: "cover-mauritius.svg",
    imageAlt: "Illustrated coastal landscape with Mauritius mountains",
    author: "Inside Mauritius",
    content: [
      "Welcome to Inside Mauritius, a news and stories platform created with our island at its heart.",
      "This website is a place to explore reporting, conversations, videos and updates from Mauritius, alongside developments from the wider world.",
      "Our newsroom is taking shape. New articles and reports will appear here as they are published. Thank you for being part of the journey."
    ]
  },
  {
    id: "mauritius-stories-that-matter",
    category: "Mauritius",
    label: "OUR COVERAGE",
    title: "The Mauritius stories that matter to you",
    summary: "From daily life to national conversations, we want to keep our focus close to home.",
    date: "2026-11-05",
    image: "cover-city.svg",
    imageAlt: "Editorial illustration of a vibrant coastal Mauritius town",
    author: "Inside Mauritius",
    content: [
      "Mauritius is made up of many communities, viewpoints and everyday stories.",
      "Our local coverage will explore public life, development, the environment, business and the people shaping our island.",
      "This introduction explains the topics we intend to cover. It is not a report about a particular event."
    ]
  },
  {
    id: "the-world-in-perspective",
    category: "World",
    label: "WORLD DESK",
    title: "The world in perspective, from Mauritius",
    summary: "A broader view of international developments and the conversations they create.",
    date: "2026-11-05",
    image: "cover-world.svg",
    imageAlt: "Illustration of the globe with orbital lines on a navy background",
    author: "Inside Mauritius",
    content: [
      "What happens beyond our shores can shape how we see the world and our place in it.",
      "The Inside Mauritius world desk is designed to bring international headlines, useful context and diverse perspectives together in one space.",
      "Watch this section for independently prepared updates as the site grows."
    ]
  },
  {
    id: "community-voices",
    category: "Community",
    label: "COMMUNITY",
    title: "Celebrating the voices in our communities",
    summary: "The people, ideas, cultures and moments that make Mauritius unique.",
    date: "2026-11-05",
    image: "cover-community.svg",
    imageAlt: "Colorful illustrated neighborhood and tropical scenery",
    author: "Inside Mauritius",
    content: [
      "Every village, town and neighbourhood has stories worth hearing.",
      "Our community pages aim to make space for local experiences, everyday achievements, cultural life and new ideas.",
      "We hope to share more voices and perspectives from across the island over time."
    ]
  },
  {
    id: "inside-mauritius-video-desk",
    category: "Video",
    label: "VIDEO DESK",
    title: "Introducing the Inside Mauritius video desk",
    summary: "A place for visual reporting, explainers, interviews and on-the-ground stories.",
    date: "2026-11-05",
    image: "cover-video.svg",
    imageAlt: "Stylized video camera and play symbol against an island sunset",
    author: "Inside Mauritius",
    content: [
      "The Inside Mauritius video desk will bring stories to life through interviews, footage, explainers and short-form video coverage.",
      "When a report includes a video, it can be attached directly to its article by adding a video link in the content file.",
      "Video reports will appear here when available."
    ]
  },
  {
    id: "share-your-story",
    category: "Community",
    label: "GET INVOLVED",
    title: "Your story could be part of Inside Mauritius",
    summary: "See something worth sharing? Community information and first-hand perspectives matter.",
    date: "2026-11-05",
    image: "cover-voices.svg",
    imageAlt: "Illustration of conversation speech bubbles and a notebook",
    author: "Inside Mauritius",
    content: [
      "Our aim is to create a useful platform for people who want to stay informed and share what's happening around them.",
      "If you have a story idea, local perspective or a video worth reviewing, look for newsroom contact details on the Contact section of our website.",
      "Please respect the privacy and safety of everyone featured in any material you submit."
    ]
  }
];
