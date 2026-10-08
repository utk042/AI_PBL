"""Builds js/data/roads.js from OpenStreetMap data.

1. Snaps each place to the nearest road with the OSRM `nearest` service.
2. Connects every place to its three nearest neighbours.
3. Fetches the real driving distance, free-flow time and road shape for each connection (OSRM `route`).
4. Drops connections that are a long detour (road > 2.6 x straight line) and writes the JS module.

Usage: python scripts/build-network.py [output-file]
"""
import json, math, time, urllib.request, sys
PLACES = [
 ('N0','Central Depot, Knowledge Park II',28.4570,77.5002,'industrial'),
 ('N1','Pari Chowk',28.4631,77.5081,'commercial'),
 ('N2','Alpha 1',28.4710,77.5127,'residential'),
 ('N3','Alpha 2',28.4786,77.5178,'residential'),
 ('N4','Beta 1',28.4808,77.5069,'residential'),
 ('N5','Beta 2',28.4849,77.5135,'commercial'),
 ('N6','Jagat Farm Market, Gamma 1',28.4848,77.5001,'narrow-lane market'),
 ('N7','Gamma 2',28.4905,77.5094,'residential'),
 ('N8','Delta 1',28.4785,77.5257,'residential'),
 ('N9','Delta 2',28.4893,77.5210,'residential'),
 ('N10','Delta 3',28.4957,77.5186,'residential'),
 ('N11','Eta 1',28.4944,77.5285,'residential'),
 ('N12','Pi 1',28.4708,77.5391,'residential'),
 ('N13','Sector 36',28.4700,77.5317,'residential'),
 ('N14','Sigma 1',28.4530,77.5474,'residential'),
 ('N15','Omicron 1',28.4627,77.5623,'residential'),
 ('N16','Grand Venice Mall',28.4526,77.5263,'commercial'),
 ('N17','Chi 3',28.4383,77.5140,'residential'),
 ('N18','Gautam Buddha University',28.4227,77.5257,'institutional'),
 ('N19','NIET Campus',28.4628,77.4908,'institutional'),
 ('N20','Sharda University',28.4734,77.4829,'institutional'),
 ('N21','Knowledge Park III',28.4608,77.4631,'institutional'),
 ('N22','Udyog Vihar',28.5022,77.4772,'industrial'),
 ('N23','Surajpur Bazaar',28.5107,77.4786,'narrow-lane market'),
 ('N24','Tilapta',28.5340,77.5274,'residential'),
 ('N25','Phi 2',28.4508,77.5213,'residential'),
]
def get(url):
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'ai-pbl-student-project/1.0'}), timeout=30))
        except Exception as e:
            print('retry', e, file=sys.stderr); time.sleep(2*(i+1))
    raise SystemExit('failed '+url)
BASE='https://router.project-osrm.org'
nodes=[]
for nid,name,lat,lng,zone in PLACES:
    r=get(f'{BASE}/nearest/v1/driving/{lng},{lat}?number=1')
    lng2,lat2=r['waypoints'][0]['location']
    nodes.append(dict(id=nid,name=name,lat=round(lat2,6),lng=round(lng2,6),zone=zone))
    time.sleep(0.3)
def hav(a,b):
    R=6371.0088; p1,p2=math.radians(a['lat']),math.radians(b['lat']); dl=math.radians(b['lng']-a['lng']); dp=p2-p1
    return 2*R*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
cand=set()
for a in nodes:
    near=sorted((hav(a,b),b['id']) for b in nodes if b is not a)[:3]
    for d,bid in near: cand.add(tuple(sorted((a['id'],bid),key=lambda s:int(s[1:]))))
byid={n['id']:n for n in nodes}
edges=[]
for a,b in sorted(cand,key=lambda e:(int(e[0][1:]),int(e[1][1:]))):
    A,B=byid[a],byid[b]
    r=get(f"{BASE}/route/v1/driving/{A['lng']},{A['lat']};{B['lng']},{B['lat']}?overview=simplified&geometries=geojson")
    rt=r['routes'][0]
    dist=rt['distance']/1000; dur=rt['duration']/60; straight=hav(A,B)
    geom=[[round(c[1],5),round(c[0],5)] for c in rt['geometry']['coordinates']]
    edges.append(dict(frm=a,to=b,distance=round(dist,2),minutes=round(dur,2),straight=round(straight,3),ratio=round(dist/straight,2),geometry=geom))
    print(a,b,round(dist,2),'km',round(dur,1),'min ratio',round(dist/straight,2),len(geom),'pts')
    time.sleep(0.3)
raw=dict(nodes=nodes,edges=edges)

# ---- write module
nodes=raw['nodes']; edges=[e for e in raw['edges'] if e['ratio']<=2.6 or (e['frm'],e['to'])==('N0','N21')]
lat0=sum(n['lat'] for n in nodes)/len(nodes); lng0=min(n['lng'] for n in nodes); latmax=max(n['lat'] for n in nodes)
kx=111.320*math.cos(math.radians(lat0)); ky=110.574
for n in nodes:
    n['x']=round((n['lng']-lng0)*kx,3); n['y']=round((latmax-n['lat'])*ky,3)
# connectivity
adj={n['id']:set() for n in nodes}
for e in edges: adj[e['frm']].add(e['to']); adj[e['to']].add(e['frm'])
seen={'N0'}; st=['N0']
while st:
    c=st.pop()
    for d in adj[c]:
        if d not in seen: seen.add(d); st.append(d)
assert len(seen)==len(nodes), set(adj)-seen
def rtype(e):
    v=e['distance']/(e['minutes']/60)
    return 'main' if v>=45 else 'arterial' if v>=30 else 'local'
TRAFFIC={'main':1.4,'arterial':1.6,'local':1.8}
out=[]
out.append('// Greater Noida road network (Month 2 dataset).')
out.append('// Place coordinates and road shapes come from OpenStreetMap (snapped with the OSRM routing service).')
out.append('// Road distance is the real driving distance; travel time is the OSRM free-flow time multiplied by a')
out.append('// peak-hour traffic factor for the road type. x / y are km on a local flat grid used by the heuristics.')
out.append('// Regenerate with scripts/build-network.py.')
out.append('')
out.append("export const ROAD_TYPES = {\n  main: { label: 'Main road', traffic: 1.4 },\n  arterial: { label: 'City road', traffic: 1.6 },\n  local: { label: 'Local road', traffic: 1.8 },\n};")
out.append('')
out.append('export const NODES = [')
for n in nodes:
    dep=", depot: true" if n['id']=='N0' else ''
    out.append(f"  {{ id: '{n['id']}', name: '{n['name']}', lat: {n['lat']}, lng: {n['lng']}, x: {n['x']}, y: {n['y']}, zone: '{n['zone']}'{dep} }},")
out.append('];')
out.append('')
out.append('// distance in km, time in minutes, geometry as [lat, lng] points from `from` to `to`')
out.append('export const EDGES = [')
for e in edges:
    t=rtype(e); time=round(e['minutes']*TRAFFIC[t],1)
    g=json.dumps(e['geometry'],separators=(',',':'))
    out.append(f"  {{ from: '{e['frm']}', to: '{e['to']}', type: '{t}', distance: {round(e['distance'],2)}, time: {time}, geometry: {g} }},")
out.append('];')
open(sys.argv[1] if len(sys.argv) > 1 else 'js/data/roads.js','w').write('\n'.join(out)+'\n')
print(len(nodes),'nodes',len(edges),'edges', {t:sum(1 for e in edges if rtype(e)==t) for t in TRAFFIC})
