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
  const recordingMap = new Map(recordings.filter(r => r && ((r.approved === true && r.voice === "Tanguy") || (r.generated === true && r.engine === "Kokoro" && ["ff_siwis","bm_george"].includes(r.voice) && /^audio\/headline-[a-f0-9]{32}\.mp3$/.test(r.audioUrl))) && typeof r.title === "string" && cleanUrl(r.sourceUrl) &&
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

  // V3: one native audio player, source-linked queue, no autoplay on arrival.
  const queueAudio = $("v3QueueAudio");
  const queueStatus = $("v3QueueStatus");
  let queue = [], queueIndex = 0, queueToken = 0;
  function clearQueue() {
    queueToken++; queue = []; queueIndex = 0;
    queueAudio.pause(); queueAudio.removeAttribute("src"); queueAudio.load();
    queueStatus.textContent = "Playlist stopped.";
  }
  async function playQueue(index) {
    if (index >= queue.length) { clearQueue(); queueStatus.textContent = "Playlist completed."; return; }
    queueIndex = index;
    const token = ++queueToken;
    const entry = queue[index];
    queueAudio.src = entry.url;
    queueStatus.textContent = (index+1) + " / " + queue.length + " · " + entry.title;
    try {
      if ("mediaSession" in navigator && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({title:entry.title,artist:"Inside Mauritius · AI audio"});
      }
      await queueAudio.play();
    } catch (_) {
      if (token === queueToken) queueStatus.textContent = "Tap Play to continue. Audio may be unavailable.";
    }
  }
  function startQueue(items) {
    clearQueue(); queue = items;
    if (!queue.length) { queueStatus.textContent = "No matching recordings available."; return; }
    playQueue(0);
  }
  $("v3ListenAll").addEventListener("click", () => {
    const lang = $("v3Language").value;
    startQueue(entries.filter(item => category === "All" || item.category === category)
      .filter(item => !query || (item.title+" "+item.source+" "+item.summary).toLowerCase().includes(query))
      .map(item => ({item,record:recordingMap.get(JSON.stringify([item.url,item.title])),url:recordingFor(item)}))
      .filter(x => x.url && (lang === "all" || x.record?.language === lang))
      .map(x => ({title:x.item.title,url:x.url})));
  });
  $("v3Next").addEventListener("click", () => {if(queue.length) playQueue(queueIndex+1);});
  $("v3Stop").addEventListener("click", clearQueue);
  queueAudio.addEventListener("ended", () => {if(queue.length) playQueue(queueIndex+1);});
  queueAudio.addEventListener("error", () => {if(queue.length) queueStatus.textContent="Recording failed. Choose Next or Stop.";});
  document.addEventListener("play", e => {
    if(e.target.tagName === "AUDIO" && e.target !== queueAudio && queue.length) clearQueue();
  },true);
  document.addEventListener("im:read-headline",clearQueue);
  $("readRoundup")?.addEventListener("click",clearQueue);
  window.addEventListener("pagehide",clearQueue);
  const bulletinList = $("v3Bulletins");
  const bulletins = Array.isArray(window.INSIDE_MAURITIUS_AUDIO_BULLETINS) ? window.INSIDE_MAURITIUS_AUDIO_BULLETINS : [];
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Indian/Mauritius",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  for (const b of bulletins.filter(b => /^audio\/bulletin-(morning|evening)-\d{4}-\d{2}-\d{2}\.mp3$/.test(b.audioUrl)).sort((a,b)=>b.date.localeCompare(a.date)||b.edition.localeCompare(a.edition)).slice(0,4)) {
    const button = node("button","listen-headline",b.date+" · "+b.edition+" headline roundup"+(b.retrospective?" (retrospective)":""));
    button.type="button";button.addEventListener("click",()=>startQueue([{title:button.textContent,url:b.audioUrl}]));
    bulletinList.append(button);
  }
  if(!bulletinList.children.length) bulletinList.textContent="No generated roundups yet.";

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
    const recording = recordingMap.get(JSON.stringify([item.url, item.title]));
    const notice = node("p","reader-note",audioUrl
      ? (recording.engine === "Kokoro" ? "Kokoro AI voice · " + (recording.language === "fr" ? "French" : "English") : "Approved recording · HeyGen Tanguy (AI voice)")
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
      const stopAudio = node("button","listen-headline","■ Stop audio");
      stopAudio.type = "button";
      stopAudio.setAttribute("aria-label","Stop audio");
      stopAudio.addEventListener("click", () => { audio.pause(); audio.currentTime = 0; });
      card.append(audio,stopAudio);
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
      notice.textContent = "Using your device voice, not the generated recording. Pause and stop are in the audio section above.";
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
    if (currentAudio !== queueAudio) stopNatural();
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