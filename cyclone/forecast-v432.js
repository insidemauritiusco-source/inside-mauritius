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
function selectFrames(m,n=Date.now()){
 if(m?.status!=='ok'||m.source!=='https://view.eumetsat.int/geoserver/wms'||m.crs!=='EPSG:4326'||JSON.stringify(m.bounds)!==JSON.stringify(BOUNDS)||!Array.isArray(m.frames))return [];
 const frames=m.frames.filter(f=>fresh(f.captured_at,86400000,n)&&Date.parse(f.captured_at)<=n-3600000&&/^[a-f0-9]{64}$/.test(f.sha256||'')&&f.raw==='tracker-media/'+f.sha256+'-raw.jpg'&&(!f.enhanced||f.enhanced==='tracker-media/'+f.sha256+'-ir.jpg'));
 return frames.sort((a,b)=>Date.parse(a.captured_at)-Date.parse(b.captured_at)).filter((f,i,a)=>!i||Date.parse(f.captured_at)>Date.parse(a[i-1].captured_at)).slice(-8);
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
let labelsOn=true,forecastsOn=true,irOn=false;let globalOn=false,globalLayer=null;
map.on('dragstart zoomstart',()=>{changedView=true});
function text(id,s){e(id).textContent=s}
function fit(){const points=tracks.flatMap(b=>[b.anchor,...b.points].map(p=>[p.lat,p.lon]));if(points.length){if(irOn&&points.some(p=>!regionBounds.contains(p)))stopIR();map.fitBounds(points,{padding:[55,55],maxZoom:Math.max(map.getMinZoom(),6)})}}
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
 const box=document.createElement('div');box.className='f42system';const head=document.createElement('button');head.type='button';head.textContent='System '+String(b.system_number).padStart(2,'0')+' · Bulletin '+b.bulletin_number+' · '+fmt(b.issued_at);head.onclick=()=>{const p=[b.anchor,...b.points].map(p=>[p.lat,p.lon]);if(irOn&&p.some(x=>!regionBounds.contains(x)))stopIR();map.fitBounds(p,{padding:[55,55],maxZoom:Math.max(map.getMinZoom(),6)})};box.append(head);
 for(const p of b.points){const item=document.createElement('button');item.type='button';item.append(labelNode(b,p));item.onclick=()=>{if(irOn&&!regionBounds.contains([p.lat,p.lon]))stopIR();map.setView([p.lat,p.lon],Math.max(5,map.getZoom()))};box.append(item)}
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
let images=[],motionIndex=0,motionTimer=null,motionKey='',motionRendering=false;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function stopMotion(){clearInterval(motionTimer);motionTimer=null;e('motionPlay42').textContent='Play'}
function disposeImages(list){for(const f of list)URL.revokeObjectURL(f.url)}
function controls(){const n=images.length;e('motionSeek42').max=String(Math.max(0,n-1));e('motionSeek42').value=String(motionIndex);e('motionSeek42').disabled=n<2;e('motionPlay42').disabled=n<2;e('motionLatest42').disabled=!n}
function showFrame(){
 if(!irOn||!images.length)return;
 const f=images[motionIndex];if(!fresh(f.captured_at,86400000,Date.now())){stopMotion();removeIR();text('motionTime42','Satellite frame expired');return}
 if(overlay){overlay.setUrl(f.url)}else{overlay=L.imageOverlay(f.url,[[BOUNDS[2],BOUNDS[0]],[BOUNDS[3],BOUNDS[1]]],{pane:'regionalIR42',opacity:Number(e('opacity').value)/100,interactive:false,attribution:'EUMETSAT Meteosat · regional IR reprojected by Inside Mauritius'}).addTo(map)}
 text('motionTime42',fmt(f.captured_at)+' · '+(motionIndex+1)+'/'+images.length+' · delayed observation');
 text('ir42Status',(f.enhanced?'Enhanced':'Original')+' EUMETSAT IR · '+fmt(f.captured_at)+' · regional imagery, not forecast');
 controls();
}
function playMotion(){stopMotion();if(images.length<2||!irOn||document.hidden)return; e('motionPlay42').textContent='Pause';motionTimer=setInterval(()=>{motionIndex=(motionIndex+1)%images.length;showFrame()},1200/Number(e('motionRate42').value))}
async function prepareFrame(f,token){
 const file=f.enhanced||f.raw,r=await fetch(ROOT+file,{signal:AbortSignal.timeout(20000),cache:'force-cache'});if(!r.ok)throw Error('Image unavailable');const blob=await r.blob();if(blob.size>12000000)throw Error('Image too large');
 const bmp=await createImageBitmap(blob);
 try{if(token!==irToken||!irOn)throw Error('Cancelled');if(bmp.width<100||bmp.height<100||bmp.width*bmp.height>10000000)throw Error('Invalid image size');
 const scale=Math.min(1,1600/bmp.width),w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 for(let y=0;y<h;y++){const sy=sourceRow(y,h,BOUNDS[2],BOUNDS[3]);ctx.drawImage(bmp,0,sy*bmp.height/h,bmp.width,bmp.height/h,0,y,w,1)}
 const output=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image conversion failed')),'image/jpeg',.9));
 if(token!==irToken||!irOn)throw Error('Cancelled');
 return {...f,url:URL.createObjectURL(output)};
 }finally{bmp.close()}
}
async function loadIR(){
 if(!irOn||irBusy)return;irBusy=true;const token=++irToken;let prepared=[];
 try{
 const m=await get(ROOT+'tracker-media/manifest.json');if(token!==irToken||!irOn)return;
 const frames=selectFrames(m);if(!frames.length)throw Error('No recent validated regional frames');
 const key=frames.map(f=>f.captured_at+'|'+(f.enhanced||f.raw)).join(';');
 if(key===motionKey&&images.length===frames.length&&overlay)return;
 if(!images.length)text('motionTime42','Loading dated satellite sequence…');
 // Decode a bounded sequence, sequentially, to limit memory and network load.
 for(const f of frames){if(token!==irToken||!irOn)return;try{prepared.push(await prepareFrame(f,token))}catch(err){if(token!==irToken||!irOn)return}}
 if(token!==irToken||!irOn)return;if(!prepared.length)throw Error('Satellite frames could not be loaded');
 const wasPlaying=motionTimer!==null,first=!images.length;
 stopMotion();removeIR();disposeImages(images);images=prepared;prepared=[];motionKey=key;motionIndex=images.length-1;controls();showFrame();
 if((wasPlaying||first&&e('motionAuto42').checked)&&!reduced.matches){motionIndex=0;showFrame();playMotion()}
 }catch(err){if(token===irToken&&irOn){stopMotion();removeIR();disposeImages(images);images=[];motionKey='';motionIndex=0;controls();text('motionTime42','Satellite motion unavailable');text('ir42Status','Regional infrared unavailable: '+String(err.message||err).slice(0,100))}}
 finally{disposeImages(prepared);irBusy=false;if(irOn&&token!==irToken)setTimeout(loadIR,0)}
}
function stopIR(){irOn=false;unlockRegional();map.removeLayer(geoLabels);++irToken;stopMotion();removeIR();disposeImages(images);images=[];motionKey='';motionIndex=0;controls();e('motion42').hidden=true;button('ir42',false);text('ir42Status','Regional infrared off')}
e('motionPlay42').onclick=()=>{if(motionTimer!==null){stopMotion();e('motionAuto42').checked=false}else{e('motionAuto42').checked=true;playMotion()}};
e('motionSeek42').oninput=()=>{stopMotion();e('motionAuto42').checked=false;motionIndex=Number(e('motionSeek42').value);showFrame()};
e('motionLatest42').onclick=()=>{stopMotion();e('motionAuto42').checked=false;motionIndex=Math.max(0,images.length-1);showFrame()};
e('motionRate42').onchange=()=>{if(motionTimer!==null)playMotion()};
e('motionAuto42').onchange=()=>{if(e('motionAuto42').checked)playMotion();else stopMotion()};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();else if(irOn&&e('motionAuto42').checked&&!reduced.matches)playMotion()});
let globalDate='';
const regionBounds=L.latLngBounds([[BOUNDS[2],BOUNDS[0]],[BOUNDS[3],BOUNDS[1]]]),worldBounds=L.latLngBounds([[-85.05112878,-180],[85.05112878,180]]);
let cameraBusy=false,resizeQueued=false;
function coverZoom(width,height,regionWidth,regionHeight){return Math.log2(Math.max(width/regionWidth,height/regionHeight))+.025}
function worldMin(){return Math.max(2,Math.log2(Math.max(1,map.getSize().x)/256))}
function fitRegional(){
 if(!irOn||cameraBusy)return;cameraBusy=true;
 try{
 map.invalidateSize({pan:false,animate:false});const size=map.getSize();if(size.x<1||size.y<1)return;
 const nw=map.project(regionBounds.getNorthWest(),0),se=map.project(regionBounds.getSouthEast(),0),center=map.unproject(nw.add(se).divideBy(2),0);
 const z=Math.min(14,Math.max(worldMin(),coverZoom(size.x,size.y,se.x-nw.x,se.y-nw.y)));
 map.setMaxBounds(regionBounds);map.setMinZoom(z);map.setView(center,z,{animate:false});
 }finally{cameraBusy=false}
}
function unlockRegional(){map.setMaxBounds(worldBounds);map.setMinZoom(worldMin())}
function resizeRegional(){if(!irOn||resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(irOn)fitRegional()})}
map.on('resize',resizeRegional);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeRegional).observe(map.getContainer());
document.addEventListener('fullscreenchange',resizeRegional);
const names=[['Mauritius',-20.2,57.5],['Rodrigues',-19.72,63.42],['Réunion',-21.12,55.54],['Agalega',-10.4,56.6],['Madagascar',-19,46.7],['Seychelles',-4.62,55.45]];
const geoLabels=L.layerGroup();
map.createPane('regionalLabels432');map.getPane('regionalLabels432').style.zIndex=590;
for(const [name,lat,lon] of names){const label=document.createElement('span');label.textContent=name;L.marker([lat,lon],{pane:'regionalLabels432',interactive:false,keyboard:false,icon:L.divIcon({className:'regionalLabel432',html:label,iconSize:[100,18],iconAnchor:[50,9]})}).addTo(geoLabels)}
window.addEventListener('cyclone-navigate',ev=>{const p=ev.detail;if(!irOn)return;if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&regionBounds.contains([p.lat,p.lon]))return;stopIR()});

