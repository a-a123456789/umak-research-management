import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {Agent} from 'node:https';
export function configuredStore(env=process.env,{credentials}={}){
  if(!env.S3_BUCKET)return null;
  if(env.S3_ENDPOINT&&!env.S3_ENDPOINT.startsWith('https://'))throw Error('Object endpoint must use HTTPS');
  const client=new S3Client({region:env.AWS_REGION??'auto',endpoint:env.S3_ENDPOINT||undefined,maxAttempts:2,credentials,
    requestHandler:new NodeHttpHandler({httpsAgent:new Agent({minVersion:'TLSv1.3',rejectUnauthorized:true}),connectionTimeout:5000,requestTimeout:60000})});
  const Bucket=env.S3_BUCKET;
  return {
    async put(Key,Body,ContentType,sha256){
      const encryption=env.S3_ENDPOINT?{}:{ServerSideEncryption:env.S3_KMS_KEY_ID?'aws:kms':'AES256',...(env.S3_KMS_KEY_ID?{SSEKMSKeyId:env.S3_KMS_KEY_ID}:{})};
      await client.send(new PutObjectCommand({Bucket,Key,Body,ContentType,ChecksumSHA256:Buffer.from(sha256,'hex').toString('base64'),...encryption}),{abortSignal:AbortSignal.timeout(60_000)});
    },
    async remove(Key){await client.send(new DeleteObjectCommand({Bucket,Key}),{abortSignal:AbortSignal.timeout(15_000)});},
    async download(Key){return getSignedUrl(client,new GetObjectCommand({Bucket,Key,ResponseContentDisposition:'attachment',ResponseCacheControl:'private, no-store'}),{expiresIn:600});}
  };
}
