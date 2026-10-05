from pathlib import Path
import re,html,json
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Preformatted,PageBreak,Image,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from pypdf import PdfReader,PdfWriter
from PIL import Image as PILImage
import argparse,os
a=argparse.ArgumentParser();a.add_argument('--root',type=Path,default=Path(__file__).resolve().parent);args=a.parse_args();P=args.root.resolve();out=P/'output';out.mkdir(exist_ok=True)
for name,file in [('Arial','Arial.ttf'),('ArialBold','Arial Bold.ttf'),('ArialItalic','Arial Italic.ttf')]:pdfmetrics.registerFont(TTFont(name,str(Path(os.environ.get('REPORT_FONT_DIR','/System/Library/Fonts/Supplemental'))/file)))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold',italic='ArialItalic',boldItalic='ArialBold')
styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='Body',fontName='Arial',fontSize=10,leading=13,spaceAfter=6,textColor=colors.HexColor('#203747')));styles.add(ParagraphStyle(name='Tcell',parent=styles['Body'],fontSize=7.2,leading=9,spaceAfter=0));styles.add(ParagraphStyle(name='CodeBlock',fontName='Courier',fontSize=7,leading=9,spaceAfter=10));
for k,size in [('Title',24),('Heading1',17),('Heading2',12)]:styles[k].fontName='ArialBold';styles[k].fontSize=size;styles[k].leading=size*1.2;styles[k].textColor=colors.HexColor('#176F78');styles[k].spaceAfter=10;styles[k].keepWithNext=True
W,H=595.276,841.89;CW=W-88

def fmt(s):
 s=html.escape(s);s=re.sub(r'`([^`]+)`',r'<font name="Courier">\1</font>',s);s=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s);return s

def footer(c,d):
 c.setFont('Arial',8);c.setFillColor(colors.HexColor('#516778'));c.drawString(44,24,'III-BCSAD · bolanatics | CRM | 5 October 2026');c.drawRightString(W-44,24,str(d.page));c.setStrokeColor(colors.HexColor('#D3E3E8'));c.line(44,38,W-44,38)

def build(course):
 text=(P/(course+'_Report.md')).read_text();lines=text.splitlines();story=[];i=0
 while i<len(lines):
  l=lines[i].strip();i+=1
  if not l:continue
  image_match=re.match(r'!\[([^]]*)\]\(([^)]+)\)',l)
  if image_match:
   file=P/image_match.group(2);im=PILImage.open(file);height=min(570,CW*im.height/im.width);width=height*im.width/im.height
   story.append(KeepTogether([Paragraph(fmt(image_match.group(1)),styles['Heading2']),Image(str(file),width=width,height=height),Spacer(1,10)]));continue
  if l=='{{DFD_IMAGES}}':
   for n in [0,1]:
    story.append(Paragraph('Figure '+str(n+1)+'. Level '+str(n)+' Threat Dragon rendered diagram',styles['Heading2']));file=P/'build'/('ThreatDragon_Level_'+str(n)+'.png');im=PILImage.open(file);story.append(Image(str(file),width=CW,height=CW*im.height/im.width));story.append(Spacer(1,10))
   continue
  if l in ['{{ARCH_IMAGE}}','{{ATTACK_IMAGE}}']:
   file=P/'build'/('Algorithm_Architecture.png' if l=='{{ARCH_IMAGE}}' else 'Attack_Tree_Current.png');im=PILImage.open(file);story.append(Image(str(file),width=CW,height=CW*im.height/im.width));story.append(Spacer(1,10));continue
  if l.startswith('<!--'):
   story.append(Paragraph(fmt(l.removeprefix('<!--').removesuffix('-->').strip()),ParagraphStyle(name='Disclosure',parent=styles['Body'],fontSize=8.2,leading=11,textColor=colors.HexColor('#516778'))));continue
  if l.startswith('```'):
   code=[]
   while i<len(lines) and not lines[i].startswith('```'):code.append(lines[i]);i+=1
   i+=1
   import textwrap
   expanded=[]
   for x in code:expanded+=textwrap.wrap(x,110,replace_whitespace=False,drop_whitespace=False) or ['']
   story.append(Preformatted('\n'.join(expanded),styles['CodeBlock']));continue
  if l.startswith('|'):
   rows=[l]
   while i<len(lines) and lines[i].strip().startswith('|'):rows.append(lines[i].strip());i+=1
   data=[[v.strip() for v in x.strip('|').split('|')]for x in rows if not re.match(r'^\|[\s:|-]+\|$',x)]
   n=len(data[0]);weights=[1]*n
   if n==9:weights=[.5,.7,.9,1.2,.55,.7,2,.8,.55]
   if n==10:weights=[.6,.5,.5,.7,.5,.7,.7,1.5,2.3,1]
   if n==4:weights=[1,1,1.5,1.5]
   widths=[CW*w/sum(weights)for w in weights]
   tab=Table([[Paragraph(fmt(v),styles['Tcell'])for v in row]for row in data],colWidths=widths,repeatRows=1,hAlign='LEFT');tab.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E0EFF0')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#CCDDE2')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]));story.extend([tab,Spacer(1,12)]);continue
  if l.startswith('# '):story.append(Paragraph(fmt(l[2:]),styles['Title']));continue
  if l.startswith('## '):
   title=l[3:]
   if title.startswith('I. ') or (title=='References' and course=='IAS'):story.append(PageBreak())
   story.append(Paragraph(fmt(title),styles['Heading1']));continue
  if l.startswith('### '):story.append(Paragraph(fmt(l[4:]),styles['Heading2']));continue
  block=[l]
  while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','|','```','<!--','{{','![')):block.append(lines[i].strip());i+=1
  story.append(Paragraph(fmt(' '.join(block)),styles['Body']))
 pdf=out/(course+'_Report_Only.pdf');SimpleDocTemplate(str(pdf),pagesize=(W,H),leftMargin=44,rightMargin=44,topMargin=42,bottomMargin=52,title=course+' CRM PBL',author='bolanatics; Arnaez K12254175; Ducay A12448793; Balocating A12448769; Maligaya A12448912; Bomediano A12448927',subject='Course-specific roles and section ownership on title page').build(story,onFirstPage=footer,onLaterPages=footer)
 slidefiles=sorted((P/'build'/course).glob('slide-*.png'))
 if len(slidefiles)!=14:print(course,'report ready; waiting for 14 slides');return
 deck=out/(course+'_Defense.pdf');c=canvas.Canvas(str(deck),pagesize=(960,540))
 for f in slidefiles:c.drawImage(str(f),0,0,width=960,height=540);c.showPage()
 c.save();writer=PdfWriter();writer.append(str(pdf));writer.append(str(deck));name='III-BCSAD_bolanatics_'+('Milestone1_Proposal'if course=='ALGOCOM'else'IAS_Capstone_Portfolio')+'.pdf';writer.add_metadata({'/Title':course+' CRM PBL','/Author':'bolanatics | roles and IDs on report title page and slide 1'});writer.write(str(out/name));print(course,len(PdfReader(pdf).pages),'report pages +14 slides')
for course in ['ALGOCOM','IAS']:build(course)
