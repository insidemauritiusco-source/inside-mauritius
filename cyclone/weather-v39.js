/* NOAA GFS 2-degree display grid; motion is illustrative advection of model vectors. */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const map=window.cycloneWindMap;
const state=el('windStatus'),toggle=el('windToggle'),seek=el('windSeek'),label=el('windTime'),play=el('windPlay'),mode=el('gfsMode'),contours=el('isobars'),model=el('forecastModel');
const models={gfs:{name:'NOAA GFS',file:'wind.json',hours:18},ifs:{name:'ECMWF IFS',file:'ifs.json',hours:24},icon:{name:'DWD ICON',file:'icon.json',hours:24}};const selected=()=>models[model.value];
if(!map){state.textContent='Wind map unavailable';return}
let requestToken=0;let data=null,active=false,loading=false,index=0,particles=[],raf=0,last=0,playing=null,arrowLayer=L.layerGroup(),canvas=document.createElement('canvas');
canvas.className='windCanvas';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx){state.textContent='Wind canvas unavailable';return}
map.getContainer().append(canvas);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function validate(d,now=Date.now()){
 const t=Date.parse(d?.cycle),age=now-t;
 return d?.schema===1&&d.model===selected().name&&d.spacing===2&&d.nx===180&&d.ny===91&&Number.isFinite(age)&&age>=-300000&&age<=selected().hours*3600000&&Array.isArray(d.frames)&&d.frames.length===4&&d.frames.every((f,i)=>f.hour===[0,12,24,48][i]&&Date.parse(f.valid)===t+f.hour*3600000&&['u','v'].every(k=>Array.isArray(f[k])&&f[k].length===16380&&f[k].every(n=>finite(n)&&Math.abs(n)<=150)));
}
function sample(f,lat,lon){if(!finite(lat)||!finite(lon)||Math.abs(lat)>90)return null;let x=((lon%360+360)%360)/2,y=(90-lat)/2,i=Math.floor(x),j=Math.min(89,Math.floor(y)),a=x-i,b=y-j,i2=(i+1)%180;return ['u','v'].map(k=>{let q=f[k];return (q[j*180+i]*(1-a)+q[j*180+i2]*a)*(1-b)+(q[(j+1)*180+i]*(1-a)+q[(j+1)*180+i2]*a)*b})}
function sampleScalar(q,lat,lon){
 if(!q||!finite(lat)||!finite(lon)||Math.abs(lat)>90)return null;
 const x=((lon%360+360)%360)/2,y=(90-lat)/2,i=Math.floor(x),j=Math.min(89,Math.floor(y)),a=x-i,b=y-j,k=(i+1)%180;
 return (q[j*180+i]*(1-a)+q[j*180+k]*a)*(1-b)+(q[(j+1)*180+i]*(1-a)+q[(j+1)*180+k]*a)*b;
}
function scalarValid(f,key){const [lo,hi]=key==='p'?[800,1150]:[-100,75];return Array.isArray(f[key])&&f[key].length===16380&&f[key].every(v=>finite(v)&&v>=lo&&v<=hi)}
function triangleContour(vertices,level){const pts=[];for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3];if((a.v<level)===(b.v<level))continue;const q=(level-a.v)/(b.v-a.v);pts.push([a.x+q*(b.x-a.x),a.y+q*(b.y-a.y)])}return pts.length===2?pts:null}
const pressureColors=['#7659bb','#527cd4','#42a9cc','#4ec8a0','#c0d56c','#f5bf64','#ea8860'];
const tempColors=['#7665dc','#427cde','#44b6df','#72d2be','#d7e97e','#ffcc65','#ec7456'];
function scalarColor(v,key){const bounds=key==='p'?[980,995,1005,1015,1025,1040]:[-20,0,10,20,30,40];return (key==='p'?pressureColors:tempColors)[bounds.filter(n=>v>=n).length]}
function renderScalar(){
 const key=mode.value==='pressure'?'p':'t',f=data.frames[index],q=f[key];
 if(!scalarValid(f,key)){state.textContent='Selected forecast field unavailable in this model run. Wind may still be available.';return}
 const w=canvas.width,h=canvas.height,step=Math.max(8,Math.ceil(Math.max(w,h)/180));
 ctx.globalAlpha=.67;for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){const p=map.containerPointToLatLng([x+step/2,y+step/2]),v=sampleScalar(q,p.lat,p.lng);if(v!==null){ctx.fillStyle=scalarColor(v,key);ctx.fillRect(x,y,step,step)}}ctx.globalAlpha=1;
 if(key==='p'&&contours.checked){const grid=Math.max(16,step*2);let rows=[];for(let y=0;y<=h+grid;y+=grid){let row=[];for(let x=0;x<=w+grid;x+=grid){const p=map.containerPointToLatLng([x,y]);row.push({x,y,v:sampleScalar(q,p.lat,p.lng)})}rows.push(row)}
 ctx.strokeStyle='#f4fbff';ctx.lineWidth=1.2;ctx.font='bold 11px system-ui';ctx.fillStyle='#f4fbff';let labels=[];for(let y=0;y<rows.length-1;y++)for(let x=0;x<rows[y].length-1;x++){const a=rows[y][x],b=rows[y][x+1],c=rows[y+1][x+1],d=rows[y+1][x];if([a,b,c,d].some(z=>z.v===null))continue;
 const min=Math.min(a.v,b.v,c.v,d.v),max=Math.max(a.v,b.v,c.v,d.v);for(let level=Math.ceil(min/4)*4;level<=max;level+=4){for(const tri of [[a,b,c],[a,c,d]]){const s=triangleContour(tri,level);if(!s)continue;ctx.beginPath();ctx.moveTo(...s[0]);ctx.lineTo(...s[1]);ctx.stroke();const px=(s[0][0]+s[1][0])/2,py=(s[0][1]+s[1][1])/2;if(px>25&&py>20&&px<w-25&&py<h-15&&!labels.some(p=>Math.hypot(p[0]-px,p[1]-py)<100)){labels.push([px,py]);ctx.lineWidth=3;ctx.strokeStyle='#102333';ctx.strokeText(String(level),px,py);ctx.fillText(String(level),px,py);ctx.strokeStyle='#f4fbff';ctx.lineWidth=1.2}}}}}
}
function updateLegend(){const m=mode.value;contours.disabled=m!=='pressure'||!active;el('windLegend').hidden=m!=='wind';el('pressureLegend').hidden=m!=='pressure';el('temperatureLegend').hidden=m!=='temperature'}

