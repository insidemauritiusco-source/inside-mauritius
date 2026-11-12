(() => {
  "use strict";
  const cfg = window.IM_DASHBOARD_CONFIG || {};
  const $ = id => document.getElementById(id);
  const propertyId = String(cfg.propertyId || "").trim();
  const clientId = String(cfg.oauthClientId || "").trim();
  const validProperty = /^[0-9]{5,20}$/.test(propertyId);
  const validClient = /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
  const scope = "https://www.googleapis.com/auth/analytics.readonly";
  let accessToken = "";
  let tokenClient;
  let pending = false;

  function status(message, error = false) {
    $("status").textContent = message;
    $("status").classList.toggle("error", error);
  }
  function setConnected(connected) {
    $("report").hidden = !connected;
    $("signOut").hidden = !connected;
    $("connect").hidden = connected;
    $("refresh").disabled = !connected;
  }
  function display(id, value) {
    $(id).textContent = Number.isFinite(value) ? new Intl.NumberFormat("en-MU").format(value) : "—";
  }
  function metric(response, index = 0) {
    const v = Number(response?.rows?.[index]?.metricValues?.[0]?.value);
    return Number.isFinite(v) ? v : 0;
  }
  async function api(method, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(
        "https://analyticsdata.googleapis.com/v1beta/properties/" + encodeURIComponent(propertyId) + ":" + method,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: "no-store"
        }
      );
      if (!response.ok) {
        let detail = "";
        try { detail = (await response.json()).error?.message || ""; } catch {}
        if (response.status === 401) {
          accessToken = "";
          setConnected(false);
          throw new Error("Your Google session expired. Connect again.");
        }
        if (response.status === 403) throw new Error("Google denied report access. Confirm that your account is a Viewer of this GA4 property and the Analytics Data API is enabled.");
        throw new Error("Google Analytics request failed (" + response.status + "). " + detail.slice(0, 180));
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  function dates() {
    const start = $("period").value;
    return [{ startDate: start, endDate: "today" }];
  }
  const count = event => ({
    dateRanges: dates(),
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: event }
      }
    }
  });
  async function refresh() {
    if (!accessToken || pending) return;
    pending = true;
    $("refresh").disabled = true;
    status("Loading Google Analytics reports…");
    try {
      // Request only aggregate statistics. No user-level or personally identifying data.
      const requests = [
        api("runRealtimeReport", { metrics: [{ name: "activeUsers" }] }),
        api("runReport", { dateRanges: dates(), metrics: [{ name: "activeUsers" }] }),
        api("runReport", count("page_view")),
        api("runReport", {
          dateRanges: dates(),
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            andGroup: { expressions: [
              { filter: { fieldName: "eventName", stringFilter: { value: "page_view", matchType: "EXACT" } } },
              { filter: { fieldName: "contentGroup", stringFilter: { value: "News article", matchType: "EXACT" } } }
            ] }
          }
        }),
        api("runReport", count("video_start")),
        api("runReport", count("video_complete")),
        api("runReport", count("video_progress")),
        api("runReport", count("video_outbound_click")),
        api("runReport", {
          dateRanges: dates(),
          dimensions: [{ name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 12
        })
      ];
      const results = await Promise.allSettled(requests);
      if (results.every(r => r.status === "rejected")) throw results[0].reason;
      const get = i => results[i].status === "fulfilled" ? results[i].value : null;
      const keys = ["liveVisitors", "activeUsers", "pageViews", "articleViews", "videoStarts", "videoCompletions", "eventProgress", "externalClicks"];
      keys.forEach((key, i) => display(key, get(i) ? metric(get(i)) : NaN));
      display("eventStarts", get(4) ? metric(get(4)) : NaN);
      display("eventCompletions", get(5) ? metric(get(5)) : NaN);
      const tbody = $("pagesBody");
      tbody.replaceChildren();
      const pages = get(8)?.rows || [];
      if (!pages.length) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 2;
        cell.textContent = "No page data available for this period.";
      } else {
        pages.forEach(page => {
          const row = tbody.insertRow();
          row.insertCell().textContent = (page.dimensionValues?.[0]?.value || "Untitled page").slice(0, 180);
          const cell = row.insertCell();
          cell.className = "num";
          cell.textContent = Number(page.metricValues?.[0]?.value || 0).toLocaleString("en-MU");
        });
      }
      $("lastUpdated").textContent = "Updated " + new Intl.DateTimeFormat("en-MU", {
        timeZone: "Indian/Mauritius", dateStyle: "medium", timeStyle: "short"
      }).format(new Date()) + " (Mauritius)";
      const failures = results.filter(r => r.status === "rejected");
      status(failures.length ? "Some metrics could not be loaded. Check GA4 access and report availability." : "Connected. Google Analytics reporting is active.", !!failures.length);
    } catch (error) {
      status(error.message || "Could not load reports.", true);
    } finally {
      pending = false;
      $("refresh").disabled = !accessToken;
    }
  }
  function connect() {
    if (!tokenClient) return status("Google sign-in is still loading.", true);
    tokenClient.requestAccessToken({ prompt: "consent" });
  }
  function initializeGoogle() {
    if (!window.google?.accounts?.oauth2) return status("Google sign-in did not load. Refresh or check your browser's content blockers.", true);
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: response => {
        if (response.error || !response.access_token) {
          return status("Google authorization was cancelled or denied.", true);
        }
        accessToken = response.access_token;
        setConnected(true);
        refresh();
      }
    });
    $("connect").disabled = false;
    status("Ready. Connect using a Google account with access to your GA4 property.");
  }
  function signOut() {
    const previous = accessToken;
    accessToken = "";
    if (previous && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(previous, () => {});
    setConnected(false);
    ["liveVisitors","activeUsers","pageViews","articleViews","videoStarts","videoCompletions","eventStarts","eventProgress","eventCompletions","externalClicks"].forEach(id => $(id).textContent = "—");
    $("pagesBody").replaceChildren();
    $("lastUpdated").textContent = "";
    status("Disconnected. No report data remains displayed.");
  }
  $("connect").addEventListener("click", connect);
  $("refresh").addEventListener("click", refresh);
  $("period").addEventListener("change", refresh);
  $("signOut").addEventListener("click", signOut);
  setConnected(false);
  if (!validProperty || !validClient) {
    $("setup").hidden = false;
    status("Setup required: enter your numeric GA4 Property ID and Google OAuth Web Client ID in config.js. No private report data is available yet.");
    return;
  }
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = initializeGoogle;
  script.onerror = () => status("Could not load Google's sign-in library.", true);
  document.head.appendChild(script);
})();
