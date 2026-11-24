'use client';
import { useEffect } from 'react';
import { publicTools, executePublicTool } from '@/lib/public-site/agent-tools';

type BrowserContext = {registerTool(tool:{name:string;description:string;inputSchema:object;execute:(args:unknown)=>Promise<unknown>}):void;unregisterTool?(name:string):void};
const registered = new WeakMap<BrowserContext,Set<string>>();
export function WebMcp(){
  useEffect(()=>{
    const context=(navigator as Navigator & {modelContext?:BrowserContext}).modelContext;
    if (!context?.registerTool) return;
    const names=registered.get(context)??new Set<string>();
    registered.set(context,names);
    for(const tool of publicTools){
      if(names.has(tool.name))continue;
      try {
        context.registerTool({name:tool.name,description:tool.description,inputSchema:tool.inputSchema,execute:async(args)=>executePublicTool(tool.name,args)});
        names.add(tool.name);
      } catch { /* Experimental browser API may be unavailable. */ }
    }
  },[]);
  return null;
}
