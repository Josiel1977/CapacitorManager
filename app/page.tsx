import HomePageContent from '@/components/HomePageContent';
import {publicPageMetadata} from '@/lib/site-seo';

export const metadata=publicPageMetadata('/');

export default function HomePage(){
 return <HomePageContent/>;
}
