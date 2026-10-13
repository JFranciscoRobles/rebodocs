import type { MetadataRoute } from 'next';
import { PAGES, SITE, hrefOf } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE}/` }, ...PAGES.map((page) => ({ url: `${SITE}${hrefOf(page.slug)}` }))];
}
