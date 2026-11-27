(() => {
"use strict";
const $=id=>document.getElementById(id),player=$("player");
let catalog=[],heard=new Set(),active=false,refreshing=false,token=0,now=null,retry=null;
const localPath=/^audio\/headline-[a-f0-9]{32}\.mp3$/;
function url(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:null}catch{return null}}
function data(text){const i=text.indexOf("=");if(i<0)throw Error("Invalid registry");return JSON.parse(text.slice(i+1).trim().replace(/;$/,""))}
async function read(name){const r=await fetch(name+"?radio="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("Feed unavailable");return data(await r.text())}
function eligible(){const c=$("coverage").value,l=$("language").value;return catalog.filter(x=>(l==="all"||x.language===l)&&(c==="all"||(c==="local"&&x.local)||(c==="world"&&!x.local)||(c==="topfm"&&x.topfm)))}
function label(){const n=eligible();$("counts").textContent=n.length+" matching recorded headlines · "+catalog.filter(x=>x.local).length+" Mauritius recordings";}
async function refresh(){if(refreshing)return;refreshing=true;try{
const [local,world,records]=await Promise.all(["newsroom-data.js","world-news-data.js","headline-audio-data.js"].map(read));
const map=new Map(records.filter(r=>r?.engine==="Kokoro"&&r.generated===true&&["fr","en"].includes(r.language)&&localPath.test(r.audioUrl)&&url(r.sourceUrl)).map(r=>[JSON.stringify([url(r.sourceUrl),r.title]),r]));
const seen=new Set(),next=[];for(const [rows,isLocal] of [[local,true],[world.headlines,false]])for(const r of rows){
const source=[r.sourceUrl,r.videoUrl,r.tiktokUrl,r.url].map(url).find(Boolean);const k=JSON.stringify([source,r.title]);const rec=map.get(k);if(!rec||seen.has(k))continue;seen.add(k);
const publisher=String(r.sourceName||r.source||r.author||"Publisher");
const host=new URL(source).hostname;next.push({key:k,title:r.title,source,publisher,local:isLocal&&r.category!=="World",topfm:/\btop\s*fm\b/i.test(publisher)||/(^|\.)topfm\.mu$/i.test(host),language:rec.language,audio:rec.audioUrl,stamp:Date.parse(r.publishedAt||r.date||"")||0});
}if(next.length){catalog=next.sort((a,b)=>Number(b.local)-Number(a.local)||b.stamp-a.stamp);label();if(active&&!now)advance()}else if(!catalog.length){$("status").textContent="No matching audio published yet."}
}catch(e){$("status").textContent="Refresh unavailable. Previously loaded audio is retained."}finally{refreshing=false}}
function stop(){active=false;token++;now=null;clearTimeout(retry);player.pause();player.removeAttribute("src");player.load();$("next").disabled=true;$("status").textContent="Stopped."}
async function advance(){if(!active)return;clearTimeout(retry);const items=eligible();let entry=items.find(x=>!heard.has(x.key));if(!entry&&$("repeat").checked&&items.length){heard.clear();entry=items[0]}if(!entry){now=null;$("status").textContent="No new matching recorded news. Checking for updates.";return}
const t=++token;now=entry;heard.add(entry.key);$("current").textContent=entry.title;$("source").href=entry.source;$("source").hidden=false;$("source").textContent="Original report · "+entry.publisher;$("status").textContent="Playing "+entry.language.toUpperCase()+" AI headline";player.src=entry.audio;
try{await player.play()}catch(e){if(t===token&&active){$("status").textContent="Playback interrupted. Tap Play or Next.";}}
}
$("start").addEventListener("click",()=>{if(active){if(now)player.play().catch(()=>{});else advance();return}active=true;heard.clear();$("next").disabled=false;advance();if(!catalog.length)refresh()});
$("stop").addEventListener("click",stop);$("next").addEventListener("click",advance);player.addEventListener("ended",()=>{now=null;advance()});player.addEventListener("error",()=>{if(active&&now){$("status").textContent="Audio unavailable. Trying the next recording.";const t=token;retry=setTimeout(()=>{if(active&&token===t){now=null;const next=eligible().find(x=>!heard.has(x.key));if(next)advance();else $("status").textContent="No more unplayed recordings. Choose Start again or change filter."}},1500)}});
for(const id of ["coverage","language"]){$(id).addEventListener("change",()=>{label();heard.clear();if(active){now=null;player.pause();advance()}})}
$("full").addEventListener("click",()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{})});
$("topRadio").addEventListener("click",stop);window.addEventListener("pagehide",stop);function clock(){$("clock").textContent=new Intl.DateTimeFormat("en-GB",{timeZone:"Indian/Mauritius",dateStyle:"medium",timeStyle:"medium"}).format(new Date())+" MUT"}clock();setInterval(clock,1000);refresh();setInterval(refresh,300000);
})();