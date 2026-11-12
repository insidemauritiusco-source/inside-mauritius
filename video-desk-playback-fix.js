/* Non-invasive playback status for the original, silent homepage intro. */
(() => {
  "use strict";
  function init() {
    const video = document.getElementById("worldIntroVideo");
    const notice = document.getElementById("videoErrorNotice");
    if (!video || !notice) return;
    const fail = () => { notice.hidden = false; };
    const recover = () => { notice.hidden = true; };
    video.addEventListener("error", fail);
    video.addEventListener("stalled", fail);
    video.addEventListener("loadeddata", recover);
    video.addEventListener("playing", recover);
    for (const source of video.querySelectorAll("source")) source.addEventListener("error", fail);
    if (video.error) fail();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
