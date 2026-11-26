"""Sample ECMWF IFS open data (CC BY 4.0) to the dashboard's 2 degree grid."""
import datetime as dt
import json, os, pathlib, tempfile
import numpy as np
from eccodes import codes_grib_new_from_file,codes_get,codes_get_values,codes_release
from ecmwf.opendata import Client
UTC=dt.timezone.utc
STEPS=(0,12,24,48)
PARAMS={"10u":("u",-150,150,"m s**-1"),"10v":("v",-150,150,"m s**-1"),"msl":("p",800,1150,"Pa"),"2t":("t",-100,75,"K")}
TARGET=pathlib.Path(__file__).with_name("ifs.json")
def decode(g,cycle):
    short=codes_get(g,"shortName")
    if short not in PARAMS: raise ValueError("Unexpected parameter")
    name,lo,hi,units=PARAMS[short]
    if codes_get(g,"units")!=units: raise ValueError("Unexpected units")
    if (codes_get(g,"dataDate"),codes_get(g,"dataTime"))!=(int(cycle.strftime("%Y%m%d")),cycle.hour*100): raise ValueError("Wrong cycle")
    step=codes_get(g,"endStep")
    if step not in STEPS or codes_get(g,"stepUnits")!=1: raise ValueError("Wrong forecast time")
    expected={"gridType":"regular_ll","Ni":1440,"Nj":721,"iScansNegatively":0,"jPointsAreConsecutive":0,"alternativeRowScanning":0,"iDirectionIncrementInDegrees":.25,"jDirectionIncrementInDegrees":.25}
    if any(codes_get(g,k)!=v for k,v in expected.items()): raise ValueError("Unsupported grid")
    x0=float(codes_get(g,"longitudeOfFirstGridPointInDegrees"))
    y0=float(codes_get(g,"latitudeOfFirstGridPointInDegrees"))
    south_first=bool(codes_get(g,"jScansPositively"))
    if abs(y0-(-90 if south_first else 90))>.00001: raise ValueError("Wrong latitude origin")
    shift=round(-x0/.25)
    if abs(x0+shift*.25)>.00001: raise ValueError("Wrong longitude origin")
    a=codes_get_values(g).reshape(721,1440)
    if south_first: a=a[::-1]
    a=a[::8,(shift+np.arange(180)*8)%1440].ravel()
    if name=="p": a=a/100
    if name=="t": a=a-273.15
    if len(a)!=16380 or not np.all(np.isfinite(a)) or np.any(a<lo) or np.any(a>hi): raise ValueError("Invalid model values")
    return step,name,[round(float(x),2) for x in a]
def build(cycle):
    client=Client(source="aws",model="ifs",resol="0p25")
    frames={s:{"hour":s,"valid":(cycle+dt.timedelta(hours=s)).isoformat()} for s in STEPS}
    with tempfile.TemporaryDirectory() as tmp:
        path=pathlib.Path(tmp)/"ifs.grib2"
        client.retrieve(date=int(cycle.strftime("%Y%m%d")),time=cycle.hour,stream="oper",type="fc",step=list(STEPS),param=list(PARAMS),target=str(path))
        with path.open("rb") as f:
            while True:
                g=codes_grib_new_from_file(f)
                if g is None: break
                try:
                    step,name,values=decode(g,cycle)
                    if name in frames[step]: raise ValueError("Duplicate field")
                    frames[step][name]=values
                finally: codes_release(g)
    if not all(set(f)=={"hour","valid","u","v","p","t"} for f in frames.values()): raise ValueError("Incomplete IFS run")
    return {"schema":1,"model":"ECMWF IFS","cycle":cycle.isoformat(),"spacing":2,"nx":180,"ny":91,"frames":list(frames.values()),"attribution":"Based on ECMWF data, CC BY 4.0; sampled and converted by Inside Mauritius"}
def main():
    now=dt.datetime.now(UTC)
    t=now-dt.timedelta(hours=6)
    t=t.replace(hour=t.hour//6*6,minute=0,second=0,microsecond=0)
    for offset in (0,6,12):
        cycle=t-dt.timedelta(hours=offset)
        if (now-cycle).total_seconds()>24*3600: continue
        try:
            if TARGET.exists() and dt.datetime.fromisoformat(json.loads(TARGET.read_text())["cycle"])>=cycle:
                print("Current IFS file already present");return
        except (ValueError,KeyError,TypeError): pass
        try:
            data=build(cycle)
            temp=TARGET.with_suffix(".tmp")
            temp.write_text(json.dumps(data,separators=(",",":"),allow_nan=False))
            os.replace(temp,TARGET)
            print("Published ECMWF cycle",cycle.isoformat());return
        except Exception as exc: print("IFS run unavailable",cycle.isoformat(),str(exc)[:300])
    raise SystemExit("No recent complete ECMWF IFS run")
if __name__=="__main__": main()
