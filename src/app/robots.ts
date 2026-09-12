import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{return{rules:{userAgent:"*",allow:"/",disallow:["/workspace/","/admin/","/api/"]},sitemap:"https://www.salespunch360.com/sitemap.xml",host:"https://www.salespunch360.com"}}
