/* Inside Mauritius accessible article reader. Uses browser speech synthesis; no audio uploads. */
(() => {
  "use strict";
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) return;
  const ready = () => {
    const article = document.getElementById("articlePage");
    const body = document.getElementById("articleBody");
    const title = document.getElementById("articleTitle");
    if (!article || !body || !title || document.getElementById("imAudioReader")) return;
    const panel = document.createElement("section");
    panel.id = "imAudioReader";
    panel.className = "im-audio-reader";
    panel.setAttribute("aria-label", "Listen to this article");
    panel.innerHTML = '<strong>🔊 Listen to this article</strong><div class="im-audio-controls"><button type="button" data-audio="play">▶ Listen</button><button type="button" data-audio="pause" disabled>⏸ Pause</button><button type="button" data-audio="stop" disabled>■ Stop</button><label>Speed <select data-audio="speed" aria-label="Reading speed"><option value="0.8">0.8×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option></select></label><label>Language <select data-audio="language" aria-label="Reading language"><option value="auto">Auto</option><option value="en">English</option><option value="fr">Français</option><option value="mfe">Kreol Morisien 🇲🇺</option></select></label><label>Voice <select data-audio="voice" aria-label="Reading voice"><option value="">Device default</option></select></label></div><p data-audio="status" role="status" aria-live="polite">Tap Listen to hear the full article.</p>';
    const deck = document.getElementById("articleDeck");
    (deck || title).insertAdjacentElement("afterend", panel);
    const play = panel.querySelector('[data-audio="play"]');
    const pause = panel.querySelector('[data-audio="pause"]');
    const stop = panel.querySelector('[data-audio="stop"]');
    const speed = panel.querySelector('[data-audio="speed"]');
    const language = panel.querySelector('[data-audio="language"]');
    const voice = panel.querySelector('[data-audio="voice"]');
    const status = panel.querySelector('[data-audio="status"]');
    let queue = [], index = 0, active = false, paused = false, currentArticle = "";
    function setButtons() {
      play.textContent = paused ? "▶ Resume" : active ? "↻ Restart" : "▶ Listen";
      pause.disabled = !active || paused;
      stop.disabled = !active;
    }
    function cancel() {
      active = false; paused = false; queue = []; index = 0;
      synth.cancel(); setButtons();
    }
    function getText() {
      const clone = body.cloneNode(true);
      clone.querySelectorAll("script,style,button,nav,iframe,video,audio,[aria-hidden='true']").forEach(el => el.remove());
      return [title.textContent, deck && deck.textContent, clone.textContent].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
    }
    function speakNext() {
      if (!active || paused) return;
      if (index >= queue.length) {
        cancel(); status.textContent = "Finished reading the article."; return;
      }
      const phrase = queue[index++];
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = Number(speed.value);
      const selected = synth.getVoices().find(v => v.voiceURI === voice.value);
      if (selected) { utterance.voice = selected; utterance.lang = selected.lang; }
      else if (language.value === "mfe") utterance.lang = "mfe-MU";
      else if (language.value === "fr") utterance.lang = "fr-FR";
      else if (language.value === "en") utterance.lang = "en-GB";
      utterance.onend = () => { if (active && !paused) speakNext(); };
      utterance.onerror = e => {
        if (e.error === "canceled" || e.error === "interrupted") return;
        if (e.error === "not-allowed") { cancel(); status.textContent = "Audio playback was blocked. Tap Listen again."; return; }
        if (active) speakNext();
      };
      synth.speak(utterance);
    }
    function populateVoices() {
      const previous = voice.value;
      const voices = synth.getVoices();
      voice.replaceChildren(new Option("Device default", ""));
      voices.forEach(v => voice.add(new Option(v.name + " (" + v.lang + ")", v.voiceURI)));
      voice.value = voices.some(v => v.voiceURI === previous) ? previous : "";
      if (!voice.value) selectSuggestedVoice();
    }
    function selectSuggestedVoice() {
      const code = language.value;
      if (code === "auto") { voice.value = ""; return; }
      const voices = synth.getVoices();
      let match = voices.find(v => (v.lang || "").toLowerCase().startsWith(code === "mfe" ? "mfe" : code));
      // A French voice is only an approximation for Kreol Morisien; it is not a native Kreol voice.
      if (!match && code === "mfe") match = voices.find(v => (v.lang || "").toLowerCase().startsWith("fr"));
      voice.value = match ? match.voiceURI : "";
    }
    function updateLanguageNotice() {
      if (language.value !== "mfe") { status.textContent = "Tap Listen to hear the full article."; return; }
      const nativeVoice = synth.getVoices().some(v => (v.lang || "").toLowerCase().startsWith("mfe"));
      status.textContent = nativeVoice
        ? "Kreol Morisien voice available. The reader speaks the article as written; it does not translate."
        : "Kreol Morisien: your device has no native Kreol voice. A French or default voice may approximate pronunciation. Articles are not translated.";
    }
    language.addEventListener("change", () => { if (active) cancel(); selectSuggestedVoice(); updateLanguageNotice(); });
    populateVoices(); synth.addEventListener && synth.addEventListener("voiceschanged", populateVoices);
    play.addEventListener("click", () => {
      if (paused && active) { paused = false; synth.resume(); status.textContent = "Reading resumed."; setButtons(); return; }
      cancel();
      const content = getText();
      if (!content) { status.textContent = "No article text is available."; return; }
      // Use short chunks for more reliable mobile-browser speech playback.
      queue = content.match(/.{1,180}(?:\s|$)/g) || [content];
      index = 0; active = true; paused = false; currentArticle = location.hash;
      status.textContent = language.value === "mfe" ? "Reading the written text using the available voice (no translation)…" : "Reading article aloud…"; setButtons(); speakNext();
    });
    pause.addEventListener("click", () => {
      if (!active) return;
      paused = true; synth.pause(); status.textContent = "Reading paused."; setButtons();
    });
    stop.addEventListener("click", () => { cancel(); status.textContent = "Reading stopped."; });
    speed.addEventListener("change", () => {
      if (active && !paused) { const original = Math.max(0,index-1); synth.cancel(); index = original; speakNext(); }
    });
    window.addEventListener("hashchange", () => {
      if (active && location.hash !== currentArticle) { cancel(); status.textContent = "Tap Listen to hear this article."; }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && active) { paused = true; synth.pause(); status.textContent = "Paused while the page is hidden."; setButtons(); }
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();