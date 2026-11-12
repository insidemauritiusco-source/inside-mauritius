/* Inside Mauritius World News: error reporting and fallback video formats. */
(() => {
  "use strict";
  const MP4 = "media/global-perspective.mp4?v=20261112motion";
  const WEBM = "media/global-perspective.webm?v=20261112motion";
  function init() {
    const player = document.getElementById("worldIntroVideo");
    const notice = document.getElementById("videoErrorNotice");
    const alternate = document.getElementById("tryWebmVideo");
    if (!player || !notice) return;

    function showError() { notice.hidden = false; }
    function clearError() { notice.hidden = true; }

    player.addEventListener("error", showError);
    player.addEventListener("playing", clearError);
    player.addEventListener("loadeddata", clearError);
    player.addEventListener("stalled", () => { if (player.error) showError(); });
    player.querySelectorAll("source").forEach(source => {
      source.addEventListener("error", () => {
        // A source can fail while the browser successfully chooses the other.
        if (player.error) showError();
      });
    });
    if (player.error) showError();

    if (alternate) {
      alternate.addEventListener("click", async () => {
        const currentSource = player.currentSrc;
        const usingWebM = currentSource.includes("global-perspective.webm");
        const target = usingWebM ? MP4 : WEBM;
        alternate.disabled = true;
        try {
          player.pause();
          player.src = target;
          player.load();
          clearError();
          await player.play();
          alternate.textContent = usingWebM ? "▶ Try alternate video format (WebM)" : "▶ Try original video format (MP4)";
        } catch {
          showError();
        } finally {
          alternate.disabled = false;
        }
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true});
  else init();
})();
