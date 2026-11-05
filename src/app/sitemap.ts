import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { db } from '@/lib/db';
import { features } from '@/lib/public-site/content';
import { publicOrigin } from '@/lib/public-site/discovery';
import modifiedDates from '@/lib/public-site/modified-dates.json';

const routes=['','/products','/products/salespunch360','/products/account','/products/plus','/features','/pricing','/compare','/apps','/android','/demo','/contact','/resources','/resources/faq','/industries','/help','/user-guide','/video-tutorials','/careers','/blog','/security','/about','/privacy','/terms'];
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Published blog records and their real update times belong to the runtime database.
  await connection();
  const posts=await db.publicBlogPost.findMany({where:{isPublished:true,publishedAt:{lte:new Date()}},select:{slug:true,updatedAt:true}});
  const dates=modifiedDates as Record<string,string>;
  const entries: MetadataRoute.Sitemap=[...routes,...features.map(feature=>`/features/${feature.slug}`)].map(route=>({
    url:publicOrigin+route,lastModified:dates[route],changeFrequency:route===''?'weekly':'monthly',priority:route===''?1:route.startsWith('/products')?0.8:0.7,
  }));
  const blogIndex=entries.find(entry=>entry.url===publicOrigin+'/blog');
  const latestPost=posts.reduce<Date | null>((latest,post)=>!latest||post.updatedAt>latest?post.updatedAt:latest,null);
  if(blogIndex&&latestPost&&latestPost>new Date(blogIndex.lastModified!))blogIndex.lastModified=latestPost;
  return [...entries,...posts.map(post=>({url:`${publicOrigin}/blog/${encodeURIComponent(post.slug)}`,lastModified:post.updatedAt,changeFrequency:'monthly' as const,priority:0.6}))];
}
