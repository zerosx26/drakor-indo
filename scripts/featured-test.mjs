import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let unavailable=new Set();
const idTitles=['Shared Drama','ID Two','ID Three','ID Four','ID Five','ID Six','ID Seven'];
const quTitles=['Shared Drama (2026)','QU Two','QU Three','QU Four','QU Five','QU Six','QU Seven','QU Eight','QU Nine','QU Ten'];
const slug=s=>s.toLowerCase().replace(/[^a-z]+/g,'-').replace(/-$/,'');
const idHTML='<section class="home-carousel">'+idTitles.map(title=>`<article class="home-hero"><img src="/cover.jpg" alt="${title}"><a href="/drama/${slug(title)}">Detail</a><p class="hero-description">Synopsis</p></article>`).join('')+'</section>';
const quHome='<div class="dqu-kartu"><a href="https://dramaqu.pro/seed/"><img src="/cover.jpg" alt="Seed"></a><span>2 episode</span></div>';
const quHTML='<div><section class="jsp-kotak"><h2>Populer Minggu Ini</h2>'+quTitles.map(title=>`<a class="jsp-item" href="https://dramaqu.pro/${slug(title)}/"><img src="/cover.jpg" alt="${title}"></a>`).join('')+'</section><section class="jsp-kotak"><a class="jsp-item" href="https://dramaqu.pro/not-popular/"><img src="/cover.jpg" alt="Not Popular"></a></section></div>';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'test',modules:[{type:'ESModule',path:'worker.js',contents:await readFile('worker.js','utf8')},{type:'Text',path:'index.html',contents:'test'}],compatibilityDate:'2026-11-07',kvNamespaces:['CATALOG'],outboundService:async request=>{const url=new URL(request.url);if(unavailable.has(url.hostname))return new Response('',{status:503});return new Response(url.hostname==='dramaid.nimegami.id'?idHTML:url.pathname==='/'?quHome:quHTML,{headers:{'Content-Type':'text/html'}})}}]}));
const get=async()=>{const r=await mf.dispatchFetch('http://test/api/featured');assert.equal(r.status,200);return (await r.json()).items};
try{
 let items=await get();assert.equal(items.length,10);assert.equal(items[0].source,'dramaid');assert.equal(items.filter(x=>x.title.startsWith('Shared Drama')).length,1);assert.equal(items[1].title,'ID Two');assert(!items.some(x=>x.title==='Not Popular'));
 unavailable=new Set(['dramaid.nimegami.id']);items=await get();assert.equal(items.length,10);assert(items.every(x=>x.source==='dramaqu'));
 unavailable=new Set(['dramaqu.pro']);items=await get();assert.equal(items.length,7);assert(items.every(x=>x.source==='dramaid'));
 unavailable=new Set(['dramaid.nimegami.id','dramaqu.pro']);assert.deepEqual(await get(),[]);
 const app=await readFile('app.js','utf8');const start=app.indexOf('function shuffled('),end=app.indexOf('function scheduleFeatured(',start);let random=0;const context=vm.createContext({Math:Object.assign(Object.create(Math),{random:()=>random}),input:[1,2,3,4]});vm.runInContext(app.slice(start,end)+';result=shuffled(input)',context);assert.equal(context.input.join(','),'1,2,3,4');assert.equal(context.result.length,4);assert.notEqual(context.result.join(','),context.input.join(','));

 const nodes=new Map();const element=()=>({listeners:{},addEventListener(type,callback){this.listeners[type]=callback},contains(target){return target===this||Array.from(nodes.values()).includes(target)},closest(){return null},textContent:'',hidden:false,open:false,disabled:false,style:{},children:[],attributes:{},setAttribute(k,v){this.attributes[k]=v},replaceChildren(){this.children=[]},append(x){this.children.push(x)}});
 const getElement=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};const timers=new Map();let timerId=0;let opened=null;
 const dom={el:getElement,make:element,matchMedia:()=>({matches:false,addEventListener(){}}),document:{hidden:false,activeElement:null,listeners:{},addEventListener(type,callback){this.listeners[type]=callback}},window:{listeners:{},addEventListener(type,callback){this.listeners[type]=callback}},Math,setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id},clearTimeout:id=>timers.delete(id),location:{hash:''},openDetail:d=>{opened=d}};
 const ui=vm.createContext(dom);const uiStart=app.indexOf('let featuredItems='),uiEnd=app.indexOf('async function loadFeatured(',uiStart);vm.runInContext(app.slice(uiStart,uiEnd),ui);
 vm.runInContext("featuredItems=[{id:'one',title:'First',image:'https://example.com/a.jpg'},{id:'two',title:'Second'}];buildFeaturedDots();drawFeatured()",ui);assert.equal(getElement('featured-title').textContent,'First');assert.equal([...timers.values()][0].delay,6000);const tick=[...timers.values()][0].callback;timers.clear();tick();assert.equal(getElement('featured-title').textContent,'Second');
 vm.runInContext('moveFeatured(1)',ui);assert.equal(getElement('featured-title').textContent,'First');
 vm.runInContext('featuredPaused=true;scheduleFeatured()',ui);assert.equal(timers.size,0);
 vm.runInContext('featuredPaused=false;reducedMotion.matches=true;drawFeatured()',ui);assert.equal(timers.size,0);assert.equal(getElement('featured-pause').hidden,true);
 vm.runInContext('reducedMotion.matches=false;document.hidden=true;scheduleFeatured()',ui);assert.equal(timers.size,0);
 vm.runInContext("document.hidden=false;el('detail').open=true;scheduleFeatured()",ui);assert.equal(timers.size,0);
 const routeStart=app.indexOf('function route(){'),routeEnd=app.indexOf("window.addEventListener('hashchange'",routeStart);vm.runInContext('let dramas=[];'+app.slice(routeStart,routeEnd),ui);dom.location.hash='#drama-two';vm.runInContext('route()',ui);assert.equal(opened.id,'two');

 const eventStart=app.indexOf("el('featured-prev').onclick"),eventEnd=app.indexOf('\nload();loadFeatured();',eventStart);vm.runInContext(app.slice(eventStart,eventEnd),ui);
 vm.runInContext("el('detail').open=false;document.hidden=false;reducedMotion.matches=false;featuredPaused=false;featuredFocus=false;scheduleFeatured()",ui);
 const originalDots=[...getElement('featured-dots').children];dom.document.activeElement=getElement('featured-next');
 dom.document.listeners.pointerdown({pointerType:'touch',target:getElement('featured-next')});getElement('featured-shell').listeners.pointerenter({pointerType:'touch'});getElement('featured-shell').listeners.focusin();dom.window.listeners.pointerup({pointerType:'touch',pointerId:1});getElement('featured-next').onclick();assert.equal(timers.size,1,'Touch tap must restart autoplay');assert.equal(getElement('featured-dots').children[0],originalDots[0],'Indicators must retain DOM identity');
 dom.document.listeners.keydown({key:'Tab'});getElement('featured-shell').listeners.focusin();assert.equal(timers.size,0,'Keyboard focus must pause autoplay');
 getElement('featured-pause').onclick();assert.equal(timers.size,0);getElement('featured-pause').onclick();assert.equal(timers.size,1,'Explicit resume must clear stale interaction pause');
 vm.runInContext('featuredCanHover.matches=true',ui);getElement('featured-shell').listeners.pointerenter({pointerType:'mouse'});assert.equal(timers.size,0);getElement('featured-shell').listeners.pointerleave({pointerType:'mouse'});assert.equal(timers.size,1);
 dom.document.listeners.pointerdown({pointerType:'touch',target:getElement('featured-banner')});getElement('featured-banner').listeners.pointerdown({pointerType:'touch',target:getElement('featured-banner'),pointerId:8,clientX:150,clientY:100});assert.equal(timers.size,0);dom.window.listeners.pointerup({pointerId:8,clientX:50,clientY:100});assert.equal(timers.size,1,'Swipe must restart timer');
 console.log('PASS: touch does not stick hover/focus, keyboard pause, explicit resume, real-mouse hover, swipe resumes, stable indicator nodes');
 console.log('PASS: six-second autoplay, manual wraparound, pause, reduced motion, hidden tab/detail pause, featured detail outside filtered catalog');
 console.log('PASS: alternating popular lists, title deduplication, cap 10, sidebar isolation, single/both source failures, shuffle preserves input');
}finally{await mf.dispose()}
