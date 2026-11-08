import concurrent.futures,subprocess,re,json,time,hashlib
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin,urlparse
ROOT=Path(__file__).resolve().parents[1]; CACHE=ROOT.parent/'import-cache';CACHE.mkdir(exist_ok=True)
SOURCES={'dramaid':'https://dramaid.nimegami.id','dramaqu':'https://dramaqu.pro'}
ALIASES={'romance':'Romansa','romantis':'Romansa','percintaan':'Romansa','comedy':'Komedi','komedi':'Komedi','mystery':'Misteri','misteri':'Misteri','medical':'Medis','fantasy':'Fantasi','action':'Aksi','historical':'Sejarah','life':'Kehidupan','drama':'Drama','thriller':'Thriller'}
COUNTRIES={'korea':'Korea Selatan','south korea':'Korea Selatan','korea selatan':'Korea Selatan','japan':'Jepang','jepang':'Jepang','china':'China'}
def normal(v):return ' '.join(v.split()).strip()
def genre(v):return ALIASES.get(v.lower(),v)
def fetch(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if p.exists() and p.stat().st_mtime>time.time()-3600:return p.read_text()
 r=subprocess.run(['curl','-fLsS','--max-time','30',url],capture_output=True,text=True)
 if r.returncode:raise RuntimeError(url+' '+r.stderr[:180])
 p.write_text(r.stdout);return r.stdout
class Parser(HTMLParser):
 def __init__(self,base):super().__init__(convert_charrefs=True);self.base=base;self.stack=[];self.cards=[];self.card=None;self.card_depth=0;self.genres=[];self.countries=[];self.meta=[];self.collect=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);classes=set(a.get('class','').split());parents=set().union(*(x[1] for x in self.stack)) if self.stack else set();self.stack.append((tag,classes));depth=len(self.stack)
  if classes&{'drama-card','dqu-kartu'} and not self.card:self.card={'url':'','title':'','image':'','text':'','metadata':''};self.card_depth=depth
  if self.card:
   if tag=='a' and not self.card['url']:self.card['url']=urljoin(self.base,a.get('href',''))
   if tag=='img' and not self.card['image']:self.card['image']=urljoin(self.base,a.get('src',''));self.card['title']=re.sub(r'^Poster\s+','',a.get('alt','')).strip()
   if 'dqu-meta' in classes or (tag=='p' and 'card-info' in parents and 'card-availability' not in classes):self.collect.append((depth,'cardmeta',[]))
  if tag=='a':
   path=urlparse(urljoin(self.base,a.get('href',''))).path
   if '/genre/' in path and parents&{'genre-tags','dqu-chips-kcl'}:self.collect.append((depth,'genre',[]))
   if ('/country/' in path and 'breadcrumbs' in parents) or ('/negara/' in path and 'dqu-info' in parents):self.collect.append((depth,'country',[]))
  if 'detail-meta' in classes:self.collect.append((depth,'format',[]))
  if tag in ['i','span'] and 'detail-meta' in parents:
   for _,kind,parts in self.collect:
    if kind=='format':parts.append(' ')
  if tag in ['img','input','meta','link','br','hr','source','area','base','embed','wbr']:self.handle_endtag(tag)
 def handle_endtag(self,tag):
  i=next((i for i in range(len(self.stack)-1,-1,-1) if self.stack[i][0]==tag),None)
  if i is None:return
  depth=i+1
  for d,kind,parts in list(self.collect):
   if d>=depth:
    value=normal(''.join(parts))
    if kind=='cardmeta' and self.card:self.card['metadata']+=value
    elif kind=='genre' and value:self.genres.append(genre(value))
    elif kind=='country' and value:self.countries.append(COUNTRIES.get(value.lower(),value))
    elif kind=='format':self.meta.append(value)
    self.collect.remove((d,kind,parts))
  if self.card and self.card_depth>=depth:self.cards.append(self.card);self.card=None
  self.stack=self.stack[:i]
 def handle_data(self,data):
  if self.card:self.card['text']+=data
  for _,_,parts in self.collect:parts.append(data)
