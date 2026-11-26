(function(){'use strict';const e=id=>document.getElementById(id),map=window.cycloneWindMap;if(!map)return;
const drawer=e('layerDrawer41'),layers=e('layers41');
function open(on){drawer.hidden=!on;layers.setAttribute('aria-expanded',String(on));if(on)e('closeLayers41').focus();else layers.focus()}
layers.onclick=()=>open(drawer.hidden);e('closeLayers41').onclick=()=>open(false);document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!drawer.hidden){ev.preventDefault();open(false)}});
document.body.classList.add('v40maponly');e('panelToggle').setAttribute('aria-pressed','true');e('panelToggle').textContent='Show information';
function worldMinimum(){if(e('ir42').getAttribute('aria-pressed')==='true')return;const width=map.getSize().x;if(width>0){const z=Math.max(2,Math.log2(width/256));if(Math.abs(map.getMinZoom()-z)>.015)map.setMinZoom(z)}}
map.on('resize',worldMinimum);worldMinimum();
function ensureGlobal(){window.dispatchEvent(new Event('cyclone-atmosphere-off'));window.dispatchEvent(new Event('cyclone-marine-off'));if(e('globalIR43').getAttribute('aria-pressed')!=='true')e('globalIR43').click()}
e('quickIR41').onclick=ensureGlobal;
e('quickWorld41').onclick=()=>{window.dispatchEvent(new Event('cyclone-atmosphere-off'));window.dispatchEvent(new Event('cyclone-marine-off'));e('world43').click()};
e('quickRegion41').onclick=()=>{window.dispatchEvent(new Event('cyclone-atmosphere-off'));window.dispatchEvent(new Event('cyclone-marine-off'));e('ir42').click()};
e('quickWind41').onclick=()=>{window.dispatchEvent(new Event('cyclone-imagery-off'));e('gfsMode').value='wind';e('gfsMode').dispatchEvent(new Event('change'))};
e('quickFit41').onclick=()=>{if(e('fitForecast42').disabled){if(document.body.classList.contains('v40maponly'))e('panelToggle').click();e('forecast42Status').scrollIntoView({block:'nearest'});return}e('fitForecast42').click()};
e('quickFull41').onclick=()=>e('full').click();
function sync(){const atmospheric=e('windToggle').getAttribute('aria-pressed')==='true',loading=e('windStatus').textContent.startsWith('Checking published'),marine=e('marineMode').value!=='off';e('atmosBar41').hidden=marine||(!atmospheric&&!loading&&/^Forecast (?:layers )?off/.test(e('windStatus').textContent));e('quickWind41').setAttribute('aria-pressed',String(atmospheric));e('quickIR41').setAttribute('aria-pressed',e('globalIR43').getAttribute('aria-pressed'));e('quickRegion41').setAttribute('aria-pressed',e('ir42').getAttribute('aria-pressed'))}
const observer=new MutationObserver(sync);for(const id of ['windToggle','windStatus','globalIR43','ir42'])observer.observe(e(id),{attributes:true,childList:true,subtree:true});e('marineMode').addEventListener('change',sync);
e('atmosBar41').hidden=true;sync();requestAnimationFrame(()=>{map.invalidateSize();worldMinimum()});})();