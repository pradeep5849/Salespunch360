import { editions, features, faqs } from './content';
import { publicAddress, publicOrigin, publicTelephone } from './discovery';

export const publicTools = [
  {name:'get_business_information',description:'Get official SalesPunch360 business address and contact details.'},
  {name:'get_product_information',description:'Get published product editions, features and frequently asked questions.'},
  {name:'get_pricing_and_registration',description:'Get official links for current pricing and registration guidance.'},
].map(tool=>({...tool,inputSchema:{type:'object' as const,properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}));

export function executePublicTool(name:string,args:unknown={}) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) throw new Error('Expected empty arguments');
  let data:unknown;
  switch(name){
    case 'get_business_information': data={name:'SalesPunch360',website:publicOrigin,address:publicAddress,telephone:publicTelephone,contact:publicOrigin+'/contact'};break;
    case 'get_product_information': data={editions,features,faqs,platforms:['Web','Android']};break;
    case 'get_pricing_and_registration': data={pricing:publicOrigin+'/pricing',registration:publicOrigin+'/register',contact:publicOrigin+'/contact',note:'Refer to the current published pricing and registration pages for availability.'};break;
    default: throw new Error('Unknown tool');
  }
  return {content:[{type:'text' as const,text:JSON.stringify(data)}]};
}
