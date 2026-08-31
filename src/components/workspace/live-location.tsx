"use client";
import {GoogleRouteMap} from "@/app/workspace/reports/google-route-map";
export function LiveLocation({point}:{point:{latitude:number;longitude:number}|null}){return point?<GoogleRouteMap points={[point]} markers={[{...point,label:"Last known location"}]}/>:<div className="empty-state">No location available</div>}
