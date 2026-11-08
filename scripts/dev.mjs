import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback};
const port=Number(option('--port',process.env.PORT||'5173'));
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"drakor-indo",modules:[{type:'ESModule',path:'worker.js',contents:await readFile('worker.js','utf8')},{type:'Text',path:'index.html',contents:await readFile('index.html','utf8')}],compatibilityDate:'2026-11-07',kvNamespaces:['CATALOG'],outboundService:async request=>{try{const {stdout}=await exec('curl',['-fsS','--max-time','20',request.url],{maxBuffer:3*1024*1024});return new Response(stdout,{headers:{'Content-Type':'text/html'}})}catch{return new Response('Source unavailable',{status:502})}}}]}));
const archive=JSON.parse(await readFile('catalog.json','utf8')),catalogKV=await mf.getKVNamespace('CATALOG');const manifest={updatedAt:archive.updatedAt,sources:{}};for(const source of ['dramaid','dramaqu']){const rows=archive.items.filter(item=>item.source===source),chunks=[];for(let i=0;i<rows.length;i+=500){const key=source+':'+i;chunks.push(key);await catalogKV.put(key,JSON.stringify(rows.slice(i,i+500)))}manifest.sources[source]={...archive.sources[source],chunks}}await catalogKV.put('manifest',JSON.stringify(manifest));

const server=createServer(async(req,res)=>{try{const response=await mf.dispatchFetch('http://localhost'+req.url,{method:req.method});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(error){res.writeHead(500);res.end(error.message)}});
server.listen(port,'0.0.0.0',()=>console.log('Local: http://localhost:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await mf.dispose();process.exit(0)});
