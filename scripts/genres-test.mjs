import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const frame='0:'+JSON.stringify({items:[{slug:'one',genres:['Drama','Romance','Medical','Romance']}]})+'\n';
const idHTML='<nav><a href="/genre/mystery">Menu Mystery</a></nav><article class="drama-card"><a href="/drama/one"><img src="/one.jpg" alt="One"></a><div class="card-info"><p>Jepang<span>·</span>2026<span>·</span>Drama</p><p class="card-availability">2 episode tersedia</p></div></article><script>self.__next_f.push('+JSON.stringify([1,frame])+')</script>';
const quHTML='<nav><a href="/genre/misteri/">Menu Misteri</a></nav><div class="dqu-kartu"><a href="https://dramaqu.pro/two/"><img src="/two.jpg" alt="Two"></a><div class="dqu-meta">Komedi, Romantis, China</div><span>3 episode</span></div><div class="dqu-kartu"><a href="https://dramaqu.pro/unknown/"><img src="/unknown.jpg" alt="Unknown"></a></div>';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'genres-test',modules:[{type:'ESModule',path:'worker.js',contents:await readFile('worker.js','utf8')},{type:'Text',path:'index.html',contents:'test'}],compatibilityDate:'2026-11-07',kvNamespaces:['CATALOG'],outboundService:async request=>new Response(new URL(request.url).pathname==='/two/'?'<div class="dqu-chips-kcl"><a href="/genre/komedi/">Komedi</a><a href="/genre/romantis/">Romantis</a><a href="/genre/fantasy/">Fantasy</a></div>':new URL(request.url).hostname==='dramaqu.pro'?quHTML:idHTML,{headers:{'Content-Type':'text/html'}})}]}));
try{
 const get=async source=>(await (await mf.dispatchFetch('http://test/api/catalog?live=1&source='+source)).json()).items;
 assert.deepEqual((await get('dramaid'))[0].genres,['Drama','Romansa','Medis']);const qu=await get('dramaqu');assert.deepEqual(qu[0].genres,['Komedi','Romansa']);assert.deepEqual(qu[1].genres,[]);const full=(await (await mf.dispatchFetch('http://test/api/catalog?live=1&source=dramaqu&metadata=full')).json()).items;assert.deepEqual(full[0].genres,['Komedi','Romansa','Fantasi']);
 console.log('PASS: full structured genres, card metadata fallback, normalized union, unrelated menu excluded, unknown genre remains empty');
 const elements=new Map();const element=()=>({children:[],style:{setProperty(){}},setAttribute(){},replaceChildren(...children){this.children=children},append(...children){this.children.push(...children)},scrollIntoView(){}});const el=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 el('search').value='';el('sort').value='latest';const requests=[];
 const records={dramaid:[{id:'a',title:'Medical Story',genres:['Drama','Medis','Romansa']}],dramaqu:[{id:'b',title:'Funny Story',genres:['Komedi','Romansa']}]};
 const document={getElementById:el,createElement:element,createTextNode:text=>text};
 const context=vm.createContext({document,localStorage:{getItem:()=>null},route(){},fetch:async path=>{requests.push(path);const u=new URL(path,'http://test');return {ok:true,json:async()=>({items:u.searchParams.get('category')==='Drama Jepang'?[{id:'c',title:'New Story',genres:['Aksi']}]:records[u.searchParams.get('source')]})}}});
 const app=await readFile('app.js','utf8');vm.runInContext(app.slice(0,app.indexOf('function stopPlayer')),context);await vm.runInContext('load()',context);
 assert.deepEqual([...vm.runInContext('genres',context)],['Semua','Drama','Komedi','Medis','Romansa']);assert.equal(el('count').textContent,'2 judul');
 const before=requests.length;const medical=el('filters').children.find(b=>b.textContent==='Medis');medical.onclick();assert.equal(requests.length,before);assert.equal(el('count').textContent,'1 judul');assert.equal(vm.runInContext('category',context),'Semua');
 await vm.runInContext("category='Drama Jepang';load()",context);assert.deepEqual([...vm.runInContext('genres',context)],['Semua','Aksi']);assert.equal(vm.runInContext('genre',context),'Semua');assert(requests.every(path=>!path.includes('&genre=')));
 await vm.runInContext("category='Semua';source='dramaqu';load()",context);assert.deepEqual([...vm.runInContext('genres',context)],['Semua','Komedi','Romansa']);
 el('search').value='romansa';vm.runInContext('render()',context);assert.equal(el('count').textContent,'1 judul');
 el('search').value='';context.fetch=async path=>{const u=new URL(path,'http://test');return {ok:true,json:async()=>u.searchParams.get('source')==='dramaid'?(u.searchParams.get('page')==='1'?{items:records.dramaid,nextPage:2}:{items:[{id:'late',title:'Beyond first page',genres:['Aksi']}],nextPage:null}):{items:records.dramaqu,nextPage:null}}};await vm.runInContext("source='all';category='Semua';genre='Semua';load()",context);assert.equal(el('count').textContent,'3 judul');assert(vm.runInContext("genres.includes('Aksi')",context));el('search').value='Beyond first page';vm.runInContext('render()',context);assert.equal(el('count').textContent,'1 judul');
 console.log('PASS: dynamic chips, local filtering without network, category preserved, unavailable selection reset, source-specific genres, genre search');
}finally{await mf.dispose()}
