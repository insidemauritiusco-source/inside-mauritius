"""Publish independent coarse NOAA wave forecasts and daily OISST analysis."""
import datetime as dt, json, math, pathlib, urllib.request, urllib.parse, csv, io, os, sys
import numpy as np
from eccodes import codes_new_from_message, codes_get, codes_get_values, codes_release
UTC=dt.timezone.utc
ROOT="https://noaa-gfs-bdp-pds.s3.amazonaws.com/"
DIR=pathlib.Path(__file__).parent
STEPS=(0,12,24,48)
FIELDS={"HTSGW":("height",3,0,40),"DIRPW":("direction",10,0,360),"PERPW":("period",11,0,60)}
def read(url,span=None):
    headers={"User-Agent":"Inside-Mauritius-CycloneWatch/37"}
    if span: headers["Range"]=f"bytes={span[0]}-{span[1]}"
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as r:
        if span and (r.status!=206 or r.headers.get("Content-Range","").split("/")[0]!=f"bytes {span[0]}-{span[1]}"): raise ValueError("Range not honored")
        b=r.read(12_000_001)
        if len(b)>12_000_000 or (span and len(b)!=span[1]-span[0]+1): raise ValueError("Unexpected response size")
        return b
def write(name,data):
    p=DIR/name
    q=p.with_suffix(".tmp")
    q.write_text(json.dumps(data,separators=(",",":"),allow_nan=False))
    os.replace(q,p)
def existing(name):
    try: return json.loads((DIR/name).read_text())
    except (OSError,ValueError): return {}
def ranges(index):
    rows=[x.split(":") for x in index.splitlines() if x.strip()]
    out={}
    for i,r in enumerate(rows[:-1]):
        if len(r)>4 and r[3] in FIELDS and r[4]=="surface":
            if r[3] in out: raise ValueError("Duplicate wave field")
            out[r[3]]=(int(r[1]),int(rows[i+1][1])-1)
    if "HTSGW" not in out: raise ValueError("No significant wave height")
    return out
def wave_decode(blob,cycle,step,key):
    g=codes_new_from_message(blob)
    try:
        _,number,lo,hi=FIELDS[key]
        if tuple(codes_get(g,k) for k in ("discipline","parameterCategory","parameterNumber"))!=(10,0,number): raise ValueError("Wrong wave parameter")
        if (codes_get(g,"dataDate"),codes_get(g,"dataTime"),codes_get(g,"endStep"))!=(int(cycle.strftime("%Y%m%d")),cycle.hour*100,step): raise ValueError("Wrong model time")
        if codes_get(g,"gridType")!="regular_ll" or any(codes_get(g,k)!=v for k,v in {"iScansNegatively":0,"jPointsAreConsecutive":0,"alternativeRowScanning":0}.items()): raise ValueError("Unsupported grid scan")
        ni,nj=codes_get(g,"Ni"),codes_get(g,"Nj")
        dx,dy=(float(codes_get(g,k)) for k in ("iDirectionIncrementInDegrees","jDirectionIncrementInDegrees"))
        x0,y0=(float(codes_get(g,k)) for k in ("longitudeOfFirstGridPointInDegrees","latitudeOfFirstGridPointInDegrees"))
        if not (abs(ni*dx-360)<.01 and abs(dx-.25)<.0001 and abs(dy-.25)<.0001 and 0<=x0<360 and -90<=y0<=90 and 2<=nj<=721): raise ValueError("Unexpected wave grid")
        sign=1 if codes_get(g,"jScansPositively") else -1
        a=codes_get_values(g).reshape(nj,ni)
        if sign<0: a=a[::-1]; y0=y0-(nj-1)*dy
        # Native grid sampled every 2 degrees; no interpolation across land or missing data.
        a=a[::8,::8]
        missing=float(codes_get(g,"missingValue"))
        v=[round(float(x),2) if math.isfinite(x) and x!=missing and lo<=x<=hi else None for x in a.ravel()]
        if sum(x is not None for x in v)<100: raise ValueError("Insufficient wave coverage")
        return {"nx":a.shape[1],"ny":a.shape[0],"lon0":x0,"lat0":y0,"dx":2,"dy":2},v
    finally: codes_release(g)
def wave_build(cycle):
    prefix=ROOT+f"gfs.{cycle:%Y%m%d}/{cycle:%H}/wave/gridded/gfswave.t{cycle:%H}z.global.0p25.f"
    frames=[]; grid=None
    for step in STEPS:
        url=prefix+f"{step:03d}.grib2"
        spans=ranges(read(url+".idx").decode())
        frame={"hour":step,"valid":(cycle+dt.timedelta(hours=step)).isoformat()}
        for key,(name,*_) in FIELDS.items():
            try:
                meta,values=wave_decode(read(url,spans[key]),cycle,step,key)
                if grid is None: grid=meta
                if meta!=grid: raise ValueError("Inconsistent grid")
                frame[name]=values
            except Exception as exc:
                if key=="HTSGW": raise
                print("Optional wave field unavailable",key,step,str(exc)[:160])
        frames.append(frame)
    return {"schema":1,"source":"NOAA GFS-Wave","cycle":cycle.isoformat(),"grid":grid,"frames":frames}
