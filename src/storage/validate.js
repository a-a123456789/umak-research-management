import yauzl from 'yauzl';
import {PDFDocument} from 'pdf-lib';
import {XMLValidator} from 'fast-xml-parser';
export const MAX_DOCUMENT_BYTES=25_000_000;
const invalid=()=>Object.assign(Error('Invalid document'),{httpStatus:400});
async function validateDocx(bytes){
  await new Promise((resolve,reject)=>{
    yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
      if(error)return reject(invalid());
      let entries=0,total=0,actual=0,finished=false;
      const required=new Set(['[Content_Types].xml','word/document.xml','_rels/.rels']);
      const names=new Set();
      const fail=()=>{if(!finished){finished=true;zip.close();reject(invalid());}};
      zip.on('error',fail);zip.on('end',()=>{if(!finished){finished=true;required.size?reject(invalid()):resolve();}});
      zip.on('entry',entry=>{
        const name=entry.fileName;
        entries++;total+=entry.uncompressedSize;
        if(entries>2000||total>100_000_000||names.has(name)||/\\|(^|\/)\.\.(\/|$)|^\//.test(name)||(entry.generalPurposeBitFlag&1)||/vbaProject|embeddings\//i.test(name))return fail();
        names.add(name);
        if(name.endsWith('/'))return zip.readEntry();
        zip.openReadStream(entry,(err,stream)=>{
          if(err)return fail();
          const chunks=[];let size=0;
          stream.on('error',fail);
          stream.on('data',chunk=>{
            actual+=chunk.length;size+=chunk.length;
            if(actual>100_000_000||size>20_000_000){stream.destroy();return fail();}
            if(required.has(name))chunks.push(chunk);
          });
          stream.on('end',()=>{
            if(finished)return;
            if(required.has(name)){
              const xml=Buffer.concat(chunks).toString('utf8');
              if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)return fail();
              if(name==='[Content_Types].xml'&&(!xml.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')||/macroEnabled/i.test(xml)))return fail();
              if(name==='word/document.xml'&&!/<(?:w:)?document\b/.test(xml))return fail();
              required.delete(name);
            }
            zip.readEntry();
          });
        });
      });zip.readEntry();
    });
  });
}
export async function validateDocument(bytes,filename){
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_DOCUMENT_BYTES)throw invalid();
  if(!/^[^/\\\x00-\x1f]{1,180}\.(pdf|docx)$/i.test(filename))throw invalid();
  if(filename.toLowerCase().endsWith('.pdf')){
    if(!bytes.subarray(0,8).toString().startsWith('%PDF-')||!bytes.subarray(-1024).toString().includes('%%EOF'))throw invalid();
    try{const doc=await PDFDocument.load(bytes,{updateMetadata:false});if(doc.isEncrypted||doc.getPageCount()<1)throw invalid();}catch{throw invalid();}
    return 'application/pdf';
  }
  await validateDocx(bytes);return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}
