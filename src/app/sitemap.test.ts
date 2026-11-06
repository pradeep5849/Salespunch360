import { describe,it,expect,vi } from 'vitest';
const findMany=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/db',()=>({db:{publicBlogPost:{findMany}}}));
vi.mock('next/server',()=>({connection:vi.fn(async()=>undefined)}));
import sitemap from './sitemap';
describe('public sitemap',()=>{
  it('covers the public pages and features with source dates and adds only published blog records',async()=>{
    findMany.mockResolvedValue([{slug:'field-sales-guide',updatedAt:new Date('2026-10-01T00:00:00Z')}]);
    const rows=await sitemap();
    expect(rows).toHaveLength(38);
    expect(new Set(rows.map(row=>row.url)).size).toBe(rows.length);
    for(const page of ['industries','help','user-guide','video-tutorials','careers','blog']) expect(rows.some(row=>row.url===`https://www.salespunch360.com/${page}`)).toBe(true);
    expect(rows.every(row=>row.lastModified&&Number.isFinite(new Date(row.lastModified).getTime()))).toBe(true);
    expect(rows.some(row=>/\/(workspace|admin|api)(\/|$)/.test(row.url))).toBe(false);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:{isPublished:true,publishedAt:{lte:expect.any(Date)}}}));
    expect(rows.at(-1)?.lastModified).toEqual(new Date('2026-10-01T00:00:00Z'));
  });
});
