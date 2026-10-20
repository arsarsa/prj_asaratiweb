const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { createVersionHandlers } = require('../product-versions');
const { validStoragePath } = require('../product-storage');
const { sha256 } = require('../ebook-original');
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8187') throw new Error('These tests require the isolated local Firestore emulator on port 8187.');
let db;
before(()=>{db=new Firestore({projectId:'demo-asarati-licenses'});});
after(async()=>{if(db)await db.terminate();});
class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
const admin={auth:{uid:'test-admin',token:{admin:true}}};
class Bucket {
  constructor(){this.files=new Map();this.counter=0;this.copies=0;this.failCopy=false;this.onCopy=null;}
  put(name,bytes,metadata={}){const generation=String(++this.counter);const entry={bytes:Buffer.from(bytes),metadata:{...metadata,generation,size:String(Buffer.byteLength(bytes)),contentType:'application/zip'}};this.files.set(name,entry);this.files.set(name+'@'+generation,entry);return generation;}
  file(name,options={}){const self=this;const get=()=>{const result=self.files.get(options?.generation?name+'@'+options.generation:name);if(!result)throw Object.assign(new Error('not found'),{code:404});return result;};return {
    name,getMetadata:async()=>[{...get().metadata}],createReadStream:()=>Readable.from([get().bytes]),
    getSignedUrl:async()=>['https://signed.invalid/'+encodeURIComponent(name)],
    copy:async(target,opts)=>{assert.equal(opts.preconditionOpts.ifGenerationMatch,0);if(self.failCopy)throw new Error('simulated storage failure');if(self.files.has(target.name))throw Object.assign(new Error('exists'),{code:412});const entry=get();self.put(target.name,entry.bytes,opts.metadata);self.copies++;if(self.onCopy)self.onCopy();return [target];}
  };}
}
async function setup({inspectError=false}={}){
 const id='version-test-'+crypto.randomUUID();const bucket=new Bucket();const source=`protected_file/eBook/${id}/book.epub.zip`;bucket.put(source,'first edition');
 const ref=db.collection('products').doc(id);await ref.set({type:'ebook',accessMode:'paid',active:true,price:'0.99',name:'Fixture',storagePath:`protected_file/eBook/${id}`,storageFileName:'book.epub.zip'});
 const factory=createVersionHandlers({db,bucket,HttpsError,timestamp:()=>FieldValue.serverTimestamp(),deleteField:()=>FieldValue.delete(),inspect:async()=>{if(inspectError)throw new Error('invalid EPUB');return{format:'zip',contentFormat:'epub',epubEntry:'book.epub',epubSha256:'fixture',spineItems:1,obfuscatedFonts:0};}});
 return{id,bucket,source,ref,factory};
}
async function init(f){return f.factory.initialize({productId:f.id},admin);}
async function stage(f,bytes){const revision=await f.factory.stage({productId:f.id,fileName:'revision.epub.zip',contentType:'application/zip'},admin);f.bucket.put(revision.objectPath,bytes);return revision;}