function stopGlobal(){globalOn=false;button('globalIR43',false);if(globalLayer){map.removeLayer(globalLayer);globalLayer=null}globalDate=''}
function yesterday(){return new Date(Date.now()-86400000).toISOString().slice(0,10)}
function startGlobal(){
 if(irOn)stopIR();if(e('sat').getAttribute('aria-pressed')==='true')e('sat').click();
 const day=yesterday();if(globalOn&&globalLayer&&globalDate===day)return;
 stopGlobal();globalOn=true;button('globalIR43',true);globalDate=day;
 const layer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{pane:'regionalIR42',layers:'MODIS_Terra_Brightness_Temp_Band31_Night',styles:'',format:'image/png',transparent:true,version:'1.3.0',time:day,maxNativeZoom:7,maxZoom:14,noWrap:true,opacity:Number(e('opacity').value)/100,attribution:'NASA Earthdata GIBS / MODIS Terra',updateWhenIdle:true,keepBuffer:1});
 globalLayer=layer;let ok=0,errors=0;
 const status=()=>{if(globalLayer!==layer)return;text('ir42Status','NASA global thermal IR · '+day+' UTC · '+(ok?'tiles received; coverage may be incomplete':errors?'unavailable':'loading')+(ok&&errors?' · tile errors':'')+' · daily satellite passes, not a continuous global loop')};
 layer.on('tileload',()=>{ok++;status()});layer.on('tileerror',()=>{errors++;status()});status();layer.addTo(map);
}
e('globalIR43').onclick=()=>{if(globalOn){stopGlobal();text('ir42Status','Global infrared off');return}startGlobal()};
e('world43').onclick=()=>{startGlobal();e('region').value='world';map.setView([0,0],map.getMinZoom())};
e('ir42').onclick=()=>{if(irOn){fitRegional();return}stopGlobal();if(e('sat').getAttribute('aria-pressed')==='true')e('sat').click();irOn=true;e('motion42').hidden=false;button('ir42',true);e('region').value='sw';geoLabels.addTo(map);fitRegional();loadIR()};
for(const id of ['weatherLayer','day','prevDay','nextDay'])e(id).addEventListener(id==='weatherLayer'||id==='day'?'change':'click',()=>{if(irOn)stopIR();if(globalOn)stopGlobal();text('ir42Status','Other satellite layer selected')});
e('sat').addEventListener('click',()=>{if(e('sat').getAttribute('aria-pressed')==='true'){if(irOn)stopIR();if(globalOn)stopGlobal();text('ir42Status','Other satellite layer selected')}});
window.addEventListener('cyclone-imagery-off',()=>{if(irOn)stopIR();if(globalOn)stopGlobal();if(e('sat').getAttribute('aria-pressed')==='true')e('sat').click();text('ir42Status','Satellite imagery off')});
e('opacity').addEventListener('input',()=>{if(overlay)overlay.setOpacity(Number(e('opacity').value)/100);if(globalLayer)globalLayer.setOpacity(Number(e('opacity').value)/100)});
e('forecast42').onclick=()=>{forecastsOn=!forecastsOn;button('forecast42',forecastsOn);draw()};
e('labels42').onclick=()=>{labelsOn=!labelsOn;button('labels42',labelsOn);draw()};
e('fitForecast42').onclick=fit;
function refreshImages(){if(globalOn&&globalDate!==yesterday())startGlobal();else if(irOn)loadIR()}
e('refresh42').onclick=()=>{loadForecast();refreshImages()};
e('refresh').addEventListener('click',()=>{loadForecast();refreshImages()});
window.addEventListener('offline',()=>{++forecastToken;data=null;draw();++irToken;stopMotion();removeIR();disposeImages(images);images=[];motionKey='';motionIndex=0;controls();text('motionTime42','Offline');text('ir42Status','Offline · imagery unavailable')});
window.addEventListener('online',()=>{loadForecast();refreshImages()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadForecast();refreshImages()}});
setInterval(()=>{if(!document.hidden){loadForecast();refreshImages()}},300000);
setInterval(()=>{if(!document.hidden&&tracks.length&&!selectForecasts(data).length)draw()},60000);
loadForecast();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!irOn&&!globalOn&&e('sat').getAttribute('aria-pressed')!=='true')e('ir42').click()}));
})();