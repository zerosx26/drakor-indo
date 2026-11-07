import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i>=0?args[i+1]:fallback};
const port=Number(option('--port',process.env.PORT||'5173'));
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"drakor-indo",modules:[{type:'ESModule',path:'worker.js',contents:await readFile('worker.js','utf8')},{type:'Text',path:'index.html',contents:await readFile('index.html','utf8')}],compatibilityDate:'2026-11-07',outboundService:async request=>{try{const {stdout}=await exec('curl',['-fsS','--max-time','20',request.url],{maxBuffer:3*1024*1024});return new Response(stdout,{headers:{'Content-Type':'text/html'}})}catch{return new Response('Source unavailable',{status:502})}}}]}));

try {
 for(const source of ['dramaid','dramaqu']){
 const r=await mf.dispatchFetch('http://local/api/catalog?source='+source);const data=await r.json();if(!r.ok||!data.items?.length)throw Error(JSON.stringify(data));if(!Number.isInteger(data.items[0].episodeCount)||data.items[0].episodeCount<1)throw Error('Missing episode count for '+source);console.log(source,'catalog',data.items.length,data.items[0].title,data.items[0].episodeCount+' episodes');
 const d=await (await mf.dispatchFetch('http://local/api/detail?url='+encodeURIComponent(data.items[0].url))).json();if(!d.episodes?.length)throw Error('No episodes '+JSON.stringify(d));console.log(source,'episodes',d.episodes.length);
 const w=await (await mf.dispatchFetch('http://local/api/watch?url='+encodeURIComponent(d.episodes[0].url))).json();if(!w.video&&!w.embed)throw Error('No player '+JSON.stringify(w));console.log(source,'player',w.video||w.embed);
 }
 const awake=await (await mf.dispatchFetch('http://local/api/detail?url=https%3A%2F%2Fdramaid.nimegami.id%2Fdrama%2Fthe-awake-2026')).json();
 if(awake.episodes?.length!==22||awake.episodes.some((e,i)=>e.number!==i+1))throw Error('The Awake must be ordered 1 through 22: '+JSON.stringify(awake));
 if(!awake.episodes[21].url.endsWith('episode-22-end'))throw Error('Final episode URL must retain END');
 const finalPlayer=await (await mf.dispatchFetch('http://local/api/watch?url='+encodeURIComponent(awake.episodes[21].url))).json();
 if(!finalPlayer.video&&!finalPlayer.embed)throw Error('Final episode missing player');
 const html=await readFile('index.html','utf8');
 if(/source-link|Buka episode di sumber|Buka halaman sumber|Referensi|buka halaman sumber/i.test(html))throw Error('Source links remain visible');
 console.log('The Awake: episodes 1–22 ordered, final player available; source links removed');
 for(const source of ['dramaid','dramaqu'])for(const genre of ['Semua','Romansa','Drama','Komedi','Misteri','Medis']){
 const response=await mf.dispatchFetch('http://local/api/catalog?source='+source+'&genre='+encodeURIComponent(genre));const data=await response.json();
 if(!response.ok||!Array.isArray(data.items))throw Error('Filter failed: '+source+' '+genre+' '+JSON.stringify(data));
 if(source==='dramaqu'&&genre==='Medis'){if(data.items.length)throw Error('Unsupported medical category must be empty')}else if(!data.items.length)throw Error('Expected titles for '+source+' '+genre);
 console.log('Filter',source,genre,data.items.length);
 }
 const denied=await mf.dispatchFetch('http://local/api/detail?url=https://example.com/');if(denied.status!==400)throw Error('URL validation failed');
 console.log('Invalid source rejected',denied.status);
} finally {await mf.dispose()}
