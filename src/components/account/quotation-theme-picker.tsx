"use client";
import {useState} from "react";
import Link from "next/link";
import {QUOTATION_THEMES,QUOTATION_THEME_COLORS} from "@/lib/quotations/theme-catalogue";
import type {QuotationPrintPresentation} from "@/lib/quotations/print-presentation";
import {saveQuotationThemeAction} from "@/app/actions/quotation-theme";
import {ActionFeedbackForm} from "./action-feedback-form";
import {SaveSubmitButton} from "./save-feedback";
import styles from "./quotation-theme-picker.module.css";
export function QuotationThemePicker({id,initial,canSave}:{id:string;initial?:QuotationPrintPresentation;canSave:boolean}){
 const [saving,setSaving]=useState(false);
 const [index,setIndex]=useState(Math.max(0,QUOTATION_THEMES.findIndex(t=>t.id===initial?.theme))),[color,setColor]=useState(initial?.color??(/^#[0-9a-f]{6}$/i.test(initial?.theme??"")?initial!.theme:QUOTATION_THEME_COLORS[0]));
 const theme=QUOTATION_THEMES[index],back=`/workspace/account/quotations/${id}/preview`,src=`/workspace/account/quotations/${id}/pdf?${new URLSearchParams({preview:"1",theme:theme.id,color})}`;
 return <section className={styles.root} aria-label="Transaction theme"><header><Link href={back} aria-label="Back to preview">←</Link><h1>Transaction Theme</h1></header><h2 aria-live="polite">{theme.name}</h2><label className={styles.select}>Theme<select disabled={saving} value={index} onChange={e=>setIndex(Number(e.target.value))}>{QUOTATION_THEMES.map((t,i)=><option key={t.id} value={i}>{t.name}</option>)}</select></label>{theme.id!=="TALLY"&&<div role="group" aria-label="Theme colours" className={styles.colors}>{QUOTATION_THEME_COLORS.map(c=><button key={c} disabled={saving} type="button" style={{backgroundColor:c}} aria-label={`Colour ${c}`} aria-pressed={color.toUpperCase()===c} onClick={()=>setColor(c)}/>)}</div>}<div className={styles.preview}><button type="button" disabled={saving} aria-label="Previous theme" onClick={()=>setIndex((index+QUOTATION_THEMES.length-1)%QUOTATION_THEMES.length)}>❮</button><iframe title={`${theme.name} quotation preview`} src={src}/><button type="button" disabled={saving} aria-label="Next theme" onClick={()=>setIndex((index+1)%QUOTATION_THEMES.length)}>❯</button></div><p>Preview changes are temporary until applied. Applies to this company’s quotation PDFs; document values and status stay unchanged.</p><ActionFeedbackForm action={async form=>{setSaving(true);try{return await saveQuotationThemeAction(form)}finally{setSaving(false)}}}><input type="hidden" name="id" value={id}/><input type="hidden" name="theme" value={theme.id}/><input type="hidden" name="color" value={color}/><footer><Link href={back} aria-disabled={saving} onClick={e=>{if(saving)e.preventDefault()}}>Cancel</Link>{canSave?<SaveSubmitButton>Apply Changes</SaveSubmitButton>:<p>Company theme changes require an administrator.</p>}</footer></ActionFeedbackForm></section>;
}
