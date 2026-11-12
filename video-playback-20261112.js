/* Inside Mauritius video desk: report genuine local MP4 playback failures. */
(() => {
  "use strict";
  function init() {
    const player = document.getElementById("worldIntroVideo");
    const error = document.getElementById("videoErrorNotice");
    if (!player || !error) return;
    const showError = () => { error.hidden = false; };
    player.addEventListener("error", showError);
    player.addEventListener("stalled", () => {
      // Buffer stalls can be transient; keep the original-file link available.
      if (player.error) showError();
    });
    player.querySelectorAll("source").forEach(source => source.addEventListener("error", showError));
    player.addEventListener("playing", () => { error.hidden = true; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