def waves():
    now=dt.datetime.now(UTC); t=now-dt.timedelta(hours=5); t=t.replace(hour=t.hour//6*6,minute=0,second=0,microsecond=0)
    old=existing("waves.json")
    for offset in (0,6,12):
        c=t-dt.timedelta(hours=offset)
        if (now-c).total_seconds()>18*3600: continue
        if old.get("cycle","")>=c.isoformat(): return
        try:
            write("waves.json",wave_build(c)); print("Published wave cycle",c.isoformat());return
        except Exception as exc: print("Wave cycle unavailable",c.isoformat(),str(exc)[:200])
    raise ValueError("No recent complete wave-height forecast")
def sst_erddap():
    # NOAA preliminary OISST; exact timestamp comes from the dataset, not the request clock.
    base="https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21NrtAgg.csv?"
    query="sst[(last)][(0.0)][0:8:719][0:8:1439]"
    raw=read(base+urllib.parse.quote(query,safe="[]():,")).decode("utf-8")
    rows=csv.DictReader(io.StringIO(raw)); units=next(rows)
    if units.get("sst") not in ("degree_C","degrees_C","degree_Celsius","degrees_Celsius","degC","Celsius"): raise ValueError("Unexpected SST units")
    grid={"nx":180,"ny":90,"lon0":.125,"lat0":-89.875,"dx":2,"dy":2}
    vals=[None]*16200; seen=set(); stamps=set()
    for r in rows:
        y,x=float(r["latitude"]),float(r["longitude"])
        i,j=round((x-.125)/2),round((y+89.875)/2)
        if not(0<=i<180 and 0<=j<90 and abs(x-(.125+2*i))<.001 and abs(y-(-89.875+2*j))<.001): raise ValueError("Unexpected SST coordinate")
        k=j*180+i
        if k in seen: raise ValueError("Duplicate SST coordinate")
        seen.add(k); stamps.add(r["time"])
        try: v=float(r["sst"])
        except (ValueError,TypeError): v=float("nan")
        vals[k]=round(v,2) if math.isfinite(v) and -4<=v<=45 else None
    if len(seen)!=16200 or len(stamps)!=1 or sum(v is not None for v in vals)<100: raise ValueError("Incomplete SST dataset")
    stamp=stamps.pop(); t=dt.datetime.fromisoformat(stamp.replace("Z","+00:00"))
    age=(dt.datetime.now(UTC)-t).total_seconds()
    if not -43200<=age<=7*86400: raise ValueError("SST not recent")
    if existing("sst.json").get("date","")>=t.isoformat(): return
    write("sst.json",{"schema":1,"source":"NOAA OISST v2.1 preliminary","date":t.isoformat(),"grid":grid,"values":vals})
    print("Published SST",t.isoformat())
def sst():
    try:
        sst_erddap()
        return
    except Exception as exc:
        print("ERDDAP unavailable; trying NOAA daily files:",str(exc)[:200])
    from netCDF4 import Dataset, num2date
    base="https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/"
    today=dt.datetime.now(UTC).date()
    for lag in range(1,7):
        day=today-dt.timedelta(days=lag)
        for suffix in ("_preliminary",""):
            url=base+f"{day:%Y%m}/oisst-avhrr-v02r01.{day:%Y%m%d}{suffix}.nc"
            try:
                with Dataset("daily.nc",mode="r",memory=read(url)) as ds:
                    sv=ds.variables["sst"]
                    if sv.dimensions!=("time","zlev","lat","lon") or sv.shape!=(1,1,720,1440) or sv.units not in ("degree_C","degrees_C","degree_Celsius","degrees_Celsius","degC","Celsius"): raise ValueError(f"Unexpected SST metadata: dimensions={sv.dimensions!r}, shape={sv.shape!r}, units={getattr(sv, 'units', None)!r}")
                    lat=np.asarray(ds.variables["lat"][:]); lon=np.asarray(ds.variables["lon"][:])
                    if not np.allclose(lat,np.arange(720)*.25-89.875,atol=.0001) or not np.allclose(lon,np.arange(1440)*.25+.125,atol=.0001): raise ValueError("Unexpected SST coordinates")
                    tv=ds.variables["time"]
                    stamp=num2date(tv[0],tv.units,getattr(tv,"calendar","standard"))
                    when=dt.datetime(stamp.year,stamp.month,stamp.day,stamp.hour,stamp.minute,stamp.second,tzinfo=UTC)
                    if when.date()!=day or not -43200<=(dt.datetime.now(UTC)-when).total_seconds()<=7*86400: raise ValueError("Invalid SST date")
                    a=np.ma.asarray(sv[0,0,::8,::8],dtype=float).filled(np.nan)
                    vals=[round(float(x),2) if math.isfinite(x) and -4<=x<=45 else None for x in a.ravel()]
                    if len(vals)!=16200 or sum(x is not None for x in vals)<100: raise ValueError("Incomplete SST coverage")
                    old=existing("sst.json")
                    if old.get("date","")>when.isoformat(): return
                    write("sst.json",{"schema":1,"source":"NOAA OISST v2.1 preliminary" if suffix else "NOAA OISST v2.1 final","date":when.isoformat(),"grid":{"nx":180,"ny":90,"lon0":.125,"lat0":-89.875,"dx":2,"dy":2},"values":vals})
                    print("Published daily NOAA SST",when.isoformat())
                    return
            except Exception as exc:
                print("Daily SST unavailable",day,suffix,str(exc)[:160])
    raise ValueError("No recent validated daily OISST file")

if __name__=="__main__":
    failed=[]
    for fn in (waves,sst):
        try: fn()
        except Exception as exc: failed.append(fn.__name__);print(fn.__name__,"unavailable:",str(exc)[:300])
    if failed: sys.exit("Incomplete marine refresh: "+", ".join(failed))
