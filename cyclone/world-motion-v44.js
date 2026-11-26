(function(){'use strict';
const e=id=>document.getElementById(id),map=window.cycloneWindMap;if(!map)return;
const button=e('worldMotion44'),bar=e('worldBar44'),status=e('worldStatus44'),seek=e('worldSeek44'),play=e('worldPlay44'),speed=e('worldSpeed44');
let active=false,token=0,frames=[],index=0,timer=null,overlay=null,busy=false,auto=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function validFrames(d,now=Date.now()){
 if(d?.schema!==1||d.source!=='NOAA GMGSI LWIR'||JSON.stringify(d.bounds)!=='[-60,-180,60,180]'||!Array.isArray(d.frames))return [];
 return d.frames.filter(f=>{const t=Date.parse(f.time);return Number.isFinite(t)&&t<=now+300000&&now-t<=12*3600000&&f.file===new Date(t).toISOString().slice(0,13).replace(/[-T]/g,'')+'.png'}).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).filter((f,i,a)=>!i||f.time!==a[i-1].time).slice(-6);
}
function stopPlay(){clearInterval(timer);timer=null;play.textContent='Play'}
function remove(){if(overlay){map.removeLayer(overlay);overlay=null}}
function sync(){seek.max=String(Math.max(0,frames.length-1));seek.value=String(index);seek.disabled=frames.length<2;play.disabled=frames.length<2}
function draw(){
 if(!active||!frames.length)return;const f=frames[index];
 if(Date.now()-Date.parse(f.time)>12*3600000){stopPlay();remove();status.textContent='Observation expired';return}
 if(overlay)overlay.setUrl('world-motion/'+f.file);else overlay=L.imageOverlay('world-motion/'+f.file,[[-60,-180],[60,180]],{pane:'regionalIR42',opacity:1,interactive:false,attribution:'NOAA GMGSI · display-reprojected by Inside Mauritius'}).addTo(map);
 status.textContent=new Date(f.time).toLocaleString('en-GB',{timeZone:'Indian/Mauritius',dateStyle:'medium',timeStyle:'short'})+' MUT · '+(index+1)+'/'+frames.length+' · NOAA delayed IR · 60°S–60°N';sync();
}
function startPlay(){stopPlay();if(!active||frames.length<2||document.hidden)return;play.textContent='Pause';timer=setInterval(()=>{index=(index+1)%frames.length;draw()},1400/Number(speed.value))}
async function load(){if(!active||busy)return;busy=true;const current=token;try{
 const r=await fetch('world-motion/manifest.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const next=validFrames(await r.json());if(current!==token)return;if(next.length<2)throw Error();
 if(frames.map(f=>f.file).join()===next.map(f=>f.file).join())return;
 const loaded=await Promise.all(next.map(f=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(f);im.onerror=()=>resolve(null);im.src='world-motion/'+f.file})));
 if(current!==token)return;frames=loaded.filter(Boolean);if(frames.length<2)throw Error();stopPlay();index=0;draw();if(auto&&!reduced.matches)startPlay();
 }catch{if(current===token){stopPlay();remove();frames=[];index=0;sync();status.textContent='NOAA world imagery unavailable · wind mode remains available; use official viewer.'}}finally{busy=false;if(active&&current!==token)load()}}
function off(){if(!active)return;active=false;token++;stopPlay();remove();frames=[];index=0;sync();button.setAttribute('aria-pressed','false');bar.hidden=true}
function on(){if(active){off();return}window.dispatchEvent(new Event('cyclone-imagery-off'));window.dispatchEvent(new Event('cyclone-atmosphere-off'));window.dispatchEvent(new Event('cyclone-marine-off'));active=true;token++;auto=true;bar.hidden=false;button.setAttribute('aria-pressed','true');map.invalidateSize({pan:false});map.setView([0,0],map.getMinZoom(),{animate:false});status.textContent='Checking NOAA hourly satellite sequence…';load()}
button.onclick=on;play.onclick=()=>{if(timer!==null){auto=false;stopPlay()}else{auto=true;startPlay()}};seek.oninput=()=>{auto=false;stopPlay();index=+seek.value;draw()};speed.onchange=()=>{if(timer!==null)startPlay()};
e('worldWind44').onclick=()=>{off();window.dispatchEvent(new Event('cyclone-imagery-off'));window.dispatchEvent(new Event('cyclone-marine-off'));map.invalidateSize({pan:false});map.setView([0,0],map.getMinZoom(),{animate:false});e('gfsMode').value='wind';if(e('forecastModel').value!=='gfs'){e('forecastModel').value='gfs';e('forecastModel').dispatchEvent(new Event('change'))}else e('gfsMode').dispatchEvent(new Event('change'))};
window.addEventListener('cyclone-imagery-off',off);for(const id of ['ir42','globalIR43','world43','sat','weatherLayer','day','prevDay','nextDay','quickIR41','quickRegion41','quickWorld41','quickWind41'])e(id).addEventListener(['weatherLayer','day'].includes(id)?'change':'click',off);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlay();else if(active){load();if(auto&&!reduced.matches)startPlay()}});
setInterval(()=>{if(active&&!document.hidden)load()},300000);
if(new URLSearchParams(location.search).get('view')==='world-motion')requestAnimationFrame(()=>requestAnimationFrame(on));
})();