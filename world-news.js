(() => {"use strict";
const directory = [
["Reuters","https://www.reuters.com/world/"],["Associated Press","https://apnews.com/world-news"],["AFP","https://www.afp.com/"],["BBC News","https://www.bbc.com/news/world"],["Al Jazeera","https://www.aljazeera.com/news/"],["France 24","https://www.france24.com/en/"],["DW News","https://www.dw.com/en/top-stories/s-9097"],["The Guardian","https://www.theguardian.com/world"],["Africanews","https://www.africanews.com/"],["SABC News","https://www.sabcnews.com/"],["The Hindu","https://www.thehindu.com/"],["NHK World","https://www3.nhk.or.jp/nhkworld/"],["CNA","https://www.channelnewsasia.com/"],["Arab News","https://www.arabnews.com/"],["ABC Australia","https://www.abc.net.au/news/"],["CBC News","https://www.cbc.ca/news"],["Agência Brasil","https://agenciabrasil.ebc.com.br/"]
];
const data=window.INSIDE_MAURITIUS_WORLD_NEWS || {generatedAt:null,headlines:[]};
let region="All", term="";
const results=document.getElementById("headlines");
const directoryEl=document.getElementById("directory");
directory.forEach(([name,url])=>{let a=document.createElement("a");a.textContent=name+" ↗";a.href=url;a.target="_blank";a.rel="noopener noreferrer";directoryEl.append(a);});
function safeURL(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:null}catch{return null}}
function localDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?"Date unavailable":new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Indian/Mauritius"}).format(d)+" MUT";}
function render(){
results.replaceChildren();
const rows=(Array.isArray(data.headlines)?data.headlines:[]).filter(x=>(region==="All"||x.region===region)&&(!term||(x.title+" "+x.source).toLowerCase().includes(term)));
document.getElementById("feedStatus").textContent=data.generatedAt ? "Last successful data refresh: "+localDate(data.generatedAt)+" · "+(data.headlines||[]).length+" sourced headlines" : "Feed data not yet generated; source directory is available below.";
if(!rows.length){const p=document.createElement("p");p.className="empty";p.textContent="No source headlines available for this selection. Try another region or visit the source directory.";results.append(p);return}
for(const x of rows){const link=safeURL(x.url);if(!link)continue;const card=document.createElement("article");card.className="item";const meta=document.createElement("div");meta.className="meta";meta.textContent=x.region+" · "+x.source;const title=document.createElement("h3");title.textContent=x.title;const date=document.createElement("p");const tm=document.createElement("time");tm.textContent="Source published: "+localDate(x.publishedAt);if(x.publishedAt)tm.dateTime=x.publishedAt;date.append(tm);const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Read original source ↗";card.append(meta,title,date,a);results.append(card)}
}
document.getElementById("regionFilters").addEventListener("click",e=>{const b=e.target.closest("button[data-region]");if(!b)return;region=b.dataset.region;document.querySelectorAll("[data-region]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));render()});
document.getElementById("search").addEventListener("input",e=>{term=e.target.value.trim().toLowerCase();render()});render();
})();