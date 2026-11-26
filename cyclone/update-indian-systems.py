"""Read dated JTWC ATCF best-track reports mirrored by NOAA/UCAR.
Invests are disturbances, not confirmed cyclones; no forecasts are synthesized."""
import datetime as dt, json, pathlib, re, urllib.request, concurrent.futures
UTC=dt.timezone.utc
NOAA="https://www.ssd.noaa.gov/PS/TROP/DATA/ATCF/JTWC/"
UCAR="https://hurricanes.ral.ucar.edu/repository/data/bdecks_open/"
OUT=pathlib.Path(__file__).with_name("indian-systems.json")
def read(url,limit=2_000_000):
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"InsideMauritiusCycloneWatch/45"}),timeout=15) as r:
        raw=r.read(limit+1)
    if len(raw)>limit:raise ValueError("Oversize")
    return raw.decode("utf-8","replace")
def coordinate(v,positive,negative):
    if not re.fullmatch(r"\d{1,4}["+positive+negative+"]",v):raise ValueError("Coordinate")
    return int(v[:-1])*.1*(1 if v[-1]==positive else -1)
def parse(body,name,now):
    match=re.fullmatch(r"bsh(\d\d)(\d{4})\.dat",name)
    if not match:return None
    num,year=match.groups(); points={}
    for line in body.splitlines():
        p=[x.strip().upper() for x in line.split(",")]
        try:
            if len(p)<11 or p[0]!="SH" or p[1]!=num or p[4]!="BEST" or int(p[5])!=0:continue
            t=dt.datetime.strptime(p[2],"%Y%m%d%H").replace(tzinfo=UTC)
            if not dt.timedelta(minutes=-5)<=now-t<=dt.timedelta(hours=72):continue
            lat=coordinate(p[6],"N","S");lon=coordinate(p[7],"E","W")
            if not -45<=lat<0 or not 30<=lon<=100:continue
            w=int(p[8]);pr=int(p[9])
            item={"time":t.isoformat(),"lat":round(lat,1),"lon":round(lon,1),"wind_kt":w if 1<=w<=200 else None,"pressure_hpa":pr if 800<=pr<=1100 else None,"type":p[10]}
            if t not in points:points[t]=item
        except (ValueError,IndexError):continue
    if not points:return None
    latest=max(points)
    if now-latest>dt.timedelta(hours=36):return None
    if int(num)<90 and points[latest]["type"] not in ("TD","TS","TY","ST","TC","HU","SD","SS","DB","LO"):return None
    return {"id":"SH"+num+year,"label":("Invest " if int(num)>=90 else "System ")+num+"S","invest":int(num)>=90,"points":[points[t] for t in sorted(points)]}
def main():
    now=dt.datetime.now(UTC)
    season=now.year+(now.month>=7)
    systems={};success=0
    for base in (NOAA,UCAR+str(season)+"/"):
        try:
            listing=read(base)
            names=sorted(set(re.findall(r"bsh\d{2}"+str(season)+r"\.dat",listing,re.I)))
            if not names:raise ValueError("No matching directory entries")
            def one(name):
                try:return parse(read(base+name),name.lower(),now),True
                except Exception:return None,False
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
                for item,ok in pool.map(one,names[:100]):
                    success+=int(ok)
                    if item and (item["id"] not in systems or item["points"][-1]["time"]>systems[item["id"]]["points"][-1]["time"]):
                        item["source_url"]=base+"b"+item["id"].lower()+".dat";systems[item["id"]]=item
            if systems:break
        except Exception as exc:print("Mirror unavailable",base,str(exc)[:160])
    data={"schema":1,"checked_at":now.isoformat(),"status":"ok" if success else "unavailable","systems":list(systems.values())}
    tmp=OUT.with_suffix(".tmp");tmp.write_text(json.dumps(data));tmp.replace(OUT)
    print("Files read",success,"recent systems",len(systems))
if __name__=="__main__":main()