test('initial capture preserves original bytes, registers a private immutable v1 and leaves licensing off',async()=>{
 const f=await setup();const result=await init(f);const product=(await f.ref.get()).data();const version=(await f.ref.collection('versions').doc('v1').get()).data();
 assert.equal(result.versionId,'v1');assert.equal(version.original.sha256,sha256(Buffer.from('first edition')));assert.equal(f.bucket.files.get(f.source).bytes.toString(),'first edition');assert.equal(product.currentVersionId,'v1');assert.equal(product.licenseMode,undefined);assert.equal(product.active,true);assert.equal(product.storagePath,`protected_file/eBook/${f.id}/versions/v1/original`);assert.equal(validStoragePath(product,f.id),true);assert.equal(f.bucket.files.get(version.original.storagePath).bytes.toString(),'first edition');
 const repeated=await init(f);assert.equal(repeated.sha256,result.sha256);assert.equal(f.bucket.copies,1);
});
test('anonymous initialization is denied and concurrent initialization does not duplicate the edition',async()=>{
 const f=await setup();await assert.rejects(()=>f.factory.initialize({productId:f.id},{}),e=>e.code==='permission-denied');const results=await Promise.allSettled([init(f),init(f)]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(f.bucket.copies,1);assert.equal((await f.ref.collection('versions').get()).size,1);
});
test('revision upload is staged separately and finalization retains v1 while publishing v2',async()=>{
 const f=await setup();await init(f);const v1=(await f.ref.collection('versions').doc('v1').get()).data();const revision=await stage(f,'second edition');assert.ok(revision.objectPath.startsWith(`protected_file/version_uploads/${f.id}/`));assert.equal((await f.ref.get()).get('currentVersionId'),'v1');
 const result=await f.factory.finalize({productId:f.id,revisionId:revision.revisionId},admin);assert.equal(result.versionId,'v2');assert.equal(result.sha256,sha256(Buffer.from('second edition')));assert.equal(f.bucket.files.get(v1.original.storagePath).bytes.toString(),'first edition');assert.equal(f.bucket.files.get(f.source).bytes.toString(),'first edition');assert.equal((await f.ref.get()).get('currentVersionId'),'v2');
});
test('a repeated finalization reuses its version and never rolls back a newer edition',async()=>{
 const f=await setup();await init(f);const a=await stage(f,'second');await f.factory.finalize({productId:f.id,revisionId:a.revisionId},admin);const b=await stage(f,'third');await f.factory.finalize({productId:f.id,revisionId:b.revisionId},admin);const replay=await f.factory.finalize({productId:f.id,revisionId:a.revisionId},admin);assert.equal(replay.versionId,'v2');assert.equal((await f.ref.get()).get('currentVersionId'),'v3');assert.equal((await f.ref.collection('versions').get()).size,3);
});
test('two revisions based on the same edition cannot overwrite each other',async()=>{
 const f=await setup();await init(f);const a=await stage(f,'candidate A');const b=await stage(f,'candidate B');assert.notEqual(a.versionId,b.versionId);
 const results=await Promise.allSettled([f.factory.finalize({productId:f.id,revisionId:a.revisionId},admin),f.factory.finalize({productId:f.id,revisionId:b.revisionId},admin)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);const winner=results.find(r=>r.status==='fulfilled').value;assert.equal((await f.ref.get()).get('currentVersionId'),winner.versionId);assert.equal((await f.ref.collection('versions').get()).size,2);
});
test('wrong administrator, wrong format, archived product and expired revisions are rejected',async()=>{
 const f=await setup();await init(f);await assert.rejects(()=>f.factory.stage({productId:f.id,fileName:'bad.pdf'},admin),e=>e.code==='invalid-argument');const a=await stage(f,'second');await assert.rejects(()=>f.factory.finalize({productId:f.id,revisionId:a.revisionId},{auth:{uid:'other',token:{admin:true}}}),e=>e.code==='permission-denied');await f.ref.collection('versionUploads').doc(a.revisionId).update({expiresAtMs:0});await assert.rejects(()=>f.factory.finalize({productId:f.id,revisionId:a.revisionId},admin),e=>e.code==='aborted');await f.ref.update({archivedAt:FieldValue.serverTimestamp()});await assert.rejects(()=>init(f),e=>e.code==='failed-precondition');
});
test('a failed copy or invalid EPUB does not activate versioning and retry is possible',async()=>{
 const f=await setup();f.bucket.failCopy=true;await assert.rejects(()=>init(f),/storage failure/);assert.equal((await f.ref.get()).get('versioningEnabled'),undefined);assert.equal((await f.ref.collection('versions').get()).size,0);f.bucket.failCopy=false;await init(f);assert.equal((await f.ref.get()).get('currentVersionId'),'v1');const bad=await setup({inspectError:true});await assert.rejects(()=>init(bad),/invalid EPUB/);assert.equal((await bad.ref.get()).get('versioningEnabled'),undefined);
});
test('an existing conflicting immutable object is never overwritten',async()=>{
 const f=await setup();const target=`protected_file/eBook/${f.id}/versions/v1/original/book.epub.zip`;f.bucket.put(target,'different existing edition');await assert.rejects(()=>init(f),e=>e.code==='data-loss');assert.equal(f.bucket.files.get(target).bytes.toString(),'different existing edition');assert.equal((await f.ref.get()).get('versioningEnabled'),undefined);
});
test('source changes during capture are detected before the registry is activated',async()=>{
 const f=await setup();f.bucket.onCopy=()=>f.bucket.put(f.source,'changed concurrently');await assert.rejects(()=>init(f),e=>e.code==='aborted');assert.equal((await f.ref.get()).get('versioningEnabled'),undefined);assert.equal((await f.ref.collection('versions').get()).size,0);
});
test('versioned path validation rejects staging paths, traversal and false version identifiers',()=>{
 const product={type:'ebook',accessMode:'paid',versioningEnabled:true,currentVersionId:'v1',originalGeneration:'12345',storageFileName:'book.zip',storagePath:'protected_file/eBook/book01/versions/v1/original'};assert.equal(validStoragePath(product,'book01'),true);for(const variant of [{currentVersionId:'../v1'},{storagePath:'protected_file/version_uploads/book01/upload'},{versioningEnabled:false},{accessMode:'free'}])assert.equal(validStoragePath({...product,...variant},'book01'),false);
});
