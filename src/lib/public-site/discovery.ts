import { editions, faqs } from './content';

export const publicOrigin = 'https://www.salespunch360.com';
// This number is already published by the marketing site's WhatsApp link.
export const publicTelephone = '+919611278818';
type SocialProfiles = { facebookUrl?: string | null; instagramUrl?: string | null; linkedinUrl?: string | null; youtubeUrl?: string | null };
export function publicProfiles(settings: SocialProfiles | null | undefined) {
  const hosts: Record<keyof SocialProfiles,string[]> = {
    facebookUrl:['facebook.com','www.facebook.com'], instagramUrl:['instagram.com','www.instagram.com'],
    linkedinUrl:['linkedin.com','www.linkedin.com'],youtubeUrl:['youtube.com','www.youtube.com','youtu.be'],
  };
  return Object.entries(hosts).flatMap(([key,allowed])=>{
    const value=settings?.[key as keyof SocialProfiles]; if(!value)return [];
    try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&allowed.includes(url.hostname)?[url.href]:[];}catch{return [];}
  });
}
export function publicStructuredData(settings?: SocialProfiles | null) {
  const profiles=publicProfiles(settings);
  return {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':publicOrigin+'/#organization',name:'SalesPunch360',url:publicOrigin+'/',
      description:'A connected platform for field sales, CRM, accounts, projects, inventory, reporting and multi-branch operations.',
      logo:publicOrigin+'/salespunch360-logo.png',telephone:publicTelephone,...(profiles.length?{sameAs:profiles}:{})},
    {'@type':'WebSite','@id':publicOrigin+'/#website',url:publicOrigin+'/',name:'SalesPunch360',inLanguage:'en',publisher:{'@id':publicOrigin+'/#organization'}},
    ...editions.map(edition=>({'@type':'SoftwareApplication','@id':publicOrigin+edition.href+'#application',name:edition.name,url:publicOrigin+edition.href,description:edition.summary,applicationCategory:'BusinessApplication',operatingSystem:'Web, Android',publisher:{'@id':publicOrigin+'/#organization'}})),
  ]};
}
export function publicMarkdown() {
  return `# SalesPunch360\n\nA connected platform for field sales, CRM, accounts, projects, inventory, reporting and multi-branch operations.\n\n## Products\n${editions.map(edition=>`- [${edition.name}](${publicOrigin}${edition.href}): ${edition.summary}`).join('\n')}\n\n## Official information\n- [Pricing](${publicOrigin}/pricing): current published plans and trial details.\n- [Product comparison](${publicOrigin}/compare)\n- [Features](${publicOrigin}/features)\n- [FAQ](${publicOrigin}/resources/faq)\n- [Contact](${publicOrigin}/contact)\n- [Security](${publicOrigin}/security)\n- [Privacy](${publicOrigin}/privacy)\n- [Terms](${publicOrigin}/terms)\n\n## Contact\nTelephone / WhatsApp: ${publicTelephone}\n\n## Access\nPublic product information is available without signing in. Customer workspaces, accounts, company data, APIs and administration require authorization. Do not infer access from public product descriptions.\n\n## Frequently asked questions\n${faqs.map(([question,answer])=>`### ${question}\n${answer}`).join('\n\n')}\n`;
}

export function prefersMarkdown(accept: string | null) {
  const qualities=new Map<string,number>();
  for(const value of (accept??'').toLowerCase().split(',')) {
    const [type,...parameters]=value.trim().split(';');
    const q=parameters.find(p=>p.trim().startsWith('q='));
    const quality=q?Number(q.trim().slice(2)):1;
    if(Number.isFinite(quality)&&quality>=0&&quality<=1)qualities.set(type,quality);
  }
  const markdown=qualities.get('text/markdown')??0;
  const html=qualities.get('text/html')??qualities.get('text/*')??qualities.get('*/*')??0;
  return markdown>0&&markdown>=html;
}