def page(source,n):
 base=SOURCES[source];url=base+('/' if n==1 else '/?page='+str(n)) if source=='dramaid' else base+('/series/' if n==1 else '/series/page/'+str(n)+'/')
 s=fetch(url);p=Parser(base);p.feed(s);return p.cards,set(map(int,re.findall(r'(?:[?&]page=|/page/)(\d+)',s)))
all_items=[];stats={};failures=[]
for source in SOURCES:
 done=set();scheduled={1};pending={};cards=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  pending[pool.submit(page,source,1)]=1
  while pending:
   ready,_=concurrent.futures.wait(pending,return_when=concurrent.futures.FIRST_COMPLETED)
   for f in ready:
    n=pending.pop(f)
    try:
     rows,pages=f.result();done.add(n);cards.extend((n,k,x) for k,x in enumerate(rows))
     for number in sorted(pages):
      if number>10000:raise RuntimeError('Unexpected page number')
      if number not in scheduled:scheduled.add(number);pending[pool.submit(page,source,number)]=number
     if len(done)%20==0:print(source,'pages',len(done),'discovered',len(scheduled),'cards',len(cards),flush=True)
    except Exception as error:failures.append(str(error));print('PAGE ERROR',error,flush=True)
 seen=set()
 for n,k,c in sorted(cards):
  path=urlparse(c['url']).path
  if not c['image'] or not c['title'] or not (re.fullmatch('/drama/[a-z0-9-]+/?',path) if source=='dramaid' else re.fullmatch('/[a-z0-9-]+/',path)):continue
  if c['url'] in seen:continue
  seen.add(c['url']);parts=[normal(x) for x in c['metadata'].split('·' if source=='dramaid' else ',') if normal(x)];gs=parts[2:] if source=='dramaid' else parts[:-1];country=(parts[0] if source=='dramaid' else parts[-1]) if parts else '';match=re.search(r'(\d+)\s*(?:episode|eps)\b',c['text'],re.I) or re.search(r'\bEP\s*(\d+)',c['text'],re.I)
  all_items.append({'id':source+'-'+path.strip('/').split('/')[-1],'title':c['title'],'url':c['url'],'image':c['image'],'source':source,'episodeCount':int(match[1]) if match else None,'genres':list(dict.fromkeys(genre(g) for g in gs)),'country':COUNTRIES.get(country.lower(),country),'format':'Series','year':(re.search(r'\b(?:19|20)\d{2}\b',c['text']) or [''])[0]})
 stats[source]={'pages':len(done),'titles':len(seen)};print('CATALOG COMPLETE',source,stats[source],flush=True)
if failures:raise RuntimeError('Incomplete pagination; retry import: '+str(failures[:5]))
print('ENRICHING',len(all_items),'titles',flush=True)
def enrich(item):
 try:
  p=Parser(SOURCES[item['source']]);content=fetch(item['url']);content=content.split('<section class="related-section"',1)[0] if item['source']=='dramaid' else content.split('<section class="dqu-sek"',1)[0];p.feed(content)
  if p.genres:item['genres']=list(dict.fromkeys(p.genres))
  if p.countries:item['country']=', '.join(dict.fromkeys(p.countries))
  if any(re.search(r'\b(?:Movie|Film)\b',v,re.I) for v in p.meta):item['format']='Film'
  return True
 except Exception as error:return str(error)
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
 for i,result in enumerate(pool.map(enrich,all_items),1):
  if result is not True:errors.append(result)
  if i%100==0:print('METADATA',i,'/',len(all_items),'failures',len(errors),flush=True)
archive={'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sources':stats,'metadataErrors':errors,'items':all_items}
(ROOT/'catalog.json').write_text(json.dumps(archive,ensure_ascii=False,separators=(',',':')))
print('SAVED',len(all_items),'titles',stats,'metadata failures',len(errors),'bytes',(ROOT/'catalog.json').stat().st_size,flush=True)
