/* Inside Mauritius — sourced news updates hub. No artificial live claims. */
(() => {
  "use strict";

  const local = Array.isArray(window.INSIDE_MAURITIUS_NEWSROOM_ARTICLES)
    ? window.INSIDE_MAURITIUS_NEWSROOM_ARTICLES : [];
  const world = Array.isArray(window.INSIDE_MAURITIUS_WORLD_NEWS?.headlines)
    ? window.INSIDE_MAURITIUS_WORLD_NEWS.headlines : [];

  function cleanUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : null;
    } catch (_) { return null; }
  }
  function parseDate(value) {
    if (typeof value !== "string" || !value) return NaN;
    const stamp = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value + "T00:00:00+04:00" : value;
    const millis = Date.parse(stamp);
    return Number.isFinite(millis) ? millis : NaN;
  }
  function formatWhen(value) {
    const millis = parseDate(value);
    if (!Number.isFinite(millis)) return "Source time not available";
    const hasTime = !/^\d{4}-\d{2}-\d{2}$/.test(value);
    const options = {day:"numeric",month:"short",year:"numeric",timeZone:"Indian/Mauritius"};
    if (hasTime) Object.assign(options,{hour:"2-digit",minute:"2-digit",hour12:false});
    return new Intl.DateTimeFormat("en-GB",options).format(new Date(millis)) + (hasTime ? " MUT" : " · time not recorded");
  }

  const entries = [];
  const seen = new Set();
  function register(entry) {
    if (!entry.title || !entry.url || seen.has(entry.url)) return;
    seen.add(entry.url);
    entries.push(entry);
  }
  for (const item of local) {
    if (!item || typeof item !== "object") continue;
    const target = cleanUrl(item.sourceUrl)
      || cleanUrl(item.videoUrl)
      || cleanUrl(item.tiktokUrl);
    if (!target) continue;
    register({
      title: typeof item.title === "string" ? item.title : "",
      source: String(item.sourceName || item.author || "External publisher").replace(/ \(external report\)$/, ""),
      category: item.category === "Video" ? "Video" : item.category === "World" ? "World" : "Mauritius",
      summary: typeof item.summary === "string" ? item.summary : "",
      when: item.publishedAt || item.date || "",
      url: target,
      stamp: parseDate(item.publishedAt || item.date)
    });
  }
  for (const item of world) {
    if (!item || typeof item !== "object") continue;
    register({
      title: typeof item.title === "string" ? item.title : "",
      source: String(item.source || "External publisher"),
      category: "World",
      summary: item.region ? "International report · " + String(item.region) : "",
      when: item.publishedAt || "",
      url: cleanUrl(item.url),
      stamp: parseDate(item.publishedAt)
    });
  }
  entries.sort((a,b) => (Number.isFinite(b.stamp) ? b.stamp : 0) -
    (Number.isFinite(a.stamp) ? a.stamp : 0));

  const $ = id => document.getElementById(id);
  const grid = $("headlineGrid");
  const status = $("feedStatus");
  const more = $("moreButton");
  const search = $("headlineSearch");
  const categories = $("categoryControls");
  let category = "All";
  let query = "";
  let visible = 12;

  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }

  // Approved, title-matched recordings only. Never silently substitute device TTS.
  const recordings = Array.isArray(window.INSIDE_MAURITIUS_HEADLINE_AUDIO)
    ? window.INSIDE_MAURITIUS_HEADLINE_AUDIO : [];
  const recordingMap = new Map(recordings.filter(r => r && r.approved === true &&
    r.voice === "Tanguy" && typeof r.title === "string" && cleanUrl(r.sourceUrl) &&
    typeof r.audioUrl === "string").map(r => [JSON.stringify([cleanUrl(r.sourceUrl), r.title]), r]));
  function recordingFor(item) {
    const record = recordingMap.get(JSON.stringify([item.url, item.title]));
    if (!record) return null;
    // Audio is either an HTTPS URL or a locally hosted audio file, never executable content.
    if (/^audio\/[a-zA-Z0-9_-]+\.(mp3|wav)$/.test(record.audioUrl)) return record.audioUrl;
    return cleanUrl(record.audioUrl);
  }
  let currentAudio = null;
  document.addEventListener("play", event => {
    if (event.target.tagName !== "AUDIO") return;
    document.querySelectorAll("audio").forEach(a => { if (a !== event.target) a.pause(); });
    $("stopReader")?.click();
    currentAudio = event.target;
  }, true);
  function stopNatural() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  }
  document.addEventListener("im:read-headline", stopNatural);
  $("readRoundup")?.addEventListener("click", stopNatural);
  window.addEventListener("pagehide", stopNatural);

  function makeCard(item) {
    const card = node("article", "news-card");
    const meta = node("span", "meta", item.category + " · " + item.source);
    const h = node("h3", "", item.title);
    const time = node("time", "", "Source · " + formatWhen(item.when));
    if (Number.isFinite(item.stamp)) time.dateTime =
      new Date(item.stamp).toISOString();
    card.append(meta,h);
    if (item.summary) card.append(node("p", "", item.summary));
    const link = node("a", "", item.category === "Video" ? "Watch original video ↗" : "Read original report ↗");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(time,link);
    const audioUrl = recordingFor(item);
    const notice = node("p","reader-note",audioUrl
      ? "Approved recording · HeyGen Tanguy (AI voice)"
      : "Natural voice recording not available yet.");
    notice.setAttribute("role","status");
    if (audioUrl) {
      const audio = node("audio","");
      audio.controls = true;
      audio.preload = "none";
      audio.style.width = "100%";
      audio.setAttribute("aria-label","Listen to headline: " + item.title);
      audio.src = audioUrl;
      audio.addEventListener("error", () => {
        notice.textContent = "Recording unavailable. Please try again later or choose the optional device voice.";
      });
      card.append(audio);
    }
    card.append(notice);
    const listen = node("button","listen-headline","🔊 Optional device voice");
    listen.type = "button";
    listen.setAttribute("aria-label","Read with device voice: " + item.title);
    listen.addEventListener("click", () => {
      stopNatural();
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
        notice.textContent = "Device speech is not supported in this browser.";
        return;
      }
      $("creoleNewsReader")?.querySelector("details")?.setAttribute("open","");
      notice.textContent = "Using your device voice, not the Tanguy recording. Pause and stop are in the audio section above.";
      document.dispatchEvent(new CustomEvent("im:read-headline",{
        detail:{ title:item.title, source:item.source, category:item.category }
      }));
    });
    card.append(listen);
    return card;
  }
  function render() {
    const matching = entries.filter(x =>
      (category === "All" || x.category === category) &&
      (!query || (x.title + " " + x.source + " " + x.summary).toLowerCase().includes(query))
    );
    stopNatural();
    grid.replaceChildren();
    matching.slice(0,visible).forEach(x => grid.append(makeCard(x)));
    if (!matching.length) grid.append(node("p","empty","No source reports match your search. Try another category or keyword."));
    more.hidden = matching.length <= visible;
    status.textContent = "Showing " + Math.min(visible,matching.length) + " of " +
      matching.length + " matching source-linked reports · Latest stored feed files, not a real-time broadcast.";
  }

  categories.addEventListener("click", event => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    category = button.dataset.category;
    visible = 12;
    categories.querySelectorAll("button[data-category]").forEach(item =>
      item.setAttribute("aria-pressed",String(item === button)));
    render();
  });
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    visible = 12;
    render();
  });
  more.addEventListener("click", () => {
    visible += 12;
    render();
  });
  $("refreshButton").addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.set("refresh", String(Date.now()));
    location.replace(url.href);
  });

  function clock() {
    $("mauritiusClock").textContent = new Intl.DateTimeFormat("en-GB", {
      timeZone:"Indian/Mauritius",weekday:"short",day:"numeric",month:"short",
      year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false
    }).format(new Date()) + " MUT";
  }
  clock();
  setInterval(clock,1000);
  $("storyCount").textContent = String(entries.length);
  $("sourceCount").textContent = String(new Set(entries.map(x => x.source)).size);
  $("newestArticle").textContent = entries.length ? formatWhen(entries[0].when) : "No source data";
  render();
})();