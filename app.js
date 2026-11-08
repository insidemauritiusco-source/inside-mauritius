/* Inside Mauritius: lightweight static-site renderer. No account, server or tracking required. */
(() => {
  "use strict";
  const dashboardPosts = Array.isArray(window.INSIDE_MAURITIUS_NEWSROOM_ARTICLES) ? window.INSIDE_MAURITIUS_NEWSROOM_ARTICLES : [];
  const legacyPosts = Array.isArray(window.INSIDE_MAURITIUS_ARTICLES) ? window.INSIDE_MAURITIUS_ARTICLES : [];
  const tiktokPosts = Array.isArray(window.INSIDE_MAURITIUS_TIKTOK_POSTS) ? window.INSIDE_MAURITIUS_TIKTOK_POSTS : [];
  const validTikTokPosts = tiktokPosts.filter(item => item && typeof item.id === "string" && typeof item.title === "string" && typeof item.date === "string" && (/^https:\/\/www\.tiktok\.com\/@insidemauritius\/video\/\d{12,25}(?:[?#].*)?$/.test(item.tiktokUrl || "") || /^https:\/\/vt\.tiktok\.com\/[A-Za-z0-9_-]{5,32}\/?(?:[?#].*)?$/.test(item.tiktokUrl || "")));
  // Show genuinely newest reports first across editorial stories, TikTok links
  // and source headlines; source publication timestamps are not crawl times.
  // Date-only stories are ordered at midnight Mauritius time without inventing
  // a publication hour. This keeps today's imported news visible at the top.
  function orderingTimestamp(item) {
    const value = typeof item.publishedAt === "string" ? item.publishedAt
      : typeof item.addedAt === "string" ? item.addedAt : item.date;
    if (!value || typeof value !== "string") return 0;
    const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00+04:00" : value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const newestFirst = (a, b) => orderingTimestamp(b) - orderingTimestamp(a);
  const raw = [
    ...legacyPosts,
    ...validTikTokPosts,
    ...dashboardPosts
  ].sort(newestFirst);
  const seenIds = new Set();
  const articles = raw.filter(item => {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
  const config = window.INSIDE_MAURITIUS_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  let filter = "All";
  let query = "";
  let activeStory = null;

  function formatDate(value, long = false) {
    const dt = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:long?"long":"short", year:"numeric", timeZone:"UTC" }).format(dt);
  }
  function formatPublishedAt(value) {
    if (!value || typeof value !== "string") return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Indian/Mauritius"
    }).format(date) + " MUT";
  }
  // Source-feed entries use the original publisher's timestamp; newsroom posts use Inside Mauritius publishing time.
  // Posts without a trustworthy timestamp keep their existing date-only display.
  function displayPostTime(story, long = false) {
    if (story.publishedAt && typeof story.publishedAt === "string") {
      const dt = new Date(story.publishedAt);
      if (!Number.isNaN(dt.getTime())) {
        const timestamp = new Intl.DateTimeFormat("en-GB", {
          day: "numeric", month: long ? "long" : "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false,
          timeZone: "Indian/Mauritius"
        }).format(dt);
        const label = story.id.startsWith("source-") ? "Source" : "Published";
        return label + " · " + timestamp + " MUT";
      }
    }
    if (story.tiktokUrl && typeof story.addedAt === "string") {
      const added = new Date(story.addedAt);
      if (!Number.isNaN(added.getTime())) {
        const timestamp = new Intl.DateTimeFormat("en-GB", {
          day:"numeric",month:long?"long":"short",year:"numeric",
          hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Indian/Mauritius"
        }).format(added);
        return "Added to website · " + timestamp + " MUT (TikTok post time unverified)";
      }
    }
    const dateLabel = formatDate(story.date, long);
    if (!dateLabel) return "Publication date not available";
    if (story.tiktokUrl) return "Video link · " + dateLabel + " · Time not recorded";
    return "Dated " + dateLabel + " · Time not recorded";
  }
  function clockTick() {
    const now = new Date();
    const mauritiusClock = new Intl.DateTimeFormat("en-GB", {timeZone:"Indian/Mauritius",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);
    $("liveClock").textContent = mauritiusClock;
    if ($("newsClock")) $("newsClock").textContent = mauritiusClock;
    const fullDate = new Intl.DateTimeFormat("en-GB", {timeZone:"Indian/Mauritius",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(now);
    $("liveDate").textContent = fullDate;
    if ($("newsDate")) $("newsDate").textContent = fullDate;
    $("todayLine").textContent = fullDate.toUpperCase();
    $("copyrightYear").textContent = new Intl.DateTimeFormat("en-GB",{timeZone:"Indian/Mauritius",year:"numeric"}).format(now);
  }
  function element(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = String(text);
    return e;
  }
  function articleURL(story) { return `#article/${encodeURIComponent(story.id)}`; }
  function imageFor(story) {
    const image = typeof story.image === "string" ? story.image.trim() : "";
    if (image === "cover-government.svg" || (image && !image.startsWith("cover-"))) return image;
    const choices = story.category === "World"
      ? ["cover-world.svg","cover-city.svg"]
      : story.category === "Video"
        ? ["cover-video.svg","cover-voices.svg"]
        : ["cover-mauritius.svg","cover-city.svg","cover-community.svg","cover-voices.svg"];
    const key = String(story.id || story.title || "");
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return choices[hash % choices.length];
  }

  // Website likes are personal to a device; no public totals or TikTok statistics are implied.
  const likeStoragePrefix = "inside-mauritius:liked:";
  const sessionLikes = new Map();
  function isStoryLiked(story) {
    const key = likeStoragePrefix + story.id;
    if (sessionLikes.has(key)) return sessionLikes.get(key);
    try { return window.localStorage.getItem(key) === "1"; }
    catch { return false; }
  }
  function updateLikeControl(button, liked, story) {
    button.setAttribute("aria-pressed", String(liked));
    button.textContent = liked ? "♥ Liked" : "♡ Like";
    button.setAttribute("aria-label", (liked ? "Unlike " : "Like ") + story.title);
  }
  function makeLikeButton(story) {
    const button = element("button", "story-like-button");
    button.type = "button";
    button.dataset.storyId = story.id;
    button.title = "Website like saved on this device only";
    updateLikeControl(button, isStoryLiked(story), story);
    button.addEventListener("click", () => {
      const liked = button.getAttribute("aria-pressed") !== "true";
      const key = likeStoragePrefix + story.id;
      sessionLikes.set(key, liked);
      try {
        if (liked) window.localStorage.setItem(key, "1");
        else window.localStorage.removeItem(key);
      } catch { /* Like still works for this visit if browser storage is blocked. */ }
      document.querySelectorAll(".story-like-button").forEach(other => {
        if (other.dataset.storyId === story.id) updateLikeControl(other, liked, story);
      });
    });
    return button;
  }
  function makeTikTokFollowLink() {
    const link = element("a", "story-tiktok-follow", "Follow on TikTok ↗");
    link.href = "https://www.tiktok.com/@insidemauritius";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Follow Inside Mauritius on TikTok");
    return link;
  }
  function makeStoryCard(story) {
    const card = element("article","story-card");
    // Only explicit editorial flags trigger Breaking News; never infer urgency from a headline.
    const isBreaking = story.breaking === true || story.isBreaking === true;
    if (isBreaking) card.classList.add("is-breaking");
    const imgLink = element("a","story-image-link");
    const isTikTok = typeof story.tiktokUrl === "string" && /^https:\/\/(?:vt\.tiktok\.com|www\.tiktok\.com)\//i.test(story.tiktokUrl);
    imgLink.href = isTikTok ? story.tiktokUrl : articleURL(story);
    imgLink.setAttribute("aria-label", isTikTok ? `Watch TikTok video: ${story.title}` : `Read ${story.title}`);
    if (isTikTok) { imgLink.target="_blank"; imgLink.rel="noopener noreferrer"; imgLink.classList.add("story-video-cover"); }
    const img=element("img","story-image");img.src=imageFor(story);img.alt=story.imageAlt || "Editorial illustration";img.loading="eager";img.width=800;img.height=480;
    img.onerror=()=>{if(!img.src.endsWith("cover-mauritius.svg")) {img.src="cover-mauritius.svg";img.alt="Generic illustration; source photograph unavailable";const credit=card.querySelector(".photo-inline-credit");if(credit)credit.textContent="Illustration displayed · Archive photograph unavailable";}};
    imgLink.append(img,element("span","image-corner",story.label || "INSIDE MAURITIUS"));
    if (isTikTok) {
      const watch=element("span","story-video-play","▶");
      watch.setAttribute("aria-hidden","true");
      imgLink.append(watch,element("span","story-video-label","Watch original on TikTok ↗"));
    }
    if(story.photoSourceUrl && /^https:\/\//i.test(story.photoSourceUrl)) {
      const credit=element("span","photo-inline-credit");
      credit.append(document.createTextNode(story.photoIllustrative === false ? "Source image · " : "Illustrative archive photo · "));
      const source=element("a",null,story.photoAuthor||"Wikimedia Commons");
      source.href=story.photoSourceUrl;source.rel="noopener noreferrer";source.target="_blank";
      credit.append(source);
      if(story.photoLicense && story.photoLicenseUrl) {
        credit.append(document.createTextNode(" · "));
        const license=element("a",null,story.photoLicense);
        license.href=story.photoLicenseUrl;license.rel="noopener noreferrer";license.target="_blank";
        credit.append(license);
      }
      card.append(credit);
    }
    const content=element("div","story-content");
    const meta=element("div","story-meta");
    if (isBreaking) content.append(element("span","breaking-story-badge","BREAKING NEWS"));
    meta.append(element("span","story-category",story.category || "News"));
    const title=element("h3");const titleLink=element("a",null,story.title);titleLink.href=articleURL(story);title.append(titleLink);
    const summary=element("p","story-excerpt",story.summary || "");
    if (!story.summary) summary.hidden = true;
    const bottom=element("div","story-bottom");const read=element("a",null,"Read story");read.href=articleURL(story);read.setAttribute("aria-label",`Read ${story.title}`);
    if (story.sourceUrl && /^https:\/\//i.test(story.sourceUrl)) {
      const original=element("a",null,"Original report · " + (story.sourceName || "Publisher"));
      original.href=story.sourceUrl;
      original.target="_blank";
      original.rel="noopener noreferrer";
      bottom.append(original);
    } else if (isTikTok) {
      const watch=element("a",null,"Watch video on TikTok ↗");
      watch.href=story.tiktokUrl;
      watch.target="_blank";watch.rel="noopener noreferrer";
      bottom.append(watch);
    } else {
      bottom.append(read,element("span","story-arrow","↗"));
    }
    const socialActions = element("div", "story-social-actions");
    socialActions.append(makeLikeButton(story), makeTikTokFollowLink());
    // Always display publication information below the post, not in a tiny top-right label.
    // Missing source time is labelled honestly rather than invented.
    const posted=element("div","story-posted-row");
    const postedLabel=element("span","story-posted-label",story.id.startsWith("source-") ? "SOURCE DATE & TIME" : story.tiktokUrl ? "VIDEO WEBSITE DATE & TIME" : "POST DATE & TIME");
    const postedDate=element("time","story-posted-time",displayPostTime(story));
    postedDate.dateTime=story.publishedAt || story.addedAt || story.date || "";
    posted.append(postedLabel,postedDate);
    content.append(meta,title,summary,bottom,socialActions,posted);card.prepend(imgLink);card.append(content);
    return card;
  }
  function renderTopStories() {
    const section = document.getElementById("topStories");
    const grid = document.getElementById("topStoriesGrid");
    if (!section || !grid) return;
    const latestMauritius = articles.filter(story => story.category === "Mauritius").slice(0, 3);
    section.hidden = latestMauritius.length === 0;
    grid.replaceChildren(...latestMauritius.map(makeStoryCard));
  }
  function renderCards() {
    const key=query.trim().toLocaleLowerCase();
    const matching=articles.filter(story => (filter === "All" || story.category === filter) && (!key || `${story.title} ${story.summary || ""} ${story.category} ${story.label || ""}`.toLocaleLowerCase().includes(key)));
    $("storyGrid").replaceChildren(...matching.map(makeStoryCard));
    renderTopStories();
    $("emptyResults").hidden=matching.length!==0;
    $("resultsNote").textContent = `${matching.length} ${matching.length===1?"story":"stories"} shown`;
    document.querySelectorAll("[data-filter]").forEach(btn=>{const yes=btn.dataset.filter===filter;btn.classList.toggle("selected",yes);btn.setAttribute("aria-pressed",String(yes));});
  }
  function setFilter(value) {
    filter=["All","Mauritius","Government","World","Community","Video"].includes(value)?value:"All";
    renderCards();
  }
  // Compact headlines on the homepage; the full title remains on the article page.
  function compactLeadTitle(value) {
    const title = String(value || "").trim();
    const limit = window.matchMedia("(max-width: 620px)").matches ? 76 : 91;
    if (title.length <= limit) return title;
    const slice = title.slice(0, limit + 1);
    const cut = slice.lastIndexOf(" ");
    return (cut > limit * .65 ? slice.slice(0, cut) : slice.slice(0, limit)).trimEnd() + "…";
  }
  function initFeature() {
    if(!articles.length) return;
    const lead=articles[0];
    $("heroHeading").textContent=compactLeadTitle(lead.heroTitle || lead.title);
    $("heroHeading").title=lead.title;
    document.querySelector(".hero-copy p").textContent=lead.summary;
    document.querySelector(".hero-photo").src=lead.heroImage || imageFor(lead);
    document.querySelector(".hero-photo").alt=lead.heroImageAlt || lead.imageAlt || "Mauritius landscape";
    document.querySelector(".hero-photo").onerror=()=>{const image=document.querySelector(".hero-photo");if(!image.src.endsWith("cover-mauritius.svg")){image.src="cover-mauritius.svg";image.alt="Generic Mauritius illustration";const credit=$("heroFeature").querySelector(".hero-photo-credit");if(credit)credit.textContent="Illustration displayed · Archive photograph unavailable";}};
    document.querySelector(".hero-link").href=articleURL(lead);
    const heroPublished = $("heroPublishedAt");
    if (heroPublished) {
      heroPublished.textContent = displayPostTime(lead);
      heroPublished.dateTime = lead.publishedAt || lead.addedAt || lead.date || "";
    }
    const heroKicker = document.querySelector(".hero-kicker");
    if (heroKicker) heroKicker.textContent = lead.category === "Video" ? "VIDEO SPOTLIGHT" : "INSIDE THE HEADLINES";
    const hero=$("heroFeature");
    const oldCredit=hero.querySelector(".hero-photo-credit");
    if(oldCredit) oldCredit.remove();
    if(lead.photoSourceUrl && /^https:\/\//i.test(lead.photoSourceUrl)) {
      const credit=element("span","hero-photo-credit","Illustrative archive photo · "+(lead.photoAuthor||"Wikimedia Commons")+" · "+(lead.photoLicense||""));
      hero.append(credit);
    }
  }
  function embedVideo(url, parent) {
    if(typeof url!=="string" || !url.trim()) return;
    let parsed;try {parsed=new URL(url,window.location.href)} catch {return;}
    if(parsed.protocol!=="https:" && parsed.origin!==window.location.origin && parsed.protocol!=="file:") return;
    const host=parsed.hostname.toLowerCase();
    if(host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be") {
      let id = host==="youtu.be" ? parsed.pathname.substring(1) : (parsed.searchParams.get("v") || parsed.pathname.split("/").pop());
      if(!/^[a-zA-Z0-9_-]{11}$/.test(id||"")) return;
      const iframe=element("iframe");iframe.src=`https://www.youtube-nocookie.com/embed/${id}`;iframe.title="Inside Mauritius video";iframe.loading="lazy";iframe.allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";iframe.referrerPolicy="strict-origin-when-cross-origin";iframe.allowFullscreen=true;parent.append(iframe);
    } else if (host === "www.tiktok.com" && /^\/@insidemauritius\/video\/\d{12,25}\/?$/.test(parsed.pathname)) {
      // Official TikTok video player; numeric ID is extracted only from the account's public post URL.
      const videoId = parsed.pathname.match(/\/video\/(\d{12,25})\/?$/)[1];
      const frame=element("iframe","tiktok-article-player");
      frame.src="https://www.tiktok.com/player/v1/"+videoId;
      frame.title="Inside Mauritius TikTok news video";
      frame.loading="lazy";
      frame.referrerPolicy="strict-origin-when-cross-origin";
      frame.allow="fullscreen";
      frame.allowFullscreen=true;
      parent.append(frame);
      const original=element("p","article-source");
      const link=element("a",null,"Watch this video on TikTok ↗");
      link.href="https://www.tiktok.com/@insidemauritius/video/"+videoId;
      link.target="_blank";link.rel="noopener noreferrer";
      original.append(link);parent.append(original);
    } else if ((host === "www.facebook.com" || host === "facebook.com") && /^\/share\/v\/[A-Za-z0-9]+\/?$/.test(parsed.pathname)) {
      // Official Facebook video plugin; some videos may not allow embedding.
      // Preserve a direct source link so the original is always accessible.
      const frame=element("iframe","facebook-article-player");
      frame.src="https://www.facebook.com/plugins/video.php?href="+encodeURIComponent(parsed.href)+"&show_text=false&width=560";
      frame.title="Original Facebook news video";
      frame.loading="lazy";
      frame.referrerPolicy="strict-origin-when-cross-origin";
      frame.allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share";
      frame.allowFullscreen=true;
      frame.style.width="100%";
      frame.style.minHeight="315px";
      frame.style.border="0";
      parent.append(frame);
      const notice=element("p","article-source");
      const link=element("a",null,"Watch the original video on Facebook");
      link.href=parsed.href;
      link.target="_blank";
      link.rel="noopener noreferrer";
      notice.append(link);
      parent.append(notice);
    } else if (host === "vt.tiktok.com" && /^\/[A-Za-z0-9_-]{5,32}\/?$/.test(parsed.pathname)) {
      // Short TikTok links do not include the numeric ID required by the official player.
      // Provide a safe, functioning link instead of an empty or broken iframe.
      const notice=element("p","article-source tiktok-shortlink");
      const link=element("a",null,"Watch this video on TikTok ↗");
      link.href=parsed.href;
      link.target="_blank";
      link.rel="noopener noreferrer";
      notice.append(link);
      parent.append(notice);
    } else if (/\.mp4($|\?)/i.test(parsed.pathname+parsed.search) && (parsed.origin===window.location.origin || parsed.protocol==="file:")) {
      const vid=element("video");vid.controls=true;vid.preload="metadata";vid.playsInline=true;
      const source=element("source");source.src=parsed.href;source.type="video/mp4";vid.append(source);parent.append(vid);
    }
  }
  function renderArticle(story) {
    activeStory=story;
    $("homePage").hidden=true;$("articlePage").hidden=false;
    $("articleTopline").textContent=`${(story.category||"News").toUpperCase()} / ${(story.label||"STORY").toUpperCase()}`;
    $("articleTitle").textContent=story.title;
    $("articleDeck").textContent=story.summary||"";
    const byline=$("articleByline");
    const bylineTime=element("time",null,displayPostTime(story,true));
    bylineTime.dateTime=story.publishedAt || story.date || "";
    byline.replaceChildren(element("strong",null,story.author||"Inside Mauritius"),element("span",null,"•"),bylineTime);
    const img=$("articleImage");img.src=imageFor(story);img.alt=story.imageAlt||"Editorial illustration";
    const imageOpen=$("articleImageOpen");
    if (imageOpen) {
      imageOpen.href = story.tiktokUrl || imageFor(story);
      imageOpen.setAttribute("aria-label",story.tiktokUrl ? "Watch original video on TikTok" : "Open full-size article image");
      imageOpen.target="_blank";
      imageOpen.rel="noopener noreferrer";
      imageOpen.title=story.tiktokUrl ? "Watch TikTok video" : "View full image";
    }
    const caption=$("articleCaption");caption.replaceChildren();
    img.onerror=()=>{if(!img.src.endsWith("cover-mauritius.svg")){img.src="cover-mauritius.svg";img.alt="Generic illustration of Mauritius; archive photograph unavailable";caption.textContent="Generic Inside Mauritius illustration. The archive photograph could not be loaded.";}};
    if(story.photoSourceUrl && /^https:\/\//i.test(story.photoSourceUrl)) {
      caption.append(document.createTextNode((story.photoCaption || "Illustrative archive photograph") + " "));
      const credit=element("a",null,"Photo: " + (story.photoAuthor || "Wikimedia Commons"));
      credit.href=story.photoSourceUrl;credit.target="_blank";credit.rel="noopener noreferrer";
      caption.append(credit);
      if(story.photoLicense && story.photoLicenseUrl && /^https:\/\//i.test(story.photoLicenseUrl)) {
        caption.append(document.createTextNode(" · "));
        const licence=element("a",null,story.photoLicense);
        licence.href=story.photoLicenseUrl;licence.target="_blank";licence.rel="noopener noreferrer";
        caption.append(licence);
      }
    } else {
      caption.textContent=story.imageAlt || "Inside Mauritius editorial illustration";
    }
    const body=$("articleBody");body.replaceChildren();
    for(const paragraph of (Array.isArray(story.content)?story.content:[])) if(typeof paragraph==="string" && paragraph.trim()) body.append(element("p",null,paragraph));
    if(typeof story.sourceUrl === "string" && /^https:\/\//i.test(story.sourceUrl)) {
      const sourceLine=element("p","article-source");
      sourceLine.append(document.createTextNode("Original source: "));
      const sourceLink=element("a",null,story.sourceName || "Read source report");
      sourceLink.href=story.sourceUrl;
      sourceLink.target="_blank";
      sourceLink.rel="noopener noreferrer";
      sourceLine.append(sourceLink);
      body.append(sourceLine);
    }
    if(typeof story.sourceUrl2 === "string" && /^https:\/\//i.test(story.sourceUrl2)) {
      const sourceLine2=element("p","article-source");
      sourceLine2.append(document.createTextNode("Second reporting source: "));
      const sourceLink2=element("a",null,story.sourceName2 || "Read second report");
      sourceLink2.href=story.sourceUrl2;
      sourceLink2.target="_blank";
      sourceLink2.rel="noopener noreferrer";
      sourceLine2.append(sourceLink2);
      body.append(sourceLine2);
    }
    embedVideo(story.video,body);
    embedVideo(story.tiktokUrl,body);
    $("shareFeedback").textContent="";
    $("articleSocialActions").replaceChildren(makeLikeButton(story), makeTikTokFollowLink());
    document.title=`${story.title} | Inside Mauritius`;
    window.scrollTo({top:0,behavior:"instant"});
  }
  function updateRoute() {
    const hash=window.location.hash;
    if(hash.startsWith("#article/")) {
      let id="";try{id=decodeURIComponent(hash.slice(9));}catch{};
      const story=articles.find(s=>s.id===id);
      if(story){renderArticle(story);return;}
      window.location.hash="#latest";return;
    }
    activeStory=null;$("homePage").hidden=false;$("articlePage").hidden=true;
    document.title="Inside Mauritius | Local News. Wider Perspective.";
    const target=hash?document.getElementById(hash.substring(1)):null;
    if(target) requestAnimationFrame(()=>target.scrollIntoView({behavior:"smooth",block:"start"}));
    else if(hash==="#home") window.scrollTo({top:0,behavior:"smooth"});
  }
  async function shareArticle() {
    if(!activeStory)return;
    const info={title:activeStory.title,text:activeStory.summary||"Inside Mauritius",url:window.location.href};
    if(navigator.share){try{await navigator.share(info);return;}catch(err){if(err.name==="AbortError")return;}}
    try{await navigator.clipboard.writeText(info.url);$("shareFeedback").textContent="Link copied!";}
    catch {$("shareFeedback").textContent="Copy this address from your browser to share.";}
  }
  function initTicker() {
    const newestSource = dashboardPosts.find(story => story && story.title && story.id);
    if (newestSource) {
      const publisher = (newestSource.sourceName || newestSource.author || "external source").replace(/\\s*\\(via Google News\\)/i, "");
      $("tickerText").textContent = "Latest source headline · " + newestSource.title + " — " + publisher;
      const tickerLink = document.querySelector(".breaking-inner > a");
      if (tickerLink) tickerLink.href = articleURL(newestSource);
    } else if (typeof config.breakingHeadline === "string" && config.breakingHeadline.trim()) {
      $("tickerText").textContent = config.breakingHeadline.trim();
    }
    const label=document.querySelector(".breaking-label");
    if (label && label.lastChild && label.lastChild.nodeType===3) label.lastChild.textContent = config.breakingIsBreaking ? " BREAKING NEWS" : " NEWSROOM";
  }
  function initContacts() {
    const email=typeof config.contactEmail==="string" ? config.contactEmail.trim():"";
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $("contactInfo").textContent=`Email our newsroom at ${email}.`;
      $("contactAction").href=`mailto:${email}?subject=Story%20tip%20for%20Inside%20Mauritius`;
      $("contactAction").hidden=false;
    }
  }
  function init() {
    clockTick();window.setInterval(clockTick,1000);
    initFeature();renderCards();initContacts();initTicker();
    $("filterList").addEventListener("click",event=>{const btn=event.target.closest("[data-filter]");if(btn)setFilter(btn.dataset.filter);});
    $("storySearch").addEventListener("input",event=>{query=event.target.value;renderCards();});
    $("resetFilters").addEventListener("click",()=>{query="";$("storySearch").value="";setFilter("All");});
    document.querySelectorAll("[data-filter-nav]").forEach(link=>link.addEventListener("click",()=>setFilter(link.dataset.filterNav)));
    const menu=$("menuToggle");const nav=$("primaryNav");
    menu.addEventListener("click",()=>{const isOpen=menu.getAttribute("aria-expanded")==="true";menu.setAttribute("aria-expanded",String(!isOpen));nav.classList.toggle("is-open",!isOpen);});
    nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{menu.setAttribute("aria-expanded","false");nav.classList.remove("is-open");}));
    document.addEventListener("keydown",evt=>{if(evt.key==="Escape"){menu.setAttribute("aria-expanded","false");nav.classList.remove("is-open");}});
    $("shareStory").addEventListener("click",shareArticle);
    window.addEventListener("hashchange",updateRoute);updateRoute();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);else init();
})();
