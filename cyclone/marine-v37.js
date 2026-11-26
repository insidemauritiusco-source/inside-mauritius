/* V37 NOAA marine layer. Sampled model/analysis grids, not navigation data. */
(function(){
'use strict';
const e=id=>document.getElementById(id), map=window.cycloneWindMap, mode=e('marineMode'),status=e('marineStatus'),seek=e('marineSeek'),time=e('marineTime'),point=e('marinePoint'),play=e('marinePlay'),legend=e('marineLegend'),bar=e('marineBar');
if(!map){status.textContent='Marine map unavailable';return}
const canvas=document.createElement('canvas');canvas.className='marineCanvas';canvas.setAttribute('aria-hidden','true');map.getContainer().append(canvas);const ctx=canvas.getContext('2d');if(!ctx){status.textContent='Marine rendering unavailable';return}
let data=null,index=0,seq=0,timer=null;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function validGrid(g){return g&&g.nx===180&&Number.isInteger(g.ny)&&g.ny>=60&&g.ny<=91&&g.dx===2&&g.dy===2&&finite(g.lat0)&&g.lat0>=-90&&g.lat0+(g.ny-1)*2<=90.001&&finite(g.lon0)&&g.lon0>=0&&g.lon0<360}
function values(a,g,lo,hi){return Array.isArray(a)&&a.length===g.nx*g.ny&&a.every(v=>v===null||finite(v)&&v>=lo&&v<=hi)&&a.filter(v=>v!==null).length>=100}
function fresh(d,sst,now=Date.now()){const t=Date.parse(sst?d?.date:d?.cycle),age=now-t;return Number.isFinite(age)&&age>=(sst?-43200000:-300000)&&age<=(sst?7*86400000:18*3600000)}
function validate(d,sst,now=Date.now()){
 if(d?.schema!==1||!validGrid(d.grid)||!fresh(d,sst,now))return false;
 if(sst)return ['NOAA OISST v2.1 preliminary','NOAA OISST v2.1 final'].includes(d.source)&&values(d.values,d.grid,-4,45);
 return d.source==='NOAA GFS-Wave'&&Array.isArray(d.frames)&&d.frames.length===4&&d.frames.every((f,i)=>f.hour===[0,12,24,48][i]&&Date.parse(f.valid)===Date.parse(d.cycle)+f.hour*3600000&&values(f.height,d.grid,0,40)&&(!('direction'in f)||values(f.direction,d.grid,0,360))&&(!('period'in f)||values(f.period,d.grid,0,60)));
}
function sample(g,a,lat,lon){
 if(!a||!finite(lat)||!finite(lon)||lat<g.lat0-g.dy/2||lat>g.lat0+(g.ny-.5)*g.dy)return null;
 const j=Math.round((lat-g.lat0)/g.dy),i=Math.round(((lon-g.lon0)%360+360)%360/g.dx)%g.nx;
 if(j<0||j>=g.ny)return null;const v=a[j*g.nx+i];return finite(v)?v:null
}
const palettes={height:{limits:[1,2,4,6,9,12],colors:['#4ba1e6','#52c9d4','#65cf96','#f0d269','#f8a04a','#e65a66','#b764e4'],label:'Significant wave height (m)',ticks:['<1','1–2','2–4','4–6','6–9','9–12','12+']},period:{limits:[4,6,8,10,12,16],colors:['#6b61c8','#4d8fdf','#43c3d6','#72d6a4','#e3dd74','#efac57','#d9676d'],label:'Primary wave mean period (s)',ticks:['<4','4–6','6–8','8–10','10–12','12–16','16+']},sst:{limits:[0,10,20,26,28,30],colors:['#7467ce','#4d93e3','#43c4d9','#79d6a5','#e0dc70','#f8a74d','#df6262'],label:'Daily sea surface temperature (°C)',ticks:['<0','0–10','10–20','20–26','26–28','28–30','30+']}};
function current(){return mode.value==='sst'?data?.values:data?.frames?.[index]?.[mode.value]}
function paintLegend(){legend.replaceChildren();const p=palettes[mode.value];if(!p)return;const title=document.createElement('strong');title.textContent=p.label+' · ';legend.append(title);p.colors.forEach((c,i)=>{const b=document.createElement('span');b.style.background=c;b.textContent=p.ticks[i];legend.append(b)})}
function clear(){ctx.clearRect(0,0,canvas.width,canvas.height)}
function stop(){clearInterval(timer);timer=null;play.textContent='Play waves'}
function fail(message){data=null;stop();clear();status.textContent=message;time.textContent='—';point.textContent='No marine reading available.';seek.disabled=true;play.disabled=true}
function render(){
 clear();if(!data||mode.value==='off')return;const sst=mode.value==='sst';if(!fresh(data,sst)){fail('Marine data expired. Choose a layer to refresh.');return}
 const a=current();if(!a){status.textContent='Selected marine field unavailable for this forecast time.';return}
 const p=palettes[mode.value],size=map.getSize(),step=Math.max(7,Math.ceil(Math.max(size.x,size.y)/190));ctx.globalAlpha=.72;
 for(let y=0;y<size.y;y+=step)for(let x=0;x<size.x;x+=step){const ll=map.containerPointToLatLng([x+step/2,y+step/2]),v=sample(data.grid,a,ll.lat,ll.lng);if(v===null)continue;ctx.fillStyle=p.colors[p.limits.filter(n=>v>=n).length];ctx.fillRect(x,y,step,step)}ctx.globalAlpha=1;
 status.textContent=data.source+' · '+(sst?'dated daily analysis, not a forecast':'2° sampled wave model, not observation')+' · missing cells blank; not for navigation';
}
function resize(){const size=map.getSize();canvas.width=size.x;canvas.height=size.y;render()}
function update(){if(!data)return;const sst=mode.value==='sst';time.textContent=sst?data.date.slice(0,10)+' UTC daily analysis':'+'+data.frames[index].hour+' h · '+data.frames[index].valid.slice(0,16).replace('T',' ')+' UTC (run '+data.cycle.slice(0,16).replace('T',' ')+' UTC)';point.textContent='Click ocean for sampled marine reading.';render()}
async function load(){
 const token=++seq;stop();clear();data=null;paintLegend();seek.disabled=true;play.disabled=true;point.textContent='—';time.textContent='—';
 if(mode.value==='off'){bar.hidden=true;return}bar.hidden=false;
 // Avoid covering atmospheric data with a second canvas.
 window.dispatchEvent(new Event('cyclone-atmosphere-off'));
 const sst=mode.value==='sst';status.textContent='Checking NOAA marine data…';
 try{const r=await fetch(sst?'sst.json':'waves.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const d=await r.json();if(token!==seq)return;if(!validate(d,sst))throw Error();data=d;index=0;seek.value=0;seek.disabled=sst;play.disabled=sst;update()}catch{if(token===seq)fail('No recent validated '+(sst?'SST analysis':'wave forecast')+' available. Check source links.')}
}
mode.onchange=load;e('marineRefresh').onclick=load;seek.oninput=()=>{stop();index=Number(seek.value);update()};play.onclick=()=>{if(timer){stop();return}if(!data||mode.value==='sst')return;play.textContent='Pause waves';timer=setInterval(()=>{index=(index+1)%4;seek.value=index;update()},2400)};
map.on('movestart zoomstart',clear);map.on('moveend zoomend resize',resize);map.on('click',ev=>{if(!data||!fresh(data,mode.value==='sst'))return;const {lat,lng}=ev.latlng,g=data.grid,sst=mode.value==='sst',f=data.frames?.[index],fmt=(v,u)=>v===null?'not reported':v.toFixed(1)+' '+u;const v=sample(g,current(),lat,lng);point.textContent=lat.toFixed(2)+'°, '+lng.toFixed(2)+'° · '+(sst?'SST '+fmt(v,'°C'):'Significant height '+fmt(sample(g,f.height,lat,lng),'m')+' · Primary period '+fmt(sample(g,f.period,lat,lng),'s')+' · Primary direction '+fmt(sample(g,f.direction,lat,lng),'° true'))});
function off(){if(mode.value!=='off'){mode.value='off';load()}}
window.addEventListener('cyclone-marine-off',off);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(mode.value!=='off')load()});setInterval(()=>{if(mode.value!=='off'&&!document.hidden)load()},300000);
resize();
})();
