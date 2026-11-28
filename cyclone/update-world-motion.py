"""NOAA GMGSI longwave IR -> timestamped near-global Web Mercator images.
Uses fixed display scaling, not a derived temperature or a forecast."""
import datetime as dt, io, json, pathlib, re, urllib.request, urllib.parse, xml.etree.ElementTree as ET
import numpy as np
from netCDF4 import Dataset
from PIL import Image
ROOT="https://noaa-gmgsi-pds.s3.amazonaws.com/"
OUT=pathlib.Path(__file__).parent/"world-motion"
UTC=dt.timezone.utc
def read(url,limit):
    import time
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Inside-Mauritius-CycloneWatch/44"}),timeout=45) as r:
                data=r.read(limit+1)
            if len(data)>limit: raise ValueError("Response too large")
            return data
        except (OSError, TimeoutError) as exc:
            print('Source request failed', attempt+1, str(exc)[:180], flush=True)
            if attempt == 2: raise
            time.sleep(2 ** attempt)
def candidates(t):
    prefix=f"GMGSI_LW/{t:%Y/%m/%d/%H}/"
    root=ET.fromstring(read(ROOT+"?"+urllib.parse.urlencode({"list-type":"2","prefix":prefix}),2_000_000))
    keys=[e.text for e in root.findall(".//{*}Key") if e.text and e.text.startswith(prefix) and "GLOBCOMPLIR" in e.text]
    return sorted(keys,reverse=True)[:3]
