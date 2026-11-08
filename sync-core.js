export const BADGE_LIFETIME=24*60*60*1000;
export const WIB_CRON='0 20 * * *';
export function wibDay(timestamp){return new Date(timestamp+7*60*60*1000).toISOString().slice(0,10)}
export function recent(item,now=Date.now()){return Number.isFinite(item.lastContentUpdateAt)&&item.lastContentUpdateAt<=now&&now-item.lastContentUpdateAt<BADGE_LIFETIME}
export function dedupeCandidates(items){const map=new Map;for(const item of items){const previous=map.get(item.id);if(!previous||(Number(item.episodeCount)||0)>(Number(previous.episodeCount)||0))map.set(item.id,{...item,requiresDetail:Boolean(previous?.requiresDetail||item.requiresDetail)});else if(item.requiresDetail)map.set(item.id,{...previous,requiresDetail:true})}return [...map.values()]}
export function mergeExisting(rows,candidates,now){const matched=[],updated=[];let changed=false;const items=rows.map(old=>{const item=candidates.get(old.id);if(!item)return old;matched.push(old.id);if(Number.isInteger(item.episodeCount)&&item.episodeCount>(Number(old.episodeCount)||0)){changed=true;updated.push(old.id);return {...old,title:item.title||old.title,image:item.image||old.image,episodeCount:item.episodeCount,lastContentUpdateAt:now}}return old});return {items,matched,updated,changed}}
const RETRY={retries:{limit:2,delay:'30 seconds',backoff:'exponential'},timeout:'30 seconds'};
export async function runCatalogSync(env,step,options){
 const {now,runId,scanPage,enrich}=options,day=wibDay(now),version='sync-'+runId.replace(/[^a-zA-Z0-9_-]/g,'-');
 const initial=await step.do('load-manifest',async()=>({manifest:await env.CATALOG.get('manifest','json'),previous:await env.CATALOG.get('sync:run:'+day,'json')}));
 if(initial.previous?.finishedAt&&!options.allowRepeat)return {...initial.previous,duplicate:true};
 if(!initial.manifest?.sources)throw Error('Catalog manifest unavailable');
 const manifest=structuredClone(initial.manifest),report={day,checkedAt:new Date(now).toISOString(),added:0,episodesUpdated:0,detailsFailed:0,sources:{},errors:[],limitations:options.limitations||[]},staged=[];
 for(const source of ['dramaid','dramaqu']){
  const candidates=[],info={checkedPages:0,added:0,episodesUpdated:0,status:'ok'};report.sources[source]=info;
  try{for(let page=1;page<=(options.pageLimits?.[source]||5);page++){const rows=await step.do('fetch-'+source+'-'+page,RETRY,()=>scanPage(source,page));candidates.push(...rows);info.checkedPages++;if(!rows.length)break}}
  catch(error){info.status=candidates.length?'partial':'failed';report.errors.push({source,stage:'listing',message:String(error.message).slice(0,200)});if(!candidates.length)continue}
  const incoming=new Map(dedupeCandidates(candidates).map(item=>[item.id,item])),matched=new Set,sourceInfo=manifest.sources[source];
  for(const item of incoming.values()){if(!item.requiresDetail)continue;try{const details=await step.do('resolve-'+item.id,RETRY,()=>enrich(item));Object.assign(item,details,{detailResolved:true})}catch(error){report.detailsFailed++;report.errors.push({source,stage:'detail',id:item.id,message:String(error.message).slice(0,200)});if(!item.image)incoming.delete(item.id)}}
  if(!sourceInfo)throw Error('Missing source '+source);
  for(let index=0;index<sourceInfo.chunks.length;index++){
   const oldKey=sourceInfo.chunks[index],key=`catalog:${version}:${source}:${index}`;
   const result=await step.do('merge-'+source+'-'+index,async()=>{const rows=await env.CATALOG.get(oldKey,'json');if(!Array.isArray(rows))throw Error('Missing catalog chunk '+oldKey);const merged=mergeExisting(rows,incoming,now);if(merged.changed)await env.CATALOG.put(key,JSON.stringify(merged.items));return {key:merged.changed?key:oldKey,changed:merged.changed,matched:merged.matched,updated:merged.updated}});
   result.matched.forEach(id=>matched.add(id));sourceInfo.chunks[index]=result.key;if(result.changed)staged.push(result.key);info.episodesUpdated+=result.updated.length;
  }
  const newItems=[];
  for(const item of incoming.values()){
   if(matched.has(item.id))continue;
   let details={};try{if(!item.detailResolved)details=await step.do('detail-'+item.id,RETRY,()=>enrich(item))}catch(error){report.detailsFailed++;report.errors.push({source,stage:'detail',id:item.id,message:String(error.message).slice(0,200)})}
   const {requiresDetail,detailResolved,...record}=item;newItems.push({...record,...details,id:item.id,source,url:item.url,episodeCount:item.episodeCount,lastContentUpdateAt:now});
  }
  for(let offset=0;offset<newItems.length;offset+=200){const key=`catalog:${version}:${source}:new:${offset/200}`,rows=newItems.slice(offset,offset+200);await step.do('append-'+source+'-'+offset,async()=>{await env.CATALOG.put(key,JSON.stringify(rows));return true});sourceInfo.chunks.push(key);staged.push(key)}
  info.added=newItems.length;sourceInfo.titles+=info.added;sourceInfo.lastCheckedAt=new Date(now).toISOString();report.added+=info.added;report.episodesUpdated+=info.episodesUpdated;
 }
 if(staged.length){
  for(let index=0;index<staged.length;index++)await step.do('verify-'+index,async()=>{if(!Array.isArray(await env.CATALOG.get(staged[index],'json')))throw Error('Staged chunk unavailable');return true});
  await step.sleep('wait-for-kv-propagation','65 seconds');
  manifest.version=version;manifest.updatedAt=new Date(now).toISOString();
  await step.do('publish-manifest',async()=>{const current=await env.CATALOG.get('manifest','json');if(current?.version===version)return true;if(current?.version!==initial.manifest.version)throw Error('Catalog changed during sync; refusing to overwrite');await env.CATALOG.put('manifest',JSON.stringify(manifest));return true});
 }
 report.status=Object.values(report.sources).every(source=>source.status==='failed')?'failed':report.errors.length||report.limitations.length?'partial':staged.length?'updated':'unchanged';
 return await step.do('save-result',async()=>{const result={...report,finishedAt:new Date().toISOString()};await env.CATALOG.put('sync:run:'+day,JSON.stringify(result),{expirationTtl:30*86400});await env.CATALOG.put('sync:last',JSON.stringify(result));console.log(JSON.stringify({event:'catalog_daily_sync',...result}));return result});
}
