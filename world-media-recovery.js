/* World Desk Android-friendly media recovery. */
(() => {
  "use strict";
  function init() {
    const video = document.getElementById("worldIntroVideo");
    const button = document.getElementById("playWorldVideo");
    const status = document.getElementById("worldVideoStatus");
    if (video && status) {
      const fail = () => { status.hidden = false; if (button) button.textContent = "▶ Try again"; };
      const recover = () => { status.hidden = true; };
      video.addEventListener("error", fail);
      video.addEventListener("playing", () => {
        recover();
        if (button) button.textContent = "Ⅱ Pause video";
      });
      video.addEventListener("pause", () => {
        if (button) button.textContent = "▶ Play video";
      });
      video.addEventListener("loadeddata", recover);
      video.addEventListener("stalled", () => { if (video.error) fail(); });
      if (button) button.addEventListener("click", () => {
        if (!video.paused) { video.pause(); return; }
        recover();
        try {
          const result = video.play();
          if (result && typeof result.catch === "function") result.catch(fail);
        } catch (_) { fail(); }
      });
      if (video.error) fail();
    }
    const photoStatus = document.getElementById("worldPhotoStatus");
    ["#openPhoto img", "#photoViewer img"].forEach(selector => {
      const img = document.querySelector(selector);
      if (!img) return;
      img.addEventListener("error", () => {
        if (img.dataset.imFallbackUsed === "1") return;
        img.dataset.imFallbackUsed = "1";
        img.src = "cover-world.svg";
        img.alt = "Inside Mauritius world illustration; original photograph unavailable";
        if (photoStatus) photoStatus.hidden = false;
      });
      if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event("error"));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
