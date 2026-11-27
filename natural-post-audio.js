(() => {
"use strict";
const records=Array.isArray(window.INSIDE_MAURITIUS_HEADLINE_AUDIO)?window.INSIDE_MAURITIUS_HEADLINE_AUDIO:[];
const posts=Array.isArray(window.INSIDE_MAURITIUS_POST_AUDIO)?window.INSIDE_MAURITIUS_POST_AUDIO:[];
const path=/^audio\/(headline|post)-[a-f0-9]{32}\.mp3$/;
function url(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:null}catch{return null}}
function valid(r){return r&&r.engine==="Kokoro"&&r.generated===true&&["fr","en"].includes(r.language)&&path.test(r.audioUrl)}
const bySource=new Map([...posts,...records].filter(r=>valid(r)&&url(r.sourceUrl)).map(r=>[JSON.stringify([url(r.sourceUrl),r.title]),r]));
const byPost=new Map(posts.filter(valid).map(r=>[JSON.stringify([r.id,r.title]),r]));
const summaryRecords=Array.isArray(window.INSIDE_MAURITIUS_SUMMARY_AUDIO)?window.INSIDE_MAURITIUS_SUMMARY_AUDIO:[];
const summaries=summaryRecords.filter(r=>r&&r.engine==="Kokoro"&&r.generated===true&&["fr","en"].includes(r.language)&&/^audio\/summary-[a-f0-9]{32}\.mp3$/.test(r.audioUrl)&&typeof r.summary==="string"&&r.summary.trim());
const summaryById=new Map(summaries.filter(r=>r.id).map(r=>[JSON.stringify([r.id,r.title,r.summary]),r]));
const summaryBySource=new Map(summaries.filter(r=>url(r.sourceUrl)).map(r=>[JSON.stringify([url(r.sourceUrl),r.title,r.summary]),r]));
function find(story){const source=[story.sourceUrl,story.videoUrl,story.tiktokUrl,story.url].map(url).find(Boolean);const summary=typeof story.summary==="string"?story.summary:"";return summaryById.get(JSON.stringify([story.id,story.title,summary]))||summaryBySource.get(JSON.stringify([source,story.title,summary]))||bySource.get(JSON.stringify([source,story.title]))||byPost.get(JSON.stringify([story.id,story.title]))}
function panel(story){
const box=document.createElement("section");box.className="im-natural-post-audio";box.setAttribute("aria-label","Natural AI post audio");
const r=find(story);const status=document.createElement("p");status.setAttribute("role","status");status.textContent=r?(r.summary?"Natural AI headline and summary · ":"Natural AI headline only · ")+(r.language==="fr"?"Français":"English"):"Natural headline recording not available yet.";
box.append(status);
if(!r)return box;
const audio=document.createElement("audio");audio.controls=true;audio.preload="none";audio.src=r.audioUrl;audio.style.cssText="display:block;width:100%;max-width:100%;min-width:0";audio.setAttribute("aria-label","Listen to post: "+story.title);
const stop=document.createElement("button");stop.type="button";stop.textContent="Stop audio";stop.addEventListener("click",()=>{audio.pause();if(Number.isFinite(audio.duration))audio.currentTime=0});
audio.addEventListener("error",()=>{status.textContent="Recording could not load. Try again after refreshing."});box.append(audio,stop);return box;
}
document.addEventListener("play",e=>{if(e.target.tagName!=="AUDIO")return;document.querySelectorAll("audio").forEach(a=>{if(a!==e.target)a.pause()});if(window.speechSynthesis)window.speechSynthesis.cancel();document.dispatchEvent(new Event("im:natural-post-play"))},true);
function stopAll(){document.querySelectorAll(".im-natural-post-audio audio").forEach(a=>a.pause())}
window.addEventListener("hashchange",stopAll);window.addEventListener("pagehide",stopAll);
function dashboard(stories){
const box=document.getElementById("imDashboardVoice");if(!box)return;
const $=id=>document.getElementById(id),audio=$("imDashboardPlayer"),status=$("imDashboardStatus"),lang=$("imDashboardLanguage");
let queue=[],index=0,active=false;
const matching=()=>stories.map(s=>({s,r:find(s)})).filter(x=>x.r&&(lang.value==="all"||x.r.language===lang.value));
function count(){const items=matching();$("imDashboardCoverage").textContent=items.length+" of "+stories.length+" posts have matching recordings; "+items.filter(x=>x.r.summary).length+" include full published summaries.";return items;}
function stop(){active=false;queue=[];index=0;audio.pause();audio.removeAttribute("src");audio.load();status.textContent="News reader stopped."}
function play(){if(!active)return;if(index>=queue.length){if($("imDashboardRepeat").checked&&queue.length)index=0;else{stop();status.textContent="All available posts completed.";return}}const x=queue[index];audio.src=x.r.audioUrl;status.textContent=(index+1)+" / "+queue.length+" · "+x.s.title;audio.play().catch(()=>{status.textContent="Tap Play on the audio player to resume."})}
$("imDashboardStart").addEventListener("click",()=>{queue=count();index=0;if(!queue.length){status.textContent="No matching recordings available.";return}active=true;play()});
$("imDashboardNext").addEventListener("click",()=>{if(active){index++;play()}});
$("imDashboardStop").addEventListener("click",stop);audio.addEventListener("ended",()=>{if(active){index++;play()}});audio.addEventListener("error",()=>{if(active){active=false;status.textContent="Recording unavailable. Start again after refreshing."}});
lang.addEventListener("change",()=>{stop();count()});document.addEventListener("play",e=>{if(e.target.tagName==="AUDIO"&&e.target!==audio&&active)stop()},true);
window.addEventListener("hashchange",()=>{if(location.hash.startsWith("#article/"))stop()});window.addEventListener("pagehide",stop);count();
}
window.INSIDE_MAURITIUS_NATURAL_POST_AUDIO={panel,find,stopAll,dashboard};
})();