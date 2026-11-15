import {readFile,writeFile} from 'node:fs/promises';
const version='3.8.5',root='node_modules/plyr/dist/';const assets={};
for(const [file,type]of [['plyr.min.js','application/javascript; charset=utf-8'],['plyr.css','text/css; charset=utf-8'],['plyr.svg','image/svg+xml']]){let body=await readFile(root+file,'utf8');body=body.replace(/\/\/# sourceMappingURL=.*$/gm,'');assets['/assets/plyr/'+version+'/'+file]={type,body};}
await writeFile('player-assets.js','// Generated from pinned plyr@'+version+' by scripts/prepare-player.mjs.\nexport default '+JSON.stringify(assets)+';\n');
