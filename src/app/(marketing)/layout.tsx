import "./marketing.css";
import {PublicHeader} from "@/components/public/public-header";
import {PublicFooter} from "@/components/public/public-footer";
export default function MarketingLayout({children}:{children:React.ReactNode}){return <div className="marketing"><PublicHeader/><main>{children}</main><PublicFooter/></div>}
