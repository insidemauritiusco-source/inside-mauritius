/* Inside Mauritius media usability repair — progressive enhancement, no remote proxy. */
(() => {
  "use strict";
  const LOCAL_FALLBACK = "cover-mauritius.svg";
  const modal = document.createElement("dialog");
  modal.className = "im-media-dialog";
  modal.setAttribute("aria-label", "Photo viewer");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "im-media-close";
  close.textContent = "✕ Close";
  close.setAttribute("aria-label", "Close photo");
  const photo = document.createElement("img");
  photo.alt = "Expanded article photo";
  const caption = document.createElement("p");
  modal.append(close, photo, caption);
  function closeViewer() { if (modal.open) modal.close(); }
  close.addEventListener("click", closeViewer);
  modal.addEventListener("click", event => { if (event.target === modal) closeViewer(); });
  photo.addEventListener("error", () => {
    if (!photo.src.endsWith("/" + LOCAL_FALLBACK)) {
      photo.src = LOCAL_FALLBACK;
      caption.textContent = "This photo could not be loaded. The site's backup illustration is shown.";
    }
  });
  function openViewer(src, description) {
    if (!src || !/^(https?:\/\/|\.?\.?\/|[^/:?#]+\.(?:png|jpe?g|webp|gif|svg)(?:[?#]|$))/i.test(src)) return;
    photo.src = src;
    photo.alt = description || "News photo";
    caption.textContent = description || "Inside Mauritius photo";
    if (!modal.isConnected) document.body.append(modal);
    if (!modal.open && typeof modal.showModal === "function") modal.showModal();
    else if (!modal.open) window.open(src, "_blank", "noopener");
  }
  // Article image links previously navigated away from the site to a raw image.
  // Show a photo viewer instead; external source credits remain separate links.
  document.addEventListener("click", event => {
    const link = event.target.closest && event.target.closest("#articleImageOpen");
    if (!link) return;
    const image = document.getElementById("articleImage");
    if (!image || !image.currentSrc) return;
    const href = link.getAttribute("href") || "";
    // Keep TikTok watch actions intact.
    if (/tiktok\.com/i.test(href)) return;
    event.preventDefault();
    openViewer(image.currentSrc, image.alt);
  });
  // Detect missing images loaded by dynamically rendered story cards and display
  // an honest local fallback instead of the broken-image icon.
  function protect(img) {
    if (img.dataset.imMediaProtected) return;
    img.dataset.imMediaProtected = "1";
    img.addEventListener("error", () => {
      if (img.dataset.imFallbackUsed) return;
      img.dataset.imFallbackUsed = "1";
      const fallback = img.closest(".story-card, #articlePage")?.querySelector(".story-category")?.textContent === "Government" ? "cover-government.svg" : LOCAL_FALLBACK;
      if (img.getAttribute("src") !== fallback) img.src = fallback;
      img.alt = "Photo unavailable — Inside Mauritius backup illustration";
    });
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches("img")) protect(node);
    node.querySelectorAll?.("img").forEach(protect);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scan(document.body), {once:true});
  else scan(document.body);
  new MutationObserver(entries => {
    for (const item of entries) for (const node of item.addedNodes) scan(node);
  }).observe(document.documentElement, {childList:true,subtree:true});
})();
