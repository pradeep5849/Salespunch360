"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import {AccountIcon,type AccountIconName} from "./account-icons";

type Item={id:string;type:"PRODUCT"|"SERVICE";name:string;code:string|null;categoryId:string|null;category:string|null;salePrice:string;purchasePrice:string;stock:number|null};
type Category={id:string;name:string};
const links:{label:string;href:string;icon:AccountIconName;settings?:boolean}[]=[{label:"Online Store",href:"/workspace/account/inventory/online-store",icon:"store"},{label:"Stock Summary",href:"/workspace/account/inventory/stock-summary",icon:"stock"},{label:"Item Settings",href:"/workspace/account/inventory/item-settings",icon:"settings",settings:true},{label:"Show All",href:"/workspace/account/inventory/items",icon:"grid"}];
const currency=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2});
export function ItemsScreen({items,categories,canConfigure,quantityDecimals}:{items:Item[];categories:Category[];canConfigure:boolean;quantityDecimals:number}){
 const[q,setQ]=useState(""),[filterOpen,setFilterOpen]=useState(false),[moreOpen,setMoreOpen]=useState(false),[types,setTypes]=useState<Set<string>>(new Set()),[cats,setCats]=useState<Set<string>>(new Set()),[draftTypes,setDraftTypes]=useState<Set<string>>(new Set()),[draftCats,setDraftCats]=useState<Set<string>>(new Set());
 const visible=useMemo(()=>items.filter(i=>{
   const search=`${i.name} ${i.code??""}`.toLowerCase().includes(q.toLowerCase());
   const typeOk=!types.size||types.has(i.type);
   const catOk=!cats.size||(i.categoryId&&cats.has(i.categoryId));
   return search&&typeOk&&catOk;
 }),[items,q,types,cats]);
 const openFilter=()=>{setDraftTypes(new Set(types));setDraftCats(new Set(cats));setFilterOpen(true)};
 const toggle=(set:Set<string>,value:string)=>{const next=new Set(set);next.has(value)?next.delete(value):next.add(value);return next};
 const share=async(item:Item)=>{const text=`${item.name}${item.code?` (${item.code})`:""} · ${currency.format(Number(item.salePrice))}`;if(navigator.share)await navigator.share({title:item.name,text});else await navigator.clipboard.writeText(text)};
 return <div className="account-items-screen">
  <header className="account-page-header"><div><h1>Items</h1><p>Products, services and live inventory</p></div></header>
  <section className="account-card account-quick-card"><h2>Quick Links</h2><div>{links.filter(x=>!x.settings||canConfigure).map(x=><Link href={x.href} key={x.label}><span><AccountIcon name={x.icon}/></span>{x.label}</Link>)}</div></section>
  <div className="items-search-row">
   <div className="items-search-box"><AccountIcon name="search"/><input aria-label="Search items" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search for an item or code"/><span/><button type="button" onClick={openFilter} aria-label="Filter items">⌄</button></div>
   <button type="button" className="items-more-button" onClick={()=>setMoreOpen(true)} aria-label="More item options">⋮</button>
  </div>
  <section className="account-item-list">{visible.length?visible.map(item=><article className="account-item-card" key={item.id}><div><h2>{item.name}</h2>{item.category&&<span className="account-category">{item.category}</span>}<small>{item.code||"No item code"}</small></div><button onClick={()=>void share(item)} aria-label={`Share ${item.name}`}><AccountIcon name="share"/></button><dl><div><dt>Sale price</dt><dd>{currency.format(Number(item.salePrice))}</dd></div><div><dt>Purchase price</dt><dd>{currency.format(Number(item.purchasePrice))}</dd></div><div><dt>{item.type==="PRODUCT"?"In Stock":"Type"}</dt><dd className={item.stock!==null&&item.stock<0?"negative":undefined}>{item.stock===null?"Service":item.stock.toFixed(quantityDecimals)}</dd></div></dl></article>):<div className="account-home-empty"><strong>No items found</strong><p>Try another item name, code or category.</p></div>}</section>
  <Link className="account-floating-action" href="/workspace/account/inventory/items/new">＋ Add New Item</Link>

  {filterOpen&&<div className="sale-more-sheet"><section className="items-filter-sheet"><header><h2>Filter By</h2><button onClick={()=>setFilterOpen(false)} aria-label="Close">×</button></header><div className="items-filter-list">
   {[["PRODUCT","Products"],["SERVICE","Services"]].map(([value,label])=><label key={value}><span>{label}</span><input type="checkbox" checked={draftTypes.has(value)} onChange={()=>setDraftTypes(toggle(draftTypes,value))}/></label>)}
   <h3>Categories</h3>{categories.map(cat=><label key={cat.id}><span>{cat.name}</span><input type="checkbox" checked={draftCats.has(cat.id)} onChange={()=>setDraftCats(toggle(draftCats,cat.id))}/></label>)}
  </div><footer><button onClick={()=>{setDraftTypes(new Set());setDraftCats(new Set())}}>Clear</button><button onClick={()=>{setTypes(new Set(draftTypes));setCats(new Set(draftCats));setFilterOpen(false)}}>Apply</button></footer></section></div>}

  {moreOpen&&<div className="sale-more-sheet"><section><header><h2>More Options</h2><button onClick={()=>setMoreOpen(false)} aria-label="Close">×</button></header>
   <Link className="sale-more-row" href="/workspace/account/inventory/active?mode=activate" onClick={()=>setMoreOpen(false)}>Mark Items Active <b>›</b></Link>
   <Link className="sale-more-row" href="/workspace/account/inventory/active?mode=deactivate" onClick={()=>setMoreOpen(false)}>Mark Items Inactive <b>›</b></Link>
   <Link className="sale-more-row" href="/workspace/account/inventory/units" onClick={()=>setMoreOpen(false)}>Units <b>›</b></Link>
   <Link className="sale-more-row" href="/workspace/account/inventory/categories" onClick={()=>setMoreOpen(false)}>Categories <b>›</b></Link>
  </section></div>}
 </div>
}
