/* Inside Mauritius: device-based spoken headline reader.
   Native speech synthesis only: no API, remote narration, or fake translation. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const play = $("readRoundup");
  const pause = $("pauseReader");
  const stop = $("stopReader");
  const speed = $("readerSpeed");
  const voiceSelect = $("readerVoice");
  const status = $("readerStatus");
  if (!play || !pause || !stop || !speed || !voiceSelect || !status) return;
  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  if (!synth || !Utterance) {
    play.disabled = true;
    status.textContent = "Speech is not supported by this browser. Try Chrome or install a text-to-speech engine on Android.";
    return;
  }
  const voices = () => synth.getVoices();
  let pieces = [];
  let position = 0;
  let session = 0;
  let active = false;
  let paused = false;
  let mode = "roundup";
  function selectedVoice() {
    return voices().find(v => v.voiceURI === voiceSelect.value) || null;
  }
  function suitableVoice(lang) {
    const manual = selectedVoice();
    if (manual) return manual;
    const available = voices();
    const start = lang === "mfe-MU" ? "mfe" : lang === "fr-FR" ? "fr" : "en";
    return available.find(v => (v.lang || "").toLowerCase().startsWith(start))
      || (lang === "mfe-MU" ? available.find(v => (v.lang || "").toLowerCase().startsWith("fr")) : null)
      || null;
  }
  function populateVoices() {
    const previous = voiceSelect.value;
    voiceSelect.replaceChildren(new Option("Automatic (device voice)",""));
    voices().forEach(v => voiceSelect.add(new Option(v.name+" ("+v.lang+")",v.voiceURI)));
    if (voices().some(v => v.voiceURI === previous)) voiceSelect.value = previous;
  }
  populateVoices();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", populateVoices);
  else synth.onvoiceschanged = populateVoices;
  function buttons() {
    play.textContent = active ? "↻ Rekoumanse" : "▶ Ekout bann tit";
    pause.textContent = paused ? "▶ Continue" : "⏸ Pause";
    pause.disabled = !active;
    stop.disabled = !active;
  }
  function cancel() {
    session += 1;
    active = false; paused = false;
    position = 0; pieces = [];
    synth.cancel();
    buttons();
  }
  function fragment(text, lang) {
    const cleaned = String(text || "").replace(/\s+/g," ").trim();
    if (!cleaned) return [];
    const chunks = cleaned.match(/.{1,145}(?:\s|$)/g) || [cleaned];
    return chunks.map(value => ({text:value.trim(),lang}));
  }
  function makeItem(title, source, category) {
    const intro = category === "World" ? "Nouvel dan lemond." : category === "Video" ? "Nouvel video." : "Nouvel Moris.";
    return [
      ...fragment(intro,"mfe-MU"),
      ...fragment(title,"auto"),
      ...fragment("Source: " + source + ".","auto")
    ];
  }
  function automaticLanguage(text) {
    // No automatic translation: English/French voices only approximate source text.
    return /\b(le|la|les|des|une|dans|pour|avec|sur|du|aux)\b/i.test(text)
      ? "fr-FR" : "en-GB";
  }
  function speakNext(mySession) {
    if (!active || paused || mySession !== session) return;
    if (position >= pieces.length) {
      cancel();
      status.textContent = "Lektir termine. All headlines have been read.";
      return;
    }
    const entry = pieces[position++];
    const utterance = new Utterance(entry.text);
    utterance.rate = Number(speed.value) || 1;
    const language = entry.lang === "auto" ? automaticLanguage(entry.text) : entry.lang;
    utterance.lang = language;
    const chosen = suitableVoice(language);
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }
    utterance.onend = () => speakNext(mySession);
    utterance.onerror = event => {
      if (mySession !== session || !active) return;
      if (event.error === "canceled" || event.error === "interrupted") return;
      cancel();
      status.textContent = event.error === "not-allowed"
        ? "Audio blocked. Tap Listen directly to allow speech playback."
        : "Speech could not start on this device. Check Android text-to-speech settings.";
    };
    try { synth.speak(utterance); }
    catch (_) { cancel(); status.textContent = "This browser could not play the speech."; }
  }
  function start(items, type) {
    cancel();
    pieces = items;
    mode = type;
    if (!pieces.length) {
      status.textContent = "No headlines are available to read.";
      return;
    }
    active = true;
    buttons();
    status.textContent = "Pe lir bann nouvel… Headlines remain in their published language.";
    speakNext(session);
  }
  play.addEventListener("click", () => {
    const cards = [...document.querySelectorAll("#headlineGrid .news-card")].slice(0,5);
    const items = fragment("Bonzur. Ala bann tit nouvel Inside Mauritius.", "mfe-MU");
    for (const card of cards) {
      const title = card.querySelector("h3")?.textContent || "";
      const meta = card.querySelector(".meta")?.textContent || "Source";
      const sections = meta.split(" · ");
      items.push(...makeItem(title, sections.slice(1).join(" · ") || "Publisher", sections[0]));
    }
    items.push(...fragment("Mersi pou ekout Inside Mauritius.", "mfe-MU"));
    start(cards.length ? items : [],"roundup");
  });
  document.addEventListener("im:read-headline",event => {
    const detail = event.detail || {};
    if (typeof detail.title !== "string" || !detail.title) return;
    const items = [
      ...fragment("Inside Mauritius. Ekout sa tit nouvel-la.", "mfe-MU"),
      ...makeItem(detail.title, detail.source || "Publisher", detail.category || "Mauritius")
    ];
    start(items,"headline");
  });
  pause.addEventListener("click", () => {
    if (!active) return;
    if (paused) {
      paused = false;
      synth.resume();
      status.textContent = "Lektir pe kontinie.";
    } else {
      paused = true;
      synth.pause();
      status.textContent = "Lektir an poz.";
    }
    buttons();
  });
  stop.addEventListener("click", () => {
    cancel();
    status.textContent = "Lektir finn arete.";
  });
  speed.addEventListener("change", () => {
    if (!active) return;
    status.textContent = "New speed applies to the next phrase.";
  });
  voiceSelect.addEventListener("change", () => {
    if (!active) return;
    status.textContent = "Selected voice applies to the next phrase.";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active && !paused) {
      paused = true;
      synth.pause();
      status.textContent = "Paused while this page is hidden.";
      buttons();
    }
  });
  window.addEventListener("pagehide", cancel);
  buttons();
})();