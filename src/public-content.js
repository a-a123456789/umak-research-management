import {Router} from 'express';
import {createHash} from 'node:crypto';
const template=Buffer.from('SYNTHETIC DEMO — Research service request\n\nResearch title: ____________________\nRequested service: ________________\nApplicant name: __________________\nDate: ____________________________\n\nReplace with an institution-approved form before deployment.\n');
const sha256=createHash('sha256').update(template).digest('hex');
const items=[
  {id:'directory',kind:'directory',title:'CRM services (synthetic demo)',text:'Demonstration directory. Institution-approved service contacts must replace this content.'},
  {id:'requirements',kind:'requirements',title:'Applicant requirements (synthetic demo)',text:'Demonstration only. Confirm the current requirements with CRM before applying.'},
  {id:'instructions',kind:'instructions',title:'Submission instructions (synthetic demo)',text:'Sign in to submit a private study. Supported manuscript formats: PDF and DOCX; maximum 25,000,000 bytes.'},
  {id:'request-template',kind:'template',title:'Blank request form (synthetic demo)',text:'Blank demonstration form; contains no applicant data.',url:'/api/v1/public/templates/research-request.txt',sha256}
];
const body={version:'synthetic-2026-11-v1',published_at:'2026-11-04T00:00:00Z',items};
const etag='"'+createHash('sha256').update(JSON.stringify(body)).digest('hex')+'"';
export function publicContentRouter(){
  const r=Router();
  r.get('/content',(req,res)=>{
    res.set({'ETag':etag,'Cache-Control':'public, max-age=300'});
    if(req.get('If-None-Match')===etag)return res.sendStatus(304);res.json(body);
  });
  r.get('/templates/research-request.txt',(_req,res)=>{res.type('text/plain').set('Cache-Control','public, max-age=300').send(template);});
  return r;
}
