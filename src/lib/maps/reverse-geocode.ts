
const MAX_ADDRESS_LENGTH=1000;
const TIMEOUT_MS=3000;

type GoogleGeocodeResponse={status?:unknown;results?:unknown};

/** Best-effort server-side reverse geocoding. All provider failures are intentionally hidden. */
export async function reverseGeocode(latitude:number,longitude:number):Promise<string|null>{
 const key=process.env.GOOGLE_MAPS_SERVER_API_KEY;
 if(!key)return null;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng",`${latitude},${longitude}`);url.searchParams.set("key",key);
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)return null;
  const body=await response.json() as GoogleGeocodeResponse;
  if(body.status!=="OK"||!Array.isArray(body.results))return null;
  for(const result of body.results){
   if(!result||typeof result!=="object")continue;
   const address=(result as{formatted_address?:unknown}).formatted_address;
   if(typeof address==="string"&&address.trim())return address.trim().slice(0,MAX_ADDRESS_LENGTH);
  }
  return null;
 }catch{return null;}finally{clearTimeout(timeout);}
}
