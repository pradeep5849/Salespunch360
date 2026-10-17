"use client";
import {createContext,useContext,useState,type ReactNode} from "react";
const ChequeSuccess=createContext<(message:string)=>void>(()=>{});
export function useChequeSuccess(){return useContext(ChequeSuccess)}
/** Keep completion feedback mounted when a successful transition removes its filtered row. */
export function ChequeFeedbackProvider({children}:{children:ReactNode}){
 const [message,setMessage]=useState("");
 return <ChequeSuccess.Provider value={setMessage}>{message&&<div role="status" aria-label="Cheque notification" className="account-save-feedback success" style={{position:"fixed",bottom:"1rem",right:"1rem",maxWidth:"calc(100vw - 2rem)",zIndex:40,padding:"0.75rem",background:"#dcfce7",color:"#14532d",border:"1px solid #15803d",borderRadius:"0.5rem"}}>{message}<button type="button" aria-label="Dismiss cheque notification" onClick={()=>setMessage("")}>×</button></div>}{children}</ChequeSuccess.Provider>
}
