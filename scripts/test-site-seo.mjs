import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout} from 'node:timers/promises';
import {SITE_URL,PUBLIC_SEO_PAGES} from '../lib/site-seo.ts';
const base='http://127.0.0.1:3103';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3103'],{env:process.env,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
async function get(path){const r=await fetch(base+path,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200,path);return r;}
function meta(html,name){return [...html.matchAll(/<meta\s[^>]*>/g)].filter(m=>new RegExp(`(?:name|property)="${name}"`).test(m[0])).map(m=>m[0].match(/content="([^"]*)"/)?.[1]);}
try{
 let ready=false;
 for(let i=0;i<45;i++){try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await setTimeout(500);}
 assert.ok(ready,'Servidor indisponível: '+output.slice(-2000));
 let home='';
 for(const page of PUBLIC_SEO_PAGES){
  const html=await (await get(page.path)).text();
  const canonical=[...html.matchAll(/<link\s[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m=>new URL(m[1]).href);
  assert.deepEqual(canonical,[new URL(page.path,SITE_URL).href],page.path+' canonical duplicado/incorreto');
  assert.equal((html.match(/<title>/g)??[]).length,1,page.path+' título duplicado');
  assert.deepEqual(meta(html,'description'),[page.description],page.path+' descrição');
  assert.deepEqual(meta(html,'og:url').map(value=>new URL(value).href),canonical,page.path+' URL de compartilhamento');
  assert.equal(meta(html,'robots').length,1);
  assert.match(meta(html,'robots')[0],/^index, follow$/);
  assert.equal(meta(html,'og:image').length,1,page.path+' imagem social ausente');
  assert.equal(meta(html,'twitter:image').length,1,page.path+' imagem Twitter ausente');
  if(page.path==='/')home=html;
 }
 assert.match(home,/<h1[^>]*>Descubra se seus bancos/,'Apresentação pública ausente do HTML inicial');
 for(const path of ['/login','/recuperar-senha','/privacidade']){
  const html=await (await get(path)).text();assert.match(meta(html,'robots')[0],/noindex/,'Área sem noindex: '+path);
  assert.equal((html.match(/rel="canonical"/g)??[]).length,0,'Área interna herdou canonical da home');
 }
 const robots=await (await get('/robots.txt')).text();assert.ok(robots.includes('Sitemap: '+SITE_URL+'/sitemap.xml'));assert.ok(robots.includes('Disallow: /api/'));
 const sitemap=await (await get('/sitemap.xml')).text();
 assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]).sort(),PUBLIC_SEO_PAGES.map(p=>new URL(p.path,SITE_URL).href).sort());
 const image=new URL(meta(home,'og:image')[0].replaceAll('&amp;','&'));
 assert.equal(image.origin,SITE_URL);
 const response=await get(image.pathname+image.search);assert.match(response.headers.get('content-type'),/image\/png/);
 const png=Buffer.from(await response.arrayBuffer());assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
 await mkdir('artifacts/seo',{recursive:true});await writeFile('artifacts/seo/compartilhamento.png',png);
 console.log('SEO validado: 8 páginas públicas, canonicals únicos, conteúdo inicial, noindex, sitemap, robots e imagem PNG 1200×630.');
}finally{server.kill('SIGTERM');}
