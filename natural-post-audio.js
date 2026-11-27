(() => {
"use strict";
const records=Array.isArray(window.INSIDE_MAURITIUS_HEADLINE_AUDIO)?window.INSIDE_MAURITIUS_HEADLINE_AUDIO:[];
const posts=Array.isArray(window.INSIDE_MAURITIUS_POST_AUDIO)?window.INSIDE_MAURITIUS_POST_AUDIO:[];
const path=/^audio\/(headline|post)-[a-f0-9]{32}\.mp3$/;
function url(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:null}catch{return null}}
function valid(r){return r&&r.engine==="Kokoro"&&r.generated===true&&["fr","en"].includes(r.language)&&path.test(r.audioUrl)}
const bySource=new Map(records.filter(valid).map(r=>[JSON.stringify([url(r.sourceUrl),r.title]),r]));
const byPost=new Map(posts.filter(valid).map(r=>[JSON.stringify([r.id,r.title]),r]));
function find(story){const source=[story.sourceUrl,story.videoUrl,story.tiktokUrl,story.url].map(url).find(Boolean);return bySource.get(JSON.stringify([source,story.title]))||byPost.get(JSON.stringify([story.id,story.title]))}
function panel(story){
const box=document.createElement("section");box.className="im-natural-post-audio";box.setAttribute("aria-label","Natural AI headline audio");
const r=find(story);const status=document.createElement("p");status.setAttribute("role","status");status.textContent=r?"Natural AI headline · "+(r.language==="fr"?"Français":"English"):"Natural headline recording not available yet.";
box.append(status);
if(!r)return box;
const audio=document.createElement("audio");audio.controls=true;audio.preload="none";audio.src=r.audioUrl;audio.style.cssText="display:block;width:100%;max-width:100%;min-width:0";audio.setAttribute("aria-label","Listen to headline: "+story.title);
const stop=document.createElement("button");stop.type="button";stop.textContent="Stop audio";stop.addEventListener("click",()=>{audio.pause();if(Number.isFinite(audio.duration))audio.currentTime=0});
audio.addEventListener("error",()=>{status.textContent="Recording could not load. Try again after refreshing."});box.append(audio,stop);return box;
}
document.addEventListener("play",e=>{if(e.target.tagName!=="AUDIO")return;document.querySelectorAll("audio").forEach(a=>{if(a!==e.target)a.pause()});if(window.speechSynthesis)window.speechSynthesis.cancel();document.dispatchEvent(new Event("im:natural-post-play"))},true);
function stopAll(){document.querySelectorAll(".im-natural-post-audio audio").forEach(a=>a.pause())}
window.addEventListener("hashchange",stopAll);window.addEventListener("pagehide",stopAll);
window.INSIDE_MAURITIUS_NATURAL_POST_AUDIO={panel,find,stopAll};
})();