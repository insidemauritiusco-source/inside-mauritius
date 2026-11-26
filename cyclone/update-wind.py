"""Download only NOAA GFS 10 m wind GRIB messages from public AWS mirror.
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
        if len(row)>5 and row[3] in ("UGRD","VGRD") and row[4]=="10 m above ground":
            start,end=int(row[1]),int(rows[i+1][1])-1
            if row[3] in result or end<start: raise ValueError("Ambiguous index")
            result[row[3]]=(start,end)
    if set(result)!={"UGRD","VGRD"}: raise ValueError("Missing wind fields")
    return result
def decode(blob,cycle,step,var):
    g=codes_new_from_message(blob)
    try:
        expected="10u" if var=="UGRD" else "10v"
        if codes_get(g,"shortName")!=expected or codes_get(g,"level")!=10: raise ValueError("Wrong field")
        if (codes_get(g,"dataDate"),codes_get(g,"dataTime"),codes_get(g,"endStep"))!=(int(cycle.strftime("%Y%m%d")),cycle.hour*100,step): raise ValueError("Wrong cycle or step")
        if (codes_get(g,"Ni"),codes_get(g,"Nj"))!=(360,181) or codes_get(g,"gridType")!="regular_ll": raise ValueError("Unexpected source grid")
        if any(codes_get(g,k)!=v for k,v in {"iScansNegatively":0,"jScansPositively":0,"jPointsAreConsecutive":0,"alternativeRowScanning":0,"latitudeOfFirstGridPointInDegrees":90,"longitudeOfFirstGridPointInDegrees":0,"iDirectionIncrementInDegrees":1,"jDirectionIncrementInDegrees":1}.items()): raise ValueError("Unexpected scan geometry")
        a=codes_get_values(g).reshape(181,360)[::2,::2].ravel()
        if len(a)!=16380 or any(not math.isfinite(x) or abs(x)>150 for x in a): raise ValueError("Invalid wind values")
        return [round(float(x),2) for x in a]
    finally: codes_release(g)
def build(cycle):
    base=ROOT+f"gfs.{cycle:%Y%m%d}/{cycle:%H}/atmos/gfs.t{cycle:%H}z.pgrb2.1p00.f"
    frames=[]
    for step in STEPS:
        url=base+f"{step:03d}"
        index=request(url+".idx").decode()
        fields={key:decode(request(url,*span),cycle,step,key) for key,span in ranges(index).items()}
        frames.append({"hour":step,"valid":(cycle+dt.timedelta(hours=step)).isoformat(),"u":fields["UGRD"],"v":fields["VGRD"]})
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
                if dt.datetime.fromisoformat(json.loads(path.read_text())["cycle"])>=cycle:
                    print("Already have this or a newer model run");return
            except (ValueError,KeyError,TypeError): pass
        try:
            data=build(cycle)
            temp=path.with_suffix(".tmp")
            temp.write_text(json.dumps(data,separators=(",",":"),allow_nan=False))
            os.replace(temp,path)
            print("Published model cycle",cycle.isoformat());return
        except Exception as exc:
            print("Cycle unavailable:",cycle.isoformat(),type(exc).__name__,str(exc)[:200])
            time.sleep(2)
    raise SystemExit("No complete recent GFS cycle; retaining old file (client rejects stale data)")
if __name__=="__main__": main()
