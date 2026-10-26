import type {MetadataRoute} from 'next';
import {SITE_URL,PUBLIC_SEO_PAGES,indexableEnvironment} from '@/lib/site-seo';

export default function sitemap():MetadataRoute.Sitemap {
 if(!indexableEnvironment())return [];
 return PUBLIC_SEO_PAGES.map(page=>({url:new URL(page.path,SITE_URL).href}));
}
