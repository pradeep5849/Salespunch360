"use client";
import {useEffect,useState} from "react";
import {GoogleRouteMap} from "@/app/workspace/reports/google-route-map";

type Point={latitude:number;longitude:number};
type GeocoderResult={formatted_address?:string};
type GoogleWindow=Window&{google?:{maps?:{Geocoder?:new()=>{geocode:(request:{location:{lat:number;lng:number}},callback:(results:GeocoderResult[]|null,status:string)=>void)=>void}}}};

export function LiveLocationAddress({point}:{point:Point|null}){
 const [address,setAddress]=useState(point?"Finding address…":"Address unavailable");
 useEffect(()=>{
  if(!point){setAddress("Address unavailable");return}
  setAddress("Finding address…");
  let cancelled=false;
  const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if(!key){setAddress("Address unavailable");return}
  const resolveAddress=()=>{
   const google=(window as GoogleWindow).google;
   const Geocoder=google?.maps?.Geocoder;
   if(!Geocoder){if(!cancelled)setAddress("Address unavailable");return}
   new Geocoder().geocode({location:{lat:point.latitude,lng:point.longitude}},(results,status)=>{
    if(cancelled)return;
    const resolved=status==="OK"?results?.[0]?.formatted_address?.trim():undefined;
    setAddress(resolved||"Address unavailable");
   });
  };
  const google=(window as GoogleWindow).google;
  if(google?.maps?.Geocoder){resolveAddress();return()=>{cancelled=true}}
  let script=document.querySelector<HTMLScriptElement>("script[data-sp360-google-maps]");
  const onLoad=()=>resolveAddress();
  const onError=()=>{if(!cancelled)setAddress("Address unavailable")};
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
 },[point]);
 return <small>{address}</small>;
}

export function LiveLocation({point}:{point:Point|null}){return point?<GoogleRouteMap points={[point]} markers={[{...point,label:"Last known location"}]}/>:<div className="empty-state">No location available</div>}
