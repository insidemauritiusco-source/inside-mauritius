(function(){'use strict';
const e=id=>document.getElementById(id),map=window.cycloneWindMap;if(!map)return;
const status=e('investStatus45'),toggle=e('investToggle45'),group=L.layerGroup().addTo(map);
map.createPane('investPaths45');map.getPane('investPaths45').style.zIndex=615;
map.createPane('investMarkers45');map.getPane('investMarkers45').style.zIndex=640;
let data=null,busy=false;
function validSystems(d,now=Date.now()){
 const age=now-Date.parse(d?.checked_at);
 if(d?.schema!==1||d.status!=='ok'||!Number.isFinite(age)||age< -300000||age>90*60000||!Array.isArray(d.systems))return [];
 return d.systems.filter(s=>/^SH\d{6}$/.test(s.id)&&typeof s.invest==='boolean'&&s.invest===(Number(s.id.slice(2,4))>=90)&&Array.isArray(s.points)&&s.points.length>0&&s.points.length<=100&&s.points.every((p,i)=>Number.isFinite(p.lat)&&p.lat>=-45&&p.lat<0&&Number.isFinite(p.lon)&&p.lon>=30&&p.lon<=100&&Number.isFinite(Date.parse(p.time))&&Date.parse(p.time)<=now+300000&&now-Date.parse(p.time)<=72*3600000&&(!i||Date.parse(p.time)>Date.parse(s.points[i-1].time)))&&now-Date.parse(s.points.at(-1).time)<=36*3600000);
}
function display(){
 group.clearLayers();e('investList45').replaceChildren();const systems=validSystems(data);
 window.dispatchEvent(new CustomEvent('cyclone-invest-reports',{detail:systems}));
 const on=toggle.getAttribute('aria-pressed')==='true';
 status.textContent=systems.length?systems.length+' dated JTWC system reports · invests are not confirmed cyclones.':'No recent validated JTWC reports available from this feed; this does not establish that no disturbances exist.';
 for(const s of systems){const p=s.points.at(-1),id=s.id.slice(2,4)+'S',name=(s.invest?'Invest ':'System ')+id,stamp=new Date(p.time).toLocaleString('en-GB',{timeZone:'Indian/Mauritius',dateStyle:'short',timeStyle:'short'})+' MUT',age=(Date.now()-Date.parse(p.time))/3600000;
 const detail=document.createElement('div');detail.className='investDetail45';const title=document.createElement('strong');title.textContent=name;const line=document.createElement('div');line.textContent=stamp+' · '+(Number.isFinite(p.wind_kt)?p.wind_kt+' kt':'Wind —')+' · '+(Number.isFinite(p.pressure_hpa)?p.pressure_hpa+' hPa':'Pressure —');const note=document.createElement('small');note.textContent=(age>12?'Delayed · ':'')+'JTWC track report; not a forecast or official local warning';detail.append(title,line,note);
 const btn=document.createElement('button');btn.textContent=name+' · '+stamp;btn.onclick=()=>{window.dispatchEvent(new CustomEvent('cyclone-navigate',{detail:{lat:p.lat,lon:p.lon}}));map.setView([p.lat,p.lon],Math.max(map.getMinZoom(),5))};e('investList45').append(btn);
 if(!on)continue;
 const badge=document.createElement('span');badge.className='investBadge45'+(s.invest?'':' numbered45');badge.textContent=id;
 const marker=L.marker([p.lat,p.lon],{pane:'investMarkers45',icon:L.divIcon({className:'investMarker45',html:badge,iconSize:[48,28],iconAnchor:[24,14]}),title:name}).addTo(group);marker.bindPopup(detail);marker.on('click',()=>window.dispatchEvent(new CustomEvent('cyclone-select-report',{detail:s.id})));
 if(s.points.length>1)L.polyline(s.points.map(q=>[q.lat,q.lon]),{pane:'investPaths45',color:s.invest?'#f6ce65':'#f6a0ad',weight:2,dashArray:'4 7',opacity:.8,interactive:false}).addTo(group);
 }
}
async function load(){if(busy)return;busy=true;try{const r=await fetch('indian-systems.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();data=await r.json()}catch{data=null}finally{busy=false;display()}}
toggle.onclick=()=>{toggle.setAttribute('aria-pressed',String(toggle.getAttribute('aria-pressed')!=='true'));display()};
e('refresh').addEventListener('click',load);setInterval(()=>{if(!document.hidden)load()},300000);setInterval(display,60000);load();
})();