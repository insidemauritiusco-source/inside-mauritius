/* Inside Mauritius: prefer published narration audio; device speech is an explicit fallback. */
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
  const voices = () => synth && Utterance ? synth.getVoices() : [];
  const audio = new Audio();
  audio.preload = "none";
  let manifest = null;
  let manifestReady = false;
  let recordingMode = false;
  let recordings = [];
  let recordingIndex = 0;
  function safeRecording(path) {
    return typeof path === "string" && /^news-audio\/[a-zA-Z0-9_-]+\.mp3$/.test(path) ? path : null;
  }
  fetch("news-audio/manifest.json", {cache:"no-cache"})
    .then(r => { if (!r.ok) throw Error("No recordings"); return r.json(); })
    .then(data => { if (data && data.version === 1 && Array.isArray(data.tracks)) manifest = data; })
    .catch(() => {})
    .finally(() => { manifestReady = true; });
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
    const rank = v => (/natural|neural|premium|enhanced|online|google/i.test(v.name || "") ? 10 : 0) + (!v.localService ? 2 : 0);
    const best = prefix => available.filter(v => (v.lang || "").toLowerCase().startsWith(prefix)).sort((a,b) => rank(b)-rank(a))[0];
    return best(start) || (lang === "mfe-MU" ? best("fr") : null) || null;
  }
  function populateVoices() {
    const previous = voiceSelect.value;
    voiceSelect.replaceChildren(new Option("Tanguy · Natural news voice (when available)","natural"), new Option("Automatic (best device voice)","device"));
    voices().forEach(v => voiceSelect.add(new Option(v.name+" ("+v.lang+")",v.voiceURI)));
    if (previous === "device" || previous === "natural" || voices().some(v => v.voiceURI === previous)) voiceSelect.value = previous;
  }
  populateVoices();
  if (synth && typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", populateVoices);
  else if (synth) synth.onvoiceschanged = populateVoices;
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
    if (synth) synth.cancel();
    recordingMode = false;
    recordings = [];
    recordingIndex = 0;
    audio.onended = null; audio.onerror = null;
    audio.pause(); audio.removeAttribute("src"); audio.load();
    buttons();
  }
  function fragment(text, lang) {
    const cleaned = String(text || "").replace(/\s+/g," ").trim();
    if (!cleaned) return [];
    const chunks = cleaned.length <= 280 ? [cleaned] : (cleaned.match(/.{1,280}(?:\s|$)|\S+/g) || [cleaned]);
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
    utterance.rate = (Number(speed.value) || 1) * 0.94;
    utterance.pitch = 1;
    const language = entry.lang === "auto" ? automaticLanguage(entry.text) : entry.lang;
    utterance.lang = language;
    const chosen = suitableVoice(language);
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }
    utterance.onend = () => setTimeout(() => speakNext(mySession), 180);
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
    if (!synth || !Utterance) { status.textContent = "Device speech is unavailable in this browser."; return; }
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
  function playRecording(mySession) {
    if (!recordingMode || !active || paused || mySession !== session) return;
    if (recordingIndex >= recordings.length) {
      cancel(); status.textContent = "Lektir termine. All selected headlines have been read."; return;
    }
    audio.src = recordings[recordingIndex];
    audio.playbackRate = Number(speed.value) || 1;
    audio.onended = () => { if (session !== mySession) return; recordingIndex++; playRecording(mySession); };
    const fail = () => { if (session !== mySession) return; cancel(); status.textContent = "Natural audio could not play. Retry or select device voice."; };
    audio.onerror = fail;
    audio.play().catch(fail);
  }
  function startNatural(items) {
    cancel();
    if (!items.length) { status.textContent = "No headlines are available."; return; }
    if (!manifestReady) { status.textContent = "Checking natural audio. Tap Listen again."; return; }
    const tracks = items.map(item => manifest?.tracks.find(t => t.title === item.title && t.source === item.source && t.category === item.category));
    if (tracks.some(t => !safeRecording(t?.file))) {
      status.textContent = "Natural audio is not available for these exact headlines. Choose device voice for an optional fallback.";
      return;
    }
    recordings = [safeRecording(manifest?.intro), ...tracks.map(t => safeRecording(t.file)), safeRecording(manifest?.outro)].filter(Boolean);
    recordingMode = true; active = true; buttons();
    status.textContent = "Pe lir bann nouvel… AI-generated natural audio.";
    playRecording(session);
  }
  play.addEventListener("click", () => {
    const cards = [...document.querySelectorAll("#headlineGrid .news-card")].slice(0,5);
    const selected = [];
    const items = fragment("Bonzur. Ala bann tit nouvel Inside Mauritius.", "mfe-MU");
    for (const card of cards) {
      const title = card.querySelector("h3")?.textContent || "";
      const meta = card.querySelector(".meta")?.textContent || "Source";
      const sections = meta.split(" · ");
      const source = sections.slice(1).join(" · ") || "Publisher";
      selected.push({title,source,category:sections[0]});
      items.push(...makeItem(title, source, sections[0]));
    }
    items.push(...fragment("Mersi pou ekout Inside Mauritius.", "mfe-MU"));
    if (voiceSelect.value === "natural") startNatural(selected);
    else start(cards.length ? items : [],"roundup");
  });
  document.addEventListener("im:read-headline",event => {
    const detail = event.detail || {};
    if (typeof detail.title !== "string" || !detail.title) return;
    if (voiceSelect.value === "natural") { startNatural([{title:detail.title,source:detail.source || "Publisher",category:detail.category || "Mauritius"}]); return; }
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
      if (recordingMode) { const current = session; audio.play().catch(() => { if (session === current) { cancel(); status.textContent = "Could not resume audio."; } }); }
      else { synth.resume(); if (!synth.speaking) speakNext(session); }
      status.textContent = "Lektir pe kontinie.";
    } else {
      paused = true;
      if (recordingMode) audio.pause(); else synth.pause();
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
    if (recordingMode) audio.playbackRate = Number(speed.value) || 1;
    status.textContent = recordingMode ? "Audio speed updated." : "New speed applies to the next phrase.";
  });
  voiceSelect.addEventListener("change", () => {
    if (!active) return;
    cancel(); status.textContent = "Voice changed. Tap Listen to restart.";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active && !paused) {
      paused = true;
      if (recordingMode) audio.pause(); else synth.pause();
      status.textContent = "Paused while this page is hidden.";
      buttons();
    }
  });
  window.addEventListener("pagehide", cancel);
  buttons();
})();