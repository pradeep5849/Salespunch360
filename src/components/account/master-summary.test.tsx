import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {MasterSummary} from "./master-summary";
it("shows saved category/unit/rates without leaking internal metadata",()=>{const html=renderToStaticMarkup(<MasterSummary canViewCosts value={{sellingRate:"0",estimatedCost:"25.50",unit:{name:"Day"},workCategory:{name:"Painting"},isActive:true,companyId:"private-company",passwordHash:"secret"}}/>);expect(html).toContain("Selling rate: 0");expect(html).toContain("25.50");expect(html).toContain("Painting");expect(html).toContain("Day");expect(html).not.toContain("private-company");expect(html).not.toContain("secret")});
it("does not invent prices or units for absent optional values",()=>{const html=renderToStaticMarkup(<MasterSummary value={{name:"Unpriced",salePrice:null,unit:null,trackInventory:false}}/>);expect(html).toContain("Disabled");expect(html).not.toContain("Sale price");expect(html).not.toContain("Unit:")});

it("hides saved cost fields without the existing money-view capability",()=>{const html=renderToStaticMarkup(<MasterSummary value={{costPrice:"123",estimatedCost:"456",salePrice:"789"}}/>);expect(html).not.toContain("Cost price");expect(html).not.toContain("Estimated cost");expect(html).toContain("Sale price")});
