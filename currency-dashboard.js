/* Inside Mauritius — automatically refreshed indicative USD/USDC currency dashboard. */
(function () {
  "use strict";
  const bar = document.getElementById("fxTicker");
  const toggle = document.getElementById("fxToggle");
  const panel = document.getElementById("fxPanel");
  if (!bar || !toggle || !panel) return;
  const amount = document.getElementById("fxAmount");
  const from = document.getElementById("fxFrom");
  const to = document.getElementById("fxTo");
  const result = document.getElementById("fxOutput");
  const status = document.getElementById("fxStatus");
  const refreshButton = document.getElementById("fxRefresh");
  const major = ["MUR", "EUR", "GBP", "INR", "AED", "ZAR", "JPY", "CAD", "USDC"];
  const priority = ["USD", "MUR", "USDC", "EUR", "GBP", "INR", "AED", "ZAR", "JPY", "CAD", "AUD"];
  const apis = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
    "https://latest.currency-api.pages.dev/v1/currencies/usd.min.json"
  ];
  let rates = null;
  let fiatAsOf = "";
  let usdcPriceUSD = null;
  let usdcAsOf = "";
  let busy = false;

  function numberFormat(value, code) {
    if (!Number.isFinite(value)) return "Unavailable";
    const digits = code === "USDC" || Math.abs(value) < 0.01 ? 6 : Math.abs(value) < 1 ? 4 : 2;
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: Math.abs(value) >= 0.01 && digits === 2 ? 2 : 0 }).format(value);
  }
  function available(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }
  function rateFor(code) {
    const value = rates && rates[code.toLowerCase()];
    return available(value) ? value : null;
  }
  function currencyLabel(code) {
    const special = { USDC: "USD Coin", MUR: "Mauritian Rupee", USD: "US Dollar" };
    if (special[code]) return special[code];
    try {
      const label = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
      return label && label !== code ? label : code;
    } catch (_) { return code; }
  }
  function renderTicker() {
    bar.replaceChildren();
    if (!rates) {
      const span = document.createElement("span");
      span.className = "fx-pending";
      span.textContent = "Currency rates unavailable. Open the converter to retry.";
      bar.appendChild(span);
      return;
    }
    major.forEach(function (code) {
      const value = rateFor(code);
      if (value === null) return;
      const item = document.createElement("div");
      item.className = "fx-pair";
      item.setAttribute("role", "listitem");
      item.title = "1 USD = " + numberFormat(value, code) + " " + code + " · " + (code === "USDC" && usdcAsOf ? "USDC quote " + usdcAsOf : "FX " + fiatAsOf);
      const label = document.createElement("strong");
      label.textContent = code;
      const quote = document.createElement("span");
      quote.textContent = numberFormat(value, code);
      item.append(label, quote);
      bar.appendChild(item);
    });
  }
  function renderOptions() {
    if (!rates) return;
    const codes = Object.keys(rates).filter(function (code) {
      return /^[a-z]{2,8}$/.test(code) && available(rates[code]);
    }).map(function (code) { return code.toUpperCase(); });
    const distinct = Array.from(new Set(codes));
    distinct.sort(function (a, b) {
      const ai = priority.indexOf(a), bi = priority.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b);
    });
    const previousFrom = from.value || "USD", previousTo = to.value || "MUR";
    [from, to].forEach(function (select) {
      select.replaceChildren();
      distinct.forEach(function (code) {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = code + " — " + currencyLabel(code);
        select.appendChild(option);
      });
    });
    from.value = distinct.includes(previousFrom) ? previousFrom : "USD";
    to.value = distinct.includes(previousTo) ? previousTo : "MUR";
  }
  function updateConversion() {
    if (!rates) { result.textContent = "Rates unavailable"; return; }
    const input = Number(amount.value);
    const fromRate = rateFor(from.value);
    const toRate = rateFor(to.value);
    if (!Number.isFinite(input) || input < 0 || !fromRate || !toRate) {
      result.textContent = "Enter a valid amount";
      return;
    }
    const converted = input / fromRate * toRate;
    result.textContent = numberFormat(converted, to.value) + " " + to.value;
  }
  function updateStatus() {
    if (!rates) { status.textContent = "No verified rates available yet."; return; }
    const parts = ["FX as of " + (fiatAsOf || "latest available") + " (daily reference)"];
    if (usdcAsOf) parts.push("USDC market quote: " + usdcAsOf);
    else if (rateFor("USDC")) parts.push("USDC: daily reference, market quote unavailable");
    status.textContent = parts.join(" · ");
  }
  function render() {
    renderTicker();
    renderOptions();
    updateConversion();
    updateStatus();
  }
  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 9000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-cache" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async function refreshFiat() {
    if (busy) return;
    busy = true;
    refreshButton.disabled = true;
    let loaded = false;
    for (const endpoint of apis) {
      try {
        const data = await fetchJson(endpoint);
        if (!data || !data.usd || !available(data.usd.mur) || !available(data.usd.eur)) throw new Error("Invalid rate response");
        rates = Object.assign({}, data.usd, { usd: 1 });
        fiatAsOf = typeof data.date === "string" ? data.date : "latest provider release";
        if (available(usdcPriceUSD)) rates.usdc = 1 / usdcPriceUSD;
        loaded = true;
        break;
      } catch (error) { /* Try independent CDN mirror before declaring an outage. */ }
    }
    busy = false;
    refreshButton.disabled = false;
    render();
    if (!loaded && rates) status.textContent = "Latest update failed; displaying last available rates (" + fiatAsOf + ").";
    if (!loaded && !rates) status.textContent = "Rate feed unavailable. Please retry.";
  }
  async function refreshUSDC() {
    try {
      const data = await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd&include_last_updated_at=true");
      const coin = data && data["usd-coin"];
      if (!coin || !available(coin.usd)) throw new Error("No USDC quote");
      usdcPriceUSD = coin.usd;
      usdcAsOf = typeof coin.last_updated_at === "number"
        ? new Date(coin.last_updated_at * 1000).toLocaleString("en-GB", { timeZone: "Indian/Mauritius", dateStyle: "short", timeStyle: "short" }) + " MUT"
        : "latest CoinGecko quote";
      if (rates) rates.usdc = 1 / usdcPriceUSD;
      render();
    } catch (error) {
      // Keep the provider's daily USDC reference if the optional intraday quote fails.
      if (rates) render();
    }
  }
  toggle.addEventListener("click", function () {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) amount.focus();
  });
  [amount, from, to].forEach(function (field) { field.addEventListener("input", updateConversion); field.addEventListener("change", updateConversion); });
  document.getElementById("fxSwap").addEventListener("click", function () {
    const old = from.value;
    from.value = to.value;
    to.value = old;
    updateConversion();
  });
  refreshButton.addEventListener("click", function () { refreshFiat(); refreshUSDC(); });
  refreshFiat();
  refreshUSDC();
  setInterval(refreshFiat, 60 * 60 * 1000);
  setInterval(refreshUSDC, 5 * 60 * 1000);
})();
