import { describe,it,expect } from 'vitest';
import { publicTools,executePublicTool } from './agent-tools';
import { publicStructuredData } from './discovery';
describe('public agent tools',()=>{
  it('publishes the verified address',()=>{expect(publicStructuredData()['@graph'][0]).toMatchObject({address:{postalCode:'573213',addressCountry:'IN'}});});
  it('exposes only read-only public tools',()=>{for(const tool of publicTools){expect(tool.annotations.readOnlyHint).toBe(true);expect(executePublicTool(tool.name).content[0].text).toBeTruthy();}});
  it('rejects unknown tools and unexpected arguments',()=>{expect(()=>executePublicTool('delete_customer')).toThrow();expect(()=>executePublicTool(publicTools[0].name,{customerId:'1'})).toThrow();});
});
