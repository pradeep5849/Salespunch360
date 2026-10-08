"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePostedSaleAction } from "@/app/actions/sale-amendments";
import styles from "./sale-detail.module.css";

export function SaleDetailActions({id,canChange}:{id:string;canChange:boolean}){
  const [deleting,setDeleting]=useState(false);
  return <footer className={styles.footer}>
    <form action={deletePostedSaleAction} onSubmit={event=>{
      if(!canChange||!confirm("Delete this saved Sale? SalesPunch will reverse it with a Credit Note so stock and accounts stay correct.")){event.preventDefault();return}
      setDeleting(true);
    }}>
      <input type="hidden" name="id" value={id}/>
      <button className={styles.delete} disabled={!canChange||deleting}>{deleting?"Deleting…":"Delete"}</button>
    </form>
    {canChange?<Link className={styles.edit} href={`/workspace/account/sales/${id}/edit`}>Edit</Link>:<span className={`${styles.edit} ${styles.disabled}`}>Edit</span>}
  </footer>;
}
