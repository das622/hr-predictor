"""Regenerate the shared GLB transform and outfield boundary.
Requires Python 3 + numpy. Run from any directory.
The supplied asset uses a flat field mesh and four-by-four node matrices.
Home and mound centers were identified in the field texture, at pixel
(102,524) and (208,494) in an 844 x 811 image. These are approximate.
Ground is the field mesh plane. Scale uses the 60.5 ft pitching distance.
Boundary X/Z comes from outer triangle edges of the field mesh; heights
come from nearby edges of the actual fence/base meshes (0.4 m search).
This is model calibration, not a survey of present-day Yankee Stadium.
"""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
import struct,json,numpy as np
b=(ROOT/'public/yankee-stadium.glb').read_bytes(); n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);data=b[28+n:]
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];count={'VEC3':3,'VEC2':2,'SCALAR':1,'VEC4':4}[a['type']];return np.ndarray((a['count'],count),dtype=dtype,buffer=data,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dtype).itemsize*count),np.dtype(dtype).itemsize))
a=-1.83;R=np.array([[np.cos(a),0,np.sin(a)],[0,1,0],[-np.sin(a),0,np.cos(a)]])
meshes=[]
for nd in j['nodes']:
 if 'mesh' not in nd:continue
 mat=np.array(nd.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T
 for pr in j['meshes'][nd['mesh']]['primitives']:
  p=acc(pr['attributes']['POSITION']);p=p@mat[:3,:3].T+mat[:3,3];p=p@R.T*.95+[141.4,-1,61.7]
  mi=pr.get('material',0);name=j['materials'][mi].get('name',str(mi));meshes.append((nd['name'],name,p,pr))
field=next(x for x in meshes if x[0]=='empty_1182');uv=acc(field[3]['attributes']['TEXCOORD_0']);coef=np.linalg.lstsq(np.c_[uv,np.ones(len(uv))],field[2],rcond=None)[0]
home=np.array([102/844,524/811,1])@coef;mound=np.array([208/844,494/811,1])@coef
v=mound-home;ang=np.arctan2(v[0],v[2]);factor=60.5*.3048/np.linalg.norm(v[[0,2]]);rot=np.array([[np.cos(ang),0,-np.sin(ang)],[0,1,0],[np.sin(ang),0,np.cos(ang)]])

q=(field[2]-home)@rot.T*factor
ids=acc(field[3]['indices']).flatten() if 'indices' in field[3] else np.arange(len(q));edges={}
for tri in q[ids].reshape(-1,3,3):
 for aa,bb in [(0,1),(1,2),(2,0)]:
  key=tuple(sorted([tuple(tri[aa].round(4)),tuple(tri[bb].round(4))]));edges[key]=edges.get(key,0)+1
wall_edges=[]
for name,mat,p,pr in meshes:
 if mat not in ['Fance','Fence2'] and name not in ['empty_1178','empty_1206','empty_1181','empty_1220','empty_1221']:continue
 p=(p-home)@rot.T*factor;ids=acc(pr['indices']).flatten() if 'indices' in pr else np.arange(len(p))
 for t in p[ids].reshape(-1,3,3):
  for i,k in [(0,1),(1,2),(2,0)]:wall_edges.append([t[i],t[k]])
wall_edges=np.array(wall_edges);starts=wall_edges[:,0];delta=wall_edges[:,1]-starts;den=(delta[:,[0,2]]**2).sum(1)
def vertex(pt):
 pt=np.array(pt);u=np.divide(((pt-starts)[:,[0,2]]*delta[:,[0,2]]).sum(1),den,out=np.zeros(len(den)),where=den>1e-10).clip(0,1)
 nearest=starts+u[:,None]*delta;d=np.linalg.norm(nearest[:,[0,2]]-pt[[0,2]],axis=1)
 local=nearest[(d<.4)&(nearest[:,1]<8),1];h=float(local.max()) if len(local) else 0
 if h<1:print('LOW',pt,h)
 return [float(pt[0]),h,float(pt[2])]
segs=[{'a':vertex(a),'b':vertex(b)} for (a,b),cnt in edges.items() if cnt==1 and min(a[2],b[2])>60]
position=(np.array([141.4,-1,61.7])-home)@rot.T*factor
cfg={'position':position.tolist(),'rotationY':float(-1.83-ang),'scale':float(.95*factor)}
open(ROOT/'src/physics/stadiums/model-boundary.json','w').write(json.dumps({'transform':cfg,'segments':segs},indent=2))

print('Regenerated model-boundary.json:',len(segs),'segments')
