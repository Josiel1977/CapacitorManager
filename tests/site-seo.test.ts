import test from 'node:test';
import assert from 'node:assert/strict';
import {indexableEnvironment,publicPageMetadata,PUBLIC_SEO_PAGES,SITE_URL} from '../lib/site-seo.ts';
import {isProtectedPath} from '../lib/route-protection.ts';

test('canonicals públicos são únicos no domínio verificado e não incluem áreas protegidas',()=>{
 const urls=PUBLIC_SEO_PAGES.map(p=>{
  assert.equal(isProtectedPath(p.path),false);
  const m=publicPageMetadata(p.path);
  assert.equal(m.alternates?.canonical,new URL(p.path,SITE_URL).href);
  assert.equal(m.openGraph?.url,m.alternates?.canonical);
  return m.alternates?.canonical;
 });
 assert.equal(new Set(urls).size,urls.length);
 assert.throws(()=>publicPageMetadata('/login'));
 assert.throws(()=>publicPageMetadata('/laudo/cliente'));
});
test('previews e ambientes de desenvolvimento Vercel não entram no índice',()=>{
 assert.equal(indexableEnvironment('preview'),false);
 assert.equal(indexableEnvironment('development'),false);
 assert.equal(indexableEnvironment('production'),true);
});
