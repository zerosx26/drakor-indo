import {readFile,writeFile,mkdir} from 'node:fs/promises';
const archive=JSON.parse(await readFile('catalog.json','utf8'));
if(!Array.isArray(archive.items)||!archive.items.length)throw Error('Empty catalog');
const version=archive.updatedAt.replace(/[^0-9]/g,''),manifest={version,updatedAt:archive.updatedAt,sources:{},metadataFailures:archive.metadataErrors.length};
const batches=[];let batch=[];const directory='../import-batches';await mkdir(directory,{recursive:true});
for(const source of ['dramaid','dramaqu']){
 const items=archive.items.filter(item=>item.source===source);if(items.length!==archive.sources[source].titles)throw Error('Incorrect source count');if(new Set(items.map(item=>item.id)).size!==items.length)throw Error('Duplicate IDs');if(items.some(item=>new URL(item.url).origin!==(source==='dramaid'?'https://dramaid.nimegami.id':'https://dramaqu.pro')||!item.title||!item.image||!Array.isArray(item.genres)||typeof item.country!=='string'))throw Error('Invalid metadata');
 const chunks=[];for(let i=0;i<items.length;i+=200){const key=`catalog:${version}:${source}:${i/200}`;chunks.push(key);batch.push({key,value:JSON.stringify(items.slice(i,i+200))});if(batch.length===2){batches.push(batch);batch=[]}}
 manifest.sources[source]={...archive.sources[source],chunks};
}
if(batch.length)batches.push(batch);
for(let i=0;i<batches.length;i++)await writeFile(`${directory}/batch-${i}.json`,JSON.stringify(batches[i]));
await writeFile('catalog-manifest.json',JSON.stringify(manifest,null,2)+'\n');await writeFile(`${directory}/manifest.json`,JSON.stringify([{key:'manifest',value:JSON.stringify(manifest)}]));
console.log(JSON.stringify({titles:archive.items.length,sources:archive.sources,metadataFailures:manifest.metadataFailures,batches:batches.length,version}));
