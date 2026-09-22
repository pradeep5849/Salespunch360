"use client";
import {useEffect,useState} from "react";
import {GoogleRouteMap} from "@/app/workspace/reports/google-route-map";

type Point={latitude:number;longitude:number};
type GeocoderResult={formatted_address?:string};
type GoogleWindow=Window&{google?:{maps?:{Geocoder?:new()=>{geocode:(request:{location:{lat:number;lng:number}},callback:(results:GeocoderResult[]|null,status:string)=>void)=>void}}}};
type ResolvedAddress={key:string;value:string};

export function LiveLocationAddress({point}:{point:Point|null}){
 const [resolved,setResolved]=useState<ResolvedAddress|null>(null);
 const latitude=point?.latitude;
 const longitude=point?.longitude;
 const pointKey=latitude==null||longitude==null?"":`${latitude},${longitude}`;
 const address=!point?"Address unavailable":resolved?.key===pointKey?resolved.value:"Finding address…";
 useEffect(()=>{
  if(latitude==null||longitude==null)return;
  let cancelled=false;
  const currentKey=`${latitude},${longitude}`;
  const finish=(value:string)=>{if(!cancelled)setResolved({key:currentKey,value})};
  const unavailable=()=>queueMicrotask(()=>finish("Address unavailable"));
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if(!key){unavailable();return()=>{cancelled=true}};
  const resolveAddress=()=>{
   const google=(window as GoogleWindow).google;
   const Geocoder=google?.maps?.Geocoder;
   if(!Geocoder){unavailable();return}
   new Geocoder().geocode({location:{lat:latitude,lng:longitude}},(results,status)=>{
    if(cancelled)return;
    const value=status==="OK"?results?.[0]?.formatted_address?.trim():undefined;
    finish(value||"Address unavailable");
   });
  };
  const google=(window as GoogleWindow).google;
  if(google?.maps?.Geocoder){resolveAddress();return()=>{cancelled=true}}
  let script=document.querySelector<HTMLScriptElement>("script[data-sp360-google-maps]");
  const onLoad=()=>resolveAddress();
  const onError=()=>unavailable();
  if(!script){
   script=document.createElement("script");
   script.dataset.sp360GoogleMaps="true";
   script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
   script.async=true;
   document.head.appendChild(script);
  }
  script.addEventListener("load",onLoad);
  script.addEventListener("error",onError);
  return()=>{cancelled=true;script?.removeEventListener("load",onLoad);script?.removeEventListener("error",onError)};
 },[latitude,longitude]);
 return <small>{address}</small>;
}

export function LiveLocation({point}:{point:Point|null}){return point?<GoogleRouteMap points={[point]} markers={[{...point,label:"Last known location"}]}/>:<div className="empty-state">No location available</div>}
