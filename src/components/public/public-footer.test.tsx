import { describe,it,expect,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('next/server',()=>({connection:vi.fn(async()=>undefined)}));
vi.mock('@/lib/public-site/settings',()=>({publicSiteSettings:vi.fn(async()=>({facebookUrl:'https://www.facebook.com/salespunch360',instagramUrl:null,linkedinUrl:null,youtubeUrl:null,googlePlayUrl:null}))}));
import { PublicFooter } from './public-footer';

describe('public footer discovery',()=>{
  it('renders parseable structured data and the published contact without prioritizing a footer image',async()=>{
    const html=renderToStaticMarkup(await PublicFooter());
    const block=html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(block).not.toBeNull();
    const data=JSON.parse(block![1]);
    expect(data['@graph'].find((node:{'@type':string})=>node['@type']==='Organization')).toMatchObject({name:'SalesPunch360',sameAs:['https://www.facebook.com/salespunch360']});
    expect(html).toContain('href="tel:+919611278818"');
    expect(html).not.toContain('fetchPriority="high"');
  });
});
