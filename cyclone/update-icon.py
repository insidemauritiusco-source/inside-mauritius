"""DWD ICON global: official triangular-grid remapping, then 2-degree sampling."""
import bz2, datetime as dt, json, pathlib, subprocess, tarfile, tempfile, urllib.request, os
import numpy as np
from eccodes import codes_grib_new_from_file,codes_get,codes_release
from netCDF4 import Dataset
UTC=dt.timezone.utc
ROOT="https://opendata.dwd.de/weather/"
TARGET=pathlib.Path(__file__).with_name("icon.json")
STEPS=(0,12,24,48)
FIELDS={"U_10M":("u",0,2,2,"heightAboveGround",10,-150,150),"V_10M":("v",0,2,3,"heightAboveGround",10,-150,150),"PMSL":("p",0,3,1,"meanSea",None,800,1150),"T_2M":("t",0,0,0,"heightAboveGround",2,-100,75)}
def read(url,limit):
    import time
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Inside-Mauritius-CycloneWatch/39"}),timeout=60) as r:
                b=r.read(limit+1)
            if len(b)>limit: raise ValueError("Download exceeds size limit")
            return b
        except (OSError, TimeoutError) as exc:
            print('Source request failed', attempt+1, str(exc)[:180], flush=True)
            if attempt == 2: raise
            time.sleep(2 ** attempt)
def remap_files(folder):
    archive=folder/"weights.tar.bz2"
    archive.write_bytes(read(ROOT+"lib/cdo/ICON_GLOBAL2WORLD_025_EASY.tar.bz2",65_000_000))
    with tarfile.open(archive,"r:bz2") as t:
        names={"target_grid_world_025.txt","weights_icogl2world_025.nc"}
        for member in t:
            name=pathlib.PurePosixPath(member.name).name
            if name in names and member.isfile() and member.size<350_000_000:
                if (folder/name).exists(): raise ValueError("Duplicate remapping file")
                (folder/name).write_bytes(t.extractfile(member).read())
    grid=folder/"target_grid_world_025.txt";weights=folder/"weights_icogl2world_025.nc"
    if not grid.exists() or not weights.exists(): raise ValueError("DWD remapping assets missing")
    return grid,weights
def decode(folder,grid,weights,cycle,step,key):
    name,disc,cat,num,leveltype,level,lo,hi=FIELDS[key]
    url=ROOT+f"nwp/icon/grib/{cycle:%H}/{key.lower()}/icon_global_icosahedral_single-level_{cycle:%Y%m%d%H}_{step:03d}_{key}.grib2.bz2"
    grib=folder/"field.grib2"; nc=folder/"field.nc"
    grib.write_bytes(bz2.decompress(read(url,20_000_000)))
    with grib.open("rb") as f:
        g=codes_grib_new_from_file(f)
        if g is None: raise ValueError("Empty field")
        try:
            if tuple(codes_get(g,k) for k in ("discipline","parameterCategory","parameterNumber"))!=(disc,cat,num): raise ValueError("Wrong parameter")
            if codes_get(g,"typeOfLevel")!=leveltype or (level is not None and codes_get(g,"level")!=level): raise ValueError("Wrong level")
            if (codes_get(g,"dataDate"),codes_get(g,"dataTime"),codes_get(g,"endStep"))!=(int(cycle.strftime("%Y%m%d")),cycle.hour*100,step): raise ValueError("Wrong forecast timestamp")
        finally: codes_release(g)
        extra=codes_grib_new_from_file(f)
        if extra is not None:
            codes_release(extra)
            raise ValueError("Unexpected multiple messages")
    nc.unlink(missing_ok=True)
    subprocess.run(["cdo","-s","-O","-f","nc",f"remap,{grid},{weights}",str(grib),str(nc)],check=True,timeout=120)
    with Dataset(nc) as ds:
        lat=np.asarray(ds.variables["lat"][:],dtype=float);lon=np.asarray(ds.variables["lon"][:],dtype=float)
        yi=np.array([np.argmin(abs(lat-v)) for v in np.arange(90,-91,-2)])
        xi=np.array([np.argmin(abs((lon-v+180)%360-180)) for v in np.arange(0,360,2)])
        if max(abs(lat[yi]-np.arange(90,-91,-2)))>.126 or max(abs((lon[xi]-np.arange(0,360,2)+180)%360-180))>.126: raise ValueError("Remapped grid does not cover target")
        fields=[v for v in ds.variables.values() if len(v.dimensions)>=2 and v.dimensions[-2:]==("lat","lon")]
        if len(fields)!=1: raise ValueError("Ambiguous remapped variable")
        a=np.ma.asarray(fields[0][:],dtype=float).squeeze().filled(np.nan)
        if a.shape!=(len(lat),len(lon)): raise ValueError("Unexpected remapped shape")
        a=a[np.ix_(yi,xi)].ravel()
    if name=="p": a=a/100
    if name=="t": a=a-273.15
    if len(a)!=16380 or not np.all(np.isfinite(a)) or np.any(a<lo) or np.any(a>hi): raise ValueError("Invalid ICON field")
    return [round(float(v),2) for v in a]
def build(folder,grid,weights,cycle):
    frames=[]
    for step in STEPS:
        f={"hour":step,"valid":(cycle+dt.timedelta(hours=step)).isoformat()}
        for key,(name,*_) in FIELDS.items(): f[name]=decode(folder,grid,weights,cycle,step,key)
        frames.append(f)
    return {"schema":1,"model":"DWD ICON","cycle":cycle.isoformat(),"spacing":2,"nx":180,"ny":91,"frames":frames,"attribution":"Source: Deutscher Wetterdienst (DWD), CC BY 4.0; regridded, sampled and unit-converted by Inside Mauritius"}
def main():
    now=dt.datetime.now(UTC); t=now-dt.timedelta(hours=6); t=t.replace(hour=t.hour//6*6,minute=0,second=0,microsecond=0)
    with tempfile.TemporaryDirectory() as tmp:
        folder=pathlib.Path(tmp);grid,weights=remap_files(folder)
        for offset in (0,6,12):
            cycle=t-dt.timedelta(hours=offset)
            if (now-cycle).total_seconds()>24*3600: continue
            try:
                if TARGET.exists() and dt.datetime.fromisoformat(json.loads(TARGET.read_text())["cycle"])>=cycle: return
            except (ValueError,KeyError,TypeError): pass
            try:
                data=build(folder,grid,weights,cycle)
                temp=TARGET.with_suffix(".tmp")
                temp.write_text(json.dumps(data,separators=(",",":"),allow_nan=False))
                os.replace(temp,TARGET)
                print("Published ICON",cycle.isoformat());return
            except Exception as exc: print("ICON unavailable",cycle.isoformat(),str(exc)[:250])
    raise SystemExit("No recent complete ICON run")
if __name__=="__main__": main()
