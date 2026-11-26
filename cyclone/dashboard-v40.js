/* V40: map-first controls, source validation, same-time comparison. */
(function(){
'use strict';
const e=id=>document.getElementById(id),map=window.cycloneWindMap;
if(!map)return;
const finite=Number.isFinite,iso=t=>new Date(t).toISOString().slice(0,16).replace('T',' ')+' UTC';
const specs=[{id:'gfs',name:'NOAA GFS',file:'wind.json',age:18},{id:'ifs',name:'ECMWF IFS',file:'ifs.json',age:24},{id:'icon',name:'DWD ICON',file:'icon.json',age:24},{id:'waves',name:'NOAA GFS-Wave',file:'waves.json',age:18},{id:'sst',name:'NOAA OISST',file:'sst.json',age:168}];
const models=specs.slice(0,3);
const places={'Mauritius':[-20.2,57.5,7],'Port Louis':[-20.16,57.5,10],'Rodrigues':[-19.72,63.42,9],'Réunion':[-21.12,55.54,9],'Agalega':[-10.4,56.6,9],'Madagascar':[-19,46.7,5],'Seychelles':[-4.62,55.45,8],'Mayotte':[-12.8,45.16,9],'Comoros':[-11.7,43.3,8],'Southwest Indian Ocean':[-19,62,4],'World':[12,0,2]};
for(const name of Object.keys(places)){const opt=document.createElement('option');opt.value=name;e('places40').append(opt)}
function go(p){map.setView(p.slice(0,2),p[2]);e('position').textContent='Map centred on '+p[0].toFixed(2)+'°, '+p[1].toFixed(2)+'°'}
e('placeForm').onsubmit=ev=>{ev.preventDefault();const q=e('placeInput').value.trim();const match=Object.keys(places).find(k=>k.toLowerCase()===q.toLowerCase());if(match){go(places[match]);return}const n=q.replace(/−/g,'-').match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);if(n&&Math.abs(+n[1])<=85&&Math.abs(+n[2])<=180){go([+n[1],+n[2],7]);return}e('position').textContent='Choose a suggested regional location or enter latitude, longitude.'};
e('homeMU').onclick=()=>{e('placeInput').value='Mauritius';go(places.Mauritius)};
document.body.classList.add('map-dark');e('darkMap').onclick=()=>{const on=document.body.classList.toggle('map-dark');e('darkMap').setAttribute('aria-pressed',String(on));e('darkMap').textContent=on?'Dark map':'Light map'};
let verified=null;
window.addEventListener('cyclone-mms-position',ev=>{verified=ev.detail;e('followMMS').disabled=!verified;if(!verified){e('followMMS').setAttribute('aria-pressed','false');return}if(e('followMMS').getAttribute('aria-pressed')==='true')go([verified.lat,verified.lon,5])});e('followMMS').disabled=true;e('followMMS').onclick=()=>{if(!verified)return;const on=e('followMMS').getAttribute('aria-pressed')!=='true';e('followMMS').setAttribute('aria-pressed',String(on));if(on)go([verified.lat,verified.lon,5])};
map.on('dragstart',()=>e('followMMS').setAttribute('aria-pressed','false'));
function resize(){requestAnimationFrame(()=>map.invalidateSize())}
e('panelToggle').onclick=()=>{const on=document.body.classList.toggle('v40maponly');e('panelToggle').setAttribute('aria-pressed',String(on));e('panelToggle').textContent=on?'Show information':'Hide information';resize()};
e('tv40').onclick=async()=>{const on=document.body.classList.toggle('v40tv');e('tv40').setAttribute('aria-pressed',String(on));e('tv40').textContent=on?'Exit TV mode':'TV mode';try{if(on&&!document.fullscreenElement)await document.documentElement.requestFullscreen();else if(!on&&document.fullscreenElement)await document.exitFullscreen()}catch{e('position').textContent='TV layout active; browser full screen unavailable.'}resize()};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){document.body.classList.remove('v40tv');e('tv40').setAttribute('aria-pressed','false');e('tv40').textContent='TV mode'}resize()});if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(map.getContainer());
const rows=new Map();for(const s of specs){const row=document.createElement('div');row.className='healthRow';const name=document.createElement('strong');name.textContent=s.name;const badge=document.createElement('span');badge.dataset.state='unknown';badge.textContent='Not checked';const note=document.createElement('small');note.textContent='—';row.append(name,badge,note);e('healthRows').append(row);rows.set(s.id,{badge,note})}
function mark(s,status,message,state){const r=rows.get(s.id);r.badge.textContent=status;r.badge.dataset.state=state;r.note.textContent=message}
function arr(a,n,lo,hi,nullable=false){return Array.isArray(a)&&a.length===n&&a.every(v=>nullable&&v===null||typeof v==='number'&&finite(v)&&v>=lo&&v<=hi)&&(!nullable||a.some(v=>v!==null))}
function frames(d,t){return Array.isArray(d.frames)&&d.frames.length===4&&d.frames.every((f,i)=>f.hour===[0,12,24,48][i]&&Date.parse(f.valid)===t+f.hour*3600000)}
function inspect(s,d,now=Date.now()){
 const t=Date.parse(s.id==='sst'?d?.date:d?.cycle),age=now-t;
 if(d?.schema!==1||!finite(age)||age<-(s.id==='sst'?43200000:300000))throw Error('Invalid timestamp or schema');
 if(age>s.age*3600000)throw Error('Stale · '+iso(t));
 if(s.id==='sst'||s.id==='waves'){
 const g=d.grid;if(!g||g.nx!==180||!Number.isInteger(g.ny)||g.ny<60||g.ny>91||g.dx!==2||g.dy!==2||!finite(g.lat0)||g.lat0< -90||g.lat0+2*(g.ny-1)>90.001||!finite(g.lon0)||g.lon0<0||g.lon0>=360)throw Error('Invalid marine grid');
 const n=g.nx*g.ny;if(s.id==='sst'){if(!['NOAA OISST v2.1 preliminary','NOAA OISST v2.1 final'].includes(d.source)||!arr(d.values,n,-4,45,true))throw Error('Invalid SST');return 'Daily analysis '+iso(t)}
 if(d.source!==s.name||!frames(d,t)||!d.frames.every(f=>arr(f.height,n,0,40,true)))throw Error('Invalid wave forecast');
 return 'Run '+iso(t)+' · height'+(d.frames.every(f=>arr(f.period,n,0,60,true))?', period':'')+(d.frames.every(f=>arr(f.direction,n,0,360,true))?', direction':'')
 }
 if(d.model!==s.name||d.nx!==180||d.ny!==91||d.spacing!==2||!frames(d,t)||!d.frames.every(f=>arr(f.u,16380,-150,150)&&arr(f.v,16380,-150,150)))throw Error('Invalid model grid');
 return 'Run '+iso(t)+' · wind'+(d.frames.every(f=>arr(f.p,16380,800,1150))?', pressure':'')+(d.frames.every(f=>arr(f.t,16380,-100,75))?', temperature':'')
}
let pending=null,cache=new Map();
async function check(){if(pending)return pending;e('healthCheck').disabled=true;pending=(async()=>{const results=await Promise.all(specs.map(async s=>{mark(s,'Checking','Fetching current file','unknown');try{const response=await fetch(s.file,{cache:'no-cache',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(response.status===404?'No published data file':'HTTP '+response.status);const d=await response.json(),note=inspect(s,d);mark(s,'Available',note,'ready');return [s.id,d]}catch(err){mark(s,'Unavailable',String(err.message||err),'failed');return [s.id,null]}}));cache=new Map(results);return cache})().finally(()=>{pending=null;e('healthCheck').disabled=false});return pending}
e('healthCheck').onclick=check;
function sample(q,lat,lon){if(!Array.isArray(q)||q.length!==16380||!finite(lat)||!finite(lon)||Math.abs(lat)>90)return null;const x=((lon%360+360)%360)/2,y=(90-lat)/2,i=Math.floor(x),j=Math.min(89,Math.floor(y)),a=x-i,b=y-j,k=(i+1)%180,vs=[q[j*180+i],q[j*180+k],q[(j+1)*180+i],q[(j+1)*180+k]];if(vs.some(v=>typeof v!=='number'||!finite(v)))return null;return (vs[0]*(1-a)+vs[1]*a)*(1-b)+(vs[2]*(1-a)+vs[3]*a)*b}
let comparePoint=null;
function renderCompare(){const t=+e('compareTime').value;if(!comparePoint||!finite(t)||!t)return;const p=comparePoint;const lines=['At '+p.lat.toFixed(2)+'°, '+p.lng.toFixed(2)+'° · '+iso(t)];for(const s of models){const d=cache.get(s.id),f=d?.frames.find(f=>Date.parse(f.valid)===t);if(!d||!f){lines.push(s.name+': no matching forecast');continue}try{inspect(s,d)}catch{lines.push(s.name+': expired');continue}const u=sample(f.u,p.lat,p.lng),v=sample(f.v,p.lat,p.lng),pr=sample(f.p,p.lat,p.lng),temp=sample(f.t,p.lat,p.lng);lines.push(s.name+' · '+(u!==null&&v!==null?(Math.hypot(u,v)*3.6).toFixed(1)+' km/h':'wind unavailable')+' · '+(pr===null?'—':pr.toFixed(1)+' hPa')+' · '+(temp===null?'—':temp.toFixed(1)+' °C'))}e('compareRows').textContent=lines.join('\n')}
e('compareCheck').onclick=async()=>{e('compareCheck').disabled=true;e('compareRows').textContent='Checking model runs…';comparePoint=map.getCenter();await check();const available=models.map(s=>cache.get(s.id)).filter(Boolean),sel=e('compareTime');sel.replaceChildren();const times=available.length?available[0].frames.map(f=>Date.parse(f.valid)).filter(t=>available.every(d=>d.frames.some(f=>Date.parse(f.valid)===t))):[];for(const t of times){const opt=document.createElement('option');opt.value=String(t);opt.textContent=iso(t);sel.append(opt)}sel.disabled=!times.length;if(available.length<2){e('compareRows').textContent='Fewer than two validated models available. No cross-model comparison possible.'}else if(!times.length){e('compareRows').textContent='Model runs have no identical valid times. No comparison calculated.'}else{const next=times.find(t=>t>=Date.now());if(next)sel.value=String(next);renderCompare()}e('compareCheck').disabled=false};e('compareTime').onchange=renderCompare;
check();setInterval(()=>{if(!document.hidden)check()},900000);
})();
