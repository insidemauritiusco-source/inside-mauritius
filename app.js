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
    if ($("dashboardClock")) $("dashboardClock").textContent = mauritiusClock;
    if ($("dashboardDate")) $("dashboardDate").textContent = fullDate;
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
  function storyLink(story) {
    const relative=articleURL(story);
    return window.location.origin + window.location.pathname + relative;
  }
  async function shareStoryLink(story, feedback) {
    const url=storyLink(story);
    const data={title:story.title,text:story.summary || "Inside Mauritius News",url};
    if (navigator.share) {
      try { await navigator.share(data);if(feedback) feedback.textContent="Shared!";return; }
      catch(err) { if(err && err.name==="AbortError")return; }
    }
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if(feedback) feedback.textContent="Link copied!";
    } catch {
      if(feedback) feedback.textContent="Open the article and copy its URL to share.";
    }
  }
  function makeShareButton(story) {
    const button=element("button","story-share-button","↗ Share");
    button.type="button";
    button.setAttribute("aria-label","Share: "+story.title);
    const feedback=element("span","story-share-feedback");
    feedback.setAttribute("role","status");
    button.addEventListener("click",()=>shareStoryLink(story,feedback));
    const wrap=element("span","story-share-wrap");
    wrap.append(button,feedback);
    return wrap;
  }
  function makeFeatureHeadlineCard(story,index) {
    const card=element("article","feature-headline-card");
    const imageLink=element("a","feature-headline-image");
    imageLink.href=articleURL(story);
    imageLink.setAttribute("aria-label","Read "+story.title);
    const img=element("img");
    img.src=imageFor(story);
    img.loading="lazy";
    img.alt=story.imageAlt || "Editorial news image";
    img.referrerPolicy="no-referrer";
    img.onerror=()=>{if(img.getAttribute("src")!=="cover-mauritius.svg")img.src="cover-mauritius.svg";};
    imageLink.append(img);
    const body=element("div","feature-headline-copy");
    const cat=element("span","feature-headline-category",story.category || "News");
    const title=element("h3");
    const a=element("a",null,story.heroTitle || story.title);
    a.href=articleURL(story);
    title.append(a);
    const time=element("time","feature-headline-date",displayPostTime(story));
    time.dateTime=story.publishedAt || story.addedAt || story.date || "";
    body.append(cat,title,time);
    card.append(imageLink,body);
    if(index===0)card.classList.add("feature-headline-card-primary");
    return card;
  }
  function renderFeatureHeadlines() {
    const grid=$("featureHeadlines");
    if(!grid)return;
    const list=articles.filter(item=>item && item.title && item.id && item.id!==articles[0]?.id).slice(0,3);
    if(!list.length){grid.replaceChildren(element("p","feature-loading","No additional headlines available."));return;}
    grid.replaceChildren(...list.map(makeFeatureHeadlineCard));
  }
  function renderHeadlineStripe() {
    const strip=$("headlineStripe");
    if(!strip)return;
    const stories=articles.filter(item=>item && item.title && item.id).slice(0,3);
    strip.replaceChildren(...stories.map(item=>{
      const a=element("a","headline-stripe-item");
      a.href=articleURL(item);
      const category=element("span","headline-stripe-category",(item.category || "News").toUpperCase());
      const title=element("strong",null,item.heroTitle || item.title);
      const when=element("small",null,displayPostTime(item));
      a.append(category,title,when);
      return a;
    }));
  }
  function makeTikTokFollowLink() {
    const link = element("a", "story-tiktok-follow", "Follow on TikTok ↗");
    link.href = "https://www.tiktok.com/@insidemauritius";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Follow Inside Mauritius on TikTok");
    return link;
  }
  function makeStoryCard(story, isAboveFold = false) {
    const card = element("article","story-card");
    // Preserve full Radio Mo Pep photo-collage previews rather than cropping them.
    if (/radio mo pep/i.test(story.sourceName || "")) card.classList.add("source-radio-mo-pep");
    // Only explicit editorial flags trigger Breaking News; never infer urgency from a headline.
    const isBreaking = story.breaking === true || story.isBreaking === true;
    if (isBreaking) card.classList.add("is-breaking");
    const imgLink = element("a","story-image-link");
    const isTikTok = typeof story.tiktokUrl === "string" && /^https:\/\/(?:vt\.tiktok\.com|www\.tiktok\.com)\//i.test(story.tiktokUrl);
    const isArchivePhoto = story.category === "Government" && typeof story.photoSourceUrl === "string" && /^https:\/\/commons\.wikimedia\.org\/wiki\//i.test(story.photoSourceUrl);
    imgLink.href = isTikTok ? story.tiktokUrl : isArchivePhoto ? story.photoSourceUrl : articleURL(story);
    imgLink.setAttribute("aria-label", isTikTok ? `Watch TikTok video: ${story.title}` : isArchivePhoto ? `Open original archive photograph for: ${story.title}` : `Read ${story.title}`);
    if (isTikTok || isArchivePhoto) { imgLink.target="_blank"; imgLink.rel="noopener noreferrer"; }
    if (isTikTok) imgLink.classList.add("story-video-cover");
    if (isArchivePhoto) imgLink.classList.add("government-photo-link");
    const img=element("img","story-image");img.src=imageFor(story);img.alt=story.imageAlt || "Editorial illustration";img.loading=isAboveFold?"eager":"lazy";img.decoding="async";img.width=800;img.height=480;
    if (isArchivePhoto) img.referrerPolicy="no-referrer";
    img.onerror=()=>{
      const fallback=story.category === "Government" ? "cover-government.svg" : "cover-mauritius.svg";
      if (img.getAttribute("src") === fallback) return;
      img.src=fallback;
      img.alt=story.category === "Government" ? "Inside Mauritius government news illustration; external archive photo could not be loaded" : "Inside Mauritius illustration; source image unavailable";
      if (story.category === "Government") {
        const notice=element("span","photo-fallback-note","Photo unavailable here. Tap to view the original ↗");
        imgLink.append(notice);
        card.classList.add("photo-fallback-used");
      }
    };
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
    socialActions.append(makeLikeButton(story), makeTikTokFollowLink(), makeShareButton(story));
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
    $("storyGrid").replaceChildren(...matching.map((story,index)=>makeStoryCard(story,index<4)));
    renderTopStories();
    $("emptyResults").hidden=matching.length!==0;
    $("resultsNote").textContent = `${matching.length} ${matching.length===1?"story":"stories"} shown`;
    // Hide the server-delivered fallback only after the interactive cards render successfully.
    const staticFallback=$("newsStaticFallback");
    if(staticFallback)staticFallback.hidden=true;
    document.querySelectorAll("[data-filter]").forEach(btn=>{const yes=btn.dataset.filter===filter;btn.classList.toggle("selected",yes);btn.setAttribute("aria-pressed",String(yes));});
  }
  // Real article headlines only. No invented AI summaries or false recency claims.
  function renderDashboardHeadlines() {
    const list=$("dashboardHeadlines");
    if (!list) return;
    const items=articles.filter(item => item && item.title && item.date).slice(0,5);
    if (!items.length) {
      list.replaceChildren(element("li",null,"No published headlines available."));
      return;
    }
    const nodes=items.map(item => {
      const li=element("li");
      const link=element("a",null,compactLeadTitle(item.title));
      link.href=articleURL(item);
      const type=element("span","dashboard-headline-type",(item.category || "News").toUpperCase());
      const when=element("span","dashboard-headline-time",displayPostTime(item));
      li.append(type,link,when);
      return li;
    });
    list.replaceChildren(...nodes);
  }
  function setFilter(value) {
    filter=["All","Mauritius","Government","World","Community","Video"].includes(value)?value:"All";
    renderCards();
  }
  // Never truncate a sourced headline; CSS lets the card grow to fit it.
  function compactLeadTitle(value) {
    return String(value || "").trim();
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
      // Some browsers block embedded players. Keep an accessible original link.
      const original=element("p","article-source media-source-link");
      const link=element("a",null,"Watch the original video on YouTube ↗");
      link.href=`https://www.youtube.com/watch?v=${id}`;
      link.target="_blank";link.rel="noopener noreferrer";
      original.append(link);parent.append(original);
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
      const notice=element("p","article-source media-source-link");
      const link=element("a",null,"Open original MP4 video ↗");
      link.href=parsed.href;link.target="_blank";link.rel="noopener noreferrer";
      notice.append(link);
      vid.addEventListener("error",()=>{notice.prepend(document.createTextNode("Video could not play in this browser. "));},{once:true});
      parent.append(notice);
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
      imageOpen.href = story.tiktokUrl || (story.category === "Government" && story.photoSourceUrl ? story.photoSourceUrl : imageFor(story));
      imageOpen.setAttribute("aria-label",story.tiktokUrl ? "Watch original video on TikTok" : story.category === "Government" && story.photoSourceUrl ? "Open original government archive photo on Wikimedia Commons" : "Open full-size article image");
      imageOpen.target="_blank";
      imageOpen.rel="noopener noreferrer";
      imageOpen.title=story.tiktokUrl ? "Watch TikTok video" : "View full image";
    }
    const caption=$("articleCaption");caption.replaceChildren();
    if (story.category === "Government" && story.photoSourceUrl) img.referrerPolicy="no-referrer";
    img.onerror=()=>{
      const fallback=story.category === "Government" ? "cover-government.svg" : "cover-mauritius.svg";
      if(img.getAttribute("src")===fallback) return;
      img.src=fallback;
      img.alt=story.category === "Government" ? "Government News illustration; archive photograph unavailable on this device" : "Inside Mauritius illustration; photo unavailable";
      if(story.category === "Government" && /^https:\/\//.test(story.photoSourceUrl || "")) {
        const notice=element("span","photo-fallback-article","Photograph unavailable on this page. ");
        const link=element("a",null,"Open original photo on Wikimedia Commons ↗");
        link.href=story.photoSourceUrl;link.target="_blank";link.rel="noopener noreferrer";
        notice.append(link,document.createTextNode(" · "));
        caption.prepend(notice);
      } else caption.textContent="Inside Mauritius illustration shown because the photograph could not load.";
    };
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
    initFeature();renderFeatureHeadlines();renderHeadlineStripe();renderCards();renderDashboardHeadlines();initContacts();initTicker();
    const heroShare=$("heroShareButton");
    if (heroShare && articles[0]) heroShare.addEventListener("click",()=>shareStoryLink(articles[0],$("heroShareStatus")));
    $("filterList").addEventListener("click",event=>{const btn=event.target.closest("[data-filter]");if(btn)setFilter(btn.dataset.filter);});
    $("storySearch").addEventListener("input",event=>{query=event.target.value;renderCards();});
    $("resetFilters").addEventListener("click",()=>{query="";$("storySearch").value="";setFilter("All");});
    document.querySelectorAll("[data-filter-nav]").forEach(link=>link.addEventListener("click",()=>setFilter(link.dataset.filterNav)));
    const menu=$("menuToggle");const nav=$("primaryNav");
    const closeMenu=(restoreFocus=false)=>{
      const wasOpen=menu.getAttribute("aria-expanded")==="true";
      menu.setAttribute("aria-expanded","false");
      menu.setAttribute("aria-label","Open navigation");
      nav.classList.remove("is-open");
      if(wasOpen && restoreFocus)menu.focus();
    };
    menu.setAttribute("aria-label","Open navigation");
    menu.addEventListener("click",()=>{
      const shouldOpen=menu.getAttribute("aria-expanded")!=="true";
      menu.setAttribute("aria-expanded",String(shouldOpen));
      menu.setAttribute("aria-label",shouldOpen?"Close navigation":"Open navigation");
      nav.classList.toggle("is-open",shouldOpen);
    });
    nav.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>closeMenu()));
    document.addEventListener("keydown",evt=>{if(evt.key==="Escape")closeMenu(true);});
    document.addEventListener("pointerdown",evt=>{
      if(menu.getAttribute("aria-expanded")==="true" && !nav.contains(evt.target) && !menu.contains(evt.target))closeMenu();
    });
    window.addEventListener("resize",()=>{if(window.innerWidth>820)closeMenu();});
    $("shareStory").addEventListener("click",shareArticle);
    window.addEventListener("hashchange",updateRoute);updateRoute();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);else init();
})();
