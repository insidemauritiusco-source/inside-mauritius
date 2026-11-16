/* Progressive enhancements: no changes to news publishing or existing renderers. */
(() => {
  "use strict";
  const ready = fn => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn, {once:true}) : fn();
  ready(() => {
    const clock = document.getElementById("im-mauritius-clock");
    if (clock && typeof Intl !== "undefined") {
      const fmt = new Intl.DateTimeFormat("en-MU", {timeZone:"Indian/Mauritius",weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
      const tick = () => { clock.textContent = fmt.format(new Date()) + " MUT"; clock.dateTime = new Date().toISOString(); };
      tick(); setInterval(tick, 30000);
    }
    document.querySelectorAll("img:not([loading])").forEach(img => {
      if (img.closest("header") || img.getAttribute("fetchpriority") === "high") return;
      img.loading = "lazy";
      img.decoding = "async";
    });
    document.querySelectorAll("video").forEach(video => {
      if (!video.hasAttribute("playsinline")) video.setAttribute("playsinline", "");
      if (!video.hasAttribute("preload")) video.preload = "metadata";
    });
    const year = document.getElementById("copyrightYear");
    if (year) year.textContent = String(new Date().getFullYear());
  });
})();
