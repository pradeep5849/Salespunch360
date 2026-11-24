import { publicTools, executePublicTool } from '@/lib/public-site/agent-tools';

const versions=['2025-11-25','2025-06-18','2025-03-26'];
export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin && origin!=='https://www.salespunch360.com')return new Response(null,{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response(null,{status:415});
  const reader=request.body?.getReader();
  if(!reader)return new Response(null,{status:400});
  let size=0;const decoder=new TextDecoder();let raw='';
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return new Response(null,{status:413});}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();
  const reply=(body:object)=>Response.json(body,{headers:{'Cache-Control':'no-store'}});
  let msg;
  try{msg=JSON.parse(raw);}catch{return reply({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
  const id=msg?.id??null;
  const error=(code:number,message:string)=>reply({jsonrpc:'2.0',id,error:{code,message}});
  if(!msg||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'||(id!==null&&typeof id!=='string'&&typeof id!=='number'))return error(-32600,'Invalid request');
  if(!Object.hasOwn(msg,'id'))return new Response(null,{status:202});
  const result=(value:unknown)=>reply({jsonrpc:'2.0',id,result:value});
  switch(msg.method){
    case 'initialize':return result({protocolVersion:versions.includes(msg.params?.protocolVersion)?msg.params.protocolVersion:versions[0],capabilities:{tools:{listChanged:false}},serverInfo:{name:'SalesPunch360',version:'1.0.0'}});
    case 'ping':return result({});
    case 'tools/list':return result({tools:publicTools});
    case 'tools/call':try{return result(executePublicTool(msg.params?.name,msg.params?.arguments));}catch{return error(-32602,'Invalid tool or arguments');}
    default:return error(-32601,'Method not found');
  }
}
export function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