function color(kmh){return kmh<20?'#50d6d7':kmh<40?'#6ee76d':kmh<60?'#f7db55':kmh<90?'#ff9d43':'#ff6489'}
function isFresh(){return data&&data.model===selected().name&&Date.now()-Date.parse(data.cycle)<=selected().hours*3600000}
function stopAnimation(){cancelAnimationFrame(raf);raf=0;last=0;ctx.clearRect(0,0,canvas.width,canvas.height);particles=[]}
function resize(){stopAnimation();const s=map.getSize();canvas.width=s.x;canvas.height=s.y;if(active&&isFresh())render()}
function drawArrows(){arrowLayer.clearLayers();if(!active||!isFresh())return;const s=map.getSize(),f=data.frames[index];for(let y=35;y<s.y;y+=76)for(let x=35;x<s.x;x+=76){const p=map.containerPointToLatLng([x,y]),v=sample(f,p.lat,p.lng);if(!v)continue;const speed=Math.hypot(...v)*3.6;if(speed<1)continue;const angle=Math.atan2(v[0],v[1])*180/Math.PI,icon=L.divIcon({className:'windArrow',html:'<span style="color:'+color(speed)+';transform:rotate('+angle+'deg)">↑</span>',iconSize:[22,22],iconAnchor:[11,11]});L.marker(p,{icon,interactive:false,keyboard:false}).addTo(arrowLayer)}}
function seed(p){p.x=Math.random()*canvas.width;p.y=Math.random()*canvas.height;p.life=30+Math.random()*100}
function animate(t){if(!active||!isFresh()||document.hidden){stopAnimation();if(!isFresh())invalidate();return}const delta=last?Math.min(40,t-last):16;last=t;ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-over';const f=data.frames[index];for(const p of particles){if(--p.life<=0||p.x<0||p.x>canvas.width||p.y<0||p.y>canvas.height)seed(p);const ll=map.containerPointToLatLng([p.x,p.y]),v=sample(f,ll.lat,ll.lng);if(!v){seed(p);continue}const speed=Math.hypot(...v);if(speed<.2){seed(p);continue}const step=Math.min(5,speed*.15)*delta/16,dx=v[0]/speed*step,dy=-v[1]/speed*step;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+dx,p.y+dy);ctx.strokeStyle=color(speed*3.6);ctx.lineWidth=1.35;ctx.stroke();p.x+=dx;p.y+=dy}raf=requestAnimationFrame(animate)}
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
function render(){stopAnimation();arrowLayer.clearLayers();updateLegend();if(!active||document.hidden)return;if(!isFresh()){invalidate();return}if(mode.value!=='wind'){renderScalar();return}drawArrows();if(reduce.matches)return;particles=Array.from({length:Math.min(600,Math.max(80,Math.floor(canvas.width*canvas.height/4000)))},()=>{const p={};seed(p);return p});raf=requestAnimationFrame(animate)}
function update(){el('gfsPoint').textContent='Click map for model estimate.';if(!isFresh()){invalidate();return}const f=data.frames[index];label.textContent='+'+f.hour+' h · '+new Date(f.valid).toISOString().slice(0,16).replace('T',' ')+' UTC';state.textContent=data.model+' cycle '+new Date(data.cycle).toISOString().slice(0,16).replace('T',' ')+' UTC · 2° sampled '+({wind:'10 m wind',pressure:'mean sea level pressure (hPa)',temperature:'2 m air temperature (°C)'}[mode.value])+' · model, not observation';render()}
function stopPlay(){if(playing)clearInterval(playing);playing=null;play.textContent='Play forecast'}
function invalidate(){data=null;active=false;toggle.setAttribute('aria-pressed','false');seek.disabled=true;play.disabled=true;stopPlay();stopAnimation();arrowLayer.clearLayers();state.textContent='No recent validated '+selected().name+' grid. Forecast display unavailable.';label.textContent='—';el('gfsPoint').textContent='Model estimate unavailable.';updateLegend()}
async function load(){if(loading)return;window.dispatchEvent(new Event('cyclone-marine-off'));const token=++requestToken;loading=true;state.textContent='Checking published '+selected().name+' forecast grid…';try{const r=await fetch(selected().file,{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();if(token!==requestToken)return;if(!validate(d))throw Error();data=d;seek.max=d.frames.length-1;seek.disabled=false;play.disabled=false;active=true;toggle.setAttribute('aria-pressed','true');arrowLayer.addTo(map);update()}catch{if(token===requestToken)invalidate()}finally{if(token===requestToken)loading=false}}
function atmosphereOff(){requestToken++;loading=false;active=false;toggle.setAttribute('aria-pressed','false');stopPlay();stopAnimation();arrowLayer.clearLayers();seek.disabled=true;play.disabled=true;state.textContent='Forecast layers off';label.textContent='—';el('gfsPoint').textContent='Model layer off.';updateLegend();}window.addEventListener('cyclone-atmosphere-off',atmosphereOff);toggle.onclick=()=>{if(active||loading){atmosphereOff();return}load()};
model.onchange=()=>{atmosphereOff();data=null;index=0;seek.value=0;label.textContent='—';load()};mode.onchange=()=>{updateLegend();if(active)update();else load()};contours.onchange=()=>{if(active)update()};map.on('click',e=>{if(!active||!isFresh())return;const f=data.frames[index],ll=e.latlng;let value;if(mode.value==='wind'){const v=sample(f,ll.lat,ll.lng);if(v)value=(Math.hypot(...v)*3.6).toFixed(1)+' km/h'}else{const key=mode.value==='pressure'?'p':'t';if(scalarValid(f,key)){const v=sampleScalar(f[key],ll.lat,ll.lng);if(v!==null)value=v.toFixed(1)+(key==='p'?' hPa':' °C')}}el('gfsPoint').textContent=value?'Model estimate at '+ll.lat.toFixed(2)+'°, '+ll.lng.toFixed(2)+'°: '+value+' · '+label.textContent:'Selected field unavailable at this point.'});seek.oninput=()=>{index=Number(seek.value);stopPlay();update()};
play.onclick=()=>{if(playing){stopPlay();return}if(!active||!isFresh())return;play.textContent='Pause forecast';playing=setInterval(()=>{index=(index+1)%data.frames.length;seek.value=index;update()},2200)};
map.on('movestart zoomstart',()=>{stopAnimation();arrowLayer.clearLayers()});map.on('moveend zoomend resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAnimation();stopPlay()}else if(active)update()});
reduce.addEventListener?.('change',render);
setInterval(()=>{if(active&&!document.hidden){if(!isFresh())invalidate();else load()}},300000);
updateLegend();resize();
})();
