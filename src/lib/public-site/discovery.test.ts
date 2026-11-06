import { describe,it,expect } from 'vitest';
import { publicStructuredData,publicProfiles,publicMarkdown,prefersMarkdown } from './discovery';

describe('public discovery content',()=>{
  it('describes the published business and all three editions without inventing social profiles',()=>{
    const data=publicStructuredData();
    expect(data['@graph'].filter(node=>node['@type']==='SoftwareApplication')).toHaveLength(3);
    const organization=data['@graph'].find(node=>node['@type']==='Organization');
    expect(organization).toMatchObject({name:'SalesPunch360',telephone:'+919611278818',url:'https://www.salespunch360.com/'});
    expect(organization).not.toHaveProperty('sameAs');
  });
  it('uses only valid configured official social destinations',()=>{
    expect(publicProfiles({facebookUrl:'javascript:alert(1)',linkedinUrl:'https://www.linkedin.com/company/salespunch360',instagramUrl:'https://instagram.com.attacker.test/profile',youtubeUrl:'https://user:password@youtube.com/channel/test'})).toEqual(['https://www.linkedin.com/company/salespunch360']);
  });
  it('provides official descriptions, pricing/contact links and clear private-access boundaries',()=>{
    const markdown=publicMarkdown();
    expect(markdown).toContain('SalesPunch360 Account');
    expect(markdown).toContain('https://www.salespunch360.com/pricing');
    expect(markdown).toContain('require authorization');
    expect(markdown).not.toContain('AUTH_SECRET');
  });
});
describe('Markdown negotiation',()=>{
  it.each([null,'text/html','*/*','text/markdown;q=0','text/markdown;q=0.5,text/html;q=1'])('keeps normal HTML for %s',accept=>expect(prefersMarkdown(accept)).toBe(false));
  it.each(['text/markdown','text/markdown,text/html;q=0.5','text/markdown,*/*;q=0.5'])('supports an explicit Markdown preference for %s',accept=>expect(prefersMarkdown(accept)).toBe(true));
});

it('publishes actual newline-separated robots and Markdown text',async()=>{
  const {GET}=await import('../../app/robots.txt/route');
  const text=await GET().text();
  expect(text.split('\n')).toContain('Content-Signal: search=yes, ai-input=yes');
  expect(text.split('\n')).toContain('Disallow: /workspace/');
  expect(publicMarkdown()).toContain('\n\n## Products\n');
});
