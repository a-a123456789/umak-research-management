"""Render review SVGs from the editable model; this is not a Threat Dragon UI export."""
from pathlib import Path
import json,html,math
p=Path(__file__).resolve().parents[1];model=json.loads((p/'security/models/CRM_Threat_Dragon.json').read_text())
for i,d in enumerate(model['detail']['diagrams']):
 cells=d['cells'];nodes={c['id']:c for c in cells if 'position'in c}
 width=max(c['position']['x']+c['size']['width'] for c in nodes.values())+50
 height=max(c['position']['y']+c['size']['height'] for c in nodes.values())+110
 svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 -70 {width} {height}">','<rect x="0" y="-70" width="100%" height="100%" fill="white"/>','<defs><marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#527184"/></marker></defs>',f'<text x="20" y="-40" font-family="Arial" font-size="22" font-weight="bold">{html.escape(d["title"])}</text>','<text x="20" y="-17" font-family="Arial" font-size="12">Local implementation + labelled target extensions. Review rendering from model; UI export pending.</text>']
 def text(x,y,s,size=12):
  return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Arial" font-size="{size}" fill="#172f42">{html.escape(s)}</text>'
 def center(c):return (c['position']['x']+c['size']['width']/2,c['position']['y']+c['size']['height']/2)
 for c in cells:
  if c['shape']=='trust-boundary-curve':
   s,t=c['source'],c['target'];svg.append(f'<line x1="{s["x"]}" y1="{s["y"]}" x2="{t["x"]}" y2="{t["y"]}" stroke="#b65236" stroke-width="2" stroke-dasharray="8 5"/>');svg.append(text((s['x']+t['x'])/2,min(s['y'],t['y'])+15,c['data']['name'],11))
 for c in cells:
  if c['shape']!='flow':continue
  source=nodes[c['source']['cell']];target=nodes[c['target']['cell']];sx,sy=center(source);tx,ty=center(target)
  def edge(node,x,y,ox,oy):
   dx,dy=ox-x,oy-y;factor=min(node['size']['width']/2/abs(dx) if dx else math.inf,node['size']['height']/2/abs(dy) if dy else math.inf);return x+dx*factor,y+dy*factor
  vertices=[(v['x'],v['y'])for v in c.get('vertices',[])];start=edge(source,sx,sy,*(vertices[0] if vertices else (tx,ty)));end=edge(target,tx,ty,*(vertices[-1] if vertices else(sx,sy)));points=[start]+vertices+[end]
  svg.append('<polyline points="'+' '.join(f'{x},{y}'for x,y in points)+'" fill="none" stroke="#527184" stroke-width="1.5" marker-end="url(#arrow)"/>')
  x,y=points[len(points)//2];x2,y2=points[len(points)//2-1];svg.append(text((x+x2)/2,(y+y2)/2-6,c['data']['name'],10))
 for c in nodes.values():
  x,y=c['position']['x'],c['position']['y'];w,h=c['size']['width'],c['size']['height'];fill={'actor':'#eef2f6','process':'#e4f5f2','store':'#fff1da'}[c['shape']];svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{24 if c["shape"]=="process" else 4}" fill="{fill}" stroke="#233442"/>')
  for j,line in enumerate(c['data']['name'].splitlines()):svg.append(text(x+w/2,y+h/2+j*16-(len(c['data']['name'].splitlines())-1)*8,line))
 svg.append('</svg>');(p/f'security/diagrams/DFD_Level_{i}.svg').write_text('\n'.join(svg))
