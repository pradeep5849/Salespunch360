'use client';
import {createContext,useContext} from 'react';
const Context=createContext({enabled:true,canAdd:false});
export function BranchPresentationProvider({enabled,canAdd,children}:{enabled:boolean;canAdd:boolean;children:React.ReactNode}){
 return <Context.Provider value={{enabled,canAdd}}><div data-company-branch-ui={enabled?'multiple':'single'} style={{display:'contents'}}>{children}</div></Context.Provider>;
}
export function useBranchPresentation(){return useContext(Context)}
export function BranchOnly({children}:{children:React.ReactNode}){return useBranchPresentation().enabled?<>{children}</>:null}
export function BranchText({multiple,single}:{multiple:React.ReactNode;single?:React.ReactNode}){return <>{useBranchPresentation().enabled?multiple:single}</>}
