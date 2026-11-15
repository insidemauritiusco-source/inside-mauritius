/* Inside Mauritius aerial gallery — Commons API, licensed media only. */
(() => {
 const places=[["Maurice","Mauritius aerial coastline"],["La Réunion","Reunion island aerial coastline"],["Rodrigues","Rodrigues island aerial lagoon"],["Seychelles","Seychelles aerial islands"],["Agaléga","Agalega island aerial"],["France","France Paris aerial panorama"]];
 const root=document.getElementById("imAerialGallery"); if(!root)return;
 const grid=root.querySelector(".im-aerial-grid"),status=root.querySelector(".im-aerial-status");
 const allowed=/^(cc-by(?:-sa)?(?:-[0-9.]+)?|cc0|public domain|pd)$/i;
 function card(place,query){const article=document.createElement("article");article.className="im-aerial-card";const heading=document.createElement("h3");heading.textContent=place;const area=document.createElement("div");area.className="im-aerial-photo";area.textContent="Photo en attente de vérification";const credit=document.createElement("p");credit.className="im-aerial-credit";const link=document.createElement("a");link.href="https://commons.wikimedia.org/w/index.php?search="+encodeURIComponent(query)+"&title=Special:MediaSearch&type=image";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Voir les photos sur Wikimedia Commons";article.append(area,heading,credit,link);grid.append(article);return {area,credit};}
 const cards=places.map(([p,q])=>card(p,q));
 const plain=html=>{const el=document.createElement("div");el.innerHTML=html||"";return el.textContent||"";};
 async function refresh(){
 status.textContent="Recherche de photos sous licence libre…";
 let loaded=0;
 await Promise.all(places.map(async ([place,query],i)=>{
  const {area,credit}=cards[i];
  try {
   const url="https://commons.wikimedia.org/w/api.php?origin=*&action=query&generator=search&gsrsearch="+encodeURIComponent('filetype:bitmap '+query)+"&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json";
   const response=await fetch(url);if(!response.ok)throw Error("API");
   const data=await response.json();const pages=Object.values(data.query?.pages||{});
   const match=pages.find(p=>{const info=p.imageinfo?.[0],meta=info?.extmetadata||{};const license=plain(meta.LicenseShortName?.value);return info?.thumburl&&allowed.test(license)&&!/(fair use|non-free)/i.test(license);});
   if(!match)return;
   const info=match.imageinfo[0],meta=info.extmetadata||{};
   const img=document.createElement("img");img.src=info.thumburl;img.alt="Vue aérienne — "+place;img.loading="lazy";img.decoding="async";area.replaceChildren(img);
   const author=plain(meta.Artist?.value).slice(0,100)||"Auteur sur Commons";const license=plain(meta.LicenseShortName?.value);
   const a=document.createElement("a");a.href=info.descriptionurl||"https://commons.wikimedia.org/";a.target="_blank";a.rel="noopener noreferrer";a.textContent=author+" · "+license+" · Source et attribution";credit.replaceChildren(a);loaded++;
  }catch(e){/* Keep truthful fallback when Commons is unavailable. */}
 }));
 status.textContent=loaded+" / "+places.length+" photos disponibles · Wikimedia Commons · Actualisation horaire";
 }
 refresh();setInterval(refresh,60*60*1000);
})();