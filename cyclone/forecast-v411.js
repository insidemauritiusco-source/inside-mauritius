/* V40.2 official forecast cards + dated regional IR; no generated forecast points. */
(function(){'use strict';
const ROOT='https://insidemauritiusco-source.github.io/cyclone-watch-pro/';
const OFFICIAL='https://wwmiws.wmo.int/index.php/metareas/bulletinset/8S/html';
const BOUNDS=[43,83,-29,-4];
const fresh=(t,max,n)=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=n+300000&&n-Date.parse(t)<=max;
const inside=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&p.lat>=-45&&p.lat<0&&p.lon>=30&&p.lon<=90;
const wind=p=>Number.isInteger(p?.max_wind_kt)&&p.max_wind_kt>=0&&p.max_wind_kt<=200?p.max_wind_kt:null;
const pressure=p=>typeof p?.pressure_hpa==='number'&&Number.isFinite(p.pressure_hpa)&&p.pressure_hpa>=800&&p.pressure_hpa<=1100?p.pressure_hpa:null;
function selectForecasts(f,n=Date.now()){
 if(f?.schema!==1||f.issuer!=='Meteo-France RSMC La Reunion'||f.source!==OFFICIAL||f.status!=='ok'||!fresh(f.checked_at,2700000,n)||!Array.isArray(f.bulletins))return [];
 const selected=new Map();
 for(const b of f.bulletins){
 if(!Number.isInteger(b?.system_number)||b.system_number<1||b.system_number>99||!Number.isInteger(b.bulletin_number)||b.bulletin_number<1||!fresh(b.issued_at,86400000,n)||!inside(b.anchor)||!Array.isArray(b.points)||!b.points.length||b.points.length>40||!b.points.every((p,i)=>inside(p)&&Number.isInteger(p.hours)&&p.hours>(i?b.points[i-1].hours:0)&&p.hours<=120&&Date.parse(p.valid_at)===Date.parse(b.issued_at)+p.hours*3600000)||!b.points.some(p=>Date.parse(p.valid_at)>n))continue;
 const old=selected.get(b.system_number);if(!old||Date.parse(b.issued_at)>Date.parse(old.issued_at)||b.issued_at===old.issued_at&&b.bulletin_number>old.bulletin_number)selected.set(b.system_number,b);
 }
 return [...selected.values()].sort((a,b)=>a.system_number-b.system_number);
}
function selectFrame(m,n=Date.now()){
 if(m?.status!=='ok'||m.source!=='https://view.eumetsat.int/geoserver/wms'||m.crs!=='EPSG:4326'||JSON.stringify(m.bounds)!==JSON.stringify(BOUNDS)||!Array.isArray(m.frames))return null;
 const frames=m.frames.filter(f=>fresh(f.captured_at,86400000,n)&&Date.parse(f.captured_at)<=n-3600000&&/^[a-f0-9]{64}$/.test(f.sha256||'')&&f.raw==='tracker-media/'+f.sha256+'-raw.jpg'&&(!f.enhanced||f.enhanced==='tracker-media/'+f.sha256+'-ir.jpg'));
 return frames.sort((a,b)=>Date.parse(b.captured_at)-Date.parse(a.captured_at))[0]||null;
}
const merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const invMerc=y=>(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI;
function sourceRow(row,height,south,north){const y=merc(north)-(row+.5)/height*(merc(north)-merc(south));return Math.max(0,Math.min(height-1,Math.floor((north-invMerc(y))/(north-south)*height)))}

const e=id=>document.getElementById(id),map=window.cycloneWindMap;
if(!map){e('forecast42Status').textContent='Map unavailable';e('ir42Status').textContent='Map unavailable';return}
const dformat=new Intl.DateTimeFormat('en-GB',{timeZone:'Indian/Mauritius',weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const fmt=t=>dformat.format(new Date(t))+' MUT';
const group=L.layerGroup().addTo(map);
map.createPane('forecastPaths42');map.getPane('forecastPaths42').style.zIndex=610;
map.createPane('forecastDots42');map.getPane('forecastDots42').style.zIndex=625;
map.createPane('regionalIR42');map.getPane('regionalIR42').style.zIndex=235;
let data=null,tracks=[],forecastToken=0,irToken=0,overlay=null,irKey='',initialFit=false,changedView=false,irBusy=false;
let labelsOn=true,forecastsOn=true,irOn=false;let globalOn=true,globalLayer=null;
map.on('dragstart zoomstart',()=>{changedView=true});
function text(id,s){e(id).textContent=s}
function fit(){const points=tracks.flatMap(b=>[b.anchor,...b.points].map(p=>[p.lat,p.lon]));if(points.length)map.fitBounds(points,{padding:[55,55],maxZoom:6})}
function button(id,on){e(id).setAttribute('aria-pressed',String(on))}
function labelNode(b,p,anchor=false){
 const node=document.createElement('div');node.className='f42card';
 const title=document.createElement('strong');title.textContent=anchor?'System '+String(b.system_number).padStart(2,'0')+' · bulletin position':fmt(p.valid_at);
 const line=document.createElement('span');line.textContent=(wind(p)===null?'Wind —':wind(p)+' kt')+' | '+(pressure(p)===null?'Pressure —':pressure(p)+' hPa');
 const sub=document.createElement('small');sub.textContent=anchor?'Official issue '+fmt(b.issued_at):'+'+p.hours+' h forecast'+(Date.parse(p.valid_at)<=Date.now()?' · elapsed':'');
 node.append(title,line,sub);return node;
}
function draw(){
 group.clearLayers();e('forecast42List').replaceChildren();tracks=selectForecasts(data);
 e('fitForecast42').disabled=!tracks.length;
 if(!tracks.length){text('forecast42Status','No recent verified RSMC La Réunion forecast available. No forecast path drawn.');return}
 text('forecast42Status',tracks.length+' official system forecast'+(tracks.length===1?'':'s')+' · RSMC La Réunion / WMO · forecast points, not observations. Wind is 10-minute sustained; — means not reported.');
 for(const b of tracks){
 const box=document.createElement('div');box.className='f42system';const head=document.createElement('button');head.type='button';head.textContent='System '+String(b.system_number).padStart(2,'0')+' · Bulletin '+b.bulletin_number+' · '+fmt(b.issued_at);head.onclick=()=>map.fitBounds([b.anchor,...b.points].map(p=>[p.lat,p.lon]),{padding:[55,55],maxZoom:6});box.append(head);
 for(const p of b.points){const item=document.createElement('button');item.type='button';item.append(labelNode(b,p));item.onclick=()=>map.setView([p.lat,p.lon],Math.max(5,map.getZoom()));box.append(item)}
 e('forecast42List').append(box);
 if(!forecastsOn)continue;
 const all=[b.anchor,...b.points];for(let i=1;i<all.length;i++){const a=all[i-1],p=all[i];L.polyline([[a.lat,a.lon],[p.lat,p.lon]],{pane:'forecastPaths42',color:'#fff5da',weight:3,dashArray:'8 9',opacity:Date.parse(p.valid_at)<=Date.now()?.45:.95,interactive:false}).addTo(group)}
 const icon=L.divIcon({className:'f42anchor',html:'<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="#b52e44" stroke="white" stroke-width="2"/><path d="M6 21C3 9 18 4 26 12C17 7 10 13 14 20C18 25 25 21 28 16C30 28 12 32 6 21Z" fill="white"/></svg>',iconSize:[34,34],iconAnchor:[17,17]});
 const anchor=L.marker([b.anchor.lat,b.anchor.lon],{icon,pane:'forecastDots42',title:'Official bulletin position, system '+b.system_number}).addTo(group);
 anchor.bindPopup(labelNode(b,b.anchor,true));
 for(const [i,p] of b.points.entries()){
 const elapsed=Date.parse(p.valid_at)<=Date.now();const dot=L.circleMarker([p.lat,p.lon],{pane:'forecastDots42',radius:6,color:elapsed?'#879cab':'#be3949',weight:2,fillColor:'#fff',fillOpacity:1}).addTo(group);dot.bindPopup(labelNode(b,p));
 if(labelsOn)dot.bindTooltip(labelNode(b,p),{permanent:true,direction:i%2?'left':'right',offset:[i%2?-11:11,0],className:'f42tooltip',opacity:elapsed?.78:1,interactive:false});
 }
 }
 if(!initialFit&&forecastsOn&&!changedView){initialFit=true;fit()}
}
async function get(url){const r=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
async function loadForecast(){
 const token=++forecastToken;text('forecast42Status','Checking official cyclone bulletins…');
 try{const d=await get(ROOT+'official-forecast.json');if(token!==forecastToken)return;data=d}catch{if(token!==forecastToken)return;data=null}
 draw()
}
function removeIR(){if(overlay){map.removeLayer(overlay);overlay=null}irKey=''}
async function loadIR(){
 if(!irOn||irBusy)return;irBusy=true;const token=++irToken;
 try{
 const m=await get(ROOT+'tracker-media/manifest.json');if(token!==irToken||!irOn)return;const f=selectFrame(m);if(!f)throw Error('No recent validated regional infrared image');
 const file=f.enhanced||f.raw,key=f.captured_at+'|'+file;if(irKey===key&&overlay){text('ir42Status',(f.enhanced?'Enhanced':'Original')+' IR · '+fmt(f.captured_at)+' · delayed EUMETSAT observation');return}
 const r=await fetch(ROOT+file,{signal:AbortSignal.timeout(20000),cache:'force-cache'});if(!r.ok)throw Error('Image unavailable');const blob=await r.blob();if(blob.size>12000000)throw Error('Image too large');
 const bmp=await createImageBitmap(blob);if(token!==irToken||!irOn){bmp.close();return}const w=bmp.width,h=bmp.height;if(w<100||h<100||w*h>10000000){bmp.close();throw Error('Invalid image size')}
 // The source is EPSG:4326. Warp each latitude row to Web Mercator before Leaflet overlay.
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');for(let y=0;y<h;y++){const src=sourceRow(y,h,BOUNDS[2],BOUNDS[3]);ctx.drawImage(bmp,0,src,w,1,0,y,w,1)}bmp.close();
 const url=canvas.toDataURL('image/png');if(token!==irToken||!irOn)return;
 removeIR();overlay=L.imageOverlay(url,[[BOUNDS[2],BOUNDS[0]],[BOUNDS[3],BOUNDS[1]]],{pane:'regionalIR42',opacity:Number(e('opacity').value)/100,interactive:false,attribution:'EUMETSAT Meteosat · regional IR reprojected by Inside Mauritius'}).addTo(map);irKey=key;
 text('ir42Status',(f.enhanced?'Enhanced':'Original')+' IR · '+fmt(f.captured_at)+' · delayed EUMETSAT observation; regional coverage only');
 }catch(err){if(token===irToken&&irOn){removeIR();text('ir42Status','Regional infrared unavailable: '+String(err.message||err).slice(0,100))}}finally{irBusy=false;if(irOn&&token!==irToken)setTimeout(loadIR,0)}
}
function stopIR(){irOn=false;++irToken;button('ir42',false);removeIR();text('ir42Status','Regional infrared off')}
function fitRegional(){const region=L.latLngBounds([[BOUNDS[2],BOUNDS[0]],[BOUNDS[3],BOUNDS[1]]]);map.setView(region.getCenter(),Math.max(map.getMinZoom(),map.getBoundsZoom(region,true)),{animate:false})}
map.on('moveend',()=>{if(!irOn)return;const v=map.getBounds(),region=L.latLngBounds([[BOUNDS[2],BOUNDS[0]],[BOUNDS[3],BOUNDS[1]]]);if(!v.intersects(region)||v.getEast()-v.getWest()>60){startGlobal();text('ir42Status','Outside regional coverage · global satellite requested');}});
function stopGlobal(){globalOn=false;button('globalIR43',false);if(globalLayer){map.removeLayer(globalLayer);globalLayer=null}}
function startGlobal(){
 if(irOn)stopIR();if(e('sat').getAttribute('aria-pressed')==='true')e('sat').click();
 globalOn=true;button('globalIR43',true);
 if(globalLayer)map.removeLayer(globalLayer);
 // Use documented provider tiles, not the paid WMS endpoint. No invented global pixels.
 const layer=L.tileLayer('https://realearth.ssec.wisc.edu/tiles/globalir-avn/{z}/{x}/{y}.png',{pane:'regionalIR42',maxNativeZoom:6,maxZoom:14,noWrap:true,opacity:Number(e('opacity').value)/100,attribution:'Source: <a href="https://www.ssec.wisc.edu/realearth/">SSEC RealEarth, UW-Madison</a>',updateWhenIdle:true,keepBuffer:2});
 globalLayer=layer;let ok=0,errors=0;
 const status=()=>{if(globalLayer!==layer)return;text('ir42Status','Global enhanced IR · '+(ok?'tiles received':errors?'unavailable; try dated NASA imagery':'loading')+(ok&&errors?' · partial coverage':'')+' · latest available composite; capture time unverified · not a forecast')};
 layer.on('tileload',()=>{ok++;status()});layer.on('tileerror',()=>{errors++;status()});status();layer.addTo(map);
 setTimeout(()=>{if(globalLayer!==layer||ok>0)return;stopGlobal();e('weatherLayer').value='irnight';e('weatherLayer').dispatchEvent(new Event('change'));text('ir42Status','Global composite unavailable · switched to dated NASA thermal IR; see imagery status.');},12000);
}
e('globalIR43').onclick=()=>{if(globalOn){stopGlobal();text('ir42Status','Global infrared off');return}startGlobal()};
e('world43').onclick=()=>{startGlobal();e('region').value='world';map.setView([0,0],map.getMinZoom())};

e('ir42').onclick=()=>{if(irOn){fitRegional();return}stopGlobal();irOn=true;button('ir42',true);if(e('sat').getAttribute('aria-pressed')==='true')e('sat').click();e('region').value='sw';fitRegional();loadIR()};
for(const id of ['weatherLayer','day','prevDay','nextDay'])e(id).addEventListener(id==='weatherLayer'||id==='day'?'change':'click',()=>{if(irOn)stopIR();if(globalOn)stopGlobal();text('ir42Status','Other satellite layer selected')});
e('sat').addEventListener('click',()=>{if(e('sat').getAttribute('aria-pressed')==='true'){if(irOn)stopIR();if(globalOn)stopGlobal();text('ir42Status','Other satellite layer selected')}});
e('opacity').addEventListener('input',()=>{if(overlay)overlay.setOpacity(Number(e('opacity').value)/100);if(globalLayer)globalLayer.setOpacity(Number(e('opacity').value)/100)});
e('forecast42').onclick=()=>{forecastsOn=!forecastsOn;button('forecast42',forecastsOn);draw()};
e('labels42').onclick=()=>{labelsOn=!labelsOn;button('labels42',labelsOn);draw()};
e('fitForecast42').onclick=fit;
function refreshImages(){if(globalOn&&globalLayer)globalLayer.redraw();else if(irOn)loadIR()}
e('refresh42').onclick=()=>{loadForecast();refreshImages()};
e('refresh').addEventListener('click',()=>{loadForecast();refreshImages()});
window.addEventListener('offline',()=>{++forecastToken;data=null;draw();++irToken;removeIR();text('ir42Status','Offline · imagery unavailable')});
window.addEventListener('online',()=>{loadForecast();refreshImages()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadForecast();refreshImages()}});
setInterval(()=>{if(!document.hidden){loadForecast();refreshImages()}},300000);
setInterval(()=>{if(!document.hidden&&tracks.length&&!selectForecasts(data).length)draw()},60000);
loadForecast();startGlobal();
})();