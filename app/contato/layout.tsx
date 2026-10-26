import type {ReactNode} from 'react';
import {publicPageMetadata} from '@/lib/site-seo';

export const metadata=publicPageMetadata('/contato');

export default function PublicPageLayout({children}:{children:ReactNode}){
 return children;
}
