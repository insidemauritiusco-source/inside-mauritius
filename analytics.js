/*
 * Inside Mauritius Google Analytics 4 integration — opt-in only.
 *
 * Events:
 * - page_view: home and each #article/... news route, plus World News page.
 * - video_start / video_progress / video_complete: self-hosted HTML5 players.
 * - video_outbound_click: TikTok / YouTube watch links (NOT actual watches).
 *
 * The Google script is never fetched unless the config contains a real GA4 ID
 * AND a visitor has explicitly chosen "Allow analytics".
 */
(() => {
  "use strict";

  const options = window.INSIDE_MAURITIUS_ANALYTICS || {};
  const measurementId = String(options.measurementId || "").trim().toUpperCase();
  if (!/^G-[A-Z0-9]{6,16}$/.test(measurementId)) return;

  const CONSENT_KEY = "inside-mauritius-analytics-consent-v1";
  let active = false;
  let lastPageLocation = null;
  const videoStates = new WeakMap();

  function getChoice() {
    try { return window.localStorage.getItem(CONSENT_KEY); }
    catch { return null; }
  }
  function saveChoice(choice) {
    try { window.localStorage.setItem(CONSENT_KEY, choice); }
    catch { /* A browser may block storage; ask again on the next visit. */ }
  }
  function sendEvent(name, params) {
    if (active && typeof window.gtag === "function") window.gtag("event", name, params);
  }
  function pageLocation() {
    // Include article fragments, never URL query strings or unrelated anchors.
    const articleHash = /^#article\/[A-Za-z0-9._~%-]+$/.test(window.location.hash)
      ? window.location.hash
      : "";
    return window.location.origin + window.location.pathname + articleHash;
  }
  function isArticle() {
    return /^#article\//.test(window.location.hash);
  }
  function trackPageView() {
    if (!active) return;
    const location = pageLocation();
    if (location === lastPageLocation) return; // avoid duplicate views for #latest etc.
    const params = {
      page_title: document.title,
      page_location: location,
      content_group: isArticle()
        ? "News article"
        : window.location.pathname.endsWith("world-news.html")
          ? "World News Desk"
          : "Inside Mauritius homepage"
    };
    if (lastPageLocation) params.page_referrer = lastPageLocation;
    lastPageLocation = location;
    sendEvent("page_view", params);
  }

  function videoDetails(video) {
    const source = video.currentSrc || video.querySelector("source[src]")?.src || "";
    let videoUrl = "";
    try {
      const parsed = new URL(source, window.location.href);
      if (parsed.origin === window.location.origin) videoUrl = parsed.origin + parsed.pathname;
    } catch { /* Ignore invalid URLs. */ }
    const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
    return {
      video_title: (video.getAttribute("aria-label") || video.getAttribute("title") || "Inside Mauritius video").slice(0, 120),
      video_provider: "inside_mauritius",
      video_url: videoUrl,
      video_duration: duration
    };
  }
  function videoState(video) {
    let state = videoStates.get(video);
    if (!state) {
      state = { started: false, completed: false, milestones: new Set() };
      videoStates.set(video, state);
    }
    return state;
  }

  // 'playing' means actual media playback began (unlike a click on a play icon).
  document.addEventListener("playing", (event) => {
    if (!active || !(event.target instanceof HTMLVideoElement)) return;
    const state = videoState(event.target);
    if (state.started) return;
    state.started = true;
    sendEvent("video_start", videoDetails(event.target));
  }, true);

  document.addEventListener("timeupdate", (event) => {
    if (!active || !(event.target instanceof HTMLVideoElement)) return;
    const video = event.target;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const state = videoState(video);
    if (!state.started) return;
    const percent = Math.min(100, (video.currentTime / video.duration) * 100);
    for (const milestone of [25, 50, 75]) {
      if (percent >= milestone && !state.milestones.has(milestone)) {
        state.milestones.add(milestone);
        sendEvent("video_progress", {
          ...videoDetails(video),
          video_percent: milestone,
          video_current_time: Math.round(video.currentTime)
        });
      }
    }
  }, true);

  document.addEventListener("ended", (event) => {
    if (!active || !(event.target instanceof HTMLVideoElement)) return;
    const state = videoState(event.target);
    if (!state.started || state.completed) return;
    state.completed = true;
    sendEvent("video_complete", { ...videoDetails(event.target), video_percent: 100 });
  }, true);

  // Cross-origin TikTok/YouTube video plays cannot be observed reliably.
  // Count clicks out to those providers, not "video watches".
  document.addEventListener("click", (event) => {
    if (!active || !(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (!link) return;
    let url;
    try { url = new URL(link.href, window.location.href); }
    catch { return; }
    const host = url.hostname.toLowerCase();
    const provider = host === "tiktok.com" || host === "www.tiktok.com" || host === "vt.tiktok.com"
      ? "tiktok"
      : host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be"
        ? "youtube"
        : null;
    if (!provider) return;
    sendEvent("video_outbound_click", {
      video_provider: provider,
      link_domain: host,
      link_url: url.origin + url.pathname
    });
  }, true);

  window.addEventListener("hashchange", () => {
    // app.js updates article content and document.title on hashchange.
    window.setTimeout(trackPageView, 0);
  });

  function enableAnalytics() {
    if (active) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    // No advertising or personalized advertising. Consent is denied by default.
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    // Manual page views avoid double-counting on hash-based article routes.
    window.gtag("config", measurementId, { send_page_view: false });

    active = true;
    const loader = document.createElement("script");
    loader.async = true;
    loader.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    loader.onerror = () => { console.warn("Inside Mauritius: Google Analytics script could not load."); };
    document.head.appendChild(loader);
    trackPageView();
  }

  function init() {
    const footer = document.querySelector("footer") || document.body;
    const preferences = document.createElement("button");
    preferences.type = "button";
    preferences.id = "analyticsPreferences";
    preferences.className = "im-analytics-preferences";
    preferences.textContent = "Privacy & analytics choices";
    footer.appendChild(preferences);

    const notice = document.createElement("section");
    notice.className = "im-analytics-notice";
    notice.setAttribute("aria-label", "Website analytics privacy choice");
    notice.setAttribute("role", "region");
    notice.hidden = true;
    notice.innerHTML =
      '<p><strong>Help improve Inside Mauritius</strong> — Allow anonymous-style site analytics to measure news page visits and plays of videos hosted here. Google Analytics may use cookies and device information. TikTok clicks count as clicks, not confirmed views. You can decline or change your choice at any time.</p>' +
      '<div class="im-analytics-actions"><button type="button" data-analytics-choice="deny">Decline</button><button type="button" data-analytics-choice="allow">Allow analytics</button></div>';
    document.body.appendChild(notice);
    const choice = getChoice();
    if (choice === "allow") enableAnalytics();
    if (choice !== "allow" && choice !== "deny") notice.hidden = false;

    preferences.addEventListener("click", () => {
      notice.hidden = false;
      const first = notice.querySelector("button");
      if (first) first.focus();
    });
    notice.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-analytics-choice]");
      if (!button) return;
      const consent = button.dataset.analyticsChoice;
      if (consent === "allow") {
        saveChoice("allow");
        notice.hidden = true;
        enableAnalytics();
      } else if (consent === "deny") {
        saveChoice("deny");
        notice.hidden = true;
        if (active) {
          active = false;
          if (typeof window.gtag === "function") {
            window.gtag("consent", "update", { analytics_storage: "denied" });
          }
          // Unload previously injected tags on withdrawal of permission.
          window.location.reload();
        }
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
