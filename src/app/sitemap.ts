import type {MetadataRoute} from "next";
import {features} from "@/lib/public-site/content";
const routes=["","/products","/products/salespunch360","/products/account","/products/plus","/features","/pricing","/compare","/apps","/android","/demo","/contact","/resources","/resources/faq","/security","/about","/privacy","/terms"];
export default function sitemap():MetadataRoute.Sitemap{const base="https://www.salespunch360.com";return[...routes,...features.map(feature=>`/features/${feature.slug}`)].map((route)=>({url:`${base}${route}`,changeFrequency:route===""?"weekly":"monthly",priority:route===""?1:route.startsWith("/products")?.8:.7}))}
