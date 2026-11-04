import {parentPort,workerData} from 'node:worker_threads';
import {validateDocument} from './validate.js';
try{parentPort.postMessage({mediaType:await validateDocument(Buffer.from(workerData.bytes),workerData.filename)});}
catch{parentPort.postMessage({invalid:true});}
