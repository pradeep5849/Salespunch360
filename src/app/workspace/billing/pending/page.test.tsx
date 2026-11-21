import {beforeEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const m=vi.hoisted(()=>({order:vi.fn(),target:vi.fn()}));
vi.mock("@/lib/billing/service",()=>({billingOrderForCurrentCompany:m.order}));
vi.mock("@/lib/billing/unified-sales-team",()=>({unifiedTelecallerTargetForOrder:m.target}));
import Page from "./page";
beforeEach(()=>{m.target.mockResolvedValue(3);m.order.mockResolvedValue({id:"12345678-order",provider:"MANUAL",status:"PENDING",expiresAt:new Date(Date.now()+60000),billingPeriod:"YEARLY",adminSeats:1,managerSeats:2,salesSeats:4,accountPackages:0,totalAmount:"50.25"})});
it("shows target Telecaller capacity in confirmation and support message",async()=>{const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({order:"id"})}));expect(html).toContain("3 Telecaller");expect(html).toContain("Telecaller%3A%203");expect(html).toContain("50.25")});
it("does not invite payment for expired pending requests",async()=>{m.order.mockResolvedValueOnce({id:"expired",provider:"MANUAL",status:"PENDING",expiresAt:new Date("2020-01-01"),billingPeriod:"YEARLY",adminSeats:1,managerSeats:2,salesSeats:4,accountPackages:0,totalAmount:"50"});const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({order:"id"})}));expect(html).toContain("EXPIRED");expect(html).not.toContain("Contact on WhatsApp");expect(html).toContain("fresh request")});
