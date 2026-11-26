"""Download NOAA GFS wind, MSL pressure and 2 m temperature GRIB messages from public AWS mirror.
Publish a 2-degree global sampled grid, not a cyclone-scale analysis."""
import datetime as dt
import json, math, os, pathlib, urllib.request, time
from eccodes import codes_new_from_message, codes_get, codes_get_values, codes_release
UTC=dt.timezone.utc
ROOT="https://noaa-gfs-bdp-pds.s3.amazonaws.com/"
STEPS=(0,12,24,48)
def request(url, start=None, end=None):
    headers={"User-Agent":"Inside-Mauritius-CycloneWatch/35"}
    if start is not None: headers["Range"]=f"bytes={start}-{end}"
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=40) as r:
        if start is not None and (r.status!=206 or r.headers.get("Content-Range","").split("/")[0]!=f"bytes {start}-{end}"):
            raise ValueError("Range not honored")
        b=r.read(5_000_001)
        if len(b)>5_000_000 or (start is not None and len(b)!=end-start+1): raise ValueError("Unexpected data length")
        return b
def ranges(index):
    rows=[line.split(":") for line in index.splitlines() if line.strip()]
    result={}
    for i,row in enumerate(rows[:-1]):
        if len(row)>5 and (row[3],row[4]) in {("UGRD","10 m above ground"),("VGRD","10 m above ground"),("PRMSL","mean sea level"),("TMP","2 m above ground"),("GUST","surface"),("DPT","2 m above ground"),("RH","2 m above ground")}:
            start,end=int(row[1]),int(rows[i+1][1])-1
            if row[3] in result or end<start: raise ValueError("Ambiguous index")
            result[row[3]]=(start,end)
    if not {"UGRD","VGRD"}.issubset(result): raise ValueError("Missing wind fields")
    return result
def decode(blob,cycle,step,var):
    g=codes_new_from_message(blob)
    try:
        expected={"UGRD":("10u",10),"VGRD":("10v",10)}
        if var in expected:
            if (codes_get(g,"shortName"),codes_get(g,"level"))!=expected[var]: raise ValueError("Wrong wind field")
        else:
            keys=("discipline","parameterCategory","parameterNumber","typeOfLevel","units")
            actual=tuple(codes_get(g,k) for k in keys)
            target={"PRMSL":(0,3,1,"meanSea","Pa"),"TMP":(0,0,0,"heightAboveGround","K"),"DPT":(0,0,6,"heightAboveGround","K"),"RH":(0,1,1,"heightAboveGround","%"),"GUST":(0,2,22,"surface","m s**-1")}[var]
            if actual!=target or (var in ("TMP","DPT","RH") and codes_get(g,"level")!=2): raise ValueError("Wrong scalar field")
        if (codes_get(g,"dataDate"),codes_get(g,"dataTime"),codes_get(g,"endStep"))!=(int(cycle.strftime("%Y%m%d")),cycle.hour*100,step): raise ValueError("Wrong cycle or step")
        if (codes_get(g,"Ni"),codes_get(g,"Nj"))!=(360,181) or codes_get(g,"gridType")!="regular_ll": raise ValueError("Unexpected source grid")
        if any(codes_get(g,k)!=v for k,v in {"iScansNegatively":0,"jScansPositively":0,"jPointsAreConsecutive":0,"alternativeRowScanning":0,"latitudeOfFirstGridPointInDegrees":90,"longitudeOfFirstGridPointInDegrees":0,"iDirectionIncrementInDegrees":1,"jDirectionIncrementInDegrees":1}.items()): raise ValueError("Unexpected scan geometry")
        a=codes_get_values(g).reshape(181,360)[::2,::2].ravel()
        if var=="PRMSL": a=a/100
        if var in ("TMP","DPT"): a=a-273.15
        if var=="GUST": a=a*3.6
        lo,hi={"UGRD":(-150,150),"VGRD":(-150,150),"PRMSL":(800,1150),"TMP":(-100,75),"DPT":(-100,75),"RH":(0,100),"GUST":(0,540)}[var]
        if len(a)!=16380 or any(not math.isfinite(x) or not lo<=x<=hi for x in a): raise ValueError("Invalid field values")
        return [round(float(x),2) for x in a]
    finally: codes_release(g)
def build(cycle):
    base=ROOT+f"gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/gfs.t{cycle:%H}z.pgrb2.1p00.f"
    frames=[]
    for step in STEPS:
        url=base+f"{step:03d}"
        index=request(url+".idx").decode()
        spans=ranges(index)
        fields={key:decode(request(url,*spans[key]),cycle,step,key) for key in ("UGRD","VGRD")}
        frame={"hour":step,"valid":(cycle+dt.timedelta(hours=step)).isoformat(),"u":fields["UGRD"],"v":fields["VGRD"]}
        for key,name in (("PRMSL","p"),("TMP","t"),("GUST","g"),("DPT","d"),("RH","r")):
            try: frame[name]=decode(request(url,*spans[key]),cycle,step,key)
            except Exception as exc: print("Optional field unavailable",key,step,str(exc)[:150])
        frames.append(frame)
    for name in ("p","t","g","d","r"):
        if not all(name in frame for frame in frames):
            for frame in frames: frame.pop(name,None)
    return {"schema":1,"model":"NOAA GFS","cycle":cycle.isoformat(),"spacing":2,"nx":180,"ny":91,"frames":frames}
def main():
    now=dt.datetime.now(UTC)
    t=now-dt.timedelta(hours=5)
    t=t.replace(hour=(t.hour//6)*6,minute=0,second=0,microsecond=0)
    path=pathlib.Path(__file__).with_name("wind.json")
    for offset in (0,6,12):
        cycle=t-dt.timedelta(hours=offset)
        if (now-cycle).total_seconds()>18*3600: continue
        if path.exists():
            try:
                existing=json.loads(path.read_text())
                old_cycle=dt.datetime.fromisoformat(existing["cycle"])
                if old_cycle>cycle or (old_cycle==cycle and len(existing.get("frames",[]))==4 and all(all(k in f for k in ("p","t","g","d","r")) for f in existing["frames"])):
                    print("Already have this or a newer model run");return
            except (ValueError,KeyError,TypeError): pass
        try:
            data=build(cycle)
            if path.exists():
                try:
                    existing=json.loads(path.read_text())
                    if existing.get("cycle")==data["cycle"]:
                        for name in ("p","t","g","d","r"):
                            if len(existing.get("frames",[]))==4 and all(name in f for f in existing["frames"]) and not all(name in f for f in data["frames"]):
                                for new,old in zip(data["frames"],existing["frames"]): new[name]=old[name]
                except (ValueError,TypeError,KeyError): pass
            temp=path.with_suffix(".tmp")
            temp.write_text(json.dumps(data,separators=(",",":"),allow_nan=False))
            os.replace(temp,path)
            print("Published model cycle",cycle.isoformat());return
        except Exception as exc:
            print("Cycle unavailable:",cycle.isoformat(),type(exc).__name__,str(exc)[:200])
            time.sleep(2)
    raise SystemExit("No complete recent GFS cycle; retaining old file (client rejects stale data)")
if __name__=="__main__": main()