def merc(lat): return np.arcsinh(np.tan(np.deg2rad(lat)))
def make(t,key):
    with Dataset("source.nc",memory=read(ROOT+urllib.parse.quote(key,safe="/"),45_000_000)) as ds:
        stamp=getattr(ds,"time_coverage_start","")
        if stamp:
            date=dt.datetime.fromisoformat(str(stamp).replace("Z","+00:00"))
            if date.tzinfo is None: date=date.replace(tzinfo=UTC)
            if abs((date-t).total_seconds())>3600: raise ValueError("Timestamp mismatch")
        elif not re.search(r"GLOBCOMPLIR_nc\."+t.strftime("%Y%m%d%H")+r"$",key):
            raise ValueError("Unverified source time")
        var=ds.variables["data"]
        a=np.ma.asarray(var[:],dtype=float).squeeze().filled(np.nan)
        lat=np.ma.asarray(ds.variables["lat"][:],dtype=float).filled(np.nan)
        lon=np.ma.asarray(ds.variables["lon"][:],dtype=float).filled(np.nan)
        if a.ndim!=2 or a.shape!=(3000,4999): raise ValueError("Unexpected source dimensions")
        if lat.ndim==2:
            if lat.shape!=a.shape or np.nanmax(abs(lat-lat[:,[a.shape[1]//2]]))>.08: raise ValueError("Nonseparable latitude")
            lat=lat[:,a.shape[1]//2]
        if lon.ndim==2:
            if lon.shape!=a.shape or np.nanmax(abs((lon-lon[[a.shape[0]//2],:]+180)%360-180))>.08: raise ValueError("Nonseparable longitude")
            lon=lon[a.shape[0]//2,:]
        if len(lat)!=a.shape[0] or len(lon)!=a.shape[1] or not np.all(np.isfinite(lat)) or not np.all(np.isfinite(lon)): raise ValueError("Invalid coordinates")
        lon=(lon+180)%360-180; xi=np.argsort(lon); yi=np.argsort(lat); lon=lon[xi];lat=lat[yi]
        if lat[0]>-60 or lat[-1]<60 or lon[0]>-179.8 or lon[-1]<179.8 or np.max(np.diff(lon))>.2 or np.max(np.diff(lat))>.2: raise ValueError("Incomplete source geometry")
        width=1600;height=round(width*2*merc(60)/(2*np.pi))
        x=-180+(np.arange(width)+.5)*360/width
        y=np.rad2deg(np.arctan(np.sinh(merc(60)-(np.arange(height)+.5)*2*merc(60)/height)))
        def nearest(src,targets):
            j=np.clip(np.searchsorted(src,targets),1,len(src)-1)
            return np.where(abs(src[j]-targets)<abs(src[j-1]-targets),j,j-1)
        sample=a[np.ix_(yi[nearest(lat,y)],xi[nearest(lon,x)])]
        # netCDF4 has already unpacked scale_factor/add_offset and masked fill values.
        units=str(getattr(var,"units","")).strip().lower()
        unit=re.sub(r"[\s_\-]+","",units).replace("°","")
        finite=sample[np.isfinite(sample)]
        print("IR metadata",json.dumps({"units":units,"dtype":str(var.dtype),"scale_factor":str(getattr(var,"scale_factor",None)),"add_offset":str(getattr(var,"add_offset",None)),"valid_range":str(getattr(var,"valid_range",None)),"finite_fraction":float(np.isfinite(sample).mean()),"sample_min":float(finite.min()) if finite.size else None,"sample_max":float(finite.max()) if finite.size else None}),flush=True)
        valid=np.isfinite(sample)
        if unit in ("k","kelvin","degreek","degreesk","degreekelvin","degreeskelvin"):
            kelvin=sample
            valid &= (kelvin>=140)&(kelvin<=350)
            bright=np.clip((310-kelvin)/130,0,1)
        elif unit in ("c","degc","celsius","degreec","degreesc","degreecelsius","degreescelsius"):
            kelvin=sample+273.15
            valid &= (kelvin>=140)&(kelvin<=350)
            bright=np.clip((310-kelvin)/130,0,1)
        elif unit in ("count","counts","digitalcount","digitalcounts","1","unitless","dimensionless"):
            valid &= (sample>=0)&(sample<=255)
            bright=np.clip(sample/255,0,1)
        else:
            raise ValueError("Unrecognized infrared units: "+repr(units))
        coverage=float(np.mean(valid))
        if coverage<.7: raise ValueError(f"Insufficient valid image coverage: {coverage:.3f}; units={units!r}")
        gray=np.uint8(np.nan_to_num(bright)*255)
        rgba=np.stack([gray,gray,gray,np.where(valid,255,0).astype(np.uint8)],axis=-1)
        dest=OUT/(t.strftime("%Y%m%d%H")+".png")
        temp=dest.with_suffix(".tmp")
        Image.fromarray(rgba,"RGBA").save(temp,format="PNG",optimize=True);temp.replace(dest)
        return {"time":t.isoformat(),"file":dest.name}
def main():
    OUT.mkdir(exist_ok=True)
    now=dt.datetime.now(UTC); newest=now.replace(minute=0,second=0,microsecond=0)-dt.timedelta(hours=2)
    frames=[]
    for i in range(8):
        t=newest-dt.timedelta(hours=i)
        dest=OUT/(t.strftime("%Y%m%d%H")+".png")
        if dest.exists(): frames.append({"time":t.isoformat(),"file":dest.name})
        else:
            try:
                for key in candidates(t):
                    try: frames.append(make(t,key));break
                    except Exception as exc: print("Rejected",key,str(exc)[:180])
            except Exception as exc: print("Hour unavailable",t,str(exc)[:180])
        if len(frames)>=6: break
    if len(frames)<2: raise SystemExit("Fewer than two validated NOAA frames")
    frames.sort(key=lambda f:f["time"])
    manifest={"schema":1,"source":"NOAA GMGSI LWIR","bounds":[-60,-180,60,180],"frames":frames}
    temp=OUT/"manifest.tmp";temp.write_text(json.dumps(manifest));temp.replace(OUT/"manifest.json")
    keep={f["file"] for f in frames}
    for p in OUT.glob("*.png"):
        if p.name not in keep:p.unlink()
if __name__=="__main__":main()
