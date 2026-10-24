import {z} from "zod";
export const QUOTATION_THEMES=[
 {id:"GST_1",name:"GST Classic",grid:false,header:"left",ack:true,expanded:false,taxable:false},
 {id:"GST_2",name:"GST Compact",grid:true,header:"right",ack:false,expanded:false,taxable:true},
 {id:"GST_3",name:"GST Ledger",grid:true,header:"split",ack:false,expanded:true,taxable:false},
 {id:"GST_4",name:"GST Detailed",grid:true,header:"right",ack:false,expanded:true,taxable:false},
 {id:"GST_5",name:"GST Summary",grid:true,header:"right",ack:false,expanded:true,taxable:false},
 {id:"GST_6",name:"GST Taxable",grid:true,header:"right",ack:false,expanded:true,taxable:true},
 {id:"LANDSCAPE_1",name:"Landscape Classic",grid:true,header:"split",ack:true,expanded:false,taxable:true},
 {id:"LANDSCAPE_2",name:"Landscape Detailed",grid:true,header:"split",ack:true,expanded:false,taxable:false},
 {id:"SIMPLE_1",name:"Essential Accent",grid:false,header:"right",ack:true,expanded:false,taxable:false},
 {id:"SIMPLE_2",name:"Essential Clean",grid:false,header:"right",ack:true,expanded:false,taxable:false},
 {id:"SIMPLE_3",name:"Essential Banner",grid:true,header:"banner",ack:true,expanded:false,taxable:false},
 {id:"SIMPLE_4",name:"Essential Classic",grid:false,header:"left",ack:true,expanded:false,taxable:false},
 {id:"DOUBLE_DIVINE",name:"Dual Accent",grid:true,header:"dual",ack:true,expanded:false,taxable:false},
 {id:"TALLY",name:"Ledger Classic",grid:true,header:"left",ack:true,expanded:false,taxable:true},
 {id:"FRENCH_ELITE",name:"French Elite",grid:true,header:"french",ack:true,expanded:false,taxable:false},
] as const;
export const QUOTATION_THEME_COLORS=["#998BDF","#087FA0","#A2A2A2","#747676","#999B68","#5085E8","#00B4D4"] as const;
export const quotationThemeSchema=z.object({theme:z.enum(QUOTATION_THEMES.map(t=>t.id) as [string,...string[]]),color:z.string().regex(/^#[0-9a-f]{6}$/i).transform(v=>v.toUpperCase())}).strict();
export function quotationThemeProfile(id:string){return QUOTATION_THEMES.find(t=>t.id===id)}
