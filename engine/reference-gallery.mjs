import http from 'node:http';
import path from 'node:path';
import {readFile,realpath} from 'node:fs/promises';
import {loadReferenceLibrary,searchReferences} from './references.mjs';

/** Read-only, loopback gallery. Only validated card evidence can be served. */
export async function startReferenceServer({libraryRoot,port=4179}={}) {
  const library=await loadReferenceLibrary({libraryRoot});
  const root=library.libraryRoot;
  const server=http.createServer(async(req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try{
      const hosts=new Set([`127.0.0.1:${server.address().port}`,`localhost:${server.address().port}`]);
      if(!hosts.has(req.headers.host))return json(403,{error:'Invalid host'});
      if(req.method!=='GET')return json(405,{error:'Read-only library'});
      const url=new URL(req.url,`http://${req.headers.host}`);
      if(url.pathname==='/'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
        return res.end(await readFile(new URL('./reference-gallery.html',import.meta.url)));
      }
      if(url.pathname==='/api/references'){
        const q=(url.searchParams.get('q')??'').trim();
        const result=q?await searchReferences({query:q,libraryRoot:root,limit:12}):await loadReferenceLibrary({libraryRoot:root});
        return json(200,{query:q,cards:result.results?.map(({card,fit})=>({...card,fit}))??result.cards,warnings:result.warnings??[]});
      }
      if(url.pathname==='/media'){
        const requested=url.searchParams.get('path');
        const current=await loadReferenceLibrary({libraryRoot:root});
        const allowed=new Set(current.cards.flatMap(c=>[c.contactSheet,...c.frames.map(f=>f.path)]));
        if(!allowed.has(requested))return json(404,{error:'Unknown reference image'});
        const file=await realpath(path.resolve(root,requested)),realRoot=await realpath(root);
        if(!file.startsWith(realRoot+path.sep))return json(403,{error:'Image escapes library'});
        res.writeHead(200,{'Content-Type':({'.png':'image/png','.webp':'image/webp'}[path.extname(file).toLowerCase()]??'image/jpeg'),'Cache-Control':'no-cache'});
        return res.end(await readFile(file));
      }
      return json(404,{error:'Not found'});
    }catch(error){json(500,{error:error.message});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,url:`http://127.0.0.1:${server.address().port}/`,libraryRoot:root};
}
