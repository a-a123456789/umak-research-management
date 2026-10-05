import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||import.meta.dirname),skill=process.env.PRESENTATIONS_SKILL,python=process.env.RUNTIME_PYTHON,modules=process.env.RUNTIME_NODE_MODULES;
if(!skill||!python||!modules)throw Error('Set PRESENTATIONS_SKILL, RUNTIME_PYTHON, RUNTIME_NODE_MODULES');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(modules,'@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const {resolvePresentationFont,applyPresentationChartFont,finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const family=resolvePresentationFont({fontFamily:'Arial'}),decks=JSON.parse(await fs.readFile(path.join(root,'slides.json'),'utf8'));
await fs.mkdir(path.join(root,'build'),{recursive:true});await fs.mkdir(path.join(root,process.env.OUTPUT_DIR||'output'),{recursive:true});
function box(s,t,x,y,w,h,size=28,color='#19364A',bold=false){let a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});a.text=t;a.text.style={typeface:family,fontSize:size,color,bold,autoFit:'none'};return a;}
for(const [course,items]of Object.entries(decks)){
 const p=Presentation.create({slideSize:{width:1280,height:720}});
 for(let n=0;n<items.length;n++){
  const d=items[n],s=p.slides.add();s.background.fill='#F7FAFC';
  box(s,course+' / CRM · III-BCSAD · bolanatics',60,25,1140,30,18,'#247F82',true);
  box(s,d.title,60,72,1160,103,40,'#142E42',true);
  if(d.kind==='cover')d.rows.forEach((r,i)=>{box(s,r[0],75,207+i*75,690,50,25);box(s,r[1],775,207+i*75,430,50,23,'#247F82');});
  else if(d.kind==='table'){
   const rows=d.rows,cols=rows[0].length,h=d.points.length?320:414;
   const t=s.tables.add({rows:rows.length,columns:cols,left:60,top:184,width:1160,height:h,values:rows});
   t.borders.assign({fill:'#CCDDE2',width:1});
   for(let i=0;i<rows.length;i++)for(let j=0;j<cols;j++){let c=t.getCell(i,j);c.fill=i===0?'#176F78':i%2?'#FFFFFF':'#E8F1F3';c.text.style={typeface:family,fontSize:cols>=9?18:cols>=5?22:23,color:i===0?'#FFFFFF':'#19364A',bold:i===0};}
   d.points.forEach((v,i)=>box(s,v,65,525+i*42,1150,40,21));
  }else if(['image','dfd','tree'].includes(d.kind)){
   s.images.add({blob:await fs.readFile(path.join(root,'figures',d.image)),contentType:'image/png',alt:d.title,fit:'contain',position:{left:60,top:170,width:1160,height:d.kind==='dfd'?438:d.kind==='tree'?330:325}});
   d.points.forEach((v,i)=>box(s,v,65,505+i*35,1140,35,21));
  }else if(d.kind==='code'){box(s,d.left,65,190,555,410,25);box(s,d.right,655,190,555,410,25);}
  else if(d.kind==='references'){
   let rs=d.references.map(v=>v.replace(/https?:\/\/\S+/g,'').replace(/;\s*;/g,';').trim()),mid=Math.ceil(rs.length/2),hh=rs.length>10?48:92;
   rs.forEach((v,i)=>box(s,v,65+(i>=mid?590:0),178+(i%mid)*hh,560,hh-2,rs.length>10?17:21));
  }else if(d.kind==='chart'){
   const chart=s.charts.add('bar',{position:{left:65,top:200,width:1150,height:310},categories:['Sequence','Branch','Reversed'],series:[{name:'Proposed',values:[2.6785,3.5737,2.6634],fill:'#168887'},{name:'Repeated scans',values:[63.7561,21.4473,113.4524],fill:'#D98B38'}],barOptions:{direction:'column',grouping:'clustered'},hasLegend:true,dataLabels:{showValue:true,position:'outEnd'}});applyPresentationChartFont(chart,{fontFamily:family});box(s,d.points.join('\n'),65,535,1140,75,23);
  }else d.points.forEach((v,i)=>{box(s,String(i+1).padStart(2,'0'),70,205+i*128,60,50,25,'#247F82',true);box(s,v,150,205+i*128,1040,106,29);});
  box(s,d.ref,65,628,1140,48,17,'#516778');box(s,'github.com/a-a123456789/umak-research-management',65,688,1060,22,16,'#516778');box(s,`${n+1}/14`,1150,685,100,26,18,'#247F82');
  s.speakerNotes.textFrame.setText([...(d.points||[]),...(d.references||[]),d.notes||'',d.ref].join('\n'));
 }
 const candidatePath=path.join(root,'build',course+'-candidate.pptx'),finalPath=path.join(root,process.env.OUTPUT_DIR||'output',course+'_Defense.pptx');
 await(await PresentationFile.exportPptx(p)).save(candidatePath);
 const owners=course==='IAS'?[3,7,9,10,13]:[];
 await finalizePresentation({explicitTotalSlideCount:14,materializeLiteralChartWorkbooks:true,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:course==='ALGOCOM'?[10]:[],workspaceDir:root,candidatePath,finalPath,pythonExecutable:python,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(n=>['--require-native-table-slide',String(n)])],fontPolicy:{basis:'design',families:[family]},verifyArtifactToolImport:true,receiptPath:path.join(root,'build',course+'-'+(process.env.OUTPUT_DIR||'output')+'-validation.json')});
 await fs.mkdir(path.join(root,'build',course),{recursive:true});
 for(let i=0;i<14;i++){let b=await p.export({slide:p.slides.items[i],format:'png',scale:1.5});await fs.writeFile(path.join(root,'build',course,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));}
 console.log(course+' finalized: 14 slides');
}
