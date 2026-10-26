import type {MetadataRoute} from 'next';
import {SITE_URL,indexableEnvironment} from '@/lib/site-seo';

export default function robots():MetadataRoute.Robots {
 if(!indexableEnvironment())return {rules:{userAgent:'*',disallow:'/'}};
 // Let crawlers read noindex on non-public pages. APIs have no search content.
 return {rules:{userAgent:'*',allow:'/',disallow:'/api/'},sitemap:`${SITE_URL}/sitemap.xml`,host:SITE_URL};
}
