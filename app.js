/* Inside Mauritius: lightweight static-site renderer. No account, server or tracking required. */
(() => {
  "use strict";
  const raw = Array.isArray(window.INSIDE_MAURITIUS_ARTICLES) ? window.INSIDE_MAURITIUS_ARTICLES : [];
  const articles = raw.filter(item => item && typeof item.id === "string" && typeof item.title === "string");
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
  function clockTick() {
    const now = new Date();
    $("liveClock").textContent = new Intl.DateTimeFormat("en-GB", {timeZone:"Indian/Mauritius",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);
    const fullDate = new Intl.DateTimeFormat("en-GB", {timeZone:"Indian/Mauritius",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(now);
    $("liveDate").textContent = fullDate;
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
  function imageFor(story) { return (typeof story.image === "string" && story.image.trim()) ? story.image : "cover-mauritius.svg"; }
  function makeStoryCard(story) {
    const card = element("article","story-card");
    const imgLink = element("a","story-image-link");imgLink.href=articleURL(story);imgLink.setAttribute("aria-label",`Read ${story.title}`);
    const img=element("img","story-image");img.src=imageFor(story);img.alt=story.imageAlt || "Editorial illustration";img.loading="eager";img.width=800;img.height=480;
    img.onerror=()=>{if(!img.src.endsWith("cover-mauritius.svg")) {img.src="cover-mauritius.svg";img.alt="Generic illustration of Mauritius; requested archive photograph could not load";const credit=card.querySelector(".photo-inline-credit");if(credit)credit.textContent="Illustration displayed · Archive photograph unavailable";}};
    imgLink.append(img,element("span","image-corner",story.label || "INSIDE MAURITIUS"));
    if(story.photoSourceUrl && /^https:\/\//i.test(story.photoSourceUrl)) {
      const credit=element("span","photo-inline-credit");
      credit.append(document.createTextNode("Illustrative archive photo · "));
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
    const meta=element("div","story-meta");meta.append(element("span","story-category",story.category || "News"),element("time","story-date",formatDate(story.date)));
    const title=element("h3");const titleLink=element("a",null,story.title);titleLink.href=articleURL(story);title.append(titleLink);
    const summary=element("p","story-excerpt",story.summary || "");
    const bottom=element("div","story-bottom");const read=element("a",null,"Read story");read.href=articleURL(story);read.setAttribute("aria-label",`Read ${story.title}`);
    bottom.append(read,element("span","story-arrow","↗"));content.append(meta,title,summary,bottom);card.prepend(imgLink);card.append(content);
    return card;
  }
  function renderCards() {
    const key=query.trim().toLocaleLowerCase();
    const matching=articles.filter(story => (filter === "All" || story.category === filter) && (!key || `${story.title} ${story.summary || ""} ${story.category} ${story.label || ""}`.toLocaleLowerCase().includes(key)));
    $("storyGrid").replaceChildren(...matching.map(makeStoryCard));
    $("emptyResults").hidden=matching.length!==0;
    $("resultsNote").textContent = `${matching.length} ${matching.length===1?"story":"stories"} shown`;
    document.querySelectorAll("[data-filter]").forEach(btn=>{const yes=btn.dataset.filter===filter;btn.classList.toggle("selected",yes);btn.setAttribute("aria-pressed",String(yes));});
  }
  function setFilter(value) {
    filter=["All","Mauritius","World","Community","Video"].includes(value)?value:"All";
    renderCards();
  }
  function initFeature() {
    if(!articles.length) return;
    const lead=articles[0];
    $("heroHeading").textContent=lead.title;
    document.querySelector(".hero-copy p").textContent=lead.summary;
    document.querySelector(".hero-photo").src=imageFor(lead);
    document.querySelector(".hero-photo").alt=lead.imageAlt || "Mauritius landscape";
    document.querySelector(".hero-photo").onerror=()=>{const image=document.querySelector(".hero-photo");if(!image.src.endsWith("cover-mauritius.svg")){image.src="cover-mauritius.svg";image.alt="Generic Mauritius illustration";const credit=$("heroFeature").querySelector(".hero-photo-credit");if(credit)credit.textContent="Illustration displayed · Archive photograph unavailable";}};
    document.querySelector(".hero-link").href=articleURL(lead);
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
    const byline=$("articleByline");byline.replaceChildren(element("strong",null,story.author||"Inside Mauritius"),element("span",null,"•"),element("time",null,formatDate(story.date,true)));
    const img=$("articleImage");img.src=imageFor(story);img.alt=story.imageAlt||"Editorial illustration";
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
    embedVideo(story.video,body);
    $("shareFeedback").textContent="";
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
    if (typeof config.breakingHeadline === "string" && config.breakingHeadline.trim()) $("tickerText").textContent = config.breakingHeadline.trim();
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
