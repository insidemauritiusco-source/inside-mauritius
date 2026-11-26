/* NOAA GFS 2-degree display grid; motion is illustrative advection of model vectors. */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const map=window.cycloneWindMap;
const state=el('windStatus'),toggle=el('windToggle'),seek=el('windSeek'),label=el('windTime'),play=el('windPlay');
if(!map){state.textContent='Wind map unavailable';return}
let data=null,active=false,loading=false,index=0,particles=[],raf=0,last=0,playing=null,arrowLayer=L.layerGroup(),canvas=document.createElement('canvas');
canvas.className='windCanvas';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx){state.textContent='Wind canvas unavailable';return}
map.getContainer().append(canvas);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function validate(d,now=Date.now()){
 const t=Date.parse(d?.cycle),age=now-t;
 return d?.schema===1&&d.model==='NOAA GFS'&&d.spacing===2&&d.nx===180&&d.ny===91&&Number.isFinite(age)&&age>=-300000&&age<=18*3600000&&Array.isArray(d.frames)&&d.frames.length===4&&d.frames.every((f,i)=>f.hour===[0,12,24,48][i]&&Date.parse(f.valid)===t+f.hour*3600000&&['u','v'].every(k=>Array.isArray(f[k])&&f[k].length===16380&&f[k].every(n=>finite(n)&&Math.abs(n)<=150)));
}
function sample(f,lat,lon){if(!finite(lat)||!finite(lon)||Math.abs(lat)>90)return null;let x=((lon%360+360)%360)/2,y=(90-lat)/2,i=Math.floor(x),j=Math.min(89,Math.floor(y)),a=x-i,b=y-j,i2=(i+1)%180;return ['u','v'].map(k=>{let q=f[k];return (q[j*180+i]*(1-a)+q[j*180+i2]*a)*(1-b)+(q[(j+1)*180+i]*(1-a)+q[(j+1)*180+i2]*a)*b})}
function color(kmh){return kmh<20?'#50d6d7':kmh<40?'#6ee76d':kmh<60?'#f7db55':kmh<90?'#ff9d43':'#ff6489'}
function isFresh(){return data&&Date.now()-Date.parse(data.cycle)<=18*3600000}
function stopAnimation(){cancelAnimationFrame(raf);raf=0;last=0;ctx.clearRect(0,0,canvas.width,canvas.height);particles=[]}
function resize(){stopAnimation();const s=map.getSize();canvas.width=s.x;canvas.height=s.y;if(active&&isFresh())render()}
function drawArrows(){arrowLayer.clearLayers();if(!active||!isFresh())return;const s=map.getSize(),f=data.frames[index];for(let y=35;y<s.y;y+=76)for(let x=35;x<s.x;x+=76){const p=map.containerPointToLatLng([x,y]),v=sample(f,p.lat,p.lng);if(!v)continue;const speed=Math.hypot(...v)*3.6;if(speed<1)continue;const angle=Math.atan2(v[0],v[1])*180/Math.PI,icon=L.divIcon({className:'windArrow',html:'<span style="color:'+color(speed)+';transform:rotate('+angle+'deg)">↑</span>',iconSize:[22,22],iconAnchor:[11,11]});L.marker(p,{icon,interactive:false,keyboard:false}).addTo(arrowLayer)}}
function seed(p){p.x=Math.random()*canvas.width;p.y=Math.random()*canvas.height;p.life=30+Math.random()*100}
function animate(t){if(!active||!isFresh()||document.hidden){stopAnimation();if(!isFresh())invalidate();return}const delta=last?Math.min(40,t-last):16;last=t;ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-over';const f=data.frames[index];for(const p of particles){if(--p.life<=0||p.x<0||p.x>canvas.width||p.y<0||p.y>canvas.height)seed(p);const ll=map.containerPointToLatLng([p.x,p.y]),v=sample(f,ll.lat,ll.lng);if(!v){seed(p);continue}const speed=Math.hypot(...v);if(speed<.2){seed(p);continue}const step=Math.min(5,speed*.15)*delta/16,dx=v[0]/speed*step,dy=-v[1]/speed*step;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+dx,p.y+dy);ctx.strokeStyle=color(speed*3.6);ctx.lineWidth=1.35;ctx.stroke();p.x+=dx;p.y+=dy}raf=requestAnimationFrame(animate)}
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
function render(){stopAnimation();drawArrows();if(!active||!isFresh()||reduce.matches||document.hidden)return;particles=Array.from({length:Math.min(600,Math.max(80,Math.floor(canvas.width*canvas.height/4000)))},()=>{const p={};seed(p);return p});raf=requestAnimationFrame(animate)}
function update(){if(!isFresh()){invalidate();return}const f=data.frames[index];label.textContent='+'+f.hour+' h · '+new Date(f.valid).toISOString().slice(0,16).replace('T',' ')+' UTC';state.textContent='NOAA GFS cycle '+new Date(data.cycle).toISOString().slice(0,16).replace('T',' ')+' UTC · 2° sampled 10 m winds · model, not observation';render()}
function stopPlay(){if(playing)clearInterval(playing);playing=null;play.textContent='Play forecast'}
function invalidate(){data=null;active=false;toggle.setAttribute('aria-pressed','false');seek.disabled=true;play.disabled=true;stopPlay();stopAnimation();arrowLayer.clearLayers();state.textContent='No recent validated GFS wind grid. Wind display unavailable.';label.textContent='—'}
async function load(){if(loading)return;loading=true;state.textContent='Checking published NOAA wind grid…';try{const r=await fetch('wind.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();if(!validate(d))throw Error();data=d;seek.max=d.frames.length-1;seek.disabled=false;play.disabled=false;active=true;toggle.setAttribute('aria-pressed','true');arrowLayer.addTo(map);update()}catch{invalidate()}finally{loading=false}}
toggle.onclick=()=>{if(active){active=false;toggle.setAttribute('aria-pressed','false');stopPlay();stopAnimation();arrowLayer.clearLayers();seek.disabled=true;play.disabled=true;state.textContent='Wind layer off';return}load()};
seek.oninput=()=>{index=Number(seek.value);stopPlay();update()};
play.onclick=()=>{if(playing){stopPlay();return}if(!active||!isFresh())return;play.textContent='Pause forecast';playing=setInterval(()=>{index=(index+1)%data.frames.length;seek.value=index;update()},2200)};
map.on('movestart zoomstart',()=>{stopAnimation();arrowLayer.clearLayers()});map.on('moveend zoomend resize',resize);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAnimation();stopPlay()}else if(active)update()});
reduce.addEventListener?.('change',render);
setInterval(()=>{if(active&&!document.hidden)load()},300000);
resize();
})();
